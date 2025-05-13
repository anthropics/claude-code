# Claude Framework Final File Tree Structure

This document provides a structured overview of the final Claude Framework directory structure after integration.

```
claude-framework/
├── .claude/                       # Claude-specific configuration and utilities
│   ├── cognitive/                 # Cognitive components
│   │   ├── prompts/               # AI prompt templates
│   │   │   ├── classification/    # Classification prompt templates
│   │   │   ├── coding/            # Code generation prompt templates
│   │   │   └── generation/        # Content generation prompt templates
│   │   └── templates/             # Document templates
│   ├── commands/                  # Command definitions
│   ├── utils/                     # Claude-specific utilities
│   └── workflows/                 # Claude workflow definitions
├── .github/                       # GitHub integration
├── .qdrant/                       # Qdrant vector database files
├── .vscode/                       # VS Code configuration
├── ai_docs/                       # Legacy AI documentation (to be removed)
├── apps/                          # Application implementations
│   ├── api/                       # API application
│   │   ├── src/                   # Source code
│   │   │   ├── controllers/       # API controllers
│   │   │   ├── middleware/        # API middleware
│   │   │   └── routes/            # API routes
│   │   └── test/                  # API tests
│   ├── cli/                       # Command-line interface
│   │   ├── src/                   # Source code
│   │   │   ├── commands/          # CLI commands
│   │   │   └── utils/             # CLI utilities
│   │   └── test/                  # CLI tests
│   └── web/                       # Web application
│       ├── src/                   # Source code
│       │   ├── components/        # React components
│       │   │   ├── dashboard/     # Dashboard components
│       │   │   ├── enterprise/    # Enterprise components
│       │   │   ├── form/          # Form components
│       │   │   ├── layout/        # Layout components
│       │   │   ├── mcp/           # MCP-related components
│       │   │   ├── profile/       # Profile components
│       │   │   └── rewards/       # Rewards components
│       │   ├── contexts/          # React contexts
│       │   ├── hooks/             # React hooks
│       │   │   └── mcp/           # MCP-related hooks
│       │   └── pages/             # React pages
│       └── test/                  # Web tests
├── configs/                       # Configuration files
│   ├── api/                       # API configuration
│   ├── backup/                    # Backup configuration
│   ├── color-schema/              # Color schema configuration
│   ├── debug/                     # Debug configuration
│   ├── enterprise/                # Enterprise configuration
│   ├── i18n/                      # Internationalization configuration
│   ├── mcp/                       # MCP configuration
│   ├── rag/                       # RAG configuration
│   ├── saar/                      # SAAR configuration
│   ├── security/                  # Security configuration
│   └── workflows/                 # Workflow configuration
├── docs/                          # Documentation
│   ├── api/                       # API documentation
│   │   └── v1/                    # API v1 documentation
│   ├── architecture/              # Architecture documentation
│   ├── cleanup/                   # Cleanup documentation
│   ├── enterprise/                # Enterprise documentation
│   ├── examples/                  # Example code
│   │   └── recursive_debugging/   # Recursive debugging examples
│   ├── guides/                    # User and developer guides
│   ├── prompts/                   # Prompt templates documentation
│   │   ├── classification/        # Classification prompt documentation
│   │   ├── coding/                # Code generation prompt documentation
│   │   └── generation/            # Content generation prompt documentation
│   ├── recommendations/           # Recommendations documentation
│   ├── templates/                 # Template documentation
│   └── tutorials/                 # Tutorials
├── libs/                          # Library implementations
│   ├── agents/                    # Agent framework
│   │   ├── src/                   # Source code
│   │   │   ├── agent-base/        # Base agent implementation
│   │   │   ├── commands/          # Agent commands
│   │   │   ├── debug/             # Debugging utilities
│   │   │   ├── doc/               # Documentation generation
│   │   │   └── orchestrator/      # Agent orchestration
│   │   └── test/                  # Agent tests
│   ├── core/                      # Core framework
│   │   ├── src/                   # Source code
│   │   │   ├── config/            # Configuration management
│   │   │   │   └── enterprise/    # Enterprise configuration
│   │   │   ├── dashboard/         # Dashboard utilities
│   │   │   ├── error/             # Error handling
│   │   │   ├── i18n/              # Internationalization
│   │   │   │   └── locales/       # Locale files
│   │   │   ├── logging/           # Logging utilities
│   │   │   ├── schemas/           # Schema definitions
│   │   │   │   ├── enterprise/    # Enterprise schemas
│   │   │   │   └── profile/       # Profile schemas
│   │   │   ├── security/          # Security utilities
│   │   │   └── utils/             # Utility functions
│   │   └── test/                  # Core tests
│   ├── mcp/                       # MCP implementation
│   │   ├── src/                   # Source code
│   │   │   ├── client/            # MCP client
│   │   │   ├── enterprise/        # Enterprise MCP
│   │   │   ├── fallbacks/         # Fallback implementations
│   │   │   ├── routes/            # MCP routes
│   │   │   ├── server/            # MCP server
│   │   │   └── services/          # MCP services
│   │   └── test/                  # MCP tests
│   ├── rag/                       # RAG implementation
│   │   ├── src/                   # Source code
│   │   │   ├── database/          # Database integration
│   │   │   ├── embeddings/        # Embedding generation
│   │   │   └── vectorstore/       # Vector store integration
│   │   └── test/                  # RAG tests
│   ├── shared/                    # Shared utilities
│   │   ├── src/                   # Source code
│   │   │   ├── testing/           # Testing utilities
│   │   │   ├── types/             # TypeScript types
│   │   │   └── utils/             # Shared utility functions
│   │   └── test/                  # Shared tests
│   └── workflows/                 # Workflow implementations
│       ├── src/                   # Source code
│       │   ├── debugging/         # Debugging workflows
│       │   ├── saar/              # SAAR workflow system
│       │   │   ├── config/        # SAAR configuration
│       │   │   ├── core/          # SAAR core implementation
│       │   │   ├── modules/       # SAAR modules
│       │   │   ├── scripts/       # SAAR scripts
│       │   │   │   ├── backup/    # Backup scripts
│       │   │   │   ├── cleanup/   # Cleanup scripts
│       │   │   │   ├── dashboard/ # Dashboard scripts
│       │   │   │   ├── enterprise/# Enterprise scripts
│       │   │   │   ├── installation/# Installation scripts
│       │   │   │   ├── language_support/# Language support
│       │   │   │   └── setup/     # Setup scripts
│       │   │   ├── startup/       # SAAR startup
│       │   │   └── utils/         # SAAR utilities
│       │   └── sequential/        # Sequential execution framework
│       │       ├── documentation/ # Documentation generation
│       │       ├── executors/     # Execution implementations
│       │       ├── integration/   # Integration with other systems
│       │       ├── planners/      # Planning implementations
│       │       └── services/      # Sequential workflow services
│       └── test/                  # Workflow tests
├── specs/                         # Specifications
│   ├── migrations/                # Database migrations
│   ├── openapi/                   # OpenAPI specifications
│   │   └── v1/                    # OpenAPI v1 specifications
│   └── schemas/                   # JSON schemas
└── tools/                         # Tools and utilities
    ├── documentation/             # Documentation tools
    ├── examples/                  # Example code
    ├── generators/                # Code generators
    ├── mcp/                       # MCP tools
    │   └── integration/           # MCP integration tools
    └── scripts/                   # Utility scripts
        ├── backup/                # Backup scripts
        ├── ci/                    # CI/CD scripts
        ├── examples/              # Example scripts
        ├── install/               # Installation scripts
        ├── migration/             # Migration scripts
        └── setup/                 # Setup scripts
```

