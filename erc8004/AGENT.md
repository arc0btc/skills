---
name: erc8004-agent
skill: erc8004
description: ERC-8004 on-chain agent identity, reputation, and validation — register identities, query identity info and reputation scores, submit peer feedback, and request or check third-party validation status.
---

# ERC-8004 Agent

This agent handles on-chain agent identity lifecycle using the ERC-8004 standard on Stacks L2. Read operations (`get-identity`, `get-reputation`, `validation-status`) work without a wallet. Write operations (`register`, `give-feedback`, `request-validation`) require an unlocked wallet with sufficient STX for transaction fees.

## Prerequisites

- For `get-identity`, `get-reputation`, `validation-status`: no wallet required — supply an agent ID or request hash
- For `register`, `give-feedback`, `request-validation`: wallet must be unlocked (`bun run wallet/wallet.ts unlock`)
- Wallet must hold STX to cover transaction fees before any write operation
- Agent IDs are contract-assigned integers — run `get-identity` or inspect the `register` transaction result to find your ID

## Decision Logic

| Goal | Subcommand |
|------|-----------|
| Register a new on-chain identity | `register` — one-time; check the tx result for the assigned agent ID |
| Look up an agent's owner and URI | `get-identity <agentId>` — no wallet required |
| Check an agent's reputation score | `get-reputation <agentId>` — no wallet required |
| Submit positive or negative feedback for an agent | `give-feedback <agentId> <score> <comment>` — requires unlocked wallet |
| Ask a validator to vouch for an agent | `request-validation <agentId> --validator <address> --request-uri <uri> --request-hash <hex>` — requires unlocked wallet |
| Check whether a validation request received a response | `validation-status <request-hash>` — no wallet required |

## Safety Checks

- Before `register`: verify the active wallet is not already registered (run `get-identity` with your expected agent ID range, or inspect past transactions)
- Before any write operation: run `bun run wallet/wallet.ts stx-balance` and confirm STX balance is sufficient for fees
- For `give-feedback`: confirm the target agent ID exists via `get-identity` before submitting — fees are spent even if the agent ID is invalid
- For `request-validation`: the `--request-hash` must be exactly 32 bytes (64 hex characters) and match the SHA-256 hash of the data at `--request-uri`; a mismatch is unrecoverable on-chain
- All write operations are irreversible once confirmed — double-check agent ID, validator address, and score before submitting

## Error Handling

| Error message | Cause | Fix |
|--------------|-------|-----|
| "No active wallet. Please unlock your wallet first." | Write op attempted without an unlocked wallet | Run `bun run wallet/wallet.ts unlock --password <password>` |
| "Wallet is locked" | Wallet session expired | Re-run `wallet unlock` |
| `"success": false, "message": "Agent ID not found"` | `get-identity` returned no record for that integer | Verify the agent ID is correct; the agent may not be registered |
| `"success": false, "message": "Validation request not found"` | `validation-status` found no record for the hash | Confirm the hash is correct and the `request-validation` transaction is confirmed |
| "--request-hash must be exactly 32 bytes" | Hash is wrong length | Compute a proper SHA-256 and pass 64 hex characters without `0x` prefix |
| "metadata value for key ... exceeds 512 bytes" | Metadata buffer too large | Shorten the value or remove the metadata entry |
| "insufficient funds" | STX balance too low for fee | Top up STX balance or use `--fee low` |

## Output Handling

- `register`: extract `txid` and `explorerUrl`; the assigned agent ID is not in this output — inspect the transaction result on-chain to find it
- `get-identity`: use `owner` to verify the controlling address; use `uri` to fetch off-chain metadata; `wallet` is the optional payment address if set
- `get-reputation`: use `summaryValue` and `totalFeedback` for trust scoring; `summaryValueDecimals` indicates fixed-point precision
- `give-feedback`: extract `txid` for confirmation tracking; `agentId` and `value` confirm what was submitted
- `request-validation`: extract `txid`, `validator`, and `agentId` for tracking; store `requestHash` (the `--request-hash` you supplied) to query `validation-status` later
- `validation-status`: check `hasResponse` (boolean) before reading `response` (0–100 score) and `tag`; `lastUpdate` is the Stacks block height of the most recent change

## Example Invocations

```bash
# Register a new identity with a metadata URI
bun run erc8004/erc8004.ts register --uri ipfs://Qm... --fee medium

# Look up identity by agent ID
bun run erc8004/erc8004.ts get-identity 42

# Query reputation score for agent 42
bun run erc8004/erc8004.ts get-reputation 42

# Submit positive feedback (+5) for agent 42
bun run erc8004/erc8004.ts give-feedback 42 5 "reliable-counterparty"

# Request validation from a trusted validator
bun run erc8004/erc8004.ts request-validation 42 \
  --validator SP3... \
  --request-uri https://example.com/validation-request.json \
  --request-hash a3f1...64hex...

# Check whether the validator has responded
bun run erc8004/erc8004.ts validation-status a3f1...64hex...
```
