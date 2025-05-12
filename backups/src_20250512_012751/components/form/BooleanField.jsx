import React from 'react';
import FormField from './FormField';

/**
 * BooleanField component for boolean values (checkbox)
 * 
 * @param {Object} props Component props
 * @param {string} props.path Path to this field in the data structure
 * @param {string} props.label Field label
 * @param {string} props.description Optional description
 * @param {boolean} props.value Current value
 * @param {Function} props.onChange Change handler
 * @param {boolean} props.required Whether the field is required
 * @param {boolean} props.disabled Whether the field is disabled
 * @param {string} props.error Error message if validation fails
 * @param {Object} props.schema Schema properties for this field
 * @param {Object} props.className CSS class names
 */
const BooleanField = ({
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
  // For checkboxes, we need to handle the change differently
  const handleCheckboxChange = (e) => {
    onChange(path, e.target.checked);
  };

  return (
    <div className={className.container || 'boolean-field'}>
      <div className={className.checkboxContainer || 'checkbox-container'}>
        <input
          id={`field-${path.replace(/\./g, '-')}`}
          type="checkbox"
          checked={!!value}
          onChange={handleCheckboxChange}
          disabled={disabled}
          required={required}
          className={className.checkbox || 'checkbox-input'}
        />
        
        <label 
          htmlFor={`field-${path.replace(/\./g, '-')}`}
          className={className.label || 'checkbox-label'}
        >
          {label}
          {required && <span className={className.required || 'required-marker'}>*</span>}
        </label>
      </div>
      
      {description && (
        <div 
          className={className.description || 'field-description'}
          id={`field-${path.replace(/\./g, '-')}-description`}
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

export default BooleanField;