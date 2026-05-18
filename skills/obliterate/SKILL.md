---
name: obliterate
description: >
  THE OBLITERATION — Purge a specific section from an agent memory file.
  Safe — never deletes the file or other sections. Uses exact ## match.
  Syntax: /obliterate <agent> <section>.
  Trigger: /obliterate, "purgar memória", "limpar seção do agente", "obliterate agent section".
---

**THE OBLITERATION — surgical destruction of a memory section.**

## Usage

```
/obliterate edmundo "Erros conhecidos"
/obliterate architect "Pendências"
/obliterate jubileu "Abordagens descartadas"
```

## Seções válidas (match exato com ##)

- `Erros conhecidos`
- `Decisões tomadas`
- `Padrões que funcionam`
- `Abordagens descartadas`
- `Pendências`

## Steps

1. Parsear nome do agente e nome da seção do input do usuário.

2. Verificar se `~/.claude/agents-memory/<agent>.md` existe.
   - NÃO existe → report "Agente '<agent>' não encontrado. Disponíveis: [lista]"
   - NÃO criar arquivo novo.

3. Ler conteúdo do arquivo.

4. Encontrar seção com match exato: `## <section name>`
   - NÃO encontrada → report "Seção '## <section>' não existe em '<agent>'. Seções disponíveis: [lista]"
   - NÃO modificar arquivo.

5. Remover conteúdo da seção (manter header `## <seção>`, limpar entradas abaixo).
   - Substituir entradas por: `(obliterado em <data>)`

6. Escrever arquivo atualizado.

7. Relatório:
```
⚔ THE OBLITERATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agente : <agent>
Seção  : ## <section>
Removido: N entradas
Arquivo : ~/.claude/agents-memory/<agent>.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/gaze → verificar estado atual das memórias
```
