# Arquitetura de Dados

**Data:** Abril de 2026
**Contexto:** Decisões sobre armazenamento, limites e evolução das bases de dados que alimentam as Nadias.

---

## Estratégia atual: CSV no browser

Os CSVs são importados via `?raw` do Vite, transformados em string no bundle JavaScript e parseados em memória. A busca é um scan linear O(n) — determinística, sem IA, 100% previsível.

**Por que isso funciona:**
- Sem backend, sem latência de rede, sem servidor para manter
- Filtros determinísticos: o Gemini nunca toca nos dados brutos, só recebe o JSON do resultado
- Simples de atualizar: trocar o CSV e redeployar

---

## Limites do CSV por tipo de base

### Base PIESP (atual)
- ~5.000 linhas, ~15 colunas, ~2 MB
- Inclui campos de texto longo (`descr_investimento`)
- **Margem confortável:** pode crescer 4x sem problema

### Base Municipal (planejada)
645 municípios × 60 colunas numéricas × N anos:

| Anos de histórico | Linhas totais | Tamanho estimado | Situação |
|---|---|---|---|
| 10 anos (2016–2026) | 6.450 | ~2,5 MB | Confortável |
| 20 anos (2006–2026) | 12.900 | ~5 MB | Bom |
| 30 anos (1996–2026) | 19.350 | ~7,5 MB | Aceitável |
| 50 anos (1976–2026) | 32.250 | ~12 MB | Pesado |

**Recomendação:** 20–25 anos de histórico. Cobre ciclos econômicos relevantes, pesa ~5 MB, carrega em ~2s.

**Por que colunas numéricas são mais leves:** um campo `PIB_total` ocupa ~10 caracteres. Um campo `descr_investimento` ocupa ~200. Bases com indicadores numéricos são inerentemente mais compactas que bases com texto narrativo.

**Estratégia de divisão para ir além:** dois arquivos — `municipios_recente.csv` (últimos 10 anos, carregado sempre) + `municipios_historico.csv` (anos anteriores, carregado sob demanda). Dobra a capacidade sem backend.

---

## Biblioteca vs Servidor

**Biblioteca (ex: SQLite):** código que roda dentro do seu processo. Sem porta de rede, sem processo separado, sem autenticação. O banco é um arquivo `.db` no disco. Quando o programa fecha, nada fica rodando. Trocar CSV por SQLite no MCP server seria só mudar como o dado é lido — mesma lógica de filtro, query SQL em vez de scan manual.

**Servidor (ex: Supabase/PostgreSQL):** processo independente que fica rodando, escuta numa porta, gerencia conexões. Sua aplicação se conecta via rede. Adiciona latência (50–150ms), custo, e dependência externa.

---

## Quando evoluir além do CSV

| Gatilho | Solução | Esforço |
|---|---|---|
| Base > 50.000 linhas | Migrar MCP server para SQLite | 1–2 dias |
| Dados precisam de atualização sem redeploy | Supabase (PostgreSQL na nuvem) | 1 semana |
| Múltiplas Nadias compartilhando mesma base | Supabase | 1 semana + decisão de governança |
| Controle de acesso por usuário | Supabase com Row Level Security | 2 semanas |

**Nota sobre LGPD e governança:** Supabase hospeda dados em servidores nos EUA por padrão. Para uma fundação pública estadual, dados sensíveis não devem sair da infraestrutura do estado sem justificativa formal. Avaliar Supabase Self-Hosted ou alternativa on-premise antes de migrar.

---

## A busca continua determinística em qualquer cenário

CSV com JavaScript, SQLite ou Supabase — os três são determinísticos. O que a Nadia evita é deixar o modelo de linguagem filtrar dados diretamente (ele alucina). A busca sempre foi feita em código, nunca pelo Gemini. Isso não muda com a tecnologia de armazenamento.

SQL é inclusive mais preciso que o scan manual em JavaScript: usa índices B-tree, otimizador de queries, e tipos de dado nativos.
