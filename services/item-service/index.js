const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { body, query, validationResult } = require('express-validator');

// Importar classes compartilhadas
const JsonDatabase = require('../../shared/JsonDatabase');
const { getServiceRegistry } = require('../../shared/serviceRegistry');

const app = express();
const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'shopping-list-secret-key';

// Database
const itemDb = new JsonDatabase('items', './data');

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Service Registry
const serviceRegistry = getServiceRegistry();

// Middleware de autenticação (opcional para alguns endpoints)
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

// Dados iniciais dos itens
const initialItems = [
  // Alimentos
  { name: 'Arroz Branco 5kg', category: 'Alimentos', brand: 'Tio João', unit: 'pacote', averagePrice: 25.90, barcode: '7891234567890', description: 'Arroz branco tipo 1', active: true },
  { name: 'Feijão Preto 1kg', category: 'Alimentos', brand: 'Camil', unit: 'pacote', averagePrice: 8.50, barcode: '7891234567891', description: 'Feijão preto especial', active: true },
  { name: 'Macarrão Espaguete', category: 'Alimentos', brand: 'Barilla', unit: 'pacote', averagePrice: 4.90, barcode: '7891234567892', description: 'Macarrão espaguete 500g', active: true },
  { name: 'Óleo de Soja 900ml', category: 'Alimentos', brand: 'Liza', unit: 'garrafa', averagePrice: 6.80, barcode: '7891234567893', description: 'Óleo de soja refinado', active: true },
  { name: 'Açúcar Cristal 1kg', category: 'Alimentos', brand: 'União', unit: 'pacote', averagePrice: 4.50, barcode: '7891234567894', description: 'Açúcar cristal especial', active: true },
  { name: 'Café em Pó 500g', category: 'Alimentos', brand: '3 Corações', unit: 'pacote', averagePrice: 15.90, barcode: '7891234567895', description: 'Café torrado e moído', active: true },
  { name: 'Leite Integral 1L', category: 'Alimentos', brand: 'Nestlé', unit: 'caixa', averagePrice: 4.20, barcode: '7891234567896', description: 'Leite longa vida integral', active: true },

  // Limpeza
  { name: 'Detergente Líquido', category: 'Limpeza', brand: 'Ypê', unit: 'frasco', averagePrice: 2.90, barcode: '7891234567897', description: 'Detergente neutro 500ml', active: true },
  { name: 'Sabão em Pó 1kg', category: 'Limpeza', brand: 'OMO', unit: 'caixa', averagePrice: 12.50, barcode: '7891234567898', description: 'Sabão em pó para roupas', active: true },
  { name: 'Desinfetante 500ml', category: 'Limpeza', brand: 'Pinho Sol', unit: 'frasco', averagePrice: 3.80, barcode: '7891234567899', description: 'Desinfetante uso geral', active: true },
  { name: 'Água Sanitária 1L', category: 'Limpeza', brand: 'Q-Boa', unit: 'garrafa', averagePrice: 2.50, barcode: '7891234567800', description: 'Água sanitária 2,5%', active: true },
  { name: 'Esponja de Aço', category: 'Limpeza', brand: 'Bombril', unit: 'pacote', averagePrice: 3.20, barcode: '7891234567801', description: 'Esponja de aço 8 unidades', active: true },

  // Higiene
  { name: 'Shampoo Anticaspa', category: 'Higiene', brand: 'Head & Shoulders', unit: 'frasco', averagePrice: 18.90, barcode: '7891234567802', description: 'Shampoo anticaspa 400ml', active: true },
  { name: 'Sabonete Líquido', category: 'Higiene', brand: 'Dove', unit: 'refil', averagePrice: 8.50, barcode: '7891234567803', description: 'Sabonete líquido hidratante', active: true },
  { name: 'Pasta de Dente', category: 'Higiene', brand: 'Colgate', unit: 'tubo', averagePrice: 4.90, barcode: '7891234567804', description: 'Creme dental 90g', active: true },
  { name: 'Papel Higiênico', category: 'Higiene', brand: 'Scott', unit: 'pacote', averagePrice: 16.50, barcode: '7891234567805', description: 'Papel higiênico folha dupla 12 rolos', active: true },
  { name: 'Desodorante Spray', category: 'Higiene', brand: 'Rexona', unit: 'frasco', averagePrice: 9.90, barcode: '7891234567806', description: 'Desodorante aerosol 150ml', active: true },

  // Bebidas
  { name: 'Refrigerante Cola 2L', category: 'Bebidas', brand: 'Coca-Cola', unit: 'garrafa', averagePrice: 8.90, barcode: '7891234567807', description: 'Refrigerante cola 2 litros', active: true },
  { name: 'Suco de Laranja 1L', category: 'Bebidas', brand: 'Del Valle', unit: 'caixa', averagePrice: 5.50, barcode: '7891234567808', description: 'Suco de laranja integral', active: true },
  { name: 'Água Mineral 1,5L', category: 'Bebidas', brand: 'Crystal', unit: 'garrafa', averagePrice: 2.80, barcode: '7891234567809', description: 'Água mineral natural', active: true },

  // Padaria
  { name: 'Pão de Forma', category: 'Padaria', brand: 'Wickbold', unit: 'pacote', averagePrice: 6.90, barcode: '7891234567810', description: 'Pão de forma integral 500g', active: true },
  { name: 'Biscoito Recheado', category: 'Padaria', brand: 'Oreo', unit: 'pacote', averagePrice: 4.50, barcode: '7891234567811', description: 'Biscoito recheado 144g', active: true },
  { name: 'Bolo Pronto', category: 'Padaria', brand: 'Bauducco', unit: 'unidade', averagePrice: 8.90, barcode: '7891234567812', description: 'Bolo de chocolate 250g', active: true }
];

