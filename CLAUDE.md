# CLAUDE.md — Contexto do Projeto Nadia-PIESP

Este arquivo é lido automaticamente pelo Claude Code no início de cada sessão. Contém decisões arquiteturais, convenções e histórico relevante para quem for trabalhar neste projeto.

---

## O que é este projeto

**Nadia** é uma assistente de IA da Fundação Seade especializada na **PIESP** (Pesquisa de Investimentos no Estado de São Paulo). Responde a perguntas sobre investimentos confirmados em SP, com interface de **chat** e **voz**.

Stack: React + TypeScript + Vite, rodando 100% no browser. Modelos Google Gemini via `@google/genai`.

---

## Arquitetura de Busca (decisão central)

### Por que não RAG nem contexto longo

- **RAG** falha: embeddings não preservam valores numéricos com precisão
- **Contexto longo** falha por dois motivos:
  1. Limite de payload WebSocket no browser (Chrome recusa frames grandes)
  2. "Colapso de atenção" — com 5.000+ linhas de CSV denso, o modelo alucina dados, mistura municípios e inventa cifras

### A solução: Function Calling + Filtragem determinística em JavaScript

Os CSVs são carregados em memória no browser via `import ... ?raw` (Vite). O modelo nunca lê os dados diretamente — ele chama ferramentas JavaScript que filtram o CSV deterministicamente:

```
Usuário pergunta
    ↓
Gemini decide qual ferramenta chamar e com quais argumentos
    ↓
JavaScript filtra o CSV linha a linha (O(n), < 100ms)
    ↓
Retorna JSON com top 10 + total
    ↓
Gemini formula a resposta em linguagem natural
```

### Regra de ouro

| Tipo de conteúdo | Estratégia | Por quê |
|---|---|---|
| Texto narrativo (metodologia, regras) | Contexto longo (systemInstruction) | LLMs compreendem prosa com excelência |
| Dados tabulares / CSV | Function Calling (Tools) | LLMs falham em filtrar e agregar linhas numéricas densas |
| Dados pequenos (dicionário ~2KB) | Contexto longo | Volume insignificante, sem risco de diluição |

---

## Bases de Dados

Os CSVs estão no `.gitignore` (dados sensíveis/grandes). Ficam em `/Seade/Piesp/` no iCloud do autor.

| Arquivo | Usado por | Descrição |
|---|---|---|
| `knowledge_base/piesp_mini.csv` | Tool 1 | Base principal com valor (~5.147 linhas, sem `descr_investimento` para reduzir tamanho) |
| `knowledge_base/piesp_confirmados_sem_valor.csv` | Tool 2 | Anúncios sem valor financeiro divulgado |

---

## Filtros de Busca (`services/piespDataService.ts`)

### Interface atual

```typescript
interface FiltroPiesp {
  ano?: string;       // match exato
  municipio?: string; // substring case-insensitive
  regiao?: string;    // substring — ex: "RA Campinas", "RMSP"
  tipo?: string;      // substring — "implantação", "ampliação", "modernização"
  setor?: string;     // substring — ex: "automotivo", "energia"
  empresa?: string;   // substring — ex: "Embraer", "Petrobras"
  descricao?: string; // OR por vírgula (ver abaixo)
}
```

### Mapeamento de índices — `piesp_mini.csv`

| Campo | Índice | Coluna original |
|---|---|---|
| ano | 1 | anuncio_ano |
| empresa | 3 | empresa_alvo |
| valor | 5 | reais_milhoes |
| municipio | 7 | municipio |
| regiao | 8 | regiao |
| descricao | 9 | descr_investimento |
| setor | 10 | setor_desc |
| tipo | 14 | tipo |

### Mapeamento de índices — `piesp_confirmados_sem_valor.csv`

Deslocado por 2 posições (sem `reais_milhoes` e `dolares_milhoes`): municipio=5, regiao=6, descricao=7, setor=8, tipo=12.

### Busca semântica via `descricao`

O campo aceita múltiplos termos separados por vírgula com lógica OR — uma única chamada à ferramenta:

```
descricao: "solar,eólic,fotovoltaic,biogás"
→ retorna linhas que contenham qualquer um dos termos
```

**Atenção:** usar **radicais** em vez de adjetivos completos para capturar variações de gênero/número em português:
- `"eólic"` → captura "eólico" e "eólica"
- `"fotovoltaic"` → captura "fotovoltaica" e "fotovoltaico"
- `"elétric"` → captura "elétrico", "elétrica", "elétricos"

O system prompt (`utils/prompts.ts`) instrui o modelo a usar essa convenção.

---

## Sistema de Skills (`services/skillDetector.ts`)

9 arquivos markdown em `skills/` com frameworks analíticos especializados. São injetados no system instruction com base em keyword matching da mensagem do usuário.

### Funcionamento

- Normaliza a mensagem (remove acentos, lowercase)
- Conta keywords de cada skill
- A skill com maior score é injetada no system instruction daquela chamada
- Skill com score 0 → responde como analista geral

### Tratamento especial: `inteligencia_empresarial`

Quando detectada, troca o conjunto de ferramentas: em vez de function calling PIESP, usa Google Search. Isso porque a pergunta é sobre a empresa em si, não sobre os dados tabulares.

### Limitação conhecida: skills não funcionam na voz

No **chat** (`useChat.ts`): skill injetada a cada mensagem. ✅

Na **voz** (`useLiveConnection.ts`): `systemInstruction` definida uma vez na abertura do WebSocket. A API Gemini Live não permite reinjeção por turno. As skills **não chegam** às respostas de voz. ❌

Opções avaliadas e descartadas: incluir todas as skills na instrução inicial (contexto inflado, sem foco) ou reconectar a sessão ao detectar keyword (latência, experiência quebrada). Limitação arquitetural do Gemini Live.

---

## Ferramentas Registradas

Declaradas em `hooks/useChat.ts` e `hooks/useLiveConnection.ts`:

| Nome | Quando usar |
|---|---|
| `consultar_projetos_piesp` | Qualquer pergunta sobre investimentos com valor divulgado |
| `consultar_anuncios_sem_valor` | Apenas quando usuário pede anúncios sem valor financeiro |

Google Search é usado como terceira ferramenta exclusivamente para `inteligencia_empresarial` (não pode ser combinado com function declarations na mesma chamada).

---

## Convenções de Código

- Filtros no serviço: sempre `substring` com `.toLowerCase()` — nunca match exato exceto `ano`
- Resultados: sempre top 10 ordenados por valor (maior primeiro) na base com valor; sem ordenação na base sem valor
- Ao adicionar novo filtro: atualizar `FiltroPiesp`, as duas funções de consulta, as tool declarations em `useChat.ts` e `useLiveConnection.ts`, e o `onToolCall` em `VoiceView.tsx`

---

## Histórico de Decisões

| Data | Decisão |
|---|---|
| Abr/2026 (sessão 1) | Descartado contexto longo para CSV; adotado Function Calling |
| Abr/2026 (sessão 1) | `piesp_mini.csv` criado sem `descr_investimento` para reduzir payload WebSocket |
| 03/04/2026 | Filtros expandidos de 2 para 7 campos |
| 03/04/2026 | Busca semântica via `descricao` com OR por vírgula, sem round-trips extras |
| 03/04/2026 | Bug de variação de gênero em português: usar radicais (`eólic`, não `eólica`) |