## Key Structural Points

1. **Hexagonal Architecture**: The framework follows a hexagonal architecture pattern with clear separation of concerns:
   - Domain logic in `libs/`
   - Application implementations in `apps/`
   - External interfaces and adapters in `apps/api`, `apps/cli`, and `apps/web`

2. **Modular Organization**: The codebase is organized into modular components with well-defined responsibilities:
   - `core`: Core framework functionality
   - `mcp`: MCP server and client implementation
   - `agents`: Agent framework
   - `rag`: RAG implementation
   - `workflows`: Workflow implementations including SAAR and sequential execution

3. **Clear Configuration**: Configuration is separated from implementation and organized by domain in the `configs/` directory

4. **Comprehensive Documentation**: Documentation is comprehensive and organized by category in the `docs/` directory

5. **Testing**: Each library has a dedicated `test/` directory for unit and integration tests

6. **TypeScript Support**: The framework supports TypeScript with appropriate type definitions and TypeScript implementations

7. **Unified Tooling**: Tools and utilities are organized in the `tools/` directory with clear categorization

8. **Specification-Driven Development**: API and schema specifications are defined in the `specs/` directory

9. **Cross-Platform**: The framework is designed to work across platforms with appropriate abstractions

10. **Extensibility**: The framework is designed to be extensible with clear extension points and interfaces