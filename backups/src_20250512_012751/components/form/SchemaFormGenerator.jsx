import React from 'react';
import StringField from './StringField';
import NumberField from './NumberField';
import BooleanField from './BooleanField';
import SelectField from './SelectField';
import ArrayField from './ArrayField';
import ColorField from './ColorField';

/**
 * SchemaFormGenerator dynamically creates form fields based on a JSON schema
 *
 * @param {Object} props Component props
 * @param {Object} props.schema JSON schema object
 * @param {Object} props.data Current form data
 * @param {Function} props.onChange Change handler for form data
 * @param {string} props.path Base path for this form section
 * @param {Object} props.uiSchema Optional UI schema for customizing field appearance
 * @param {Object} props.errorSchema Validation errors by field path
 */
const SchemaFormGenerator = ({
  schema,
  data = {},
  onChange,
  path = '',
  uiSchema = {},
  errorSchema = {},
}) => {
  if (!schema || !schema.properties) {
    return <div>Invalid schema: missing properties</div>;
  }

  // Process each property in the schema
  const fields = Object.keys(schema.properties).map(key => {
    const fieldSchema = schema.properties[key];
    const fieldPath = path ? `${path}.${key}` : key;
    const fieldData = data && data[key];
    const fieldUiSchema = uiSchema[key] || {};
    const fieldError = errorSchema[key];
    
    // Determine if the field is required
    const isRequired = schema.required && schema.required.includes(key);
    
    // Get field label and description
    const fieldLabel = fieldSchema.title || key;
    const fieldDescription = fieldSchema.description;

    // Special handling for schema formats
    if (fieldSchema.format === 'color') {
      return (
        <ColorField
          key={fieldPath}
          path={fieldPath}
          label={fieldLabel}
          description={fieldDescription}
          value={fieldData}
          onChange={onChange}
          required={isRequired}
          disabled={fieldUiSchema.disabled}
          error={fieldError}
          schema={fieldSchema}
          className={fieldUiSchema.classNames}
        />
      );
    }

    // Based on the field type, render the appropriate field component
    switch (fieldSchema.type) {
      case 'string':
        if (fieldSchema.enum) {
          return (
            <SelectField
              key={fieldPath}
              path={fieldPath}
              label={fieldLabel}
              description={fieldDescription}
              value={fieldData}
              onChange={onChange}
              required={isRequired}
              disabled={fieldUiSchema.disabled}
              error={fieldError}
              schema={fieldSchema}
              className={fieldUiSchema.classNames}
            />
          );
        }
        
        return (
          <StringField
            key={fieldPath}
            path={fieldPath}
            label={fieldLabel}
            description={fieldDescription}
            value={fieldData}
            onChange={onChange}
            required={isRequired}
            disabled={fieldUiSchema.disabled}
            error={fieldError}
            schema={fieldSchema}
            className={fieldUiSchema.classNames}
          />
        );
        
      case 'number':
      case 'integer':
        return (
          <NumberField
            key={fieldPath}
            path={fieldPath}
            label={fieldLabel}
            description={fieldDescription}
            value={fieldData}
            onChange={onChange}
            required={isRequired}
            disabled={fieldUiSchema.disabled}
            error={fieldError}
            schema={fieldSchema}
            className={fieldUiSchema.classNames}
          />
        );
        
      case 'boolean':
        return (
          <BooleanField
            key={fieldPath}
            path={fieldPath}
            label={fieldLabel}
            description={fieldDescription}
            value={fieldData}
            onChange={onChange}
            required={isRequired}
            disabled={fieldUiSchema.disabled}
            error={fieldError}
            schema={fieldSchema}
            className={fieldUiSchema.classNames}
          />
        );
        
      case 'array':
        return (
          <ArrayField
            key={fieldPath}
            path={fieldPath}
            label={fieldLabel}
            description={fieldDescription}
            value={fieldData}
            onChange={onChange}
            required={isRequired}
            disabled={fieldUiSchema.disabled}
            error={fieldError}
            schema={fieldSchema}
            className={fieldUiSchema.classNames}
            renderItem={(itemProps) => {
              if (fieldSchema.items) {
                if (fieldSchema.items.type === 'object') {
                  // Render a nested form for object items
                  return (
                    <SchemaFormGenerator
                      schema={fieldSchema.items}
                      data={itemProps.value}
                      onChange={itemProps.onChange}
                      path={itemProps.path}
                      uiSchema={fieldUiSchema.items || {}}
                      errorSchema={fieldError && fieldError[itemProps.index] || {}}
                    />
                  );
                } else {
                  // Render a simple field for primitive items
                  return (
                    <SchemaFormGenerator
                      schema={{ properties: { item: fieldSchema.items } }}
                      data={{ item: itemProps.value }}
                      onChange={(_, newData) => itemProps.onChange(itemProps.path, newData.item)}
                      path={itemProps.path}
                      uiSchema={{ item: fieldUiSchema.items || {} }}
                      errorSchema={fieldError && { item: fieldError[itemProps.index] } || {}}
                    />
                  );
                }
              }
              
              // Default item rendering if no item schema
              return (
                <input
                  type="text"
                  value={itemProps.value || ''}
                  onChange={(e) => itemProps.onChange(itemProps.path, e.target.value)}
                  disabled={itemProps.disabled}
                />
              );
            }}
          />
        );
        
      case 'object':
        // Recursively render nested objects
        return (
          <fieldset key={fieldPath} className="object-fieldset">
            {fieldLabel && (
              <legend>{fieldLabel}</legend>
            )}
            
            {fieldDescription && (
              <div className="object-description">{fieldDescription}</div>
            )}
            
            <SchemaFormGenerator
              schema={fieldSchema}
              data={fieldData || {}}
              onChange={onChange}
              path={fieldPath}
              uiSchema={fieldUiSchema}
              errorSchema={fieldError || {}}
            />
          </fieldset>
        );
        
      default:
        return (
          <div key={fieldPath}>
            Unsupported field type: {fieldSchema.type}
          </div>
        );
    }
  });

  return (
    <div className="schema-form-generator">
      {fields}
    </div>
  );
};

export default SchemaFormGenerator;