# Sistema de Listas de Compras - Microsserviços

## 📋 Visão Geral

Sistema completo de microserviços para gerenciamento de listas de compras desenvolvido em Node.js. O sistema permite que usuários criem e gerenciem suas listas de compras, com um catálogo completo de produtos organizados por categorias.

🆕 **NOVO**: Sistema de **mensageria assíncrona com RabbitMQ** para processamento de eventos de checkout! Veja [MENSAGERIA.md](MENSAGERIA.md) para detalhes..

## 🏗️ Arquitetura

O sistema é composto por 4 microsserviços principais e um API Gateway:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Service  │    │  Item Service   │    │  List Service   │
│   (porta 3001)  │    │   (porta 3002)  │    │   (porta 3003)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   API Gateway   │
                    │   (porta 3000)  │
                    └─────────────────┘
                             │
                    ┌─────────────────┐
                    │ Service Registry │
                    │  (compartilhado) │
                    └─────────────────┘
```

### Componentes:

- **API Gateway (porta 3000)**: Ponto único de entrada, roteamento e descoberta de serviços
- **User Service (porta 3001)**: Gerenciamento de usuários e autenticação JWT
- **Item Service (porta 3002)**: Catálogo de produtos e categorias  
- **List Service (porta 3003)**: Gerenciamento de listas de compras
- **Service Registry**: Descoberta de serviços e health checks
- **Bancos JSON**: Armazenamento baseado em arquivos JSON

## 🚀 Instalação Rápida

### Pré-requisitos

- Node.js (versão 16 ou superior)
- Yarn ou npm (gerenciador de pacotes)
- Docker e Docker Compose (para RabbitMQ - opcional)

### Instalação Automática

1. Clone ou faça download do projeto
2. Execute o script de instalação:

```bash
# Torna o script executável
chmod +x start-all.sh

# Inicia todos os serviços (instala dependências automaticamente)
./start-all.sh
```

### Instalação Manual

Se preferir instalar manualmente:

```bash
# 1. Instalar dependências dos módulos compartilhados (IMPORTANTE!)
cd shared && npm install && cd ..

# 2. Instalar dependências dos serviços
cd services/user-service && npm install && cd ../..
cd services/item-service && npm install && cd ../..
cd services/list-service && npm install && cd ../..
cd api-gateway && npm install && cd ..

# 3. Instalar dependências dos consumers (para mensageria)
cd consumers && npm install && cd ..

# 4. (Opcional) Instalar dependências para testes
npm install
```

**Notas Importantes**:
- ⚠️ **OBRIGATÓRIO**: Instale as dependências do diretório `shared/` primeiro!
- Use `npm install` em vez de `yarn install` para evitar problemas de compatibilidade
- O diretório `shared/` contém módulos usados por todos os serviços (uuid, axios)

## 🎮 Como Usar

### Método 1: Script Automático
```bash
# Iniciar todos os serviços
./start-all.sh

# Em outro terminal, executar o cliente de demonstração
node client-demo.js
```

### Método 2: Serviços Individuais

Em terminais separados:

```bash
# Terminal 1 - User Service
cd services/user-service && node start.js

# Terminal 2 - Item Service  
cd services/item-service && node start.js

# Terminal 3 - List Service
cd services/list-service && node start.js

# Terminal 4 - API Gateway
cd api-gateway && node start.js

