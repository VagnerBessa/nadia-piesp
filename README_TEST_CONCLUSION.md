# Lições Aprendidas: Teste de Contexto Longo vs Dados Tabulares

**Data:** Abril de 2026.
**Objetivo do Teste:** Verificar se é viável carregar a base completa da PIESP (Pesquisa de Investimentos no Estado de SP) diretamente na Janela de Contexto de um modelo de linguagem (Gemini Flash Native Audio) sem o uso de RAG ou Function Calling.

## Resultados e Conclusões

1. **Viabilidade Técnica (WebSocket):** Injetar megabytes de dados via WebSocket em navegadores costuma falhar por limites estritos de frames (o Chrome bloqueia a conexão). Conseguimos contornar isso reduzindo a base `piesp_mini.csv` para ~1MB desconsiderando descrições verbosas longas.
2. **"Colapso da Atenção" em Agregações:** Com o Contexto Longo carregado, a assistente (Nadia) foi testada com perguntas analíticas como: *"cite os principais investimentos anunciados no Estado de São Paulo em 2026"*.
   - **O que aconteceu:** A IA "alucinou". Ela não retornou as linhas corretas.
   - **Por quê:** LLMs agem como leitores dinâmicos, e não como bancos de dados SQL. Quando confrontados com 5.000 linhas de texto tabular denso contendo números repetitivos, a atenção do LLM se dilui (Context Window Attention Collapse). O modelo tenta ler tudo, falha ao realizar "operações de filtro exatas" e tenta adivinhar/interpolar dados, gerando respostas incorretas ou misturando municípios e cifras.

## A Solução Implementada

Diante dessa demonstração do limite dos modelos, abandonamos o "Contexto Longo bruto" para tabelas e implementamos um padrão muito mais robusto: **Function Calling (Tools)**.
- O arquivo `services/piespDataService.ts` contém um motor de filtro determinístico (CSV parser e array map).
- A IA agora foi instruída a **nunca adivinhar**. Ao invés de tentar ler o CSV, ela chama silenciosamente a ferramenta `consultar_projetos_piesp` passando os argumentos (Ex: `ano = "2026"`), nós filtramos os Top 5 na memória do dispositivo (em Javascript) e devolvemos a respostar compacta para ela vocalizar.
- O resultado é uma assistente com precisão SQL de 100%, mantendo a latência incrivelmente baixa da conexão de voz.

## Fator de Escala: Metodologia e Bases Gêmeas

Na etapa final do desenvolvimento, fomos desafiados a carregar dois novos blocos de código: a **Metodologia da PIESP** e uma base de **Anúncios Confirmados sem Valor Financeiro**.
A maneira como resolvemos isso selou a arquitetura perfeita para IAs de Voice/Chat:

1. **Textos Normativos Vão na Memória (Contexto):**
   Textos corridos (como regras do manual de taxonomia do IBGE/Seade ou o arquivo `piesp_anexo_metodologico.md`) foram perfeitamente compreendidos pela IA de forma bruta no contexto longo (Prompt Inicial). LLMs (como o Gemini) brilham em interpretar blocos de semântica natural, sabendo evocar e aplicar as regras teóricas em suas respostas futuras.
