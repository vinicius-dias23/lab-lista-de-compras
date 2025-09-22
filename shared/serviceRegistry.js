const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class ServiceRegistry {
  constructor(registryFile = './shared/registry.json') {
    this.registryFile = registryFile;
    this.services = new Map();
    this.healthCheckInterval = 30000; // 30 segundos
    this.healthCheckTimer = null;
    this.circuitBreakers = new Map();
  }

  async initialize() {
    try {
      // Tentar carregar registry existente
      const registryData = await fs.readFile(this.registryFile, 'utf8');
      const services = JSON.parse(registryData);
      
      services.forEach(service => {
        this.services.set(service.name, service);
        this.initCircuitBreaker(service.name);
      });

      console.log('🔧 Service Registry carregado');
    } catch (error) {
      // Registry não existe, começar vazio
      console.log('🔧 Service Registry iniciado vazio');
    }

    // Iniciar health checks
    this.startHealthChecks();
  }

  async registerService(name, url, metadata = {}) {
    const service = {
      name,
      url,
      metadata,
      status: 'healthy',
      registeredAt: new Date().toISOString(),
      lastHealthCheck: new Date().toISOString(),
      failureCount: 0
    };

    this.services.set(name, service);
    this.initCircuitBreaker(name);
    await this.saveRegistry();
    
    console.log(`✅ Serviço registrado: ${name} em ${url}`);
    return service;
  }

  async unregisterService(name) {
    if (this.services.has(name)) {
      this.services.delete(name);
      this.circuitBreakers.delete(name);
      await this.saveRegistry();
      console.log(`❌ Serviço removido: ${name}`);
      return true;
    }
    return false;
  }

  getService(name) {
    const service = this.services.get(name);
    if (!service) return null;

    // Verificar circuit breaker
    const breaker = this.circuitBreakers.get(name);
    if (breaker && breaker.state === 'open') {
      // Verificar se deve tentar half-open
      if (Date.now() - breaker.lastFailure > breaker.timeout) {
        breaker.state = 'half-open';
        console.log(`🔄 Circuit breaker ${name} em half-open`);
      } else {
        throw new Error(`Circuit breaker aberto para ${name}`);
      }
    }

    return service;
  }

  getAllServices() {
    return Array.from(this.services.values());
  }

  getHealthyServices() {
    return Array.from(this.services.values())
      .filter(service => service.status === 'healthy');
  }

  initCircuitBreaker(serviceName) {
    this.circuitBreakers.set(serviceName, {
      state: 'closed', // closed, open, half-open
      failures: 0,
      threshold: 3,
      timeout: 60000, // 1 minuto
      lastFailure: 0
    });
  }

  recordSuccess(serviceName) {
    const breaker = this.circuitBreakers.get(serviceName);
    if (breaker) {
      breaker.failures = 0;
      if (breaker.state === 'half-open') {
        breaker.state = 'closed';
        console.log(`✅ Circuit breaker ${serviceName} fechado`);
      }
    }
  }

  recordFailure(serviceName) {
    const breaker = this.circuitBreakers.get(serviceName);
    if (breaker) {
      breaker.failures++;
      breaker.lastFailure = Date.now();

      if (breaker.failures >= breaker.threshold) {
        breaker.state = 'open';
        console.log(`🚨 Circuit breaker ${serviceName} aberto após ${breaker.failures} falhas`);
      }
    }
  }

  async saveRegistry() {
    try {
      const services = Array.from(this.services.values());
      await fs.writeFile(this.registryFile, JSON.stringify(services, null, 2));
    } catch (error) {
      console.error('❌ Erro ao salvar registry:', error);
    }
  }

  async performHealthCheck(service) {
    try {
      const response = await axios.get(`${service.url}/health`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'ServiceRegistry-HealthCheck'
        }
      });

      if (response.status === 200) {
        service.status = 'healthy';
        service.lastHealthCheck = new Date().toISOString();
        service.failureCount = 0;
        this.recordSuccess(service.name);
        return true;
      }
    } catch (error) {
      service.status = 'unhealthy';
      service.failureCount = (service.failureCount || 0) + 1;
      service.lastError = error.message;
      this.recordFailure(service.name);
      
      console.log(`🔍 Health check falhou para ${service.name}: ${error.message}`);
      return false;
    }
  }

  startHealthChecks() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      const services = Array.from(this.services.values());
      
      for (const service of services) {
        await this.performHealthCheck(service);
      }
      
      await this.saveRegistry();
    }, this.healthCheckInterval);

    console.log(`🏥 Health checks iniciados (${this.healthCheckInterval/1000}s)`);
  }

  stopHealthChecks() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      console.log('🏥 Health checks parados');
    }
  }

  // Método para cleanup ao desligar
  async shutdown() {
    this.stopHealthChecks();
    await this.saveRegistry();
    console.log('🔧 Service Registry finalizado');
  }

  // Descoberta de serviços por tipo/tag
  findServicesByTag(tag) {
    return Array.from(this.services.values())
      .filter(service => service.metadata.tags && service.metadata.tags.includes(tag))
      .filter(service => service.status === 'healthy');
  }

  // Load balancing simples (round robin)
  getServiceWithLoadBalancing(serviceName) {
    const services = Array.from(this.services.values())
      .filter(service => service.name.startsWith(serviceName) && service.status === 'healthy');

    if (services.length === 0) return null;

    // Round robin baseado em timestamp
    const index = Math.floor(Date.now() / 1000) % services.length;
    return services[index];
  }
}

// Singleton instance
let registryInstance = null;

function getServiceRegistry() {
  if (!registryInstance) {
    registryInstance = new ServiceRegistry();
  }
  return registryInstance;
}

module.exports = {
  ServiceRegistry,
  getServiceRegistry
};