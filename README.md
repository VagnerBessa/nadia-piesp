# Nadia Empreendedorismo Mobile

Assistente mobile da Fundacao Seade para consulta conversacional da base de empresas e empreendedorismo do Estado de Sao Paulo.

Esta branch deriva da versao mais atual do Nadia Mobile (`mobile/v2.3`) e preserva as funcionalidades centrais da experiencia mobile: pagina inicial, chat de texto, conversa por voz, fallback de modelo e interface otimizada para smartphones. O conteudo analitico foi migrado para empreendedorismo e para a base cadastral da Receita Federal exposta pelo MCP do Seade.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS + Material UI
- Google Gemini 2.5 Flash para chat
- Gemini Live API para voz
- OpenRouter como fallback no chat
- MCP remoto do Seade para consulta deterministica da base

## Como Rodar

```bash
npm install
npm run dev
```

Aplicativo local:

```text
http://localhost:3000
```

## Configuracao

Crie um arquivo `.env` na raiz.

Campos esperados:

```bash
VITE_GEMINI_API_KEY=SUA_CHAVE_GEMINI
VITE_GOOGLE_MAPS_API_KEY=SUA_CHAVE_MAPS
VITE_OPENROUTER_API_KEY=SUA_CHAVE_OPENROUTER_OPCIONAL
```

O `.env` fica fora do controle de versao. Depois de criar ou alterar o `.env`, reinicie o servidor Vite.

## Funcionalidades Mobile

- Home mobile com identidade visual "Deep Ocean".
- Chat de texto com function calling para a base de empreendedorismo.
- Conversa por voz usando Gemini Live API.
- Regras metodologicas embutidas para MEI, Inova Simples, sexo/genero, setores amplos e atividades economicas detalhadas.
- Fallback OpenRouter para manter o chat disponivel quando a API direta do Gemini falhar.
- Service worker e manifesto PWA para instalacao mobile.

## Base de Dados

A aplicacao nao carrega CSV ou Parquet no browser. As consultas tabulares passam por `services/empreendedorismoDataService.ts`, que chama o MCP remoto via `services/mcpService.ts`.

Dataset ativo:

```text
empresas-sp-mar26-20260522
```

Principios de uso:

- Empresas abertas usam `Data do inicio de atividade`.
- Empresas ativas usam `Situacao cadastral = Ativa`.
- MEI e identificado por `Opcao MEI = Sim`, nao por porte.
- Inova Simples e `Natureza juridica = Empresa Simples de Inovacao`.
- `Nao se aplica` em MEI/sexo deve ser explicado como classificacao cadastral, sem inferir genero ou perfil societario.

## Validacao

```bash
npm run build
```

Smoke test recomendado:

- Abrir `http://localhost:3000`.
- Conferir Home, Chat e Voz.
- No Chat, testar perguntas como:
  - "Quantas empresas foram abertas em Campinas em 2026?"
  - "Qual o ranking de municipios com empresas Inova Simples em 2026?"
  - "Mostre a evolucao de MEIs em Franca."
