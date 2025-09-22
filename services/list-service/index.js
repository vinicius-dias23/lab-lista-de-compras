const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { body, validationResult } = require('express-validator');

// Importar classes compartilhadas
const JsonDatabase = require('../../shared/JsonDatabase');
const { getServiceRegistry } = require('../../shared/serviceRegistry');

const app = express();
const PORT = process.env.PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET || 'shopping-list-secret-key';

// Database
const listDb = new JsonDatabase('lists', './data');

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Service Registry
const serviceRegistry = getServiceRegistry();

// Middleware de autenticação (obrigatório)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// Helper para buscar item no Item Service
async function getItemDetails(itemId) {
  try {
    const itemService = serviceRegistry.getService('item-service');
    if (!itemService) {
      throw new Error('Item Service não disponível');
    }

    const response = await axios.get(`${itemService.url}/items/${itemId}`, {
      timeout: 5000
    });
    
    serviceRegistry.recordSuccess('item-service');
    return response.data.item;
  } catch (error) {
    serviceRegistry.recordFailure('item-service');
    console.error('Erro ao buscar item:', error.message);
    return null;
  }
}

// Helper para calcular resumo da lista
function calculateListSummary(items) {
  const totalItems = items.length;
  const purchasedItems = items.filter(item => item.purchased).length;
  const estimatedTotal = items.reduce((total, item) => {
    return total + (item.quantity * item.estimatedPrice);
  }, 0);

  return {
    totalItems,
    purchasedItems,
    estimatedTotal: parseFloat(estimatedTotal.toFixed(2))
  };
}

// Validadores
const createListValidation = [
  body('name').notEmpty().withMessage('Nome da lista é obrigatório'),
  body('description').optional().isString().withMessage('Descrição deve ser uma string')
];

const addItemValidation = [
  body('itemId').notEmpty().withMessage('ID do item é obrigatório'),
  body('quantity').isFloat({ min: 0.1 }).withMessage('Quantidade deve ser maior que zero'),
  body('notes').optional().isString().withMessage('Notas devem ser uma string')
];

const updateItemValidation = [
  body('quantity').optional().isFloat({ min: 0.1 }).withMessage('Quantidade deve ser maior que zero'),
  body('purchased').optional().isBoolean().withMessage('Purchased deve ser boolean'),
  body('notes').optional().isString().withMessage('Notas devem ser uma string')
];

