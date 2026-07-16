---
name: jingswap-agent
skill: jingswap
description: Autonomous rules for Jingswap blind batch auction — phase-aware decision logic, deposit/settle workflows, safety checks.
---

# Jingswap Agent

This agent interacts with the Jingswap STX/sBTC blind batch auction on Stacks. Operations are phase-dependent — always check `cycle-state` first.

## Prerequisites

- No wallet required for: `cycle-state`, `depositors`, `user-deposit`, `settlement`, `cycles-history`, `user-activity`, `prices`
- Wallet must be unlocked for: `deposit-stx`, `deposit-sbtc`, `cancel-stx`, `cancel-sbtc`, `close-deposits`, `settle`, `settle-with-refresh`, `cancel-cycle`

## Decision Logic

| Goal | Check first | Action |
|------|------------|--------|
| See current auction state | — | `cycle-state` |
| Deposit STX or sBTC | `cycle-state` → phase must be 0 | `deposit-stx` or `deposit-sbtc` |
| Cancel a deposit | `cycle-state` → phase must be 0 | `cancel-stx` or `cancel-sbtc` |
| Close deposits | `cycle-state` → phase 0, blocksElapsed >= 150, both sides meet minimums | `close-deposits` |
| Settle the auction | `cycle-state` → phase must not be 0 | Try `settle`, if stale prices use `settle-with-refresh` |
| Settlement keeps failing | `cycle-state` → 530+ blocks since close | `cancel-cycle` |
| Check what happened | — | `user-activity --address <addr>` |
| Check prices | — | `prices` |

## Phase Flow

```
Deposit (phase 0) → close-deposits → Buffer (phase 1, ~1 min) → Settle (phase 2) → next cycle
                                                                  ↓ (if fails 530 blocks)
                                                                  cancel-cycle → next cycle
```

## Safety Checks

- **Before deposit**: verify phase is 0 (deposit). Deposits in other phases will fail on-chain.
- **Before close**: verify blocksElapsed >= 150 AND both totalStx >= 1,000,000 (1 STX) and totalSbtc >= 1,000 (sats).
- **Before settle**: always prefer `settle-with-refresh` over `settle` — stored Pyth prices go stale quickly.
- **Before cancel-cycle**: this is a safety valve, only use when settlement has failed for 530+ blocks.
- **Back-to-back transactions**: wait for the first tx to confirm before submitting a second (nonce issue).

## Error Handling

| Error message | Cause | Fix |
|--------------|-------|-----|
| "auction is not in deposit phase" | Tried deposit/cancel after close | Wait for next cycle |
| "auction is still in deposit phase" | Tried settle before close | Call `close-deposits` first |
| "ERR_CLOSE_TOO_EARLY" | Not enough blocks elapsed | Wait for 150 blocks |
| "ERR_NOTHING_TO_SETTLE" | One side has no deposits above minimum | Need deposits on both sides |
| "NotEnoughFunds" | Fee estimation too high | Known issue — try with lower fee or fund wallet |
| "ERR_CANCEL_TOO_EARLY" | Haven't waited 530 blocks since close | Wait longer |

## Output Handling

- `cycle-state`: use `phase` (0/1/2) and `blocksElapsed` to determine available actions
- `user-activity`: `distribute-*-depositor` events show swap proceeds + unswapped remainder rolled to next cycle (NOT refunds)
- `prices`: use `xykStxPerBtc` and `dlmmStxPerBtc` for human-readable prices, ignore raw `xykPrice`/`dlmmPrice`
- Write commands: extract `txid` and `explorerUrl` from response
