# Como Habilitar o Google Maps no Projeto

## 🗺️ Problema

O mapa na visualização de municípios não está carregando. O erro é:

```
ApiNotActivatedMapError: Google Maps JavaScript API has not been used in project before or it is disabled.
```

## ✅ Solução Rápida

Acabei de abrir a página de habilitação da API. Siga estes passos:

### 1. Na Página que Abriu

Você verá "Maps JavaScript API"

### 2. Clique em "ATIVAR" ou "ENABLE"

Aguarde alguns segundos enquanto a API é habilitada.

### 3. Aguarde a Confirmação

Você verá uma mensagem: "API habilitada" ou "API enabled"

### 4. Recarregue a Página da Nadia

No Chrome, pressione **F5** ou **Cmd+R**

### 5. Teste o Mapa

1. Clique no menu **"Municipal"** no header
2. O mapa deve carregar agora!

## 🔧 Alternativa: Habilitar Manualmente

Se a página não abriu, siga estes passos:

### 1. Vá para o Google Cloud Console

https://console.cloud.google.com/

### 2. Selecione Seu Projeto

No topo da página, selecione o projeto onde sua API Key foi criada.

### 3. Vá para APIs & Serviços

- Clique no menu ☰ (hambúrguer) no canto superior esquerdo
- Vá em: **APIs e Serviços** → **Biblioteca**

### 4. Procure por "Maps JavaScript API"

- Na barra de busca, digite: **Maps JavaScript API**
- Clique no resultado

### 5. Ative a API

- Clique no botão **ATIVAR** ou **ENABLE**
- Aguarde a confirmação

## 📋 APIs Necessárias para o Projeto Nadia

Para o projeto funcionar completamente, você precisa ter estas APIs habilitadas:

1. ✅ **Generative Language API** (para a Nadia conversar) - JÁ ATIVADA
2. ⚠️ **Maps JavaScript API** (para os mapas) - PRECISA ATIVAR
3. 🔧 **Geocoding API** (opcional, para buscar endereços)
4. 🔧 **Places API** (opcional, para buscar locais)

## 🆓 Custo

- A Maps JavaScript API é **GRATUITA** até:
  - 28.000 carregamentos de mapa por mês
  - Para uso normal, isso é mais que suficiente

- Você pode monitorar o uso em:
  https://console.cloud.google.com/apis/dashboard

## ⚠️ Importante

Depois de habilitar a API:

1. **Aguarde 1-2 minutos** para a ativação se propagar
2. **Recarregue a página** da Nadia no navegador
3. **Limpe o cache** se necessário (Cmd+Shift+R ou Ctrl+Shift+F5)

## 🔍 Verificar se Funcionou

Depois de habilitar:

1. Vá para a página de **Municipal** na Nadia
2. Abra o Console (F12)
3. Você **NÃO** deve mais ver o erro `ApiNotActivatedMapError`
4. O mapa deve carregar normalmente

## 🆘 Se Ainda Não Funcionar

Verifique se:

1. ✅ A API foi habilitada no **projeto correto**
2. ✅ Você aguardou 1-2 minutos após habilitar
3. ✅ Você recarregou a página da Nadia
4. ✅ A API Key no arquivo `config.ts` está correta

Se mesmo assim não funcionar, me envie o erro que aparece no console (F12).

## 📝 Links Úteis

- [Habilitar Maps JavaScript API](https://console.cloud.google.com/apis/library/maps-backend.googleapis.com)
- [Documentação Google Maps](https://developers.google.com/maps/documentation/javascript)
- [Dashboard de APIs](https://console.cloud.google.com/apis/dashboard)
