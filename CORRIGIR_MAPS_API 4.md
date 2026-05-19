# Corrigir Erro: ApiNotActivatedMapError

## 🚨 Erro Atual

```
Google Maps JavaScript API error: ApiNotActivatedMapError
```

## ✅ Solução: Ativar TODAS as APIs Necessárias

A API Key precisa ter **várias APIs do Google Maps** habilitadas. Vamos ativar todas:

### 📋 Passo a Passo Completo

Acabei de abrir a lista de APIs do Google Maps. Agora siga:

#### 1. Verifique Seu Projeto

No topo da página, confirme que está no **projeto correto** (onde sua API Key foi criada).

#### 2. Ative ESTAS APIs (Uma por Uma):

Clique em cada link abaixo e clique em **"ATIVAR"**:

**APIs OBRIGATÓRIAS:**

1. **Maps JavaScript API**
   - https://console.cloud.google.com/apis/library/maps-backend.googleapis.com

2. **Places API (New)**
   - https://console.cloud.google.com/apis/library/places-backend.googleapis.com

3. **Geocoding API**
   - https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com

**APIs RECOMENDADAS (para funcionalidades extras):**

4. **Maps Elevation API**
   - https://console.cloud.google.com/apis/library/elevation-backend.googleapis.com

5. **Directions API**
   - https://console.cloud.google.com/apis/library/directions-backend.googleapis.com

### ⚡ Atalho Rápido (Copie e Cole)

Abra cada URL, clique em "ATIVAR", aguarde, e vá para a próxima:

```
https://console.cloud.google.com/apis/library/maps-backend.googleapis.com
https://console.cloud.google.com/apis/library/places-backend.googleapis.com
https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com
```

### ⏱️ IMPORTANTE: Aguarde Propagação

Depois de ativar **TODAS** as APIs:

1. **Aguarde 2-3 minutos** (sério, não pule essa parte!)
2. **Recarregue a página** da Nadia
3. **Limpe o cache** se necessário (Cmd+Shift+R ou Ctrl+Shift+F5)

### 🔍 Como Verificar Se Está Tudo Certo

Após ativar e aguardar:

1. Vá para: https://console.cloud.google.com/google/maps-apis/api-list
2. Você deve ver **TODAS** essas APIs com status **"Habilitada"**:
   - ✅ Maps JavaScript API
   - ✅ Places API
   - ✅ Geocoding API

### 🎯 Testar o Mapa

1. **Aguarde 2-3 minutos** após ativar tudo
2. **Recarregue a página** da Nadia (F5)
3. **Clique em "Municipal"** no menu
4. O mapa deve carregar! 🗺️

### ❌ Se AINDA Não Funcionar

#### Opção 1: Criar Nova API Key Especificamente para Maps

Se as APIs estiverem ativadas mas o erro persistir, pode ser que a API Key não tenha permissão. Neste caso:

1. Vá para: https://console.cloud.google.com/apis/credentials
2. Clique em **"Create Credentials"** → **"API Key"**
3. Uma nova chave será gerada
4. Clique em **"Restrict Key"**
5. Em "API restrictions", escolha **"Restrict key"**
6. Selecione APENAS as APIs do Maps:
   - Maps JavaScript API
   - Places API
   - Geocoding API
7. Salve
8. Copie a nova chave
9. Substitua em `config.ts` APENAS a `GOOGLE_MAPS_API_KEY`:

```typescript
export const GEMINI_API_KEY = "AIzaSyD_nULgWTyoVkU4lruUKsRixqtO_Ui5-Zw";
export const GOOGLE_MAPS_API_KEY = "SUA_NOVA_CHAVE_AQUI"; // Nova chave só para Maps
```

#### Opção 2: Verificar Restrições da API Key

1. Vá para: https://console.cloud.google.com/apis/credentials
2. Clique na sua API Key
3. Em "API restrictions", certifique-se de que está:
   - **"Don't restrict key"** (sem restrições)
   - OU com Maps JavaScript API, Places API e Geocoding API selecionadas
4. Em "Application restrictions", deixe como **"None"**
5. Salve

### 🆘 Última Opção: Usar Projeto Diferente

Se nada funcionar, crie uma API Key em um projeto totalmente novo:

1. Vá para: https://console.cloud.google.com/
2. Clique no seletor de projeto (topo da página)
3. Clique em **"New Project"**
4. Dê um nome (ex: "Nadia Maps")
5. Crie o projeto
6. Vá para APIs & Services → Credentials
7. Crie uma nova API Key
8. Ative as APIs necessárias
9. Use essa nova chave

## 📝 Resumo do Que Fazer AGORA

1. ✅ Ativar Maps JavaScript API
2. ✅ Ativar Places API
3. ✅ Ativar Geocoding API
4. ⏱️ Aguardar 2-3 minutos
5. 🔄 Recarregar a página da Nadia
6. 🧪 Testar clicando em "Municipal"

## 💡 Dica

O erro `ApiNotActivatedMapError` significa que **a API não está ativada no projeto da chave**. Certifique-se de:

1. Estar no **projeto correto** ao ativar as APIs
2. **Aguardar** a propagação (2-3 minutos)
3. **Recarregar** a página depois

É muito comum ativar a API no projeto errado, então confira bem!
