---
name: init
description: >
  Bootstrap learning-agent in current project. Reads codebase, detects stack,
  creates or merges agent memory files in ~/.claude/agents-memory/.
  Use when starting in a new project, after major refactor, or when agents-memory/ is empty.
  Trigger: /la init, "bootstrap agents", "setup learning-agent".
---

Bootstrap learning-agent for this project. Follow these steps exactly:

## Step 1 — Detect stack

Use Glob to scan project structure:
- `**/*.csproj` → .NET backend
- `**/wwwroot/**/*.js` or `**/manifest.json` (SAP UI5 pattern) → frontend
- `**/Domain/Entities/**` → Clean Architecture
- `**/Application/Validators/**` → FluentValidation
- `**/*Tests*/**` or `**/*.Test*/**` → testing layer
- `**/Migrations/**` → database migrations
- `**/Redis*` or `**/IDistributedCache*` → Redis cache

Read 2-3 sample files per detected layer to identify:
- Naming conventions (PascalCase, camelCase)
- Patterns in use (Repository<T>, Result<T>, DTOs, etc.)
- Libraries (EF Core, FluentValidation, NUnit, Moq, etc.)
- Architecture violations if any

## Step 2 — Map agents needed

| Detection | Agent | Model |
|-----------|-------|-------|
| .NET backend detected | edmundo | sonnet |
| SAP UI5 detected | thomas-shelby | sonnet |
| Clean Architecture detected | architect | haiku |
| Tests detected | jubileu | sonnet |
| Complex domain (>10 entities) | jhalim | haiku |

## Step 3 — Create or MERGE memory files

For each agent needed, check if `~/.claude/agents-memory/<agent>.md` exists:

**If file does NOT exist:** create from template (see templates/agent-memory.md).

**If file EXISTS (MERGE — never overwrite):**
- Read existing file
- Identify which sections exist
- Add only missing sections
- Append detected patterns to "Padrões que funcionam" if not already present
- Never remove existing entries

Memory file path: `C:\Users\<user>\.claude\agents-memory\<agent>.md`
On Windows: use `$env:USERPROFILE\.claude\agents-memory\`

## Step 4 — Populate patterns from code

For each agent created/updated, populate "Padrões que funcionam" with patterns detected in code:

Format: `pattern:X confirmed:true evidence:Y`

Examples from detection:
- `pattern:Repository<T> para acesso de dados confirmed:true evidence:N repositórios implementam interface`
- `pattern:Result<T> em UseCases confirmed:true evidence:todos os use cases retornam Result<T>`
- `pattern:DTOs não são entidades confirmed:true evidence:controllers retornam DTOs, não entities`

## Step 5 — Verify hooks are registered (plugin system handles this automatically)

The plugin is loaded via `enabledPlugins` in `~/.claude/settings.json`.
Hooks are declared in `.claude-plugin/plugin.json` using `${CLAUDE_PLUGIN_ROOT}` — the plugin system resolves this automatically.
Do NOT manually add hooks to settings.json — they are already registered by the plugin system.

Only report if hooks appear missing after restart.

## Step 6 — Report

Output summary:
```
LEARNING-AGENT INIT COMPLETE
Stack detectado: [list]
Agentes criados: [list]
Agentes mesclados: [list]
Padrões detectados: N
Próximo passo: execute /la audit para revisar o estado
```
