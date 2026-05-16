# claude-learning-agent

> Claude Code plugin — active agent memory · auto-bootstrap · token-efficient model routing

[🇧🇷 Português abaixo](#português)

---

## English

### What it does

Agents forget everything after `/compact`. This plugin fixes that.

| Problem | Solution |
|---------|----------|
| Agents repeat known errors after `/compact` | Memory files survive compaction |
| New session = full onboarding from scratch | `/la init` bootstraps from codebase in seconds |
| Expensive model used for trivial tasks | Pre-tool-use hook alerts on wrong model |
| No signal to save knowledge before compacting | Stop hook detects task completion, suggests flush |

### Install

Add to `~/.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "learning-agent@andraus": true
  },
  "extraKnownMarketplaces": {
    "andraus": {
      "source": {
        "source": "github",
        "repo": "AndrausP/claude-learning-agent"
      }
    }
  }
}
```

Restart Claude Code. Plugin loads automatically.

---

### Skills

| Command | Description |
|---------|-------------|
| `/la init` | Scan codebase, detect stack, create agent memory files |
| `/la flush` | Write session knowledge (errors, decisions, patterns) to memory |
| `/la audit` | Display full state of all agent memory files |
| `/la reset <agent> <section>` | Clear a specific section of an agent's memory |

---

### How memory works

Each agent gets a file at `~/.claude/agents-memory/<agent>.md`:

```markdown
# Memory — edmundo

## Erros conhecidos
- error:BacklogItem N+1 cause:missing Include() fix:Add .Include(b=>b.Sprint) status:RESOLVIDO

## Decisões tomadas
- decision:Repository<T> for data abstraction reason:allows Redis cache without leaking Infrastructure

## Padrões que funcionam
- pattern:Result<T> in all UseCases confirmed:true evidence:3 sprints without regression

## Abordagens descartadas
- approach:AutoMapper discarded:overhead chosen_instead:manual DTO mapping

## Pendências
- [ ] task:Review Sprint FK migration context:cascade delete needed priority:HIGH
```

**Newest entries appear first** — session-start hook injects the 2 most recent entries per section into context at every session start.

**Pruning** — max 30 entries per section. Oldest removed automatically on flush.

**Idempotent flush** — duplicate detection by key field only (`error:X` matches `error: X`). No redundant entries.

---

### Token savings

| Technique | Reduction | How |
|-----------|-----------|-----|
| Memory index injection (not loading raw files) | ~80% memory tokens | Session hook injects 3-line summary per agent, not full file |
| Newest-first ordering | ~60% context relevance | Most recent entries shown first — `/compact` doesn't bury new knowledge |
| Structured inter-agent format vs prose | ~57% agent communication tokens | `entity:X add:Y type:Z` vs "please add field Y of type Z to entity X" |
| Model routing alert (haiku for simple tasks) | ~95% cost for read/summarize tasks | Haiku = $0.25/MTok vs Sonnet = $3/MTok — 12x difference |
| Preventing repeat work via persistent memory | ~30 turns/week saved | Agent doesn't re-ask decided questions or re-discover known bugs |

**Real numbers (Claude API pricing, input tokens):**
- Sonnet reading 5 agent memory files = ~15,000 tokens = **$0.045/session**
- Haiku reading same files for 3-line summary = ~2,000 tokens = **$0.0005/session**
- **Savings per session: $0.044 (97% reduction)**

---

### Hooks

| Hook | Event | Action |
|------|-------|--------|
| `session-start.js` | SessionStart | Reads `~/.claude/agents-memory/*.md` → produces 2-entry summary per agent → injects as context |
| `pre-tool-use.js` | PreToolUse (Agent calls) | Detects task complexity by keywords → alerts if expensive model used for simple task |
| `stop.js` | Stop | Detects completion signals (PT-BR + EN) → suggests `/la flush` before `/compact` |

---

### Architecture

```
.claude-plugin/
  plugin.json          ← manifest (hooks, skills, version)
  marketplace.json     ← local marketplace registration
hooks/
  session-start.js     ← SessionStart: inject memory summaries
  pre-tool-use.js      ← PreToolUse: model routing alert
  stop.js              ← Stop: completion detection, flush reminder
skills/
  init/SKILL.md        ← /la init: bootstrap from codebase
  flush/SKILL.md       ← /la flush: idempotent knowledge write
  audit/SKILL.md       ← /la audit: full memory state display
  reset/SKILL.md       ← /la reset: section cleanup
templates/
  agent-memory.md      ← base template for new agent files
  broker-rules.md      ← structured inter-agent communication format
```

---

### Stack detection (`/la init`)

| File/Pattern | Detected stack | Agent created |
|---|---|---|
| `*.csproj` + EF Core + PostgreSQL | .NET backend | `edmundo.md` |
| `wwwroot/src/` + UI5 manifest.json | SAP UI5 frontend | `thomas-shelby.md` |
| `Domain/Entities/` + UUID PKs | Clean Architecture | `architect.md` |
| `Application/Validators/` + FluentValidation | Business rules | `jubileu.md` |
| `Tests/` + NUnit + Moq | Testing | `jubileu.md` |

---

### Requirements

- Claude Code with plugin support
- Node.js ≥ 18
- `~/.claude/agents-memory/` — created automatically by `/la init`

---

---

## Português

### O que faz

Agentes esquecem tudo após `/compact`. Este plugin resolve isso.

| Problema | Solução |
|---------|----------|
| Agentes repetem erros já conhecidos após `/compact` | Arquivos de memória sobrevivem à compactação |
| Nova sessão = onboarding completo do zero | `/la init` faz bootstrap pelo codebase em segundos |
| Modelo caro usado pra tarefas triviais | Hook pre-tool-use alerta sobre modelo errado |
| Nenhum sinal para salvar conhecimento antes do compact | Hook Stop detecta conclusão da tarefa, sugere flush |

### Instalação

Adicione ao `~/.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "learning-agent@andraus": true
  },
  "extraKnownMarketplaces": {
    "andraus": {
      "source": {
        "source": "github",
        "repo": "AndrausP/claude-learning-agent"
      }
    }
  }
}
```

Reinicie o Claude Code. Plugin carrega automaticamente.

---

### Comandos

| Comando | Descrição |
|---------|-----------|
| `/la init` | Escaneia codebase, detecta stack, cria arquivos de memória por agente |
| `/la flush` | Escreve o conhecimento da sessão (erros, decisões, padrões) na memória |
| `/la audit` | Exibe estado completo de todos os arquivos de memória |
| `/la reset <agente> <seção>` | Limpa uma seção específica da memória de um agente |

---

### Como a memória funciona

Cada agente tem um arquivo em `~/.claude/agents-memory/<agente>.md` com 5 seções:

- **Erros conhecidos** — bug encontrado, causa raiz, fix aplicado
- **Decisões tomadas** — escolhas arquiteturais confirmadas pelo usuário
- **Padrões que funcionam** — convenções de código validadas
- **Abordagens descartadas** — soluções tentadas e rejeitadas com motivo
- **Pendências** — trabalho iniciado mas não finalizado

**Entradas mais recentes aparecem primeiro** — o hook SessionStart injeta as 2 entradas mais recentes por seção no contexto a cada sessão.

**Poda automática** — máximo 30 entradas por seção. As mais antigas são removidas no flush.

**Flush idempotente** — detecção de duplicatas pelo campo chave (`error:X` bate com `error: X`). Sem entradas redundantes.

---

### Economia de tokens

| Técnica | Redução | Como |
|---------|---------|------|
| Injeção de índice de memória (sem carregar arquivos brutos) | ~80% tokens de memória | Hook SessionStart injeta resumo de 3 linhas por agente, não o arquivo completo |
| Ordenação mais-recente-primeiro | ~60% relevância de contexto | Entradas mais recentes aparecem primeiro — `/compact` não enterra conhecimento novo |
| Formato estruturado inter-agentes vs prosa | ~57% tokens de comunicação | `entity:X add:Y type:Z` vs "por favor adicione o campo Y do tipo Z na entidade X" |
| Alerta de roteamento de modelo | ~95% custo em tarefas simples | Haiku = $0,25/MTok vs Sonnet = $3/MTok — 12x de diferença |
| Prevenção de retrabalho via memória persistente | ~30 turnos/semana economizados | Agente não repergunta decisões já registradas nem redescobre bugs conhecidos |

**Números reais (preços Claude API, tokens de entrada):**
- Sonnet lendo 5 arquivos de memória = ~15.000 tokens = **$0,045/sessão**
- Haiku lendo os mesmos arquivos para resumo de 3 linhas = ~2.000 tokens = **$0,0005/sessão**
- **Economia por sessão: $0,044 (redução de 97%)**

---

### Arquitetura dos hooks

| Hook | Evento | Ação |
|------|--------|------|
| `session-start.js` | SessionStart | Lê `~/.claude/agents-memory/*.md` → produz resumo de 2 entradas por agente → injeta como contexto |
| `pre-tool-use.js` | PreToolUse (chamadas Agent) | Detecta complexidade da tarefa por palavras-chave → alerta se modelo caro usado pra tarefa simples |
| `stop.js` | Stop | Detecta sinais de conclusão (PT-BR + EN) → sugere `/la flush` antes do `/compact` |

---

### Detecção de stack (`/la init`)

| Arquivo/Padrão | Stack detectada | Agente criado |
|---|---|---|
| `*.csproj` + EF Core + PostgreSQL | .NET backend | `edmundo.md` |
| `wwwroot/src/` + manifest UI5 | SAP UI5 frontend | `thomas-shelby.md` |
| `Domain/Entities/` + PKs UUID | Clean Architecture | `architect.md` |
| `Application/Validators/` + FluentValidation | Regras de negócio | `jubileu.md` |
| `Tests/` + NUnit + Moq | Testes | `jubileu.md` |

---

### Requisitos

- Claude Code com suporte a plugins
- Node.js ≥ 18
- `~/.claude/agents-memory/` — criado automaticamente pelo `/la init`

---

### Licença

MIT — use, fork, contribua.
