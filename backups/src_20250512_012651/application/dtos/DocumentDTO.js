/**
 * Document Data Transfer Object
 * 
 * Transforms the Document domain entity into a client-friendly format.
 * Encapsulates the data sent to and received from the client.
 */

class DocumentDTO {
  /**
   * Create a Document DTO from a domain entity
   * @param {Document} document - Document domain entity
   */
  constructor(document) {
    this.id = document.id;
    this.title = document.title;
    this.summary = document.getSummary(150);
    this.type = document.type;
    this.createdAt = document.createdAt;
    this.updatedAt = document.updatedAt;
    this.metadata = this._formatMetadata(document.metadata);
    this.size = document.getSize();
    
    // Don't expose full content by default (could be large)
    // Clients should request full content separately if needed
  }
  
  /**
   * Format metadata for client consumption
   * @private
   * @param {Object} metadata - Raw metadata
   * @returns {Object} Formatted metadata
   */
  _formatMetadata(metadata) {
    const formatted = { ...metadata };
    
    // Remove sensitive or internal fields
    delete formatted.sensitiveInfo?.details;
    
    // Add derived fields
    if (metadata.wordCount) {
      formatted.readingLevel = this._calculateReadingLevel(metadata.wordCount);
    }
    
    return formatted;
  }
  
  /**
   * Calculate reading level (simplified example)
   * @private
   * @param {number} wordCount - Document word count
   * @returns {string} Reading level
   */
  _calculateReadingLevel(wordCount) {
    if (wordCount < 100) return 'brief';
    if (wordCount < 500) return 'short';
    if (wordCount < 2000) return 'medium';
    if (wordCount < 5000) return 'long';
    return 'extensive';
  }
  
  /**
   * Create a DocumentDTO from raw data (for incoming DTOs)
   * @static
   * @param {Object} data - Raw data from client
   * @returns {Object} Validated data for domain use
   */
  static fromRequest(data) {
    // Validate required fields
    if (!data.content) {
      throw new Error('Document content is required');
    }
    
    // Return validated data for domain use
    return {
      id: data.id,
      content: data.content,
      title: data.title,
      type: data.type || 'text'
    };
  }
}

module.exports = DocumentDTO;