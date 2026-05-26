# Open Cometa

An open-source community interface for the [Cometa](https://cometa.farm/) farming
contracts on Algorand mainnet. Connect your wallet, see your positions, withdraw or
claim rewards — directly against the existing on-chain contracts.

**Not affiliated with Cometa.** Calls only the existing on-chain contracts. Your keys
never leave your wallet.

## Why this exists

Cometa's official frontend has been unreliable. The smart contracts on Algorand are
still live and working — they just need a working interface to talk to them. This is
that interface, open-source, no backend, no analytics.

## What it does

- Bundles a snapshot of **423 Cometa farm + distribution contracts** (App IDs, stake /
  reward asset IDs, descriptions) so the tool works without depending on Cometa's API.
- Connects via [@txnlab/use-wallet](https://github.com/TxnLab/use-wallet) — supports
  Pera, Defly, Lute, Exodus, Kibisis.
- Reads on-chain local state from Algonode and surfaces the user's positions.
- For each position, builds the appropriate `claim()` + `unstake(amount)` calls in a
  group transaction with the correct fee bump.
- Asks the wallet to sign, submits, waits for confirmation.

The transaction shape (`appArgs`, `accounts`, `foreignAssets`) is derived empirically
per-farm by sampling a recent successful call from the public indexer — so the tool
keeps working across all Cometa contract versions.

## Read-only mode

Open `?addr=YOURADDRESS` or use the "look up any address" form on the page to preview
detected positions for any address without connecting a wallet.

## Running locally

```sh
bun install
bun run dev          # http://localhost:5173
bun run build        # production bundle at public/dist/
```

## Stack

- **Bun** + vanilla TypeScript + `Bun.serve` dev server
- **algosdk v3** against public Algonode mainnet endpoints
- **@txnlab/use-wallet v4** for wallet adapters
- Static HTML/CSS — no framework

## Files

```
src/
  app.ts           main entrypoint, wires UI + wallet + algorand
  server.ts        Bun.serve dev server with on-demand build
  wallet.ts        use-wallet session wrapper
  algorand.ts      algod/indexer clients, account fetching
  cometa.ts        transaction building + per-farm template discovery
  localState.ts    decoder for Reach-encoded user local state
  positions.ts     filters opted-in apps to known Cometa farms
  ui.ts            DOM manipulation, templates, toasts
  farms.json       423 Cometa farm contract metadata snapshot
public/
  index.html       single page
  styles.css       clean, calm, single-column
```

## Trust posture

This is a small surface to audit, intentionally:

- No backend, no analytics, no third-party RPCs beyond Algonode (the farm metadata
  snapshot is already bundled — no runtime calls to Cometa's API).
- The app makes **no signed transaction without you reviewing it in your wallet first**.
- Compare every App ID shown against
  [allo.info](https://allo.info/) before signing.
- Withdraw transactions transfer nothing out of your account except the network fee —
  the contract sends your stake and rewards back via inner transactions.

If something looks wrong, don't sign. [File an issue.](https://github.com/CorvidLabs/open-cometa/issues)

## License

MIT
