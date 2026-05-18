---
name: forge
description: >
  THE FORGING — Create the project documentation codex in docs/ folder.
  Creates architecture.md, learned-errors.md, pr-summary.md, modules.md.
  Pre-populated with knowledge from agent memories and codebase scan.
  Run once per project, then use /chronicle to keep it updated.
  Trigger: /forge, "criar documentação", "create docs", "forge the codex".
---

**THE FORGING — craft the living codex of this project.**

## Step 0 — Verificações

Checar se `docs/` já existe no projeto atual (cwd):
- Existe → perguntar ao usuário: "docs/ já existe. Sobrescrever, mesclar, ou cancelar?"
  - Sobrescrever: recriar todos os arquivos
  - Mesclar: adicionar só o que está faltando
  - Cancelar: parar

Checar se `~/.claude/agents-memory/` tem arquivos:
- Vazio → avisar "Execute /invoke primeiro para ter contexto rico nos docs."
- Continue mesmo assim — criar docs com o que for possível inferir do codebase.

---

## Step 1 — Coletar informações

### 1a — Ler memórias dos agentes
Ler todos os arquivos em `~/.claude/agents-memory/`.
Extrair: stack, padrões, decisões, erros conhecidos, pendências.

### 1b — Scan de codebase (só configs)
Rodar em paralelo:
- `**/*.csproj` → projetos .NET
- `**/*.sln` → solução
- `**/package.json` → frontend
- `**/*Domain*/*.csproj` → camadas

Ler todos os `.csproj` encontrados para extrair pacotes.

### 1c — Ler CLAUDE.md se existir
Se `CLAUDE.md` existe na raiz → ler para extrair comandos e arquitetura já documentados.

---

## Step 2 — Criar `docs/` e os 4 arquivos

Criar pasta `docs/` na raiz do projeto.

### docs/architecture.md

```markdown
# Architecture — <Project Name>

> Gerado por /forge em <data>. Manter atualizado com /chronicle.

## Stack
[extraído dos .csproj e package.json]

## Camadas
[camadas detectadas + responsabilidade de cada uma]

## Fluxo de requisição
[inferido dos padrões: Controller → Mediator → Handler → Repository]

## Padrões adotados
[extraído das memórias dos agentes — seção "Padrões que funcionam"]

## Decisões arquiteturais
[extraído das memórias — seção "Decisões tomadas"]

## Dependências externas
[serviços externos: banco, cache, APIs — inferido dos pacotes]
```

### docs/learned-errors.md

```markdown
# Learned Errors — <Project Name>

> Gerado por /forge em <data>. Atualizado automaticamente com /chronicle.

## Formato
`[DATA] | AGENTE | error:X | cause:Y | fix:Z | status:RESOLVIDO|PENDENTE`

## Erros registrados

[extraído das memórias — seção "Erros conhecidos" de TODOS os agentes, com data]

---
*Adicione novos erros com /chronicle após resolver bugs.*
```

### docs/pr-summary.md

```markdown
# PR & Change Log — <Project Name>

> Gerado por /forge em <data>. Atualizado com /chronicle após cada sessão de mudanças.

## Formato de entrada
```
### [DATA] — <Título da mudança>
**Tipo**: feat | fix | refactor | chore
**Agente**: <quem implementou>
**Mudanças técnicas**:
- [lista de mudanças]
**Impacto**: [o que pode ter sido afetado]
```

## Histórico

### [<DATA ATUAL>] — Inicialização do codex
**Tipo**: chore
**Mudanças técnicas**:
- Codex de documentação criado via /forge
- Stack detectada: [lista]
- Agentes invocados: [lista]
```

### docs/modules.md

```markdown
# Modules & Business Rules — <Project Name>

> Gerado por /forge em <data>. Atualizado com /chronicle.

## Formato
Cada módulo: responsabilidade, regras de negócio, dependências internas.

---

[Para cada camada/projeto detectado:]

## <Nome do módulo>

**Responsabilidade**: [inferida pelo nome da camada e pacotes]

**Regras de negócio**:
- [extraídas das memórias dos agentes se disponível]
- [inferidas dos padrões detectados]

**Dependências internas**: [referências de projeto do .csproj]

**Pacotes externos**: [PackageReferences do .csproj]

---
```

---

## Step 3 — Relatório

```
⚔ THE FORGING COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Codex criado em: docs/
  ✦ docs/architecture.md
  ✦ docs/learned-errors.md
  ✦ docs/pr-summary.md
  ✦ docs/modules.md

Erros selados  : N (de agent memories)
Decisões seladas: N
Módulos documentados: N
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/chronicle → manter o codex atualizado após cada sessão
/gaze      → revelar estado completo (memórias + codex)
```
