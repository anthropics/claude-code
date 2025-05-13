# Configuration API Documentation

The Configuration API provides a centralized way to manage configuration settings for the Claude Neural Framework.

## ConfigManager

`ConfigManager` is the core class for configuration management.

```javascript
const configManager = require('../core/config/config_manager');
const { CONFIG_TYPES } = configManager;
```

### Constants

#### CONFIG_TYPES

Enumeration of supported configuration types.

```javascript
const { CONFIG_TYPES } = require('../core/config/config_manager');

console.log(CONFIG_TYPES.RAG);    // 'rag'
console.log(CONFIG_TYPES.MCP);    // 'mcp'
console.log(CONFIG_TYPES.I18N);   // 'i18n'
console.log(CONFIG_TYPES.SECURITY); // 'security'
```

Available configuration types:
- `CONFIG_TYPES.RAG`: RAG system configuration
- `CONFIG_TYPES.MCP`: MCP server configuration
- `CONFIG_TYPES.SECURITY`: Security constraints configuration
- `CONFIG_TYPES.COLOR_SCHEMA`: Color schema configuration
- `CONFIG_TYPES.GLOBAL`: Global framework configuration
- `CONFIG_TYPES.USER`: User-specific configuration
- `CONFIG_TYPES.I18N`: Internationalization configuration

### Methods

#### `getConfig(configType)`

Gets a complete configuration object for a specific type.

```javascript
const mcpConfig = configManager.getConfig(CONFIG_TYPES.MCP);
```

Parameters:
- `configType` (string): One of the predefined configuration types from `CONFIG_TYPES`

Returns:
- (Object): The complete configuration object

Throws:
- `ConfigError`: If the configuration type is unknown

#### `getConfigValue(configType, keyPath, defaultValue)`

Gets a specific configuration value by key path.

```javascript
const apiKeyEnv = configManager.getConfigValue(CONFIG_TYPES.RAG, 'claude.api_key_env', 'CLAUDE_API_KEY');
```

Parameters:
- `configType` (string): One of the predefined configuration types from `CONFIG_TYPES`
- `keyPath` (string): Dot-separated path to the configuration value (e.g., 'database.type')
- `defaultValue` (any, optional): Default value if the key doesn't exist

Returns:
- Value at the specified key path, or the default value if not found

#### `updateConfigValue(configType, keyPath, value)`

Updates a specific configuration value.

```javascript
configManager.updateConfigValue(CONFIG_TYPES.MCP, 'servers.sequentialthinking.enabled', true);
```

Parameters:
- `configType` (string): One of the predefined configuration types from `CONFIG_TYPES`
- `keyPath` (string): Dot-separated path to the configuration value (e.g., 'database.type')
- `value` (any): New value to set

Returns:
- (boolean): Success

#### `saveConfig(configType, config)`

Saves a configuration.

```javascript
const config = configManager.getConfig(CONFIG_TYPES.RAG);
config.database.type = 'lancedb';
configManager.saveConfig(CONFIG_TYPES.RAG, config);
```

Parameters:
- `configType` (string): Configuration type
- `config` (Object): Configuration to save

Returns:
- (boolean): Success

Throws:
- `ConfigError`: If the configuration type is unknown
- `ConfigValidationError`: If schema validation fails

#### `resetConfig(configType)`

Resets a configuration to default values.

```javascript
configManager.resetConfig(CONFIG_TYPES.RAG);
```

Parameters:
- `configType` (string): Configuration type to reset

Returns:
- (boolean): Success

#### `registerObserver(configType, callback)`

Registers an observer for configuration changes.

```javascript
const observerId = configManager.registerObserver(CONFIG_TYPES.MCP, (config) => {
  console.log('MCP configuration changed:', config);
});
```

Parameters:
- `configType` (string): Configuration type to observe
- `callback` (Function): Callback function receiving the updated configuration

Returns:
- (string): Observer ID for unregistering

#### `unregisterObserver(configType, observerId)`

Unregisters a configuration observer.

```javascript
configManager.unregisterObserver(CONFIG_TYPES.MCP, observerId);
```

Parameters:
- `configType` (string): Configuration type
- `observerId` (string): Observer ID returned from `registerObserver`

Returns:
- (boolean): Success

#### `hasApiKey(service)`

Checks if an API key is available for a specific service.

```javascript
if (configManager.hasApiKey('claude')) {
  // API key is available
}
```

Parameters:
- `service` (string): Service name ('claude', 'voyage', 'brave')

Returns:
- (boolean): `true` if the API key is available, `false` otherwise

