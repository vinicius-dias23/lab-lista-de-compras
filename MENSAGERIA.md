# 🐇 Sistema de Mensageria com RabbitMQ

## 📝 Visão Geral

O sistema de Lista de Compras foi aprimorado com suporte a **mensageria assíncrona** usando **RabbitMQ**. Quando um usuário finaliza uma lista de compras através do endpoint de checkout, o sistema publica eventos que são processados de forma assíncrona por múltiplos consumers.

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                      List Service                            │
│                  (Producer - Porta 3003)                     │
│                                                               │
│  POST /lists/:id/checkout                                    │
│       ↓                                                       │
│  [Atualiza DB] → [Publica Evento] → Retorna 202 Accepted   │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
                ┌───────────────────────┐
                │      RabbitMQ         │
                │   Exchange: topic     │
                │ "shopping_events"     │
                │                       │
                │ Routing Key:          │
                │ "list.checkout.       │
                │  completed"           │
                └───────┬───────────────┘
                        ↓
        ┌───────────────┴───────────────┐
        ↓                               ↓
┌──────────────────┐          ┌──────────────────┐
│  Consumer A      │          │  Consumer B      │
│  Notification    │          │  Analytics       │
│  Service         │          │  Service         │
│                  │          │                  │
│ • Envia email    │          │ • Calcula stats  │
│ • Log comprovante│          │ • Atualiza       │
│                  │          │   dashboard      │
└──────────────────┘          └──────────────────┘
```

## 🎯 Cenário de Negócio: "Finalização de Compra"

Quando um usuário finaliza uma lista de compras (`POST /lists/:id/checkout`), o sistema:

1. **Atualiza o status da lista** para "completed"
2. **Publica um evento** no RabbitMQ com informações da lista e do usuário
3. **Retorna imediatamente** com status `202 Accepted`
4. **Processamento assíncrono** é feito pelos consumers:
   - **Consumer A (Notification)**: Simula envio de email com comprovante
   - **Consumer B (Analytics)**: Calcula estatísticas e atualiza dashboard

## 🚀 Como Executar

### 1. Iniciar o RabbitMQ

```bash
# Iniciar RabbitMQ com Docker Compose
docker-compose up -d

# Verificar se está rodando
docker ps
```

**RabbitMQ Management UI**: http://localhost:15672
- **Usuário**: guest
- **Senha**: guest

### 2. Iniciar os Microsserviços

```bash
# Método 1: Script automático (recomendado)
./start-all.sh

# Método 2: Manual
cd services/user-service && node start.js &
cd services/item-service && node start.js &
cd services/list-service && node start.js &
cd api-gateway && node start.js &
```

### 3. Iniciar os Consumers

```bash
# Método 1: Script automático
./start-consumers.sh

# Método 2: Manual em terminais separados
node consumers/notification-consumer.js
node consumers/analytics-consumer.js
```

### 4. Testar o Sistema

Use o cliente de demonstração ou faça requisições HTTP:

```bash
# Opção 1: Cliente interativo
node client-demo.js

# Opção 2: cURL (exemplo)
# 1. Fazer login e obter token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@exemplo.com","password":"senha123"}'

# 2. Criar uma lista
curl -X POST http://localhost:3000/api/lists \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{"name":"Compras do Mês","description":"Lista mensal"}'

# 3. Adicionar itens à lista
curl -X POST http://localhost:3000/api/lists/ID_DA_LISTA/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{"itemId":"ID_DO_ITEM","quantity":2}'

# 4. Fazer checkout (dispara eventos)
curl -X POST http://localhost:3000/api/lists/ID_DA_LISTA/checkout \
  -H "Authorization: Bearer SEU_TOKEN"
