/**
 * Document Application Service
 * 
 * Coordinates multiple document-related use cases and provides
 * a simplified interface for clients.
 */

const ProcessDocumentUseCase = require('../usecases/ProcessDocumentUseCase');
const DocumentDTO = require('../dtos/DocumentDTO');

class DocumentApplicationService {
  /**
   * @param {Object} dependencies - Dependencies
   * @param {DocumentRepository} dependencies.documentRepository - Document repository
   * @param {Logger} dependencies.logger - Logger service
   */
  constructor({ documentRepository, logger }) {
    this.documentRepository = documentRepository;
    this.logger = logger;
    this.processDocumentUseCase = new ProcessDocumentUseCase({ 
      documentRepository, 
      logger
    });
  }
  
  /**
   * Process a document (create or update)
   * @param {Object} documentData - Document data
   * @returns {Promise<DocumentDTO>} Document DTO
   */
  async processDocument(documentData) {
    try {
      const result = await this.processDocumentUseCase.execute(documentData);
      
      // Convert domain entity to DTO
      return new DocumentDTO(result.document);
    } catch (error) {
      this.logger.error('Error in document service', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Get a document by ID
   * @param {string} id - Document ID
   * @returns {Promise<DocumentDTO|null>} Document DTO or null if not found
   */
  async getDocument(id) {
    try {
      const document = await this.documentRepository.findById(id);
      
      if (!document) {
        return null;
      }
      
      return new DocumentDTO(document);
    } catch (error) {
      this.logger.error('Error getting document', { error: error.message, id });
      throw error;
    }
  }
  
  /**
   * Find documents by criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Search options
   * @returns {Promise<Array<DocumentDTO>>} Document DTOs
   */
  async findDocuments(criteria, options = {}) {
    try {
      const documents = await this.documentRepository.findByCriteria(criteria, options);
      
      return documents.map(doc => new DocumentDTO(doc));
    } catch (error) {
      this.logger.error('Error finding documents', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Delete a document
   * @param {string} id - Document ID
   * @returns {Promise<boolean>} True if document was deleted
   */
  async deleteDocument(id) {
    try {
      return await this.documentRepository.delete(id);
    } catch (error) {
      this.logger.error('Error deleting document', { error: error.message, id });
      throw error;
    }
  }
}

module.exports = DocumentApplicationService;