# Evolução da Arquitetura de Dados

**Data:** Abril de 2026
**Contexto:** Trajetória de evolução da camada de dados do ecossistema Nadia/Seade — do CSV atual até um servidor de banco de dados centralizado acessado via MCP. Cada fase documenta o que se ganha, o que se perde e quando vale a transição.

---

## Os dois eixos da evolução

A arquitetura de dados tem duas dimensões independentes que evoluem em ritmos diferentes:

**Eixo 1 — Onde o dado vive (armazenamento):**
`CSV` → `SQLite / DuckDB` → `SQL Server / PostgreSQL`

**Eixo 2 — Como o dado é acessado (interface):**
`Leitura direta no browser` → `MCP server local` → `MCP server centralizado`

O MCP não é uma tecnologia de banco de dados — é uma camada de interface que pode se sentar em cima de qualquer tecnologia de armazenamento. É possível (e faz sentido) ter MCP + CSV, MCP + SQLite ou MCP + SQL Server.

---

## Fase 1 — CSV no browser *(situação atual)*

**O que é:** Os arquivos CSV são empacotados junto com o código da aplicação via Vite (`?raw`). O browser baixa tudo no primeiro acesso. O JavaScript faz o parse e filtra linha por linha na memória.

**Como funciona:**
```
Browser → Gemini API → function call → JavaScript filtra CSV local → resultado
```

**O que se ganha:**
- Zero dependência externa — funciona sem nenhum servidor
- Zero latência de rede — tudo ocorre na memória do browser
- Deploy simples — um único artefato estático (HTML + JS + CSV)
- Fácil de atualizar — troca o CSV e redeploya

**O que se perde / limitações:**
- Limite prático de ~10–15 MB por base (bundle pesado)
- CSV bundlado significa redeploy para qualquer atualização de dado
- Cada Nadia carrega sua própria cópia — sem dado compartilhado
- Hermes não tem acesso (não roda no browser)

**Quando sair dessa fase:**
Quando a base crescer além de ~50.000 linhas, quando precisar de atualização de dado sem redeploy, ou quando uma segunda Nadia precisar da mesma base.

---

## Fase 2 — SQLite ou DuckDB *(evolução interna, sem servidor)*

**O que é:** O CSV é convertido para um arquivo de banco de dados local (`.db`). O MCP server — que já existe — passa a ler esse arquivo em vez do CSV. Não há processo de servidor separado; o banco é uma biblioteca embutida no processo Node.js.

**SQLite vs DuckDB — qual escolher:**

| | SQLite | DuckDB |
|---|---|---|
| Melhor para | Registros pontuais, buscas por chave | Agregações, GROUP BY, análises |
| Velocidade em filtros analíticos | Boa | Excelente (coluna por coluna) |
| Lê CSV diretamente | Não (precisa importar) | Sim (`SELECT * FROM 'arquivo.csv'`) |
| Maturidade | Muito alta | Alta (crescendo rápido) |
| Caso de uso Seade | Busca por empresa/município | Soma por setor/ano/região |

Para o perfil do PIESP — que é analítico (agregações, rankings, somas) — **DuckDB é a escolha natural**. Para bases transacionais (cadastros, registros individuais), SQLite é suficiente.

**Como funciona:**
```
Browser → Gemini → function call → MCP server → SQLite/DuckDB (.db local) → resultado
```

**O que se ganha:**
- Queries com índices: 10–100x mais rápidas para bases grandes
- SQL real: JOINs, window functions, GROUP BY — lógica que hoje está em JavaScript
- Sem limite prático de tamanho (arquivo `.db` pode ter gigabytes)
- DuckDB lê CSV, Parquet e JSON diretamente — migração gradual possível

**O que se perde / limitações:**
- O arquivo `.db` precisa estar no servidor que roda o MCP — não está no browser
- Nadia passa a depender do MCP server para funcionar
- Atualização do dado exige atualizar o arquivo no servidor (ainda manual)

**Esforço de migração:** 1–2 dias. A lógica de filtro já está no `piespService.ts`; é uma substituição de `split('\n').filter()` por queries SQL.

---

## Fase 3 — MCP como interface universal *(dado vira serviço)*

**O que é:** O MCP server deixa de ser um processo local e passa a rodar num servidor do Seade acessível pela rede. Todas as Nadias e o Hermes Agent apontam para o mesmo endpoint. O dado vive num lugar só.

