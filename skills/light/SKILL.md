---
name: light
description: Nirvana initializer — merges the broker protocol and 9 role-based agents into the project's own CLAUDE.md, sets up docs/knowledge (graphify-indexed shared memory), sprints/tasks skeleton, and token-saving compact automation. Run once per project to activate Nirvana.
---

You are executing the Nirvana /light setup. Follow every step exactly. Do not skip steps. Do not ask permission between steps unless instructed.

**Template source:** every `templates/X` reference below means `~/.claude/nirvana-templates/X`
(installed globally by `install.ps1`/`install.sh` — NOT a path relative to the current project,
and NOT the Nirvana repo's own `templates/` folder, which isn't present in a normal install). If
`~/.claude/nirvana-templates/` doesn't exist, tell the user their Nirvana install is outdated
(pre-2.0) and to re-run the installer, then stop.

## STEP 1 — Re-run detection

Check if `.claude/state.json` exists in the current working directory.

If it EXISTS:
- Tell the user: "Nirvana already configured for this project."
- Use AskUserQuestion: "What would you like to do?" | options: ["Update configuration (preserves session history)", "Cancel"]
- If Cancel: stop completely.
- If Update: continue to Step 2, but in Step 5 MERGE state.json (preserve `sync.sessionCount` and `sync.lastSync` values) and in Step 5a only regenerate the content BETWEEN the Nirvana markers in CLAUDE.md (see Step 5a) — never touch anything outside them.

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
   - `CLAUDE.md` → read the ENTIRE file (not just 80 lines) — Step 5a needs the full content to merge correctly
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
  1. Read project structure to configure 9 agents (Product Owner, Tech Lead,
     Architect, Dev Backend, Dev Frontend, Designer, QA, Reader, Writer)
  2. Read your existing CLAUDE.md (if any) and merge the Nirvana broker
     protocol INTO it — between markers, nothing else touched. No separate
     BEHAVIOR.md file, no @import.
  3. Create .claude/state.json with your preferences
  4. Create docs/ skeleton: architecture.md, modules.md, decisions.md,
     sprints/, tasks/, knowledge/ (errors-aprendidos.md, patterns.md,
     business-rules.md — this is what graphify indexes)
  5. Wire a SessionStart banner (shows sprint/tasks/chat status every time
     you open this project) — merged into .claude/settings.json, existing
     hooks untouched
  6. Update ~/.claude/CLAUDE.md with the generic Nirvana 9-agent table
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

### 5a — Merge the Nirvana protocol INTO the project's CLAUDE.md (do NOT create BEHAVIOR.md)

This is the core rule change: Nirvana no longer owns a separate file. It reads the project's
own `CLAUDE.md`, keeps whatever is already there that still makes sense, and injects its own
instructions directly into it, wrapped in markers so future `/light` runs can update just that
slice.

1. If `CLAUDE.md` does not exist in the project root: create it with this header, then the
   Nirvana block (Step 5a-3) right after it:
   ```markdown
   # CLAUDE.md

   This project uses Nirvana — see the block below for the broker protocol and 9-agent chain.
   ```
2. If `CLAUDE.md` exists: read it in full. Look for the markers:
   ```
   <!-- NIRVANA:START (do not edit by hand — regenerated by /light) -->
   ...
   <!-- NIRVANA:END -->
   ```
   - If the markers ARE found: replace everything between them with the freshly generated
     block from Step 5a-3. Leave every other line in the file untouched, in its original
     position.
   - If the markers are NOT found: keep the entire existing file content as-is, and append the
     marker block (Step 5a-3) at the end of the file, separated by a blank line. Do not remove,
     reword, or reorder anything that was already there — only add.
   - Use judgment on genuine conflicts (e.g. the file already has its own hand-written "agents"
     table or broker description that predates Nirvana): keep the pre-existing content where it
     is, and still add the Nirvana block — do not silently delete a human's prior instructions.
     If the overlap looks substantial, tell the user what was kept vs. added in the final report.

3. The Nirvana block to inject (fill placeholders from Step 2 detection):
   - `{{BACKEND_SPECIALTY}}` → e.g., "C# / ASP.NET Core 8 / EF Core / PostgreSQL"
   - `{{FRONTEND_SPECIALTY}}` → e.g., "React 18 / TypeScript / TailwindCSS"
   - `{{QA_SPECIALTY}}` → e.g., "NUnit / Moq / integration testing"

   Content (copy `templates/BEHAVIOR.md` verbatim with placeholders substituted, wrapped in the
   markers):
   ```markdown
   <!-- NIRVANA:START (do not edit by hand — regenerated by /light) -->
   [... full contents of templates/BEHAVIOR.md, placeholders filled ...]
   <!-- NIRVANA:END -->
   ```

### 5b — Create .claude/state.json

Copy `templates/state.json`, substituting `SYNC_EVERY`, `COMPACT_AUTO`, `COMPACT_THRESHOLD` from
Step 4 answers, and project info from Step 2. Keep the `graphify`, `agents`, and `tasks` blocks
from the template as-is (only specialty placeholders get filled).

On UPDATE re-runs: preserve `sync.sessionCount` and `sync.lastSync` from the existing file.

### 5c — Create docs/ skeleton (skip files that already exist)