# Terminal 5 - Cliente de demonstração
node client-demo.js
```

## 🌐 Endpoints da API

### API Gateway - http://localhost:3000

#### Endpoints de Sistema
- `GET /health` - Status de todos os serviços
- `GET /registry` - Serviços registrados  
- `GET /api/info` - Informações da API
- `GET /api/dashboard` - Dashboard do usuário (requer autenticação)
- `GET /api/search?q=termo` - Busca global

#### Roteamento para Serviços
- `/api/auth/*` → User Service
- `/api/users/*` → User Service
- `/api/items/*` → Item Service
- `/api/categories` → Item Service
- `/api/lists/*` → List Service

### User Service - http://localhost:3001

```http
POST /auth/register          # Cadastro de usuário
POST /auth/login             # Login
GET  /users/:id              # Dados do usuário
PUT  /users/:id              # Atualizar perfil
GET  /stats                  # Estatísticas
```

### Item Service - http://localhost:3002

```http
GET  /items                  # Listar itens (com filtros)
GET  /items/:id              # Item específico
POST /items                  # Criar item (requer autenticação)
PUT  /items/:id              # Atualizar item
GET  /categories             # Listar categorias
GET  /search?q=termo         # Buscar itens
GET  /stats                  # Estatísticas
```

### List Service - http://localhost:3003

```http
POST   /lists                    # Criar lista
GET    /lists                    # Listar listas do usuário
GET    /lists/:id                # Lista específica
PUT    /lists/:id                # Atualizar lista
DELETE /lists/:id                # Deletar lista
POST   /lists/:id/items          # Adicionar item à lista
PUT    /lists/:id/items/:itemId  # Atualizar item na lista
DELETE /lists/:id/items/:itemId  # Remover item da lista
GET    /lists/:id/summary        # Resumo da lista
POST   /lists/:id/checkout       # Finalizar compra (🆕 com mensageria)
GET    /stats                    # Estatísticas
```

## 📊 Dados Iniciais

O sistema vem com **22 itens pré-cadastrados** distribuídos em 5 categorias:

- **Alimentos** (7 itens): Arroz, Feijão, Macarrão, Óleo, Açúcar, Café, Leite
- **Limpeza** (5 itens): Detergente, Sabão em pó, Desinfetante, Água sanitária, Esponja
- **Higiene** (5 itens): Shampoo, Sabonete, Pasta de dente, Papel higiênico, Desodorante  
- **Bebidas** (3 itens): Refrigerante, Suco, Água mineral
- **Padaria** (2 itens): Pão de forma, Biscoito, Bolo

## 🔧 Funcionalidades Técnicas

### Service Discovery
- Registro automático de serviços
- Health checks a cada 30 segundos
- Cleanup automático na saída

### Circuit Breaker
- Abre o circuito após 3 falhas consecutivas
- Timeout de 60 segundos para tentar novamente
- Estados: closed → open → half-open

### Autenticação JWT
- Tokens com validade de 24 horas
- Middleware de autenticação em rotas protegidas
- Hash de senhas com bcrypt (12 rounds)

### Rate Limiting
- 1000 requisições por IP a cada 15 minutos
- Aplicado no API Gateway

### Logging
- Logs estruturados com Morgan
- Logs de erro detalhados
- Identificação de serviços nas requisições

## 📱 Cliente de Demonstração

O `client-demo.js` oferece um menu interativo que demonstra:

1. **Verificação de saúde** dos serviços
2. **Registro de usuário** com validação
3. **Login** com JWT
4. **Busca de itens** por termo
5. **Listagem de categorias** 
6. **Criação de listas** de compras
7. **Adição de itens** às listas
8. **Dashboard** com estatísticas
9. **Busca global** (itens + listas)

## 🗂️ Estrutura do Projeto

```
lista-compras-microservices/
├── package.json                 # Dependências principais
├── start-all.sh                # Script para iniciar todos os serviços
├── client-demo.js              # Cliente de demonstração
├── README.md                   # Esta documentação
├── shared/                     # Componentes compartilhados
│   ├── JsonDatabase.js         # Classe para banco JSON
│   └── serviceRegistry.js      # Descoberta de serviços
├── services/                   # Microsserviços
│   ├── user-service/           # Serviço de usuários
│   │   ├── index.js           # Servidor principal
│   │   ├── start.js           # Script de inicialização
│   │   └── data/              # Banco de dados JSON
│   ├── item-service/           # Serviço de itens
│   │   ├── index.js           
│   │   ├── start.js           
│   │   └── data/              
│   └── list-service/           # Serviço de listas
│       ├── index.js           
│       ├── start.js           
│       └── data/              
└── api-gateway/                # Gateway de API
    ├── index.js               # Servidor principal
    └── start.js               # Script de inicialização
```

## 🔐 Schemas dos Dados

### Usuário
```json
{
  "id": "uuid",
  "email": "string",
  "username": "string",
  "password": "string (hash)",
  "firstName": "string", 
  "lastName": "string",
  "preferences": {
    "defaultStore": "string",
    "currency": "string"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### Item
```json
{
  "id": "uuid",
  "name": "string",
  "category": "string",
  "brand": "string",
  "unit": "string", 
  "averagePrice": "number",
  "barcode": "string",
  "description": "string",
  "active": "boolean",
  "createdAt": "timestamp"
}
```

### Lista
```json
{
  "id": "uuid",
  "userId": "string",
  "name": "string",
  "description": "string",
  "status": "active|completed|archived",
  "items": [{
    "itemId": "string",
    "itemName": "string",
    "quantity": "number",
    "unit": "string",
    "estimatedPrice": "number",
    "purchased": "boolean",
    "notes": "string",
    "addedAt": "timestamp"
  }],
  "summary": {
    "totalItems": "number",
    "purchasedItems": "number",
    "estimatedTotal": "number"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## 🛠️ Tecnologias Utilizadas

- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **JWT** - Autenticação
- **bcryptjs** - Hash de senhas
- **Axios** - Cliente HTTP
- **UUID** - Geração de identificadores únicos
- **CORS** - Cross-Origin Resource Sharing
- **Helmet** - Segurança HTTP
- **Morgan** - Logging HTTP
- **http-proxy-middleware** - Proxy para microserviços
- **express-rate-limit** - Rate limiting
- **express-validator** - Validação de dados
- **RabbitMQ** - Message broker para mensageria assíncrona
- **amqplib** - Cliente Node.js para RabbitMQ

## ✅ Funcionalidades Implementadas

- [x] ✅ Arquitetura de microsserviços
- [x] ✅ Service Discovery e Registry
- [x] ✅ API Gateway com roteamento
- [x] ✅ Circuit Breaker pattern
- [x] ✅ Health checks automáticos
- [x] ✅ Autenticação JWT completa
- [x] ✅ CRUD completo de usuários
- [x] ✅ CRUD completo de itens
- [x] ✅ CRUD completo de listas
- [x] ✅ Catálogo com 22+ itens iniciais
- [x] ✅ Busca e filtros avançados  
- [x] ✅ Dashboard com estatísticas
- [x] ✅ Cliente de demonstração interativo
- [x] ✅ Documentação completa
- [x] ✅ Scripts de execução automatizados
- [x] ✅ Rate limiting e segurança
- [x] ✅ Logging estruturado
- [x] ✅ Graceful shutdown
- [x] ✅ Paginação de resultados
- [x] ✅ Validação de dados
- [x] ✅ Tratamento de erros
- [x] ✅ 🆕 Mensageria assíncrona com RabbitMQ
- [x] ✅ 🆕 Producer no List Service (checkout)
- [x] ✅ 🆕 Consumer de notificações
- [x] ✅ 🆕 Consumer de analytics
- [x] ✅ 🆕 Docker Compose para RabbitMQ

## 🚦 URLs para Teste

Uma vez que os serviços estejam rodando:

- **Sistema completo**: http://localhost:3000/api/info
- **Health check**: http://localhost:3000/health  
- **Registry**: http://localhost:3000/registry
- **Dashboard** (após login): http://localhost:3000/api/dashboard
- **Busca global**: http://localhost:3000/api/search?q=arroz

## 🎯 Como Testar

1. Execute `./start-all.sh` para iniciar todos os serviços
2. Execute `node client-demo.js` para o cliente interativo
3. Ou use um cliente HTTP como Postman/Insomnia com as URLs acima
4. Ou acesse diretamente os endpoints no navegador

## 🔧 Troubleshooting

### Erro: "Cannot find module 'express'" ou "Cannot find module 'uuid'"

**Solução**: Certifique-se de instalar as dependências em todos os diretórios necessários:

```bash
# IMPORTANTE: Instalar dependências compartilhadas primeiro
cd shared && npm install && cd ..

# Depois instalar nos serviços
cd services/user-service && npm install && cd ../..
cd services/item-service && npm install && cd ../..
cd services/list-service && npm install && cd ../..
cd api-gateway && npm install && cd ..
```

### Erro: "ENOENT: no such file or directory, open './shared/registry.json'"

**Solução**: Este erro é normal na primeira execução e não impede o funcionamento. O arquivo será criado automaticamente.

### RabbitMQ não conecta

**Solução**: Verifique se o RabbitMQ está rodando:

```bash
# Com Docker
docker-compose up -d

# Verificar status
docker ps | grep rabbitmq

# Ou se instalado localmente
sudo systemctl status rabbitmq-server
```

## 📞 Suporte

Este é um sistema de demonstração completo. Todos os componentes especificados foram implementados e estão funcionando. O sistema inclui:

- Descoberta automática de serviços
- Circuit breaker para resiliência  
- Autenticação segura com JWT
- Dados iniciais completos
- Cliente de demonstração funcional
- Documentação detalhada
- Scripts de automação

**Para executar**: `./start-all.sh` e depois `node client-demo.js`

---

*Desenvolvido como sistema completo de microsserviços para gerenciamento de listas de compras* 🛒