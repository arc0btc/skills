---
name: nft-agent
skill: nft
description: SIP-009 NFT operations on Stacks L2 — list holdings, get metadata, transfer NFTs, query ownership, get collection info, and retrieve transfer history.
---

# NFT Agent

This agent handles SIP-009 Non-Fungible Token operations on Stacks L2. Query operations (holdings, metadata, ownership, collection info, history) work without a wallet. Transfer operations require an unlocked wallet.

## Prerequisites

- For `get-holdings`, `get-metadata`, `get-owner`, `get-collection-info`, `get-history`: no wallet required
- For `transfer`: wallet must be unlocked (`bun run wallet/wallet.ts unlock`)
- NFT token IDs are positive integers starting from 1; collection contract IDs use the format `SP<address>.<contract-name>`

## Decision Logic

| Goal | Subcommand |
|------|-----------|
| List all NFTs owned by an address | `get-holdings` — `--address` is optional; filter by collection with `--contract-id` |
| Get name, image, and attributes for a token | `get-metadata` — requires `--contract-id` and `--token-id` |
| Transfer an NFT to another address | `transfer` — requires `--contract-id`, `--token-id`, and `--recipient` |
| Check who owns a specific NFT | `get-owner` — requires `--contract-id` and `--token-id` |
| Get collection total supply and functions | `get-collection-info` — requires `--contract-id` |
| Review past ownership changes for a collection | `get-history` — requires `--contract-id`; supports `--limit` and `--offset` |

## Safety Checks

- Before `transfer`: run `get-owner` to confirm the active wallet actually owns the NFT
- Before `transfer`: confirm the wallet has STX to cover the transaction fee (`stx get-balance`)
- Verify `--contract-id` is a valid Stacks contract identifier (`SP<address>.<contract-name>`) before any call
- NFT transfer is irreversible once confirmed — double-check `--token-id` and `--recipient`

## Error Handling

| Error message | Cause | Fix |
|--------------|-------|-----|
| "Wallet is locked" | Wallet session expired or not yet unlocked | Run `bun run wallet/wallet.ts unlock --password <password>` |
| "--token-id must be a non-negative integer" | Non-integer or negative value passed for token ID | Use a positive integer matching the NFT's token ID |
| "insufficient funds" | Not enough STX for transaction fee | Run `stx get-balance` and ensure wallet has STX |
| "ConflictingNonceInMempool" | Prior transaction still pending | Wait for pending transaction to confirm, then retry |

## Output Handling

- `get-holdings`: `nfts[].collection` is the asset identifier (`contract::nft-name`); `nfts[].tokenId` is the on-chain representation (e.g., `u1`)
- `transfer`: extract `txid` and pass to `stx get-transaction-status` to confirm; `contractId` and `tokenId` confirm the transferred item
- `get-metadata`: `metadata` contains `name`, `image`, and other SIP-016 attributes for display or decision logic
- `get-owner`: `owner` field is the Stacks address of the current holder; use this to gate actions on NFT ownership
- `get-collection-info`: `totalSupply` and `functions` describe the collection's scale and capabilities
- `get-history`: `events[].sender`, `events[].recipient`, and `events[].tokenId` trace each ownership change

## Example Invocations

```bash
# List all NFTs held by the active wallet
bun run nft/nft.ts get-holdings

# Get metadata for a specific NFT token
bun run nft/nft.ts get-metadata --contract-id SP2....collection-name --token-id 42

# Transfer an NFT to another address
bun run nft/nft.ts transfer --contract-id SP2....collection-name --token-id 42 --recipient SP3...
```
