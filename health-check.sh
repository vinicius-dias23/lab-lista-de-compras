#!/bin/bash

# Script para verificar a saúde de todos os serviços

echo "🏥 === VERIFICAÇÃO DE SAÚDE DOS SERVIÇOS ==="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para testar um serviço
check_service() {
    local name=$1
    local url=$2
    local port=$3
    
    if curl -s --max-time 5 "$url/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name (porta $port): OK${NC}"
        return 0
    else
        echo -e "${RED}❌ $name (porta $port): INDISPONÍVEL${NC}"
        return 1
    fi
}

# Função para testar conectividade
check_port() {
    local port=$1
    if nc -z localhost $port 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

echo -e "${BLUE}🔍 Verificando conectividade das portas...${NC}"

# Verificar se as portas estão abertas
declare -a ports=("3000" "3001" "3002" "3003")
declare -a services=("API Gateway" "User Service" "Item Service" "List Service")

all_ports_ok=true

for i in "${!ports[@]}"; do
    port=${ports[$i]}
    service=${services[$i]}
    
    if check_port $port; then
        echo -e "${GREEN}✅ Porta $port ($service): ABERTA${NC}"
    else
        echo -e "${RED}❌ Porta $port ($service): FECHADA${NC}"
        all_ports_ok=false
    fi
done

echo ""

if [ "$all_ports_ok" = false ]; then
    echo -e "${RED}❌ Alguns serviços não estão rodando!${NC}"
    echo -e "${YELLOW}💡 Execute './start-all.sh' para iniciar todos os serviços${NC}"
    exit 1
fi

echo -e "${BLUE}🏥 Verificando saúde dos serviços...${NC}"

# Verificar saúde dos serviços
services_healthy=0

check_service "User Service" "http://localhost:3001" "3001" && ((services_healthy++))
check_service "Item Service" "http://localhost:3002" "3002" && ((services_healthy++))  
check_service "List Service" "http://localhost:3003" "3003" && ((services_healthy++))
check_service "API Gateway" "http://localhost:3000" "3000" && ((services_healthy++))

echo ""

# Verificar API Gateway detalhadamente
echo -e "${BLUE}🌐 Verificando status completo via API Gateway...${NC}"

if curl -s --max-time 10 "http://localhost:3000/health" | grep -q "healthy"; then
    echo -e "${GREEN}✅ API Gateway: Respondendo corretamente${NC}"
    
    # Buscar informações detalhadas
    gateway_response=$(curl -s --max-time 10 "http://localhost:3000/health")
    if echo "$gateway_response" | grep -q "services"; then
        echo -e "${BLUE}📊 Resumo do sistema:${NC}"
        
        # Tentar extrair informações do JSON (modo simplificado)
        total_services=$(echo "$gateway_response" | grep -o '"total":[0-9]*' | tail -1 | cut -d':' -f2)
        healthy_services=$(echo "$gateway_response" | grep -o '"healthy":[0-9]*' | tail -1 | cut -d':' -f2)
        
        if [[ -n "$total_services" && -n "$healthy_services" ]]; then
            echo -e "   Serviços saudáveis: ${GREEN}$healthy_services${NC}/$total_services"
        fi
    fi
else
    echo -e "${RED}❌ API Gateway: Não está respondendo adequadamente${NC}"
fi

echo ""

# Resultado final
if [ $services_healthy -eq 4 ]; then
    echo -e "${GREEN}🎉 TODOS OS SERVIÇOS ESTÃO FUNCIONANDO PERFEITAMENTE!${NC}"
    echo ""
    echo -e "${BLUE}🚀 URLs para teste:${NC}"
    echo -e "   API Gateway:  ${YELLOW}http://localhost:3000/api/info${NC}"
    echo -e "   Health Check: ${YELLOW}http://localhost:3000/health${NC}"
    echo -e "   Service Registry: ${YELLOW}http://localhost:3000/registry${NC}"
    echo ""
    echo -e "${GREEN}✨ Para testar o sistema completo: ${YELLOW}node client-demo.js${NC}"
    exit 0
else
    echo -e "${RED}❌ $services_healthy/4 serviços estão funcionando${NC}"
    echo -e "${YELLOW}⚠️  Verifique os logs e tente reiniciar os serviços com falha${NC}"
    exit 1
fi
