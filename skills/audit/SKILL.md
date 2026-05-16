---
name: audit
description: >
  Display current state of all agent memory files. Shows what each agent knows,
  pending tasks, known errors, and decisions made. Use to review accumulated knowledge
  or before starting a new task.
  Trigger: /la audit, "agent memory status", "o que os agentes sabem".
---

Display full state of all agent memory files.

## Step 1 — Find all memory files

Read all files in `~/.claude/agents-memory/`.
If directory empty or missing: report "Nenhuma memória de agente encontrada. Execute /la init primeiro."

## Step 2 — Display per agent

For each file, display in this format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AGENTE: <name> (model: <haiku|sonnet|opus>)
Última sessão: <date from file or "nunca">
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ERROS CONHECIDOS (<count>):
  • <entry>
  
DECISÕES TOMADAS (<count>):
  • <entry>

PADRÕES (<count>):
  • <entry>

DESCARTADOS (<count>):
  • <entry>

PENDÊNCIAS (<count>):
  • <entry>
```

If a section is empty, show: `  (vazio)`

## Step 3 — Summary

After all agents:
```
RESUMO
Total agentes: N
Total erros conhecidos: N
Total pendências abertas: N
Última atualização: <most recent date>

Comandos disponíveis:
  /la flush  — salvar conhecimento da sessão atual
  /la reset <agente> <seção>  — limpar seção específica
```
