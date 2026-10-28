# How Nirvana works

[← Back to README](../../README.md) · [Commands](commands.md) · [Configuration](configuration.md)

---

## What happens on `/bigtask`

When you type `/bigtask add OAuth login`, Nirvana:
1. Asks for the **business rule** (becomes the Product Owner's acceptance criteria)
2. Runs **grill-me** to stress-test your design
3. Runs the full chain, each agent handing off to the next:
   **Broker → Product Owner → Reader → Writer → Tech Lead → Architect → Tech Lead →
   Product Owner (approve) → Dev Backend / Dev Frontend / Designer → QA → Writer → Broker**
4. Delivers a consolidated conclusion + session checklist
5. The Writer documents everything into `docs/knowledge/` and reindexes the shared graphify graph

When your session ends, the Writer makes sure anything worth remembering is already indexed —
so the next session starts with full shared context, not a stale per-agent memory file.

`/smalltask` runs the same chain without the interview.

---

## The 9 agents

Nirvana runs a **sequential chain**, not a hub-and-spoke broker — each agent hands off to the
next, and only the final decision returns to the broker. Every agent has exactly one job; no
two agents overlap in responsibility.

| # | Agent | Model | Action |
|---|-------|-------|--------|
| 1 | **Product Owner** | opus | Decides & approves. Never implements. |
| 2 | **Tech Lead** | opus | Orients, breaks work into tasks, decides technical viability. |
| 3 | **Architect** | sonnet | Designs structure — back + front — contracts, schema, layers. |
| 4 | **Dev Backend** | sonnet | Implements backend, code/APIs/DB. |
| 5 | **Dev Frontend** | sonnet | Implements frontend/UI. |
| 6 | **Designer** | sonnet | UX/UI flows, wireframes, visual guidelines. |
| 7 | **QA** | sonnet | Tests, validates acceptance criteria, edge cases. |
| 8 | **Reader** | haiku | Read-only. Maps the project, hands raw findings to the Writer. |
| 9 | **Writer** | sonnet | Sole writer of shared memory. Documents everything, indexes graphify. |

Architect / Dev Backend / Dev Frontend / QA have their **specialty auto-detected** from your
project stack during `/light` and stored in `.claude/state.json`. Full spec of each role:
[`templates/agents/<name>.md`](../../templates/agents/).

> **About the Model column:** today the whole chain runs inside your main Claude Code session,
> so the model is the role's intended tier, not a separate process. Running each role as a real
> Claude Code subagent on its own model is on the roadmap.

---

## The chain, step by step

```
1. Broker/sonnet-5      → polish the user's idea, query graphify for context
2. Product Owner/opus   → business objective + acceptance criteria; asks Reader to map context
3. Reader/haiku         → reads the project (read-only), hands raw findings to Writer
4. Writer/sonnet        → organizes findings into a digest
5. Tech Lead/opus       → breaks into tasks (docs/tasks/), sends to Architect
6. Architect/sonnet     → structural decision per task (contracts, schema, layers)
7. Tech Lead/opus       → consolidates Architect's decisions
8. Product Owner/opus   → approves, or sends back to step 5 with a reason
9. Dev Backend / Dev Frontend / Designer → implement the approved task
10. QA/sonnet           → tests; failure goes back to the responsible Dev, not forward
11. Writer/sonnet       → documents errors/patterns/decisions, reindexes graphify
12. Broker/sonnet-5     → assembles the final answer for the user
```

Every turn ends with three sections: the team's conclusion, a session checklist (done and
pending items) and any decision left for you. The headings come from the protocol block in your
`CLAUDE.md`:
```
## Conclusão do time
[consolidated summary]

## Checklist da sessão
- [x] done
- [ ] pending

## Decisão pendente
[what you need to decide — or "Nenhuma"]
```

---

## Memory — shared via graphify, not per-agent

There is no `~/.claude/agents-memory/<agent>.md` per agent. All memory is shared:

- The **Writer** is the only agent that writes. It persists into `docs/knowledge/`:
  - `errors-aprendidos.md` — root cause of bugs fixed
  - `patterns.md` — project conventions and patterns
  - `business-rules.md` — business rules (replaces the old standalone Business Analyst)
  - `docs/decisions.md` — architecture decisions log
- After writing, the Writer runs `/graphify docs/knowledge --update` to keep the shared graph
  current.
- **Every other agent only queries**: `/graphify query "<question>"` — nobody else writes.
- The **Reader** is the only agent allowed to scan the raw project (code, files) when the graph
  doesn't cover what's needed — always hands off to the Writer, never decides alone.

Without [graphify](https://github.com/Graphify-Labs/graphify) installed, the Writer still writes
the same markdown files; there is just no graph index on top.

---

## Sprints & tasks

- `docs/sprints/sprint-{N}.md` — one file per sprint: goal, included tasks, status.
- `docs/tasks/{id}-{slug}.md` — one file per task: description, acceptance criteria, chain
  trace (Architect's decision, Dev's notes, QA's result), status.
- The **Tech Lead** creates them, the **Product Owner** approves inside the file, **Devs/QA**
  update them, the **Writer** closes and indexes them.

They are plain markdown in your repo: reviewable in pull requests and readable without Nirvana.

---

## Chat visibility & entry banner

Two opt-in UI touches on top of the chain:

**See the agents talk (off by default).** Normally you only see the final conclusion.
Add `/chat` to any `/bigtask` or `/smalltask` to watch each handoff live as it happens:
```
━━ Cadeia ao vivo ━━
[1/12] Product Owner (opus)   → objetivo: ...
[2/12] Reader (haiku)         → lendo módulo X...
[3/12] Writer (sonnet)        → digest: padrão P encontrado
...
━━━━━━━━━━━━━━━━━━━━━━
```
Make it the default for every run: set `preferences.chainVisibility: "visible"` in
`.claude/state.json` (default is `"hidden"`).

**Terminal banner on entry (on by default).** Every time you open Claude Code in a
Nirvana-configured project, a banner shows the current sprint, task counts, sessions since the
last `/reflect`, and whether chat visibility is on. Turn it off: `preferences.entryBanner: false`
in `.claude/state.json` — the hook still counts sessions and prints its `[nirvana]` reminders.
