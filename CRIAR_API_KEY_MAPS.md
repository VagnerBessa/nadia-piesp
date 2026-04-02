# Criar API Key para Google Maps

## 🎯 Problema Identificado

A API Key atual (`AIzaSyD_nULgWTyoVkU4lruUKsRixqtO_Ui5-Zw`) foi criada pelo Google AI Studio e **não tem permissão para usar Google Maps**.

## ✅ Solução: Criar Nova API Key para Maps

### Método 1: Via Google Maps Platform (RECOMENDADO)

Acabei de abrir a página correta. Siga:

1. **Na página que abriu**, clique em **"CREATE CREDENTIALS"**

2. Selecione **"API key"**

3. Uma nova chave será gerada automaticamente

4. **IMPORTANTE:** Clique em **"EDIT API KEY"** (ou o ícone de lápis/editar)

5. Configure a chave:
   - **Name:** "Nadia Maps Key" (ou outro nome)
   - **Application restrictions:** None (ou HTTP referrers se quiser)
   - **API restrictions:**
     - Selecione **"Restrict key"**
     - Marque APENAS:
       - ✅ Maps JavaScript API
       - ✅ Places API (New)
       - ✅ Geocoding API

6. Clique em **"SAVE"**

7. **Copie a nova API Key** (ela vai aparecer na lista)

### Método 2: Via Console Geral (Alternativa)

Se a página de Maps não abrir:

1. Vá para: https://console.cloud.google.com/apis/credentials

2. Clique em **"+ CREATE CREDENTIALS"** (topo da página)

3. Selecione **"API key"**

4. Copie a chave que aparecer

5. Clique em **"RESTRICT KEY"**

6. Configure:
   - **API restrictions:** Restrict key
   - Selecione:
     - Maps JavaScript API
     - Places API
     - Geocoding API

7. Salve

### 📝 Atualizar o Código

Depois de copiar a nova API Key:

1. Abra o arquivo: `config.ts`

2. Modifique para ter **duas chaves separadas**:

```typescript
const GEMINI_API_KEY = "AIzaSyD_nULgWTyoVkU4lruUKsRixqtO_Ui5-Zw"; // Para Gemini AI
const MAPS_API_KEY = "SUA_NOVA_CHAVE_AQUI"; // Para Google Maps

export { GEMINI_API_KEY };
export const GOOGLE_MAPS_API_KEY = MAPS_API_KEY;
```

3. Salve o arquivo

4. O Vite vai recompilar automaticamente

5. **Recarregue a página** da Nadia (F5)

6. Teste o mapa clicando em "Municipal"

### 🧪 Testar a Nova Chave

Depois de criar a nova chave, teste com o arquivo HTML:

1. Abra: `test-maps-simple.html`

2. Substitua a API Key na linha do script:
   ```html
   src="https://maps.googleapis.com/maps/api/js?key=SUA_NOVA_CHAVE&callback=initMap&v=weekly"
   ```

3. Recarregue a página

4. Deve aparecer: ✅ MAPA FUNCIONOU!

### ⚠️ Dica Importante

Por que isso aconteceu?

- A chave do **AI Studio** só tem permissão para **Generative Language API**
- O **Google Maps** precisa de uma chave criada via **Google Cloud Console**
- São sistemas de cobrança/permissão diferentes

### 🎯 Resumo Rápido

1. ✅ Criar nova API Key no Google Cloud Console
2. ✅ Restringir para Maps JavaScript API + Places + Geocoding
3. ✅ Copiar a chave
4. ✅ Atualizar `config.ts` com a nova chave
5. ✅ Recarregar a página
6. ✅ Testar o mapa

### 💡 Estrutura Final do config.ts

```typescript
// Chave para Gemini AI (criada no AI Studio)
const GEMINI_API_KEY = "AIzaSyD_nULgWTyoVkU4lruUKsRixqtO_Ui5-Zw";

// Chave para Google Maps (criada no Cloud Console)
const MAPS_API_KEY = "AIzaSy..."; // Sua nova chave aqui

export { GEMINI_API_KEY };
export const GOOGLE_MAPS_API_KEY = MAPS_API_KEY;
```

Isso mantém:
- ✅ Gemini funcionando (voz e chat)
- ✅ Maps funcionando (municípios)
- ✅ Cada API com sua própria chave
