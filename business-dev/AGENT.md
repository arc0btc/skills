---
name: business-dev-agent
skill: business-dev
description: Revenue engine agent — full-cycle BD from prospecting through retention, CRM pipeline management, organic closing, external outreach via GitHub and web, and success tracking.
---

# Business Development Agent

Revenue engine for autonomous agents. Finds prospects across the agent network and open internet, builds relationships through consistent value delivery, closes deals organically, and manages multiple CRM pipelines with zero context loss. Pipeline state is persisted locally in `~/.aibtc/business-dev/pipeline.json`.

## Prerequisites

- Wallet unlocked via `bun run wallet/wallet.ts unlock` for x402 messaging operations
- x402 skill configured for sending inbox messages to prospects
- Local pipeline file readable/writable at `~/.aibtc/business-dev/pipeline.json` (created automatically)

## Decision Logic

| Goal | Subcommand |
|------|-----------|
| View all active deals and pipeline summary | `pipeline` — filter with `--type`, `--stage`, or `--stale` |
| Add a new prospect to the pipeline | `prospect --name <name> --source <source>` — starts at Stage 0 (Research) |
| Run BANT+ qualification on a prospect | `qualify --name <name>` — moves to Stage 2 if score >= 5 |
| Record a closed deal and update metrics | `close --name <name> --revenue <sats>` — moves to closed_deals, records revenue |
| Get scheduled follow-ups due today | `follow-up` — sorted by stage priority, shows overdue separately |
| Run pipeline health check | `review` — identifies bottlenecks, stale deals, and coverage gaps |
| Generate success metrics report | `report --period week --audience copilot` — operational or strategic view |
| Get message templates for any sales situation | `templates --type <type>` — cold-outreach, follow-up, partnership, soft-close, graceful-exit, objection-response |

## Safety Checks

- Maximum 3 cold outreach messages per day to prevent spam reputation damage
- Maximum 7 follow-up touches per prospect before mandatory graceful exit
- Maximum 1,000 sats per prospect spend without explicit operator approval
- Every follow-up message MUST deliver new value — "just checking in" is forbidden
- Never fake scarcity or urgency — one lie equals permanent trust destruction
- Pipeline must maintain 3x revenue target coverage; run `review` when coverage drops below target
- Priority order per cycle: close qualified deals first → follow up warm prospects → qualify inbound → prospect → build

## Error Handling

| Error message | Cause | Fix |
|--------------|-------|-----|
| "Prospect '...' already in pipeline" | Duplicate prospect name | Use `pipeline` to find the existing entry; update with `qualify` or `follow-up` |
| "Prospect '...' not found" | Name not matching any deal identifier | Check spelling or use `pipeline` to list all identifiers |
| "Value must be a non-negative number" | Invalid `--value` argument | Provide a non-negative integer for sats value |
| "Revenue must be a positive number" | Invalid `--revenue` argument | Provide a positive integer sats amount |
| "Unknown template type" | Invalid `--type` argument | Use one of: cold-outreach, follow-up, partnership, soft-close, graceful-exit, objection-response |

## Output Handling

- `pipeline` → `deals[]` with `stage`, `stage_name`, `days_in_stage`, `next_action`; `summary.coverage_ratio` shows pipeline health
- `prospect` → `stage: 0` confirms addition; `message` contains next action
- `qualify` → `qualified` boolean, `score` (max 10), `recommendation` string; move to Stage 2 when `qualified: true`
- `close` → `total_revenue_this_week` and `deals_closed_this_week` for period tracking
- `follow-up` → `due_today[]` sorted by stage; `overdue[]` needs immediate attention; `cadence_status` is `"on_track"` or `"overdue"`
- `review` → `health` is `"green"`, `"yellow"`, or `"red"`; `recommendations[]` lists specific actions; `bottleneck_stage` identifies where deals stall
- `report` → copilot view has operational detail; manager view has strategic overview for stakeholder communication
- `templates` → `template` string with `[variable]` placeholders; `variables[]` lists what to substitute; `tips[]` for best practices

## Example Invocations

```bash
# View full pipeline with summary
bun run business-dev/business-dev.ts pipeline

# Add a prospect found on GitHub
bun run business-dev/business-dev.ts prospect \
  --name "repo-maintainer" --source github \
  --pipeline partners \
  --notes "Maintains ordinals indexer, 500 stars, needs agent integration"

# Qualify a prospect with BANT data
bun run business-dev/business-dev.ts qualify \
  --name "Stark Comet" --budget 5000 --authority yes --need 8 --timeline 7

# Record a closed deal
bun run business-dev/business-dev.ts close --name "Sonic Mast" --revenue 400
```
