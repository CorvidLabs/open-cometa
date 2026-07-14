---
module: open-cometa
version: 2
status: stable
files:
  - src/algorand.ts
  - src/app.ts
  - src/cometa.ts
  - src/farms.ts
  - src/localState.ts
  - src/positions.ts
  - src/server.ts
  - src/ui.ts
  - src/wallet.ts
  - public/index.html
  - public/styles.css
db_tables: []
depends_on: []
---

# Open Cometa Browser Application

## Purpose

Provide a client-side interface for inspecting known Cometa farming positions on Algorand mainnet and, after explicit wallet approval, claiming rewards or withdrawing stake through the existing contracts. The application also supports a read-only address view that never signs or submits transactions.

## Public API

| Export | Contract |
|---|---|
| `ALGOD_URL` | Public mainnet Algod endpoint. |
| `INDEXER_URL` | Public mainnet Indexer endpoint. |
| `algod` | Shared Algod SDK client. |
| `indexer` | Shared Indexer SDK client. |
| `OptedInApp` | Normalized application opt-in and encoded local state. |
| `AssetHolding` | Normalized asset identifier and integer balance. |
| `AccountInfo` | Normalized account balance, assets, and app opt-ins. |
| `fetchAccount` | Reads and normalizes public account state. |
| `fetchAssetInfo` | Reads asset identity and decimal metadata. |
| `formatAmount` | Renders an integer amount using supplied decimals. |
| `Farm` | Committed farm or distribution metadata record. |
| `ALL_FARMS` | Immutable committed farm catalog. |
| `farmById` | Looks up one farm by application ID. |
| `ALL_APP_IDS` | Set of all cataloged application IDs. |
| `CometaLocalState` | Decoded tagged contract-local-state fields and raw bytes. |
| `parseLocalState` | Validates and decodes the tagged binary layout. |
| `Position` | Known farm plus its decoded account stake. |
| `findCometaPositions` | Filters and sorts account opt-ins into known positions. |
| `CallTemplate` | Accounts and foreign references derived for an app call. |
| `clearTemplateCache` | Discards all cached app-call templates. |
| `getCallTemplate` | Returns or discovers the call template for an app. |
| `BuildCallParams` | Common sender, app, template, and network parameters. |
| `buildClaimTxn` | Creates one claim application call. |
| `buildUnstakeTxn` | Creates one amount-bearing unstake application call. |
| `TxnStep` | Stable name for opt-in, claim, or unstake work. |
| `TxnGroup` | Transactions and corresponding step names submitted together. |
| `PositionWithdrawTxns` | Prepared ordered groups plus involved asset IDs. |
| `buildWithdrawAndClaim` | Builds missing opt-ins and independent contract-call groups. |
| `SimulateResult` | Structured first-failure or success result for group simulation. |
| `simulateGroups` | Simulates independent transaction groups in order. |
| `buildCloseOutTxn` | Creates an explicit application close-out call. |
| `ConnectableWalletId` | Supported wallet-adapter identifier union. |
| `ConnectableWallet` | Selectable wallet identity and availability. |
| `WalletEvent` | Connected or disconnected session event. |
| `WalletListener` | Observer callback for wallet events. |
| `WalletSession` | Mainnet wallet discovery, connection, observation, and signing wrapper. |
| `setStatus` | Renders network, farm-count, and round status. |
| `showSection` | Shows or hides one application stage. |
| `setStageChip` | Updates the requested connection-stage chip. |
| `renderAccount` | Renders address, wallet name, and ALGO balance. |
| `clearAccount` | Clears rendered account state. |
| `PositionAction` | User-selected claim or withdrawal event. |
| `setPositionsLoading` | Toggles position loading and clears stale results. |
| `renderPositions` | Renders sorted farm cards and binds their actions. |
| `ToastOptions` | Visible notice content, severity, link, and lifetime. |
| `toast` | Renders a dismissible progress or result notice. |
| `setWalletButtonsEnabled` | Enables or disables every wallet button. |
| `bindWalletButtons` | Binds wallet buttons to their adapter IDs. |
| `bindScanButton` | Binds the account-rescan control. |
| `bindDisconnect` | Binds the wallet disconnect control. |
| `bindCopyAddress` | Copies the full rendered address or reports denial. |

## Invariants

1. Read-only address inspection never requests signatures or submits transactions.
2. Wallet private keys remain in the selected wallet adapter; the application receives only accounts and signed bytes.
3. Claim and unstake application calls remain separate transaction groups because the deployed contracts assert a group size of one.
4. Required asset opt-ins precede contract calls and do not duplicate an existing opt-in or a shared stake/reward asset.
5. A wallet response must contain one signed payload for every proposed transaction before submission begins.
6. Transaction groups are submitted sequentially and each group is confirmed before the next group is sent.
7. Only application IDs present in the committed farm catalog are displayed as Cometa positions.
8. Runtime farm discovery uses Algonode only; it does not call a Cometa-operated API.

## Behavioral Examples

### Read-only inspection

Given a syntactically valid 58-character Algorand address, when the user submits the read-only form or supplies the `addr` query parameter, the application fetches that account, renders known Cometa positions, and disables signing operations.

### Withdraw an active position

Given a connected wallet and an active position, when the user chooses Withdraw, the application determines missing asset opt-ins, creates independent claim and unstake groups, optionally simulates eligible groups, obtains signatures in one wallet interaction, submits each group in order, waits for confirmation, and refreshes the account.

### Claim rewards only

Given a known position, when the user chooses Claim, the application creates no unstake call and submits only the required opt-ins followed by the claim call.

## Error Cases

- Invalid read-only addresses are rejected before any account request.
- Unknown wallets, cancelled connections, blocked popups, and missing browser extensions produce visible connection messages.
- Missing or malformed local-state bytes produce no decoded state rather than invented balances.
- Farms without recent claim or unstake history fail template discovery explicitly and are removed from the cache for a future retry.
- Algod simulation failures identify the failed group and step when the node supplies that information.
- Missing signatures, rejected submissions, confirmation failures, account lookup failures, and clipboard denial surface visible errors.
- The development server returns 403 for paths outside the public root, 404 for absent files, and 500 JavaScript for failed on-demand builds.

## Dependencies

- Bun supplies dependency installation, bundling, the development server, and the CI runtime.
- TypeScript validates the browser and server modules.
- `algosdk` provides clients, transaction construction, simulation models, encoding, submission, and confirmation.
- `@txnlab/use-wallet` and its adapters provide wallet discovery and signing.
- Public Algonode mainnet Algod and Indexer endpoints provide chain data.
- The committed `farms.json` snapshot provides farm metadata without a Cometa API request.

## Change Log

| Version | Date | Changes |
|---|---|---|
| 1 | 2026-07-14 | Documented the existing browser, wallet, farm, contract-call, UI, and development-server behavior for SpecSync 5 adoption. |
| 2 | 2026-07-14 | CHG-0002-document-the-complete-existing-open-cometa-browser-wallet-farm-transaction-u: Document the complete existing Open Cometa browser, wallet, farm, transaction, UI, and development-server contract |
