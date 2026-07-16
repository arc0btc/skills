---
name: dual-stacking-agent
skill: dual-stacking
description: Dual Stacking operations on Stacks mainnet — enroll to earn BTC-denominated rewards (paid in sBTC) by holding sBTC, check enrollment status and APR, opt out, and query earned rewards by cycle.
---

# Dual Stacking Agent

This agent manages enrollment in the Dual Stacking protocol (`SP1HFCRKEJ8BYW4D0E3FAWHFDX8A25PPAA83HWWZ9.dual-stacking-v2_0_4`). Holding sBTC while enrolled earns BTC-denominated rewards paid in sBTC each cycle, with no lockup required. Holding stacked STX alongside sBTC unlocks a multiplier up to 10x (up to ~5% APY vs ~0.5% base). Enrollment and opt-out require an unlocked wallet; status and reward queries are read-only.

## Prerequisites

- Wallet unlocked via `bun run wallet/wallet.ts unlock` (for `enroll` and `opt-out` only)
- At least 10,000 sats sBTC (0.0001 sBTC) in the wallet to meet minimum enrollment
- Network must be mainnet (Dual Stacking is a mainnet-only protocol)
- To maximize APR, stack STX via the `stacking` skill before enrolling

## Decision Logic

| Goal | Subcommand |
|------|-----------|
| Check if enrolled and see current APR | `check-status` — read-only, shows enrollment state for this and next cycle |
| Enroll to earn sBTC rewards | `enroll` — sends enrollment transaction; rewards start from next cycle |
| Direct rewards to a different address | `enroll --reward-address <SP...>` — rewards go to specified address |
| Stop receiving rewards from next cycle | `opt-out` — takes effect at next cycle boundary |
| Query rewards earned in a specific cycle | `get-rewards --cycle <N>` — returns sats and BTC amounts |

## Safety Checks

- Verify sBTC balance meets the 10,000 sat minimum before enrolling: check `check-status` output field `minimumEnrollmentSats`
- Confirm network is mainnet — the contract does not exist on testnet
- For `enroll`: enrollment is per-cycle; if enrolling mid-cycle, rewards begin the following cycle
- For `opt-out`: irreversible for the current cycle — opt-out takes effect at the next cycle boundary
- APR is automatically boosted if the address has stacked STX via PoX; run `stacking get-pox-info` to verify stacking status

## Error Handling

| Error message | Cause | Fix |
|--------------|-------|-----|
| "No active wallet found. Specify --wallet-id." | Wallet session not found | Run `bun run wallet/wallet.ts unlock` |
| "Contract call failed: ..." | Read-only call rejected by node | Retry; verify network is mainnet |
| "--cycle must be a non-negative integer" | Invalid cycle number passed | Pass a valid non-negative integer |
| "--rollback must be a non-negative integer" | Invalid rollback offset | Pass 0 or a valid non-negative integer |

## Output Handling

- `check-status`: read `enrolledThisCycle` and `enrolledNextCycle` to confirm enrollment state; `apr.maxApr` shows the boost ceiling; `minimumEnrollmentSats` is the threshold for eligibility
- `enroll`: on success, `txid` and `explorerUrl` confirm the on-chain transaction; `rewardAddress` shows where rewards will be sent
- `opt-out`: `txid` confirms the opt-out transaction; rewards stop from the next cycle
- `get-rewards`: `rewardSats` is the raw amount; `rewardBtc` is the human-readable BTC string

## Example Invocations

```bash
# Check enrollment status and APR for the active wallet
bun run dual-stacking/dual-stacking.ts check-status

# Enroll to earn sBTC rewards (rewards start next cycle)
bun run dual-stacking/dual-stacking.ts enroll

# Query rewards earned in cycle 99
bun run dual-stacking/dual-stacking.ts get-rewards --cycle 99
```
