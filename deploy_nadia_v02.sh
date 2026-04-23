#!/bin/bash
# Script de Atualização Automatizada - Nadia-PIESP Mobile v0.2
# Este script automatiza o processo de pull, instalação e build para o ambiente do Seade.

echo "--------------------------------------------------"
echo "🚀 Iniciando Atualização: Nadia-PIESP Mobile v0.2"
echo "--------------------------------------------------"

# 1. Atualizar o repositório local com as mudanças do servidor
echo "📦 Buscando atualizações no Git..."
git fetch origin

# 2. Garantir que estamos na branch correta (0.2)
echo "🌿 Alternando para a branch nadia-mobile/0.2..."
git checkout nadia-mobile/0.2
git pull origin nadia-mobile/0.2

# 3. Instalar novas dependências (caso existam novos pacotes)
echo "🛠️  Instalando dependências (npm install)..."
npm install

# 4. Gerar os arquivos de produção (Pasta /dist)
echo "🏗️  Gerando build de produção (npm run build)..."
npm run build

echo "--------------------------------------------------"
echo "✅ Sucesso! A versão 0.2 foi compilada na pasta /dist."
echo "👉 Jasmil: Certifique-se de que o servidor web (Nginx/Apache) está apontando para esta pasta."
echo "--------------------------------------------------"
