---
name: flush
description: >
  Write current session knowledge to agent memory files. Extracts errors found,
  decisions made, patterns confirmed, and approaches discarded during this session.
  Run before /compact or end of day. Idempotent — skips duplicate entries.
  Trigger: /la flush, "flush memory", "save agent knowledge", "salvar memória".
---

Flush current session knowledge to agent memory files. Follow these steps:

## Step 1 — Identify active agents

List which agents were used in this conversation (look at Agent tool calls in history).
If no agents were used, report "Nenhum agente ativo nesta sessão" and stop.

## Step 2 — Extract knowledge per agent

For each active agent, extract from this conversation:

**Errors found** (format: `error:X cause:Y fix:Z status:RESOLVIDO|PENDENTE`):
- Any bug identified, root cause found, or fix applied
- EF Core issues, validation failures, architectural violations

**Decisions made** (format: `decision:X reason:Y`):
- Architectural choices confirmed
- Library/pattern selections
- Things the user explicitly approved or decided

**Patterns confirmed** (format: `pattern:X confirmed:true evidence:Y`):
- Code patterns validated in this session
- Conventions confirmed as correct

**Approaches discarded** (format: `approach:X discarded:reason chosen_instead:Y`):
- Solutions tried and rejected with reason
- Architectures considered but not adopted

**Pending tasks** (format: `[ ] task:X context:Y priority:HIGH|MEDIUM|LOW`):
- Work started but not finished
- Decisions deferred for later

## Step 3 — Write to memory files (IDEMPOTENTE + PRUNING)

For each agent, read existing `~/.claude/agents-memory/<agent>.md`.

### Idempotência
Before writing each entry, check for duplicates by comparing the KEY FIELD only:
- For `error:X ...` → compare only the X part (after `error:`, before next field)
- For `decision:X ...` → compare only the X part
- For `pattern:X ...` → compare only the X part
- Comparison: case-insensitive, ignore extra spaces
- If key field already exists in section: SKIP

This prevents near-duplicates like `error:N+1` and `error: N+1` from both being added.

### Posição de inserção (NEWEST FIRST)
Insert new entries at the TOP of the section (immediately after the `## Section` header line).
NOT at the bottom. This ensures session-start.js always shows the most recent entries in context.

### Pruning de seção
After inserting, count entries in that section.
If count > 30: remove the OLDEST entries (at the bottom) until count = 30.
This prevents unbounded growth — max 30 entries per section per agent.

### Formato
```
- error:BacklogItem N+1 cause:missing Include() fix:Add .Include(b=>b.Sprint) status:RESOLVIDO
```

## Step 4 — Report

```
LEARNING-AGENT FLUSH COMPLETE
Agente: edmundo
  + 2 erros registrados
  + 1 decisão registrada  
  + 0 duplicatas puladas
Agente: architect
  + 1 padrão confirmado
  + 1 pendência registrada
```
