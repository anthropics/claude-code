import React from 'react';
import FormField from './FormField';

/**
 * NumberField component for numerical input
 * 
 * @param {Object} props Component props
 * @param {string} props.path Path to this field in the data structure
 * @param {string} props.label Field label
 * @param {string} props.description Optional description
 * @param {number} props.value Current value
 * @param {Function} props.onChange Change handler
 * @param {boolean} props.required Whether the field is required
 * @param {boolean} props.disabled Whether the field is disabled
 * @param {string} props.error Error message if validation fails
 * @param {Object} props.schema Schema properties for this field
 * @param {Object} props.className CSS class names
 */
const NumberField = ({
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
  // Handle number input change
  const handleChange = (fieldPath, fieldValue) => {
    // Convert string to number
    const numValue = parseFloat(fieldValue);
    
    // Check if value is within range constraints
    if (typeof numValue === 'number' && !isNaN(numValue)) {
      let validValue = numValue;
      
      if (schema.minimum !== undefined && numValue < schema.minimum) {
        validValue = schema.minimum;
      }
      
      if (schema.maximum !== undefined && numValue > schema.maximum) {
        validValue = schema.maximum;
      }
      
      onChange(fieldPath, validValue);
    } else if (fieldValue === '') {
      // Allow empty input (user is deleting the value)
      onChange(fieldPath, undefined);
    }
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
        type="number"
        min={schema.minimum}
        max={schema.maximum}
        step={schema.multipleOf || (schema.type === 'integer' ? 1 : 'any')}
        placeholder={schema.placeholder || ''}
      />
    </FormField>
  );
};

export default NumberField;