import React from 'react';

/**
 * Base FormField component for rendering schema-driven form fields
 * 
 * @param {Object} props Component props
 * @param {string} props.path Path to this field in the data structure (e.g. 'person.name')
 * @param {string} props.label Label for the field
 * @param {string} props.description Optional description text
 * @param {any} props.value Current value of the field
 * @param {Function} props.onChange Callback when value changes
 * @param {boolean} props.required Whether this field is required
 * @param {boolean} props.disabled Whether this field is disabled
 * @param {string} props.error Error message if validation fails
 * @param {Object} props.className CSS class names for styling
 * @param {React.ReactNode} props.children Actual input element(s)
 */
const FormField = ({
  path,
  label,
  description,
  value,
  onChange,
  required = false,
  disabled = false,
  error,
  className = {},
  children,
}) => {
  // Generate an ID based on the path for associating label with input
  const fieldId = `field-${path.replace(/\./g, '-')}`;

  return (
    <div className={className.container || 'form-field'}>
      {label && (
        <label 
          htmlFor={fieldId}
          className={className.label || 'field-label'}
        >
          {label}
          {required && <span className={className.required || 'required-marker'}>*</span>}
        </label>
      )}
      
      <div className={className.inputContainer || 'field-input-container'}>
        {React.Children.map(children, child => 
          React.cloneElement(child, {
            id: fieldId,
            disabled,
            onChange: e => onChange(path, e.target.value),
            value: value ?? '',
            required,
            'aria-describedby': description ? `${fieldId}-description` : undefined,
            className: className.input || 'field-input',
          })
        )}
      </div>
      
      {description && (
        <div 
          id={`${fieldId}-description`} 
          className={className.description || 'field-description'}
        >
          {description}
        </div>
      )}
      
      {error && (
        <div className={className.error || 'field-error'}>
          {error}
        </div>
      )}
    </div>
  );
};

export default FormField;