**Como funciona:**
```
Nadia-PIESP   ─────┐
Nadia-Emprego ─────┤→ MCP Server (Seade) → banco de dados
Hermes Agent  ─────┘   http://mcp.seade.sp.gov.br
```

**O que se ganha:**
- Fonte única de verdade — atualizar o dado em um lugar reflete em todos os sistemas
- Nadias ficam menores e mais rápidas (sem CSVs no bundle)
- Hermes e Nadias literalmente compartilham o mesmo dado
- Novas bases são adicionadas no MCP server sem tocar nas Nadias
- Histórico e auditoria de consultas possíveis no servidor

**O que se perde / limitações:**
- Nadia passa a depender de disponibilidade do servidor MCP (se cair, perde acesso aos dados)
- Latência de rede por consulta (~50–100ms na intranet do Seade)
- CORS precisa ser configurado para o browser poder chamar o servidor
- Autenticação necessária — qualquer um com a URL pode consultar

**Impacto na latência da experiência:**
Uma resposta do Gemini leva 1,5–3s. Adicionar 100ms por chamada MCP = ~5% de overhead. Invisível ao usuário. Mesmo com 3 chamadas encadeadas (300ms extras), a experiência permanece fluida.

**Esforço:** 2–3 dias. O MCP server já existe; é configurar infraestrutura (servidor, domínio, HTTPS, autenticação básica).

---

## Fase 4 — SQL Server ou PostgreSQL *(banco de dados corporativo)*

**O que é:** O dado migra de arquivo local (`.db`) para um servidor de banco de dados dedicado, com motor, conexões concorrentes, backup automatizado e administração centralizada.

**SQL Server vs PostgreSQL — qual escolher para o Seade:**

| | SQL Server | PostgreSQL |
|---|---|---|
| Adoção no governo brasileiro | Muito alta — padrão histórico | Crescente — especialmente em novos projetos |
| Licença | Paga (Microsoft) — pode já ter licença | Gratuita e open source |
| Integração com infraestrutura MS | Excelente (Azure, Active Directory) | Boa, com adaptadores |
| Capacidade analítica | Alta (columnstore indexes) | Alta (extensão TimescaleDB, Citus) |
| Ferramentas de BI | Power BI integrado nativamente | Conecta via ODBC/JDBC |
| Administração | SSMS (interface gráfica madura) | pgAdmin, DBeaver |

**Recomendação para o Seade:** se já existe infraestrutura SQL Server (licenças, DBA, backups), usar SQL Server é a escolha de menor atrito. Se o projeto for novo do zero, PostgreSQL é mais moderno, gratuito e tem melhor suporte para workloads analíticos modernos.

**Como funciona com MCP:**
```
Nadia / Hermes → MCP Server → SQL Server (porta 1433) ou PostgreSQL (porta 5432)
                               ↑
                          dado centralizado,
                          backups, replicação,
                          controle de acesso por schema
```

**O que se ganha:**
- Dado gerenciado por infraestrutura corporativa já existente no Seade
- Backup, replicação e disaster recovery nativos
- Controle de acesso por usuário/schema (separar quem pode ver o quê)
- Consultas de alta complexidade: JOINs entre bases, views, stored procedures
- Integração com Power BI, Excel, outras ferramentas do ecossistema Microsoft
- Múltiplos sistemas do Seade podem ler o mesmo banco (não só as Nadias)
- Escala para centenas de milhões de linhas sem perda de performance

**O que se perde / limitações:**
- Custo: SQL Server Enterprise pode ser caro se não houver licença; PostgreSQL é gratuito
- Complexidade operacional: requer DBA, monitoramento, patching
- Latência de conexão ao banco (geralmente 5–20ms internamente, negligível)
- Dado sai do controle direto do desenvolvedor — depende de equipe de infraestrutura

**Esforço de migração:** O MCP server troca o driver de acesso (de `better-sqlite3` para `mssql` ou `pg`). As queries SQL permanecem quase idênticas. 1–3 dias de desenvolvimento + tempo de provisionamento do banco pela TI.

---

## Fase 5 — SQL Server/PostgreSQL + MCP centralizado *(ecossistema completo)*

