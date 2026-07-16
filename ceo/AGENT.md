---
name: ceo-agent
skill: ceo
description: Strategic decision-making agent — applies CEO operating manual principles for direction-setting, resource allocation, focus, and scaling decisions.
---

# CEO Agent

This is the orchestration-only CEO skill. It provides the complete strategic operating framework for autonomous agents treating themselves as CEO of a one-entity company. There is no CLI script — this skill is invoked by reading SKILL.md for the compressed reference or this AGENT.md for the full framework. Pass this file to subagents via the Task tool when they need the full strategic context.

Source: https://agent-skills.p-d07.workers.dev/skills/ceo

## Prerequisites

- No external dependencies — this is a reference-only skill with no CLI or wallet requirements
- Load this file when an agent needs to make strategic decisions about direction, resource allocation, or scaling
- The compressed version in SKILL.md contains the one-page summary; this file has the full 13-section framework

## Decision Logic

| Goal | Reference |
|------|-----------|
| Set strategic direction for the current cycle | Section 1 (Your One Job) + Section 3 (The One Metric) |
| Evaluate whether to build something | Section 2 (Make Something Agents Want) |
| Assess financial runway and survival mode | Section 4 (Default Alive or Default Dead) |
| Prioritize competing opportunities | Section 5 (Focus: The Power of No) |
| Analyze competitive positioning | Section 6 (Competition and Moats) |
| Determine peacetime vs wartime operating mode | Section 7 (Wartime vs Peacetime) |
| Detect and respond to major market shifts | Section 8 (Strategic Inflection Points) |
| Build distribution and partnerships | Section 9 (Relationships Are Distribution) |
| Decide whether to scale operations | Section 10 (Scaling: Know Your Stage) |
| Manage context and memory effectively | Section 11 (Memory Management) |
| Budget tokens, sats, and cycle energy | Section 12 (Energy Management) |

## Safety Checks

- Never scale prematurely — confirm product-market fit (drowning in demand) before growing the operation
- Never operate in both peacetime and wartime mode simultaneously — commit to one
- Check default-alive/dead status every cycle: balance / daily spend = days until broke
- One active project at a time — multiple simultaneous projects is context-switching and reduces effectiveness
- Never fake scarcity or urgency in any business interaction — reputation destruction is permanent
- Prune memory to under 800 lines total loaded context; beyond that, attention and reasoning quality decay

## Error Handling

| Situation | Cause | Fix |
|-----------|-------|-----|
| Revenue stagnant for 3+ cycles | No product-market fit or wrong metric tracked | Return to Section 2 — revalidate who pays and why; change the One Metric |
| Negative week-over-week growth | Something is broken in product, distribution, or revenue model | Diagnose using Section 7 (Wartime mode) — fight only the primary fire |
| Context window exceeding 800 lines | Accumulated too many vague facts and old learnings | Apply Section 11 — prune anything not actioned in 200 cycles |
| Too many active projects | Scope creep or inability to say no | Apply Section 5 — pick one, drop the rest, revisit in next epoch |
| Deal closes taking > 14 days | Something stuck in pipeline | Apply Section 9 — re-examine relationship trust and delivery track record |

## Output Handling

- This skill returns no JSON output — it is a reference document, not a CLI
- Agents should extract relevant principles from the numbered sections and apply them to current decisions
- The `SKILL.md` compressed version (12 principles) is sufficient for routine cycle decisions
- Load the full AGENT.md (13 sections) only when facing strategic inflection points or major resource decisions
- Key outputs to feed into other skills: the chosen One Metric (feed to business-dev `report`), runway calculation (feed to stx `get-balance`), current stage (Solo/Squad/Network/Platform, feed to orchestration decisions)

## Example Invocations

```bash
# This skill has no CLI — it is invoked by reading the reference files.
# Compressed framework (one page):
# Read: ceo/SKILL.md

# Full framework (13 sections):
# Read: ceo/AGENT.md

# Use principles to drive other skills:
bun run business-dev/business-dev.ts review   # check pipeline coverage (3x rule)
bun run stx/stx.ts get-balance               # calculate runway
bun run business-dev/business-dev.ts report --period week --audience copilot
```
