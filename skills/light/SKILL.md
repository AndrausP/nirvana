---
name: light
description: Nirvana initializer — sets up broker protocol, 4 generic agents, docs skeleton, and token-saving compact automation for any project. Run once per project to activate Nirvana.
---

You are executing the Nirvana /light setup. Follow every step exactly. Do not skip steps. Do not ask permission between steps unless instructed.

## STEP 1 — Re-run detection

Check if `.claude/state.json` exists in the current working directory.

If it EXISTS:
- Tell the user: "Nirvana already configured for this project."
- Use AskUserQuestion: "What would you like to do?" | options: ["Update configuration (preserves session history)", "Cancel"]
- If Cancel: stop completely.
- If Update: continue to Step 2, but in Step 5 MERGE state.json (preserve `sync.sessionCount` and `sync.lastSync` values).

If NOT exists: continue to Step 2.

## STEP 2 — Read project structure (be efficient, use haiku-level minimal reads)

1. List ALL files and folders in the project root (one level deep only).
2. Look for these indicator files and read them partially if found (first 30 lines max):
   - `package.json` → detect JS/TS stack (React, Vue, Next, Angular, etc.)
   - `*.csproj` or `*.sln` → detect .NET (version, frameworks)
   - `requirements.txt` or `pyproject.toml` → Python stack
   - `go.mod` → Go
   - `pom.xml` or `build.gradle` → Java/Kotlin
   - `Cargo.toml` → Rust
   - `Gemfile` → Ruby
   - `CLAUDE.md` → read first 80 lines to understand project context
3. Determine:
   - `PROJECT_TYPE`: web-api | web-fullstack | mobile | cli | library | data | unknown
   - `BACKEND_LANGUAGE`: csharp | python | go | java | javascript | ruby | rust | unknown
   - `BACKEND_FRAMEWORK`: aspnet | fastapi | django | express | gin | spring | unknown
   - `FRONTEND_FRAMEWORK`: react | vue | angular | svelte | sapui5 | none | unknown
   - `TEST_FRAMEWORK`: nunit | pytest | jest | junit | unknown

## STEP 3 — Show summary and ask permission

Display this block:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Nirvana /light — Setup Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Project: [PROJECT_TYPE] | Stack: [detected stack summary]

  What will happen:
  1. Read project structure to configure agents
  2. Append @import .claude/BEHAVIOR.md to your CLAUDE.md
  3. Create .claude/BEHAVIOR.md with broker + 4 agents specialized for [stack]
  4. Create .claude/state.json with your preferences
  5. Create docs/ folder (architecture.md, modules.md, decisions.md)
  6. Update ~/.claude/CLAUDE.md with Nirvana generic agent protocol
  7. Create agent memory files in ~/.claude/agents-memory/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Use AskUserQuestion: "Proceed with Nirvana setup?" | options: ["Yes, activate Nirvana", "Cancel"]

If Cancel: stop.

## STEP 4 — Ask preferences (2 questions, sequential)

Question 1 (AskUserQuestion):
- "How many sessions between automatic doc syncs?"
- Options: ["Every session (1)", "Every 3 sessions", "Every 5 sessions (recommended)", "Every 10 sessions"]
- Map to value: 1, 3, 5, 10

Question 2 (AskUserQuestion):
- "Auto-compact when context exceeds:"
- Options: ["50%", "70% (recommended)", "80%", "Disabled"]
- Map to value: 50, 70, 80, 0 (0 = disabled, set auto: false)

## STEP 5 — Execute setup (all steps, no confirmation needed)

### 5a — Create .claude/BEHAVIOR.md

Build the content by filling these placeholders from Step 2 detection:
- {{BACKEND_SPECIALTY}} → e.g., "C# / ASP.NET Core 8 / EF Core / PostgreSQL"
- {{FRONTEND_SPECIALTY}} → e.g., "React 18 / TypeScript / TailwindCSS"
- {{QA_SPECIALTY}} → e.g., "NUnit / Moq / integration testing"
- {{STACK_SUMMARY}} → one-line stack description
- {{PROJECT_TYPE}} → detected project type

