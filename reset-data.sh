#!/bin/bash

# Script para limpar/resetar todos os dados do sistema

echo "🧹 === RESET DE DADOS DO SISTEMA ==="
echo "Este script irá remover todos os dados armazenados."
echo ""

read -p "⚠️  Tem certeza que deseja continuar? (s/N): " confirm

if [[ $confirm != [sS] ]]; then
    echo "❌ Operação cancelada."
    exit 0
fi

echo ""
echo "🗑️  Removendo dados dos serviços..."

# Remover dados do User Service
if [ -d "services/user-service/data" ]; then
    rm -rf services/user-service/data/*.json
    echo "✅ Dados do User Service removidos"
fi

# Remover dados do Item Service
if [ -d "services/item-service/data" ]; then
    rm -rf services/item-service/data/*.json
    echo "✅ Dados do Item Service removidos"
fi

# Remover dados do List Service
if [ -d "services/list-service/data" ]; then
    rm -rf services/list-service/data/*.json
    echo "✅ Dados do List Service removidos"
fi

# Remover registry
if [ -f "shared/registry.json" ]; then
    rm -f shared/registry.json
    echo "✅ Service Registry limpo"
fi

echo ""
echo "✅ Todos os dados foram removidos com sucesso!"
echo "💡 Os dados iniciais dos itens serão recriados automaticamente no próximo start."
echo ""
echo "🚀 Para reiniciar o sistema: ./start-all.sh"
