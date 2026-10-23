# Architecture Decisions

> Maintained by Nirvana. Each significant decision logged here by the Writer, then indexed
> into the shared graphify graph. Run /reflect to synthesize from docs/ + graphify.

| Date | Decision | Reason | Agent |
|------|----------|--------|-------|
| 2026-07-14 | Nirvana 2.0 validado via dogfood — /light rodado no próprio repo Nirvana | Provar a cadeia de 9 agentes, memória via graphify, chat opcional e banner de entrada funcionam de ponta a ponta, não só no papel (docs/tasks/001-dogfood-light-2.md) | Tech Lead / Writer / QA |
| 2026-07-14 | /light: header do CLAUDE.md pra caso sem arquivo prévio, definido explicitamente | Skill referenciava "header below" sem nunca defini-lo — travaria um usuário real sem CLAUDE.md existente | QA → Writer |
| 2026-10-23 | Contador de sessões em `.claude/state.local.json` (gitignored), não em `state.json` | O hook grava a cada sessão; em `state.json` (versionado) cada abertura do Claude deixaria um arquivo rastreado modificado e geraria conflito entre colegas | Broker |
| 2026-10-23 | "Writer indexa pendências" roda logo DEPOIS da compactação (SessionStart source `compact`), não antes | `PreCompact` só pode bloquear, não deixa o modelo agir; o resumo da compactação ainda tem o histórico pra o Writer registrar | Broker |
