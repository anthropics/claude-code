import React from 'react';
import FormField from './FormField';

/**
 * SelectField component for enum values
 * 
 * @param {Object} props Component props
 * @param {string} props.path Path to this field in the data structure
 * @param {string} props.label Field label
 * @param {string} props.description Optional description
 * @param {any} props.value Current value
 * @param {Function} props.onChange Change handler
 * @param {boolean} props.required Whether the field is required
 * @param {boolean} props.disabled Whether the field is disabled
 * @param {string} props.error Error message if validation fails
 * @param {Object} props.schema Schema properties for this field
 * @param {Object} props.className CSS class names
 */
const SelectField = ({
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
  if (!schema.enum || !Array.isArray(schema.enum)) {
    return <div>Invalid enum schema: missing enum array</div>;
  }

  // Determine if we should use string values for the enum
  const enumOptions = schema.enum;
  const enumNames = schema.enumNames || enumOptions.map(opt => String(opt));

  return (
    <FormField
      path={path}
      label={label}
      description={description}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      error={error}
      className={className}
    >
      <select>
        {!required && (
          <option value="">-- Select --</option>
        )}
        
        {enumOptions.map((option, index) => (
          <option 
            key={option} 
            value={option}
            selected={value === option}
          >
            {enumNames[index]}
          </option>
        ))}
      </select>
    </FormField>
  );
};

export default SelectField;