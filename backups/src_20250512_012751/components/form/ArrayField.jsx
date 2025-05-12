import React, { useState } from 'react';
import FormField from './FormField';

/**
 * ArrayField component for array values
 * 
 * @param {Object} props Component props
 * @param {string} props.path Path to this field in the data structure
 * @param {string} props.label Field label
 * @param {string} props.description Optional description
 * @param {Array} props.value Current value
 * @param {Function} props.onChange Change handler
 * @param {boolean} props.required Whether the field is required
 * @param {boolean} props.disabled Whether the field is disabled
 * @param {string} props.error Error message if validation fails
 * @param {Object} props.schema Schema properties for this field
 * @param {Object} props.className CSS class names
 * @param {Function} props.renderItem Function to render each array item
 */
const ArrayField = ({
  path,
  label,
  description,
  value = [],
  onChange,
  required = false,
  disabled = false,
  error,
  schema = {},
  className = {},
  renderItem,
}) => {
  // Initialize array if it doesn't exist
  const items = Array.isArray(value) ? value : [];
  
  // Add a new item to the array
  const handleAddItem = () => {
    // Create a new item with a default value based on the items schema
    let newItem;
    
    if (schema.items) {
      if (schema.items.type === 'string') {
        newItem = '';
      } else if (schema.items.type === 'number' || schema.items.type === 'integer') {
        newItem = 0;
      } else if (schema.items.type === 'boolean') {
        newItem = false;
      } else if (schema.items.type === 'object') {
        newItem = {};
      } else if (schema.items.type === 'array') {
        newItem = [];
      } else {
        newItem = null;
      }
    } else {
      newItem = '';
    }
    
    const newItems = [...items, newItem];
    onChange(path, newItems);
  };
  
  // Remove an item from the array
  const handleRemoveItem = (index) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    onChange(path, newItems);
  };
  
  // Update an item in the array
  const handleItemChange = (index, newValue) => {
    const newItems = [...items];
    newItems[index] = newValue;
    onChange(path, newItems);
  };

  return (
    <div className={className.container || 'array-field'}>
      <div className={className.header || 'array-field-header'}>
        <label className={className.label || 'array-field-label'}>
          {label}
          {required && <span className={className.required || 'required-marker'}>*</span>}
        </label>
        
        {!disabled && (
          <button
            type="button"
            onClick={handleAddItem}
            className={className.addButton || 'array-add-button'}
            disabled={schema.maxItems !== undefined && items.length >= schema.maxItems}
          >
            Add Item
          </button>
        )}
      </div>
      
      {description && (
        <div className={className.description || 'field-description'}>
          {description}
        </div>
      )}
      
      <div className={className.items || 'array-items'}>
        {items.length === 0 ? (
          <div className={className.emptyArray || 'array-empty'}>
            No items. Click "Add Item" to add the first item.
          </div>
        ) : (
          items.map((item, index) => (
            <div key={index} className={className.item || 'array-item'}>
              <div className={className.itemContent || 'array-item-content'}>
                {renderItem ? (
                  renderItem({
                    index,
                    value: item,
                    path: `${path}.${index}`,
                    onChange: (_, value) => handleItemChange(index, value),
                    schema: schema.items || {},
                    disabled,
                  })
                ) : (
                  <input
                    type="text"
                    value={item || ''}
                    onChange={(e) => handleItemChange(index, e.target.value)}
                    disabled={disabled}
                    className={className.input || 'array-item-input'}
                  />
                )}
              </div>
              
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className={className.removeButton || 'array-remove-button'}
                  disabled={schema.minItems !== undefined && items.length <= schema.minItems}
                >
                  Remove
                </button>
              )}
            </div>
          ))
        )}
      </div>
      
      {error && (
        <div className={className.error || 'field-error'}>
          {error}
        </div>
      )}
    </div>
  );
};

export default ArrayField;