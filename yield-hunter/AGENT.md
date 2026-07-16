---
name: yield-hunter-agent
skill: yield-hunter
description: Autonomous sBTC yield hunting daemon — monitors wallet sBTC balance and automatically deposits to Zest Protocol when balance exceeds a configurable threshold. Mainnet-only.
---

# Yield Hunter Agent

This agent manages an autonomous yield hunting daemon that monitors the wallet's sBTC balance and automatically deposits to Zest Protocol's lending pool to earn yield. The daemon runs in the foreground and persists state to `~/.aibtc/yield-hunter-state.json`. This agent takes autonomous financial actions — confirm configuration before starting.

## Prerequisites

- Network must be set to mainnet: `NETWORK=mainnet` (Zest Protocol is mainnet-only)
- Wallet must be unlocked before starting: run `bun run wallet/wallet.ts unlock` first
- Wallet must have sBTC balance to deposit
- Wallet must have STX balance for transaction fees (Stacks gas is paid in STX, not sBTC)
- `status` and `configure` work without wallet unlock (read-only state access)

## Decision Logic

| Goal | Subcommand |
|------|-----------|
| Start automated sBTC yield generation | `start` — runs in foreground, deposits when balance exceeds threshold |
| Stop the running daemon | `stop` — sends SIGTERM; Zest positions remain untouched |
| Check daemon status and recent activity | `status` — works even when daemon is not running |
| Update threshold, reserve, or interval | `configure --threshold <sats> --reserve <sats> --interval <seconds>` |

## Safety Checks

- Confirm deposit threshold before starting — default is 10,000 sats (0.0001 sBTC); adjust with `--threshold` if needed
- Set `--reserve` to keep a liquid sBTC buffer if you may need fast access to funds (default is 0 — deposits everything above threshold)
- The daemon will submit real on-chain transactions when balance conditions are met — this is irreversible once submitted
- Check that Zest Protocol APY is acceptable before starting — shown in daemon output and `status`
- Verify STX balance is sufficient for fees before starting; each deposit costs ~0.05–0.1 STX in gas
- Run `status` first to check if a daemon is already running before calling `start`
- Stop the daemon before manually withdrawing from Zest to avoid conflicting transactions

## Error Handling

| Error message | Cause | Fix |
|--------------|-------|-----|
| "Yield hunting only available on mainnet (Zest Protocol is mainnet-only)" | NETWORK is not mainnet | Run with `NETWORK=mainnet bun run yield-hunter/yield-hunter.ts ...` |
| "Wallet not unlocked. Use wallet/wallet.ts unlock first to enable transactions." | Wallet not unlocked before start | Run `bun run wallet/wallet.ts unlock --password <password>` then retry |
| "Wallet is not unlocked. Use wallet/wallet.ts unlock first." | Wallet lock expired during a check cycle | Unlock wallet; daemon will retry on next cycle |
| "Yield hunter is already running (PID: <pid>). Use stop to stop it first." | Duplicate start attempt | Run `stop` to halt the existing daemon first |
| "No yield hunter PID file found. The daemon may not be running." | Stop called with no running daemon | Nothing to stop; check `status` to confirm |
| "--interval must be at least 10 seconds" | Interval below minimum | Use `--interval 10` or higher |

## Output Handling

- `start`: extract `pid` if you need to monitor the process; `config.checkIntervalSeconds` confirms the polling rate
- `stop`: extract `stats.depositsExecuted` and `stats.totalDeposited` for a session summary
- `status`: check `running` to confirm daemon state; `stats.lastCheck` shows most recent activity; `currentPosition.walletSbtcFormatted` and `currentPosition.zestSuppliedFormatted` show current balances; `stats.currentApy` shows live Zest APY
- `configure`: extract `config` from the response to confirm new settings took effect; `note` field indicates whether daemon will pick up changes immediately or on next start

## Example Invocations

```bash
# Start the yield hunter daemon (deposit when balance exceeds 10,000 sat-sBTC, keep 0 in reserve)
NETWORK=mainnet bun run yield-hunter/yield-hunter.ts start --threshold 10000 --reserve 0 --interval 600

# Check daemon status and recent activity
NETWORK=mainnet bun run yield-hunter/yield-hunter.ts status

# Update the deposit threshold without restarting
NETWORK=mainnet bun run yield-hunter/yield-hunter.ts configure --threshold 50000
```
