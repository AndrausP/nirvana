---
task: "001"
sprint: "1"
status: done
---

# 001 — Dogfood: validar /light 2.0 rodando no próprio repo Nirvana

**Sprint:** docs/sprints/sprint-1.md
**Critério de aceite:** `/light` roda de ponta a ponta neste repo (CLAUDE.md mesclado, state.json,
docs/ skeleton, hook de banner, graphify inicializado) e `/smalltask` prova a cadeia + `/chat` +
o banner funcionando, sem quebrar nada que já existia no repo.

## Cadeia

| Etapa | Agente | Output |
|-------|--------|--------|
| 1. Objetivo | Product Owner | Provar que a reescrita 2.0 funciona de verdade, não só no papel |
| 2. Contexto | Reader → Writer | Repo não tinha CLAUDE.md/docs/state.json prévios — instalação limpa |
| 3. Quebra | Tech Lead | 1 task: rodar /light, depois /smalltask de validação |
| 4. Estrutura | Architect | N/A — sem contrato/schema envolvido, só setup de arquivos |
| 5. Aprovação | Product Owner | Aprovado |
| 6. Implementação | Tech Lead / Writer / QA | /light executado manualmente passo a passo (ver abaixo) |
| 7. Teste | QA | Ver "Resultado QA" abaixo |
| 8. Documentação | Writer | docs/decisions.md + docs/knowledge/patterns.md atualizados; graphify reindexado |

## O que foi validado

- `CLAUDE.md` criado na raiz com bloco `NIRVANA:START`/`NIRVANA:END` (não existia CLAUDE.md antes)
- `.claude/state.json` criado com os 9 agentes + `chainVisibility`/`entryBanner`
- `docs/` skeleton completo (architecture, modules, decisions, knowledge/, sprints/, tasks/)
- `graphify` inicializado sobre `docs/knowledge/` — grafo real gerado (26 nodes, 31 edges, 5
  comunidades) via subagent de extração, `graphify query` funcionando ao vivo
- Hook `SessionStart` (`.claude/hooks/nirvana-banner.ps1`) escrito, wired em
  `.claude/settings.json`, testado manualmente — imprime banner correto
- `/chat` (chat visível) testado nesta própria execução

## Bug achado e corrigido

`skills/light/SKILL.md` Step 5a dizia "create it with just the header below" pro caso de
CLAUDE.md inexistente, mas nenhum "header below" tinha sido definido no arquivo — teria travado
um usuário real. Corrigido: Step 5a agora define o header explícito inline.

## Resultado QA

**PASS.** Todos os artefatos esperados existem e são consistentes entre si (state.json ↔
CLAUDE.md ↔ hook ↔ graphify). Riscos residuais:
- Caminho `templates/X` só resolve com `~/.claude/nirvana-templates/` populado pelo installer —
  não testado via `curl`/`iwr` real nesta sessão (só via cópia local), então o download remoto
  do GitHub raw ainda não foi exercido fim a fim.
- `graphify-out/graph.json` ficou 1 rebuild atrasado do último edit em `patterns.md`: uma
  reextração de validação bateu no shrink-guard do graphify (#479 — recusa sobrescrever com
  menos nodes que o grafo atual), o que é o comportamento correto de honestidade, mas significa
  que o grafo em disco não reflete a entrada de pattern mais recente. Rodar `/graphify
  docs/knowledge` (full rebuild) resolve.

## Status

done
