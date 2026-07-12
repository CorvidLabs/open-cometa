---
change: CHG-0001-adopt-specsync-5-0-1-and-trust-1-0-0-governance-for-open-cometa
artifact: testing
---

# Testing

Run `specsync check --strict --force` at threshold 0, `specsync agents status`, `fledge trust doctor`, and `fledge lanes run verify`. The blocking lane must install from the lockfile, pass TypeScript checking, build the browser bundle, and enforce its 5 MB limit.
