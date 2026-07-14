---
name: bigtask
description: Large task execution with automatic grill-me. First question captures the business rule for the Product Owner. Runs the full 9-agent chain. Use for features, refactors, or anything with architectural impact.
---

You are executing a /bigtask. Arguments contain the task description and optional flags.

## Parse the input

From the arguments, extract:
- `TASK_DESCRIPTION`: the main task text
- `AGENTS`: optional `/agents` flag (e.g., `/agents backend,qa`) — if absent, Tech Lead decides during Step 5 of the chain
- `CONTEXT`: optional `/context` flag (e.g., `/context phase4`) — additional context hint
- `CHAT`: optional `/chat` flag — forces the live chain transcript on for this run only (see
  "Chat visibility" below), regardless of `preferences.chainVisibility` in `.claude/state.json`

## Pre-step: consult graphify (Sonnet 5)

Memory is shared, not per-agent. Before anything else:
1. If `graphify-out/graph.json` exists, run `/graphify query "<TASK_DESCRIPTION>"` to pull
   relevant context (past decisions, patterns, known errors) — do NOT read flat per-agent
   memory files, they no longer exist.
2. Read `.claude/state.json` for project context and active agent config.
3. Produce a 2-3 line summary of what's relevant. This is the seed the Product Owner starts from.

## Activate grill-me — first question is ALWAYS the business rule

Before any other grill-me question, ask:

"What is the business rule for this task? (This becomes the Product Owner's acceptance criteria)"

Wait for the answer. This is the seed for Step 2 of the chain below — do not save it separately,
it flows through the Product Owner into the task file the Writer creates in Step 5 of the chain.

## Continue with grill-me

After capturing the business rule, proceed with the full grill-me interview about the task:
- Walk down each branch of the design tree
- Ask questions one at a time
- Provide your recommended answer for each
- Resolve dependencies between decisions
- Stop when shared understanding is reached

## Chat visibility

Read `preferences.chainVisibility` from `.claude/state.json` (default `"hidden"`). If it's
`"visible"` OR the `/chat` flag was passed, print each chain step live as it completes, in the
format below — one line per agent, in order, before the final "Conclusão do time" block. If
`"hidden"` and no `/chat` flag: print nothing until the final block — the steps still all run,
they're just not narrated.

```
━━ Cadeia ao vivo ━━
[N/12] Agent Name (model) → one-line result
...
━━━━━━━━━━━━━━━━━━━━━━
```

## After grill-me: run the full chain

Once grill-me completes, run the sequential chain end to end — each step hands off to the next,
nobody returns to the broker mid-chain:

```
1. Broker/sonnet-5      — seed from pre-step + grill-me outcome
2. Product Owner/opus   — business objective + acceptance criteria; asks Reader to map context
3. Reader/haiku         — reads project (read-only), hands raw findings to Writer
4. Writer/sonnet        — organizes findings into a digest
5. Tech Lead/opus       — breaks into tasks, creates docs/tasks/{id}-{slug}.md (sprint from
                          docs/sprints/ if one is active, otherwise ask the user which sprint)
6. Architect/sonnet     — structural decision per task (contracts, schema, layers)
7. Tech Lead/opus       — consolidates Architect's decisions
8. Product Owner/opus   — approves or sends back to step 5 with a reason
9. Dev Backend / Dev Frontend / Designer (sonnet) — implement the approved task(s)
10. QA/sonnet           — tests against acceptance criteria; failure sends it back to the
                          responsible Dev, not forward
11. Writer/sonnet       — documents errors/patterns/decisions in docs/knowledge/, updates the
                          task file status, runs `/graphify docs/knowledge --update`
12. Broker/sonnet-5     — receives Writer's confirmation, assembles the final answer
```

Compress each agent's output before passing it to the next (see the internal-communication
format in the project's `NIRVANA:START` block of `CLAUDE.md`).

## End of turn

Always close with:

```
## Conclusão do time
[consolidated summary]

## Checklist da sessão
- [x] [completed items — reference the task file(s) touched]
- [ ] [pending items]

## Decisão pendente
[what the user needs to decide — or "Nenhuma"]
```

The Writer is the only one who persists anything — confirm `docs/knowledge/` and the task file
in `docs/tasks/` were updated, and that graphify was reindexed.
