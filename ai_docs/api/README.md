# API Documentation for Claude Neural Framework

This directory contains detailed API documentation for the Claude Neural Framework.

## Contents

- [Core API](./core.md) - Core framework functionality
- [MCP API](./mcp.md) - Model Context Protocol integration
- [RAG API](./rag.md) - Retrieval Augmented Generation 
- [Configuration API](./configuration.md) - Configuration management
- [Logging API](./logging.md) - Logging functionality
- [Error Handling API](./error.md) - Error handling utilities
- [Internationalization API](./i18n.md) - Internationalization support
- [Security API](./security.md) - Security features and utilities

## Getting Started

See the [Quick Start Guide](../guides/quick_start_guide.md) for basic usage instructions and examples.

## API Structure

The Claude Neural Framework follows a modular API design with clear separation of concerns:

```
Claude Neural Framework
├── Core
│   ├── Configuration
│   ├── Logging
│   ├── Error Handling
│   └── Internationalization
├── MCP
│   ├── Client
│   └── Server
├── RAG
│   ├── Database
│   ├── Embeddings
│   └── Generation
└── Security
    ├── Review
    └── Secure API
```

## API Versioning

The framework follows semantic versioning:

- **Major version (x.0.0)**: Breaking API changes
- **Minor version (0.x.0)**: New features, backwards compatible
- **Patch version (0.0.x)**: Bug fixes, backwards compatible

## Best Practices

When using the Claude Neural Framework API:

1. Always use the standardized configuration system
2. Follow the proper error handling patterns
3. Use structured logging with appropriate log levels
4. Prefer async/await for asynchronous operations
5. Use the internationalization system for user-facing messages