/**
 * MongoDB Document Repository
 * 
 * Adapter implementation of the DocumentRepository interface for MongoDB.
 * Handles persistence operations for Document entities.
 */

const DocumentRepository = require('../../domain/repositories/DocumentRepository');
const Document = require('../../domain/entities/Document');

class MongoDocumentRepository extends DocumentRepository {
  /**
   * @param {Object} dependencies - Dependencies
   * @param {Object} dependencies.db - MongoDB client
   * @param {Logger} dependencies.logger - Logger service
   */
  constructor({ db, logger }) {
    super();
    this.db = db;
    this.logger = logger;
    this.collection = db.collection('documents');
  }
  
  /**
   * Find document by ID
   * @param {string} id - Document ID
   * @returns {Promise<Document|null>} Document entity or null if not found
   */
  async findById(id) {
    try {
      const doc = await this.collection.findOne({ id });
      
      if (!doc) {
        return null;
      }
      
      return this._mapToEntity(doc);
    } catch (error) {
      this.logger.error('Error finding document by ID', { error: error.message, id });
      throw error;
    }
  }
  
  /**
   * Find documents by criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum number of results
   * @param {number} options.offset - Offset for pagination
   * @param {string} options.sortBy - Field to sort by
   * @param {string} options.sortDirection - Sort direction (asc/desc)
   * @returns {Promise<Array<Document>>} Array of document entities
   */
  async findByCriteria(criteria, options = {}) {
    try {
      const { 
        limit = 10, 
        offset = 0,
        sortBy = 'createdAt',
        sortDirection = 'desc'
      } = options;
      
      const query = this._buildQuery(criteria);
      
      const sortOptions = {
        [sortBy]: sortDirection === 'asc' ? 1 : -1
      };
      
      const docs = await this.collection
        .find(query)
        .sort(sortOptions)
        .skip(offset)
        .limit(limit)
        .toArray();
      
      return docs.map(doc => this._mapToEntity(doc));
    } catch (error) {
      this.logger.error('Error finding documents by criteria', { 
        error: error.message,
        criteria
      });
      throw error;
    }
  }
  
  /**
   * Save a document
   * @param {Document} document - Document entity to save
   * @returns {Promise<Document>} Saved document entity
   */
  async save(document) {
    try {
      const doc = this._mapToPersistence(document);
      
      // Check if document exists
      const existing = await this.collection.findOne({ id: document.id });
      
      if (existing) {
        // Update existing document
        await this.collection.updateOne(
          { id: document.id },
          { $set: doc }
        );
      } else {
        // Insert new document
        await this.collection.insertOne(doc);
      }
      
      return document;
    } catch (error) {
      this.logger.error('Error saving document', { 
        error: error.message,
        documentId: document.id
      });
      throw error;
    }
  }
  
  /**
   * Delete a document
   * @param {string} id - Document ID
   * @returns {Promise<boolean>} True if document was deleted
   */
  async delete(id) {
    try {
      const result = await this.collection.deleteOne({ id });
      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error('Error deleting document', { error: error.message, id });
      throw error;
    }
  }
  
  /**
   * Count documents matching criteria
   * @param {Object} criteria - Count criteria
   * @returns {Promise<number>} Document count
   */
  async count(criteria = {}) {
    try {
      const query = this._buildQuery(criteria);
      return await this.collection.countDocuments(query);
    } catch (error) {
      this.logger.error('Error counting documents', { 
        error: error.message,
        criteria
      });
      throw error;
    }
  }
  
  /**
   * Build MongoDB query from criteria
   * @private
   * @param {Object} criteria - Search criteria
   * @returns {Object} MongoDB query
   */
  _buildQuery(criteria) {
    const query = {};
    
    // Map criteria to MongoDB query
    Object.entries(criteria).forEach(([key, value]) => {
      if (value instanceof Object && !(value instanceof Date)) {
        // Handle special operators
        query[key] = {};
        
        Object.entries(value).forEach(([op, opValue]) => {
          switch (op) {
            case '$eq':
              query[key] = opValue;
              break;
            case '$ne':
            case '$gt':
            case '$gte':
            case '$lt':
            case '$lte':
            case '$in':
            case '$nin':
              query[key][op] = opValue;
              break;
            default:
              query[key] = value;
          }
        });
      } else {
        query[key] = value;
      }
    });
    
    return query;
  }
  
  /**
   * Map MongoDB document to domain entity
   * @private
   * @param {Object} doc - MongoDB document
   * @returns {Document} Document entity
   */
  _mapToEntity(doc) {
    return new Document({
      id: doc.id,
      content: doc.content,
      title: doc.title,
      type: doc.type,
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt),
      metadata: doc.metadata || {}
    });
  }
  
  /**
   * Map domain entity to MongoDB document
   * @private
   * @param {Document} document - Document entity
   * @returns {Object} MongoDB document
   */
  _mapToPersistence(document) {
    return {
      id: document.id,
      content: document.content,
      title: document.title,
      type: document.type,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      metadata: document.metadata || {}
    };
  }
}

module.exports = MongoDocumentRepository;