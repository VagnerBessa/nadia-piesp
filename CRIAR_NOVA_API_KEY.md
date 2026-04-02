# Como Criar uma Nova API Key do Gemini

## 🎯 Por Que Criar uma Nova API Key?

A API Key atual está vinculada a um projeto antigo do Google Cloud que não tem a Generative Language API habilitada. Criar uma nova API Key é mais rápido e simples.

## ✅ Passo a Passo (5 minutos)

### 1. Abra o Google AI Studio

Acabei de abrir para você, ou vá para:
**https://aistudio.google.com/app/apikey**

### 2. Faça Login
Use sua conta Google (se ainda não estiver logado)

### 3. Crie uma Nova API Key

Na página do Google AI Studio:

1. Clique no botão **"Create API Key"** ou **"Get API Key"**
2. Você verá duas opções:
   - **"Create API key in new project"** ← **ESCOLHA ESTA!**
   - "Create API key in existing project"
3. Clique em **"Create API key in new project"**
4. Aguarde alguns segundos
5. Sua nova API Key será gerada!

### 4. Copie a Nova API Key

1. A API Key aparecerá na tela (algo como: `AIzaSyA...`)
2. **Clique no ícone de copiar** (📋) ao lado da chave
3. A chave foi copiada para sua área de transferência!

### 5. Substitua no Arquivo config.ts

Agora vou te ajudar a substituir a API Key antiga pela nova.

**Me envie a nova API Key** (ou eu posso fazer isso automaticamente se você colar aqui)

## 🔄 Como Substituir (Manual)

Se preferir fazer manualmente:

1. Abra o arquivo: `/Users/vagnerbessa/Documents/projetos/Nadia-2/config.ts`
2. Encontre a linha 16:
   ```typescript
   const API_KEY = "AIzaSyBMEqqngzBcbZcaoklLAJzpgS0LgQsWs4k";
   ```
3. Substitua pela sua nova API Key:
   ```typescript
   const API_KEY = "SUA_NOVA_API_KEY_AQUI";
   ```
4. **Salve o arquivo** (Cmd+S ou Ctrl+S)

## ✅ Após Substituir

1. O Vite vai **recompilar automaticamente** (você verá no terminal)
2. **Recarregue a página** no Chrome (F5 ou Cmd+R)
3. **Teste a voz novamente**
4. Agora deve funcionar! 🎉

## 📝 Notas Importantes

- ✅ A nova API Key já vem com a Generative Language API habilitada automaticamente
- ✅ É gratuita com limites generosos
- ✅ Você pode verificar o uso em: https://aistudio.google.com/app/apikey
- ⚠️ Não compartilhe sua API Key publicamente
- ⚠️ Não faça commit da API Key para o GitHub

## 🆘 Se Tiver Problemas

Se ao criar a API Key você receber algum erro, pode ser que precise:

1. **Aceitar os Termos de Serviço** do Google AI
2. **Selecionar um país** nas configurações da conta
3. **Verificar sua conta Google** (em casos raros)

## 🎬 Alternativa: Script Automático

Depois que você me enviar a nova API Key, posso automaticamente:
1. Substituir no arquivo config.ts
2. Recarregar o navegador
3. Testar para você

Basta me enviar a chave que apareceu!
