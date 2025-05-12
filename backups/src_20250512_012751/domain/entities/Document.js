/**
 * Document Entity
 * 
 * Represents a document in the Claude Neural Framework system.
 * Core domain entity that encapsulates document-related business rules.
 */

class Document {
  /**
   * Create a new Document
   * @param {Object} props - Document properties
   * @param {string} props.id - Unique identifier
   * @param {string} props.content - Document content
   * @param {string} props.title - Document title
   * @param {string} props.type - Document type
   * @param {Date} props.createdAt - Creation timestamp
   * @param {Date} props.updatedAt - Last update timestamp
   * @param {Object} props.metadata - Additional document metadata
   */
  constructor(props) {
    this.id = props.id;
    this.content = props.content;
    this.title = props.title || this._generateDefaultTitle();
    this.type = props.type || 'text';
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
    this.metadata = props.metadata || {};
    
    this._validate();
  }
  
  /**
   * Update document content
   * @param {string} newContent - New document content
   * @throws {Error} If content is invalid
   */
  updateContent(newContent) {
    if (!newContent || typeof newContent !== 'string') {
      throw new Error('Document content must be a non-empty string');
    }
    
    this.content = newContent;
    this.updatedAt = new Date();
  }
  
  /**
   * Update document metadata
   * @param {Object} metadata - Metadata to update
   */
  updateMetadata(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
    this.updatedAt = new Date();
  }
  
  /**
   * Get content summary
   * @param {number} maxLength - Maximum length of summary
   * @returns {string} Content summary
   */
  getSummary(maxLength = 100) {
    if (!this.content) return '';
    
    if (this.content.length <= maxLength) {
      return this.content;
    }
    
    return this.content.substring(0, maxLength - 3) + '...';
  }
  
  /**
   * Calculate document size in bytes
   * @returns {number} Document size in bytes
   */
  getSize() {
    return this.content ? Buffer.from(this.content).length : 0;
  }
  
  /**
   * Generate default title from content
   * @private
   * @returns {string} Generated title
   */
  _generateDefaultTitle() {
    if (!this.content) return 'Untitled Document';
    
    // Extract first non-empty line or first few words
    const firstLine = this.content.split('\n').find(line => line.trim().length > 0);
    
    if (firstLine) {
      return firstLine.trim().substring(0, 40) + (firstLine.length > 40 ? '...' : '');
    }
    
    return 'Untitled Document';
  }
  
  /**
   * Validate document properties
   * @private
   * @throws {Error} If validation fails
   */
  _validate() {
    if (!this.id) {
      throw new Error('Document ID is required');
    }
    
    if (!this.content || typeof this.content !== 'string') {
      throw new Error('Document content must be a non-empty string');
    }
    
    if (this.type !== 'text' && this.type !== 'markdown' && this.type !== 'code' && this.type !== 'html') {
      throw new Error('Document type must be one of: text, markdown, code, html');
    }
  }
}

module.exports = Document;