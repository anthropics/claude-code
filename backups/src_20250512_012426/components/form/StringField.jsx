import React from 'react';
import FormField from './FormField';

/**
 * StringField component for text input
 * 
 * @param {Object} props Component props
 * @param {string} props.path Path to this field in the data structure
 * @param {string} props.label Field label
 * @param {string} props.description Optional description
 * @param {string} props.value Current value
 * @param {Function} props.onChange Change handler
 * @param {boolean} props.required Whether the field is required
 * @param {boolean} props.disabled Whether the field is disabled
 * @param {string} props.error Error message if validation fails
 * @param {Object} props.schema Schema properties for this field
 * @param {Object} props.className CSS class names
 */
const StringField = ({
  path,
  label,
  description,
  value,
  onChange,
  required = false,
  disabled = false,
  error,
  schema = {},
  className = {},
}) => {
  // Determine input type based on format
  let inputType = 'text';
  if (schema.format) {
    switch (schema.format) {
      case 'email':
        inputType = 'email';
        break;
      case 'uri':
        inputType = 'url';
        break;
      case 'date':
        inputType = 'date';
        break;
      case 'time':
        inputType = 'time';
        break;
      case 'date-time':
        inputType = 'datetime-local';
        break;
      case 'password':
        inputType = 'password';
        break;
      default:
        inputType = 'text';
    }
  }

  // Handle text input change
  const handleChange = (fieldPath, fieldValue) => {
    // Validate minLength and maxLength if specified
    if (schema.minLength && fieldValue.length < schema.minLength) {
      // In a real implementation, we'd set validation errors here
    }
    
    if (schema.maxLength && fieldValue.length > schema.maxLength) {
      // Truncate the value to maxLength
      fieldValue = fieldValue.substring(0, schema.maxLength);
    }
    
    onChange(fieldPath, fieldValue);
  };

  return (
    <FormField
      path={path}
      label={label}
      description={description}
      value={value}
      onChange={handleChange}
      required={required}
      disabled={disabled}
      error={error}
      className={className}
    >
      <input
        type={inputType}
        minLength={schema.minLength}
        maxLength={schema.maxLength}
        pattern={schema.pattern}
        placeholder={schema.placeholder || ''}
      />
    </FormField>
  );
};

export default StringField;