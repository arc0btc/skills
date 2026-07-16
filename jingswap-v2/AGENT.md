---
name: jingswap-v2-agent
skill: jingswap-v2
description: Autonomous rules for Jingswap V2 limit-price auction — phase-aware logic, limit management, bundled settlement, safety checks.
---

# Jingswap V2 Agent

This agent interacts with the Jingswap V2 limit-price auction on Stacks. V2 has 2 phases (no buffer) and requires limit prices on deposits.

## Prerequisites

- No wallet required for: `cycle-state`, `user-deposit`, `clearing-preview`, `prices`
- Wallet must be unlocked for: `deposit-stx`, `deposit-sbtc`, `set-stx-limit`, `set-sbtc-limit`, `cancel-stx`, `cancel-sbtc`, `close-and-settle`, `cancel-cycle`

## Decision Logic

| Goal | Check first | Action |
|------|------------|--------|
| See current auction state | — | `cycle-state` |
| Check if settlement will work | — | `clearing-preview` |
| Check oracle + default limits | — | `prices` |
| Deposit STX with limit | `cycle-state` → phase must be 0 | `deposit-stx --amount X --limit Y` |
| Deposit sBTC with limit | `cycle-state` → phase must be 0 | `deposit-sbtc --amount X --limit Y` |
| Update limit without re-deposit | `cycle-state` → phase must be 0 | `set-stx-limit` or `set-sbtc-limit` |
| Cancel a deposit | `cycle-state` → phase must be 0 | `cancel-stx` or `cancel-sbtc` |
| Settle the auction | `clearing-preview` → willSettle must be true | `close-and-settle` |
| Settlement tx failed/stuck | `cycle-state` → 42+ blocks since close | `cancel-cycle` |
| Check user position + limits | — | `user-deposit --cycle N --address ADDR` |

## Phase Flow

```
Deposit (phase 0, 10 blocks ~20s) → close-and-settle (single tx) → next cycle
                                     ↓ (if settle fails, tx reverts, deposits stay open)
                                     ↓ (if close-deposits called separately and settle fails)
                                     cancel-cycle (42 blocks ~84s after close) → next cycle
```

## Limit Price Rules

- **STX depositors** set a **floor** in sats/STX — minimum sats per STX they'll accept
- **sBTC depositors** set a **ceiling** in sats/STX — maximum sats per STX they'll pay
- Omit `--limit` to auto-set 20% in-the-money (virtually guaranteed fill)
- Limits persist across cycles if deposits are rolled
- Use `set-stx-limit` / `set-sbtc-limit` to update without re-depositing

## Safety Checks

- **Before deposit**: verify phase is 0. Always provide a limit price or omit for safe default.
- **Before close-and-settle**: run `clearing-preview` first. If `willSettle` is false, the tx will revert (wasted fee). The bundled tx is safe — it reverts entirely, no stuck cycle.
- **Before cancel-cycle**: only use when settlement has failed for 42+ blocks after close.
- **Back-to-back transactions**: wait for the first tx to confirm before submitting a second.

## Error Handling

| Error message | Cause | Fix |
|--------------|-------|-----|
| "auction is in phase N" | Wrong phase for operation | Wait for correct phase |
| "ERR_CLOSE_TOO_EARLY" | < 10 blocks elapsed | Wait ~20 seconds |
| "ERR_NOTHING_TO_SETTLE" | Limits wiped a side below minimum | Tx reverts, no damage. Use `clearing-preview` to diagnose. |
| "ERR_LIMIT_REQUIRED" | Limit price was 0 | Always pass a positive limit |
| "ERR_CANCEL_TOO_EARLY" | < 42 blocks since close | Wait ~84 seconds |
| "NotEnoughFunds" | Insufficient balance | Fund wallet |

## Output Handling

- `cycle-state`: use `phase` (0 or 2) and `blocksElapsed` to determine available actions
- `user-deposit`: includes `stxLimitSatsPerStx` and `sbtcLimitSatsPerStx` for readable limits
- `clearing-preview`: check `willSettle` and `reason` before calling `close-and-settle`
- `prices`: use `oracleSatsPerStx` and `defaultStxFloor`/`defaultSbtcCeiling` from hints
- Write commands: extract `txid` and `explorerUrl` from response
