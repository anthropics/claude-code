/**
 * Claude Model Provider
 * 
 * Adapter implementation of the ModelProvider interface for Claude AI.
 * Handles communication with Claude API for embeddings and completions.
 */

const ModelProvider = require('../../neural/models/ModelProvider');

class ClaudeModelProvider extends ModelProvider {
  /**
   * @param {Object} dependencies - Dependencies
   * @param {Object} dependencies.apiClient - Claude API client
   * @param {Object} dependencies.config - Configuration
   * @param {Logger} dependencies.logger - Logger service
   */
  constructor({ apiClient, config, logger }) {
    super();
    this.apiClient = apiClient;
    this.config = config;
    this.logger = logger;
    this.defaultCompletionModel = config.claude.defaultModel || 'claude-3-opus-20240229';
    this.defaultEmbeddingModel = config.claude.embeddingModel || 'voyage-2';
    this.apiKey = config.claude.apiKey;
  }
  
  /**
   * Create embeddings for text
   * @param {Object} params - Embedding parameters
   * @param {string} params.model - Embedding model name
   * @param {string} params.input - Input text
   * @param {number} params.dimensions - Embedding dimensions
   * @returns {Promise<Object>} Embedding result
   */
  async createEmbedding(params) {
    try {
      const model = params.model || this.defaultEmbeddingModel;
      const dimensions = params.dimensions || 1536;
      
      this.logger.debug('Creating embedding', { model, textLength: params.input.length });
      
      // Call Claude API
      const response = await this.apiClient.embeddings.create({
        model,
        input: params.input,
        dimensions
      });
      
      return {
        vector: response.data[0].embedding,
        model,
        id: response.data[0].id
      };
    } catch (error) {
      this.logger.error('Error creating embedding', { 
        error: error.message,
        model: params.model
      });
      throw new Error(`Claude API embedding error: ${error.message}`);
    }
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
    try {
      const model = params.model || this.defaultEmbeddingModel;
      const dimensions = params.dimensions || 1536;
      
      this.logger.debug('Creating batch embeddings', { 
        model, 
        batchSize: params.inputs.length
      });
      
      // Check batch size limit
      const MAX_BATCH_SIZE = 100;
      if (params.inputs.length > MAX_BATCH_SIZE) {
        // Split into smaller batches
        const results = [];
        for (let i = 0; i < params.inputs.length; i += MAX_BATCH_SIZE) {
          const batchInputs = params.inputs.slice(i, i + MAX_BATCH_SIZE);
          const batchResults = await this._processBatch(model, batchInputs, dimensions);
          results.push(...batchResults);
        }
        return results;
      }
      
      return await this._processBatch(model, params.inputs, dimensions);
    } catch (error) {
      this.logger.error('Error creating batch embeddings', { 
        error: error.message,
        model: params.model
      });
      throw new Error(`Claude API batch embedding error: ${error.message}`);
    }
  }
  
  /**
   * Process a batch of embedding requests
   * @private
   * @param {string} model - Embedding model
   * @param {Array<string>} inputs - Input texts
   * @param {number} dimensions - Embedding dimensions
   * @returns {Promise<Array<Object>>} Embedding results
   */
  async _processBatch(model, inputs, dimensions) {
    // Call Claude API
    const response = await this.apiClient.embeddings.create({
      model,
      input: inputs,
      dimensions
    });
    
    return response.data.map(item => ({
      vector: item.embedding,
      model,
      id: item.id
    }));
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
    try {
      const model = params.model || this.defaultCompletionModel;
      const options = params.options || {};
      
      this.logger.debug('Generating text completion', { 
        model, 
        promptLength: params.prompt.length
      });
      
      // Map options to Claude API parameters
      const requestParams = {
        model,
        prompt: params.prompt,
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9,
        stop_sequences: options.stopSequences || [],
        stream: false
      };
      
      // Call Claude API
      const response = await this.apiClient.completions.create(requestParams);
      
      return {
        text: response.completion,
        model,
        usage: response.usage
      };
    } catch (error) {
      this.logger.error('Error generating text completion', { 
        error: error.message,
        model: params.model
      });
      throw new Error(`Claude API completion error: ${error.message}`);
    }
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
    try {
      const model = params.model || this.defaultCompletionModel;
      const options = params.options || {};
      
      this.logger.debug('Generating chat completion', { 
        model, 
        messageCount: params.messages.length
      });
      
      // Map options to Claude API parameters
      const requestParams = {
        model,
        messages: params.messages,
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9,
        stop_sequences: options.stopSequences || [],
        stream: false
      };
      
      if (options.tools) {
        requestParams.tools = options.tools;
      }
      
      if (options.system) {
        requestParams.system = options.system;
      }
      
      // Call Claude API
      const response = await this.apiClient.messages.create(requestParams);
      
      return {
        message: response.content[0].text,
        model,
        usage: response.usage,
        toolCalls: response.tool_calls || []
      };
    } catch (error) {
      this.logger.error('Error generating chat completion', { 
        error: error.message,
        model: params.model
      });
      throw new Error(`Claude API chat completion error: ${error.message}`);
    }
  }
}

module.exports = ClaudeModelProvider;