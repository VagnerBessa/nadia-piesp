# Troubleshooting - Nadia não ouve comandos de voz

## Sintomas
- Você permite o acesso ao microfone
- Mas nada acontece quando você fala
- A Nadia não responde

## Diagnóstico Passo a Passo

### 1. Abra o Console do Desenvolvedor
1. No Chrome, pressione **F12** (ou **Cmd+Option+J** no Mac)
2. Clique na aba **Console**
3. Deixe o console aberto

### 2. Clique no botão de Voz na Nadia
Observe as mensagens no console. Você deve ver uma sequência como esta:

#### ✅ Sequência Normal (Funcionando)
```
[Nadia] Starting conversation...
[Nadia] Requesting microphone access...
[Nadia] Navigator: MediaDevices {...}
[Nadia] Microphone access granted
[Nadia] Audio tracks: [MediaStreamTrack {...}]
[Nadia] GoogleGenAI initialized with API key: Present
[Nadia] Connecting to Gemini API...
[Nadia] Connected to Gemini API successfully
```

#### ❌ Possíveis Erros

##### Erro 1: API Key Ausente
```
[Nadia] GoogleGenAI initialized with API key: Missing
```
**Solução:** A API Key não está configurada corretamente em `config.ts`

##### Erro 2: Falha na Conexão com API
```
[Nadia] Session error: ...
[Nadia] Abnormal close code: 1006
```
**Possíveis causas:**
- API Key inválida ou expirada
- Problema de conexão com internet
- API Gemini temporariamente indisponível
- Modelo não existe ou foi descontinuado

##### Erro 3: Microfone Bloqueado
```
[Nadia] Failed to start conversation
[Nadia] Error name: NotAllowedError
```
**Solução:**
1. Clique no ícone de cadeado na barra de endereços
2. Procure "Microfone"
3. Mude para "Permitir"
4. Recarregue a página

##### Erro 4: Microfone não Encontrado
```
[Nadia] Error name: NotFoundError
```
**Solução:**
- Conecte um microfone ao computador
- Verifique se o microfone está funcionando em outras aplicações

##### Erro 5: Microfone em Uso
```
[Nadia] Error name: NotReadableError
```
**Solução:**
- Feche outras aplicações que podem estar usando o microfone (Zoom, Teams, etc.)

### 3. Verifique se o Áudio está Sendo Detectado

Quando você fala, deve aparecer no console:
```
[Nadia] Audio detected - RMS: 0.0234
```

Se isso NÃO aparecer quando você fala:
- O microfone pode estar mutado
- Você pode estar usando o microfone errado
- As configurações de sistema podem estar bloqueando o acesso

### 4. Verifique se a API está Respondendo

Quando a Nadia processa sua fala, você deve ver:
```
[Nadia] Received message from API: {...}
[Nadia] Received audio response from API
```

Se você vê "Audio detected" mas nunca vê "Received message":
- A API pode estar com problemas
- O modelo pode não estar disponível
- A API Key pode estar inválida

## Testes Específicos

### Teste 1: Teste de Microfone Isolado
1. Vá para: `http://localhost:3001/#mictest`
2. Clique em "Testar Microfone"
3. Permita o acesso
4. Fale - você deve ver uma barra verde se mexendo

Se o teste funcionar, o problema NÃO é o microfone.

### Teste 2: Verificar Permissões do Chrome
1. No Chrome, vá para: `chrome://settings/content/microphone`
2. Verifique se `http://localhost:3001` está na lista de "Permitidos"
3. Se estiver em "Bloqueados", mova para "Permitidos"

### Teste 3: Verificar Audio do Sistema
1. **Windows:** Configurações > Sistema > Som > Entrada
2. **Mac:** Preferências do Sistema > Som > Entrada
3. Fale e veja se a barra de volume se move

## Soluções Comuns

### Solução 1: Limpar Permissões e Tentar Novamente
```bash
# No Chrome, abra:
chrome://settings/content/siteDetails?site=http%3A%2F%2Flocalhost%3A3001
```
1. Role até "Microfone"
2. Clique em "Redefinir permissões"
3. Recarregue a página
4. Tente novamente

### Solução 2: Verificar API Key
Verifique se a API Key em `config.ts` está correta:
```typescript
export const GEMINI_API_KEY = "AIzaSy..."; // Deve ter ~39 caracteres
```

Para testar se a API Key funciona:
```bash
curl -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=SUA_API_KEY"
```

### Solução 3: Usar Outro Navegador
Teste no Firefox para isolar se é problema do Chrome:
```bash
open -a "Firefox" http://localhost:3001
```

### Solução 4: Reiniciar o Servidor
```bash
# Pare o servidor (Ctrl+C no terminal)
# Depois reinicie:
npm run dev
```

## Logs Completos - O que Procurar

Copie TODOS os logs do console que começam com `[Nadia]` e verifique:

1. ✅ "Microphone access granted" - Microfone OK
2. ✅ "GoogleGenAI initialized with API key: Present" - API Key OK
3. ✅ "Connected to Gemini API successfully" - Conexão OK
4. ✅ "Audio detected" - Captação de som OK
5. ✅ "Received message from API" - API respondendo OK
6. ✅ "Received audio response from API" - Áudio de resposta OK

Se TODOS esses aparecem mas você ainda não ouve a Nadia:
- Verifique o volume do sistema
- Verifique se as caixas de som/fones estão conectados
- Verifique as configurações de áudio de saída

## Ainda não Funciona?

Me envie os seguintes dados:

1. **Sistema Operacional:** (ex: macOS 15.1, Windows 11)
2. **Navegador e Versão:** (ex: Chrome 131.0.6778.86)
3. **Logs do Console:** Copie TODAS as linhas que começam com `[Nadia]`
4. **Mensagens de Erro:** Qualquer texto em vermelho no console
5. **Comportamento Observado:** O que acontece exatamente quando você clica no botão de voz?

## Links Úteis

- [Testar Microfone](http://localhost:3001/#mictest)
- [Configurações de Microfone do Chrome](chrome://settings/content/microphone)
- [Documentação Gemini API](https://ai.google.dev/gemini-api/docs/live)
