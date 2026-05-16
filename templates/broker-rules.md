# Broker Communication Rules — learning-agent

## Formato inter-agentes

Agentes NÃO trocam prose. Trocam structured format:

```
# <from> → <to>
entity:X add:Y type:Z fk:W migration:needed
impl:ok risk:null_X needs:decision
edge:confirmed decision:required
```

## Tipos de mensagem

| Tipo | Uso | Exemplo |
|------|-----|---------|
| `entity_change` | Mudança em entidade de domínio | `entity:BacklogItem add:SprintId type:Guid fk:Sprint` |
| `decision_request` | Arquiteto precisa decidir | `decision_needed:eager_vs_lazy context:BacklogItem.GetAll` |
| `risk_alert` | Jubileu identificou risco | `risk:null_ref level:high impact:runtime_crash` |
| `pattern_confirmation` | Padrão validado | `pattern:Repository<T> confirmed:true consistency:100%` |
| `validation_error` | Validator falhou | `entity:X field:Y rule:required test_failed:Z` |

## Roteamento de modelo

| Task type | Keywords | Modelo |
|-----------|----------|--------|
| Leitura/sumarização | summarize, read, list, count, lê, lista | haiku |
| Implementação | implement, debug, write, create, fix | sonnet |
| Arquitetura complexa | architect, design, tradeoff, evaluate | opus |

## Economia estimada

- haiku vs sonnet: ~20x mais barato
- Structured format vs prose: ~57% menos tokens
- Memory index vs carregar tudo: ~80% menos tokens de memória