**O que é:** O estado final. O banco de dados corporativo do Seade é o repositório central. O MCP server é a camada de interface padronizada. Todas as Nadias, o Hermes e qualquer futuro sistema passam pelo MCP.

```
┌─────────────────────────────────────────────────────────┐
│                  SISTEMAS CONSUMIDORES                  │
│                                                         │
│  Nadia-PIESP  Nadia-Emprego  Hermes  Power BI  Scripts │
└──────┬──────────────┬────────────┬──────┬──────┬───────┘
       │              │            │      │      │
       └──────────────┴────────────┴──────┴──────┘
                              │
                    ┌─────────▼──────────┐
                    │    MCP Server      │
                    │  (interface única) │
                    └─────────┬──────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
    │  DB: PIESP     │ │ DB: Emprego │ │ DB: Munic. │
    │  SQL Server /  │ │ SQL Server  │ │ PostgreSQL │
    │  PostgreSQL    │ │             │ │            │
    └────────────────┘ └─────────────┘ └────────────┘
```

**O que se ganha:**
- Qualquer novo sistema se integra adicionando tools ao MCP — sem reescrever nada
- Hermes aprende padrões cruzando PIESP + Emprego + Municipal numa única conversa
- Auditoria completa de quem consultou o quê e quando
- Dado atualizado chega a todos os sistemas simultaneamente

**O que se perde / limitações:**
- O MCP server vira infraestrutura crítica — sua queda afeta todos os sistemas
- Requer SLA, monitoramento, e redundância
- Mais camadas = mais pontos de falha para diagnosticar

---

## Tabela resumo comparativa

| | CSV (hoje) | SQLite/DuckDB | MCP Centralizado | SQL Server/PostgreSQL | Fase 5 (completa) |
|---|---|---|---|---|---|
| **Latência de consulta** | ~5ms | ~10ms | ~50–100ms | ~20ms (intranet) | ~70–120ms |
| **Limite de dados** | ~15 MB | Gigabytes | Ilimitado | Ilimitado | Ilimitado |
| **Atualização do dado** | Redeploy | Troca arquivo | Atualiza no servidor | DML no banco | DML no banco |
| **Dado compartilhado** | Não | Não | Sim | Sim | Sim |
| **Hermes conecta** | Sim (MCP já existe) | Sim | Sim | Sim | Sim |
| **Queries complexas** | Limitado (JS) | SQL completo | SQL completo | SQL completo | SQL completo |
| **Backup/DR** | Manual | Manual | Manual | Nativo | Nativo |
| **Controle de acesso** | Nenhum | Nenhum | Autenticação básica | Por schema/usuário | Por schema/usuário |
| **Esforço de migração** | — | 1–2 dias | 2–3 dias | 1–3 dias dev + TI | Incremental |
| **Dependência externa** | Zero | MCP local | Servidor MCP | Banco + MCP | Banco + MCP |
| **Custo** | Zero | Zero | Infraestrutura | Licença + infra | Licença + infra |

---

## Trajetória recomendada para o Seade

O Hermes é um eixo paralelo — não é uma fase futura. Pode ser introduzido hoje, na Fase 1, porque o MCP server já existe e já lê os CSVs. A evolução do armazenamento é independente da presença do Hermes.

```
                    HERMES AGENT (presente desde agora, cresce junto)
                    ────────────────────────────────────────────────▶

Armazenamento:
CSV local  →  DuckDB + MCP local  →  MCP centralizado  →  SQL Server/PG
   │                  │                    │                    │
  Agora         2ª Nadia aparece     TI do Seade embarca    Longo prazo
```

**O MCP server é o ponto fixo.** O que muda entre as fases é apenas o que está atrás dele. O Hermes, as Nadias e qualquer outro sistema futuro sempre veem a mesma interface.

**Não pular etapas prematuramente.** A Fase 2 (DuckDB) resolve performance sem dependência nova. A Fase 3 (MCP centralizado) vale quando dois ou mais sistemas consumirem o mesmo dado. A Fase 4 (SQL Server) vale quando a TI do Seade precisar gerenciar o dado como ativo corporativo.

O risco de pular para Fase 4 diretamente é criar dependência de infraestrutura antes de validar os casos de uso. O risco de ficar muito tempo na Fase 1 é acumular dívida técnica quando a segunda Nadia chegar.
