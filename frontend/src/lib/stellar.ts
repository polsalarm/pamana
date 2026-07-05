import {
  rpc,
  TransactionBuilder,
  BASE_FEE,
  Contract,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk'
import { CONFIG } from './config'
import { signTx } from './wallet'

export const server = new rpc.Server(CONFIG.rpcUrl, {
  allowHttp: CONFIG.rpcUrl.startsWith('http://'),
})

/** Build ScVal args for a contract call. */
export const addr = (a: string): xdr.ScVal => new Address(a).toScVal()
export const u64 = (n: number | bigint): xdr.ScVal =>
  nativeToScVal(BigInt(n), { type: 'u64' })
export const i128 = (n: number | bigint): xdr.ScVal =>
  nativeToScVal(BigInt(n), { type: 'i128' })

/** Read-only contract call via simulation. Returns the native JS value. */
export async function readContract<T = unknown>(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  sourceAddress: string,
): Promise<T> {
  const source = await server.getAccount(sourceAddress)
  const contract = new Contract(contractId)
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: CONFIG.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build()

  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`simulate ${method} failed: ${sim.error}`)
  }
  const retval = (sim as rpc.Api.SimulateTransactionSuccessResponse).result
    ?.retval
  return retval ? (scValToNative(retval) as T) : (undefined as T)
}

/** Write contract call: build → prepare → sign (wallet) → send → poll. */
export async function writeContract<T = unknown>(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  sourceAddress: string,
): Promise<T> {
  const source = await server.getAccount(sourceAddress)
  const contract = new Contract(contractId)
  const built = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: CONFIG.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build()

  const prepared = await server.prepareTransaction(built)
  const signedXdr = await signTx(prepared.toXDR(), sourceAddress)
  const signedTx = TransactionBuilder.fromXDR(
    signedXdr,
    CONFIG.networkPassphrase,
  )

  const sent = await server.sendTransaction(signedTx)
  if (sent.status === 'ERROR') {
    throw new Error(`send ${method} failed: ${JSON.stringify(sent.errorResult)}`)
  }

  // Poll until the transaction is confirmed.
  let got = await server.getTransaction(sent.hash)
  for (let i = 0; i < 30 && got.status === 'NOT_FOUND'; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    got = await server.getTransaction(sent.hash)
  }
  if (got.status !== 'SUCCESS') {
    throw new Error(`tx ${method} did not succeed: ${got.status}`)
  }
  return (got.returnValue ? scValToNative(got.returnValue) : undefined) as T
}
