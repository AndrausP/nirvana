# Nirvana

> Multi-agent Claude Code workspace system. Routes tasks through a 9-role chain — Product Owner
> to Writer — with shared memory indexed by [graphify](https://github.com/Graphify-Labs/graphify),
> sprint/task tracking, and token-saving compaction — for **any project, any tech stack**.

---

## What it does

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

---

## Requirements

- [Claude Code](https://claude.ai/code) installed and authenticated
- [graphify](https://github.com/Graphify-Labs/graphify) available (`pip install graphifyy` or
  `uv tool install graphifyy`) — powers the shared memory. Nirvana still works without it, the
  Writer just falls back to plain markdown in `docs/knowledge/` with no graph index.

---

## Install

**Windows — run in PowerShell:**
```powershell
iwr -useb https://raw.githubusercontent.com/AndrausP/nirvana/main/install.ps1 | iex
```

**macOS / Linux — run in terminal:**
```bash
curl -fsSL https://raw.githubusercontent.com/AndrausP/nirvana/main/install.sh | bash
```

The installer:
1. Checks that Claude Code is installed
2. Creates `~/.claude/skills/` if it doesn't exist, installs all 7 Nirvana skills globally
3. Creates `~/.claude/nirvana-templates/` and installs the templates `/light` needs (agent
   specs, BEHAVIOR.md, docs skeleton, banner hook scripts) — skills alone aren't enough, `/light`
   runs inside your project, not inside the Nirvana repo, so the templates it copies from have
   to live somewhere global too

You only do this **once per machine**.

---

## Setup a project

After installing, open Claude Code inside **any project** and run:

```
/light
```

Nirvana will:
1. Detect your project stack (reads folder structure and key files only — no full code scan)
2. Read your existing `CLAUDE.md` and merge the broker protocol directly into it — between
   markers, nothing else touched. No separate `BEHAVIOR.md`, no `@import`.
3. Show you exactly what it's about to do and ask for confirmation
4. Ask 2 questions: sync frequency and compact threshold
5. Create `docs/` (architecture, modules, decisions, sprints/, tasks/, knowledge/) and
   initialize graphify over `docs/knowledge/`
6. Wire a banner into `.claude/settings.json` (`SessionStart` hook) that shows sprint/task
   status every time you open the project — merged in, any existing hooks stay untouched
7. Show a tutorial

**That's it. Nirvana is active.**

---

## Commands

### `/light`
Initialize Nirvana for the current project. Run once. Re-run to update configuration — only the
Nirvana-owned block inside your `CLAUDE.md` gets regenerated, everything else is preserved.

```
/light
```

### `/bigtask`
For features, refactors, architecture changes — anything with impact. Runs the full 9-agent chain.

grill-me activates automatically. **First question is always the business rule.**

```
/bigtask add payment flow
/bigtask add OAuth login /agents backend,qa
/bigtask refactor auth module /context phase4
```

Optional flags:
- `/agents backend,qa` — hint which agents to involve (Tech Lead decides if omitted)
- `/context phase4` — extra context for the chain

### `/smalltask`
For clear, unambiguous tasks. No grilling. Still runs the chain, just without the interview.

```
/smalltask fix null check in UserService
/smalltask add loading spinner to dashboard
```

### `/reflect`
Force an immediate doc sync from the shared graphify-indexed knowledge base. Useful before a
sprint review or when docs are stale.

```
/reflect
```

### `/law`
Register an explicit business rule directly into `docs/knowledge/business-rules.md`. The
Product Owner validates all future tasks against it.

```
/law payment can only be made by verified users
/law workspace names must be unique per owner
/law deleted records are soft-deleted, never hard-deleted
```

### `/karma`
Full system status — 9 agents, sessions, docs, last sync, graphify status, open sprints/tasks.

```
/karma
```

### `/path`
Show current config from `.claude/state.json` in a readable format.

```
/path
```

---

## The 9 Agents

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
`templates/agents/<name>.md`.

---

## How the chain works

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

Every turn ends with:
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

There is no more `~/.claude/agents-memory/<agent>.md` per agent. All memory is shared:

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

---

## Sprints & Tasks

- `docs/sprints/sprint-{N}.md` — one file per sprint: goal, included tasks, status.
- `docs/tasks/{id}-{slug}.md` — one file per task: description, acceptance criteria, chain
  trace (Architect's decision, Dev's notes, QA's result), status.
- The **Tech Lead** creates them, the **Product Owner** approves inside the file, **Devs/QA**
  update them, the **Writer** closes and indexes them.

---

## Chat visibility & entry banner

Two opt-in UI touches on top of the chain:

**See the agents talk (off by default).** Normally you only see the final "Conclusão do time".
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
Nirvana-configured project, a banner shows the current sprint, task counts, and whether chat
visibility is on. Turn it off: `preferences.entryBanner: false` in `.claude/state.json`.

---

## Token saving

Nirvana saves tokens two ways:

**1. Caveman mode** — active by default. Drops filler words, keeps full technical substance. ~40% fewer output tokens.
- Disable: type `stop caveman`
- Change level: `/caveman lite` | `/caveman full` | `/caveman ultra`

**2. Smart compaction** — when context exceeds your threshold:
1. The Writer indexes anything pending into graphify first (nothing lost)
2. `/compact` runs — context is summarized
3. Next message starts fresh, memory still queryable via graphify

Both are configurable in `.claude/state.json`.

---

## Files created by `/light`

**In your project:**
```
your-project/
├── CLAUDE.md                     ← Nirvana block merged in, between NIRVANA:START/END markers
├── .claude/
│   └── state.json                ← Nirvana config (edit freely)
└── docs/
    ├── architecture.md           ← auto-maintained by /reflect
    ├── modules.md                ← auto-maintained by /reflect
    ├── decisions.md              ← auto-maintained by /reflect
    ├── sprints/                  ← one file per sprint (Tech Lead creates, PO approves)
    ├── tasks/                    ← one file per task (chain trace, status)
    └── knowledge/                ← graphify-indexed shared memory
        ├── errors-aprendidos.md
        ├── patterns.md
        └── business-rules.md
.claude/
├── state.json
├── settings.json                 ← SessionStart hook merged in here (existing hooks preserved)
└── hooks/
    └── nirvana-banner.ps1        ← or .sh on macOS/Linux
```

**Global (shared across all your projects):**
```
~/.claude/
├── CLAUDE.md                     ← Nirvana 9-agent table added here
├── skills/
│   ├── light/SKILL.md
│   ├── bigtask/SKILL.md
│   ├── smalltask/SKILL.md
│   ├── reflect/SKILL.md
│   ├── law/SKILL.md
│   ├── path/SKILL.md
│   └── karma/SKILL.md
└── nirvana-templates/            ← what /light actually copies from
    ├── BEHAVIOR.md
    ├── state.json
    ├── docs/...
    ├── agents/...
    └── hooks/
        ├── nirvana-banner.ps1
        └── nirvana-banner.sh
```

---

## Config reference

Edit `.claude/state.json` directly to change any preference:

```jsonc
{
  "nirvana": "2.0.0",
  "sync": {
    "every": 5,           // sessions between auto doc syncs
    "sessionCount": 0,    // managed by Nirvana — don't edit
    "lastSync": null      // managed by Nirvana — don't edit
  },
  "compact": {
    "auto": true,         // enable auto-compact
    "threshold": 70       // compact when context > 70%
  },
  "preferences": {
    "caveman": "full",         // lite | full | ultra | off
    "language": "auto",        // auto = matches your message language
    "chainVisibility": "hidden", // hidden | visible — see agents hand off live (or use /chat per run)
    "entryBanner": true        // show Nirvana banner on SessionStart
  },
  "project": {
    "type": "web-api",
    "stack": ["aspnet8", "postgresql", "react18"],
    "docsPath": "docs/"
  },
  "graphify": {
    "enabled": true,
    "source": "docs/knowledge",
    "outPath": "graphify-out/",
    "owner": "writer",
    "lastIndexed": null
  },
  "agents": {
    "productOwner":  { "active": true, "model": "opus" },
    "techLead":      { "active": true, "model": "opus" },
    "architect":     { "active": true, "model": "sonnet", "specialty": "C# / ASP.NET Core 8 + React 18" },
    "devBackend":    { "active": true, "model": "sonnet", "specialty": "C# / ASP.NET Core 8" },
    "devFrontend":   { "active": true, "model": "sonnet", "specialty": "React 18 / TypeScript" },
    "designer":      { "active": true, "model": "sonnet" },
    "qa":            { "active": true, "model": "sonnet", "specialty": "NUnit / Moq" },
    "reader":        { "active": true, "model": "haiku" },
    "writer":        { "active": true, "model": "sonnet" }
  },
  "tasks": {
    "bigtaskAutoGrill": true,
    "smalltaskAutoExecute": true,
    "tasksPath": "docs/tasks/",
    "sprintsPath": "docs/sprints/"
  }
}
```

---

## Repo structure

```
nirvana/
├── README.md
├── install.ps1              ← Windows installer
├── install.sh                ← macOS/Linux installer
├── skills/                   ← skill source files
│   ├── light/SKILL.md
│   ├── bigtask/SKILL.md
│   ├── smalltask/SKILL.md
│   ├── reflect/SKILL.md
│   ├── law/SKILL.md
│   ├── path/SKILL.md
│   └── karma/SKILL.md
└── templates/                ← used by /light to generate project files
    ├── BEHAVIOR.md           ← source of the NIRVANA:START/END block merged into CLAUDE.md
    ├── state.json
    ├── docs/
    │   ├── architecture.md
    │   ├── modules.md
    │   ├── decisions.md
    │   ├── sprints/sprint-template.md
    │   ├── tasks/task-template.md
    │   └── knowledge/
    │       ├── errors-aprendidos.md
    │       ├── patterns.md
    │       └── business-rules.md
    ├── agents/
    │   ├── product-owner.md
    │   ├── tech-lead.md
    │   ├── architect.md
    │   ├── dev-backend.md
    │   ├── dev-frontend.md
    │   ├── designer.md
    │   ├── qa.md
    │   ├── reader.md
    │   └── writer.md
    └── hooks/
        ├── nirvana-banner.ps1
        └── nirvana-banner.sh
```

`install.ps1`/`install.sh` mirror the whole `templates/` tree into
`~/.claude/nirvana-templates/` — that's what `/light` actually reads from at runtime (see the
note at the top of `skills/light/SKILL.md`).

---

## License

MIT
