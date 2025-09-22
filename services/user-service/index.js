const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const path = require('path');

// Importar classes compartilhadas
const JsonDatabase = require('../../shared/JsonDatabase');
const { getServiceRegistry } = require('../../shared/serviceRegistry');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'shopping-list-secret-key';

// Database
const userDb = new JsonDatabase('users', './data');

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Service Registry
const serviceRegistry = getServiceRegistry();

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' });
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    
    // Verificar se usuário ainda existe
    const existingUser = await userDb.findById(user.id);
    if (!existingUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    req.user = user;
    next();
  });
};

// Validadores
const registerValidation = [
  body('email').isEmail().withMessage('Email inválido'),
  body('username').isLength({ min: 3 }).withMessage('Username deve ter pelo menos 3 caracteres'),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('firstName').notEmpty().withMessage('Nome é obrigatório'),
  body('lastName').notEmpty().withMessage('Sobrenome é obrigatório')
];

const loginValidation = [
  body('identifier').notEmpty().withMessage('Email ou username é obrigatório'),
  body('password').notEmpty().withMessage('Senha é obrigatória')
];

// Helper functions
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      username: user.username 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const sanitizeUser = (user) => {
  const { password, ...sanitizedUser } = user;
  return sanitizedUser;
};

// Routes

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'user-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// POST /auth/register - Cadastro de usuário
app.post('/auth/register', registerValidation, async (req, res) => {
  try {
    // Verificar erros de validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        details: errors.array() 
      });
    }

    const { email, username, password, firstName, lastName, preferences = {} } = req.body;

    // Verificar se email já existe
    const existingEmail = await userDb.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    // Verificar se username já existe
    const existingUsername = await userDb.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({ error: 'Username já cadastrado' });
    }

    // Hash da senha
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Criar usuário
    const newUser = await userDb.create({
      email,
      username,
      password: hashedPassword,
      firstName,
      lastName,
      preferences: {
        defaultStore: preferences.defaultStore || '',
        currency: preferences.currency || 'BRL',
        ...preferences
      }
    });

    // Gerar token
    const token = generateToken(newUser);

    res.status(201).json({
      message: 'Usuário criado com sucesso',
      user: sanitizeUser(newUser),
      token
    });

  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /auth/login - Login
app.post('/auth/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        details: errors.array() 
      });
    }

    const { identifier, password } = req.body;

    // Buscar usuário por email ou username
    const user = await userDb.findOne({ email: identifier }) || 
                 await userDb.findOne({ username: identifier });

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gerar token
    const token = generateToken(user);

    // Atualizar último login
    await userDb.updateById(user.id, {
      lastLogin: new Date().toISOString()
    });

    res.json({
      message: 'Login realizado com sucesso',
      user: sanitizeUser(user),
      token
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /users/:id - Buscar dados do usuário
app.get('/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se é o próprio usuário ou admin (futuro)
    if (req.user.id !== id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const user = await userDb.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({
      user: sanitizeUser(user)
    });

  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /users/:id - Atualizar perfil do usuário
app.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se é o próprio usuário
    if (req.user.id !== id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { firstName, lastName, preferences, email, username } = req.body;

    // Preparar dados para atualização
    const updates = {};
    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;
    if (preferences) updates.preferences = { ...preferences };

    // Verificar mudanças de email/username
    if (email && email !== req.user.email) {
      const existingEmail = await userDb.findOne({ email });
      if (existingEmail && existingEmail.id !== id) {
        return res.status(409).json({ error: 'Email já está em uso' });
      }
      updates.email = email;
    }

    if (username && username !== req.user.username) {
      const existingUsername = await userDb.findOne({ username });
      if (existingUsername && existingUsername.id !== id) {
        return res.status(409).json({ error: 'Username já está em uso' });
      }
      updates.username = username;
    }

    const updatedUser = await userDb.updateById(id, updates);
    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({
      message: 'Perfil atualizado com sucesso',
      user: sanitizeUser(updatedUser)
    });

  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para estatísticas (para dashboard)
app.get('/stats', authenticateToken, async (req, res) => {
  try {
    const totalUsers = await userDb.count();
    const user = await userDb.findById(req.user.id);
    
    res.json({
      totalUsers,
      userInfo: {
        joinedAt: user.createdAt,
        lastLogin: user.lastLogin || user.updatedAt,
        preferences: user.preferences
      }
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
    await userDb.initialize();

    // Registrar no Service Registry
    await serviceRegistry.initialize();
    await serviceRegistry.registerService('user-service', `http://localhost:${PORT}`, {
      version: '1.0.0',
      tags: ['auth', 'users'],
      endpoints: ['/auth/register', '/auth/login', '/users/:id']
    });

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`👤 User Service rodando na porta ${PORT}`);
      console.log(`📊 Database: ${userDb.filename}`);
      console.log(`🔐 JWT Secret: ${JWT_SECRET.substring(0, 10)}...`);
    });

  } catch (error) {
    console.error('❌ Erro ao iniciar User Service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Desligando User Service...');
  try {
    await serviceRegistry.unregisterService('user-service');
    await serviceRegistry.shutdown();
  } catch (error) {
    console.error('Erro no shutdown:', error);
  }
  process.exit(0);
});

// Iniciar serviço
startService();