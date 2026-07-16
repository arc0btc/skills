---
name: ordinals-agent
skill: ordinals
description: Bitcoin ordinals operations — get the Taproot receive address, estimate inscription fees, create inscriptions via two-step commit/reveal, and fetch existing inscription content.
---

# Ordinals Agent

This agent handles Bitcoin ordinals inscription operations using the micro-ordinals library and mempool.space API. Creating inscriptions uses a two-step commit/reveal pattern: `inscribe` broadcasts the commit transaction, then after it confirms, `inscribe-reveal` finalizes the inscription. All write operations require an unlocked wallet with Taproot key support.

## Prerequisites

- Wallet must be unlocked for `get-taproot-address`, `inscribe`, and `inscribe-reveal` — use `bun run wallet/wallet.ts unlock --password <password>` first
- Wallet must have BTC balance on the SegWit (bc1q/tb1q) address to fund the commit transaction
- `estimate-fee` and `get-inscription` do not require a wallet
- Inscriptions are received at the Taproot (bc1p/tb1p) address, not the SegWit address
- Content must be base64-encoded before passing to `--content-base64`

## Decision Logic

| Goal | Subcommand |
|------|-----------|
| Get the wallet's Taproot address for receiving inscriptions | `get-taproot-address` — requires unlocked wallet |
| Calculate total cost before committing to an inscription | `estimate-fee` — provide content type and base64 content |
| Step 1 of inscription: broadcast commit transaction | `inscribe` — save `commitTxid`, `revealAmount`, `feeRate` from response |
| Step 2 of inscription: finalize after commit confirms | `inscribe-reveal` — requires same content as commit step |
| Fetch content and metadata from an existing inscription | `get-inscription` — takes reveal transaction ID |

## Safety Checks

- Run `estimate-fee` before `inscribe` to confirm you have enough BTC for total cost
- After `inscribe`, **wait for the commit transaction to confirm** before running `inscribe-reveal` — check mempool.space explorer
- The `contentType`, `contentBase64`, and `feeRate` passed to `inscribe-reveal` must exactly match what was used in `inscribe` — mismatch produces an incorrect reveal script and failed inscription
- Do not spend the commit output (the UTXO at `revealAddress`) with any other transaction — it is reserved for the reveal
- Never use ordinal UTXOs as fee inputs in the commit transaction; use `btc get-cardinal-utxos` to confirm safe-to-spend UTXOs exist first

## Error Handling

| Error message | Cause | Fix |
|--------------|-------|-----|
| "Wallet not unlocked. Use wallet/wallet.ts unlock first." | Write operation called without unlocked wallet | Run `bun run wallet/wallet.ts unlock --password <password>` |
| "Wallet doesn't have Bitcoin addresses. Use a managed wallet." | Wallet session missing BTC address fields | Unlock a managed wallet (not env-var-based) |
| "Bitcoin keys not available. Wallet may not be unlocked." | Keys missing from session | Unlock wallet again |
| "No UTXOs available for address .... Send some BTC first." | No BTC to fund the commit transaction | Send BTC to the wallet's SegWit address |
| "--reveal-amount must be a positive integer (satoshis)" | Invalid reveal amount passed | Copy `revealAmount` exactly from the `inscribe` response |
| "--commit-txid must be exactly 64 hex characters" | Malformed txid | Verify the txid from `inscribe` response is 64 hex chars |
| "--txid must be exactly 64 hex characters" | Malformed txid for `get-inscription` | Use the reveal transaction ID, not inscription ID |
| "--fee-rate must be 'fast', 'medium', 'slow', or a positive number" | Invalid fee-rate value | Use a named tier or a positive number |

## Output Handling

- `get-taproot-address`: use `address` as the recipient for incoming inscriptions
- `estimate-fee`: use `fees.totalCost` to verify wallet balance before inscribing; `fees.commitFee` and `fees.revealAmount` show the split
- `inscribe`: **save** `commitTxid`, `revealAmount`, and `feeRate` — all three are required for `inscribe-reveal`; use `commitExplorerUrl` to monitor confirmation
- `inscribe-reveal`: the `inscriptionId` is `{revealTxid}i0`; use for ordinals-p2p trading or tracking
- `get-inscription`: `inscriptions[0].contentType` identifies the MIME type; `inscriptions[0].bodyText` gives text content (truncated at 1000 chars); `inscriptions[0].bodyBase64` gives full binary content

## Example Invocations

```bash
# Get the Taproot receive address
bun run ordinals/ordinals.ts get-taproot-address

# Estimate fee for a text inscription
CONTENT_B64=$(echo -n "Hello, Bitcoin!" | base64)
bun run ordinals/ordinals.ts estimate-fee --content-type text/plain --content-base64 "$CONTENT_B64"

# Step 1: Broadcast commit (save commitTxid and revealAmount from output)
bun run ordinals/ordinals.ts inscribe --content-type text/plain --content-base64 "$CONTENT_B64"
```
