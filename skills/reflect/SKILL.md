---
name: reflect
description: Sync docs now — broker reads docs/knowledge (via graphify) and synthesizes docs/architecture.md, docs/modules.md, and docs/decisions.md. Use to force an immediate doc update outside the automatic cycle.
---

You are executing /reflect — a manual doc synthesis from the shared graphify-indexed knowledge
base. There are no more per-agent memory files to read — `docs/knowledge/` is the single source,
and graphify is the query layer over it.

## Step 1 — Pull from graphify

If `graphify-out/graph.json` exists, run `/graphify docs/knowledge --update` first (refresh the
index), then `/graphify query "architecture decisions and structural patterns"` and
`/graphify query "modules and their status"` to pull structured context.

If graphify is unavailable, fall back to reading directly:
- `docs/knowledge/errors-aprendidos.md`
- `docs/knowledge/patterns.md`
- `docs/knowledge/business-rules.md`
- `docs/decisions.md`
- `docs/tasks/*.md` and `docs/sprints/*.md` (for module/feature status)

Also read:
- `.claude/state.json` — project context, stack, agent config
- `CLAUDE.md` — the `NIRVANA:START`/`NIRVANA:END` block for current protocol
- `docs/architecture.md` — current state (to merge, not overwrite)
- `docs/modules.md` — current state
- `docs/decisions.md` — current state

## Step 2 — Synthesize

From the pulled context, extract:

**For `docs/architecture.md`:**
- Stack and technology choices
- Structural decisions (layers, patterns, folder structure) from `docs/knowledge/patterns.md`
- External dependencies referenced

**For `docs/modules.md`:**
- Modules/features referenced across `docs/tasks/*.md`
- Status of each (planned, in-progress, done) — pull from each task file's frontmatter `status`

**For `docs/decisions.md`:**
- Any architectural decision debated and resolved (Architect via Writer)
- Business rule decisions from `docs/knowledge/business-rules.md`
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
- Set `graphify.lastIndexed` to today's date if `/graphify docs/knowledge --update` ran

## Step 5 — Report

Tell the user what was updated:

```
/reflect complete.
- docs/architecture.md — [updated sections or "no changes"]
- docs/modules.md — [updated sections or "no changes"]
- docs/decisions.md — [N decisions logged]
- graphify — [reindexed / unavailable, skipped]
- Next auto-sync in N sessions.
```
