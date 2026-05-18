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

  Agents
    Backend Dev:  [agents.backendDev.specialty]
    Frontend Dev: [agents.frontendDev.specialty]
    QA:           [agents.qa.specialty]
    BA:           active (rules in ~/.claude/agents-memory/business-analyst.md)

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

  Preferences
    Caveman:  [preferences.caveman]
    Language: [preferences.language]

  To change: edit .claude/state.json directly
  To reconfigure: run /light
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
