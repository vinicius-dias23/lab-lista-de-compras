#!/bin/bash

echo "🚀 Iniciando Consumers do RabbitMQ"
echo "════════════════════════════════════════════════════════"
echo ""

# Verificar se o RabbitMQ está rodando
echo "🔍 Verificando RabbitMQ..."
if ! nc -z localhost 5672 2>/dev/null; then
    echo "❌ RabbitMQ não está rodando!"
    echo "   Execute: docker-compose up -d"
    exit 1
fi

echo "✅ RabbitMQ está rodando"
echo ""

# Criar diretório de logs se não existir
mkdir -p logs

# Iniciar Notification Consumer
echo "📧 Iniciando Notification Consumer..."
node consumers/notification-consumer.js > logs/notification-consumer.log 2>&1 &
NOTIFICATION_PID=$!
echo "   PID: $NOTIFICATION_PID"

# Aguardar um pouco
sleep 2

# Iniciar Analytics Consumer
echo "📊 Iniciando Analytics Consumer..."
node consumers/analytics-consumer.js > logs/analytics-consumer.log 2>&1 &
ANALYTICS_PID=$!
echo "   PID: $ANALYTICS_PID"

echo ""
echo "✅ Consumers iniciados com sucesso!"
echo ""
echo "📋 Processos:"
echo "   Notification Consumer: PID $NOTIFICATION_PID"
echo "   Analytics Consumer: PID $ANALYTICS_PID"
echo ""
echo "📝 Logs disponíveis em:"
echo "   - logs/notification-consumer.log"
echo "   - logs/analytics-consumer.log"
echo ""
echo "Para visualizar os logs em tempo real:"
echo "   tail -f logs/notification-consumer.log"
echo "   tail -f logs/analytics-consumer.log"
echo ""
echo "Para parar os consumers:"
echo "   kill $NOTIFICATION_PID $ANALYTICS_PID"
echo ""