Content to write:

```markdown
# Nirvana — Behavior

> Gerado por /light. Edite manualmente se necessário. Reimporte com /light update.

## Agents

| Role | Specialty | Memory |
|------|-----------|--------|
| Backend Dev | {{BACKEND_SPECIALTY}} | `~/.claude/agents-memory/backend-dev.md` |
| Frontend Dev | {{FRONTEND_SPECIALTY}} | `~/.claude/agents-memory/frontend-dev.md` |
| QA | {{QA_SPECIALTY}} | `~/.claude/agents-memory/qa.md` |
| Business Analyst | Rules accumulated from sessions | `~/.claude/agents-memory/business-analyst.md` |

## Broker Protocol

### Pre-step (haiku — cheap)
Before calling any agent, broker reads the relevant agent memory file with haiku and produces a 2-3 line summary. Inject that summary into the actual agent prompt.

### Task flow
1. Broker/haiku — reads relevant memories, produces summaries
2. Architect/haiku — structural impact, layers, contracts
3. Business Analyst/haiku — scope, business rules validation
4. Backend Dev or Frontend Dev — implementation viability
5. QA — risks, edge cases

### Internal communication (broker relays — no direct channel)
Agents do not talk to each other. Broker compresses each output and injects into the next:
```
[arch→dev] entity X add field Y:type; repo change; migration needed
[dev→qa] impl ok; risk: Z
[qa→arch] edge: W; needs decision
```

### Output format
```
## Team Conclusion
[consolidated summary]

## Session Checklist
- [x] What was done (file/agent)
- [ ] Pending (if any)

## Pending Decision
[what the user needs to decide — if any]
```

**Rule:** after all agents respond, broker ALWAYS builds the checklist before ending the turn.

## Caveman Mode

Caveman mode is ALWAYS active (full). Never deactivate unless user explicitly says "stop caveman" or "normal mode".

## Task Conventions

- `/bigtask [description]` — activates grill-me automatically. First question is always the business rule. Optional flags: `/agents backend,qa` or `/context phase2`
- `/smalltask [description]` — executes directly, no grill. Use for clear, unambiguous tasks.

## Compact & Sync

- Auto-compact threshold and sync frequency are in `.claude/state.json`
- On session end: broker updates agent memories, increments sessionCount
- When sessionCount >= sync.every: broker reads all agent memories and synthesizes docs/
- On compact: save all agent memories first, then compact

## Commit Rules

Agents do not appear in git history. Conventional Commits:
```
feat: description
fix: description
refactor: description
test: description
```
```

### 5b — Update project CLAUDE.md

Read existing `CLAUDE.md` in project root.

Check if the string `@.claude/BEHAVIOR.md` already exists in the file.

If NOT present: append this exact line at the very end of the file:
```
@.claude/BEHAVIOR.md
```

If no `CLAUDE.md` exists: create one with this content:
```markdown
# CLAUDE.md

This project uses Nirvana. See .claude/BEHAVIOR.md for agent and broker configuration.

@.claude/BEHAVIOR.md
```

### 5c — Create .claude/state.json

Write this file, substituting SYNC_EVERY and COMPACT_THRESHOLD from Step 4 answers, and project info from Step 2:

```json
{
  "nirvana": "1.0.0",
  "sync": {
    "every": SYNC_EVERY,
    "sessionCount": 0,
    "lastSync": null
  },
  "compact": {
    "auto": COMPACT_AUTO,
    "threshold": COMPACT_THRESHOLD
  },
  "preferences": {
    "caveman": "full",
    "language": "auto"
  },
  "project": {
    "type": "PROJECT_TYPE",
    "stack": ["STACK_ITEMS"],
    "docsPath": "docs/"
  },
  "agents": {
    "backendDev": {
      "active": true,
      "specialty": "BACKEND_SPECIALTY"
    },
    "frontendDev": {
      "active": true,
      "specialty": "FRONTEND_SPECIALTY"
    },
    "qa": {
      "active": true,
      "specialty": "QA_SPECIALTY"
    },
    "businessAnalyst": {
      "active": true
    }
  },
  "tasks": {
    "bigtaskAutoGrill": true,
    "smalltaskAutoExecute": true
  }
}
```

