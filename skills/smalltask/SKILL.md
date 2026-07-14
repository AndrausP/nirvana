---
name: smalltask
description: Small task execution — no grilling, direct execution through the 9-agent chain. Use for clear, unambiguous tasks with no architectural impact.
---

You are executing a /smalltask. Arguments contain the task description and optional flags.

## Parse the input

From the arguments, extract:
- `TASK_DESCRIPTION`: the main task text
- `AGENTS`: optional `/agents` flag — if absent, Tech Lead decides during the chain
- `CONTEXT`: optional `/context` flag — additional context hint
- `CHAT`: optional `/chat` flag — forces the live chain transcript on for this run only, same
  format as `/bigtask` (see "Chat visibility" there); check `preferences.chainVisibility` in
  `.claude/state.json` for the persistent default

## Pre-step: consult graphify (Sonnet 5, minimal)

If `graphify-out/graph.json` exists, run `/graphify query "<TASK_DESCRIPTION>"` — one query,
skip if the answer is obviously irrelevant to a small task. Do not read flat per-agent memory
files, they no longer exist; memory is shared in `docs/knowledge/` via graphify.

## Execute directly — no grill

Do NOT activate grill-me. Do NOT ask clarifying questions unless the task is genuinely ambiguous.

If the task is ambiguous: ask ONE clarifying question, then execute.

## Run the chain (lightweight)

Still runs through the chain — small task just means no grill-me interview, not a shortcut
around the roles. If `preferences.chainVisibility == "visible"` or `/chat` was passed, print
each step live (`[N/7] Agent Name (model) → result`) before the final checklist; otherwise stay
silent until the end, same as `/bigtask`.

```
1. Broker/sonnet-5    — seed from pre-step
2. Product Owner/opus — quick objective + acceptance criteria (one line is enough for a small task)
3. Tech Lead/opus     — routes directly to the right executor(s), may skip a separate task file
                        for genuinely trivial changes (note this explicitly if skipped)
4. Architect/sonnet   — only if the task touches contracts/schema; otherwise skipped
5. Dev Backend / Dev Frontend / Designer / QA (sonnet) — implement + test
6. Writer/sonnet      — documents anything worth remembering (new pattern, bug fixed, decision)
                        in docs/knowledge/, updates graphify
7. Broker/sonnet-5    — delivers the result
```

Route to the relevant executor(s) based on task content:
- Code changes → Dev Backend or Dev Frontend
- Tests → QA
- UI only → Designer + Dev Frontend
- DB/API contract → Dev Backend + Architect
- Business rule question → Product Owner

## Deliver result

Implement the task. Show the result concisely.

End with a minimal checklist:

```
## Feito
- [x] [what was done]
- [ ] [any follow-up — or omit if none]
```

If the task revealed anything worth remembering (new pattern, decision, constraint, bug fixed),
the Writer records it in `docs/knowledge/` and reindexes graphify — do not skip this just
because the task itself was small.
