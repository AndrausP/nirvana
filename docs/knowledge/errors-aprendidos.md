# Erros Aprendidos

> Mantido pelo Writer. Toda entrada vem do QA (bug encontrado) ou Dev (bug corrigido) via
> handoff da cadeia — nunca escrito direto por eles. Indexado no graphify após cada escrita:
> `/graphify docs/knowledge --update`.

<!-- Cada entrada segue este formato:

## [YYYY-MM-DD] [Título curto do erro]

**Task:** docs/tasks/{id}.md
**Causa raiz:** [não o sintoma — o porquê real]
**Sintoma:** [o que foi observado]
**Correção:** [o que resolveu]
**Como evitar de novo:** [regra prática pro próximo agente]

-->

## [2026-10-23] Hook do banner quebra quando o script não existe no projeto

**Task:** n/a (fix direto, branch `fix/banner-hook-path`)
**Causa raiz:** o comando do hook `SessionStart` chamava `powershell -File ".claude/hooks/nirvana-banner.ps1"`
sem checar se o arquivo existia e com caminho relativo ao diretório atual do Claude (que nem
sempre é a raiz do projeto). Num projeto onde o `/light` gravou o hook no `settings.json` mas o
script não foi copiado, `.claude/hooks/` ficou vazio.
**Sintoma:** toda abertura do Claude Code mostrava `SessionStart:startup hook error` —
"O argumento '.claude/hooks/nirvana-banner.ps1' para o parâmetro -File não existe".
**Correção:** comando do hook agora usa `$env:CLAUDE_PROJECT_DIR` e só executa se o script
existir (senão é no-op silencioso); o script ancora caminhos na raiz do projeto; `/light`
sempre recopia o script, confirma que ele existe e substitui a entrada antiga do banner em vez
de duplicar.
**Como evitar de novo:** hook de projeto nunca referencia arquivo por caminho relativo nem
assume que o arquivo existe — sempre `CLAUDE_PROJECT_DIR` + guarda de existência.

Observação: na mesma tela aparece "Hook output looks like a JSON object but is not valid JSON" —
esse erro NÃO é do Nirvana. Vem do hook de `SessionStart` do plugin claude-mem (start do worker),
que imprime dois objetos JSON seguidos no stdout.
