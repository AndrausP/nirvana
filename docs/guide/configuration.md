# Configuration

[← Back to README](../../README.md) · [How it works](how-it-works.md) · [Commands](commands.md)

---

## Installing

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

## Updating

**Windows — run in PowerShell:**
```powershell
iwr -useb https://raw.githubusercontent.com/AndrausP/nirvana/main/update.ps1 | iex
```

**macOS / Linux — run in terminal:**
```bash
curl -fsSL https://raw.githubusercontent.com/AndrausP/nirvana/main/update.sh | bash
```

The updater:
1. Checks Nirvana is actually installed (refuses and points to the installer if not)
2. Shows the installed version vs. the latest (`~/.claude/nirvana-templates/.nirvana-version`)
3. Re-downloads all 7 skills and every template, overwriting the global copies
4. Records the new version

Projects already configured keep working as-is — to refresh a project's Nirvana block
(`CLAUDE.md`, hooks), open it in Claude Code and re-run `/light` after updating.

## Setting up a project

After installing, open Claude Code inside **any project** and run `/light`. Nirvana will:
1. Detect your project stack (reads folder structure and key files only — no full code scan)
2. Read your existing `CLAUDE.md` and merge the broker protocol directly into it — between
   markers, nothing else touched. No separate `BEHAVIOR.md`, no `@import`.
3. Show you exactly what it's about to do and ask for confirmation
4. Ask 2 questions: sync frequency and compact threshold
5. Create `docs/` (architecture, modules, decisions, sprints/, tasks/, knowledge/) and
   initialize graphify over `docs/knowledge/`
6. Wire a `SessionStart` hook into `.claude/settings.json` that shows sprint/task status every
   time you open the project, counts sessions for the automatic `/reflect`, and reminds the
   Writer after a compaction — merged in, any existing hooks stay untouched
7. Apply your compact threshold through the `env` block of `.claude/settings.json`
8. Show a tutorial

## Token saving

Nirvana saves tokens two ways:

**1. Caveman mode** — active by default. Drops filler words, keeps full technical substance.
- Disable: type `stop caveman`
- Change level: `/caveman lite` | `/caveman full` | `/caveman ultra`

**2. Smart compaction** — when context exceeds your threshold:
1. Claude Code auto-compacts at `compact.threshold`% — `/light` applies it as
   `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` in `.claude/settings.json` (or `DISABLE_AUTO_COMPACT` when
   you pick "Disabled"). The override can only make compaction happen earlier than Claude Code's
   default, never later.
2. Right after compacting, the `SessionStart` hook tells the Writer to record in
   `docs/knowledge/` whatever the session decided or learned and is still undocumented (the
   compaction summary still has it), then reindex graphify. Claude Code has no hook that lets
   the model act *before* compacting, so this happens immediately after.
3. Memory stays queryable via graphify.

Both are configured with `/light`. After editing `compact.*` in `.claude/state.json` by hand,
re-run `/light` so the `env` in `.claude/settings.json` follows.

## Files created by `/light`

**In your project:**
```
your-project/
├── CLAUDE.md                     ← Nirvana block merged in, between NIRVANA:START/END markers
├── .claude/
│   ├── state.json                ← Nirvana config (edit freely)
│   ├── state.local.json          ← session counter, per machine (added to .gitignore)
│   ├── settings.json             ← SessionStart hook + compact env merged in (existing keys preserved)
│   └── hooks/
│       └── nirvana-banner.ps1    ← or .sh on macOS/Linux
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

## `.claude/state.json` reference

Edit `.claude/state.json` directly to change any preference:

```jsonc
{
  "nirvana": "2.1.0",
  "sync": {
    "every": 5,           // sessions between auto doc syncs
    "lastSync": null      // managed by Nirvana — don't edit
  },
  "compact": {
    "auto": true,         // enable auto-compact (false = DISABLE_AUTO_COMPACT)
    "threshold": 70       // compact when context > 70% — re-run /light after changing
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

## Uninstalling

There is no uninstaller yet. To remove Nirvana by hand:

**From the machine:**
- Delete `~/.claude/skills/{light,bigtask,smalltask,reflect,law,path,karma}/`
- Delete `~/.claude/nirvana-templates/`
- Remove the `## Nirvana Agents` section from `~/.claude/CLAUDE.md`

**From a project:**
- Remove the block between `<!-- NIRVANA:START` and `<!-- NIRVANA:END -->` in `CLAUDE.md`
- Remove the `nirvana-banner` entry under `hooks.SessionStart` and the
  `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` / `DISABLE_AUTO_COMPACT` keys under `env` in
  `.claude/settings.json`
- Delete `.claude/hooks/nirvana-banner.*`, `.claude/state.json` and `.claude/state.local.json`
- `docs/` is your project's documentation now — keep it or delete it
