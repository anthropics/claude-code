/**
 * Schema Loader
 * 
 * Provides utilities for loading, validating, and managing JSON schemas
 */

const fs = require('fs');
const path = require('path');

// Import logger
const logger = require('../logging/logger').createLogger('schema-loader');

// Base directory for schemas
const SCHEMA_BASE_DIR = path.join(__dirname, '..', 'schemas');

/**
 * Load a schema by name
 * 
 * @param {string} schemaName - The name of the schema (relative to schema base directory)
 * @param {Object} options - Options for loading
 * @param {boolean} options.validate - Whether to validate the schema itself
 * @returns {Object} The loaded schema
 */
function loadSchema(schemaName, options = {}) {
  const { validate = true } = options;
  
  // Determine file path
  let schemaPath = `${schemaName}.json`;
  if (!path.isAbsolute(schemaPath)) {
    schemaPath = path.join(SCHEMA_BASE_DIR, schemaPath);
  }
  
  try {
    // Read schema file
    logger.debug(`Loading schema: ${schemaName}`);
    const schemaData = fs.readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(schemaData);
    
    // Validate schema if requested
    if (validate) {
      // TODO: Implement schema validation
      // validateSchema(schema);
    }
    
    return schema;
  } catch (err) {
    logger.error(`Failed to load schema: ${schemaName}`, { error: err });
    throw new Error(`Failed to load schema: ${schemaName} - ${err.message}`);
  }
}

/**
 * Get a list of available schemas
 * 
 * @param {string} category - Optional category to filter by
 * @returns {Array<string>} List of available schema names
 */
function listSchemas(category = '') {
  const dir = category ? path.join(SCHEMA_BASE_DIR, category) : SCHEMA_BASE_DIR;
  
  try {
    const schemas = [];
    
    // Read directory recursively
    function readDir(dir, prefix = '') {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively read subdirectories
          readDir(entryPath, path.join(prefix, entry.name));
        } else if (entry.name.endsWith('.json')) {
          // Add schema file
          const schemaName = path.join(prefix, entry.name.replace(/\.json$/, ''));
          schemas.push(schemaName);
        }
      }
    }
    
    readDir(dir);
    return schemas;
  } catch (err) {
    logger.error(`Failed to list schemas in category: ${category}`, { error: err });
    return [];
  }
}

module.exports = {
  loadSchema,
  listSchemas
};