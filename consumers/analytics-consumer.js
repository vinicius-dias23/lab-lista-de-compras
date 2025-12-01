const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const EXCHANGE = 'shopping_events';
const QUEUE_NAME = 'analytics_queue';
const ROUTING_KEY = 'list.checkout.#';

class AnalyticsConsumer {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.stats = {
      totalCheckouts: 0,
      totalRevenue: 0,
      totalItems: 0,
      averageBasket: 0
    };
  }

  async connect() {
    try {
      console.log('🐇 Conectando ao RabbitMQ...');
      this.connection = await amqp.connect(RABBITMQ_URL);
      this.channel = await this.connection.createChannel();

      // Criar exchange
      await this.channel.assertExchange(EXCHANGE, 'topic', {
        durable: true
      });

      // Criar fila
      await this.channel.assertQueue(QUEUE_NAME, {
        durable: true
      });

      // Fazer binding da fila ao exchange com routing key
      await this.channel.bindQueue(QUEUE_NAME, EXCHANGE, ROUTING_KEY);

      console.log('✅ Analytics Consumer conectado');
      console.log(`📡 Exchange: ${EXCHANGE}`);
      console.log(`📬 Queue: ${QUEUE_NAME}`);
      console.log(`🔑 Routing Key: ${ROUTING_KEY}`);
      console.log('⏳ Aguardando mensagens...\n');

      // Configurar prefetch para processar uma mensagem por vez
      this.channel.prefetch(1);

      // Consumir mensagens
      this.channel.consume(QUEUE_NAME, async (msg) => {
        if (msg !== null) {
          await this.processMessage(msg);
        }
      });

      // Handlers de erro
      this.connection.on('error', (err) => {
        console.error('❌ Erro na conexão:', err.message);
      });

      this.connection.on('close', () => {
        console.log('🔌 Conexão fechada');
        setTimeout(() => this.connect(), 5000); // Reconectar após 5 segundos
      });

    } catch (error) {
      console.error('❌ Erro ao conectar:', error.message);
      console.log('🔄 Tentando reconectar em 5 segundos...');
      setTimeout(() => this.connect(), 5000);
    }
  }

  async processMessage(msg) {
    try {
      const content = msg.content.toString();
      const event = JSON.parse(content);

      console.log('📊 Nova mensagem recebida para análise!');
      console.log('═══════════════════════════════════════════════════════════');
      
      // Calcular estatísticas
      const totalGasto = event.list.estimatedTotal;
      const totalItens = event.list.totalItems;
      
      // Atualizar estatísticas globais
      this.stats.totalCheckouts++;
      this.stats.totalRevenue += totalGasto;
      this.stats.totalItems += totalItens;
      this.stats.averageBasket = this.stats.totalRevenue / this.stats.totalCheckouts;

      console.log(`📈 Processando checkout da lista: ${event.list.name}`);
      console.log(`   ID da Lista: ${event.list.id}`);
      console.log(`   Usuário: ${event.user.username} (${event.user.email})`);
      console.log(`   Total de itens: ${totalItens}`);
      console.log(`   Total gasto: R$ ${totalGasto.toFixed(2)}`);
      
      // Simular delay de processamento (cálculos e atualização de dashboard)
      await new Promise(resolve => setTimeout(resolve, 800));
      
      console.log('\n📊 ESTATÍSTICAS ATUALIZADAS DO DASHBOARD:');
      console.log(`   Total de checkouts processados: ${this.stats.totalCheckouts}`);
      console.log(`   Receita total: R$ ${this.stats.totalRevenue.toFixed(2)}`);
      console.log(`   Total de itens vendidos: ${this.stats.totalItems}`);
      console.log(`   Ticket médio: R$ ${this.stats.averageBasket.toFixed(2)}`);
      
      console.log('\n✅ Analytics processado com sucesso!');
      console.log('═══════════════════════════════════════════════════════════\n');

      // Confirmar processamento (ACK)
      this.channel.ack(msg);

    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error.message);
      
      // Rejeitar mensagem e reenviar para a fila
      this.channel.nack(msg, false, true);
    }
  }

  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      console.log('✅ Consumer desconectado');
    } catch (error) {
      console.error('❌ Erro ao fechar conexão:', error.message);
    }
  }
}

// Inicializar consumer
const consumer = new AnalyticsConsumer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando Analytics Consumer...');
  await consumer.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Encerrando Analytics Consumer...');
  await consumer.close();
  process.exit(0);
});

// Iniciar
console.log('🚀 Analytics Consumer - Analytics Service');
console.log('════════════════════════════════════════════════════\n');
consumer.connect();