#### `getEnvironmentVariables()`

Gets environment variables used by the framework.

```javascript
const envVars = configManager.getEnvironmentVariables();
console.log(envVars.CLAUDE_API_KEY); // 'CLAUDE_API_KEY'
```

Returns:
- (Object): Environment variables mapping

#### `exportConfig(configType, exportPath)`

Exports a configuration to a file.

```javascript
configManager.exportConfig(CONFIG_TYPES.RAG, './rag-config-backup.json');
```

Parameters:
- `configType` (string): Configuration type
- `exportPath` (string): Export file path

Returns:
- (boolean): Success

#### `importConfig(configType, importPath)`

Imports a configuration from a file.

```javascript
configManager.importConfig(CONFIG_TYPES.RAG, './rag-config-backup.json');
```

Parameters:
- `configType` (string): Configuration type
- `importPath` (string): Import file path

Returns:
- (boolean): Success

## Configuration Error Types

The framework provides several configuration-related error types.

```javascript
const { 
  ConfigError, 
  ConfigValidationError, 
  ConfigAccessError 
} = require('../core/config/config_manager');
```

### ConfigError

Base error class for configuration-related errors.

```javascript
throw new ConfigError('Configuration error occurred');
```

### ConfigValidationError

Error for configuration validation failures.

```javascript
throw new ConfigValidationError('Invalid configuration', [
  'Missing required field: database.type',
  'Invalid type for database.port: expected number, got string'
]);
```

Parameters:
- `message` (string): Error message
- `validationErrors` (Array, optional): List of validation errors

### ConfigAccessError

Error for configuration access issues.

```javascript
throw new ConfigAccessError('Failed to access configuration file');
```

## Configuration Files

The framework uses several configuration files:

### RAG Configuration (`rag_config.json`)

```javascript
{
  "version": "1.0.0",
  "database": {
    "type": "chroma",
    "path": "~/.claude/vector_store"
  },
  "embedding": {
    "model": "voyage",
    "api_key_env": "VOYAGE_API_KEY"
  },
  "claude": {
    "api_key_env": "CLAUDE_API_KEY",
    "model": "claude-3-sonnet-20240229"
  }
}
```

### MCP Configuration (`mcp_config.json`)

```javascript
{
  "version": "1.0.0",
  "servers": {
    "sequentialthinking": {
      "description": "Sequential Thinking MCP Server",
      "command": "node",
      "args": ["server.js"],
      "enabled": true,
      "autostart": true
    }
  }
}
```

### Security Configuration (`security_constraints.json`)

```javascript
{
  "execution": {
    "confirmation_required": true,
    "allowed_commands": ["git", "npm", "node", "python", "docker"],
    "blocked_commands": ["rm -rf /", "sudo", "chmod 777"]
  },
  "filesystem": {
    "read": {
      "allowed": true,
      "paths": ["./", "../", "~/.claude/"]
    },
    "write": {
      "allowed": true,
      "confirmation_required": true,
      "paths": ["./", "./src/", "./docs/"]
    }
  },
  "network": {
    "allowed": true,
    "restricted_domains": ["localhost"]
  }
}
```

### I18n Configuration (`i18n_config.json`)

```javascript
{
  "version": "1.0.0",
  "locale": "en",
  "fallbackLocale": "en",
  "loadPath": "core/i18n/locales/{{lng}}.json",
  "debug": false,
  "supportedLocales": ["en", "fr"],
  "dateFormat": {
    "short": {
      "year": "numeric",
      "month": "numeric",
      "day": "numeric"
    }
  },
  "numberFormat": {
    "decimal": {
      "style": "decimal",
      "minimumFractionDigits": 2,
      "maximumFractionDigits": 2
    }
  }
}
```

## Environment Variables

The framework supports configuration via environment variables:

```
# Claude API
CLAUDE_API_KEY=sk-xxx

# Voyage API (embeddings)
VOYAGE_API_KEY=voy-xxx

# Brave Search API
BRAVE_API_KEY=xxx

# MCP Server
MCP_API_KEY=xxx
```

Environment variables can also override specific configuration values using the pattern:

```
CNF_[CONFIG_TYPE]_[KEY_PATH]
```

Examples:
- `CNF_RAG_DATABASE_TYPE=lancedb` (overrides rag.database.type)
- `CNF_MCP_SERVERS_SEQUENTIALTHINKING_ENABLED=true` (overrides mcp.servers.sequentialthinking.enabled)
- `CNF_I18N_LOCALE=fr` (overrides i18n.locale)