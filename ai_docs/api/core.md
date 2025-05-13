# Core API Documentation

The Core API provides the fundamental building blocks of the Claude Neural Framework.

## ConfigManager

`ConfigManager` is the central configuration management system for the framework.

```javascript
const { ConfigManager, CONFIG_TYPES } = require('../core/config/config_manager');
```

### Methods

#### `getInstance()`

Gets the singleton instance of the ConfigManager.

```javascript
const configManager = ConfigManager.getInstance();
```

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

#### `resetConfig(configType)`

Resets a configuration to default values.

```javascript
configManager.resetConfig(CONFIG_TYPES.RAG);
```

Parameters:
- `configType` (string): Configuration type to reset

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

## Logger

`Logger` provides standardized logging functionality for the framework.

```javascript
const logger = require('../core/logging/logger').createLogger('component-name');
```

### Methods

#### `createLogger(component)`

Creates a new logger instance for a specific component.

```javascript
const logger = require('../core/logging/logger').createLogger('my-component');
```

Parameters:
- `component` (string): Component name for log attribution

Returns:
- (Object): Logger instance

#### `trace(message, metadata)`

Logs a trace message (lowest level).

```javascript
logger.trace('Detailed trace information', { key: 'value' });
```

Parameters:
- `message` (string): Log message
- `metadata` (Object, optional): Additional metadata

#### `debug(message, metadata)`

Logs a debug message.

```javascript
logger.debug('Debugging information', { key: 'value' });
```

Parameters:
- `message` (string): Log message
- `metadata` (Object, optional): Additional metadata

#### `info(message, metadata)`

Logs an informational message.

```javascript
logger.info('Operation succeeded', { operation: 'update', id: 123 });
```

Parameters:
- `message` (string): Log message
- `metadata` (Object, optional): Additional metadata

#### `warn(message, metadata)`

Logs a warning message.

```javascript
logger.warn('Resource not found, using default', { resource: 'config', path: '/etc/config.json' });
```

Parameters:
- `message` (string): Log message
- `metadata` (Object, optional): Additional metadata

#### `error(message, metadata)`

Logs an error message.

```javascript
logger.error('Operation failed', { error: err, operation: 'update' });
```

Parameters:
- `message` (string): Log message
- `metadata` (Object, optional): Additional metadata, typically including an `error` field

#### `fatal(message, metadata)`

Logs a fatal error message (highest level).

```javascript
logger.fatal('Application crashed', { error: err });
```

Parameters:
- `message` (string): Log message
- `metadata` (Object, optional): Additional metadata, typically including an `error` field

#### `child(subComponent)`

Creates a child logger with a sub-component name.

```javascript
const dbLogger = logger.child('database');
dbLogger.info('Connected to database'); // Logs with component 'my-component:database'
```

Parameters:
- `subComponent` (string): Sub-component name

Returns:
- (Object): Child logger instance

## Error Handler

`ErrorHandler` provides standardized error handling for the framework.

```javascript
const {
  FrameworkError,
  ConfigError,
  MCPError,
  RAGError,
  ValidationError,
  handleError,
  formatError
} = require('../core/error/error_handler');
```

### Error Classes

#### `FrameworkError`

Base error class for all framework errors.

```javascript
throw new FrameworkError('Something went wrong', {
  code: 'ERR_CUSTOM',
  status: 500,
  component: 'component-name',
  cause: originalError,
  metadata: { key: 'value' },
  isOperational: true
});
```

Parameters:
- `message` (string): Error message
- `options` (Object, optional):
  - `code` (string): Error code (default: 'ERR_FRAMEWORK_UNKNOWN')
  - `status` (number): HTTP status code (default: 500)
  - `component` (string): Component where the error occurred (default: 'framework')
  - `cause` (Error): Original error that caused this error
  - `metadata` (Object): Additional error metadata
  - `isOperational` (boolean): Whether this is an operational error (default: true)

#### `ConfigError`

Error related to configuration.

