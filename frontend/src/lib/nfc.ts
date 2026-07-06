// Web NFC claim cards (doc §4.4). Android Chrome only — everything here is
// feature-detected; callers must check `nfcSupported()` before use.
//
// The card stores a claim deep-link (URL record):
//   https://<app>/claim?owner=G...
// It signs nothing — it just carries the owner's address so an heir can tap
// to jump straight into claiming.

/** NDEFReader isn't in TS's DOM lib yet; minimal shape we use. */
interface NDEFRecordLike {
  recordType: string
  encoding?: string
  data?: DataView
}
interface NDEFReadingEventLike {
  message: { records: NDEFRecordLike[] }
}
interface NDEFReaderLike {
  scan: () => Promise<void>
  write: (msg: { records: { recordType: string; data: string }[] }) => Promise<void>
  onreading: ((e: NDEFReadingEventLike) => void) | null
  onreadingerror: (() => void) | null
}

const ADDR_RE = /G[A-Z2-7]{55}/

export const nfcSupported = (): boolean =>
  typeof window !== 'undefined' && 'NDEFReader' in window

function newReader(): NDEFReaderLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (window as any).NDEFReader() as NDEFReaderLike
}

/** Extract a Stellar owner address from whatever a tag holds (URL or text). */
function ownerFromRecords(records: NDEFRecordLike[]): string | null {
  for (const rec of records) {
    if (!rec.data) continue
    const text = new TextDecoder(rec.encoding || 'utf-8').decode(rec.data)
    // Deep-link form: ...?owner=G...  — or a raw address anywhere in the text.
    const m = text.match(ADDR_RE)
    if (m) return m[0]
  }
  return null
}

/** Scan one tag and resolve the owner address on it. */
export async function readClaimCard(): Promise<string> {
  const reader = newReader()
  await reader.scan()
  return new Promise<string>((resolve, reject) => {
    reader.onreadingerror = () => reject(new Error('Could not read the card. Try again.'))
    reader.onreading = (e) => {
      const owner = ownerFromRecords(e.message.records)
      if (owner) resolve(owner)
      else reject(new Error('No Pamana address found on this card.'))
    }
  })
}

/** Write a claim deep-link for `owner` onto a blank tag. */
export async function writeClaimCard(owner: string): Promise<void> {
  const writer = newReader()
  const url = `${window.location.origin}/claim?owner=${owner}`
  await writer.write({ records: [{ recordType: 'url', data: url }] })
}
