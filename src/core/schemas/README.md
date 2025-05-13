# Schema Library

This directory contains standardized JSON schemas used throughout the Claude Neural Framework.

## Directory Structure

- `/profile` - User profile schemas for agent personalization
- `/api` - API schemas for request and response validation
- `/config` - Configuration schemas for system components
- `/validation` - Validation schemas for user input

## Usage

Schemas should be imported using the standard schema loader:

```javascript
const { loadSchema } = require('../utils/schema_loader');

// Load a schema
const profileSchema = loadSchema('profile/about');
```

## Schema Naming Conventions

- Use kebab-case for filenames
- Use descriptive names that indicate purpose
- Include appropriate version information for evolving schemas

## Schema Design Guidelines

1. All schemas should follow JSON Schema Draft-07
2. Include comprehensive descriptions for all properties
3. Define required fields explicitly
4. Provide examples for complex properties
5. Use consistent property naming conventions