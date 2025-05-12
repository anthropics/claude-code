/**
 * REST Document Controller
 * 
 * Adapter implementation of the DocumentController for REST API.
 * Handles HTTP requests and translates between API and application layer.
 */

const DocumentController = require('../../ports/inputs/DocumentController');
const DocumentDTO = require('../../application/dtos/DocumentDTO');

class RestDocumentController extends DocumentController {
  /**
   * @param {Object} dependencies - Dependencies
   * @param {DocumentApplicationService} dependencies.documentService - Document application service
   * @param {Logger} dependencies.logger - Logger service
   */
  constructor({ documentService, logger }) {
    super();
    this.documentService = documentService;
    this.logger = logger;
  }
  
  /**
   * Create a new document
   * @param {Object} req - HTTP request
   * @param {Object} res - HTTP response
   */
  async createDocument(req, res) {
    try {
      // Validate request body
      if (!req.body || !req.body.content) {
        return res.status(400).json({
          error: 'Document content is required'
        });
      }
      
      // Convert request to DTO
      const documentData = DocumentDTO.fromRequest(req.body);
      
      // Call application service
      const result = await this.documentService.processDocument(documentData);
      
      // Return success response
      return res.status(201).json({
        success: true,
        document: result
      });
    } catch (error) {
      this.logger.error('Error creating document', { error: error.message });
      
      return res.status(500).json({
        error: 'Failed to create document',
        message: error.message
      });
    }
  }
  
  /**
   * Get a document by ID
   * @param {Object} req - HTTP request
   * @param {Object} res - HTTP response
   */
  async getDocument(req, res) {
    try {
      const id = req.params.id;
      
      if (!id) {
        return res.status(400).json({
          error: 'Document ID is required'
        });
      }
      
      // Call application service
      const document = await this.documentService.getDocument(id);
      
      if (!document) {
        return res.status(404).json({
          error: 'Document not found'
        });
      }
      
      return res.status(200).json({
        success: true,
        document
      });
    } catch (error) {
      this.logger.error('Error getting document', { 
        error: error.message,
        id: req.params.id
      });
      
      return res.status(500).json({
        error: 'Failed to get document',
        message: error.message
      });
    }
  }
  
  /**
   * Update a document
   * @param {Object} req - HTTP request
   * @param {Object} res - HTTP response
   */
  async updateDocument(req, res) {
    try {
      const id = req.params.id;
      
      if (!id) {
        return res.status(400).json({
          error: 'Document ID is required'
        });
      }
      
      if (!req.body || !req.body.content) {
        return res.status(400).json({
          error: 'Document content is required'
        });
      }
      
      // Merge document data with ID
      const documentData = {
        ...DocumentDTO.fromRequest(req.body),
        id
      };
      
      // Call application service
      const result = await this.documentService.processDocument(documentData);
      
      return res.status(200).json({
        success: true,
        document: result
      });
    } catch (error) {
      this.logger.error('Error updating document', { 
        error: error.message,
        id: req.params.id
      });
      
      return res.status(500).json({
        error: 'Failed to update document',
        message: error.message
      });
    }
  }
  
  /**
   * Delete a document
   * @param {Object} req - HTTP request
   * @param {Object} res - HTTP response
   */
  async deleteDocument(req, res) {
    try {
      const id = req.params.id;
      
      if (!id) {
        return res.status(400).json({
          error: 'Document ID is required'
        });
      }
      
      // Call application service
      const success = await this.documentService.deleteDocument(id);
      
      if (!success) {
        return res.status(404).json({
          error: 'Document not found'
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error) {
      this.logger.error('Error deleting document', { 
        error: error.message,
        id: req.params.id
      });
      
      return res.status(500).json({
        error: 'Failed to delete document',
        message: error.message
      });
    }
  }
  
  /**
   * Search documents
   * @param {Object} req - HTTP request
   * @param {Object} res - HTTP response
   */
  async searchDocuments(req, res) {
    try {
      const query = req.query || {};
      
      // Extract pagination parameters
      const limit = parseInt(query.limit) || 10;
      const page = parseInt(query.page) || 1;
      const offset = (page - 1) * limit;
      
      // Build search criteria
      const criteria = {};
      
      if (query.title) criteria.title = query.title;
      if (query.type) criteria.type = query.type;
      if (query.fromDate) criteria.createdAt = { $gte: new Date(query.fromDate) };
      if (query.toDate) {
        criteria.createdAt = criteria.createdAt || {};
        criteria.createdAt.$lte = new Date(query.toDate);
      }
      
      // Call application service
      const documents = await this.documentService.findDocuments(criteria, {
        limit,
        offset,
        sortBy: query.sortBy || 'createdAt',
        sortDirection: query.sortDirection || 'desc'
      });
      
      return res.status(200).json({
        success: true,
        documents,
        pagination: {
          page,
          limit,
          total: documents.length // In a real app, would include total count
        }
      });
    } catch (error) {
      this.logger.error('Error searching documents', { error: error.message });
      
      return res.status(500).json({
        error: 'Failed to search documents',
        message: error.message
      });
    }
  }
  
  /**
   * Process document analysis
   * @param {Object} req - HTTP request
   * @param {Object} res - HTTP response
   */
  async analyzeDocument(req, res) {
    // This would be implemented with additional application services
    // For now, just return a simple response
    return res.status(501).json({
      error: 'Not implemented',
      message: 'Document analysis is not yet implemented'
    });
  }
}

module.exports = RestDocumentController;