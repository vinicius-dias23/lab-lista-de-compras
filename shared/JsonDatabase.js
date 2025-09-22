const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class JsonDatabase {
  constructor(filename, dataDir = './data') {
    this.filename = filename;
    this.dataDir = dataDir;
    this.filepath = path.join(dataDir, `${filename}.json`);
    this.data = [];
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Criar diretório se não existir
      await fs.mkdir(this.dataDir, { recursive: true });

      // Tentar carregar dados existentes
      try {
        const fileData = await fs.readFile(this.filepath, 'utf8');
        this.data = JSON.parse(fileData);
        console.log(`📊 Database ${this.filename} carregado com ${this.data.length} registros`);
      } catch (error) {
        // Arquivo não existe, criar vazio
        this.data = [];
        await this.save();
        console.log(`📊 Database ${this.filename} criado`);
      }

      this.initialized = true;
    } catch (error) {
      console.error(`❌ Erro ao inicializar database ${this.filename}:`, error);
      throw error;
    }
  }

  async save() {
    try {
      await fs.writeFile(this.filepath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error(`❌ Erro ao salvar database ${this.filename}:`, error);
      throw error;
    }
  }

  // Operações CRUD
  async create(record) {
    await this.initialize();
    
    const newRecord = {
      id: uuidv4(),
      ...record,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.data.push(newRecord);
    await this.save();
    return newRecord;
  }

  async findAll(filter = {}) {
    await this.initialize();
    
    if (Object.keys(filter).length === 0) {
      return [...this.data];
    }

    return this.data.filter(record => {
      return Object.keys(filter).every(key => {
        if (typeof filter[key] === 'object' && filter[key].regex) {
          const regex = new RegExp(filter[key].regex, 'i');
          return regex.test(record[key]);
        }
        return record[key] === filter[key];
      });
    });
  }

  async findById(id) {
    await this.initialize();
    return this.data.find(record => record.id === id) || null;
  }

  async findOne(filter) {
    await this.initialize();
    return this.data.find(record => {
      return Object.keys(filter).every(key => record[key] === filter[key]);
    }) || null;
  }

  async updateById(id, updates) {
    await this.initialize();
    
    const index = this.data.findIndex(record => record.id === id);
    if (index === -1) return null;

    this.data[index] = {
      ...this.data[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.save();
    return this.data[index];
  }

  async deleteById(id) {
    await this.initialize();
    
    const index = this.data.findIndex(record => record.id === id);
    if (index === -1) return null;

    const deletedRecord = this.data.splice(index, 1)[0];
    await this.save();
    return deletedRecord;
  }

  async count(filter = {}) {
    const records = await this.findAll(filter);
    return records.length;
  }

  // Método para busca avançada
  async search(query, fields = []) {
    await this.initialize();
    
    if (!query || fields.length === 0) return [];

    const searchRegex = new RegExp(query, 'i');
    return this.data.filter(record => {
      return fields.some(field => {
        const value = record[field];
        return value && searchRegex.test(value.toString());
      });
    });
  }

  // Cleanup para desenvolvimento
  async clear() {
    await this.initialize();
    this.data = [];
    await this.save();
    console.log(`🧹 Database ${this.filename} limpo`);
  }
}

module.exports = JsonDatabase;