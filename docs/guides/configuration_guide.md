# Configuration System Guide

This guide explains how to use the standardized configuration system of the Claude Neural Framework, including how to access configuration values, customize settings, and integrate with your own components.

## Overview

The configuration system provides a centralized way to manage all settings for the Claude Neural Framework. It includes:

- **Configuration Types**: Different categories of settings (RAG, MCP, security, etc.)
- **Environment Variable Integration**: Override settings with environment variables
- **Schema Validation**: Optional validation of configuration values
- **Observer Pattern**: Subscribe to configuration changes
- **Error Handling**: Standardized error types for configuration operations

## Configuration Types

The framework uses the following configuration types:

| Type | Description | Default Path |
|------|-------------|--------------|
| `RAG` | Retrieval Augmented Generation settings | `/core/config/rag_config.json` |
| `MCP` | Model Context Protocol server configuration | `/core/config/mcp_config.json` |
| `SECURITY` | Security constraints and permissions | `/core/config/security_constraints.json` |
| `COLOR_SCHEMA` | UI color schema settings | `/core/config/color_schema_config.json` |
| `GLOBAL` | Global framework settings | `~/.claude/config.json` |
| `USER` | User profile and preferences | `~/.claude/user.about.json` |

## Basic Usage

### Getting Configuration Values

```javascript
const configManager = require('./core/config/config_manager');
const { CONFIG_TYPES } = configManager;

// Get entire config object
const ragConfig = configManager.getConfig(CONFIG_TYPES.RAG);

// Get specific value with default fallback
const databaseType = configManager.getConfigValue(
  CONFIG_TYPES.RAG,
  'database.type',
  'chroma' // Default value
);

// Check if API key is available
const hasClaudeApiKey = configManager.hasApiKey('claude');
```

### Updating Configuration Values

```javascript
// Update a specific value
configManager.updateConfigValue(
  CONFIG_TYPES.MCP,
  'servers.brave-search.enabled',
  true
);

// Reset a configuration to defaults
configManager.resetConfig(CONFIG_TYPES.COLOR_SCHEMA);

// Load all configurations at once
configManager.loadAllConfigs();
```

### Observing Configuration Changes

```javascript
// Register an observer for MCP configuration changes
const observerId = configManager.registerObserver(
  CONFIG_TYPES.MCP,
  (updatedConfig) => {
    console.log('MCP configuration changed:', updatedConfig);
    // Re-initialize MCP servers with the new configuration
  }
);

// Later, unregister the observer
configManager.unregisterObserver(CONFIG_TYPES.MCP, observerId);
```

## Advanced Usage

### Environment Variable Overrides

You can override configuration values using environment variables with the pattern:

```
CNF_[CONFIG_TYPE]_[KEY_PATH]
```

For example, to override the RAG database type:

```bash
export CNF_RAG_DATABASE_TYPE="lancedb"
```

This will set `database.type` to "lancedb" in the RAG configuration.

### Schema Validation

You can add schema validation for configurations:

```javascript
// Set a JSON schema for validation
configManager.setSchema(CONFIG_TYPES.RAG, {
  type: 'object',
  required: ['version', 'database', 'embedding', 'claude'],
  properties: {
    version: { type: 'string' },
    database: {
      type: 'object',
      required: ['type', 'path'],
      properties: {
        type: { type: 'string' },
        path: { type: 'string' }
      }
    },
    // ... other property definitions
  }
});

// When saving, validation will be performed
try {
  configManager.saveConfig(CONFIG_TYPES.RAG, invalidConfig);
} catch (err) {
  if (err instanceof configManager.ConfigValidationError) {
    console.error('Validation errors:', err.validationErrors);
  }
}
```

### Import/Export Configurations

```javascript
// Export configuration to a file
configManager.exportConfig(
  CONFIG_TYPES.MCP,
  '/path/to/export/mcp_config_backup.json'
);

// Import configuration from a file
configManager.importConfig(
  CONFIG_TYPES.MCP,
  '/path/to/import/mcp_config.json'
);
```

## Integration with Other Components

### MCP Server Integration

```javascript
const configManager = require('./core/config/config_manager');
const { CONFIG_TYPES } = configManager;

function startMcpServers() {
  const mcpConfig = configManager.getConfig(CONFIG_TYPES.MCP);
  
  // Get servers that should be started automatically
  const autoStartServers = Object.entries(mcpConfig.servers)
    .filter(([, serverConfig]) => serverConfig.enabled && serverConfig.autostart)
    .map(([serverId, serverConfig]) => ({
      id: serverId,
      ...serverConfig
    }));
  
  // Start each server
  autoStartServers.forEach(serverConfig => {
    const { id, command, args } = serverConfig;
    console.log(`Starting MCP server: ${id}`);
    // Start server process
  });
}
```

