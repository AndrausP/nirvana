---
name: invoke
description: >
  THE INVOCATION — Bootstrap learning-agent in current project. Reads only config
  files (no class files), detects stack via .csproj/.sln/package.json, creates or
  merges agent memory files in ~/.claude/agents-memory/.
  Use when starting in a new project, after major refactor, or when agents-memory/ is empty.
  Trigger: /invoke, "bootstrap agents", "inicializar agentes", "invoke the agents".
---

**THE INVOCATION — summon the agents from the codebase.**

Follow these steps exactly.

## Step 0 — Checagem inicial (OBRIGATÓRIO PRIMEIRO)

Verificar se `C:\Users\AndrausFelipeRibeiro\.claude\agents-memory\` existe. Se não → criar.

Rodar 4 Globs em paralelo:
- `**/*.csproj`
- `**/manifest.json`
- `**/package.json`
- `**/*.sln`

Se TODOS vazios → output:

```
⚔ INVOCATION FAILED
Nenhum projeto reconhecível. Invoque dentro da pasta raiz do projeto.
```

**PARAR.** Não ler arquivos. Não criar memórias.

---

## Step 1 — Scan de stack (só configs — zero source)

### 1a — Tipo de projeto (paralelo)
- `**/*.csproj` → .NET backend
- `**/*.sln` → ler para lista de projetos
- `**/package.json` → Node/frontend — ler para detectar framework
- `**/appsettings*.json` → ASP.NET Core

### 1b — Camadas Clean Architecture (âncora `.csproj`)
Rodar em paralelo:
- `**/*Domain*/*.csproj` → Domain layer
- `**/*Application*/*.csproj` → Application layer
- `**/*Infrastructure*/*.csproj` → Infrastructure layer
- `**/*API*/*.csproj` ou `**/*Presentation*/*.csproj` → API layer
- `**/*Test*/*.csproj` ou `**/*Tests*/*.csproj` → test project

3+ camadas → Clean Architecture confirmada.

### 1c — Ler TODOS os `.csproj` (XML pequeno — ler todos)
De `<PackageReference>` inferir:
- `MediatR` → CQRS/Mediator
- `FluentValidation` → validators
- `Microsoft.EntityFrameworkCore` → EF Core
- `Npgsql.EntityFrameworkCore.PostgreSQL` → PostgreSQL
- `StackExchange.Redis` → Redis
- `Hangfire.*` → background jobs
- `NUnit`/`xUnit`/`MSTest` → test framework
- `Moq`/`NSubstitute` → mocking
- `Serilog` → structured logging
- `Anthropic` → Claude AI integration
- `Microsoft.CodeAnalysis.CSharp` → Roslyn

**Não ler** `.cs`, `.js`, `.ts` ou qualquer source.

### 1d — Frontend detection
- `manifest.json` com `"sap.ui"` ou `"sap.app"` → SAP UI5
- `package.json` com `"react"` + `"vite"` → React + Vite
- `package.json` com `"next"` → Next.js
- `package.json` com `"vue"` → Vue

---

## Step 2 — Mapear agentes

| Detecção | Agente |
|----------|--------|
| `.csproj` .NET | edmundo |
| SAP UI5 | thomas-shelby |
| React/Vue/Next.js | thomas-shelby |
| 3+ camadas Clean Arch | architect |
| Projeto de testes | jubileu |
| Domain layer presente | jhalim |

Nenhum agente → output "Nenhum agente necessário." e parar.

---

## Step 3 — Criar ou MESCLAR memórias

Caminho: `C:\Users\AndrausFelipeRibeiro\.claude\agents-memory\<agente>.md`

**NÃO existe:** criar com:
```markdown
# Memory — <agente>

## Contexto do projeto
- stack:[lista]
- framework:[versão]
- namespace_raiz:[ex: DevHub]
- target_framework:[ex: net8.0]

## Padrões que funcionam

## Erros conhecidos

## Decisões tomadas

## Abordagens descartadas

## Pendências
```

**EXISTE (MESCLAR — nunca sobrescrever):**
- Ler arquivo existente
- Adicionar só seções ausentes
- Acrescentar padrões novos se não listados
- Nunca remover entradas existentes

---

## Step 4 — Padrões por evidência de pacote

| Pacote | Entrada |
|--------|---------|
| MediatR | `pattern:CQRS com MediatR confirmed:inferred evidence:MediatR package` |
| FluentValidation | `pattern:FluentValidation nos validators confirmed:inferred evidence:FluentValidation package` |
| EF Core + Npgsql | `pattern:EF Core + PostgreSQL confirmed:inferred evidence:packages` |
| StackExchange.Redis | `pattern:Redis cache confirmed:inferred evidence:StackExchange.Redis` |
| Hangfire | `pattern:Background jobs via Hangfire confirmed:inferred evidence:Hangfire packages` |
| Anthropic | `pattern:Claude AI via Anthropic SDK confirmed:inferred evidence:Anthropic package` |
| CodeAnalysis.CSharp | `pattern:Roslyn symbol extraction confirmed:inferred evidence:CodeAnalysis package` |
| React + Vite | `pattern:React 18 + Vite + TypeScript confirmed:inferred evidence:package.json` |

---

## Step 5 — Relatório

```
⚔ THE INVOCATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stack detectado  : [lista]
Clean Arch layers: [camadas]
Frontend         : [React/SAP UI5/nenhum]
Agentes invocados: [lista]
Agentes mesclados: [lista]
Padrões selados  : N
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/forge    → criar o codex de documentação do projeto
/gaze     → revelar todo conhecimento acumulado
/inscribe → selar conhecimento da sessão na memória
```
