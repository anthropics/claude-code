/**
 * Model Provider Interface
 * 
 * Neural layer interface that defines methods for interacting with AI models.
 * Implemented by specific model provider adapters (e.g., OpenAI, Claude, etc.)
 */

class ModelProvider {
  /**
   * Create embeddings for text
   * @param {Object} params - Embedding parameters
   * @param {string} params.model - Embedding model name
   * @param {string} params.input - Input text
   * @param {number} params.dimensions - Embedding dimensions
   * @returns {Promise<Object>} Embedding result
   */
  async createEmbedding(params) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Create embeddings for multiple texts
   * @param {Object} params - Embedding parameters
   * @param {string} params.model - Embedding model name
   * @param {Array<string>} params.inputs - Input texts
   * @param {number} params.dimensions - Embedding dimensions
   * @returns {Promise<Array<Object>>} Embedding results
   */
  async createBatchEmbeddings(params) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Generate text completion
   * @param {Object} params - Generation parameters
   * @param {string} params.model - Model name
   * @param {string} params.prompt - Input prompt
   * @param {Object} params.options - Generation options
   * @returns {Promise<Object>} Generation result
   */
  async generateText(params) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Generate chat completion
   * @param {Object} params - Chat parameters
   * @param {string} params.model - Model name
   * @param {Array<Object>} params.messages - Chat messages
   * @param {Object} params.options - Generation options
   * @returns {Promise<Object>} Chat completion result
   */
  async generateChatCompletion(params) {
    throw new Error('Method not implemented');
  }
}

module.exports = ModelProvider;