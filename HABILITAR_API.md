# Como Habilitar a API Gemini

## ⚠️ Problema Identificado

A API Gemini (Generative Language API) **não está habilitada** no seu projeto do Google Cloud.

**Mensagem de erro:**
```
Generative Language API has not been used in project 1004609147210 before or it is disabled.
```

## ✅ Solução Rápida

Clique neste link para habilitar a API diretamente:

**🔗 [Habilitar Generative Language API](https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com?project=1004609147210)**

Ou use este link genérico (se o acima não funcionar):

**🔗 [https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=1004609147210](https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=1004609147210)**

## 📋 Passo a Passo Manual

Se os links acima não funcionarem, siga estes passos:

### 1. Acesse o Google Cloud Console
Vá para: https://console.cloud.google.com/

### 2. Selecione o Projeto Correto
- No topo da página, clique no seletor de projeto
- Procure pelo projeto: **1004609147210**
- Selecione-o

### 3. Abra a Biblioteca de APIs
- No menu lateral (☰), vá em: **APIs e Serviços** → **Biblioteca**
- Ou vá direto para: https://console.cloud.google.com/apis/library

### 4. Procure pela Generative Language API
- Na caixa de busca, digite: **Generative Language API**
- Clique no resultado: **Generative Language API**

### 5. Habilite a API
- Clique no botão azul: **ATIVAR** (ou **ENABLE**)
- Aguarde alguns segundos enquanto a API é habilitada

### 6. Confirme que está Habilitada
Você verá uma mensagem: "API habilitada" ou "API enabled"

## 🎯 Depois de Habilitar

1. **Volte ao Chrome** onde a Nadia está aberta
2. **Recarregue a página** (F5 ou Cmd+R)
3. **Tente usar a voz novamente**
4. Agora deve funcionar! 🎉

## 🔑 Alternativa: Criar Nova API Key

Se você preferir criar uma nova API Key com um projeto novo:

### 1. Acesse Google AI Studio
https://aistudio.google.com/app/apikey

### 2. Crie uma Nova API Key
- Clique em **"Create API Key"**
- Escolha **"Create API key in new project"** (ou use um projeto existente)
- Copie a nova API key

### 3. Atualize o Arquivo config.ts
Substitua a API key em `/config.ts`:

```typescript
const API_KEY = "SUA_NOVA_API_KEY_AQUI";
```

### 4. Salve e Recarregue
- Salve o arquivo
- O Vite vai recompilar automaticamente
- Recarregue a página no navegador

## ⚡ Método Mais Rápido

**Abrir o link e clicar em "Ativar":**

```bash
open "https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com?project=1004609147210"
```

## ✅ Verificação

Depois de habilitar, quando você usar a voz, deve ver no console:

```
[Nadia] Starting conversation...
[Nadia] Microphone access granted
[Nadia] GoogleGenAI initialized with API key: Present
[Nadia] Connecting to Gemini API...
[Nadia] Connected to Gemini API successfully  ← ESTA LINHA!
```

## 🆘 Se Ainda Não Funcionar

1. Verifique se você está logado na conta Google correta
2. Verifique se o projeto **1004609147210** existe e você tem acesso a ele
3. Considere criar uma nova API Key em um projeto novo

## 📝 Notas Importantes

- A API Gemini é **gratuita** com limites de uso
- Você pode verificar o uso em: https://console.cloud.google.com/apis/dashboard
- Se você criou a API key pelo Google AI Studio, a API já deve estar habilitada automaticamente
- Se estiver usando um projeto antigo do Google Cloud, pode precisar habilitar manualmente
