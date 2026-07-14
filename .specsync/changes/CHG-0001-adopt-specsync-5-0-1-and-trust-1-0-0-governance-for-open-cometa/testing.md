---
change: CHG-0001-adopt-specsync-5-0-1-and-trust-1-0-0-governance-for-open-cometa
artifact: testing
---

# Testing

Run `specsync check --strict --require-coverage 100 --force`, `specsync agents status`, `fledge trust doctor`, and `fledge lanes run verify`. The blocking lane must install from the lockfile, pass TypeScript checking, build the browser bundle, and enforce its 5 MiB limit. Hosted success is assessed separately on the exact pull-request head.
