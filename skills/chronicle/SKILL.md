---
name: chronicle
description: >
  THE CHRONICLE — Update the project docs codex AND agent memories from current session.
  Updates architecture.md, learned-errors.md, pr-summary.md, modules.md with new knowledge.
  Also seals agent memories (like /inscribe but also writes to docs/).
  Run after implementing a feature, fixing bugs, or making architectural decisions.
  Trigger: /chronicle, /remember, "atualizar docs", "update docs", "chronicle this session".
---

**THE CHRONICLE — record this session's knowledge into the eternal codex.**

## Step 1 — Verificar pré-condições

Checar em paralelo:
- `~/.claude/agents-memory/` existe e tem arquivos? → se não → avisar e continuar
- `docs/` existe no projeto atual? → se não → perguntar "docs/ não existe. Executar /forge primeiro ou criar agora?"
  - "criar agora" → executar Step 0-2 do skill `/forge` antes de continuar
  - "cancelar" → parar

---

## Step 2 — Extrair conhecimento da sessão atual

Analisar esta conversa e extrair:

### Para agent memories (igual ao /inscribe):
**Erros** (`error:X cause:Y fix:Z status:RESOLVIDO|PENDENTE`)
**Decisões** (`decision:X reason:Y`)
**Padrões** (`pattern:X confirmed:true evidence:Y`)
**Descartados** (`approach:X discarded:reason chosen_instead:Y`)
**Pendências** (`[ ] task:X context:Y priority:HIGH|MEDIUM|LOW`)

### Para docs:
**Mudanças técnicas desta sessão** — o que foi implementado, refatorado, corrigido.
**Novos erros aprendidos** — bugs encontrados e resolvidos.
**Decisões de módulo** — o que cada módulo faz, regras de negócio esclarecidas.
**Impacto arquitetural** — se a arquitetura mudou de alguma forma.

---

## Step 3 — Selar agent memories (mesma lógica do /inscribe)

Para cada agente ativo, ler `~/.claude/agents-memory/<agent>.md` e inserir entradas:
- Idempotente: checar campo chave antes de inserir — skip se duplicata
- Newest first: inserir no TOPO de cada seção
- Pruning: max 30 entradas por seção

---

## Step 4 — Atualizar docs/

### docs/learned-errors.md
Para cada erro NOVO desta sessão (não duplicata):
Acrescentar no TOPO da seção "Erros registrados":
```
[<DATA HOJE>] | <agente> | error:<X> | cause:<Y> | fix:<Z> | status:<STATUS>
```

### docs/pr-summary.md
Se houve mudanças técnicas relevantes nesta sessão, acrescentar entrada no TOPO:
```
### [<DATA HOJE>] — <título da mudança principal>
**Tipo**: feat | fix | refactor | chore
**Agente**: <quem implementou>
**Mudanças técnicas**:
- <lista das mudanças>
**Impacto**: <o que pode ter sido afetado>
```
Se sessão foi só conversa sem implementação → NÃO adicionar entrada ao pr-summary.

### docs/architecture.md
Se houve mudança arquitetural (novo padrão, nova camada, nova decisão estrutural):
- Atualizar seção relevante
- Adicionar nota `> Atualizado em <data>: <mudança>`

### docs/modules.md
Se um módulo foi criado, modificado ou suas regras de negócio foram esclarecidas:
- Atualizar seção do módulo correspondente
- Adicionar ou corrigir regras de negócio

---

## Step 5 — Relatório

```
⚔ THE CHRONICLE — SESSION RECORDED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATA: <hoje>

AGENT MEMORIES SELADAS:
  edmundo    → ✦ 2 erros  ✦ 1 decisão  ✦ 0 dupl.
  architect  → ✦ 1 padrão ✦ 1 pendência

CODEX ATUALIZADO:
  ✦ docs/pr-summary.md     → 1 entrada adicionada
  ✦ docs/learned-errors.md → 2 erros registrados
  ✦ docs/architecture.md   → sem mudanças
  ✦ docs/modules.md        → sem mudanças
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/gaze → revisar estado completo após chronicle
```
