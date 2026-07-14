---
spec: open-cometa.spec.md
---

# Testing

The deterministic verification lane runs `bun install --frozen-lockfile`, `bun x tsc --noEmit`, the production browser bundle, and a 5 MiB size assertion. These checks cover compilation, module integration, dependency reproducibility, and the deployable artifact without performing wallet operations or mainnet mutations.

The migration additionally requires SpecSync strict validation at 100% measured source coverage and Trust verification. Operator-driven runtime boundaries remain explicit in the requirements companion.
