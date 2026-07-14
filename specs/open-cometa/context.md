---
spec: open-cometa.spec.md
---

# Context

Open Cometa is a static browser application plus a Bun development server. It reads public Algorand mainnet data, derives the transaction shape for known Cometa farms from prior successful calls, and delegates signatures to external wallets. Its committed farm snapshot avoids a runtime dependency on the original Cometa frontend or API.
