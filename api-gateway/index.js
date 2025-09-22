const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

// Importar classes compartilhadas
const { getServiceRegistry } = require('../shared/serviceRegistry');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'shopping-list-secret-key';

// Service Registry
const serviceRegistry = getServiceRegistry();

// Middlewares globais
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Logging de requests
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // máximo 1000 requests por IP por janela
  message: {
    error: 'Muitas requisições deste IP, tente novamente em 15 minutos.'
  }
});
app.use(limiter);

// Middleware de autenticação opcional
const extractUser = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user;
      }
    });
  }
  next();
};

// Helper para fazer requisições com circuit breaker
async function makeServiceRequest(serviceName, path, options = {}) {
  try {
    const service = serviceRegistry.getService(serviceName);
    if (!service) {
      throw new Error(`Serviço ${serviceName} não disponível`);
    }

    const response = await axios({
      url: `${service.url}${path}`,
      timeout: 10000,
      ...options
    });

    serviceRegistry.recordSuccess(serviceName);
    return response.data;
  } catch (error) {
    serviceRegistry.recordFailure(serviceName);
    console.error(`Erro ao chamar ${serviceName}${path}:`, error.message);
    throw error;
  }
}

// Proxy dinâmico para serviços
const createDynamicProxy = (serviceName, pathRewrite = {}) => {
  return async (req, res, next) => {
    try {
      const service = serviceRegistry.getService(serviceName);
      if (!service) {
        return res.status(503).json({ 
          error: `Serviço ${serviceName} não disponível`,
          service: serviceName
        });
      }

      // Criar proxy dinâmico
      const proxy = createProxyMiddleware({
        target: service.url,
        changeOrigin: true,
        pathRewrite,
        onError: (err, req, res) => {
          serviceRegistry.recordFailure(serviceName);
          console.error(`Proxy error for ${serviceName}:`, err.message);
          res.status(503).json({ 
            error: 'Serviço temporariamente indisponível',
            service: serviceName 
          });
        },
        onProxyRes: (proxyRes, req, res) => {
          serviceRegistry.recordSuccess(serviceName);
          // Adicionar headers de identificação
          res.setHeader('X-Service', serviceName);
          res.setHeader('X-Gateway', 'lista-compras-gateway');
        }
      });

      proxy(req, res, next);
    } catch (error) {
      if (error.message.includes('Circuit breaker')) {
        return res.status(503).json({
          error: 'Serviço temporariamente indisponível (circuit breaker)',
          service: serviceName,
          retryAfter: '60 seconds'
        });
      }
      next(error);
    }
  };
};

// Routes do API Gateway

// Health Check do Gateway
app.get('/health', async (req, res) => {
  const services = serviceRegistry.getAllServices();
  const healthChecks = {};
  
  for (const service of services) {
    healthChecks[service.name] = {
      status: service.status,
      url: service.url,
      lastCheck: service.lastHealthCheck,
      failureCount: service.failureCount || 0
    };
  }

  const healthyServices = services.filter(s => s.status === 'healthy').length;
  const totalServices = services.length;

  res.json({
    gateway: {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    },
    services: healthChecks,
    summary: {
      healthy: healthyServices,
      total: totalServices,
      percentage: totalServices > 0 ? Math.round((healthyServices / totalServices) * 100) : 0
    }
  });
});

// Service Registry info
app.get('/registry', (req, res) => {
  const services = serviceRegistry.getAllServices();
  res.json({
    services: services.map(service => ({
      name: service.name,
      url: service.url,
      status: service.status,
      metadata: service.metadata,
      registeredAt: service.registeredAt
    })),
    total: services.length
  });
});

// Dashboard agregado (requer autenticação)
app.get('/api/dashboard', extractUser, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Autenticação requerida' });
  }

  try {
    const [userStats, itemStats, listStats] = await Promise.allSettled([
      makeServiceRequest('user-service', '/stats', {
        headers: { Authorization: req.headers.authorization }
      }),
      makeServiceRequest('item-service', '/stats'),
      makeServiceRequest('list-service', '/stats', {
        headers: { Authorization: req.headers.authorization }
      })
    ]);

    const dashboard = {
      user: req.user,
      timestamp: new Date().toISOString(),
      stats: {
        user: userStats.status === 'fulfilled' ? userStats.value : null,
        items: itemStats.status === 'fulfilled' ? itemStats.value : null,
        lists: listStats.status === 'fulfilled' ? listStats.value : null
      },
      services: {
        available: serviceRegistry.getHealthyServices().length,
        total: serviceRegistry.getAllServices().length
      }
    };

    // Adicionar dados agregados
    if (dashboard.stats.lists && dashboard.stats.items) {
      dashboard.insights = {
        averageItemsPerList: dashboard.stats.lists.totalLists > 0 
          ? Math.round(dashboard.stats.lists.totalItems / dashboard.stats.lists.totalLists)
          : 0,
        estimatedMonthlySpending: dashboard.stats.lists.estimatedTotalValue || 0,
        favoriteCategories: [] // Poderia ser calculado com mais dados
      };
    }

    res.json(dashboard);

  } catch (error) {
    console.error('Erro ao buscar dashboard:', error);
    res.status(500).json({ 
      error: 'Erro ao carregar dashboard',
      details: error.message
    });
  }
});

