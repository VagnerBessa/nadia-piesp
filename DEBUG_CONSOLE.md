# Como Copiar os Logs do Console para Debug

## 📋 Passos Rápidos

### 1. Abra o Console
- Pressione **F12** (ou **Cmd+Option+J** no Mac)
- Clique na aba **Console**

### 2. Limpe o Console
- Clique no ícone 🚫 (Clear console) no topo do console
- Ou pressione **Cmd+K** (Mac) ou **Ctrl+L** (Windows)

### 3. Tente Usar a Voz
- Clique no botão de microfone
- Permita o acesso (se pedir)
- **Fale algo claramente** (ex: "Olá, quem é você?")
- Aguarde 3-5 segundos

### 4. Filtre Apenas os Logs da Nadia
No topo do console, há uma caixa de busca "Filter". Digite:
```
[Nadia]
```

Isso vai mostrar APENAS as mensagens relevantes.

### 5. Copie TODAS as Mensagens [Nadia]

Você deve ver algo como:

```
[Nadia] Starting conversation...
[Nadia] Requesting microphone access...
[Nadia] Navigator: MediaDevices {...}
[Nadia] Microphone access granted
[Nadia] Audio tracks: [MediaStreamTrack {...}]
[Nadia] GoogleGenAI initialized with API key: Present
[Nadia] Connecting to Gemini API...
[Nadia] Connected to Gemini API successfully
[Nadia] Audio detected - RMS: 0.0234
[Nadia] Received message from API: {...}
[Nadia] Message type: modelTurn
[Nadia] Received audio response from API
```

### 6. Copie e Cole na Conversa

Clique com botão direito no console e selecione:
- **"Copy all messages"** (copiar todas as mensagens)
- Ou selecione manualmente as linhas e copie

Cole aqui na nossa conversa!

## 🔍 O Que Estou Procurando

Especificamente, preciso saber:

1. ✅ Você vê `[Nadia] Connected to Gemini API successfully`?
2. ✅ Você vê `[Nadia] Audio detected - RMS: X.XXXX` quando fala?
3. ✅ Você vê `[Nadia] Received message from API`?
4. ✅ Qual é o `Message type`? (modelTurn, toolCall, ou other?)
5. ✅ Você vê `[Nadia] Received audio response from API`?

## 🎯 Cenários Possíveis

### Cenário A: Tudo Funciona, Mas Sem Áudio
```
✅ Connected to Gemini API successfully
✅ Audio detected
✅ Received message from API
✅ Message type: modelTurn
✅ Received audio response from API
```
**Problema:** Áudio de saída (alto-falantes)

### Cenário B: API Responde, Mas Não em Áudio
```
✅ Connected to Gemini API successfully
✅ Audio detected
✅ Received message from API
❌ Message type: other (não modelTurn)
❌ Received audio response from API
```
**Problema:** Configuração da resposta da API

### Cenário C: Microfone Não Detecta
```
✅ Connected to Gemini API successfully
❌ Audio detected (não aparece)
```
**Problema:** Microfone mutado ou muito baixo

### Cenário D: Não Conecta na API
```
❌ Connected to Gemini API successfully
❌ [Nadia] Abnormal close code: ...
```
**Problema:** API Key ou modelo

## 💡 Atalho Rápido

No console, cole este comando para ver um resumo:
```javascript
console.log('=== RESUMO NADIA ===');
```

Depois me envie todo o conteúdo filtrado por `[Nadia]`.
