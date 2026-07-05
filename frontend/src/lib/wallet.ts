import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit'
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter'
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull'
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo'
import { LobstrModule } from '@creit.tech/stellar-wallets-kit/modules/lobstr'
import { CONFIG } from './config'

/** Stellar Wallets Kit (v2.5, static API). Freighter (desktop), LOBSTR
 *  (Android), xBull, Albedo — one modal covers every signer, which is what
 *  makes the Android test path work. */
StellarWalletsKit.init({
  network: CONFIG.network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET,
  modules: [
    new FreighterModule(),
    new LobstrModule(),
    new xBullModule(),
    new AlbedoModule(),
  ],
})

/** Open the wallet chooser; resolve with the chosen address. */
export async function connectWallet(): Promise<string> {
  const { address } = await StellarWalletsKit.authModal()
  return address
}

/** Sign a transaction XDR with the connected wallet; returns signed XDR. */
export async function signTx(xdr: string, address: string): Promise<string> {
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
    address,
    networkPassphrase: CONFIG.networkPassphrase,
  })
  return signedTxXdr
}

export { StellarWalletsKit as kit }
