/**
 * Schema Loader
 * 
 * Provides utilities for loading, validating, and managing JSON schemas
 */

import fs from 'fs';
import path from 'path';
import { Logger } from '@core/logging/logger';

// Base directory for schemas
const SCHEMA_BASE_DIR = path.join(__dirname, '..', 'schemas');

// Define options interface
interface LoadSchemaOptions {
  validate?: boolean;
}

/**
 * Schema loader class
 */
export class SchemaLoader {
  private logger: Logger;
  
  constructor() {
    this.logger = new Logger('schema-loader');
  }
  
  /**
   * Load a schema by name
   * 
   * @param schemaName - The name of the schema (relative to schema base directory)
   * @param options - Options for loading
   * @returns The loaded schema
   */
  public loadSchema(schemaName: string, options: LoadSchemaOptions = {}): Record<string, any> {
    const { validate = true } = options;
    
    // Determine file path
    let schemaPath = `${schemaName}.json`;
    if (!path.isAbsolute(schemaPath)) {
      schemaPath = path.join(SCHEMA_BASE_DIR, schemaPath);
    }
    
    try {
      // Read schema file
      this.logger.debug(`Loading schema: ${schemaName}`);
      const schemaData = fs.readFileSync(schemaPath, 'utf8');
      const schema = JSON.parse(schemaData);
      
      // Validate schema if requested
      if (validate) {
        // TODO: Implement schema validation
        // this.validateSchema(schema);
      }
      
      return schema;
    } catch (err) {
      this.logger.error(`Failed to load schema: ${schemaName}`, { error: err });
      throw new Error(`Failed to load schema: ${schemaName} - ${(err as Error).message}`);
    }
  }
  
  /**
   * Get a list of available schemas
   * 
   * @param category - Optional category to filter by
   * @returns List of available schema names
   */
  public listSchemas(category = ''): string[] {
    const dir = category ? path.join(SCHEMA_BASE_DIR, category) : SCHEMA_BASE_DIR;
    
    try {
      const schemas: string[] = [];
      
      // Read directory recursively
      const readDir = (dir: string, prefix = '') => {
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
      };
      
      readDir(dir);
      return schemas;
    } catch (err) {
      this.logger.error(`Failed to list schemas in category: ${category}`, { error: err });
      return [];
    }
  }
  
  /**
   * Validate a schema against JSON Schema metadata
   * 
   * @param schema - The schema to validate
   * @returns Whether the schema is valid
   */
  private validateSchema(schema: Record<string, any>): boolean {
    // TODO: Implement schema validation using a JSON Schema validator library
    // For now, just check if it has basic properties
    if (!schema || typeof schema !== 'object') {
      return false;
    }
    
    // Basic validation - check if it has type property
    if (!schema.type && !schema.properties && !schema.$schema) {
      this.logger.warn('Schema may not be valid - missing type or properties');
      return false;
    }
    
    return true;
  }
}

// Create singleton instance
const schemaLoader = new SchemaLoader();

// Export as default and named exports
export default schemaLoader;
export const loadSchema = schemaLoader.loadSchema.bind(schemaLoader);
export const listSchemas = schemaLoader.listSchemas.bind(schemaLoader);