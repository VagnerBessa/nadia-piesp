# Nadia-PIESP

**Assistente de IA para análise de investimentos no Estado de São Paulo**  
Baseado no projeto Nadia (Fundação Seade) — adaptado para a PIESP.

---

## ⚠️ Configuração Após Clonar (Leitura Obrigatória)

Este repositório **não inclui** arquivos secretos nem bases de dados grandes por segurança e limite do GitHub. Após clonar, você precisa restaurar manualmente três coisas:

### 1. Chave de API do Gemini (`config.ts`)

Crie o arquivo `config.ts` na raiz do projeto (ele está no `.gitignore` — nunca sobe para o GitHub):

```ts
const API_KEY = "SUA_CHAVE_ANTIGA_OU_RESERVA";

export const GEMINI_API_KEY = "SUA_CHAVE_GEMINI_VALIDA";
export const GOOGLE_MAPS_API_KEY = "SUA_CHAVE_GOOGLE_MAPS";
```

- A chave do Gemini deve ser gerada em: **https://aistudio.google.com/apikey**
- Certifique-se de que a *Generative Language API* está habilitada no projeto do Google Cloud
- O modelo usado no modo Voz é: `gemini-2.5-flash-native-audio-preview-12-2025`
- O modelo usado no modo Chat é: `gemini-2.5-flash`

### 2. Bases de Dados PIESP (`knowledge_base/`)

Copie os seguintes arquivos para a pasta `knowledge_base/` (não estão no repositório por serem grandes demais):

| Arquivo | Tamanho | Usado por | Descrição |
|---|---|---|---|
| `piesp_mini.csv` | ~1 MB | `piespDataService.ts` (Tool 1) | Base principal de investimentos **com valor** (5.147 linhas, sem coluna `descr_investimento`) |
| `piesp_confirmados_sem_valor.csv` | ~1,8 MB | `piespDataService.ts` (Tool 2) | Anúncios confirmados **sem valor financeiro** divulgado |
| `piesp_confirmados_com_valor.csv` | ~2,1 MB | — (backup/fonte) | Base original completa com todas as colunas |

> **Onde encontrar:** Esses arquivos estão na pasta `/Seade/Piesp/` no iCloud Drive do autor.

### 3. Instalar dependências e rodar

```bash
npm install
npm run dev
```

O projeto estará disponível em **http://localhost:3000**

---

## Repositório GitHub

- **URL:** https://github.com/VagnerBessa/nadia-piesp
- **Visibilidade:** Privado
- **Criado em:** Abril de 2026
- **Branch principal:** `main`

Para salvar novas alterações:
```bash
git add .
git commit -m "descrição da mudança"
git push
```

---

## 🌐 O Ecossistema Nadia — Visão Arquitetural

Nadia não é apenas uma aplicação de navegador isolada. Ela é um ecossistema inteligente multi-canal da **Fundação Seade**, desenhado sob o princípio de que a inteligência artificial corporativa deve existir onde o dado é produzido e fluir organicamente:

1. **Nadia Web (PIESP)**: Interface rica (este projeto primário). Foca em profundidade analítica, com dashboards generativos (Data Lab), modo de exploração espacial por Voz/Mapas 3D e function calling determinístico do Gemini 2.5. Não retém memória contextual (cada relatório começa puro).
2. **Nadia API (MCP Servers)**: Os dados subjacentes da Fundação abstraídos em servidores baseados no _Model Context Protocol_. Isso significa que as informações de emprego, contas regionais ou infraestrutura não vivem presas à Nadia, mas podem ser consumidas por qualquer cliente aberto (como o Claude Desktop, scripts ou agentes de terceiros).
3. **Nadia Mobile (Motor Hermes)** _(Em Roadmap)_: O acesso onipresente. Um agente autônomo projetado para canais de mensageria (Telegram/WhatsApp) que servirá de "cérebro persistente", conectando os múltiplos MCP servers (Economia, Trabalho, Demografia) para responder queries cruzadas, aprendendo com o contexto do analista.

---

## ✨ Funcionalidades Core (Frontend)

- **Conversação por Voz**: Interação fluida usando o Gemini 2.5 Flash Native Audio API
- **Mapas 3D Interativos**: Navegação controlada por voz via Google Maps JavaScript API
- **Agentes Analíticos Especializados**: O Chat suporta injeção de agentes de economia (Emprego, Comércio Exterior, Infraestrutura, etc.) coordenados de forma modular
- **Análise Econômica (Data Lab)**: Visualização generativa de dados econômicos com gráficos em Recharts interagindo de forma granular com Recharts e Tailwind
- **Interface Responsiva**: Design moderno com Material-UI e Tailwind CSS
- **Esfera 3D Animada**: Visualização da Nadia com shaders personalizados usando Three.js

## 🚀 Como Executar Localmente

### Pré-requisitos

- Node.js (versão 16 ou superior)
- npm ou yarn
- Google Chrome, Firefox ou Edge (para suporte a microfone)

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Chaves de API

O projeto requer **duas chaves de API diferentes**:

#### a) Chave para Gemini AI (Google AI Studio)

1. Acesse: https://aistudio.google.com/app/apikey
2. Clique em "Create API Key"
3. Copie a chave gerada

#### b) Chave para Google Maps (Google Cloud Console)

1. Acesse: https://console.cloud.google.com/apis/credentials
2. Clique em "Create Credentials" → "API Key"
3. Clique em "Restrict Key" e habilite:
   - Maps JavaScript API
   - Places API
   - Geocoding API
