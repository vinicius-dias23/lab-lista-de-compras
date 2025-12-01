const amqp = require('amqplib');

async function testRabbitMQ() {
  console.log('🧪 Testando conexão com RabbitMQ...\n');
  
  try {
    // Conectar
    console.log('1️⃣  Conectando ao RabbitMQ...');
    const connection = await amqp.connect('amqp://localhost:5672');
    console.log('✅ Conectado com sucesso!\n');
    
    // Criar canal
    console.log('2️⃣  Criando canal...');
    const channel = await connection.createChannel();
    console.log('✅ Canal criado!\n');
    
    // Criar exchange
    console.log('3️⃣  Criando exchange "shopping_events"...');
    await channel.assertExchange('shopping_events', 'topic', { durable: true });
    console.log('✅ Exchange criado!\n');
    
    // Criar fila de teste
    console.log('4️⃣  Criando fila de teste...');
    const queue = await channel.assertQueue('test_queue', { durable: true });
    console.log('✅ Fila criada:', queue.queue, '\n');
    
    // Fazer binding
    console.log('5️⃣  Fazendo binding da fila ao exchange...');
    await channel.bindQueue('test_queue', 'shopping_events', 'test.#');
    console.log('✅ Binding realizado!\n');
    
    // Publicar mensagem de teste
    console.log('6️⃣  Publicando mensagem de teste...');
    const message = {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Teste de mensageria'
    };
    
    channel.publish(
      'shopping_events',
      'test.message',
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );
    console.log('✅ Mensagem publicada!\n');
    
    // Consumir mensagem
    console.log('7️⃣  Consumindo mensagem...');
    const consumeResult = await new Promise((resolve) => {
      channel.consume('test_queue', (msg) => {
        if (msg) {
          const content = JSON.parse(msg.content.toString());
          console.log('✅ Mensagem recebida:', content);
          channel.ack(msg);
          resolve(true);
        }
      });
    });
    
    console.log('\n✅ Teste concluído com sucesso!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 RabbitMQ está funcionando corretamente!');
    console.log('📡 Exchange: shopping_events');
    console.log('📬 Fila de teste: test_queue');
    console.log('🔗 Management UI: http://localhost:15672');
    console.log('   Usuário: guest | Senha: guest');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Limpar
    await channel.deleteQueue('test_queue');
    await channel.close();
    await connection.close();
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Erro no teste:', error.message);
    process.exit(1);
  }
}

testRabbitMQ();