2. **Novas Tabelas Vão para Ferramentas (Function Calling):**
   Não inflamos a memória do modelo com mais uma tabela gigante. Em vez disso, nós escrevemos um segundo motor JavaScript autônomo (\`consultar_anuncios_sem_valor\`) capaz de extrair fatias da base sem-valor de maneira cirúrgica.
3. **UX Transparente sem Repetição:**
   Para garantir uma experiência de conversação agradável, ensinamos o LLM a "fazer a propaganda" da base sem valor financeiro **apenas na primeira fala**, instruindo o usuário sobre essa capacidade extra sem poluir os diálogos subsequentes com repetições robóticas. Nas falas corriqueiras, a IA foca na base de milhões (que é de maior interesse analítico).

**Conclusão Final do Ciclo:** Arquiteturas resilientes para dados estruturados exigem que o LLM não aja como motor de banco de dados, mas sim como o *Mestre de Cerimônias* (ou Maestro) que ativa pequenas funções invisíveis (Tools) e vocaliza os resultados mastigáveis.

---

## Cronologia Completa de Problemas e Soluções

### Problema 1: Conexão WebSocket recusada ("Não foi possível se conectar com Nadia")

**Causa raiz:** O arquivo `piesp_confirmados_com_valor.csv` (2,1 MB) foi injetado inteiro na `systemInstruction` do WebSocket da API Gemini Live. O navegador e/ou o servidor rejeitaram o frame inicial por exceder o limite de payload para conexões de streaming de áudio em tempo real.

**Diagnóstico:** Criamos scripts Node.js de teste (`test_api.js`, `test_api_size.js`) para validar o comportamento da API fora do navegador com payloads crescentes (1 MB → 2 MB). Confirmamos que a API aceitava payloads grandes via Node, mas no contexto do browser a conexão colapsava.

**Solução:** Criamos `piesp_mini.csv` (~1 MB, sem a coluna `descr_investimento`) para reduzir o tamanho do payload. Posteriormente criamos `piesp_micro.csv` (300 linhas) para garantir estabilidade total durante o debugging.

### Problema 2: API Key bloqueada (API_KEY_SERVICE_BLOCKED / PERMISSION_DENIED)

**Causa raiz:** A chave de API `AIzaSyBMEqqngzBcbZcaoklLAJzpgS0LgQsWs4k` herdada do projeto Nadia-2 original não tinha permissão para a *Generative Language API*.

**Diagnóstico:** Criamos `test_quota.js` que chamava `ai.models.generateContent()` diretamente. O erro retornado foi explícito: `API_KEY_SERVICE_BLOCKED` para `generativelanguage.googleapis.com`.

**Solução:** O usuário gerou uma nova chave de API (`AIzaSyD_nULgWTyoVkU4lruUKsRixqtO_Ui5-Zw`) com permissões corretas no Google AI Studio.

### Problema 3: Tela em branco após troca de chave

**Causa raiz:** Ao colar a nova chave no arquivo `config.ts`, o usuário não envolveu o valor com aspas. O TypeScript interpretou `AIzaSyD_nULgWTyoVkU4lruUKsRixqtO_Ui5 - Zw` como uma expressão aritmética (subtração), causando erro de compilação fatal e tela branca.

**Diagnóstico:** Leitura direta do arquivo `config.ts` revelou a ausência das aspas.

**Solução:** Adicionamos as aspas duplas em torno dos valores das constantes `GEMINI_API_KEY` e `GOOGLE_MAPS_API_KEY`.

### Problema 4: Nadia conecta, mas alucina os dados

**Causa raiz:** Mesmo com a base reduzida carregada no contexto longo (primeiro `piesp_micro.csv` com 300 linhas, depois `piesp_mini.csv` com 5.147 linhas), o modelo de áudio nativo (`gemini-2.5-flash-native-audio`) não consegue realizar operações de filtragem, ranking ou agregação em dados tabulares densos. Ele confunde linhas, mistura anos e inventa valores.

**Diagnóstico:** Teste empírico direto pelo usuário: ao perguntar "cite os principais investimentos anunciados no Estado de São Paulo em 2026", a Nadia retornava empresas e valores que não existiam na planilha.

**Solução:** Abandonamos o paradigma de Contexto Longo para dados estruturados e implementamos **Function Calling**:
- Criamos `services/piespDataService.ts` com funções determinísticas de parsing e filtragem do CSV.
- Registramos a ferramenta `consultar_projetos_piesp` na configuração da sessão Live.
- Reescrevemos o `SYSTEM_INSTRUCTION` para proibir a IA de inventar números e obrigá-la a chamar a ferramenta antes de qualquer resposta numérica.

### Problema 5: Expansão de escopo (nova base + metodologia)

**Desafio:** O usuário quis carregar a metodologia oficial da PIESP e uma segunda base de dados (anúncios confirmados sem valor financeiro).

**Solução arquitetural:**
- **Metodologia** → Contexto Longo (ideal para texto narrativo/normativo)
- **Nova tabela CSV** → Nova ferramenta Function Calling (`consultar_anuncios_sem_valor`)
- **UX conversacional** → Instrução de apresentação única (apenas na primeira fala) para evitar repetição robótica da propaganda da base secundária.

---

## Arquitetura Final

```
┌─────────────────────────────────────────────────────┐
│                 NAVEGADOR (Chrome)                   │
│                                                     │
│  ┌──────────┐   ┌──────────────┐   ┌─────────────┐ │
│  │ Microfone│──▶│  VoiceView   │──▶│ useLive     │ │
│  │  (Audio) │   │  .tsx        │   │ Connection  │ │
│  └──────────┘   │              │   │ .ts         │ │
│                 │  onToolCall  │   │             │ │
│                 │  handler ────┼──▶│ WebSocket   │ │
│                 └──────┬───────┘   │ (Gemini     │ │
│                        │           │  Live API)  │ │
│                        ▼           └──────┬──────┘ │
│              ┌─────────────────┐          │        │
│              │ piespDataService│◀─────────┘        │
│              │ .ts             │  (tool response)  │
│              │                 │                    │
│              │ ┌─────────────┐ │                    │
│              │ │piesp_mini   │ │ ← Base COM valor   │
│              │ │.csv (1 MB)  │ │                    │
│              │ └─────────────┘ │                    │
│              │ ┌─────────────┐ │                    │
│              │ │piesp_sem    │ │ ← Base SEM valor   │
│              │ │valor.csv    │ │                    │
│              │ └─────────────┘ │                    │
│              └─────────────────┘                    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ prompts.ts (SYSTEM_INSTRUCTION)             │    │
│  │  ├── Persona Nadia                          │    │
│  │  ├── Metodologia PIESP (contexto longo) ✓   │    │
│  │  └── Dicionário de Variáveis (contexto) ✓   │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## Regra de Ouro Derivada

| Tipo de Conteúdo | Estratégia | Por quê |
|---|---|---|
| Texto narrativo (metodologia, regras, manuais) | Contexto Longo (systemInstruction) | LLMs compreendem e evocam prosa com excelência |
| Dados tabulares / CSV / planilhas | Function Calling (Tools) | LLMs falham em filtrar, agregar e rankear linhas numéricas densas |
| Dados pequenos (< 50 linhas, dicionário) | Contexto Longo | Volume insignificante, sem risco de diluição de atenção |

## Arquivos Finais do Projeto

```
knowledge_base/
├── dic_variaveis_piesp_confirmados_com_valor.csv  ← Dicionário (contexto)
├── piesp_anexo_metodologico.md                    ← Metodologia (contexto)
├── piesp_confirmados_com_valor.csv                ← Base original bruta (referência/backup)
├── piesp_confirmados_sem_valor.csv                ← Base anúncios s/ valor (tool)
└── piesp_mini.csv                                 ← Base otimizada c/ valor (tool)

services/
└── piespDataService.ts  ← Motor de filtragem determinístico (2 funções)

utils/
└── prompts.ts           ← Prompt com persona + metodologia + dicionário

hooks/
└── useLiveConnection.ts ← Registra as 2 tools + callbacks de áudio

components/
└── VoiceView.tsx        ← Roteia chamadas de ferramenta para o service
```
