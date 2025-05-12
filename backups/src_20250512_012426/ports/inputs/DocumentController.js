/**
 * Document Controller Interface
 * 
 * Input port that defines the API for document operations.
 * Implemented by REST, GraphQL, or other adapters.
 */

class DocumentController {
  /**
   * Create a new document
   * @param {Object} documentData - Document data
   * @returns {Promise<Object>} Created document
   */
  async createDocument(documentData) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Get a document by ID
   * @param {string} id - Document ID
   * @returns {Promise<Object>} Document
   */
  async getDocument(id) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Update a document
   * @param {string} id - Document ID
   * @param {Object} documentData - Document data
   * @returns {Promise<Object>} Updated document
   */
  async updateDocument(id, documentData) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Delete a document
   * @param {string} id - Document ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteDocument(id) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Search documents
   * @param {Object} query - Search query
   * @returns {Promise<Object>} Search results
   */
  async searchDocuments(query) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Process document analysis
   * @param {string} id - Document ID
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeDocument(id, options) {
    throw new Error('Method not implemented');
  }
}

module.exports = DocumentController;