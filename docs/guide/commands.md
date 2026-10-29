# Commands

[← Back to README](../../README.md) · [How it works](how-it-works.md) · [Configuration](configuration.md)

---

## `/light`
Initialize Nirvana for the current project. Run once. Re-run to update configuration — only the
Nirvana-owned block inside your `CLAUDE.md` gets regenerated, everything else is preserved.

```
/light
```

What it does, step by step: [Configuration → Setting up a project](configuration.md#setting-up-a-project).

## `/bigtask`
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
- `/chat` — print each agent's handoff live for this run

## `/smalltask`
For clear, unambiguous tasks. No grilling. Still runs the chain, just without the interview.

```
/smalltask fix null check in UserService
/smalltask add loading spinner to dashboard
```

Accepts `/chat` too.

## `/reflect`
Force an immediate doc sync from the shared graphify-indexed knowledge base. Useful before a
sprint review or when docs are stale. It also runs automatically: every `sync.every` sessions
the entry banner asks Claude to run it, and running it resets the session counter.

```
/reflect
```

## `/law`
Register an explicit business rule directly into `docs/knowledge/business-rules.md`. The
Product Owner validates all future tasks against it.

```
/law payment can only be made by verified users
/law workspace names must be unique per owner
/law deleted records are soft-deleted, never hard-deleted
```

## `/karma`
Full system status — 9 agents, sessions, docs, last sync, graphify status, open sprints/tasks.

```
/karma
```

## `/path`
Show current config from `.claude/state.json` in a readable format.

```
/path
```
