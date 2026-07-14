---
change: CHG-0002-document-the-complete-existing-open-cometa-browser-wallet-farm-transaction-u
artifact: context
---

# Context

Open Cometa currently has nine TypeScript modules and static HTML/CSS assets but no canonical requirement companion. The implementation reads public Algorand state, filters known Cometa farm opt-ins, derives call templates from successful chain history, delegates signatures to external wallets, and serves a static browser application. This change documents those existing boundaries only; it does not modify product sources or live transaction behavior.
