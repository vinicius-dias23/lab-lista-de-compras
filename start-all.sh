#!/bin/bash

# Script para iniciar todos os serviços do sistema de listas de compras

echo "🚀 Iniciando Sistema de Listas de Compras - Microsserviços"
echo "=========================================================="

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Por favor, instale o Node.js primeiro."
    exit 1
fi

# Verificar se o Yarn está instalado
if ! command -v yarn &> /dev/null; then
    echo "❌ Yarn não encontrado. Por favor, instale o Yarn primeiro."
    exit 1
fi

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Verificando dependências...${NC}"

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️ Dependências não encontradas. Executando instalação...${NC}"
    yarn install
fi

# Verificar dependências dos serviços
for service in user-service item-service list-service; do
    if [ ! -d "services/$service/node_modules" ]; then
        echo -e "${YELLOW}⚠️ Instalando dependências para $service...${NC}"
        cd "services/$service"
        yarn install
        cd ../..
    fi
done

# Verificar dependências do API Gateway
if [ ! -d "api-gateway/node_modules" ]; then
    echo -e "${YELLOW}⚠️ Instalando dependências para API Gateway...${NC}"
    cd api-gateway
    yarn install
    cd ..
fi

echo -e "${GREEN}✅ Todas as dependências verificadas${NC}"
echo ""

# Função para capturar Ctrl+C
trap 'echo -e "\n${RED}🛑 Parando todos os serviços...${NC}"; kill 0; exit' SIGINT

# Iniciar os serviços em background
echo -e "${BLUE}🚀 Iniciando serviços...${NC}"

# User Service (porta 3001)
echo -e "${YELLOW}👤 Iniciando User Service na porta 3001...${NC}"
cd services/user-service
node start.js &
USER_PID=$!
cd ../..

# Aguardar um pouco para o serviço inicializar
sleep 2

# Item Service (porta 3002)  
echo -e "${YELLOW}📦 Iniciando Item Service na porta 3002...${NC}"
cd services/item-service
node start.js &
ITEM_PID=$!
cd ../..

# Aguardar um pouco para o serviço inicializar
sleep 2

# List Service (porta 3003)
echo -e "${YELLOW}📝 Iniciando List Service na porta 3003...${NC}"
cd services/list-service
node start.js &
LIST_PID=$!
cd ../..

# Aguardar um pouco para o serviço inicializar
sleep 2

# API Gateway (porta 3000)
echo -e "${YELLOW}🌐 Iniciando API Gateway na porta 3000...${NC}"
cd api-gateway
node start.js &
GATEWAY_PID=$!
cd ..

# Aguardar todos os serviços iniciarem
echo -e "${BLUE}⏳ Aguardando serviços iniciarem completamente...${NC}"
sleep 5

echo ""
echo -e "${GREEN}✅ Todos os serviços foram iniciados!${NC}"
echo ""
echo "📋 URLs dos Serviços:"
echo -e "  🌐 API Gateway:   ${BLUE}http://localhost:3000${NC}"
echo -e "  👤 User Service:  ${BLUE}http://localhost:3001${NC}"
echo -e "  📦 Item Service:  ${BLUE}http://localhost:3002${NC}"
echo -e "  📝 List Service:  ${BLUE}http://localhost:3003${NC}"
echo ""
echo "📊 Endpoints principais:"
echo -e "  🏥 Health Check:  ${BLUE}http://localhost:3000/health${NC}"
echo -e "  📋 API Info:      ${BLUE}http://localhost:3000/api/info${NC}"
echo -e "  🔧 Registry:      ${BLUE}http://localhost:3000/registry${NC}"
echo ""
echo -e "${GREEN}🎯 Para testar o sistema, execute: ${YELLOW}node client-demo.js${NC}"
echo ""
echo -e "${RED}Para parar todos os serviços, pressione Ctrl+C${NC}"

# Aguardar até que o usuário pare os serviços
wait