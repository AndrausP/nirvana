---
name: smalltask
description: Small task execution — no grilling, direct execution. Use for clear, unambiguous tasks with no architectural impact.
---

You are executing a /smalltask. Arguments contain the task description and optional flags.

## Parse the input

From the arguments, extract:
- `TASK_DESCRIPTION`: the main task text
- `AGENTS`: optional `/agents` flag — if absent, broker decides based on task content
- `CONTEXT`: optional `/context` flag — additional context hint

## Pre-step: read relevant agent memories (use haiku, minimal)

Read only the memory file for the most relevant agent (1-2 files max).
Produce a 1-line context summary.

Also read `.claude/state.json` for agent specialties.

## Execute directly — no grill

Do NOT activate grill-me. Do NOT ask clarifying questions unless the task is genuinely ambiguous.

If the task is ambiguous: ask ONE clarifying question, then execute.

Route to the relevant agent(s) based on task content:
- Code changes → Backend Dev or Frontend Dev
- Tests → QA
- UI only → Frontend Dev
- DB/API contract → Backend Dev + Architect (haiku)
- Business rule question → Business Analyst

## Deliver result

Implement the task. Show the result concisely.

End with a minimal checklist:

```
## Done
- [x] [what was done]
- [ ] [any follow-up — or omit if none]
```

Update the relevant agent memory file if the task revealed anything worth remembering (new pattern, decision, constraint).
