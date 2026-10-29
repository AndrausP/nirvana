# Architecture Decisions

> Maintained by Nirvana. Each significant decision logged here by the Writer, then indexed
> into the shared graphify graph. Run /reflect to synthesize from docs/ + graphify.

| Date | Decision | Reason | Agent |
|------|----------|--------|-------|
| 2026-07-14 | Nirvana 2.0 validado via dogfood — /light rodado no próprio repo Nirvana | Provar a cadeia de 9 agentes, memória via graphify, chat opcional e banner de entrada funcionam de ponta a ponta, não só no papel (docs/tasks/001-dogfood-light-2.md) | Tech Lead / Writer / QA |
| 2026-07-14 | /light: header do CLAUDE.md pra caso sem arquivo prévio, definido explicitamente | Skill referenciava "header below" sem nunca defini-lo — travaria um usuário real sem CLAUDE.md existente | QA → Writer |
| 2026-10-23 | Contador de sessões em `.claude/state.local.json` (gitignored), não em `state.json` | O hook grava a cada sessão; em `state.json` (versionado) cada abertura do Claude deixaria um arquivo rastreado modificado e geraria conflito entre colegas | Broker |
| 2026-10-23 | "Writer indexa pendências" roda logo DEPOIS da compactação (SessionStart source `compact`), não antes | `PreCompact` só pode bloquear, não deixa o modelo agir; o resumo da compactação ainda tem o histórico pra o Writer registrar | Broker |
| 2026-10-28 | README vira landing page curta em inglês; referência detalhada vai para `docs/guide/` (how-it-works, commands, configuration); LICENSE MIT em nome de AndrausP; organograma em PT sai da raiz para `docs/ideas/` | Repo tinha 3 estrelas e quase nenhuma visita: sem LICENSE o GitHub mostra "sem licença" e listas como awesome-claude-code exigem licença detectada; README de 480 linhas não respondia "por que usar". `docs/guide/` separa doc de usuário do `docs/` dogfood mantido pelo /reflect | Broker |
| 2026-10-28 | Nirvana distribuído também como plugin do Claude Code: raiz do repo é marketplace (`nirvana`) e plugin (`nirvana`) ao mesmo tempo; scripts de instalação continuam | Instalação em 1 comando sem `curl | bash`, atualização pelo próprio Claude Code. Raiz como plugin evita mover `skills/` e `templates/` (URLs dos instaladores). `/light` acha templates em `${CLAUDE_PLUGIN_ROOT}/templates` (Claude Code substitui só em skill de plugin; em skill comum fica literal) e cai para `~/.claude/nirvana-templates`. Aviso aceito do validate: CLAUDE.md do dogfood na raiz não carrega como contexto do plugin. Versão só no plugin.json (lint garante) | Broker |
