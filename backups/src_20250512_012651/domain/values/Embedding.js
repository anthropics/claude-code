/**
 * Embedding Value Object
 * 
 * Represents a vector embedding for a document or text segment.
 * Immutable value object that encapsulates vector operations.
 */

class Embedding {
  /**
   * Create a new Embedding
   * @param {Object} props - Embedding properties
   * @param {Array<number>} props.vector - Vector values
   * @param {string} props.model - Embedding model used
   * @param {number} props.dimensions - Vector dimensions
   */
  constructor(props) {
    this._vector = Object.freeze([...props.vector]);
    this._model = props.model;
    this._dimensions = props.dimensions || props.vector.length;
    
    this._validate();
    
    // Freeze the object to ensure immutability
    Object.freeze(this);
  }
  
  /**
   * Get the vector values
   * @returns {Array<number>} Vector values (copy to maintain immutability)
   */
  get vector() {
    return [...this._vector];
  }
  
  /**
   * Get the embedding model
   * @returns {string} Embedding model
   */
  get model() {
    return this._model;
  }
  
  /**
   * Get the vector dimensions
   * @returns {number} Vector dimensions
   */
  get dimensions() {
    return this._dimensions;
  }
  
  /**
   * Calculate cosine similarity with another embedding
   * @param {Embedding} other - Another embedding
   * @returns {number} Cosine similarity score (0-1)
   * @throws {Error} If embeddings are incompatible
   */
  cosineSimilarity(other) {
    if (!(other instanceof Embedding)) {
      throw new Error('Can only calculate similarity with another Embedding');
    }
    
    if (this._model !== other._model) {
      throw new Error(`Cannot compare embeddings from different models: ${this._model} vs ${other._model}`);
    }
    
    if (this._dimensions !== other._dimensions) {
      throw new Error(`Cannot compare embeddings with different dimensions: ${this._dimensions} vs ${other._dimensions}`);
    }
    
    // Calculate dot product
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < this._dimensions; i++) {
      dotProduct += this._vector[i] * other._vector[i];
      normA += this._vector[i] * this._vector[i];
      normB += other._vector[i] * other._vector[i];
    }
    
    // Handle zero vectors
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    // Calculate cosine similarity
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  /**
   * Calculate Euclidean distance with another embedding
   * @param {Embedding} other - Another embedding
   * @returns {number} Euclidean distance
   * @throws {Error} If embeddings are incompatible
   */
  euclideanDistance(other) {
    if (!(other instanceof Embedding)) {
      throw new Error('Can only calculate distance with another Embedding');
    }
    
    if (this._model !== other._model) {
      throw new Error(`Cannot compare embeddings from different models: ${this._model} vs ${other._model}`);
    }
    
    if (this._dimensions !== other._dimensions) {
      throw new Error(`Cannot compare embeddings with different dimensions: ${this._dimensions} vs ${other._dimensions}`);
    }
    
    // Calculate Euclidean distance
    let sumSquaredDiff = 0;
    
    for (let i = 0; i < this._dimensions; i++) {
      const diff = this._vector[i] - other._vector[i];
      sumSquaredDiff += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiff);
  }
  
  /**
   * Create a new embedding by adding another embedding's vector
   * @param {Embedding} other - Another embedding
   * @returns {Embedding} New embedding with combined vectors
   * @throws {Error} If embeddings are incompatible
   */
  add(other) {
    if (!(other instanceof Embedding)) {
      throw new Error('Can only add another Embedding');
    }
    
    if (this._model !== other._model) {
      throw new Error(`Cannot add embeddings from different models: ${this._model} vs ${other._model}`);
    }
    
    if (this._dimensions !== other._dimensions) {
      throw new Error(`Cannot add embeddings with different dimensions: ${this._dimensions} vs ${other._dimensions}`);
    }
    
    // Add vectors
    const newVector = this._vector.map((val, i) => val + other._vector[i]);
    
    return new Embedding({
      vector: newVector,
      model: this._model,
      dimensions: this._dimensions
    });
  }
  
  /**
   * Validate embedding properties
   * @private
   * @throws {Error} If validation fails
   */
  _validate() {
    if (!Array.isArray(this._vector) || this._vector.length === 0) {
      throw new Error('Embedding vector must be a non-empty array');
    }
    
    if (this._vector.some(val => typeof val !== 'number')) {
      throw new Error('Embedding vector must contain only numbers');
    }
    
    if (!this._model) {
      throw new Error('Embedding model is required');
    }
    
    if (this._dimensions !== this._vector.length) {
      throw new Error(`Dimensions (${this._dimensions}) must match vector length (${this._vector.length})`);
    }
  }
}

module.exports = Embedding;