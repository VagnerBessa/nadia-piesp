# Nadia Coletora — Arquitetura

**Data:** Abril de 2026
**Contexto:** Arquitetura técnica do sistema autônomo de coleta e estruturação de anúncios de investimento para a PIESP. Para as implicações metodológicas e institucionais, ver `piesp_metodologia.md`.

---

## Separação de papéis

A Nadia Coletora e a Nadia Analítica são sistemas distintos com responsabilidades distintas:

| | Nadia Analítica | Nadia Coletora |
|---|---|---|
| **Função** | Responde perguntas sobre dados existentes | Encontra e estrutura dados novos |
| **Entrada** | Pergunta do analista | Internet (jornais, B3, diários oficiais) |
| **Saída** | Análise, dashboards, relatórios | Registros estruturados para revisão humana |
| **Tempo** | Síncrono (resposta imediata) | Assíncrono (roda em background) |
| **Humano** | No loop como usuário | No loop como curador |

Ambas convivem sob a marca Nadia e compartilham o banco de dados PIESP — uma alimenta, a outra consome.

---

## Visão geral do pipeline

```
┌─────────────────────────────────────────────────────────┐
│                     INTERNET                            │
│                                                         │
│  Jornais         B3 / DRIs        Diários    Press      │
│  eletrônicos     Fatos relevantes  Oficiais  releases   │
└──────┬───────────────┬──────────────┬──────────┬────────┘
       └───────────────┴──────────────┴──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   CAMADA DE COLETA  │
                    │                     │
                    │  Hermes background  │
                    │  tasks (agendado)   │
                    │  +                  │
                    │  Firecrawl /        │
                    │  Browser-use        │
                    └──────────┬──────────┘
                               │ texto bruto
                    ┌──────────▼──────────┐
                    │  CAMADA DE EXTRAÇÃO │
                    │                     │
                    │  Claude API         │
                    │  Extrai campos:     │
                    │  empresa, município,│
                    │  valor, setor, tipo,│
                    │  data, fonte        │
                    └──────────┬──────────┘
                               │ JSON estruturado
                    ┌──────────▼──────────┐
                    │  CAMADA DE VALIDAÇÃO│
                    │                     │
                    │  CNPJ (Receita)     │
                    │  Município (SP?)    │
                    │  Duplicata?         │
                    │  Score confiança    │
                    └──────┬──────┬───────┘
                           │      │
              ┌────────────┘      └──────────────┐
              ▼                                  ▼
   ┌──────────────────┐               ┌──────────────────┐
   │  ALTA CONFIANÇA  │               │  REVISÃO HUMANA  │
   │  (aprovação auto)│               │  (curadoria)     │
   └────────┬─────────┘               └────────┬─────────┘
            │                                  │
            └──────────────┬───────────────────┘
                           ▼
              ┌────────────────────────┐
              │   STAGING PIESP        │
              │   (aguarda publicação) │
              └────────────┬───────────┘
                           │ (após ciclo de curadoria)
              ┌────────────▼───────────┐
              │   BANCO PIESP OFICIAL  │
              │   ← Nadia Analítica    │
              └────────────────────────┘
```

---

## Camada 1 — Coleta (fontes e agendamento)

### Fontes monitoradas

**Alta prioridade (dado mais confiável):**
- B3 Fatos Relevantes — RSS público, empresas listadas obrigadas a divulgar
- Diário Oficial do Estado de SP — licenças ambientais, aprovações de instalação
- BNDES — contratos aprovados (portal de transparência)
- ANEEL / ANTT / ANTAQ — concessões e autorizações de infraestrutura

**Média prioridade:**
- Valor Econômico, Estadão, Folha — seção de negócios e economia
- DCI, NovaCana, AgriPoint — imprensa especializada por setor
- Press releases via PR Newswire, Business Wire

**Baixa prioridade (requer mais validação):**
- Portais de prefeituras municipais
- LinkedIn institucional de empresas (seção "novidades")
- Sites de associações setoriais (FIESP, ANFAVEA, ABINEE)

### Agendamento

```
Diário (06h):     B3 Fatos Relevantes, Diário Oficial
A cada 6 horas:   Principais jornais de negócios
Semanal:          Fontes setoriais especializadas
Mensal:           BNDES, agências reguladoras
```

O Hermes background tasks ou um cron job com Claude agendado executa as coletas. Não requer n8n — o agendador do sistema operacional (cron) mais uma instrução em linguagem natural ao Claude é suficiente.

---

## Camada 2 — Extração (NLP estruturado)

Cada texto coletado passa por um prompt de extração. O Claude recebe o texto e retorna JSON estruturado:

```json
{
  "empresa": "Volkswagen do Brasil",
  "cnpj_provavel": "60.098.218/0001-44",
  "municipio_mencionado": "São Bernardo do Campo",
  "municipio_sp": true,
  "valor_anunciado_milhoes": 2800,
  "moeda": "BRL",
  "valor_confirmado": false,
  "setor_provavel": "Indústria",
  "tipo_provavel": "Modernização",
  "data_anuncio": "2026-03-15",
  "fonte_url": "https://...",
  "fonte_tipo": "fato_relevante_b3",
  "trecho_evidencia": "A Volkswagen do Brasil anunciou investimento de R$ 2,8 bilhões...",
  "confianca": 0.91
}
```

