# Contract Deployment & Toolchain

Deployment log + pinned toolchain for Pamana's Soroban contracts.

## Toolchain (verified Phase 0, 2026-07-06)

| Tool | Version |
|------|---------|
| Node.js | 24.x |
| Rust / cargo | 1.94.x |
| Build target | `wasm32v1-none` (stellar-cli default) |
| stellar-cli | 25.2.0 |
| soroban-sdk | 22.x (workspace-pinned in `contracts/Cargo.toml`) |

> SDK note: stellar-cli 25.2 builds against `wasm32v1-none` and pairs with `soroban-sdk` 22.x — the setup proven on PalengkePay Pro. Do not bump the SDK without re-verifying the CLI build.

## Build

```bash
cd contracts
cargo test --workspace     # unit tests
stellar contract build     # -> target/wasm32v1-none/release/*.wasm
```

Phase 0 build output (skeletons):
- `pamana_vault.wasm` — hash `9c6492048f8310aeac1078c5bbc61449e2ff599dd3a5ad721b9b16cc544ae433`
- `pamana_factory.wasm` — hash `14fde08027676c63c11e04751ecc421ad97d2fcc8ff07c61f00daa4904443254`

## Testnet identity

| Alias | Address |
|-------|---------|
| `pamana-testnet` | `GDVWTEQQHWWPB7BHGVZDNZQGNWNB4EDLOKTHHNW2AXLI7JBC6SRJM4X3` |

- Created + funded via Friendbot: `stellar keys generate pamana-testnet --network testnet --fund`
- Secret key lives in `~/.config/stellar/identity/pamana-testnet.toml` — **never committed**.
- Network passphrase: `Test SDF Network ; September 2015`.

## Deployed contract IDs (Testnet — MULTI-TOKEN, 2026-07-06)

Current live deploy after the multi-token rework. **Use these.**

| Contract | Testnet ID | Explorer |
|----------|-----------|----------|
| PamanaFactory | `CANQJ6N5BNPYY5CZWGRY7QTZKAY7IAIMSI7RPRNJZP564DROBWOG5PQM` | [Stellar Expert →](https://stellar.expert/explorer/testnet/contract/CANQJ6N5BNPYY5CZWGRY7QTZKAY7IAIMSI7RPRNJZP564DROBWOG5PQM) |
| PamanaVault (first, via factory) | `CDJOXNIY6FMVUBDCDYV3VXWDXVZ323WURQ3VOLSNGH6BTHBMXP7X5LJG` | [Stellar Expert →](https://stellar.expert/explorer/testnet/contract/CDJOXNIY6FMVUBDCDYV3VXWDXVZ323WURQ3VOLSNGH6BTHBMXP7X5LJG) |

**Wasm install hashes:** vault `7fadec9c5c90d8d409f2d2b874f933c39fc8b26f9617d2406eed46799556c423` · factory `603f70b96596e0ff5293ff1568cbfd7cc4fd68c722849cca8db970d26f782eae`

A vault now holds **many tokens** — `create_vault(owner, timeout)` (no token param); tokens register on first `deposit(token, amount)`.

### Superseded (single-token, pre-rework)
- Factory `CAMKUFDTTIVDL4Z2UV6UISUDGSONOCCEZHTYH3EFTIA2ILSLLKV4F5RH`, vault `CADCW4D7PHXCWJ4VDEGPMMB37T4UXPKAMOB5XUZM4KGI7JW6QO4AAQQ4`. Do not use — old single-token API.

- **Admin / deployer:** `pamana-testnet` → `GDVWTEQQHWWPB7BHGVZDNZQGNWNB4EDLOKTHHNW2AXLI7JBC6SRJM4X3`
- **Vault token (native XLM SAC, testnet):** `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- **First vault's heir (test):** `pamana-heir` → `GD5JRNYAPZBW3B4HMR6APDEU7JOJ3C7AANEEHBD7TQ6QWBZGWKLHWUQQ`

### Deploy sequence (reproducible)
```bash
# 1. install vault code
stellar contract upload  --wasm target/wasm32v1-none/release/pamana_vault.wasm   --source pamana-testnet --network testnet
# 2. deploy factory
stellar contract deploy  --wasm target/wasm32v1-none/release/pamana_factory.wasm --source pamana-testnet --network testnet
# 3. point factory at the vault code
stellar contract invoke --id <FACTORY> ... -- init --admin <ADMIN> --vault_wasm_hash <VAULT_HASH>
# 4. stamp out a family vault
stellar contract invoke --id <FACTORY> ... -- create_vault --owner <OWNER> --token <NATIVE_SAC> --timeout 60
```