// Busca global (itens + listas)
app.get('/api/search', extractUser, async (req, res) => {
  const { q, limit = 10 } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ 
      error: 'Termo de busca deve ter pelo menos 2 caracteres' 
    });
  }

  try {
    const searches = [];

    // Buscar itens (público)
    searches.push(
      makeServiceRequest('item-service', `/search?q=${encodeURIComponent(q)}&limit=${limit}`)
        .catch(err => ({ items: [], error: err.message }))
    );

    // Buscar listas (se autenticado)
    if (req.user) {
      searches.push(
        makeServiceRequest('list-service', '/lists?limit=50', {
          headers: { Authorization: req.headers.authorization }
        }).then(data => {
          const filteredLists = data.lists.filter(list => 
            list.name.toLowerCase().includes(q.toLowerCase()) ||
            list.description.toLowerCase().includes(q.toLowerCase()) ||
            list.items.some(item => 
              item.itemName.toLowerCase().includes(q.toLowerCase())
            )
          ).slice(0, parseInt(limit));
          
          return { lists: filteredLists };
        }).catch(err => ({ lists: [], error: err.message }))
      );
    }

    const results = await Promise.allSettled(searches);
    
    const searchResults = {
      query: q,
      timestamp: new Date().toISOString(),
      items: results[0]?.value?.items || [],
      lists: results[1]?.value?.lists || [],
      errors: []
    };

    // Coletar erros se houver
    results.forEach((result, index) => {
      if (result.status === 'rejected' || result.value?.error) {
        searchResults.errors.push({
          service: index === 0 ? 'item-service' : 'list-service',
          error: result.reason?.message || result.value?.error
        });
      }
    });

    res.json(searchResults);

  } catch (error) {
    console.error('Erro na busca global:', error);
    res.status(500).json({ 
      error: 'Erro na busca global',
      details: error.message
    });
  }
});

// Roteamento para serviços

// User Service - /api/auth/* e /api/users/*
app.use('/api/auth', createDynamicProxy('user-service', {
  '^/api/auth': '/auth'
}));

app.use('/api/users', createDynamicProxy('user-service', {
  '^/api/users': '/users'
}));

// Item Service - /api/items/*
app.use('/api/items', createDynamicProxy('item-service', {
  '^/api/items': '/items'
}));

// Rota especial para categorias
app.use('/api/categories', createDynamicProxy('item-service', {
  '^/api/categories': '/categories'
}));

// List Service - /api/lists/*
app.use('/api/lists', createDynamicProxy('list-service', {
  '^/api/lists': '/lists'
}));

// Endpoint de informações da API
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Lista Compras API Gateway',
    version: '1.0.0',
    description: 'API Gateway para sistema de listas de compras',
    endpoints: {
      auth: '/api/auth/*',
      users: '/api/users/*',
      items: '/api/items/*',
      categories: '/api/categories',
      lists: '/api/lists/*',
      dashboard: '/api/dashboard',
      search: '/api/search',
      health: '/health',
      registry: '/registry'
    },
    services: serviceRegistry.getAllServices().map(s => ({
      name: s.name,
      status: s.status
    }))
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Gateway error:', error);
  res.status(500).json({ 
    error: 'Erro interno do gateway',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint não encontrado',
    path: req.path,
    method: req.method,
    availableEndpoints: '/api/info'
  });
});

// Inicialização do Gateway
async function startGateway() {
  try {
    // Inicializar Service Registry
    await serviceRegistry.initialize();
    
    // Registrar o próprio gateway
    await serviceRegistry.registerService('api-gateway', `http://localhost:${PORT}`, {
      version: '1.0.0',
      tags: ['gateway', 'proxy', 'api'],
      endpoints: ['/api/*', '/health', '/registry']
    });

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`🌐 API Gateway rodando na porta ${PORT}`);
      console.log(`📋 Endpoints disponíveis em http://localhost:${PORT}/api/info`);
      console.log(`🏥 Health check em http://localhost:${PORT}/health`);
      console.log(`🔧 Registry em http://localhost:${PORT}/registry`);
    });

    // Log dos serviços registrados
    setTimeout(() => {
      const services = serviceRegistry.getAllServices();
      console.log(`\n📊 Serviços registrados: ${services.length}`);
      services.forEach(service => {
        console.log(`  - ${service.name}: ${service.url} (${service.status})`);
      });
    }, 2000);

  } catch (error) {
    console.error('❌ Erro ao iniciar API Gateway:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Desligando API Gateway...');
  try {
    await serviceRegistry.unregisterService('api-gateway');
    await serviceRegistry.shutdown();
  } catch (error) {
    console.error('Erro no shutdown:', error);
  }
  process.exit(0);
});

// Iniciar Gateway
startGateway();