**Campos com confiança variável:**
- `municipio`: alta confiança se explícito; baixa se apenas "Grande SP" ou "interior"
- `tipo`: raramente explícito — o Claude infere pelo contexto
- `valor_confirmado`: verdadeiro apenas se a empresa explicitamente confirma (não só anuncia)

---

## Camada 3 — Validação (determinística)

Antes de qualquer revisão humana, verificações automáticas:

**CNPJ:** consulta à API pública da Receita Federal
- CNPJ ativo? Sede no Brasil?
- Razão social confere com o nome na notícia?

**Município:** confronto com lista oficial de municípios do Estado de SP
- O município mencionado existe no ESP?
- Se "Grande SP" ou "região de X" → flag para revisão humana

**Duplicata:** busca no banco por registros similares
- Mesma empresa + valor similar + período próximo → possível duplicata, flag

**Score de confiança final:**
```
fonte_tipo = fato_relevante_b3   → +0.30
cnpj_encontrado = true           → +0.20
municipio_explicito = true       → +0.20
valor_declarado = true           → +0.15
tipo_investimento_explicito      → +0.10
sem_duplicata                    → +0.05
                          Total máximo: 1.00
```

Registros com score ≥ 0.85 entram na fila de aprovação rápida.
Registros com score < 0.85 vão para revisão detalhada.
Registros com score < 0.40 são descartados automaticamente.

---

## Camada 4 — Revisão humana (curadoria)

O técnico não liga mais para a empresa na maioria dos casos. Ele vê:

```
┌──────────────────────────────────────────────────────┐
│  VOLKSWAGEN DO BRASIL                  Score: 0.91   │
│  São Bernardo do Campo · Indústria · Modernização    │
│  Valor anunciado: R$ 2,8 bilhões · Data: 15/03/2026  │
│                                                      │
│  Fonte: Fato Relevante B3 [ver original ↗]           │
│  Trecho: "...investimento de R$ 2,8 bilhões em       │
│  modernização da linha de produção..."               │
│                                                      │
│  CNPJ: 60.098.218/0001-44 ✓  Município SP ✓          │
│  Sem duplicata ✓                                     │
│                                                      │
│  [✓ Aprovar]  [✎ Editar]  [✗ Rejeitar]  [☎ Ligar]   │
└──────────────────────────────────────────────────────┘
```

**"Ligar"** aparece quando:
- Valor não foi divulgado publicamente
- Município é ambíguo ("região de Campinas")
- Tipo de investimento não identificável
- Empresa pequena sem histórico na base

---

## Banco de dados em duas camadas

**Staging (coleta automatizada):**
- Todos os registros coletados, com status: `pendente`, `aprovado`, `rejeitado`
- Visível apenas internamente
- Campo `origem`: `automatica_alta_confianca`, `automatica_revisada`, `ligacao_verificada`

**Oficial (publicação):**
- Apenas registros aprovados pelo curador
- Compatível com a estrutura atual da PIESP
- O campo `origem` preserva a proveniência — séries históricas são comparáveis

---

## Stack técnica

| Componente | Tecnologia | Justificativa |
|---|---|---|
| Agendador | Cron + Claude CLI | Sem dependência adicional |
| Extração web | Firecrawl API | Especializado, retorna markdown limpo |
| Portais interativos | Browser-use | Navega autenticamente quando necessário |
| NLP / extração | Claude API | Melhor extração estruturada disponível |
| Validação CNPJ | API Receita Federal (pública) | Determinístico |
| Banco staging | SQLite (início) / PostgreSQL | Escala conforme volume |
| Interface curadoria | React simples ou Hermes chat | A definir com os técnicos |
| Notificações | Hermes → Telegram | "15 novos registros aguardam revisão" |

---

## O que a Nadia Coletora não tenta fazer

Limites explícitos do sistema:

- **Não acessa fontes pagas** (assinatura de jornais premium) — risco legal e operacional
- **Não infere valores não divulgados** — o campo fica vazio, não estimado
- **Não decide sozinha** sobre o que entra na PIESP oficial — sempre passa pelo curador
- **Não substitui o julgamento editorial** do Seade sobre o que conta como investimento

---

## Roadmap de implementação

**Fase 1 — Prova de conceito (2–3 semanas):**
Coletar apenas B3 Fatos Relevantes + Valor Econômico. Extrair com Claude. Mostrar output para os técnicos da PIESP avaliarem a qualidade da extração. Sem banco, sem interface — só CSV de saída para revisão manual.

**Fase 2 — Pipeline completo (1–2 meses):**
Adicionar todas as fontes. Construir banco staging. Interface simples de curadoria. Validação automática de CNPJ e município.

**Fase 3 — Integração com PIESP oficial (definição institucional):**
Após decisão metodológica do Seade sobre como tratar dados de origem diferente. Integração com o banco oficial e ajuste das notas metodológicas da pesquisa.
