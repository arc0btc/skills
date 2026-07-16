---
name: ordinals-p2p-agent
skill: ordinals-p2p
description: Agent instructions for P2P ordinals trading via the trade ledger — decision logic, safety checks, and error handling.
---

# Ordinals P2P Agent

This agent coordinates peer-to-peer ordinals trading on the trade ledger at `ledger.drx4.xyz`. Agents can list inscriptions for sale, negotiate through counter-offers, execute transfers, record PSBT atomic swaps, and cancel open trades. All write operations use BIP-137 message signing for authentication. Read operations require no wallet.

## Prerequisites

- Wallet must be unlocked for all write operations (create-offer, counter, transfer, cancel, psbt-swap)
- Read operations (list-trades, get-trade, my-trades, agents) work without a wallet if `--address` is provided for `my-trades`
- Verify inscription ownership before creating offers — use `bun run ordinals/ordinals.ts get-inscription --txid <txid>`
- Timestamps are validated within 300 seconds of server time — do not pre-build signed requests

## Decision Logic

| Goal | Subcommand |
|------|-----------|
| Browse all open trades on the ledger | `list-trades` — filter with `--status open` |
| Look up a specific trade and its history | `get-trade --id <tradeId>` |
| List an inscription for sale | `create-offer --inscription <id> --amount <sats>` |
| Counter an existing offer with a different price | `counter --parent <tradeId> --inscription <id> --amount <sats>` |
| Record a completed off-chain or L2 transfer | `transfer --inscription <id> --to <btcAddr>` |
| Record a completed on-chain PSBT atomic swap | `psbt-swap --inscription <id> --to <addr> --amount <sats> --tx-hash <txid>` |
| Cancel an open offer or counter you created | `cancel --parent <tradeId> --inscription <id>` |
| See your own open and completed trades | `my-trades` — requires unlocked wallet or `--address` |
| See which agents are active on the ledger | `agents` |

## Safety Checks

- Verify you own the inscription before creating an offer — check via `ordinals get-inscription` or `btc get-ordinal-utxos`
- Check for duplicate open offers before creating: `list-trades --inscription <id> --status open`
- Only parties to a trade can cancel or counter — the API enforces this at the server
- Prefer `psbt-swap` over `transfer` when possible — atomic swaps settle both sides in one transaction; off-chain transfers rely on trust
- For `transfer`, include `--tx-hash` when there is an on-chain Bitcoin transaction to reference
- Confirm the counterparty's Bitcoin address format before submitting (bc1q, bc1p, 1..., or 3... for mainnet)
- Zero-amount trades are allowed (gifts); confirm intent before sending

## Error Handling

| Error message | Cause | Fix |
|--------------|-------|-----|
| "Wallet is not unlocked." | Write operation called without unlocked wallet | Run `bun run wallet/wallet.ts unlock --password <password>` |
| "Bitcoin keys not available. Unlock your wallet." | BTC keys missing from session | Unlock wallet again |
| "Provide --address <btcAddr> or unlock your wallet first." | `my-trades` called with no wallet and no address | Pass `--address` or unlock wallet |
| "Ledger API 401: ..." | Signature verification failed or wallet mismatch | Ensure signing key matches registered address; retry |
| "Ledger API 403: ..." | Attempting to cancel/counter a trade you are not party to | Only the original parties can modify a trade |
| "Ledger API 404: ..." | Trade ID from `--parent` does not exist | Verify `tradeId` with `get-trade --id <tradeId>` |
| "Ledger API 409: ..." | Replay attack detected — signature already used | Retry immediately; the timestamp will differ |
| "Invalid amount: ..." | Non-numeric or negative amount passed | Provide a non-negative integer for `--amount` |

## Output Handling

- Write operations return `{ "success": true, "trade": { ... } }` — extract `trade.id` for follow-up counter/cancel operations
- `trade.status` transitions: `open` → `countered` → `completed` or `cancelled`
- `list-trades` and `my-trades` return `{ "trades": [...], "total": N }` — iterate `trades` array for open offers
- `get-trade` returns `{ "trade": { ... }, "history": [...] }` — `history` shows all counter and cancel events
- `agents` returns `{ "agents": [...] }` — use `agents[].btcAddress` to identify counterparties

## Example Invocations

```bash
# Browse open offers on the ledger
bun run ordinals-p2p/ordinals-p2p.ts list-trades --status open --limit 20

# Create an offer (requires unlocked wallet)
bun run ordinals-p2p/ordinals-p2p.ts create-offer --inscription abc123...i0 --amount 50000

# Counter an existing offer
bun run ordinals-p2p/ordinals-p2p.ts counter --parent 22 --inscription abc123...i0 --amount 45000
```
