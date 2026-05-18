---
name: law
description: Add an explicit business rule to the Business Analyst's memory. Use when you know a rule upfront and don't want to wait for /bigtask to capture it.
---

You are executing /law. Arguments contain the business rule to register.

## Parse input

The argument is the business rule text. Examples:
- `/law payment can only be made by verified users`
- `/law workspace names must be unique per owner`
- `/law deleted items are soft-deleted, never hard-deleted`

## Register the rule

Read `~/.claude/agents-memory/business-analyst.md`.

Append to the `## Business Rules` section:

```
- [YYYY-MM-DD] [RULE_TEXT]
  Source: explicit (/law command)
```

If the file doesn't exist, create it:
```markdown
---
agent: business-analyst
---

## Business Rules

- [YYYY-MM-DD] [RULE_TEXT]
  Source: explicit (/law command)

## Inferred Rules

None yet.
```

## Confirm

Tell the user:

```
Rule registered:
"[RULE_TEXT]"

Business Analyst will validate future tasks against this rule.
Total explicit rules: N
```
