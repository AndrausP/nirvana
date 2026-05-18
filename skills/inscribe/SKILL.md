---
name: inscribe
description: >
  THE INSCRIPTION — Seal current session knowledge into agent memory files.
  Extracts errors, decisions, patterns, discarded approaches from this session.
  Idempotent — skips duplicate entries. Run before /compact or end of work.
  Trigger: /inscribe, "seal memory", "salvar memória", "inscribe knowledge".
---

**THE INSCRIPTION — seal what was learned into the eternal tomes.**

## Step 1 — Identificar agentes ativos

Listar quais agentes foram usados nesta conversa (ver chamadas Agent tool no histórico).
Se nenhum agente usado → verificar se Claude mesmo fez trabalho relevante sem subagentes.
Se zero atividade relevante → report "Nenhum conhecimento para selar nesta sessão." e parar.

## Step 2 — Extrair conhecimento por agente

Para cada agente ativo, extrair desta conversa:

**Erros encontrados** (`error:X cause:Y fix:Z status:RESOLVIDO|PENDENTE`):
- Bug identificado, causa raiz encontrada, fix aplicado
- Erros de compilação, falhas de validação, violações arquiteturais

**Decisões tomadas** (`decision:X reason:Y`):
- Escolhas arquiteturais confirmadas pelo usuário
- Seleção de biblioteca/padrão
- Qualquer coisa explicitamente aprovada

**Padrões confirmados** (`pattern:X confirmed:true evidence:Y`):
- Padrões de código validados nesta sessão
- Convenções confirmadas como corretas

**Abordagens descartadas** (`approach:X discarded:reason chosen_instead:Y`):
- Soluções tentadas e rejeitadas com motivo

**Pendências** (`[ ] task:X context:Y priority:HIGH|MEDIUM|LOW`):
- Trabalho iniciado mas não finalizado
- Decisões adiadas

## Step 3 — Selar nos arquivos de memória (IDEMPOTENTE + PRUNING)

Para cada agente, ler `~/.claude/agents-memory/<agent>.md`.

### Idempotência
Antes de cada entrada, checar campo CHAVE:
- `error:X ...` → comparar só X
- `decision:X ...` → comparar só X
- `pattern:X ...` → comparar só X
- Case-insensitive, ignorar espaços extras
- Já existe → SKIP

### Posição (NEWEST FIRST)
Inserir no TOPO da seção (logo após `## Seção`). Nunca no final.

### Pruning
Após inserir: se seção > 30 entradas → remover as mais antigas (do final) até 30.

### Formato
```
- error:BacklogItem N+1 cause:missing Include() fix:Add .Include(b=>b.Sprint) status:RESOLVIDO
- decision:Repository<T> reason:permite cache Redis sem vazar Infrastructure
- pattern:Result<T> em UseCases confirmed:true evidence:todos use cases seguem padrão
```

## Step 4 — Relatório

```
⚔ THE INSCRIPTION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agente: edmundo
  ✦ 2 erros selados
  ✦ 1 decisão gravada
  ✦ 0 duplicatas ignoradas
Agente: architect
  ✦ 1 padrão confirmado
  ✦ 1 pendência registrada
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/chronicle → atualizar também o codex de documentação
/gaze      → revelar todo conhecimento acumulado
```
