const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function testCheckout() {
  try {
    console.log('🧪 Script de Teste - Checkout com Mensageria');
    console.log('═══════════════════════════════════════════════════════════\n');

    // 1. Registrar usuário
    console.log('1️⃣  Registrando usuário...');
    const registerData = {
      email: `test${Date.now()}@exemplo.com`,
      password: 'senha123',
      username: `usuario_${Date.now()}`,
      firstName: 'Teste',
      lastName: 'Mensageria'
    };

    let token;
    try {
      const registerResponse = await axios.post(`${API_URL}/auth/register`, registerData);
      token = registerResponse.data.token;
      console.log('✅ Usuário registrado com sucesso');
      console.log(`   Email: ${registerData.email}\n`);
    } catch (error) {
      // Se já existe, fazer login
      console.log('⚠️  Usuário já existe, fazendo login...');
      const loginResponse = await axios.post(`${API_URL}/auth/login`, {
        email: registerData.email,
        password: registerData.password
      });
      token = loginResponse.data.token;
      console.log('✅ Login realizado com sucesso\n');
    }

    // 2. Buscar itens disponíveis
    console.log('2️⃣  Buscando itens disponíveis...');
    const itemsResponse = await axios.get(`${API_URL}/items?limit=5`);
    const items = itemsResponse.data.items;
    console.log(`✅ ${items.length} itens encontrados\n`);

    // 3. Criar lista
    console.log('3️⃣  Criando lista de compras...');
    const listData = {
      name: `Lista de Teste - ${new Date().toLocaleString('pt-BR')}`,
      description: 'Lista criada para testar o sistema de mensageria'
    };

    const listResponse = await axios.post(`${API_URL}/lists`, listData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const listId = listResponse.data.list.id;
    console.log('✅ Lista criada com sucesso');
    console.log(`   ID: ${listId}`);
    console.log(`   Nome: ${listData.name}\n`);

    // 4. Adicionar itens à lista
    console.log('4️⃣  Adicionando itens à lista...');
    for (let i = 0; i < Math.min(3, items.length); i++) {
      const item = items[i];
      await axios.post(`${API_URL}/lists/${listId}/items`, {
        itemId: item.id,
        quantity: Math.floor(Math.random() * 5) + 1,
        notes: 'Item de teste'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(`   ✓ ${item.name} adicionado`);
    }
    console.log('✅ Itens adicionados com sucesso\n');

    // 5. Buscar lista atualizada
    console.log('5️⃣  Verificando lista...');
    const updatedListResponse = await axios.get(`${API_URL}/lists/${listId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const updatedList = updatedListResponse.data.list;
    console.log('✅ Lista verificada');
    console.log(`   Total de itens: ${updatedList.summary.totalItems}`);
    console.log(`   Valor estimado: R$ ${updatedList.summary.estimatedTotal.toFixed(2)}\n`);

    // 6. FAZER CHECKOUT (dispara eventos no RabbitMQ)
    console.log('6️⃣  🚀 FAZENDO CHECKOUT (disparando eventos)...');
    console.log('═══════════════════════════════════════════════════════════');
    
    const startTime = Date.now();
    const checkoutResponse = await axios.post(`${API_URL}/lists/${listId}/checkout`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    console.log('\n✅ CHECKOUT CONCLUÍDO!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`⚡ Tempo de resposta: ${responseTime}ms`);
    console.log(`📊 Status HTTP: ${checkoutResponse.status} ${checkoutResponse.statusText}`);
    console.log(`📝 Mensagem: ${checkoutResponse.data.message}`);
    console.log(`ℹ️  Info: ${checkoutResponse.data.info}`);
    console.log('\n📡 Evento publicado no RabbitMQ!');
    console.log('   Exchange: shopping_events');
    console.log('   Routing Key: list.checkout.completed');
    console.log('\n👀 Verifique os logs dos consumers para ver o processamento assíncrono!');
    console.log('   - Notification Consumer: logs/notification-consumer.log');
    console.log('   - Analytics Consumer: logs/analytics-consumer.log');
    console.log('\n🌐 Acesse o RabbitMQ Management: http://localhost:15672');
    console.log('   Usuário: guest | Senha: guest');
    console.log('\n═══════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ Erro no teste:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Dados:', error.response.data);
    }
    process.exit(1);
  }
}

// Executar teste
console.log('\n');
testCheckout();
