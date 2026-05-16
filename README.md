# claude-learning-agent

Claude Code plugin that gives agents persistent active memory, automatic project bootstrap, and token-efficient model routing.

## What it does

- **Active memory** — agents write errors, decisions, and patterns to memory files during sessions. Knowledge survives `/compact` and session restarts.
- **Auto-bootstrap** — `/la init` reads your codebase, detects stack, and creates pre-populated agent memory files automatically.
- **Model routing** — alerts when an expensive model (sonnet/opus) is used for a simple task that haiku handles at 20x lower cost.
- **Flush reminder** — detects task completion and reminds you to save session knowledge before compacting.

## Install

Add to your `~/.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "learning-agent@andraus": true
  },
  "extraKnownMarketplaces": {
    "andraus": {
      "source": {
        "source": "github",
        "repo": "andrausfelipe/claude-learning-agent"
      }
    }
  }
}
```

Restart Claude Code. The plugin loads automatically.

## Skills

| Command | Description |
|---------|-------------|
| `/la init` | Scan codebase, detect stack, create agent memory files |
| `/la flush` | Write session knowledge (errors, decisions, patterns) to memory |
| `/la audit` | Display full state of all agent memory files |
| `/la reset <agent> <section>` | Clear a specific section of an agent's memory |

## How memory works

Each agent has a file at `~/.claude/agents-memory/<agent>.md`:

```
## Erros conhecidos
- error:N+1 in BacklogItem cause:missing Include() fix:Add .Include() status:RESOLVIDO

## Decisões tomadas
- decision:Repository<T> for data abstraction reason:allows Redis cache without leaking Infrastructure

## Padrões que funcionam
- pattern:Result<T> in all UseCases confirmed:true

## Abordagens descartadas
- approach:AutoMapper discarded:overhead chosen_instead:manual DTO mapping

## Pendências
- [ ] task:Review Sprint FK migration priority:HIGH
```

**Newest entries appear first** — session-start hook always injects the most recent knowledge into context.

**Pruning** — max 30 entries per section. Oldest entries removed automatically on flush.

## Token savings

| Technique | Reduction |
|-----------|-----------|
| Memory index (not loading all files) | ~80% memory tokens |
| Structured inter-agent format vs prose | ~57% agent comm tokens |
| Model routing (haiku for simple tasks) | ~95% cost for read/summarize tasks |
| Active memory prevents repeat work | ~30 turns/week saved |

## Requirements

- Claude Code with plugin support
- Node.js (for hooks)
- `~/.claude/agents-memory/` directory (created automatically by `/la init`)

## Architecture

```
hooks/
  session-start.js   ← reads agent memory, injects summaries at session start
  pre-tool-use.js    ← intercepts Agent calls, alerts on wrong model
  stop.js            ← detects task completion, suggests /la flush
skills/
  init/SKILL.md      ← /la init: bootstrap from codebase
  flush/SKILL.md     ← /la flush: idempotent knowledge write
  audit/SKILL.md     ← /la audit: memory state display
  reset/SKILL.md     ← /la reset: section cleanup
templates/
  agent-memory.md    ← base template for new agent files
  broker-rules.md    ← inter-agent communication format
```
