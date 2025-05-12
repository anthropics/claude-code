# Schema-Driven Form Components

This directory contains a set of React components for creating dynamic forms based on JSON Schema.

## Overview

The components in this directory allow you to generate complete form UIs directly from JSON Schema definitions, with support for:

- All common data types (string, number, boolean, array, object)
- Nested objects and arrays
- Validation based on schema constraints
- Customizable styling and appearance
- Special field types like color pickers

## Core Components

- `SchemaForm`: The main component that renders a complete form from a schema
- `Form`: Base form component handling overall form structure
- `SchemaFormGenerator`: Generates form fields based on schema properties
- `FormField`: Base component for individual form fields

## Field Components

- `StringField`: Text input fields
- `NumberField`: Numeric input fields
- `BooleanField`: Checkbox fields
- `SelectField`: Dropdown/select fields for enum values
- `ArrayField`: List of items with add/remove capability
- `ColorField`: Color picker field

## Usage Example

```jsx
import { SchemaForm } from '../components/form';

// Define your schema
const schema = {
  title: "User Profile",
  type: "object",
  required: ["firstName", "lastName"],
  properties: {
    firstName: {
      type: "string",
      title: "First Name"
    },
    lastName: {
      type: "string",
      title: "Last Name"
    },
    age: {
      type: "integer",
      title: "Age",
      minimum: 0
    },
    favoriteColor: {
      type: "string",
      title: "Favorite Color",
      format: "color"
    }
  }
};

// Optional UI customizations
const uiSchema = {
  firstName: {
    classNames: {
      container: 'first-name-field',
      input: 'primary-input'
    }
  }
};

// Component using the schema form
function ProfileForm() {
  const [formData, setFormData] = useState({});
  
  const handleChange = (data) => {
    setFormData(data);
  };
  
  const handleSubmit = (data) => {
    console.log('Form submitted:', data);
    // Submit to API, etc.
  };
  
  return (
    <SchemaForm
      schema={schema}
      uiSchema={uiSchema}
      formData={formData}
      onChange={handleChange}
      onSubmit={handleSubmit}
    />
  );
}
```

## Integration with Context7 and MCP

These components are designed to work with the Context7 profile schema and integrate with the Model Context Protocol (MCP) for loading and saving profile data.

See the `/workspace/src/components/profile` directory for implementation examples.