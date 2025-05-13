/**
 * Schema utility functions for validating and processing JSON Schema
 */

/**
 * Validate a schema against JSON Schema Draft-07
 * 
 * @param {Object} schema Schema to validate
 * @returns {Object} Validation result with valid flag and errors
 */
export function validateSchema(schema) {
  // Simple validation - in a real implementation, use a proper schema validator like Ajv
  const errors = [];
  
  // Basic structure validation
  if (!schema) {
    errors.push('Schema is required');
    return { valid: false, errors };
  }
  
  if (typeof schema !== 'object') {
    errors.push('Schema must be an object');
    return { valid: false, errors };
  }
  
  // Check for required properties for form generation
  if (!schema.type) {
    errors.push('Schema must have a type property');
  }
  
  if (schema.type === 'object' && (!schema.properties || typeof schema.properties !== 'object')) {
    errors.push('Object schema must have a properties object');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate default UI schema from a JSON Schema
 * 
 * @param {Object} schema JSON Schema
 * @returns {Object} Generated UI schema
 */
export function generateFormFromSchema(schema) {
  if (!schema || schema.type !== 'object' || !schema.properties) {
    return {};
  }
  
  const uiSchema = {};
  
  // Process each property in the schema
  Object.entries(schema.properties).forEach(([key, propSchema]) => {
    if (propSchema.type === 'object') {
      // Recursively process nested objects
      uiSchema[key] = generateFormFromSchema(propSchema);
    } else if (propSchema.type === 'array' && propSchema.items && propSchema.items.type === 'object') {
      // Handle array of objects
      uiSchema[key] = {
        items: generateFormFromSchema(propSchema.items)
      };
    } else {
      // Add simple property with default UI settings
      uiSchema[key] = {};
      
      // Add widget based on format
      if (propSchema.format) {
        switch (propSchema.format) {
          case 'date':
          case 'date-time':
          case 'time':
          case 'email':
          case 'uri':
          case 'color':
            uiSchema[key].format = propSchema.format;
            break;
        }
      }
      
      // Add class names
      uiSchema[key].classNames = {
        container: `${key}-field`
      };
    }
  });
  
  return uiSchema;
}

/**
 * Merge a custom UI schema with the generated one
 * 
 * @param {Object} generatedSchema Generated UI schema
 * @param {Object} customSchema Custom UI schema
 * @returns {Object} Merged UI schema
 */
export function mergeUiSchema(generatedSchema, customSchema) {
  if (!customSchema) {
    return generatedSchema;
  }
  
  const merged = { ...generatedSchema };
  
  // Merge custom schema into generated schema
  Object.entries(customSchema).forEach(([key, value]) => {
    if (typeof value === 'object' && !Array.isArray(value)) {
      // Recursively merge nested objects
      merged[key] = {
        ...(merged[key] || {}),
        ...mergeUiSchema(merged[key] || {}, value)
      };
    } else {
      // Replace primitive values
      merged[key] = value;
    }
  });
  
  return merged;
}