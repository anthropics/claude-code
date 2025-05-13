/**
 * Text Chunker
 * 
 * Neural layer utility for optimal text chunking strategies.
 * Helps prepare text for embedding in a way that maximizes semantic coherence.
 */

class TextChunker {
  /**
   * @param {Object} options - Chunker options
   * @param {number} options.maxChunkSize - Maximum chunk size in characters
   * @param {number} options.minChunkSize - Minimum chunk size in characters
   * @param {string} options.chunkingStrategy - Chunking strategy to use
   */
  constructor(options = {}) {
    this.maxChunkSize = options.maxChunkSize || 1000;
    this.minChunkSize = options.minChunkSize || 100;
    this.chunkingStrategy = options.chunkingStrategy || 'paragraph';
  }
  
  /**
   * Chunk text using specified strategy
   * @param {string} text - Input text
   * @param {string} strategy - Override default chunking strategy
   * @returns {Array<string>} Text chunks
   */
  chunkText(text, strategy = null) {
    const activeStrategy = strategy || this.chunkingStrategy;
    
    switch (activeStrategy) {
      case 'fixed':
        return this._chunkByFixedSize(text);
      case 'sentence':
        return this._chunkBySentences(text);
      case 'paragraph':
        return this._chunkByParagraphs(text);
      case 'semantic':
        return this._chunkBySemantic(text);
      default:
        return this._chunkByParagraphs(text);
    }
  }
  
  /**
   * Chunk text by fixed size
   * @private
   * @param {string} text - Input text
   * @returns {Array<string>} Text chunks
   */
  _chunkByFixedSize(text) {
    const chunks = [];
    let currentPosition = 0;
    
    while (currentPosition < text.length) {
      let chunkEnd = currentPosition + this.maxChunkSize;
      
      // Don't exceed text length
      if (chunkEnd > text.length) {
        chunkEnd = text.length;
      } else {
        // Try to find a word boundary
        while (chunkEnd > currentPosition && text[chunkEnd] !== ' ') {
          chunkEnd--;
        }
        
        // If we couldn't find a word boundary, use the max chunk size
        if (chunkEnd === currentPosition) {
          chunkEnd = currentPosition + this.maxChunkSize;
        }
      }
      
      // Extract chunk
      chunks.push(text.substring(currentPosition, chunkEnd));
      currentPosition = chunkEnd;
    }
    
    return chunks;
  }
  
  /**
   * Chunk text by sentences
   * @private
   * @param {string} text - Input text
   * @returns {Array<string>} Text chunks
   */
  _chunkBySentences(text) {
    // Simple sentence splitting - would be more sophisticated in real implementation
    const sentenceDelimiters = /[.!?]+/g;
    const sentences = text.split(sentenceDelimiters)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    const chunks = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      // Check if adding this sentence would exceed max chunk size
      if (currentChunk.length + sentence.length + 1 > this.maxChunkSize && currentChunk.length >= this.minChunkSize) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // Add sentence to current chunk
      if (currentChunk.length > 0) {
        currentChunk += '. ' + sentence;
      } else {
        currentChunk = sentence;
      }
    }
    
    // Add final chunk if not empty
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
  
  /**
   * Chunk text by paragraphs
   * @private
   * @param {string} text - Input text
   * @returns {Array<string>} Text chunks
   */
  _chunkByParagraphs(text) {
    // Split by double newlines (paragraphs)
    const paragraphs = text.split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    const chunks = [];
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      // Check if adding this paragraph would exceed max chunk size
      if (currentChunk.length + paragraph.length + 2 > this.maxChunkSize && currentChunk.length >= this.minChunkSize) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // If a single paragraph exceeds max chunk size, split it further
      if (paragraph.length > this.maxChunkSize) {
        // Add current chunk if not empty
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
        
        // Split paragraph and add chunks
        const paragraphChunks = this._chunkBySentences(paragraph);
        chunks.push(...paragraphChunks);
        continue;
      }
      
      // Add paragraph to current chunk
      if (currentChunk.length > 0) {
        currentChunk += '\n\n' + paragraph;
      } else {
        currentChunk = paragraph;
      }
    }
    
    // Add final chunk if not empty
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
  
  /**
   * Chunk text using semantic boundaries
   * @private
   * @param {string} text - Input text
   * @returns {Array<string>} Text chunks
   */
  _chunkBySemantic(text) {
    // This is a simplified implementation
    // A real implementation would use more sophisticated techniques
    // to identify semantic boundaries
    
    // For demonstration purposes, this uses a combination of
    // paragraph and heading detection
    
    // Find headings (markdown style)
    const headingPattern = /(?:^|\n)(#{1,6}\s+.+?)(?=\n|$)/g;
    const headingMatches = Array.from(text.matchAll(headingPattern));
    
    // If no headings found, fall back to paragraph chunking
    if (headingMatches.length === 0) {
      return this._chunkByParagraphs(text);
    }
    
    // Create chunks based on headings
    const chunks = [];
    let lastPosition = 0;
    
    for (const match of headingMatches) {
      const headingStart = match.index;
      
      // Add text before this heading if not at the beginning
      if (headingStart > lastPosition) {
        const sectionText = text.substring(lastPosition, headingStart).trim();
        
        if (sectionText.length > this.maxChunkSize) {
          // If section is too large, chunk it further
          const sectionChunks = this._chunkByParagraphs(sectionText);
          chunks.push(...sectionChunks);
        } else if (sectionText.length >= this.minChunkSize) {
          chunks.push(sectionText);
        }
      }
      
      // Update last position to end of this heading
      lastPosition = headingStart + match[0].length;
    }
    
    // Add final section if there's text after the last heading
    if (lastPosition < text.length) {
      const finalText = text.substring(lastPosition).trim();
      
      if (finalText.length > this.maxChunkSize) {
        const finalChunks = this._chunkByParagraphs(finalText);
        chunks.push(...finalChunks);
      } else if (finalText.length >= this.minChunkSize) {
        chunks.push(finalText);
      }
    }
    
    return chunks;
  }
}

module.exports = TextChunker;