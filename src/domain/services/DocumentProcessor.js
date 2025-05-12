/**
 * Document Processor Service
 * 
 * Domain service that handles document processing operations.
 * Contains pure business logic related to documents without dependencies on external systems.
 */

const Document = require('../entities/Document');

class DocumentProcessor {
  /**
   * Split a document into chunks based on specified criteria
   * @param {Document} document - Document to split
   * @param {Object} options - Chunking options
   * @param {number} options.maxChunkSize - Maximum chunk size (characters)
   * @param {string} options.overlapStrategy - How chunks should overlap ('none', 'percentage', 'fixed')
   * @param {number} options.overlapSize - Overlap amount (percentage or characters)
   * @returns {Array<Object>} Document chunks with metadata
   */
  splitIntoChunks(document, options = {}) {
    if (!(document instanceof Document)) {
      throw new Error('Input must be a Document entity');
    }
    
    const {
      maxChunkSize = 1000,
      overlapStrategy = 'none',
      overlapSize = 0
    } = options;
    
    // Handle empty document
    if (!document.content) {
      return [];
    }
    
    const content = document.content;
    const chunks = [];
    let currentPosition = 0;
    
    while (currentPosition < content.length) {
      let chunkEnd = currentPosition + maxChunkSize;
      
      // Don't exceed content length
      if (chunkEnd > content.length) {
        chunkEnd = content.length;
      } else {
        // Try to find a natural break point (e.g., end of paragraph, sentence)
        const naturalBreaks = ['\n\n', '\n', '. ', '? ', '! ', ';'];
        
        for (const breakChar of naturalBreaks) {
          const naturalBreakPos = content.lastIndexOf(breakChar, chunkEnd);
          
          if (naturalBreakPos > currentPosition && (naturalBreakPos + breakChar.length) <= chunkEnd) {
            chunkEnd = naturalBreakPos + breakChar.length;
            break;
          }
        }
      }
      
      // Extract chunk
      const chunkText = content.substring(currentPosition, chunkEnd);
      
      // Add chunk to list
      chunks.push({
        content: chunkText,
        metadata: {
          documentId: document.id,
          startPosition: currentPosition,
          endPosition: chunkEnd,
          chunkIndex: chunks.length
        }
      });
      
      // Calculate next position based on overlap strategy
      if (overlapStrategy === 'none' || chunkEnd === content.length) {
        currentPosition = chunkEnd;
      } else if (overlapStrategy === 'percentage') {
        const overlapAmount = Math.floor((chunkEnd - currentPosition) * (overlapSize / 100));
        currentPosition = chunkEnd - overlapAmount;
      } else if (overlapStrategy === 'fixed') {
        currentPosition = chunkEnd - overlapSize;
      }
      
      // Ensure we're making forward progress
      if (currentPosition >= chunkEnd) {
        currentPosition = chunkEnd;
      }
    }
    
    return chunks;
  }
  
  /**
   * Extract metadata from document content
   * @param {Document} document - Document to analyze
   * @returns {Object} Extracted metadata
   */
  extractMetadata(document) {
    if (!(document instanceof Document)) {
      throw new Error('Input must be a Document entity');
    }
    
    const metadata = {};
    const content = document.content || '';
    
    // Extract word count
    metadata.wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    
    // Extract estimated reading time (words per minute)
    metadata.readingTimeMinutes = Math.ceil(metadata.wordCount / 200);
    
    // Extract language detection hint (simplified)
    if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/.test(content)) {
      metadata.languageHint = 'ja-JP';
    } else if (/[\u0400-\u04FF]/.test(content)) {
      metadata.languageHint = 'ru-RU';
    } else if (/[\u0600-\u06FF]/.test(content)) {
      metadata.languageHint = 'ar-SA';
    } else {
      metadata.languageHint = 'en-US'; // Default
    }
    
    // Extract code blocks if present
    const codeBlockRegex = /```\w*\n([\s\S]*?)```/g;
    const codeBlocks = [];
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push(match[1]);
    }
    
    if (codeBlocks.length > 0) {
      metadata.codeBlocks = codeBlocks;
      metadata.containsCode = true;
    } else {
      metadata.containsCode = false;
    }
    
    return metadata;
  }
  
  /**
   * Check if a document contains sensitive information
   * @param {Document} document - Document to check
   * @returns {Object} Sensitive information flags
   */
  checkSensitiveInfo(document) {
    if (!(document instanceof Document)) {
      throw new Error('Input must be a Document entity');
    }
    
    const content = document.content || '';
    const results = {
      containsSensitiveInfo: false,
      details: {}
    };
    
    // Check for credit card patterns
    const creditCardRegex = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
    results.details.creditCards = content.match(creditCardRegex) || [];
    
    // Check for email patterns
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    results.details.emails = content.match(emailRegex) || [];
    
    // Check for API keys and tokens (simplified check)
    const apiKeyRegex = /\b[A-Za-z0-9_-]{20,60}\b/g;
    const potentialKeys = content.match(apiKeyRegex) || [];
    
    // Filter api keys - simplified validation, would be more sophisticated in real impl
    results.details.potentialApiKeys = potentialKeys.filter(key => {
      // Higher entropy tokens are more likely to be API keys
      const hasSpecialChars = /[^A-Za-z0-9]/.test(key);
      const hasUpperAndLower = /[A-Z]/.test(key) && /[a-z]/.test(key);
      const hasNumbers = /[0-9]/.test(key);
      
      return hasSpecialChars || (hasUpperAndLower && hasNumbers);
    });
    
    // Check social security numbers (US)
    const ssnRegex = /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g;
    results.details.ssns = content.match(ssnRegex) || [];
    
    // Set overall flag
    results.containsSensitiveInfo = 
      results.details.creditCards.length > 0 ||
      results.details.potentialApiKeys.length > 0 ||
      results.details.ssns.length > 0;
    
    return results;
  }
}

module.exports = DocumentProcessor;