// Inicializar dados se não existirem
async function initializeData() {
  const existingItems = await itemDb.findAll();
  if (existingItems.length === 0) {
    console.log('📦 Criando dados iniciais de itens...');
    for (const item of initialItems) {
      await itemDb.create(item);
    }
    console.log(`✅ ${initialItems.length} itens criados`);
  }
}

// Validadores
const createItemValidation = [
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('category').notEmpty().withMessage('Categoria é obrigatória'),
  body('unit').notEmpty().withMessage('Unidade é obrigatória'),
  body('averagePrice').isFloat({ min: 0 }).withMessage('Preço deve ser um número positivo')
];

const searchValidation = [
  query('q').optional().isLength({ min: 1 }).withMessage('Termo de busca deve ter pelo menos 1 caractere')
];

// Routes

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'item-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// GET /items - Listar itens com filtros
app.get('/items', async (req, res) => {
  try {
    const { category, name, active, page = 1, limit = 50 } = req.query;
    
    let filter = {};
    
    if (category) {
      filter.category = category;
    }
    
    if (active !== undefined) {
      filter.active = active === 'true';
    }

    let items = await itemDb.findAll(filter);

    // Filtro por nome (busca parcial)
    if (name) {
      const nameRegex = new RegExp(name, 'i');
      items = items.filter(item => nameRegex.test(item.name));
    }

    // Paginação simples
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedItems = items.slice(startIndex, endIndex);

    res.json({
      items: paginatedItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: items.length,
        pages: Math.ceil(items.length / parseInt(limit))
      },
      filters: { category, name, active }
    });

  } catch (error) {
    console.error('Erro ao buscar itens:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /items/:id - Buscar item específico
app.get('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const item = await itemDb.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    res.json({ item });

  } catch (error) {
    console.error('Erro ao buscar item:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /items - Criar novo item (requer autenticação)
app.post('/items', authenticateToken, createItemValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        details: errors.array() 
      });
    }

    const { name, category, brand, unit, averagePrice, barcode, description, active = true } = req.body;

    // Verificar se item com mesmo nome já existe
    const existingItem = await itemDb.findOne({ name, category });
    if (existingItem) {
      return res.status(409).json({ error: 'Item já existe nesta categoria' });
    }

    const newItem = await itemDb.create({
      name,
      category,
      brand: brand || '',
      unit,
      averagePrice: parseFloat(averagePrice),
      barcode: barcode || '',
      description: description || '',
      active
    });

    res.status(201).json({
      message: 'Item criado com sucesso',
      item: newItem
    });

  } catch (error) {
    console.error('Erro ao criar item:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /items/:id - Atualizar item (requer autenticação)
app.put('/items/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, brand, unit, averagePrice, barcode, description, active } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (category) updates.category = category;
    if (brand !== undefined) updates.brand = brand;
    if (unit) updates.unit = unit;
    if (averagePrice !== undefined) updates.averagePrice = parseFloat(averagePrice);
    if (barcode !== undefined) updates.barcode = barcode;
    if (description !== undefined) updates.description = description;
    if (active !== undefined) updates.active = active;

    const updatedItem = await itemDb.updateById(id, updates);
    if (!updatedItem) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    res.json({
      message: 'Item atualizado com sucesso',
      item: updatedItem
    });

  } catch (error) {
    console.error('Erro ao atualizar item:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /categories - Listar categorias disponíveis
app.get('/categories', async (req, res) => {
  try {
    const items = await itemDb.findAll({ active: true });
    const categories = [...new Set(items.map(item => item.category))];
    
    const categoriesWithCount = categories.map(category => ({
      name: category,
      itemCount: items.filter(item => item.category === category).length
    }));

    res.json({
      categories: categoriesWithCount.sort((a, b) => a.name.localeCompare(b.name))
    });

  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /search - Buscar itens por nome
app.get('/search', searchValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Parâmetros inválidos', 
        details: errors.array() 
      });
    }

    const { q, category, limit = 20 } = req.query;

    if (!q) {
      return res.json({ items: [], query: q });
    }

    let items = await itemDb.search(q, ['name', 'description', 'brand']);

    // Filtrar por categoria se especificada
    if (category) {
      items = items.filter(item => item.category === category);
    }

    // Apenas itens ativos
    items = items.filter(item => item.active);

    // Limitar resultados
    items = items.slice(0, parseInt(limit));

    res.json({
      items,
      query: q,
      category: category || null,
      total: items.length
    });

  } catch (error) {
    console.error('Erro na busca:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Estatísticas dos itens
app.get('/stats', async (req, res) => {
  try {
    const allItems = await itemDb.findAll();
    const activeItems = allItems.filter(item => item.active);
    
    const categories = [...new Set(allItems.map(item => item.category))];
    const categoryStats = categories.map(category => {
      const categoryItems = activeItems.filter(item => item.category === category);
      return {
        category,
        count: categoryItems.length,
        averagePrice: categoryItems.reduce((sum, item) => sum + item.averagePrice, 0) / categoryItems.length || 0
      };
    });

    res.json({
      totalItems: allItems.length,
      activeItems: activeItems.length,
      categories: categories.length,
      categoryBreakdown: categoryStats
    });

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
    await itemDb.initialize();
    await initializeData();

    // Registrar no Service Registry
    await serviceRegistry.initialize();
    await serviceRegistry.registerService('item-service', `http://localhost:${PORT}`, {
      version: '1.0.0',
      tags: ['items', 'catalog', 'products'],
      endpoints: ['/items', '/categories', '/search']
    });

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`📦 Item Service rodando na porta ${PORT}`);
      console.log(`📊 Database: ${itemDb.filename}`);
      console.log(`🏷️  Categorias: Alimentos, Limpeza, Higiene, Bebidas, Padaria`);
    });

  } catch (error) {
    console.error('❌ Erro ao iniciar Item Service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Desligando Item Service...');
  try {
    await serviceRegistry.unregisterService('item-service');
    await serviceRegistry.shutdown();
  } catch (error) {
    console.error('Erro no shutdown:', error);
  }
  process.exit(0);
});

// Iniciar serviço
startService();