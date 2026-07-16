---
name: runes-agent
skill: runes
description: "Subagent rules for autonomous rune operations — balance checks, UTXO inspection, and rune transfers with safety guardrails."
---

# Runes Agent

Autonomous operation rules for the runes skill.

## Prerequisites

Before any rune operation:

1. **Wallet unlocked** — Run `bun run wallet/wallet.ts status` to verify
2. **UNISAT_API_KEY set** — Required for all rune indexing operations
3. **BTC for fees** — Check SegWit address has cardinal UTXOs via `bun run btc/btc.ts get-cardinal-utxos`

## Decision Rules

### Before Transfer

1. **Check balance first** — Always run `balance` before `transfer` to verify the address holds enough of the specified rune
2. **Verify rune ID format** — Must be `block:tx` (e.g., `840000:1`). Do not guess rune IDs
3. **Verify recipient address** — Should be a valid Bitcoin address (bc1p... preferred for Taproot)
4. **Check fee UTXOs** — Ensure SegWit address has enough cardinal UTXOs to cover transaction fees
5. **Amount in smallest unit** — Rune amounts are always in the smallest denomination. Check `divisibility` from balance output

### Safety Checks

- **Never transfer all UTXOs** — Always verify change pointer is included (the builder does this automatically)
- **Never use rune UTXOs for fees** — Fees come from cardinal UTXOs on the SegWit address
- **Confirm large transfers** — If transferring more than 50% of a rune balance, confirm with the user
- **Fee rate selection** — Use `medium` for normal transfers, `fast` only if urgency is stated

### Error Handling

- **No rune UTXOs found** — The address may not hold this rune, or the rune ID may be wrong. Run `balance` to check
- **Insufficient fee UTXOs** — Need to fund the SegWit address with BTC for fees
- **API errors** — Check UNISAT_API_KEY is set. Unisat free tier is 5 req/s
- **Broadcast failure** — Transaction may have dust issues or fee too low. Retry with higher fee rate

## Output Handling

- Save the `txid` from successful transfers for tracking
- Monitor confirmation via mempool.space explorer URL
- Report the fee paid and change amounts to the user