4. Copie a chave gerada

#### c) Criar arquivo de configuração

1. Copie o arquivo de exemplo:
   ```bash
   cp config.example.ts config.ts
   ```

2. Edite o arquivo `config.ts` e insira suas chaves:
   ```typescript
   const GEMINI_API_KEY = "SUA_CHAVE_GEMINI_AQUI";
   const GOOGLE_MAPS_API_KEY = "SUA_CHAVE_MAPS_AQUI";
   export { GEMINI_API_KEY, GOOGLE_MAPS_API_KEY };
   ```

⚠️ **IMPORTANTE**: O arquivo `config.ts` está no `.gitignore` e **nunca deve ser commitado** para evitar expor suas chaves de API.

### 3. Executar o Servidor de Desenvolvimento

```bash
npm run dev
```

O aplicativo estará disponível em: http://localhost:3001

### 4. Usar a Aplicação

1. **Abra no navegador**: Use Google Chrome, Firefox ou Edge
2. **Permita o microfone**: Quando solicitado, clique em "Permitir"
3. **Interaja com a Nadia**:
   - Clique no ícone de microfone para ativar a conversa por voz
   - No modo Municipal, use comandos como "vá para Campinas" ou "mostre São Paulo"

## 📁 Estrutura do Projeto

```
Nadia-2/
├── components/          # Componentes React
│   ├── NadiaSphere.tsx         # Esfera 3D animada
│   ├── GoogleMaps3DView.tsx    # Visualização de mapas 3D
│   ├── PerfilMunicipalView.tsx # Modo de navegação municipal
│   └── ...
├── hooks/               # Custom React Hooks
│   └── useLiveConnection.ts    # Hook para Gemini Live API
├── shaders/             # Shaders GLSL para Three.js
├── utils/               # Utilitários e constantes
├── config.ts            # Chaves de API (não versionado)
├── config.example.ts    # Template de configuração
└── ...
```

## 🛠️ Tecnologias Utilizadas

- **React 19** com TypeScript
- **Vite** para build e HMR
- **Google Gemini 2.5 Flash** (Native Audio API)
- **Google Maps JavaScript API** com renderização 3D
- **Three.js** para gráficos 3D
- **Material-UI** para componentes de interface
- **Tailwind CSS** para estilização
- **Web Speech API** para reconhecimento de voz

## 🐛 Troubleshooting

### Nadia não responde aos comandos de voz

1. Verifique se você está usando Chrome, Firefox ou Edge
2. Confirme que deu permissão para o microfone
3. Abra o Console (F12) e procure por erros com o prefixo `[Nadia]`
4. Verifique se a chave `GEMINI_API_KEY` está correta no `config.ts`

### Mapas não carregam no modo Municipal

1. Verifique se a chave `GOOGLE_MAPS_API_KEY` está correta no `config.ts`
2. Confirme que as APIs necessárias estão habilitadas no Google Cloud Console:
   - Maps JavaScript API
   - Places API
   - Geocoding API
3. Aguarde 2-3 minutos após habilitar as APIs (tempo de propagação)
4. Limpe o cache do navegador (Cmd+Shift+R ou Ctrl+Shift+F5)

### Erro: "API has not been used in project before or it is disabled"

Isso significa que a API não está habilitada no projeto da sua chave:

1. Para Gemini: Acesse https://aistudio.google.com/app/apikey
2. Para Maps: Acesse https://console.cloud.google.com/apis/library
3. Habilite as APIs necessárias
4. Aguarde alguns minutos para a propagação

### Erro no Console: "Cannot read properties of undefined (reading 'lat')"

Esse erro foi corrigido. Se ainda aparecer:
1. Recarregue a página completamente
2. Certifique-se de que está usando a versão mais recente do código

## 🔒 Segurança

- **Nunca faça commit** do arquivo `config.ts`
- As chaves de API são pessoais e não devem ser compartilhadas
- Em produção, use variáveis de ambiente ao invés de arquivos de configuração
- Monitore o uso das suas APIs em:
  - Gemini: https://aistudio.google.com/app/apikey
  - Maps: https://console.cloud.google.com/apis/dashboard

## 💰 Custos

### Google Gemini AI
- Plano gratuito disponível com limites generosos
- Verifique os limites em: https://ai.google.dev/pricing

### Google Maps
- **Gratuito** até 28.000 carregamentos de mapa por mês
- Plano gratuito inclui $200 de crédito mensal
- Monitore o uso em: https://console.cloud.google.com/apis/dashboard

## 📚 Documentação Adicional

- [COMO_ABRIR.md](COMO_ABRIR.md) - Guia detalhado para abrir o projeto
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Soluções para problemas comuns
- [HABILITAR_API.md](HABILITAR_API.md) - Como habilitar a API do Gemini
- [CRIAR_API_KEY_MAPS.md](CRIAR_API_KEY_MAPS.md) - Como criar chave para Google Maps
- [DEBUG_CONSOLE.md](DEBUG_CONSOLE.md) - Como usar o console para debug

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto é privado e proprietário. Todos os direitos reservados.

## 🙋 Suporte

Se encontrar problemas ou tiver dúvidas:

1. Consulte a documentação na pasta do projeto
2. Verifique o Console do navegador (F12) para mensagens de erro
3. Abra uma issue no GitHub com:
   - Descrição do problema
   - Mensagens de erro do console
   - Passos para reproduzir o problema

---

Desenvolvido com ❤️ usando Google Gemini AI e Google Maps
