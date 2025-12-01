const amqp = require('amqplib');

class RabbitMQService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.exchange = 'shopping_events';
    this.rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  }

  async connect() {
    try {
      console.log('🐇 Conectando ao RabbitMQ...');
      this.connection = await amqp.connect(this.rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      
      // Criar exchange do tipo topic
      await this.channel.assertExchange(this.exchange, 'topic', {
        durable: true
      });
      
      console.log('✅ RabbitMQ conectado com sucesso');
      console.log(`📡 Exchange: ${this.exchange}`);
      
      // Handlers para erros
      this.connection.on('error', (err) => {
        console.error('❌ Erro na conexão RabbitMQ:', err.message);
      });
      
      this.connection.on('close', () => {
        console.log('🔌 Conexão RabbitMQ fechada');
      });
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao conectar ao RabbitMQ:', error.message);
      console.log('⚠️  Serviço continuará sem mensageria');
      return false;
    }
  }

  async publishCheckoutEvent(listData, userData) {
    if (!this.channel) {
      console.warn('⚠️  RabbitMQ não disponível, evento não publicado');
      return false;
    }

    try {
      const routingKey = 'list.checkout.completed';
      const message = {
        eventType: 'checkout.completed',
        timestamp: new Date().toISOString(),
        list: {
          id: listData.id,
          name: listData.name,
          userId: listData.userId,
          totalItems: listData.summary.totalItems,
          estimatedTotal: listData.summary.estimatedTotal,
          items: listData.items
        },
        user: {
          id: userData.id,
          email: userData.email,
          username: userData.username
        }
      };

      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      const published = this.channel.publish(
        this.exchange,
        routingKey,
        messageBuffer,
        {
          persistent: true,
          contentType: 'application/json',
          timestamp: Date.now()
        }
      );

      if (published) {
        console.log(`📤 Evento publicado: ${routingKey}`);
        console.log(`   Lista: ${listData.name} (${listData.id})`);
        console.log(`   Usuário: ${userData.email}`);
        return true;
      } else {
        console.warn('⚠️  Falha ao publicar evento');
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao publicar evento:', error.message);
      return false;
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
      console.log('✅ RabbitMQ desconectado');
    } catch (error) {
      console.error('❌ Erro ao fechar conexão RabbitMQ:', error.message);
    }
  }
}

module.exports = RabbitMQService;
