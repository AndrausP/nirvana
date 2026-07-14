---
name: law
description: Add an explicit business rule to docs/knowledge/business-rules.md (Product Owner's source of truth, indexed by graphify). Use when you know a rule upfront and don't want to wait for /bigtask to capture it.
---

You are executing /law. Arguments contain the business rule to register.

## Parse input

The argument is the business rule text. Examples:
- `/law payment can only be made by verified users`
- `/law workspace names must be unique per owner`
- `/law deleted items are soft-deleted, never hard-deleted`

## Register the rule

This is a Writer action — the Product Owner owns the decision, the Writer persists it.

Read `docs/knowledge/business-rules.md`. If it doesn't exist, create it from
`templates/docs/knowledge/business-rules.md`.

Append to the `## Regras explícitas` section:

```
- [YYYY-MM-DD] [RULE_TEXT]
  Source: explicit (/law command)
```

After writing, reindex: run `/graphify docs/knowledge --update` (skip silently if graphify is
unavailable, note it in the confirmation).

## Confirm

Tell the user:

```
Regra registrada:
"[RULE_TEXT]"

Product Owner vai validar tasks futuras contra essa regra. Writer indexou no graphify.
Total de regras explícitas: N
```
