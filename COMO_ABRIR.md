# Como Abrir a Nadia no Navegador

## O Problema

Você está tentando usar a Nadia através do ChatGPT. O ChatGPT não é um navegador web completo e **não tem acesso ao microfone**.

## A Solução

Você precisa abrir a Nadia em um navegador web real (Chrome, Firefox, Safari ou Edge).

## Passo a Passo

### 1. Certifique-se de que o servidor está rodando

O servidor já está rodando em:
```
http://localhost:3001/
```

### 2. Abra em um navegador real

Escolha uma das opções:

#### Opção A: Chrome (Recomendado)
1. Abra o Google Chrome
2. Na barra de endereços, digite: `http://localhost:3001`
3. Pressione Enter

#### Opção B: Firefox
1. Abra o Firefox
2. Na barra de endereços, digite: `http://localhost:3001`
3. Pressione Enter

#### Opção C: Safari (Mac)
1. Abra o Safari
2. Na barra de endereços, digite: `http://localhost:3001`
3. Pressione Enter

#### Opção D: Microsoft Edge
1. Abra o Microsoft Edge
2. Na barra de endereços, digite: `http://localhost:3001`
3. Pressione Enter

### 3. Permita o acesso ao microfone

Quando você clicar no botão de voz pela primeira vez, o navegador vai pedir permissão para acessar o microfone:

1. Clique no modo "Voz"
2. Clique no botão do microfone
3. Uma janela vai aparecer pedindo permissão
4. **Clique em "Permitir"** ou "Allow"

### 4. Teste o microfone

Para testar se o microfone está funcionando antes de usar a Nadia:

1. No navegador, vá para: `http://localhost:3001`
2. Abra o Console do Desenvolvedor (pressione F12)
3. Na barra de endereços do navegador, adicione `#mictest` ao final: `http://localhost:3001/#mictest`
4. Pressione Enter
5. Clique em "Testar Microfone"
6. Permita o acesso ao microfone
7. Fale algo - você deve ver uma barra verde se mexendo

## Dicas Importantes

- **Use Chrome ou Firefox** - são os navegadores com melhor suporte
- **Não use ChatGPT** - ele não consegue acessar seu microfone
- **Permita o microfone** - sempre clique em "Permitir" quando solicitado
- **Verifique seu microfone** - certifique-se de que está conectado e funcionando

## Se ainda não funcionar

1. Abra o Console do Desenvolvedor (F12)
2. Vá para a aba "Console"
3. Tente usar o modo voz
4. Copie as mensagens que aparecem (especialmente as que começam com `[Nadia]`)
5. Me envie essas mensagens para eu poder ajudar

## Atalho Rápido (Mac)

Se você estiver no Mac, pode abrir diretamente do Terminal:

```bash
open -a "Google Chrome" http://localhost:3001
```

ou

```bash
open http://localhost:3001
```
(isso vai abrir no navegador padrão)

## Atalho Rápido (Windows)

Se você estiver no Windows, pode abrir direto executando no PowerShell ou CMD:

```
start chrome http://localhost:3001
```

ou

```
start http://localhost:3001
```
(isso vai abrir no navegador padrão)
