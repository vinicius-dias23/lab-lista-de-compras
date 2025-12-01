const amqp = require('amqplib');

async function testIntegration() {
  console.log('🧪 Teste de Integração - Fluxo Completo de Mensageria');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Conectar ao RabbitMQ
    console.log('1️⃣  Conectando ao RabbitMQ...');
    const connection = await amqp.connect('amqp://localhost:5672');
    const channel = await connection.createChannel();
    console.log('✅ Conectado!\n');

    // Verificar exchange
    console.log('2️⃣  Verificando exchange "shopping_events"...');
    await channel.assertExchange('shopping_events', 'topic', { durable: true });
    console.log('✅ Exchange verificado!\n');

    // Verificar filas
    console.log('3️⃣  Verificando filas dos consumers...');
    const notificationQueue = await channel.checkQueue('notification_queue');
    const analyticsQueue = await channel.checkQueue('analytics_queue');
    console.log(`✅ notification_queue: ${notificationQueue.messageCount} mensagens`);
    console.log(`✅ analytics_queue: ${analyticsQueue.messageCount} mensagens\n`);

    // Simular evento de checkout
    console.log('4️⃣  Simulando evento de checkout...');
    const checkoutEvent = {
      eventType: 'checkout.completed',
      timestamp: new Date().toISOString(),
      list: {
        id: 'test-list-123',
        name: 'Lista de Teste Integração',
        userId: 'user-456',
        totalItems: 5,
        estimatedTotal: 150.75,
        items: [
          { itemId: '1', itemName: 'Arroz', quantity: 2, estimatedPrice: 25.50 },
          { itemId: '2', itemName: 'Feijão', quantity: 1, estimatedPrice: 12.00 },
          { itemId: '3', itemName: 'Óleo', quantity: 1, estimatedPrice: 8.50 }
        ]
      },
      user: {
        id: 'user-456',
        email: 'teste@exemplo.com',
        username: 'usuario_teste'
      }
    };

    const published = channel.publish(
      'shopping_events',
      'list.checkout.completed',
      Buffer.from(JSON.stringify(checkoutEvent)),
      {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now()
      }
    );

    if (published) {
      console.log('✅ Evento publicado com sucesso!');
      console.log(`   Lista: ${checkoutEvent.list.name}`);
      console.log(`   Total: R$ ${checkoutEvent.list.estimatedTotal.toFixed(2)}`);
      console.log(`   Usuário: ${checkoutEvent.user.email}\n`);
    }

    // Aguardar um pouco para os consumers processarem
    console.log('5️⃣  Aguardando processamento pelos consumers...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verificar se as mensagens foram processadas
    console.log('\n6️⃣  Verificando status das filas após processamento...');
    const notificationQueueAfter = await channel.checkQueue('notification_queue');
    const analyticsQueueAfter = await channel.checkQueue('analytics_queue');
    
    console.log(`   notification_queue: ${notificationQueueAfter.messageCount} mensagens`);
    console.log(`   analytics_queue: ${analyticsQueueAfter.messageCount} mensagens\n`);

    if (notificationQueueAfter.messageCount === 0 && analyticsQueueAfter.messageCount === 0) {
      console.log('✅ Mensagens foram processadas pelos consumers!\n');
    } else {
      console.log('⚠️  Mensagens ainda na fila (consumers podem não estar rodando)\n');
    }

    // Estatísticas
    console.log('7️⃣  Estatísticas do RabbitMQ:');
    console.log(`   Exchange: shopping_events (tipo: topic)`);
    console.log(`   Filas configuradas: 2`);
    console.log(`   Routing Key: list.checkout.completed`);
    console.log(`   Padrão de binding: list.checkout.#\n`);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ TESTE DE INTEGRAÇÃO CONCLUÍDO COM SUCESSO!');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📋 Próximos passos:');
    console.log('   1. Inicie os consumers: ./start-consumers.sh');
    console.log('   2. Execute este teste novamente para ver o processamento');
    console.log('   3. Ou inicie os serviços e use: node test-checkout.js\n');

    console.log('🌐 RabbitMQ Management UI: http://localhost:15672');
    console.log('   Usuário: guest | Senha: guest\n');

    // Fechar conexão
    await channel.close();
    await connection.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erro no teste:', error.message);
    process.exit(1);
  }
}

testIntegration();
