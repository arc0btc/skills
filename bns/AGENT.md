---
name: bns-agent
skill: bns
description: Bitcoin Name System (BNS) operations — lookup and reverse-lookup .btc names, check availability, get pricing, list owned domains, and register new names via fast-claim or two-step preorder/register.
---

# BNS Agent

This agent handles Bitcoin Name System (BNS) operations for .btc domain names using BNS V2 (recommended) with fallback to BNS V1. Read operations (lookup, reverse-lookup, availability, pricing, listing) work without a wallet. Write operations (claim-fast, preorder, register) require an unlocked wallet.

## Prerequisites

- For `lookup`, `reverse-lookup`, `get-info`, `check-availability`, `get-price`, `list-user-domains`: no wallet required
- For `claim-fast`, `preorder`, `register`: wallet must be unlocked (`bun run wallet/wallet.ts unlock`)
- For `claim-fast` and `preorder`: the wallet must have enough STX to cover the name price plus transaction fee
- For `register`: the `preorder` transaction must be confirmed (~10 minutes) before calling `register`

## Decision Logic

| Goal | Subcommand |
|------|-----------|
| Resolve a .btc name to an address | `lookup` — requires `--name` |
| Find names owned by an address | `reverse-lookup` — `--address` optional, uses active wallet |
| Get owner, expiry, and status for a name | `get-info` — requires `--name` |
| Check if a name is available | `check-availability` — requires `--name` |
| Get registration cost in STX | `get-price` — requires `--name` |
| List all .btc domains you own | `list-user-domains` — `--address` optional, uses active wallet |
| Register a name in one transaction (preferred) | `claim-fast` — requires `--name`; checks availability automatically |
| Preorder a name (step 1 of 2-step flow) | `preorder` — requires `--name`; save the returned `salt` |
| Complete registration after preorder (step 2) | `register` — requires `--name` and `--salt` from the preorder output |

## Safety Checks

- Before `claim-fast` or `preorder`: run `check-availability` to confirm the name is free (the skill also checks this internally)
- Before `claim-fast` or `preorder`: run `get-price` and `stx get-balance` to confirm enough STX for price + fee
- For two-step registration: save the `salt` from the `preorder` output immediately — it cannot be recovered
- For `register`: wait until the `preorder` txid shows `"success"` in `stx get-transaction-status` before calling `register`
- Prefer `claim-fast` for .btc names — it is atomic and avoids the preorder/register waiting period

## Error Handling

| Error message | Cause | Fix |
|--------------|-------|-----|
| "Wallet is locked" | Wallet session expired or not yet unlocked | Run `bun run wallet/wallet.ts unlock --password <password>` |
| "Name \"...\" is not available for registration" | Name is already taken | Try a different name or check with `check-availability` |
| "No Stacks address provided and wallet is not unlocked." | `reverse-lookup` or `list-user-domains` called without `--address` and no wallet | Provide `--address` or unlock the wallet first |
| "insufficient funds" | STX balance too low for name price plus fee | Run `stx get-balance` and fund the wallet |
| "ConflictingNonceInMempool" | Prior transaction still pending | Wait for pending transaction to confirm, then retry |

## Output Handling

- `lookup`: `address` is the Stacks principal that owns the name; `found: false` means the name is unregistered
- `check-availability`: `available: true` means the name can be registered
- `get-price`: read `price.microStx` for the exact cost; compare against `stx get-balance` output
- `claim-fast`: extract `txid` and pass to `stx get-transaction-status` to confirm; `name` field is the full `.btc` name registered
- `preorder`: **save `salt` immediately** — required for the `register` step; `txid` must confirm before proceeding
- `register`: `txid` confirms the registration was submitted; `message` describes the expected outcome

## Example Invocations

```bash
# Resolve a .btc name to a Stacks address
bun run bns/bns.ts lookup --name alice.btc

# Check if a name is available and its price
bun run bns/bns.ts check-availability --name myagent.btc

# Register a .btc name with a single fast-claim transaction
bun run bns/bns.ts claim-fast --name myagent.btc
```
