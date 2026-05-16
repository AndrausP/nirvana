---
name: reset
description: >
  Clear a specific section of an agent's memory file. Uses exact ## match.
  Syntax: /la reset <agent> <section>. Safe — never deletes the file or other sections.
  Trigger: /la reset, "limpar memória do agente", "reset agent section".
---

Clear a specific section from an agent memory file. Exact ## match required.

## Usage

```
/la reset edmundo "Erros conhecidos"
/la reset architect "Pendências"
/la reset jubileu "Abordagens descartadas"
```

## Valid section names (exact match with ##)

- `Erros conhecidos`
- `Decisões tomadas`
- `Padrões que funcionam`
- `Abordagens descartadas`
- `Pendências`

## Steps

1. Parse agent name and section name from user input

2. Check if `~/.claude/agents-memory/<agent>.md` exists
   - If NOT: report "Agente '<agent>' não encontrado. Agentes disponíveis: [list existing files]"
   - Do NOT create a new file

3. Read the file content

4. Find section with exact match: `## <section name>`
   - If NOT found: report "Seção '## <section>' não encontrada no arquivo do agente '<agent>'"
   - Show existing sections available
   - Do NOT modify the file

5. Remove section content (keep the `## <section>` header, clear entries below it)
   - Replace entries with: `(vazio — limpo em <date>)`

6. Write updated file

7. Report:
   ```
   LEARNING-AGENT RESET
   Agente: <agent>
   Seção: ## <section>
   Entradas removidas: N
   Arquivo: ~/.claude/agents-memory/<agent>.md
   ```
