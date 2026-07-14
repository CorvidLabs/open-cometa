---
spec: open-cometa.spec.md
---

## Requirements

### REQ-open-cometa-001

The application SHALL use the committed farm snapshot as its complete runtime catalog and expose only cataloged application IDs as Cometa positions.

Acceptance Criteria
- Position discovery rejects account app opt-ins absent from `ALL_APP_IDS`.

### REQ-open-cometa-002

Account loading SHALL normalize ALGO balance, minimum balance, asset holdings, application opt-ins, and the byte value stored under the contract's zero-byte local-state key.

Acceptance Criteria
- `fetchAccount` derives each returned field from the Algod account response.

### REQ-open-cometa-003

Local-state decoding SHALL require the implemented 60-byte tagged layout and return no decoded state for absent, short, or incorrectly tagged input.

Acceptance Criteria
- Valid input decodes three 64-bit fields and one 256-bit accumulator in big-endian order.

### REQ-open-cometa-004

Position discovery SHALL use zero stake when decoded state is unavailable, sort nonzero stake first by descending amount, and use application ID as the deterministic tie-breaker.

Acceptance Criteria
- `findCometaPositions` preserves the implemented ordering for mixed balances and ties.

### REQ-open-cometa-005

Wallet sessions SHALL support Pera, Defly, Lute, Exodus, and Kibisis on mainnet, emit connection changes, and delegate signing without receiving wallet private keys.

Acceptance Criteria
- The session returns accounts and signed byte arrays through the selected adapter.

### REQ-open-cometa-006

Read-only mode SHALL accept only uppercase Base32-shaped 58-character Algorand addresses and prevent claim or withdrawal signing and submission.

Acceptance Criteria
- Read-only actions display the implemented informational notice instead of invoking the wallet.

### REQ-open-cometa-007

Call-template discovery SHALL inspect up to four pages of recent app transactions, distinguish claim and unstake variants by encoded method tags, cache successful discovery per app, and evict failed discoveries.

Acceptance Criteria
- A farm without a usable sample fails explicitly and remains retryable.

### REQ-open-cometa-008

Claim and unstake builders SHALL preserve the four implemented application arguments, discovered account and foreign references, flat 4,000-microALGO fee, and big-endian encoded unstake amount.

Acceptance Criteria
- Each builder returns one NoOp application transaction with its required variant tag.

### REQ-open-cometa-009

Withdrawal preparation SHALL add only missing nonzero reward and stake asset opt-ins, avoid duplicate opt-ins for a shared asset, and keep claim and unstake calls in separate one-transaction groups.

Acceptance Criteria
- Unstake is omitted when the requested staked amount is zero.

### REQ-open-cometa-010

Group simulation SHALL request empty-signature simulation one group at a time and return the first missing result or node failure with its group index, mapped step when available, cleaned message, and raw failure.

Acceptance Criteria
- Complete successful simulation returns no invented failure fields.

### REQ-open-cometa-011

Submission SHALL require one signed payload per proposed transaction, submit groups in order, and await confirmation of each group before sending the next.

Acceptance Criteria
- A partial wallet signature response fails before any group is submitted.

### REQ-open-cometa-012

Account, position, network, wallet, transaction-progress, explorer-link, and error rendering SHALL derive from observed application or chain state and SHALL NOT report success before confirmation.

Acceptance Criteria
- Confirmed transaction IDs link to the existing explorer destination.

### REQ-open-cometa-013

The development server SHALL build the browser entry, invalidate its cache for TypeScript or JSON changes, serve only files rooted under `public`, and return explicit forbidden, missing-file, and build-failure responses.

Acceptance Criteria
- Static path traversal cannot escape the public root.

### REQ-open-cometa-014

Pull-request verification SHALL install locked Bun dependencies, pass TypeScript checking, produce the minified browser bundle, and reject a bundle larger than 5 MiB.

Acceptance Criteria
- `fledge lanes run verify` composes all four deterministic checks.

### REQ-open-cometa-015

The static page SHALL retain wallet connection, read-only lookup, account, position, action, and toast controls required by the browser bindings with the existing responsive presentation.

Acceptance Criteria
- Production bundling resolves the browser entry against the committed page structure and styles.

## Verification Boundaries

- CI performs locked installation, type checking, bundling, and the size budget without connecting a wallet or mutating mainnet.
- Live wallet adapters, Algonode responses, farm history, simulation, signing, submission, and confirmation remain operator-driven runtime integrations.
