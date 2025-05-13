/**
 * Claude Neural Framework
 * 
 * Main application entry point that sets up the pentagonal architecture
 * and wires up all dependencies.
 */

// External dependencies
const express = require('express');
const { MongoClient } = require('mongodb');
const winston = require('winston');

// Domain Layer
const Document = require('./domain/entities/Document');
const Embedding = require('./domain/values/Embedding');
const DocumentProcessor = require('./domain/services/DocumentProcessor');

// Application Layer
const DocumentApplicationService = require('./application/services/DocumentApplicationService');
const ProcessDocumentUseCase = require('./application/usecases/ProcessDocumentUseCase');
const DocumentDTO = require('./application/dtos/DocumentDTO');

// Neural Layer
const EmbeddingService = require('./neural/services/EmbeddingService');
const TextChunker = require('./neural/embedding/TextChunker');

// Ports Layer (Interfaces)
const DocumentController = require('./ports/inputs/DocumentController');
const VectorStoreRepository = require('./ports/outputs/VectorStoreRepository');
const DocumentRepository = require('./domain/repositories/DocumentRepository');
const ModelProvider = require('./neural/models/ModelProvider');

// Adapters Layer (Implementations)
const RestDocumentController = require('./adapters/controllers/RestDocumentController');
const MongoDocumentRepository = require('./adapters/repositories/MongoDocumentRepository');
const ClaudeModelProvider = require('./adapters/providers/ClaudeModelProvider');

/**
 * Initialize application
 */
async function initializeApp() {
  // Create logger
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' })
    ]
  });
  
  // Load configuration
  const config = {
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
      database: process.env.MONGODB_DATABASE || 'claude-neural-framework'
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY,
      defaultModel: process.env.CLAUDE_MODEL || 'claude-3-opus-20240229',
      embeddingModel: process.env.CLAUDE_EMBEDDING_MODEL || 'voyage-2'
    },
    embeddings: {
      defaultModel: 'voyage-2',
      dimensions: 1536
    },
    server: {
      port: process.env.PORT || 3000
    }
  };
  
  try {
    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    const mongoClient = new MongoClient(config.mongodb.uri);
    await mongoClient.connect();
    const db = mongoClient.db(config.mongodb.database);
    logger.info('Connected to MongoDB');
    
    // Create Claude API client (mock for now)
    const claudeApiClient = {
      embeddings: {
        create: async () => ({
          data: [{ embedding: Array(1536).fill(0).map(() => Math.random()), id: 'emb_' + Date.now() }]
        })
      },
      completions: {
        create: async () => ({
          completion: 'This is a mock completion',
          usage: { prompt_tokens: 10, completion_tokens: 5 }
        })
      },
      messages: {
        create: async () => ({
          content: [{ text: 'This is a mock message' }],
          usage: { prompt_tokens: 10, completion_tokens: 5 }
        })
      }
    };
    
    // Initialize repositories
    const documentRepository = new MongoDocumentRepository({ 
      db, 
      logger: logger.child({ module: 'MongoDocumentRepository' })
    });
    
    // Initialize model provider
    const modelProvider = new ClaudeModelProvider({
      apiClient: claudeApiClient,
      config,
      logger: logger.child({ module: 'ClaudeModelProvider' })
    });
    
    // Initialize neural services
    const embeddingService = new EmbeddingService({
      modelProvider,
      config,
      logger: logger.child({ module: 'EmbeddingService' })
    });
    
    // Initialize application services
    const documentService = new DocumentApplicationService({
      documentRepository,
      logger: logger.child({ module: 'DocumentApplicationService' })
    });
    
    // Initialize controllers
    const documentController = new RestDocumentController({
      documentService,
      logger: logger.child({ module: 'RestDocumentController' })
    });
    
    // Set up Express app
    const app = express();
    app.use(express.json());
    
    // Set up routes
    setupRoutes(app, documentController);
    
    // Start server
    const port = config.server.port;
    app.listen(port, () => {
      logger.info(`Server started on port ${port}`);
    });
    
    return { app, logger };
  } catch (error) {
    logger.error('Error initializing application', { error: error.message });
    throw error;
  }
}

/**
 * Set up application routes
 * @param {Object} app - Express app
 * @param {RestDocumentController} documentController - Document controller
 */
function setupRoutes(app, documentController) {
  // Document routes
  app.post('/api/documents', (req, res) => documentController.createDocument(req, res));
  app.get('/api/documents/:id', (req, res) => documentController.getDocument(req, res));
  app.put('/api/documents/:id', (req, res) => documentController.updateDocument(req, res));
  app.delete('/api/documents/:id', (req, res) => documentController.deleteDocument(req, res));
  app.get('/api/documents', (req, res) => documentController.searchDocuments(req, res));
  app.post('/api/documents/:id/analyze', (req, res) => documentController.analyzeDocument(req, res));
  
  // Health check route
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
}

// Only initialize if this file is run directly
if (require.main === module) {
  initializeApp().catch(error => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

module.exports = { initializeApp };