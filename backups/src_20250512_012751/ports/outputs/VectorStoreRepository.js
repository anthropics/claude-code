/**
 * Vector Store Repository Interface
 * 
 * Output port that defines operations for vector storage.
 * Implemented by specific database adapters.
 */

class VectorStoreRepository {
  /**
   * Store embedding vector with metadata
   * @param {Object} params - Storage parameters
   * @param {string} params.id - Document ID
   * @param {Array<number>} params.vector - Embedding vector
   * @param {string} params.text - Original text
   * @param {Object} params.metadata - Associated metadata
   * @returns {Promise<Object>} Storage result
   */
  async storeVector({ id, vector, text, metadata }) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Store multiple embedding vectors
   * @param {Array<Object>} vectors - Array of vector objects
   * @returns {Promise<Array<Object>>} Storage results
   */
  async storeBatchVectors(vectors) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Find similar vectors
   * @param {Array<number>} queryVector - Query vector
   * @param {Object} options - Search options
   * @param {number} options.topK - Number of results
   * @param {number} options.minScore - Minimum similarity score
   * @param {Object} options.filter - Metadata filter
   * @returns {Promise<Array<Object>>} Similar vectors with metadata
   */
  async findSimilarVectors(queryVector, options) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Delete vectors by ID
   * @param {string} id - Document ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteVectorsByDocumentId(id) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Get vector by ID
   * @param {string} id - Vector ID
   * @returns {Promise<Object|null>} Vector or null if not found
   */
  async getVector(id) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Count vectors matching filter
   * @param {Object} filter - Metadata filter
   * @returns {Promise<number>} Vector count
   */
  async countVectors(filter = {}) {
    throw new Error('Method not implemented');
  }
}

module.exports = VectorStoreRepository;