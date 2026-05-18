# Nirvana

> Multi-agent Claude Code workspace system. Route tasks through specialized agents, accumulate business rules, auto-sync architecture docs, and save tokens via smart compaction — for **any project, any tech stack**.

---

## What it does

When you type `/bigtask add OAuth login`, Nirvana:
1. Asks for the **business rule** (captured by the Business Analyst agent)
2. Runs **grill-me** to stress-test your design
3. Routes through **Architect → BA → Backend Dev → QA**
4. Delivers a consolidated conclusion + session checklist
5. Updates agent memories so the next task has full context

When your session ends, Nirvana saves agent memories and compacts context — so you never lose work and always start the next session with context intact.

---

## Requirements

- [Claude Code](https://claude.ai/code) installed and authenticated

That's it.

---

## Install

**Windows — run in PowerShell:**
```powershell
iwr -useb https://raw.githubusercontent.com/YOUR_USER/nirvana/main/install.ps1 | iex
```

**macOS / Linux — run in terminal:**
```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USER/nirvana/main/install.sh | bash
```

The installer:
1. Checks that Claude Code is installed
2. Creates `~/.claude/skills/` if it doesn't exist
3. Downloads and installs all 7 Nirvana skills globally

You only do this **once per machine**.

---

## Setup a project

After installing, open Claude Code inside **any project** and run:

```
/light
```

Nirvana will:
1. Detect your project stack (reads folder structure and key files only — no full code scan)
2. Show you exactly what it's about to do and ask for confirmation
3. Ask 2 questions: sync frequency and compact threshold
4. Create all config files
5. Show a tutorial

**That's it. Nirvana is active.**

---

## Commands

### `/light`
Initialize Nirvana for the current project. Run once. Re-run to update configuration.

```
/light
```

### `/bigtask`
For features, refactors, architecture changes — anything with impact.

grill-me activates automatically. **First question is always the business rule.**

```
/bigtask add payment flow
/bigtask add OAuth login /agents backend,qa
/bigtask refactor auth module /context phase4
```

Optional flags:
- `/agents backend,qa` — hint which agents to involve (broker decides if omitted)
- `/context phase4` — extra context for the broker

### `/smalltask`
For clear, unambiguous tasks. No grilling. Direct execution.

```
/smalltask fix null check in UserService
/smalltask add loading spinner to dashboard
```

### `/reflect`
Force an immediate doc sync from agent memories. Useful before a sprint review or when docs are stale.

```
/reflect
```

### `/law`
Register an explicit business rule. The Business Analyst will validate all future tasks against it.

```
/law payment can only be made by verified users
/law workspace names must be unique per owner
/law deleted records are soft-deleted, never hard-deleted
```

### `/karma`
Full system status — agents, sessions, docs, last sync, compact settings.

```
/karma
```

### `/path`
Show current config from `.claude/state.json` in a readable format.

```
/path
```

---

## The 4 Agents

Nirvana uses 4 role-based agents. Their **specialty is auto-detected** from your project stack during `/light` and stored in `.claude/state.json`.

| Agent | Role | Memory file |
|-------|------|-------------|
| **Backend Dev** | Code, APIs, DB, infrastructure | `~/.claude/agents-memory/backend-dev.md` |
| **Frontend Dev** | UI, components, styling, UX | `~/.claude/agents-memory/frontend-dev.md` |
| **QA** | Tests, edge cases, risk analysis | `~/.claude/agents-memory/qa.md` |
| **Business Analyst** | Accumulates and validates business rules | `~/.claude/agents-memory/business-analyst.md` |

Examples of auto-detected specialties:
- C# project → Backend Dev = "C# / ASP.NET Core 8 / EF Core"
- Python project → Backend Dev = "Python / FastAPI / SQLAlchemy"
- React project → Frontend Dev = "React 18 / TypeScript / TailwindCSS"

Agents accumulate memory across sessions. The broker reads their memory (cheap haiku call) before every task — so context from 10 sessions ago is still available.

---

## How the Broker works

Every task routes through the broker:

```
1. Broker/haiku   → reads relevant agent memories, produces 2-line summaries
2. Architect/haiku → structural impact, layers, contracts
3. BA/haiku        → validates against known business rules
4. Backend/Frontend → implementation plan
5. QA              → risks, edge cases, test strategy
```

Agents **don't communicate directly**. Broker compresses each output and injects it into the next agent's prompt. No context bloat.

Every turn ends with:
```
## Team Conclusion
[consolidated summary]

## Session Checklist
- [x] done
- [ ] pending

## Pending Decision
[what you need to decide — or "None"]
```

---

## Business Analyst

The BA is the memory of your product's rules. It learns two ways:

1. **Explicit** — `/law [rule]` stores it immediately
2. **Captured** — first question of every `/bigtask` captures the business rule for that task

Rules persist across sessions. On every `/bigtask`, the BA validates the new task against all accumulated rules and flags conflicts.

---

## Docs auto-sync

After every N sessions (you choose during `/light`), the broker reads all agent memories and writes:

| File | Contents |
|------|----------|
| `docs/architecture.md` | Stack, layers, structure, dependencies |
| `docs/modules.md` | Modules and their status |
| `docs/decisions.md` | Architectural decisions log with dates |

Force sync anytime: `/reflect`

---

## Token saving

Nirvana saves tokens two ways:

**1. Caveman mode** — active by default. Drops filler words, keeps full technical substance. ~40% fewer output tokens.
- Disable: type `stop caveman`
- Change level: `/caveman lite` | `/caveman full` | `/caveman ultra`

**2. Smart compaction** — when context exceeds your threshold:
1. Agent memories are saved first (nothing lost)
2. `/compact` runs — context is summarized
3. Next message starts fresh with full memory access

Both are configurable in `.claude/state.json`.

---

## Files created by `/light`

**In your project:**
```
your-project/
├── CLAUDE.md                 ← @import .claude/BEHAVIOR.md appended here
├── .claude/
│   ├── BEHAVIOR.md           ← broker protocol + agent specialties (generated)
│   └── state.json            ← Nirvana config (edit freely)
└── docs/
    ├── architecture.md       ← auto-maintained by /reflect
    ├── modules.md            ← auto-maintained by /reflect
    └── decisions.md          ← auto-maintained by /reflect
```

**Global (shared across all your projects):**
```
~/.claude/
├── CLAUDE.md                 ← Nirvana agent table added here
├── skills/
│   ├── light/SKILL.md
│   ├── bigtask/SKILL.md
│   ├── smalltask/SKILL.md
│   ├── reflect/SKILL.md
│   ├── law/SKILL.md
│   ├── path/SKILL.md
│   └── karma/SKILL.md
└── agents-memory/
    ├── backend-dev.md        ← grows over time
    ├── frontend-dev.md       ← grows over time
    ├── qa.md                 ← grows over time
    └── business-analyst.md  ← grows over time
```

---

## Config reference

Edit `.claude/state.json` directly to change any preference:

```jsonc
{
  "nirvana": "1.0.0",
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
    "caveman": "full",    // lite | full | ultra | off
    "language": "auto"    // auto = matches your message language
  },
  "project": {
    "type": "web-api",
    "stack": ["aspnet8", "postgresql", "react18"],
    "docsPath": "docs/"
  },
  "agents": {
    "backendDev":       { "active": true, "specialty": "C# / ASP.NET Core 8" },
    "frontendDev":      { "active": true, "specialty": "React 18 / TypeScript" },
    "qa":               { "active": true, "specialty": "NUnit / Moq" },
    "businessAnalyst":  { "active": true }
  },
  "tasks": {
    "bigtaskAutoGrill": true,
    "smalltaskAutoExecute": true
  }
}
```

---

## Repo structure

```
nirvana/
├── README.md
├── install.ps1              ← Windows installer
├── install.sh               ← macOS/Linux installer
├── skills/                  ← skill source files
│   ├── light/SKILL.md
│   ├── bigtask/SKILL.md
│   ├── smalltask/SKILL.md
│   ├── reflect/SKILL.md
│   ├── law/SKILL.md
│   ├── path/SKILL.md
│   └── karma/SKILL.md
└── templates/               ← used by /light to generate project files
    ├── BEHAVIOR.md
    ├── state.json
    ├── docs/
    │   ├── architecture.md
    │   ├── modules.md
    │   └── decisions.md
    └── agents/
        ├── backend-dev.md
        ├── frontend-dev.md
        ├── qa.md
        └── business-analyst.md
```

---

## License

MIT
