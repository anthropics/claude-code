/**
 * Document Repository Interface
 * 
 * Domain repository interface that defines operations for document persistence.
 * This is an interface that will be implemented by adapters.
 */

class DocumentRepository {
  /**
   * Find document by ID
   * @param {string} id - Document ID
   * @returns {Promise<Document|null>} Document entity or null if not found
   */
  async findById(id) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Find documents by criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Search options (pagination, sorting)
   * @returns {Promise<Array<Document>>} Array of document entities
   */
  async findByCriteria(criteria, options = {}) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Save a document
   * @param {Document} document - Document entity to save
   * @returns {Promise<Document>} Saved document entity
   */
  async save(document) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Delete a document
   * @param {string} id - Document ID
   * @returns {Promise<boolean>} True if document was deleted
   */
  async delete(id) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Count documents matching criteria
   * @param {Object} criteria - Count criteria
   * @returns {Promise<number>} Document count
   */
  async count(criteria = {}) {
    throw new Error('Method not implemented');
  }
}

module.exports = DocumentRepository;