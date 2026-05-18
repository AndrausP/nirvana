---
name: gaze
description: >
  THE GAZE — Reveal full state of all agent memory files and project codex.
  Shows what each agent knows: errors, decisions, patterns, pending tasks.
  Use before starting a new task or to review accumulated knowledge.
  Trigger: /gaze, "agent memory status", "o que os agentes sabem", "reveal knowledge".
---

**THE GAZE — the oracle reveals all accumulated knowledge.**

## Step 1 — Encontrar todos os arquivos de memória

Ler todos os arquivos em `~/.claude/agents-memory/`.
Se vazio ou ausente → report:
```
⚔ THE GAZE — NOTHING TO REVEAL
Execute /invoke primeiro para invocar os agentes.
```

## Step 2 — Exibir por agente

Para cada arquivo:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔ AGENTE: <name>
Última sessão: <data do arquivo ou "nunca">
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ERROS CONHECIDOS (<N>):
  • <entrada>

DECISÕES TOMADAS (<N>):
  • <entrada>

PADRÕES QUE FUNCIONAM (<N>):
  • <entrada>

ABORDAGENS DESCARTADAS (<N>):
  • <entrada>

PENDÊNCIAS (<N>):
  • <entrada>
```

Seção vazia → `  (vazio)`

## Step 3 — Verificar codex de documentação

Checar se `docs/` existe no projeto atual:
- `docs/architecture.md` existe? → mostrar última linha de atualização
- `docs/learned-errors.md` existe? → contar erros registrados
- `docs/pr-summary.md` existe? → mostrar último registro de data
- `docs/modules.md` existe? → contar módulos documentados

Se `docs/` não existe → sugerir `/forge`.

## Step 4 — Resumo

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔ THE GAZE — SUMMARY
Total agentes    : N
Erros conhecidos : N
Pendências abertas: N
Última inscrição : <data mais recente>
Codex docs       : [completo / parcial / ausente]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/inscribe   → selar conhecimento da sessão atual
/obliterate → purgar seção específica de um agente
/chronicle  → atualizar codex de documentação
```
