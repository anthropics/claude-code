/**
 * Process Document Use Case
 * 
 * Application use case that coordinates domain services and repositories
 * to process a document and store its metadata.
 */

const Document = require('../../domain/entities/Document');
const DocumentProcessor = require('../../domain/services/DocumentProcessor');

class ProcessDocumentUseCase {
  /**
   * @param {Object} dependencies - Dependencies
   * @param {DocumentRepository} dependencies.documentRepository - Document repository
   * @param {Logger} dependencies.logger - Logger service
   */
  constructor({ documentRepository, logger }) {
    this.documentRepository = documentRepository;
    this.logger = logger;
    this.documentProcessor = new DocumentProcessor();
  }
  
  /**
   * Execute the use case
   * @param {Object} input - Use case input
   * @param {string} input.id - Document ID (if updating)
   * @param {string} input.content - Document content
   * @param {string} input.title - Document title
   * @param {string} input.type - Document type
   * @returns {Promise<Object>} Processed document
   */
  async execute(input) {
    try {
      this.logger.info('Processing document', { title: input.title });
      
      let document;
      
      // Check if document exists
      if (input.id) {
        document = await this.documentRepository.findById(input.id);
        
        if (document) {
          // Update existing document
          document.updateContent(input.content);
          if (input.title) document.title = input.title;
          if (input.type) document.type = input.type;
        }
      }
      
      // Create new document if not found
      if (!document) {
        document = new Document({
          id: input.id || this._generateId(),
          content: input.content,
          title: input.title,
          type: input.type
        });
      }
      
      // Extract metadata
      const metadata = this.documentProcessor.extractMetadata(document);
      document.updateMetadata(metadata);
      
      // Check for sensitive information
      const sensitiveCheck = this.documentProcessor.checkSensitiveInfo(document);
      document.updateMetadata({ sensitiveInfo: sensitiveCheck });
      
      // Split document into chunks
      const chunks = this.documentProcessor.splitIntoChunks(document, {
        maxChunkSize: 1000,
        overlapStrategy: 'percentage',
        overlapSize: 10
      });
      
      // Save document
      const savedDocument = await this.documentRepository.save(document);
      
      // Return processed result
      return {
        document: savedDocument,
        chunks: chunks,
        sensitiveInfoDetected: sensitiveCheck.containsSensitiveInfo
      };
    } catch (error) {
      this.logger.error('Error processing document', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Generate a unique document ID
   * @private
   * @returns {string} Unique ID
   */
  _generateId() {
    return 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }
}

module.exports = ProcessDocumentUseCase;