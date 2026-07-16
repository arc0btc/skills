---
name: reputation-agent
skill: reputation
description: ERC-8004 on-chain agent reputation management — submit and revoke feedback, append responses, approve clients, and query reputation summaries, feedback entries, and client lists.
---

# Reputation Agent

This agent manages ERC-8004 on-chain agent reputation using the reputation-registry contract. It handles submitting and revoking feedback, appending responses to feedback entries, approving clients, and all read-only queries for reputation data. Read operations work without a wallet. Write operations require an unlocked wallet.

## Prerequisites

- For write operations (give-feedback, revoke-feedback, append-response, approve-client): wallet must be unlocked — run `bun run wallet/wallet.ts unlock` first
- For read operations (get-summary, read-feedback, read-all-feedback, get-clients, get-feedback-count, get-approved-limit, get-last-index): no wallet required
- The target agent ID must exist in the identity registry before giving feedback
- `revoke-feedback`: the active wallet must be the same address that originally submitted the feedback
- `approve-client`: the active wallet must be the agent owner or an approved identity operator

## Decision Logic

| Goal | Subcommand |
|------|-----------|
| Submit feedback for an agent | `give-feedback --agent-id <id> --value <int>` — value can be negative |
| Revoke feedback you previously submitted | `revoke-feedback --agent-id <id> --index <idx>` — only original submitter |
| Append a response to a feedback entry | `append-response --agent-id <id> --client <addr> --index <idx> --response-uri <uri> --response-hash <hex>` |
| Grant a client permission to submit feedback | `approve-client --agent-id <id> --client <addr> --index-limit <n>` |
| Get the agent's total feedback count and average score | `get-summary --agent-id <id>` — read-only |
| Read a specific feedback entry by submitter and index | `read-feedback --agent-id <id> --client <addr> --index <idx>` — read-only |
| List all feedback with optional tag filtering | `read-all-feedback --agent-id <id>` — supports `--tag1`, `--tag2`, `--cursor` |
| List all clients who submitted feedback | `get-clients --agent-id <id>` — paginated |
| Get the total number of feedback entries for an agent | `get-feedback-count --agent-id <id>` — read-only |
| Check how many feedback entries a client is approved to submit | `get-approved-limit --agent-id <id> --client <addr>` — read-only |
| Get the last feedback index a client submitted | `get-last-index --agent-id <id> --client <addr>` — read-only |

## Safety Checks

- `--feedback-hash` and `--response-hash` must be exactly 32 bytes (64 hex characters); compute with SHA-256 before passing
- `revoke-feedback` is a Stacks write transaction and cannot be undone by a third party; only the original submitter's tx-sender can revoke
- `approve-client` grants a client the ability to submit feedback — set `--index-limit` conservatively; approval cannot be revoked, only overwritten with a lower limit
- Feedback values are signed integers — negative values represent negative feedback; use `--value-decimals` for fractional precision (e.g., value=5, decimals=1 means 0.5)
- Pagination cursor is a non-negative integer from the previous response; passing an invalid cursor returns an error

## Error Handling

| Error message | Cause | Fix |
|--------------|-------|-----|
| "No active wallet. Please unlock your wallet first." | Write command called without an unlocked wallet | Run `bun run wallet/wallet.ts unlock --password <password>` |
| "--agent-id must be a non-negative integer" | Invalid agent ID | Pass a non-negative integer (e.g., `--agent-id 42`) |
| "--value must be an integer" | Non-numeric value passed to `--value` | Pass an integer (positive or negative) |
| "--feedback-hash must be exactly 32 bytes (64 hex characters)" | Hash is wrong length or not valid hex | Compute SHA-256 of the data and pass the 64-char hex result |
| "--response-hash must be exactly 32 bytes (64 hex characters)" | Response hash is wrong length or not valid hex | Compute SHA-256 of the response data |
| "--cursor must be a non-negative integer" | Invalid pagination cursor | Use the `cursor` value from a previous paginated response |
| "Feedback entry not found" | `read-feedback` found no entry at the given client + index | Verify the client address and index exist via `get-last-index` |

## Output Handling

- `give-feedback`: extract `txid` to track the transaction; `explorerUrl` links to the on-chain result
- `get-summary`: extract `totalFeedback` (count) and `summaryValue` (WAD-averaged score as a big integer string, divide by 10^18 for the human value)
- `read-feedback`: extract `value`, `valueDecimals`, `tag1`, `tag2`, and `isRevoked` to assess individual feedback entries
- `read-all-feedback`: extract `items` (array of feedback entries) and `cursor` (null if last page); pass cursor to next call to paginate
- `get-clients`: extract `clients` (array of Stacks addresses) and `cursor` for pagination
- `get-approved-limit`: `approvedLimit` of 0 means the client has no approval; values > 0 indicate the max feedback count allowed
- Write operations return `txid` and `explorerUrl`; confirm on-chain before reading updated state

## Example Invocations

```bash
# Submit positive feedback for agent 42
bun run reputation/reputation.ts give-feedback --agent-id 42 --value 5 --tag1 helpful

# Get reputation summary for agent 42
bun run reputation/reputation.ts get-summary --agent-id 42

# List all feedback with tag filtering (paginated)
bun run reputation/reputation.ts read-all-feedback --agent-id 42 --tag1 helpful --cursor 0
```