### 5d — Create docs/ skeleton (skip files that already exist)

Create `docs/architecture.md`:
```markdown
# Architecture

> Maintained by Nirvana. Updated automatically every N sessions via /reflect.
> Last updated: never — run /reflect to generate first synthesis.

## Stack
[Detected: STACK_SUMMARY]

## Project Structure
<!-- Auto-fill: run /reflect after first few sessions -->

## Key Layers
<!-- Auto-fill: run /reflect after first few sessions -->

## External Dependencies
<!-- Auto-fill: run /reflect after first few sessions -->
```

Create `docs/modules.md`:
```markdown
# Modules

> Maintained by Nirvana. Populated as agents work on each module.

<!-- Each module added here as Backend Dev / Architect agents document their work -->
```

Create `docs/decisions.md`:
```markdown
# Architecture Decisions

> Maintained by Nirvana. Each significant decision logged here by the broker.

| Date | Decision | Reason | Agent |
|------|----------|--------|-------|
| — | — | — | — |
```

### 5e — Update ~/.claude/CLAUDE.md

Read `~/.claude/CLAUDE.md`. Find the section that defines agents (look for "O Time" or a table with agent roles).

Replace the agents table with this generic Nirvana table (preserve all other content around it):

```markdown
## Nirvana Agents

| Role | File | Model |
|------|------|-------|
| Architect | architect (structural decisions) | haiku |
| Backend Dev | backend-dev (language/framework specialist — see project BEHAVIOR.md) | sonnet |
| Frontend Dev | frontend-dev (UI specialist — see project BEHAVIOR.md) | sonnet |
| QA | qa (testing specialist — see project BEHAVIOR.md) | sonnet |
| Business Analyst | business-analyst (business rules accumulator) | haiku |
```

If the global CLAUDE.md does not exist: create it with just the Nirvana agent table and broker protocol from 5a.

### 5f — Create agent memory files (only if they don't exist)

Create `~/.claude/agents-memory/backend-dev.md` if not exists:
```markdown
---
agent: backend-dev
specialty: {{BACKEND_SPECIALTY}}
---

No sessions yet. Memory accumulates as work happens.
```

Create `~/.claude/agents-memory/frontend-dev.md` if not exists:
```markdown
---
agent: frontend-dev
specialty: {{FRONTEND_SPECIALTY}}
---

No sessions yet. Memory accumulates as work happens.
```

Create `~/.claude/agents-memory/qa.md` if not exists:
```markdown
---
agent: qa
specialty: {{QA_SPECIALTY}}
---

No sessions yet. Memory accumulates as work happens.
```

Create `~/.claude/agents-memory/business-analyst.md` if not exists:
```markdown
---
agent: business-analyst
---

## Business Rules

No rules yet. Rules accumulate via /law command and /bigtask first questions.

## Inferred Rules

None yet.
```

## STEP 6 — Show tutorial

Display exactly this in the terminal:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Nirvana is active.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  5 things to know:

  1. /bigtask [description]
     grill-me activates automatically.
     First question is always the business rule.
     Optional: /bigtask fix auth /agents backend,qa /context phase2

  2. /smalltask [description]
     Executes directly. No grilling. Use for clear tasks.

  3. Caveman mode is active (full).
     To disable: type  stop caveman
     To change level: /caveman lite | full | ultra

  4. Docs sync automatically every N sessions.
     Force sync now: /reflect

  5. Business rules accumulate automatically.
     Add explicitly: /law [rule description]

  Other commands:
    /karma   — status (agents, docs, sessions, last sync)
    /path    — view/hint config (.claude/state.json)
    /reflect — sync docs from agent memories now

  Edit preferences: .claude/state.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
