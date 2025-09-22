#!/usr/bin/env node

const axios = require('axios');
const readline = require('readline');

// Configuração
const API_BASE = 'http://localhost:3000/api';
let authToken = null;
let currentUser = null;

// Interface para entrada de dados
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper para perguntas
function question(query) {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

// Helper para fazer requisições autenticadas
async function apiRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      data,
      headers: {}
    };

    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`${error.response.status}: ${error.response.data.error || error.response.statusText}`);
    }
    throw error;
  }
}

// Funções de demonstração

async function checkHealth() {
  console.log('\n🏥 === VERIFICANDO SAÚDE DOS SERVIÇOS ===');
  try {
    const response = await axios.get('http://localhost:3000/health');
    const health = response.data;
    
    console.log(`\n📊 Gateway Status: ${health.gateway.status}`);
    console.log(`🔧 Serviços: ${health.summary.healthy}/${health.summary.total} (${health.summary.percentage}%)`);
    
    console.log('\n📋 Status dos Serviços:');
    Object.entries(health.services).forEach(([name, info]) => {
      const status = info.status === 'healthy' ? '✅' : '❌';
      console.log(`  ${status} ${name}: ${info.status} (${info.url})`);
    });

    return health.summary.percentage === 100;
  } catch (error) {
    console.error('❌ Erro ao verificar saúde dos serviços:', error.message);
    return false;
  }
}

async function registerUser() {
  console.log('\n👤 === REGISTRO DE USUÁRIO ===');
  
  const email = await question('📧 Email: ');
  const username = await question('👤 Username: ');
  const password = await question('🔒 Senha: ');
  const firstName = await question('📝 Nome: ');
  const lastName = await question('📝 Sobrenome: ');

  try {
    const response = await apiRequest('POST', '/auth/register', {
      email,
      username,
      password,
      firstName,
      lastName,
      preferences: {
        currency: 'BRL',
        defaultStore: 'Supermercado Local'
      }
    });

    console.log('✅ Usuário registrado com sucesso!');
    console.log(`👤 Nome: ${response.user.firstName} ${response.user.lastName}`);
    console.log(`📧 Email: ${response.user.email}`);
    
    authToken = response.token;
    currentUser = response.user;
    return true;
  } catch (error) {
    console.error('❌ Erro no registro:', error.message);
    return false;
  }
}

async function loginUser() {
  console.log('\n🔐 === LOGIN ===');
  
  const identifier = await question('📧 Email ou Username: ');
  const password = await question('🔒 Senha: ');

  try {
    const response = await apiRequest('POST', '/auth/login', {
      identifier,
      password
    });

    console.log('✅ Login realizado com sucesso!');
    console.log(`👋 Bem-vindo, ${response.user.firstName}!`);
    
    authToken = response.token;
    currentUser = response.user;
    return true;
  } catch (error) {
    console.error('❌ Erro no login:', error.message);
    return false;
  }
}