```

## 🎬 Demonstração em Sala de Aula

### Setup Inicial

1. **Mostrar RabbitMQ Management** (http://localhost:15672)
   - Interface zerada
   - Sem filas ou mensagens

2. **Iniciar todos os serviços**
   ```bash
   docker-compose up -d
   ./start-all.sh
   ./start-consumers.sh
   ```

3. **Abrir terminais para visualização**
   - Terminal 1: Logs do List Service
   - Terminal 2: Logs do Notification Consumer
   - Terminal 3: Logs do Analytics Consumer
   - Navegador: RabbitMQ Management UI

### Execução da Demo

1. **Fazer requisição de Checkout**
   ```bash
   node client-demo.js
   # Ou usar Postman/Insomnia
   ```

2. **Evidências a mostrar**:
   
   ✅ **API respondeu rapidamente** com `202 Accepted`
   ```json
   {
     "message": "Checkout processado com sucesso",
     "status": "accepted",
     "info": "O processamento assíncrono foi iniciado"
   }
   ```

   ✅ **Terminal do Notification Consumer** mostra:
   ```
   📧 Enviando comprovante da lista [ID] para o usuário [EMAIL]
      Lista: Compras do Mês
      Itens: 5
      Total estimado: R$ 123.45
   ✅ Notificação enviada com sucesso!
   ```

   ✅ **Terminal do Analytics Consumer** mostra:
   ```
   📊 Processando checkout da lista: Compras do Mês
      Total de itens: 5
      Total gasto: R$ 123.45
   
   📊 ESTATÍSTICAS ATUALIZADAS DO DASHBOARD:
      Total de checkouts processados: 1
      Receita total: R$ 123.45
      Ticket médio: R$ 123.45
   ```

   ✅ **RabbitMQ Management UI** mostra:
   - Exchange `shopping_events` criado
   - Filas `notification_queue` e `analytics_queue` ativas
   - Gráfico de mensagens: subindo (publish) e descendo (ack)
   - Mensagens processadas com sucesso

## 📋 Requisitos Técnicos Implementados

### ✅ 1. Producer (List Service)

- **Endpoint**: `POST /lists/:id/checkout`
- **Exchange**: `shopping_events` (tipo: topic)
- **Routing Key**: `list.checkout.completed`
- **Resposta**: `202 Accepted` (imediata)
- **Payload da mensagem**:
  ```json
  {
    "eventType": "checkout.completed",
    "timestamp": "2025-11-30T...",
    "list": {
      "id": "uuid",
      "name": "Nome da Lista",
      "userId": "uuid",
      "totalItems": 5,
      "estimatedTotal": 123.45,
      "items": [...]
    },
    "user": {
      "id": "uuid",
      "email": "usuario@exemplo.com",
      "username": "Usuario"
    }
  }
  ```

### ✅ 2. Consumer A (Log/Notification Service)

- **Fila**: `notification_queue`
- **Routing Key Pattern**: `list.checkout.#`
- **Função**: Simula envio de email/comprovante
- **Log no console**:
  ```
  📧 Enviando comprovante da lista [ID] para o usuário [EMAIL]
  ```

### ✅ 3. Consumer B (Analytics Service)

- **Fila**: `analytics_queue`
- **Routing Key Pattern**: `list.checkout.#`
- **Função**: Calcula estatísticas em tempo real
- **Métricas**:
  - Total de checkouts
  - Receita total
  - Total de itens vendidos
  - Ticket médio

## 🔧 Tecnologias Utilizadas

- **RabbitMQ 3.13**: Message broker
- **amqplib**: Cliente Node.js para AMQP
- **Docker & Docker Compose**: Containerização
- **Express.js**: API REST
- **Node.js**: Runtime

## 📊 Estrutura de Arquivos

```
lab-lista-de-compras/
├── docker-compose.yml              # Configuração do RabbitMQ
├── start-consumers.sh              # Script para iniciar consumers
├── MENSAGERIA.md                   # Esta documentação
├── services/
│   └── list-service/
│       ├── index.js                # Producer (endpoint checkout)
│       ├── rabbitmq.js             # Cliente RabbitMQ
│       └── package.json            # Dependências (+ amqplib)
└── consumers/
    ├── notification-consumer.js    # Consumer A
    ├── analytics-consumer.js       # Consumer B
    └── package.json                # Dependências dos consumers
```

## 🎯 Benefícios da Arquitetura Assíncrona

1. **Performance**: API responde imediatamente sem esperar processamento pesado
2. **Escalabilidade**: Consumers podem ser escalados independentemente
3. **Resiliência**: Se um consumer falhar, a mensagem é reprocessada
4. **Desacoplamento**: Serviços não dependem uns dos outros diretamente
5. **Flexibilidade**: Novos consumers podem ser adicionados sem modificar o producer

## 🔍 Monitoramento

### RabbitMQ Management UI

Acesse http://localhost:15672 para visualizar:

- **Exchanges**: `shopping_events`
- **Queues**: `notification_queue`, `analytics_queue`
- **Connections**: Producers e consumers conectados
- **Channels**: Canais de comunicação ativos
- **Message rates**: Taxa de mensagens publicadas/consumidas
- **Message stats**: Mensagens prontas, não confirmadas, totais

### Logs dos Consumers

```bash
# Visualizar logs em tempo real
tail -f logs/notification-consumer.log
tail -f logs/analytics-consumer.log
```

## 🛑 Parar os Serviços

```bash
# Parar consumers
pkill -f "notification-consumer"
pkill -f "analytics-consumer"

# Parar RabbitMQ
docker-compose down

# Parar microsserviços
pkill -f "node.*service"
```

## 📚 Referências

- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [AMQP 0-9-1 Model](https://www.rabbitmq.com/tutorials/amqp-concepts.html)
- [amqplib GitHub](https://github.com/amqplib/amqplib)

---

**Desenvolvido como parte do sistema de microsserviços de Lista de Compras** 🛒🐇
