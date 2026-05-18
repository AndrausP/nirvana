---
name: bigtask
description: Large task execution with automatic grill-me. First question captures the business rule for the Business Analyst. Use for features, refactors, or anything with architectural impact.
---

You are executing a /bigtask. Arguments contain the task description and optional flags.

## Parse the input

From the arguments, extract:
- `TASK_DESCRIPTION`: the main task text
- `AGENTS`: optional `/agents` flag (e.g., `/agents backend,qa`) — if absent, broker decides
- `CONTEXT`: optional `/context` flag (e.g., `/context phase4`) — additional context hint

## Pre-step: read relevant agent memories (use haiku)

Based on the task description, identify which agents are likely involved.
Read their memory files and produce a 2-3 line summary for each:
- `~/.claude/agents-memory/backend-dev.md`
- `~/.claude/agents-memory/frontend-dev.md` (if UI involved)
- `~/.claude/agents-memory/qa.md`
- `~/.claude/agents-memory/business-analyst.md`
- `~/.claude/agents-memory/architect.md` (if exists)

Also read `.claude/state.json` to understand project context and active agent specialties.

## Activate grill-me — first question is ALWAYS the business rule

Before any other grill-me question, ask:

"What is the business rule for this task? (This will be stored for the Business Analyst)"

Wait for the answer. Save this rule to `~/.claude/agents-memory/business-analyst.md`:
- If the answer is a clear rule: append to "## Business Rules" section with today's date and task reference
- If vague or unknown: append to "## Inferred Rules" marked as `[pending-clarification]`

## Continue with grill-me

After capturing the business rule, proceed with the full grill-me interview about the task:
- Walk down each branch of the design tree
- Ask questions one at a time
- Provide your recommended answer for each
- Resolve dependencies between decisions
- Stop when shared understanding is reached

## After grill-me: execute with broker

Once grill-me completes, route the task through the broker:

1. **Architect/haiku** — structural impact, layers affected, contracts needed
2. **Business Analyst/haiku** — validate against known business rules
3. **Backend Dev or Frontend Dev** — implementation plan
4. **QA** — risks, edge cases, test strategy

Compress each agent's output before passing to the next.

## End of turn

Always close with:

```
## Team Conclusion
[consolidated summary]

## Session Checklist
- [x] [completed items]
- [ ] [pending items]

## Pending Decision
[what the user needs to decide — or "None"]
```

Update relevant agent memory files with key decisions and context from this session.
