import { Layout } from '../../components/Layout'
import { VaultPanel } from '../../components/VaultPanel'

/** The owner's vault — the app's core feature, on its own distinct tab. */
export function Vault() {
  return (
    <Layout>
      <VaultPanel />
    </Layout>
  )
}
