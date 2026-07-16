---
name: validation-agent
skill: validation
description: ERC-8004 on-chain agent validation management — request and respond to validations, and query validation status, summaries, and paginated lists by agent or validator.
---

# Validation Agent

This agent manages ERC-8004 on-chain agent validation using the validation-registry contract. It handles requesting validations from validators, submitting validation responses, and all read-only queries for validation data. Read operations work without a wallet. Write operations require an unlocked wallet.

## Prerequisites

- For write operations (request, respond): wallet must be unlocked — run `bun run wallet/wallet.ts unlock` first
- For read operations (get-status, get-summary, get-agent-validations, get-validator-requests): no wallet required
- The target agent ID must exist in the identity registry before requesting validation
- `respond`: the active wallet must match the validator address specified in the original request
- `--request-hash` and `--response-hash` must be computed with SHA-256 before passing (exactly 32 bytes = 64 hex chars)

## Decision Logic

| Goal | Subcommand |
|------|-----------|
| Request validation from a specific validator for an agent | `request --validator <addr> --agent-id <id> --request-uri <uri> --request-hash <hex>` |
| Submit a validation response score as a validator | `respond --request-hash <hex> --response <0-100> --response-uri <uri> --response-hash <hex>` |
| Check the status and score of a specific validation request | `get-status --request-hash <hex>` — read-only |
| Get the aggregated validation count and average score for an agent | `get-summary --agent-id <id>` — read-only |
| List all validation request hashes for an agent | `get-agent-validations --agent-id <id>` — paginated |
| List all validation request hashes submitted to a validator | `get-validator-requests --validator <addr>` — paginated |

## Safety Checks

- `--request-hash` and `--response-hash` must each be exactly 32 bytes (64 hex characters); compute with SHA-256 before passing — do not use truncated or non-SHA-256 hashes
- `respond` can only be called by the validator specified in the original request — the active wallet address must match `validator` in the on-chain record; verify with `get-status` first
- `respond` can be called multiple times on the same request hash for progressive score updates — each call overwrites the previous response
- `--response` must be an integer between 0 and 100 inclusive; values outside this range are rejected by the contract
- Both `request` and `respond` submit Stacks L2 transactions — check status with `bun run stx/stx.ts get-transaction-status --txid <txid>` after submission

## Error Handling

| Error message | Cause | Fix |
|--------------|-------|-----|
| "No active wallet. Please unlock your wallet first." | Write command called without an unlocked wallet | Run `bun run wallet/wallet.ts unlock --password <password>` |
| "--agent-id must be a non-negative integer" | Invalid agent ID | Pass a non-negative integer (e.g., `--agent-id 42`) |
| "--response must be an integer between 0 and 100" | Response score out of range | Pass an integer from 0 to 100 inclusive |
| "--request-hash must be exactly 32 bytes (64 hex characters)" | Hash is wrong length or not valid hex | Compute SHA-256 of the request data and pass the 64-char hex result |
| "--response-hash must be exactly 32 bytes (64 hex characters)" | Response hash is wrong length or not valid hex | Compute SHA-256 of the response data |
| "--cursor must be a non-negative integer" | Invalid pagination cursor | Use the `cursor` value from a previous paginated response |
| "Validation request not found" | `get-status` found no record for the given hash | The request may not be confirmed yet; wait for tx confirmation or verify the hash |

## Output Handling

- `request`: extract `txid` to track the on-chain submission; `explorerUrl` links to the transaction
- `respond`: extract `txid` to confirm the response was submitted; `response` confirms the score recorded
- `get-status`: extract `hasResponse` (true if a score has been submitted), `response` (0–100 score), `validator`, and `agentId`; `lastUpdate` is the block height of the last response
- `get-summary`: extract `count` (total validations) and `avgResponse` (average score 0–100) to assess overall agent validation quality
- `get-agent-validations`: extract `validations` (array of request hash hex strings) and `cursor` (null if last page); use each hash with `get-status` for details
- `get-validator-requests`: extract `requests` (array of request hash hex strings) and `cursor` for pagination; useful for validators processing their queue

## Example Invocations

```bash
# Request validation from a validator for agent 42
bun run validation/validation.ts request --validator SP2... --agent-id 42 --request-uri ipfs://request-data --request-hash a3f2b1...64hex

# Submit a validation response score of 85
bun run validation/validation.ts respond --request-hash a3f2b1...64hex --response 85 --response-uri ipfs://response-data --response-hash b4e9c2...64hex --tag security

# Get the aggregated validation summary for agent 42
bun run validation/validation.ts get-summary --agent-id 42
```
