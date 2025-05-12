/**
 * Embedding Service
 * 
 * Neural layer service that handles vector embeddings for documents and queries.
 * Encapsulates model selection, embedding generation, and vector operations.
 */

const Embedding = require('../../domain/values/Embedding');

class EmbeddingService {
  /**
   * @param {Object} dependencies - Dependencies
   * @param {Object} dependencies.modelProvider - AI model provider
   * @param {Object} dependencies.config - Configuration
   * @param {Logger} dependencies.logger - Logger service
   */
  constructor({ modelProvider, config, logger }) {
    this.modelProvider = modelProvider;
    this.config = config;
    this.logger = logger;
    this.defaultModel = config.embeddings.defaultModel || 'voyage-lite-02';
    this.dimensions = config.embeddings.dimensions || 1536;
  }
  
  /**
   * Generate embeddings for text
   * @param {string} text - Input text
   * @param {Object} options - Embedding options
   * @param {string} options.model - Embedding model to use
   * @returns {Promise<Embedding>} Embedding value object
   */
  async generateEmbedding(text, options = {}) {
    const model = options.model || this.defaultModel;
    
    try {
      this.logger.debug('Generating embedding', { model, textLength: text.length });
      
      // Call model provider to get embedding vector
      const result = await this.modelProvider.createEmbedding({
        model,
        input: text,
        dimensions: this.dimensions
      });
      
      // Create embedding value object
      return new Embedding({
        vector: result.vector,
        model: model,
        dimensions: result.vector.length
      });
    } catch (error) {
      this.logger.error('Error generating embedding', { 
        error: error.message,
        model
      });
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }
  
  /**
   * Generate embeddings for a batch of texts
   * @param {Array<string>} texts - Array of input texts
   * @param {Object} options - Embedding options
   * @param {string} options.model - Embedding model to use
   * @returns {Promise<Array<Embedding>>} Array of embedding value objects
   */
  async generateBatchEmbeddings(texts, options = {}) {
    const model = options.model || this.defaultModel;
    
    try {
      this.logger.debug('Generating batch embeddings', { 
        model, 
        batchSize: texts.length 
      });
      
      // Call model provider to get embedding vectors
      const results = await this.modelProvider.createBatchEmbeddings({
        model,
        inputs: texts,
        dimensions: this.dimensions
      });
      
      // Create embedding value objects
      return results.map(result => new Embedding({
        vector: result.vector,
        model: model,
        dimensions: result.vector.length
      }));
    } catch (error) {
      this.logger.error('Error generating batch embeddings', { 
        error: error.message,
        model,
        batchSize: texts.length
      });
      throw new Error(`Failed to generate batch embeddings: ${error.message}`);
    }
  }
  
  /**
   * Find similar embeddings
   * @param {Embedding} queryEmbedding - Query embedding
   * @param {Array<Embedding>} candidateEmbeddings - Candidate embeddings
   * @param {Object} options - Search options
   * @param {number} options.topK - Number of results to return
   * @param {number} options.minScore - Minimum similarity score (0-1)
   * @returns {Array<Object>} Similarity results with scores
   */
  findSimilarEmbeddings(queryEmbedding, candidateEmbeddings, options = {}) {
    const { topK = 5, minScore = 0.7 } = options;
    
    try {
      // Calculate similarity scores
      const results = candidateEmbeddings.map((embedding, index) => {
        const score = queryEmbedding.cosineSimilarity(embedding);
        return { index, embedding, score };
      });
      
      // Filter by minimum score
      const filtered = results.filter(result => result.score >= minScore);
      
      // Sort by score (descending)
      const sorted = filtered.sort((a, b) => b.score - a.score);
      
      // Take top K results
      return sorted.slice(0, topK);
    } catch (error) {
      this.logger.error('Error finding similar embeddings', { error: error.message });
      throw new Error(`Failed to find similar embeddings: ${error.message}`);
    }
  }
}

module.exports = EmbeddingService;