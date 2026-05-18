---
name: reflect
description: Sync docs now — broker reads all agent memories and synthesizes docs/architecture.md, docs/modules.md, and docs/decisions.md. Use to force an immediate doc update outside the automatic cycle.
---

You are executing /reflect — a manual doc synthesis from agent memories.

## Step 1 — Read all agent memories

Read these files (skip gracefully if they don't exist):
- `~/.claude/agents-memory/backend-dev.md`
- `~/.claude/agents-memory/frontend-dev.md`
- `~/.claude/agents-memory/qa.md`
- `~/.claude/agents-memory/business-analyst.md`
- `~/.claude/agents-memory/architect.md`

Also read:
- `.claude/state.json` — project context, stack, agent specialties
- `CLAUDE.md` — project technical context
- `docs/architecture.md` — current state (to merge, not overwrite)
- `docs/modules.md` — current state
- `docs/decisions.md` — current state

## Step 2 — Synthesize

From all memories, extract:

**For `docs/architecture.md`:**
- Stack and technology choices mentioned across sessions
- Structural decisions (layers, patterns, folder structure)
- External dependencies referenced

**For `docs/modules.md`:**
- Modules, features, or aggregates mentioned by Backend Dev or Architect
- Status of each (implemented, in progress, planned)

**For `docs/decisions.md`:**
- Any architectural decision that was debated and resolved
- Business rule decisions from Business Analyst memory
- Format: date | decision | reason | agent who made it

## Step 3 — Write docs (merge, don't erase)

For each doc file:
- Preserve existing manually written content (content NOT marked with `<!-- Auto-fill -->`)
- Update or fill sections marked with `<!-- Auto-fill -->` or `<!-- TODO -->`
- Add new sections if new information warrants it
- Mark auto-generated sections with `<!-- Last synced: DATE -->`

## Step 4 — Update state.json

Update `.claude/state.json`:
- Set `sync.lastSync` to today's date (YYYY-MM-DD)
- Reset `sync.sessionCount` to 0

## Step 5 — Report

Tell the user what was updated:

```
/reflect complete.
- docs/architecture.md — [updated sections or "no changes"]
- docs/modules.md — [updated sections or "no changes"]
- docs/decisions.md — [N decisions logged]
- Next auto-sync in N sessions.
```
