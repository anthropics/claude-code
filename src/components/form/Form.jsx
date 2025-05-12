import React from 'react';

/**
 * Form component that serves as the base for schema-driven forms
 * 
 * @param {Object} props Component props
 * @param {Object} props.schema Schema definition for the form
 * @param {Object} props.data Current form data
 * @param {Function} props.onChange Function called when form data changes
 * @param {string} props.id Unique ID for the form
 * @param {React.ReactNode} props.children Optional child components
 * @param {Object} props.className CSS class names for styling
 */
const Form = ({ 
  schema, 
  data = {}, 
  onChange,
  id,
  children,
  className = {}
}) => {
  if (!schema) {
    return <div>No schema provided</div>;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    // Form submission would be handled here if needed
  };

  const handleChange = (path, value) => {
    if (!onChange) return;
    
    // Create a new data object with the updated value at the given path
    const newData = { ...data };
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
    
    onChange(newData);
  };

  // This will be replaced with SchemaFormGenerator in the actual implementation
  const formContent = (
    <div className={className.content || 'form-content'}>
      {children || <div>Form fields will be dynamically generated based on schema</div>}
    </div>
  );

  return (
    <form 
      id={id} 
      onSubmit={handleSubmit} 
      className={className.form || 'schema-form'}
    >
      {schema.title && (
        <h2 className={className.title || 'form-title'}>{schema.title}</h2>
      )}
      
      {schema.description && (
        <p className={className.description || 'form-description'}>{schema.description}</p>
      )}
      
      {formContent}
      
      <div className={className.actions || 'form-actions'}>
        <button type="submit" className={className.submitButton || 'submit-button'}>
          Save
        </button>
      </div>
    </form>
  );
};

export default Form;