```javascript
throw new ConfigError('Invalid configuration', {
  code: 'ERR_CONFIG_INVALID',
  metadata: { key: 'invalid-key' }
});
```

#### `MCPError`

Error related to MCP operations.

```javascript
throw new MCPError('Failed to connect to MCP server', {
  code: 'ERR_MCP_CONNECTION',
  metadata: { server: 'sequentialthinking' }
});
```

#### `RAGError`

Error related to RAG operations.

```javascript
throw new RAGError('Failed to generate embeddings', {
  code: 'ERR_RAG_EMBEDDING',
  metadata: { model: 'voyage' }
});
```

#### `ValidationError`

Error related to input validation.

```javascript
throw new ValidationError('Invalid input', {
  code: 'ERR_VALIDATION_INPUT',
  metadata: { field: 'username', constraint: 'required' }
});
```

### Functions

#### `handleError(error)`

Handles an error according to its type and severity.

```javascript
const result = handleError(error);
```

Parameters:
- `error` (Error): Error to handle

Returns:
- (Object): Formatted error response

#### `formatError(error)`

Formats an error for API responses.

```javascript
const formattedError = formatError(error);
response.status(formattedError.status || 500).json({ error: formattedError });
```

Parameters:
- `error` (Error): Error to format

Returns:
- (Object): Formatted error object suitable for API responses

#### `createError(message, errorType, options)`

Creates a specific error type from a string.

```javascript
const error = createError('Invalid configuration', 'ConfigError', {
  status: 400,
  metadata: { config: 'mcp' }
});
```

Parameters:
- `message` (string): Error message
- `errorType` (string): Type of error to create ('FrameworkError', 'ConfigError', etc.)
- `options` (Object, optional): Additional error options

Returns:
- (Error): Created error object

## I18n

`I18n` provides internationalization support for the framework.

```javascript
const { I18n } = require('../core/i18n/i18n');
```

### Methods

#### `constructor(options)`

Creates a new I18n instance.

```javascript
const i18n = new I18n({
  locale: 'fr',
  fallbackLocale: 'en'
});
```

Parameters:
- `options` (Object, optional):
  - `locale` (string): Initial locale (default from config)
  - `fallbackLocale` (string): Fallback locale (default from config)
  - `debug` (boolean): Enable debug mode (default from config)

#### `translate(key, params, locale)`

Translates a message key.

```javascript
const message = i18n.translate('common.greeting', { name: 'User' });
```

Parameters:
- `key` (string): Translation key (e.g., 'common.greeting')
- `params` (Object, optional): Parameters for interpolation
- `locale` (string, optional): Specific locale to use (default is current locale)

Returns:
- (string): Translated message

#### `setLocale(locale)`

Changes the current locale.

```javascript
i18n.setLocale('fr');
```

Parameters:
- `locale` (string): New locale code

Returns:
- (boolean): Success

#### `formatDate(date, format, locale)`

Formats a date according to locale conventions.

```javascript
const formattedDate = i18n.formatDate(new Date(), 'short');
```

Parameters:
- `date` (Date): Date to format
- `format` (string|Object, optional): Format name from config or format options
- `locale` (string, optional): Specific locale to use

Returns:
- (string): Formatted date

#### `formatNumber(number, format, locale)`

Formats a number according to locale conventions.

```javascript
const formattedNumber = i18n.formatNumber(1000.5, 'decimal');
```

Parameters:
- `number` (number): Number to format
- `format` (string|Object, optional): Format name from config or format options
- `locale` (string, optional): Specific locale to use

Returns:
- (string): Formatted number

#### `formatCurrency(amount, currency, format, locale)`

Formats a currency amount according to locale conventions.

```javascript
const formattedCurrency = i18n.formatCurrency(1000.5, 'USD');
```

Parameters:
- `amount` (number): Amount to format
- `currency` (string, optional): Currency code (default from config)
- `format` (string|Object, optional): Format name from config or format options
- `locale` (string, optional): Specific locale to use

Returns:
- (string): Formatted currency amount