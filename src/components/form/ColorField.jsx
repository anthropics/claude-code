import React, { useState } from 'react';
import FormField from './FormField';

/**
 * ColorField component for color selection
 * 
 * @param {Object} props Component props
 * @param {string} props.path Path to this field in the data structure
 * @param {string} props.label Field label
 * @param {string} props.description Optional description
 * @param {string} props.value Current value (hex color)
 * @param {Function} props.onChange Change handler
 * @param {boolean} props.required Whether the field is required
 * @param {boolean} props.disabled Whether the field is disabled
 * @param {string} props.error Error message if validation fails
 * @param {Object} props.schema Schema properties for this field
 * @param {Object} props.className CSS class names
 */
const ColorField = ({
  path,
  label,
  description,
  value = '#000000',
  onChange,
  required = false,
  disabled = false,
  error,
  schema = {},
  className = {},
}) => {
  // Keep track of whether we're showing the color picker
  const [showPicker, setShowPicker] = useState(false);
  
  // Validate if the value is a valid hex color
  const isValidHex = (color) => {
    return /^#([0-9A-F]{3}){1,2}$/i.test(color);
  };
  
  // Format to a valid hex value
  const formatHexValue = (color) => {
    if (!color) return '#000000';
    if (color.startsWith('#')) return color;
    return `#${color}`;
  };
  
  // Handle color input change
  const handleChange = (fieldPath, fieldValue) => {
    // Ensure we have a hex color
    const formattedValue = formatHexValue(fieldValue);
    if (isValidHex(formattedValue)) {
      onChange(fieldPath, formattedValue);
    }
  };
  
  // Handle direct input of hex value
  const handleInputChange = (e) => {
    handleChange(path, e.target.value);
  };
  
  // Toggle the color picker
  const togglePicker = () => {
    if (!disabled) {
      setShowPicker(!showPicker);
    }
  };

  return (
    <div className={className.container || 'color-field'}>
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
        <div className={className.colorInputContainer || 'color-input-container'}>
          <div
            className={className.colorPreview || 'color-preview'}
            style={{
              backgroundColor: isValidHex(value) ? value : '#000000',
              cursor: disabled ? 'default' : 'pointer',
            }}
            onClick={togglePicker}
          />
          
          <input
            type="text"
            value={value || ''}
            onChange={handleInputChange}
            placeholder="#000000"
            className={className.colorInput || 'color-text-input'}
          />
          
          {showPicker && (
            <div className={className.colorPicker || 'color-picker-container'}>
              <input
                type="color"
                value={isValidHex(value) ? value : '#000000'}
                onChange={(e) => handleChange(path, e.target.value)}
                className={className.colorPickerInput || 'color-picker-input'}
              />
            </div>
          )}
        </div>
      </FormField>
    </div>
  );
};

export default ColorField;