### Color Schema Integration

```javascript
const configManager = require('./core/config/config_manager');
const { CONFIG_TYPES } = configManager;

function getActiveColorSchema() {
  const colorSchemaConfig = configManager.getConfig(CONFIG_TYPES.COLOR_SCHEMA);
  const userConfig = configManager.getConfig(CONFIG_TYPES.USER);
  
  // Get user's preferred theme
  const preferredTheme = userConfig.preferences?.theme || 'light';
  
  // Get the active theme
  const activeTheme = colorSchemaConfig.userPreferences.activeTheme;
  
  if (activeTheme === 'custom' && colorSchemaConfig.userPreferences.custom) {
    return colorSchemaConfig.userPreferences.custom;
  } else {
    // Fall back to user preference or default theme
    return colorSchemaConfig.themes[activeTheme] || 
           colorSchemaConfig.themes[preferredTheme] || 
           colorSchemaConfig.themes.light;
  }
}
```

## Error Handling

The configuration system provides standardized error types:

```javascript
const { 
  ConfigError, 
  ConfigValidationError, 
  ConfigAccessError 
} = require('./core/config/config_manager');

try {
  configManager.updateConfigValue('unknown-type', 'some.path', 'value');
} catch (err) {
  if (err instanceof ConfigValidationError) {
    console.error('Validation error:', err.validationErrors);
  } else if (err instanceof ConfigAccessError) {
    console.error('File access error:', err.message);
  } else if (err instanceof ConfigError) {
    console.error('General configuration error:', err.message);
  } else {
    console.error('Unexpected error:', err);
  }
}
```

## Best Practices

1. **Centralize Configuration Access**: Always use the ConfigManager to access configuration values, rather than reading files directly.

2. **Provide Default Values**: When getting configuration values, always provide sensible defaults.

   ```javascript
   // Good practice
   const timeout = configManager.getConfigValue(
     CONFIG_TYPES.RAG, 
     'search.timeout', 
     5000  // Default timeout in ms
   );
   ```

3. **Use Environment Variables for Sensitive Data**: Never commit sensitive information like API keys to configuration files.

4. **Subscribe to Configuration Changes**: If your component depends on configuration values, register an observer to react to changes.

5. **Validate Before Saving**: Use schema validation to ensure configuration integrity.

6. **Document Configuration Requirements**: Clearly document the required configuration values for your components.

## Example: Component Configuration

Here's a complete example of how to integrate a component with the configuration system:

```javascript
const configManager = require('./core/config/config_manager');
const { CONFIG_TYPES } = configManager;

class DatabaseConnector {
  constructor() {
    this.config = null;
    this.observerId = null;
    this.connection = null;
    
    // Define configuration schema
    configManager.setSchema(CONFIG_TYPES.RAG, {
      type: 'object',
      properties: {
        database: {
          type: 'object',
          required: ['type', 'path'],
          properties: {
            type: { type: 'string' },
            path: { type: 'string' }
          }
        }
      }
    });
    
    // Register for configuration changes
    this.observerId = configManager.registerObserver(
      CONFIG_TYPES.RAG,
      this.handleConfigChange.bind(this)
    );
    
    // Initial configuration load
    this.config = configManager.getConfig(CONFIG_TYPES.RAG);
    this.connect();
  }
  
  handleConfigChange(newConfig) {
    // Check if database configuration changed
    if (this.config.database.type !== newConfig.database.type ||
        this.config.database.path !== newConfig.database.path) {
      console.log('Database configuration changed, reconnecting...');
      this.config = newConfig;
      this.disconnect();
      this.connect();
    }
  }
  
  connect() {
    const { type, path } = this.config.database;
    console.log(`Connecting to ${type} database at ${path}`);
    // Connection logic here
  }
  
  disconnect() {
    if (this.connection) {
      console.log('Disconnecting from database');
      // Disconnection logic here
      this.connection = null;
    }
  }
  
  dispose() {
    this.disconnect();
    if (this.observerId) {
      configManager.unregisterObserver(CONFIG_TYPES.RAG, this.observerId);
      this.observerId = null;
    }
  }
}
```

## Conclusion

The standardized configuration system provides a robust foundation for managing all settings in the Claude Neural Framework. By following these guidelines, you can ensure that your components integrate seamlessly with the rest of the framework and provide a consistent experience for users.