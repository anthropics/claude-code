import React, { useState } from 'react';
import Form from './Form';
import SchemaFormGenerator from './SchemaFormGenerator';

/**
 * SchemaForm - Main component for schema-driven forms
 * 
 * Combines Form and SchemaFormGenerator to create a fully functional form based on JSON Schema.
 * 
 * @param {Object} props Component props
 * @param {Object} props.schema JSON Schema object defining the form structure
 * @param {Object} props.uiSchema Optional UI schema for customizing appearance
 * @param {Object} props.formData Initial form data
 * @param {Function} props.onChange Function called when form data changes
 * @param {Function} props.onSubmit Function called when form is submitted
 * @param {Function} props.onError Function called when validation fails
 * @param {string} props.id Unique ID for the form
 * @param {Object} props.className CSS class names for styling
 */
const SchemaForm = ({
  schema,
  uiSchema = {},
  formData = {},
  onChange,
  onSubmit,
  onError,
  id,
  className = {},
}) => {
  // Store form data in state if no onChange handler is provided
  const [internalFormData, setInternalFormData] = useState(formData);
  
  // Use provided formData if onChange is provided, otherwise use internal state
  const data = onChange ? formData : internalFormData;
  
  // Track validation errors
  const [errors, setErrors] = useState({});
  
  // Handle data changes
  const handleChange = (path, value) => {
    const newData = { ...data };
    
    // Split the path into parts (e.g., 'person.name' -> ['person', 'name'])
    const pathParts = path.split('.');
    let current = newData;
    
    // Navigate to the nested property
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
    
    // Set the value at the last path part
    current[pathParts[pathParts.length - 1]] = value;
    
    // Update internal state if no onChange handler is provided
    if (!onChange) {
      setInternalFormData(newData);
    } else {
      onChange(newData);
    }
    
    // Clear errors for this field
    const newErrors = { ...errors };
    delete newErrors[path];
    setErrors(newErrors);
  };
  
  // Handle form submission
  const handleSubmit = () => {
    // Validate the form data against the schema
    const validationResult = validateFormData(data, schema);
    
    if (validationResult.valid) {
      if (onSubmit) {
        onSubmit(data);
      }
    } else {
      setErrors(validationResult.errors);
      if (onError) {
        onError(validationResult.errors);
      }
    }
  };
  
  // Simple validation function (in a real application, use a library like Ajv)
  const validateFormData = (data, schema) => {
    // Placeholder for actual validation
    const errors = {};
    
    // Check required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
          errors[field] = 'This field is required';
        }
      }
    }
    
    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  };

  return (
    <Form
      schema={schema}
      data={data}
      onChange={handleChange}
      onSubmit={handleSubmit}
      id={id}
      className={className}
    >
      <SchemaFormGenerator
        schema={schema}
        data={data}
        onChange={handleChange}
        uiSchema={uiSchema}
        errorSchema={errors}
      />
    </Form>
  );
};

export default SchemaForm;