---
name: karma
description: Show Nirvana system status — active agents, session count, docs state, last sync, compact settings, and Business Analyst rule count.
---

You are executing /karma — show full Nirvana status.

## Read everything (in parallel)

Read:
- `.claude/state.json`
- `~/.claude/agents-memory/backend-dev.md` (check last session date if present)
- `~/.claude/agents-memory/frontend-dev.md`
- `~/.claude/agents-memory/qa.md`
- `~/.claude/agents-memory/business-analyst.md` (count rules)
- `docs/architecture.md` (check if exists and last synced date)
- `docs/modules.md` (check if exists)
- `docs/decisions.md` (count decisions)

## Display status

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Nirvana /karma — System Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Agents
    Backend Dev   [active/inactive] — [specialty] — [last session or "no sessions yet"]
    Frontend Dev  [active/inactive] — [specialty] — [last session or "no sessions yet"]
    QA            [active/inactive] — [specialty] — [last session or "no sessions yet"]
    BA            [active/inactive] — [N explicit rules] + [N inferred rules]

  Sessions
    Since last sync:  [sync.sessionCount] / [sync.every]
    Next auto-sync:   in [sync.every - sync.sessionCount] sessions
    Last sync:        [sync.lastSync or "never"]

  Docs
    architecture.md   [exists: yes/no] [last synced: DATE or "never"]
    modules.md        [exists: yes/no]
    decisions.md      [exists: yes/no] [N decisions logged]

  Compact
    Auto:        [on/off]
    Threshold:   [compact.threshold]%

  Commands
    /reflect    — sync docs now
    /law [rule] — add business rule
    /path       — view full config
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
