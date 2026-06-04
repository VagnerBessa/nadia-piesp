# CLAUDE.md - Contexto do Projeto

Lido automaticamente por agentes de codigo no inicio de sessoes locais.

## Visao Geral

**Nadia Empreendedorismo Mobile** - assistente mobile da Fundacao Seade para consultas sobre empresas, MEIs, setores, municipios e natureza juridica na base de empreendedorismo do Estado de Sao Paulo.

- **Stack:** React 19 + TypeScript + Vite, Material UI + Tailwind CSS
- **IA:** Google Gemini 2.5 Flash no chat, Gemini Live API na voz
- **Dados:** MCP remoto do Seade, sem CSV/Parquet no browser
- **Canal:** mobile, com Home, Chat e Voz

## Regra de Ouro

| Conteudo | Estrategia |
|---|---|
| Regras metodologicas e conceitos | Prompt de sistema e skills markdown |
| Dados tabulares | Function calling via MCP |
| Sintese textual | Modelo generativo depois da consulta deterministica |

O modelo nunca deve filtrar a base por conta propria. Ele deve chamar a ferramenta, receber JSON compacto e entao explicar o resultado.

## Arquitetura Atual

```text
Browser mobile
  |-- LandingPage
  |-- ChatView -> useChat -> Gemini -> consultar_empresas_empreendedorismo -> MCP remoto
  |-- VoiceView -> useLiveConnection -> Gemini Live API -> consultar_empresas_empreendedorismo -> MCP remoto

MCP remoto
  |-- dataset empresas-sp-mar26-20260522
```

## Arquivos Centrais

| Arquivo | Papel |
|---|---|
| `App.tsx` | State machine mobile: home, chat, voice |
| `components/ChatView.tsx` | Interface de chat texto |
| `components/VoiceView.tsx` | Interface de voz |
| `hooks/useChat.ts` | Chat Gemini, function calling e fallback |
| `hooks/useLiveConnection.ts` | WebSocket Gemini Live API |
| `services/empreendedorismoDataService.ts` | Camada deterministica de consulta da base |
| `services/mcpService.ts` | Cliente JSON-RPC/SSE para o MCP remoto |
| `utils/prompts.ts` | Prompt base de empreendedorismo |
| `skills/empreendedorismo_receita_federal.md` | Conhecimento metodologico da base |

## Conceitos da Base

- Unidade de contagem: CNPJ.
- Empresas abertas: filtro por `Data do inicio de atividade`.
- Empresas ativas: filtro por `Situacao cadastral = Ativa`.
- MEI: usar `Opcao MEI = Sim`; nao usar porte para identificar MEI.
- Inova Simples: usar `Natureza juridica = Empresa Simples de Inovacao`.
- Sexo/genero: usar apenas quando o usuario pedir perfil de homens, mulheres ou genero.
- `Nao se aplica`: classificacao cadastral. No campo MEI, indica fora do universo MEI; no campo sexo, nao deve virar inferencia societaria.

## Regras Analiticas

Nao ha agentes manuais no chat mobile. As regras relevantes ficam no prompt base e em `skills/empreendedorismo_receita_federal.md`, porque elas afetam diretamente a interpretacao da base. A consulta externa so e usada automaticamente quando a pergunta pede perfil publico de empresa ou grupo economico.

## Function Calling

Ferramenta ativa:

```text
consultar_empresas_empreendedorismo
```

Parametros relevantes:

- `ano`, `ano_inicio`, `ano_fim`
- `data_inicio`, `data_fim`
- `municipio`, `regiao`, `setor`
- `termo_busca`
- `porte`, `opcao_mei`, `sexo`
- `natureza_juridica`
- `situacao`

## Resiliencia

- Chat tenta Gemini direto.
- Em falha, usa OpenRouter quando `OPENROUTER_API_KEY` estiver configurada.
- O fallback aguarda chamadas de ferramenta assíncronas.
- Voz usa Gemini Live API e responde com payloads compactos para evitar estouro no WebSocket.

## Validacao

```bash
npm run build
```

Smoke test:

1. Abrir `http://localhost:3000`.
2. Conferir Home, Chat e Voz.
3. Testar no chat:
   - "Quantas empresas foram abertas em Campinas em 2026?"
   - "Ranking de municipios com empresas Inova Simples em 2026."
   - "Participacao das mulheres entre MEIs em Franca ao longo do tempo."

## Convencoes

- Manter foco mobile: Home, Chat e Voz.
- Nao reintroduzir base tabular local no browser.
- Nao criar dashboards ou views desktop nesta branch.
- Ao mudar conceitos da base, atualizar `skills/empreendedorismo_receita_federal.md` e `utils/prompts.ts`.