async function searchItems() {
  console.log('\n🔍 === BUSCA DE ITENS ===');
  
  const query = await question('🔍 Digite o termo de busca: ');

  try {
    const response = await apiRequest('GET', `/items/search?q=${encodeURIComponent(query)}&limit=10`);
    
    console.log(`\n📦 Encontrados ${response.items.length} itens:`);
    response.items.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name}`);
      console.log(`   Categoria: ${item.category} | Preço: R$ ${item.averagePrice.toFixed(2)}`);
      console.log(`   Marca: ${item.brand} | Unidade: ${item.unit}`);
    });

    return response.items;
  } catch (error) {
    console.error('❌ Erro na busca:', error.message);
    return [];
  }
}

async function listCategories() {
  console.log('\n🏷️ === CATEGORIAS DISPONÍVEIS ===');
  
  try {
    const response = await apiRequest('GET', '/categories');
    
    console.log('\n📋 Categorias:');
    response.categories.forEach((category, index) => {
      console.log(`${index + 1}. ${category.name} (${category.itemCount} itens)`);
    });

    return response.categories;
  } catch (error) {
    console.error('❌ Erro ao listar categorias:', error.message);
    return [];
  }
}

async function createList() {
  console.log('\n📝 === CRIAR LISTA DE COMPRAS ===');
  
  const name = await question('📝 Nome da lista: ');
  const description = await question('📄 Descrição (opcional): ');

  try {
    const response = await apiRequest('POST', '/lists', {
      name,
      description
    });

    console.log('✅ Lista criada com sucesso!');
    console.log(`📝 ID: ${response.list.id}`);
    console.log(`📝 Nome: ${response.list.name}`);
    
    return response.list;
  } catch (error) {
    console.error('❌ Erro ao criar lista:', error.message);
    return null;
  }
}

async function addItemsToList(listId) {
  console.log('\n➕ === ADICIONAR ITENS À LISTA ===');
  
  // Mostrar itens disponíveis
  const items = await apiRequest('GET', '/items?limit=20&active=true');
  
  console.log('\n📦 Itens disponíveis:');
  items.items.forEach((item, index) => {
    console.log(`${index + 1}. ${item.name} - R$ ${item.averagePrice.toFixed(2)} (${item.category})`);
  });

  while (true) {
    const itemChoice = await question('\n📦 Número do item (0 para sair): ');
    
    if (itemChoice === '0') break;
    
    const itemIndex = parseInt(itemChoice) - 1;
    if (itemIndex >= 0 && itemIndex < items.items.length) {
      const selectedItem = items.items[itemIndex];
      const quantity = await question(`📊 Quantidade de "${selectedItem.name}": `);
      const notes = await question('📝 Observações (opcional): ');

      try {
        await apiRequest('POST', `/lists/${listId}/items`, {
          itemId: selectedItem.id,
          quantity: parseFloat(quantity),
          notes
        });

        console.log(`✅ Item "${selectedItem.name}" adicionado à lista!`);
      } catch (error) {
        console.error('❌ Erro ao adicionar item:', error.message);
      }
    } else {
      console.log('❌ Número inválido!');
    }
  }
}

async function viewList(listId) {
  console.log('\n👁️ === VISUALIZAR LISTA ===');
  
  try {
    const response = await apiRequest('GET', `/lists/${listId}`);
    const list = response.list;
    
    console.log(`\n📝 Lista: ${list.name}`);
    console.log(`📄 Descrição: ${list.description}`);
    console.log(`📊 Status: ${list.status}`);
    console.log(`📅 Criada em: ${new Date(list.createdAt).toLocaleString('pt-BR')}`);
    
    console.log(`\n📦 Itens (${list.items.length}):`);
    let total = 0;
    list.items.forEach((item, index) => {
      const itemTotal = item.quantity * item.estimatedPrice;
      total += itemTotal;
      const status = item.purchased ? '✅' : '⏳';
      
      console.log(`${status} ${index + 1}. ${item.itemName}`);
      console.log(`    Quantidade: ${item.quantity} ${item.unit}`);
      console.log(`    Preço unitário: R$ ${item.estimatedPrice.toFixed(2)}`);
      console.log(`    Subtotal: R$ ${itemTotal.toFixed(2)}`);
      if (item.notes) console.log(`    📝 ${item.notes}`);
    });
    
    console.log(`\n💰 Total estimado: R$ ${total.toFixed(2)}`);
    console.log(`📊 Resumo: ${list.summary.totalItems} itens, ${list.summary.purchasedItems} comprados`);
    
    return list;
  } catch (error) {
    console.error('❌ Erro ao visualizar lista:', error.message);
    return null;
  }
}

async function viewDashboard() {
  console.log('\n📊 === DASHBOARD ===');
  
  try {
    const response = await apiRequest('GET', '/dashboard');
    const dashboard = response;
    
    console.log(`\n👤 Usuário: ${dashboard.user.username} (${dashboard.user.email})`);
    
    if (dashboard.stats.user) {
      console.log(`\n👥 Estatísticas de Usuários:`);
      console.log(`   Total de usuários: ${dashboard.stats.user.totalUsers}`);
    }
    
    if (dashboard.stats.items) {
      console.log(`\n📦 Estatísticas de Itens:`);
      console.log(`   Total de itens: ${dashboard.stats.items.totalItems}`);
      console.log(`   Itens ativos: ${dashboard.stats.items.activeItems}`);
      console.log(`   Categorias: ${dashboard.stats.items.categories}`);
    }
    
    if (dashboard.stats.lists) {
      console.log(`\n📝 Suas Listas:`);
      console.log(`   Total de listas: ${dashboard.stats.lists.totalLists}`);
      console.log(`   Listas ativas: ${dashboard.stats.lists.listsByStatus.active}`);
      console.log(`   Listas completas: ${dashboard.stats.lists.listsByStatus.completed}`);
      console.log(`   Total de itens: ${dashboard.stats.lists.totalItems}`);
      console.log(`   Valor total estimado: R$ ${dashboard.stats.lists.estimatedTotalValue?.toFixed(2) || '0.00'}`);
    }

    if (dashboard.insights) {
      console.log(`\n💡 Insights:`);
      console.log(`   Média de itens por lista: ${dashboard.insights.averageItemsPerList}`);
      console.log(`   Gasto mensal estimado: R$ ${dashboard.insights.estimatedMonthlySpending.toFixed(2)}`);
    }
    
    console.log(`\n🔧 Serviços: ${dashboard.services.available}/${dashboard.services.total} disponíveis`);
    
    return dashboard;
  } catch (error) {
    console.error('❌ Erro ao carregar dashboard:', error.message);
    return null;
  }
}

async function globalSearch() {
  console.log('\n🌍 === BUSCA GLOBAL ===');
  
  const query = await question('🔍 Digite o termo de busca: ');

  try {
    const response = await apiRequest('GET', `/search?q=${encodeURIComponent(query)}&limit=5`);
    
    console.log(`\n🔍 Resultados para "${query}":`);
    
    if (response.items.length > 0) {
      console.log(`\n📦 Itens encontrados (${response.items.length}):`);
      response.items.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.name} - R$ ${item.averagePrice.toFixed(2)}`);
        console.log(`     Categoria: ${item.category}`);
      });
    }
    
    if (response.lists.length > 0) {
      console.log(`\n📝 Listas encontradas (${response.lists.length}):`);
      response.lists.forEach((list, index) => {
        console.log(`  ${index + 1}. ${list.name} (${list.items.length} itens)`);
        console.log(`     Status: ${list.status}`);
      });
    }

    if (response.items.length === 0 && response.lists.length === 0) {
      console.log('   Nenhum resultado encontrado.');
    }

    if (response.errors.length > 0) {
      console.log('\n⚠️ Avisos:');
      response.errors.forEach(error => {
        console.log(`  - ${error.service}: ${error.error}`);
      });
    }
    
    return response;
  } catch (error) {
    console.error('❌ Erro na busca global:', error.message);
    return null;
  }
}

