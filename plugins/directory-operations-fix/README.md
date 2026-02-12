# Directory Operations Fix Plugin

## Overview

This plugin addresses **Issue #9855: Claude code crashes when referencing directories**, a critical stability issue affecting AWS Bedrock users and newer Haiku models.

## Problem Statement

Claude Code was consistently crashing with "No assistant message found" errors when users:
- Reference directories using the `@directory` syntax
- Use the Explore agent for directory analysis
- Work with AWS Bedrock Haiku 4.5 model variants

## Solution

This plugin provides:

1. **Robust Error Handling**: Wraps directory operations in try-catch blocks with graceful degradation
2. **Model Compatibility**: Special handling for Bedrock Haiku response format issues
3. **Retry Mechanism**: Automatic retries with exponential backoff for transient failures
4. **Fallback Responses**: Prevents crashes by providing safe fallback content
5. **Comprehensive Logging**: Detailed logging for debugging Bedrock-specific issues

## Key Features

- ✅ **Crash Prevention**: Eliminates "No assistant message found" crashes
- ✅ **Bedrock Support**: Special handling for AWS Bedrock model variants
- ✅ **Auto-Retry**: Configurable retry attempts with exponential backoff
- ✅ **Fallback Responses**: Safe degradation when operations fail
- ✅ **Debug Logging**: Structured logging for troubleshooting

## Installation

1. Copy the plugin to your Claude Code plugins directory:
   ```bash
   cp -r directory-operations-fix ~/.claude/plugins/
   ```

2. Enable the plugin in your Claude Code configuration.

## Configuration

```json
{
  "retryAttempts": 3,
  "retryDelay": 1000,
  "logLevel": "INFO"
}
```

### Options

- `retryAttempts`: Number of retry attempts (default: 3)
- `retryDelay`: Base delay between retries in milliseconds (default: 1000)
- `logLevel`: Logging level - DEBUG, INFO, WARN, ERROR (default: INFO)

## Usage

The plugin automatically handles directory operations. No code changes required - it works transparently with existing Claude Code functionality.

### Example: Directory Listing

```typescript
import { createPlugin } from './src/index';

const plugin = createPlugin({
  retryAttempts: 5,
  retryDelay: 500,
  logLevel: 'DEBUG'
});

// This will now work safely even with problematic responses
const result = await plugin.listDirectory('/my/project/path', 'bedrock-haiku-4.5');
```

## Technical Details

### Root Cause Analysis

The crashes were caused by:
1. **Missing Response Fields**: Bedrock Haiku sometimes omits `assistant_message` field
2. **Empty Responses**: Some API calls return completely empty responses
3. **Format Inconsistency**: Different models return different response structures

### Solution Architecture

```typescript
// Error handling wrapper
try {
  const response = await processDirectoryListing(path);
  if (!response?.assistant_message) {
    throw new Error("Missing assistant response");
  }
  return response;
} catch (error) {
  logger.error("Directory operation failed", { path, error });
  return fallbackDirectoryResponse(path);
}
```

### Model-Specific Handling

- **Standard Models**: Direct response processing
- **Bedrock Models**: Response format normalization
- **Haiku Variants**: Special empty response handling

## Testing

Run the comprehensive test suite:

```bash
npm test
```

The tests cover:
- Missing assistant message scenarios
- Empty response handling
- Model compatibility detection
- Retry mechanism functionality
- Fallback response generation

## Impact

This fix resolves crashes for:
- AWS Bedrock users experiencing directory listing failures
- Users of Haiku 4.5 model variants
- Any scenario where directory operations return malformed responses

## Contributing

This plugin was developed to address a critical community issue. Contributions welcome:

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Submit pull request

## Related Issues

- **Primary**: [#9855 - Claude code crashes](https://github.com/anthropics/claude-code/issues/9855)
- **Related**: [#9800 - Resume functionality issues](https://github.com/anthropics/claude-code/issues/9800)

## License

Same as Claude Code main project.