// Routes

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'list-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// POST /lists - Criar nova lista
app.post('/lists', authenticateToken, createListValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        details: errors.array() 
      });
    }

    const { name, description = '', status = 'active' } = req.body;

    const newList = await listDb.create({
      userId: req.user.id,
      name,
      description,
      status,
      items: [],
      summary: {
        totalItems: 0,
        purchasedItems: 0,
        estimatedTotal: 0
      }
    });

    res.status(201).json({
      message: 'Lista criada com sucesso',
      list: newList
    });

  } catch (error) {
    console.error('Erro ao criar lista:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /lists - Listar listas do usuário
app.get('/lists', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    let filter = { userId: req.user.id };
    if (status) {
      filter.status = status;
    }

    const allLists = await listDb.findAll(filter);
    
    // Ordenar por data de atualização (mais recente primeiro)
    allLists.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // Paginação
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedLists = allLists.slice(startIndex, endIndex);

    // Recalcular resumos
    const listsWithSummary = paginatedLists.map(list => ({
      ...list,
      summary: calculateListSummary(list.items || [])
    }));

    res.json({
      lists: listsWithSummary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: allLists.length,
        pages: Math.ceil(allLists.length / parseInt(limit))
      },
      filters: { status }
    });

  } catch (error) {
    console.error('Erro ao buscar listas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /lists/:id - Buscar lista específica
app.get('/lists/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const list = await listDb.findById(id);
    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    // Verificar se o usuário é o dono da lista
    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Recalcular resumo
    const summary = calculateListSummary(list.items || []);
    
    const listWithSummary = {
      ...list,
      summary
    };

    res.json({ list: listWithSummary });

  } catch (error) {
    console.error('Erro ao buscar lista:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /lists/:id - Atualizar lista
app.put('/lists/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    const list = await listDb.findById(id);
    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (status && ['active', 'completed', 'archived'].includes(status)) {
      updates.status = status;
    }

    const updatedList = await listDb.updateById(id, updates);

    // Recalcular resumo
    const summary = calculateListSummary(updatedList.items || []);
    await listDb.updateById(id, { summary });

    res.json({
      message: 'Lista atualizada com sucesso',
      list: { ...updatedList, summary }
    });

  } catch (error) {
    console.error('Erro ao atualizar lista:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /lists/:id - Deletar lista
app.delete('/lists/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const list = await listDb.findById(id);
    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    await listDb.deleteById(id);

    res.json({ message: 'Lista removida com sucesso' });

  } catch (error) {
    console.error('Erro ao remover lista:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /lists/:id/items - Adicionar item à lista
app.post('/lists/:id/items', authenticateToken, addItemValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        details: errors.array() 
      });
    }

    const { id } = req.params;
    const { itemId, quantity, notes = '' } = req.body;

    const list = await listDb.findById(id);
    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Buscar detalhes do item
    const itemDetails = await getItemDetails(itemId);
    if (!itemDetails) {
      return res.status(404).json({ error: 'Item não encontrado ou serviço indisponível' });
    }

    // Verificar se item já existe na lista
    const existingItemIndex = list.items.findIndex(item => item.itemId === itemId);
    
    if (existingItemIndex >= 0) {
      // Atualizar quantidade se item já existe
      list.items[existingItemIndex].quantity += parseFloat(quantity);
      list.items[existingItemIndex].notes = notes;
      list.items[existingItemIndex].addedAt = new Date().toISOString();
    } else {
      // Adicionar novo item
      const newListItem = {
        itemId,
        itemName: itemDetails.name,
        quantity: parseFloat(quantity),
        unit: itemDetails.unit,
        estimatedPrice: itemDetails.averagePrice,
        purchased: false,
        notes,
        addedAt: new Date().toISOString()
      };

      list.items.push(newListItem);
    }

    // Recalcular resumo
    const summary = calculateListSummary(list.items);

    const updatedList = await listDb.updateById(id, {
      items: list.items,
      summary
    });

    res.status(201).json({
      message: 'Item adicionado à lista com sucesso',
      list: updatedList
    });

  } catch (error) {
    console.error('Erro ao adicionar item à lista:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /lists/:id/items/:itemId - Atualizar item na lista
app.put('/lists/:id/items/:itemId', authenticateToken, updateItemValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        details: errors.array() 
      });
    }

    const { id, itemId } = req.params;
    const { quantity, purchased, notes } = req.body;

    const list = await listDb.findById(id);
    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const itemIndex = list.items.findIndex(item => item.itemId === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item não encontrado na lista' });
    }

    // Atualizar propriedades do item
    if (quantity !== undefined) {
      list.items[itemIndex].quantity = parseFloat(quantity);
    }
    if (purchased !== undefined) {
      list.items[itemIndex].purchased = purchased;
    }
    if (notes !== undefined) {
      list.items[itemIndex].notes = notes;
    }

    // Recalcular resumo
    const summary = calculateListSummary(list.items);

    const updatedList = await listDb.updateById(id, {
      items: list.items,
      summary
    });

    res.json({
      message: 'Item atualizado com sucesso',
      list: updatedList
    });

  } catch (error) {
    console.error('Erro ao atualizar item na lista:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /lists/:id/items/:itemId - Remover item da lista
app.delete('/lists/:id/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const { id, itemId } = req.params;

    const list = await listDb.findById(id);
    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const itemIndex = list.items.findIndex(item => item.itemId === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item não encontrado na lista' });
    }

    // Remover item
    list.items.splice(itemIndex, 1);

    // Recalcular resumo
    const summary = calculateListSummary(list.items);

    const updatedList = await listDb.updateById(id, {
      items: list.items,
      summary
    });

    res.json({
      message: 'Item removido da lista com sucesso',
      list: updatedList
    });

  } catch (error) {
    console.error('Erro ao remover item da lista:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /lists/:id/summary - Resumo da lista
app.get('/lists/:id/summary', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const list = await listDb.findById(id);
    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    if (list.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const summary = calculateListSummary(list.items || []);
    
    const detailedSummary = {
      listInfo: {
        id: list.id,
        name: list.name,
        status: list.status,
        createdAt: list.createdAt
      },
      summary,
      breakdown: {
        byCategory: {},
        pendingItems: list.items.filter(item => !item.purchased),
        completedItems: list.items.filter(item => item.purchased)
      }
    };

    // Agrupar por categoria estimada (baseada no nome do item)
    list.items.forEach(item => {
      const category = 'Diversos'; // Simplificado, poderia fazer lookup no Item Service
      if (!detailedSummary.breakdown.byCategory[category]) {
        detailedSummary.breakdown.byCategory[category] = {
          items: 0,
          estimatedTotal: 0
        };
      }
      detailedSummary.breakdown.byCategory[category].items++;
      detailedSummary.breakdown.byCategory[category].estimatedTotal += 
        item.quantity * item.estimatedPrice;
    });

    res.json(detailedSummary);

  } catch (error) {
    console.error('Erro ao buscar resumo da lista:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Estatísticas das listas do usuário
app.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userLists = await listDb.findAll({ userId: req.user.id });
    
    const stats = {
      totalLists: userLists.length,
      listsByStatus: {
        active: userLists.filter(list => list.status === 'active').length,
        completed: userLists.filter(list => list.status === 'completed').length,
        archived: userLists.filter(list => list.status === 'archived').length
      },
      totalItems: userLists.reduce((sum, list) => sum + (list.items?.length || 0), 0),
      estimatedTotalValue: userLists.reduce((sum, list) => {
        const listTotal = (list.items || []).reduce((itemSum, item) => 
          itemSum + (item.quantity * item.estimatedPrice), 0
        );
        return sum + listTotal;
      }, 0)
    };

    res.json(stats);

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Erro não tratado:', error);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado' });
});

// Inicialização do serviço
async function startService() {
  try {
    // Inicializar banco de dados
    await listDb.initialize();

    // Registrar no Service Registry
    await serviceRegistry.initialize();
    await serviceRegistry.registerService('list-service', `http://localhost:${PORT}`, {
      version: '1.0.0',
      tags: ['lists', 'shopping', 'management'],
      endpoints: ['/lists', '/lists/:id', '/lists/:id/items', '/lists/:id/summary']
    });

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`📝 List Service rodando na porta ${PORT}`);
      console.log(`📊 Database: ${listDb.filename}`);
      console.log(`🔗 Integração com Item Service configurada`);
    });

  } catch (error) {
    console.error('❌ Erro ao iniciar List Service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Desligando List Service...');
  try {
    await serviceRegistry.unregisterService('list-service');
    await serviceRegistry.shutdown();
  } catch (error) {
    console.error('Erro no shutdown:', error);
  }
  process.exit(0);
});

// Iniciar serviço
startService();