// Menu principal
async function showMenu() {
  console.log('\n📋 === MENU PRINCIPAL ===');
  console.log('1. Verificar saúde dos serviços');
  console.log('2. Registrar usuário');
  console.log('3. Fazer login');
  console.log('4. Buscar itens');
  console.log('5. Listar categorias');
  console.log('6. Criar lista de compras');
  console.log('7. Visualizar dashboard');
  console.log('8. Busca global');
  console.log('0. Sair');
  
  if (currentUser) {
    console.log(`\n👤 Logado como: ${currentUser.firstName} ${currentUser.lastName}`);
  }
}

// Função principal
async function main() {
  console.log('🛒 === DEMO - SISTEMA DE LISTAS DE COMPRAS ===');
  console.log('Este cliente demonstra todas as funcionalidades do sistema');
  
  // Verificar se os serviços estão funcionando
  const servicesHealthy = await checkHealth();
  if (!servicesHealthy) {
    console.log('\n⚠️ Alguns serviços não estão funcionando. Certifique-se de que todos os serviços estão rodando.');
    const continueAnyway = await question('\nContinuar mesmo assim? (s/N): ');
    if (continueAnyway.toLowerCase() !== 's') {
      rl.close();
      return;
    }
  }

  let lastCreatedList = null;

  while (true) {
    await showMenu();
    const choice = await question('\n👉 Escolha uma opção: ');

    switch (choice) {
      case '1':
        await checkHealth();
        break;
        
      case '2':
        await registerUser();
        break;
        
      case '3':
        await loginUser();
        break;
        
      case '4':
        await searchItems();
        break;
        
      case '5':
        await listCategories();
        break;
        
      case '6':
        if (!authToken) {
          console.log('❌ Você precisa estar logado para criar listas!');
          break;
        }
        
        const list = await createList();
        if (list) {
          lastCreatedList = list;
          const addItems = await question('\n➕ Deseja adicionar itens agora? (s/N): ');
          if (addItems.toLowerCase() === 's') {
            await addItemsToList(list.id);
            await viewList(list.id);
          }
        }
        break;
        
      case '7':
        if (!authToken) {
          console.log('❌ Você precisa estar logado para ver o dashboard!');
          break;
        }
        await viewDashboard();
        break;
        
      case '8':
        await globalSearch();
        break;
        
      case '0':
        console.log('\n👋 Obrigado por usar o sistema de listas de compras!');
        rl.close();
        return;
        
      default:
        console.log('❌ Opção inválida!');
    }

    await question('\n📝 Pressione Enter para continuar...');
  }
}

// Tratamento de erros
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Erro não tratado:', error.message);
});

process.on('SIGINT', () => {
  console.log('\n\n👋 Até logo!');
  rl.close();
  process.exit(0);
});

// Iniciar demo
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Erro fatal:', error.message);
    rl.close();
    process.exit(1);
  });
}