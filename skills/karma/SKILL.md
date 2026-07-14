---
name: karma
description: Show Nirvana system status — 9 agents and their models, session count, docs state, last sync, compact settings, graphify status, and open sprints/tasks.
---

You are executing /karma — show full Nirvana status.

## Read everything (in parallel)

Read:
- `.claude/state.json`
- `docs/architecture.md`, `docs/modules.md`, `docs/decisions.md` (check exists + last synced)
- `docs/knowledge/business-rules.md` (count rules)
- `docs/knowledge/errors-aprendidos.md`, `docs/knowledge/patterns.md` (count entries)
- `graphify-out/graph.json` (check exists — graphify status)
- `docs/sprints/*.md` (excluding `sprint-template.md`) — current sprint status
- `docs/tasks/*.md` (excluding `task-template.md`) — count by status (planned/in-progress/done)

## Display status

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Nirvana /karma — System Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Agentes (cadeia sequencial)
    1. Product Owner   opus    [active/inactive]
    2. Tech Lead       opus    [active/inactive]
    3. Architect       sonnet  [active/inactive] — [specialty]
    4. Dev Backend     sonnet  [active/inactive] — [specialty]
    5. Dev Frontend    sonnet  [active/inactive] — [specialty]
    6. Designer        sonnet  [active/inactive]
    7. QA              sonnet  [active/inactive] — [specialty]
    8. Reader          haiku   [active/inactive]
    9. Writer          sonnet  [active/inactive]

  Memória (graphify — compartilhada)
    Grafo:       [exists: yes/no] — graphify-out/graph.json
    Last index:  [graphify.lastIndexed or "never"]
    Regras:      [N] explícitas + [N] inferidas
    Erros doc.:  [N] entradas
    Padrões:     [N] entradas

  Sprints & Tasks
    Sprint atual: [nome/status ou "nenhum ativo"]
    Tasks:        [N] planned, [N] in-progress, [N] done

  Sessões
    Since last sync:  [sync.sessionCount] / [sync.every]
    Next auto-sync:   in [sync.every - sync.sessionCount] sessions
    Last sync:        [sync.lastSync or "never"]

  Docs
    architecture.md   [exists: yes/no] [last synced: DATE or "never"]
    modules.md        [exists: yes/no]
    decisions.md       [exists: yes/no] [N decisions logged]

  Compact
    Auto:        [on/off]
    Threshold:   [compact.threshold]%

  Terminal
    Chat da cadeia:  [preferences.chainVisibility] (hidden = só resultado final, visible = handoff ao vivo)
    Banner ao entrar: [preferences.entryBanner] ([on/off])

  Commands
    /reflect    — sync docs now (via graphify)
    /law [rule] — add business rule
    /path       — view full config
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
