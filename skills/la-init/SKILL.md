---
name: la-init
description: >
  Bootstrap learning-agent in current project. Reads only config files (no class files),
  detects stack via .csproj/.sln/package.json, creates or merges agent memory files in
  ~/.claude/agents-memory/. Use when starting in a new project, after major refactor,
  or when agents-memory/ is missing/empty.
  Trigger: /la-init, /la init, "bootstrap agents", "inicializar agentes", "setup learning-agent".
---

Bootstrap learning-agent for this project. Follow these steps exactly.

## Step 0 — Checagem inicial obrigatória

**Antes de tudo:** verificar se `C:\Users\AndrausFelipeRibeiro\.claude\agents-memory\` existe.
Se não existe → criar o diretório antes de continuar.

Em seguida, rodar esses 4 Globs em paralelo:
- `**/*.csproj`
- `**/manifest.json`
- `**/package.json`
- `**/*.sln`

Se TODOS os quatro retornarem vazio → output:

```
LEARNING-AGENT INIT ABORTED
Nenhum projeto reconhecível nesta pasta.
Rode /la-init dentro da pasta raiz do projeto.
```

**PARAR.** Não prosseguir. Não ler arquivos. Não criar memórias.

---

## Step 1 — Detectar stack (só configs, sem ler source)

### 1a — Tipo de projeto

Rodar em paralelo (resultados do Step 0 reaproveitados):
- `.csproj` encontrado → .NET backend
- `.sln` encontrado → ler o arquivo para obter lista de projetos
- `package.json` encontrado → Node/frontend; ler para detectar framework (React, Vue, SAP UI5)
- `appsettings*.json` → ASP.NET Core (ignorar `**/bin/**` e `**/obj/**`)

### 1b — Camadas Clean Architecture (âncora `.csproj` — evita ruído de bin/obj)

Rodar em paralelo:
- `**/*Domain*/*.csproj` → camada Domain
- `**/*Application*/*.csproj` → camada Application
- `**/*Infrastructure*/*.csproj` → camada Infrastructure
- `**/*API*/*.csproj` ou `**/*Presentation*/*.csproj` → camada API/Presentation
- `**/*Test*/*.csproj` ou `**/*Tests*/*.csproj` → projeto de testes

3+ camadas detectadas → Clean Architecture confirmada.

### 1c — Ler TODOS os `.csproj` encontrados (XML pequeno — ler todos)

De `<PackageReference>`, inferir:
- `MediatR` → padrão CQRS/Mediator
- `FluentValidation` → validators
- `Microsoft.EntityFrameworkCore` → EF Core
- `Npgsql.EntityFrameworkCore.PostgreSQL` → PostgreSQL
- `StackExchange.Redis` → Redis
- `Hangfire.*` → background jobs
- `NUnit` / `xUnit` / `MSTest` → framework de testes
- `Moq` / `NSubstitute` → mocking
- `Serilog` → logging estruturado
- `Anthropic` → integração Claude AI
- `Microsoft.CodeAnalysis.CSharp` → Roslyn

**Não ler** arquivos `.cs`, `.js`, `.ts` ou qualquer source.

### 1d — SAP UI5

Se `manifest.json` encontrado: ler. Contém `"sap.ui"` ou `"sap.app"` → SAP UI5 confirmado.

### 1e — React/Vite

Se `package.json` encontrado: ler. Contém `"react"` e `"vite"` → React + Vite confirmado.

---

## Step 2 — Mapear agentes necessários

| Detecção | Agente |
|----------|--------|
| `.csproj` .NET encontrado | edmundo |
| SAP UI5 confirmado | thomas-shelby |
| React/Vite/Next.js confirmado | thomas-shelby |
| 3+ camadas Clean Architecture | architect |
| Projeto de testes encontrado | jubileu |
| Domain com muitas entidades (inferido por tamanho do .sln) | jhalim |

Nenhum agente mapeado → output "Nenhum agente necessário" e parar.

---

## Step 3 — Criar ou MESCLAR arquivos de memória

Caminho: `C:\Users\AndrausFelipeRibeiro\.claude\agents-memory\<agente>.md`

**Arquivo NÃO existe:** criar com estrutura mínima:
```markdown
# Memory — <agente>

## Contexto do projeto
- stack:[lista]
- framework:[versão]
- namespace_raiz:[ex: DevHub]
- target_framework:[ex: net8.0]

## Padrões que funcionam
[padrões inferidos dos pacotes]

## Erros conhecidos
[vazio]

## Decisões tomadas
[vazio]

## Abordagens descartadas
[vazio]

## Pendências
[vazio]
```

**Arquivo EXISTE (MESCLAR — nunca sobrescrever):**
- Ler arquivo existente
- Adicionar apenas seções ausentes
- Acrescentar padrões novos em "Padrões que funcionam" se ainda não listados
- Nunca remover entradas existentes

---

## Step 4 — Popular padrões por evidência de pacote

Formato: `pattern:X confirmed:inferred evidence:Y`

| Pacote detectado | Entrada gerada |
|-----------------|----------------|
| MediatR | `pattern:CQRS com MediatR confirmed:inferred evidence:MediatR package` |
| FluentValidation | `pattern:FluentValidation nos validators confirmed:inferred evidence:FluentValidation package` |
| EF Core + Npgsql | `pattern:EF Core + PostgreSQL confirmed:inferred evidence:EF Core + Npgsql packages` |
| StackExchange.Redis | `pattern:Redis cache confirmed:inferred evidence:StackExchange.Redis package` |
| Hangfire | `pattern:Background jobs via Hangfire confirmed:inferred evidence:Hangfire packages` |
| NUnit + Moq | `pattern:NUnit + Moq para testes confirmed:inferred evidence:test packages` |
| Anthropic | `pattern:Claude AI via Anthropic SDK confirmed:inferred evidence:Anthropic package` |
| Microsoft.CodeAnalysis.CSharp | `pattern:Roslyn symbol extraction confirmed:inferred evidence:CodeAnalysis package` |
| React + Vite | `pattern:React 18 + Vite + TypeScript frontend confirmed:inferred evidence:package.json` |

---

## Step 5 — Relatório final

```
LEARNING-AGENT INIT COMPLETO
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stack detectado  : [lista]
Clean Arch layers: [Domain / Application / Infrastructure / API]
Frontend         : [React/SAP UI5/nenhum]
Agentes criados  : [lista]
Agentes mesclados: [lista]
Padrões inferidos: N (de .csproj — zero leitura de classes)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Próximo passo: /la audit para revisar memórias completas
               /la flush após implementar algo para salvar conhecimento
```
