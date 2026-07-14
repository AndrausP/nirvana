---
name: path
description: Show current Nirvana configuration from .claude/state.json in a readable format. Hints at what each setting does.
---

You are executing /path — show the current Nirvana config.

## Read config

Read `.claude/state.json`.

If not found: tell user "Nirvana not configured for this project. Run /light to set up."

## Display formatted

Show the config in a readable table format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Nirvana Config — .claude/state.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Project
    Type:   [project.type]
    Stack:  [project.stack joined with " + "]
    Docs:   [project.docsPath]

  Agentes (modelo — cada um com ação única, ver templates/agents/)
    1. Product Owner:  opus
    2. Tech Lead:      opus
    3. Architect:      sonnet — [agents.architect.specialty]
    4. Dev Backend:    sonnet — [agents.devBackend.specialty]
    5. Dev Frontend:   sonnet — [agents.devFrontend.specialty]
    6. Designer:       sonnet
    7. QA:             sonnet — [agents.qa.specialty]
    8. Reader:         haiku (read-only)
    9. Writer:         sonnet (única escrita — indexa em graphify)

  Memória
    graphify.enabled:   [true/false]
    graphify.source:    [graphify.source]
    graphify.lastIndexed: [graphify.lastIndexed or "never — run /reflect or let Writer index"]

  Sync
    Every:        [sync.every] sessions
    Current:      [sync.sessionCount] sessions since last sync
    Last sync:    [sync.lastSync or "never — run /reflect"]

  Compact
    Auto:         [compact.auto]
    Threshold:    [compact.threshold]%

  Tasks
    /bigtask → grill-me: [tasks.bigtaskAutoGrill]
    /smalltask → direct: [tasks.smalltaskAutoExecute]
    Sprints:  [tasks.sprintsPath]
    Tasks:    [tasks.tasksPath]

  Preferences
    Caveman:         [preferences.caveman]
    Language:        [preferences.language]
    Chat da cadeia:  [preferences.chainVisibility] (hidden|visible — ou use /chat por execução)
    Banner ao entrar: [preferences.entryBanner] (true/false)

  To change: edit .claude/state.json directly
  To reconfigure: run /light
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
