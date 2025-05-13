# Internationalization (i18n) Guide

This guide documents the internationalization (i18n) system for the Claude Neural Framework.

## Overview

The i18n system provides localization capabilities for user-facing text throughout the framework. It supports:

- Translation of messages based on locale
- Parameter interpolation within messages
- Pluralization rules for different languages
- Date, number, and currency formatting
- Fallback locale configuration

## Basic Usage

```javascript
const { I18n } = require('../core/i18n/i18n');

// Create an instance with default locale
const i18n = new I18n();

// Translate a simple message
const message = i18n.translate('common.welcome');

// Translate with parameters
const greeting = i18n.translate('common.greeting', { name: 'User' });

// Translate with pluralization
const fileCount = i18n.translate('common.fileCount', { count: 5 });
```

## Configuration

The i18n system uses the centralized configuration system with these default settings:

```javascript
{
  "locale": "en",
  "fallbackLocale": "en",
  "loadPath": "core/i18n/locales/{{lng}}.json",
  "debug": false
}
```

You can override these settings in your user configuration:

```javascript
// In your application code
const { ConfigManager } = require('../core/config/config_manager');
const config = ConfigManager.getInstance();

config.set('i18n.locale', 'fr');
config.set('i18n.debug', true);
```

## Locale Files

Locale files are JSON files containing translations for each supported language. They follow this structure:

```json
{
  "common": {
    "welcome": "Welcome to the Claude Neural Framework",
    "greeting": "Hello, {{name}}!",
    "fileCount": "{{count}} file|{{count}} files",
    "back": "Back",
    "next": "Next"
  },
  "errors": {
    "notFound": "Resource not found",
    "serverError": "Server error occurred"
  }
}
```

Locale files are stored in `core/i18n/locales/` with the locale code as the filename (e.g., `en.json`, `fr.json`).

## Advanced Features

### Pluralization

The i18n system supports pluralization with a pipe (`|`) separator:

```json
{
  "notifications": "You have {{count}} notification|You have {{count}} notifications"
}
```

For languages with more complex pluralization rules, use an array:

```json
{
  "minutes": ["{{count}} minute", "{{count}} minutes", "{{count}} minutes"]
}
```

### Date and Number Formatting

Format dates and numbers according to locale conventions:

```javascript
// Format a date
const formattedDate = i18n.formatDate(new Date());

// Format a number
const formattedNumber = i18n.formatNumber(1000.5);

// Format currency
const formattedCurrency = i18n.formatCurrency(1000.5, 'USD');
```

### Missing Translations

When a translation is missing, the system:

1. Logs a debug message
2. Falls back to the fallback locale
3. If still not found, returns the key itself

## Adding New Languages

To add support for a new language:

1. Create a new locale file in `core/i18n/locales/` (e.g., `fr.json`)
2. Copy the structure from `en.json`
3. Translate all messages
4. Adjust pluralization rules if needed

## Integration with Components

To use i18n in your components:

```javascript
const { I18n } = require('../core/i18n/i18n');
const { ConfigManager } = require('../core/config/config_manager');
const { logger } = require('../core/logging/logger');

class MyComponent {
  constructor() {
    this.config = ConfigManager.getInstance();
    this.i18n = new I18n();
  }

  displayMessage() {
    try {
      const message = this.i18n.translate('myComponent.message');
      logger.info(`Displaying message: ${message}`);
      return message;
    } catch (error) {
      logger.error('Failed to display message', { error });
      throw error;
    }
  }
}
```

## Best Practices

1. **Use namespaced keys**: Structure translation keys logically (e.g., `component.feature.message`)
2. **Extract all hardcoded strings**: Never hardcode user-facing strings in your components
3. **Provide context for translators**: Use comments in locale files to explain context
4. **Use parameters instead of concatenation**: Use `{{param}}` syntax instead of string concatenation
5. **Handle pluralization appropriately**: Use pluralization syntax for count-based messages
6. **Test with different locales**: Ensure your UI works with various languages and character sets