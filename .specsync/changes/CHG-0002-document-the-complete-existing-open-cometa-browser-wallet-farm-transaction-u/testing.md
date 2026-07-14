---
change: CHG-0002-document-the-complete-existing-open-cometa-browser-wallet-farm-transaction-u
artifact: testing
---

# Testing

- Released SpecSync 5.0.1 must pass forced strict validation with required coverage 100.
- Portable SpecSync 5.0.2 records lifecycle evidence without replacing the released consumer version.
- `specsync agents status` must report Claude, Cursor, Codex, and Gemini installed.
- `fledge lanes run verify` must install locked dependencies, pass TypeScript checking, build the minified browser application, and enforce the 5 MiB budget.
- Live wallet, Algonode, simulation, signing, submission, and confirmation operations are not executed by this migration and are not claimed as native evidence.

| Requirements | Evidence |
|---|---|
| `REQ-open-cometa-001` | Source review of `farms.ts`, `farms.json`, and the `ALL_APP_IDS` filter in `positions.ts`; complete TypeScript compilation and browser bundling. |
| `REQ-open-cometa-002`, `REQ-open-cometa-003` | Source review of Algod response normalization, zero-byte-key extraction, tag validation, and big-endian decoding in `algorand.ts` and `localState.ts`; complete TypeScript compilation. |
| `REQ-open-cometa-004` | Source review of known-app filtering, zero fallback, descending bigint ordering, and ID tie-breaking in `positions.ts`; complete TypeScript compilation. |
| `REQ-open-cometa-005`, `REQ-open-cometa-006` | Source review of the five configured wallet adapters, store subscription, delegated signing, address validation, and read-only signing guard in `wallet.ts` and `app.ts`; production browser bundle. |
| `REQ-open-cometa-007` | Source review of paginated Indexer sampling, method-tag classification, cache reuse, and rejection eviction in `cometa.ts`; complete TypeScript compilation. |
| `REQ-open-cometa-008`, `REQ-open-cometa-009` | Source review of application arguments, foreign references, fee, integer encoding, opt-in conditions, and one-call group construction in `cometa.ts`; complete TypeScript compilation. |
| `REQ-open-cometa-010` | Source review of per-group unsigned simulation, first-failure mapping, and message cleanup in `cometa.ts`; complete TypeScript compilation. |
| `REQ-open-cometa-011` | Source review of signature-count validation and sequential send/confirmation in `app.ts`; production browser bundle. |
| `REQ-open-cometa-012` | Source review of account/position/status/toast rendering and post-confirmation success flow in `app.ts` and `ui.ts`; production browser bundle against the static page. |
| `REQ-open-cometa-013` | Source review of Bun build caching, source watching, rooted static paths, and explicit HTTP error responses in `server.ts`; complete TypeScript compilation. |
| `REQ-open-cometa-014` | Direct execution of `fledge lanes run verify`, which composes frozen installation, TypeScript checking, minified browser build, and the 5 MiB assertion. |
| `REQ-open-cometa-015` | Source review of every DOM identifier and template consumed by `ui.ts` and `app.ts`; successful production browser bundle with `public/index.html` and `public/styles.css` mapped by the canonical companion. |