Copy from `templates/docs/`:
- `architecture.md`, `modules.md`, `decisions.md` → `docs/`
- `knowledge/errors-aprendidos.md`, `knowledge/patterns.md`, `knowledge/business-rules.md` → `docs/knowledge/`
- `sprints/sprint-template.md` → `docs/sprints/sprint-template.md` (kept as a template, not a real sprint)
- `tasks/task-template.md` → `docs/tasks/task-template.md` (kept as a template, not a real task)

Substitute `{{STACK_SUMMARY}}` in `architecture.md` from Step 2 detection.

### 5d — Initialize graphify on docs/knowledge

Run `/graphify docs/knowledge` once so the shared knowledge graph exists from session one (it
will be near-empty until the Writer starts documenting, but the graph structure and
`graphify-out/` are ready). If the `graphify` command is unavailable, skip this silently and
note it in the final report — the Writer will initialize it on first use instead.

### 5e — Wire the SessionStart banner (terminal design on entry)

Copy the right script for the user's OS into the project:
- Windows → `templates/hooks/nirvana-banner.ps1` → `.claude/hooks/nirvana-banner.ps1`
- macOS/Linux → `templates/hooks/nirvana-banner.sh` → `.claude/hooks/nirvana-banner.sh` (make it
  executable: `chmod +x .claude/hooks/nirvana-banner.sh`)

Then wire it into `.claude/settings.json` as a `SessionStart` hook. This file may already exist
with unrelated hooks (e.g. other plugins) — **merge, never overwrite**:

1. If `.claude/settings.json` doesn't exist, create it with just the `hooks.SessionStart` block
   below.
2. If it exists, read it, and:
   - If `hooks.SessionStart` doesn't exist yet, add it.
   - If it exists as an array, APPEND a new entry to it — do not replace or remove existing
     entries.
   - Leave every other key in the file (`permissions`, `statusLine`, other hook events, etc.)
     completely untouched.

The hook entry to add (Windows):
```json
{
  "hooks": [
    {
      "type": "command",
      "command": "powershell -ExecutionPolicy Bypass -File \".claude/hooks/nirvana-banner.ps1\"",
      "shell": "powershell",
      "timeout": 10
    }
  ]
}
```

The hook entry to add (macOS/Linux):
```json
{
  "hooks": [
    {
      "type": "command",
      "command": "bash .claude/hooks/nirvana-banner.sh",
      "timeout": 10
    }
  ]
}
```

Pick the OS-appropriate command based on the platform this session is running on. The script
itself reads `.claude/state.json` and prints nothing if `preferences.entryBanner` is `false` —
so wiring the hook is safe even for users who turn the banner off later.

### 5f — Update ~/.claude/CLAUDE.md

Read `~/.claude/CLAUDE.md`. Find the section that defines agents (look for "Nirvana Agents",
"O Time", or a table with agent roles).

Replace that table with this generic Nirvana table (preserve all other content around it):

```markdown
## Nirvana Agents

| # | Role | Model | Action |
|---|------|-------|--------|
| 1 | Product Owner | opus | decides & approves, never implements |
| 2 | Tech Lead | opus | orients, breaks into tasks, decides viability |
| 3 | Architect | sonnet | designs structure — back + front |
| 4 | Dev Backend | sonnet | implements backend (see project CLAUDE.md) |
| 5 | Dev Frontend | sonnet | implements frontend/UI (see project CLAUDE.md) |
| 6 | Designer | sonnet | UX/UI, flows, visual guidelines |
| 7 | QA | sonnet | tests, validates acceptance criteria |
| 8 | Reader | haiku | read-only — maps the project, hands off to Writer |
| 9 | Writer | sonnet | sole writer of shared memory; indexes it in graphify |

Full specs: `templates/agents/<name>.md` in the Nirvana repo. Chain order, memory model
(graphify, shared — not per-agent files), and broker protocol: see the project's own
`CLAUDE.md`, inside the `NIRVANA:START`/`NIRVANA:END` block.
```

If the global CLAUDE.md does not exist: create it with just the Nirvana agent table above.

## STEP 6 — Show tutorial

Display exactly this in the terminal:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Nirvana is active.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  5 things to know:

  1. /bigtask [description]
     Runs the full 9-agent chain: PO → Reader → Writer → Tech Lead →
     Architect → Tech Lead → PO (approve) → Devs/Designer → QA → Writer → Broker.
     grill-me activates automatically. First question always becomes a
     business rule for the PO.
     Optional: /bigtask fix auth /agents backend,qa /context phase2

  2. /smalltask [description]
     Same chain, no grilling. Use for clear, unambiguous tasks.

  3. Caveman mode is active (full).
     To disable: type  stop caveman
     To change level: /caveman lite | full | ultra

  4. Memory is shared, not per-agent. The Writer documents everything into
     docs/knowledge/ and indexes it in graphify. Everyone else queries it
     with /graphify query — nobody else writes to it.

  5. Sprints and tasks live in docs/sprints/ and docs/tasks/ — one file
     each, created by the Tech Lead, approved by the PO, closed by the Writer.

  Bonus:
    - You only see the final result by default. Add /chat to any /bigtask or
      /smalltask to watch the agents hand off live, chat-style. Make it the
      default with preferences.chainVisibility: "visible" in state.json.
    - Every time you open this project, a Nirvana banner shows sprint/task
      status. Turn it off with preferences.entryBanner: false in state.json.

  Other commands:
    /karma   — status (agents, docs, sessions, last sync, graphify)
    /path    — view/hint config (.claude/state.json)
    /reflect — sync docs from graphify now

  Edit preferences: .claude/state.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
