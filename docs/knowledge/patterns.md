# Padrões do Projeto

> Mantido pelo Writer. Convenções e padrões descobertos ou definidos por Architect, Dev
> Backend, Dev Frontend ou Designer, sempre via handoff — nunca escrito direto por eles.
> Indexado no graphify após cada escrita: `/graphify docs/knowledge --update`.

<!-- Cada entrada segue este formato:

## [Nome do padrão]

**Camada/área:** Domain | Application | Infrastructure | Presentation | UI | outro
**Definido por:** Architect | Dev Backend | Dev Frontend | Designer
**Descrição:** [o padrão em si]
**Quando usar:** [contexto de aplicação]
**Exemplo:** [arquivo/trecho de referência]

-->

## Dogfood do próprio Nirvana como projeto

**Camada/área:** outro (meta — o repo framework rodando o próprio produto)
**Definido por:** Tech Lead
**Descrição:** Quando o repo alvo é o próprio Nirvana (sem app back/front), specialty de
Architect/Dev Backend/Dev Frontend vira `"N/A (framework repo)"` em vez de detectar stack real.
**Quando usar:** Toda vez que `/light` ou a cadeia rodar dentro do repo `Nirvana` em si, não num
projeto consumidor.
**Exemplo:** `docs/tasks/001-dogfood-light-2.md`
