---
change: CHG-0001-adopt-specsync-5-0-1-and-trust-1-0-0-governance-for-open-cometa
artifact: context
---

# Context

Open Cometa is a Bun/TypeScript browser application for Algorand wallets, farms, positions, and local state. Existing CI installs locked dependencies, type-checks, builds a browser bundle, and enforces a 5 MB budget. Pages deployment independently publishes the built application. No prior SpecSync threshold or companions exist.
