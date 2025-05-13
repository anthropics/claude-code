# Claude Framework Final Structure

After migration and consolidation, the framework will have the following structure:

```
claude-framework/
├── apps/                                # Application code
│   ├── api/                             # REST API
│   │   ├── src/
│   │   │   ├── controllers/             # API controllers
│   │   │   ├── middleware/              # Express middleware
│   │   │   └── routes/                  # API routes
│   │   └── test/                        # API tests
│   ├── cli/                             # Command-line interface
│   │   ├── src/
│   │   │   ├── commands/                # CLI commands
│   │   │   │   └── sequential-execute.ts  # Sequential execution command
│   │   │   ├── index.ts                 # CLI entry point
│   │   │   └── utils/                   # CLI utilities
│   │   └── test/                        # CLI tests
│   └── web/                             # Web interface
│       ├── src/
│       │   ├── components/              # React components
│       │   │   ├── dashboard/           # Dashboard components
│       │   │   ├── enterprise/          # Enterprise-specific components
│       │   │   ├── form/                # Form components
│       │   │   ├── layout/              # Layout components
│       │   │   ├── mcp/                 # MCP integration components
│       │   │   ├── profile/             # Profile management components
│       │   │   └── rewards/             # Reward system components
│       │   ├── contexts/                # React contexts
│       │   ├── hooks/                   # React hooks
│       │   │   └── mcp/                 # MCP-specific hooks
│       │   └── pages/                   # Page components
│       └── test/                        # Web tests
├── configs/                             # Configuration files
│   ├── api/
│   │   └── schema.json                  # API schema
│   ├── backup/
│   │   └── config.json                  # Backup configuration
│   ├── color-schema/
│   │   └── config.json                  # Color schema configuration
│   ├── debug/
│   │   └── workflow-config.json         # Debug workflow configuration
│   ├── enterprise/
│   │   └── config.json                  # Enterprise configuration
│   ├── i18n/
│   │   └── config.json                  # Internationalization config
│   ├── mcp/
│   │   ├── config.json                  # MCP integration config
│   │   └── server_config.json           # MCP server configuration
│   ├── rag/
│   │   └── config.json                  # RAG system configuration
│   ├── saar/
│   │   └── config.json                  # SAAR configuration
│   ├── security/
│   │   ├── constraints.json             # Security constraints
│   │   └── constraints.md               # Security documentation
│   ├── workflows/
│   │   └── enterprise-workflow.json     # Enterprise workflow config
│   └── global.json                      # Global configuration
├── docs/                                # Documentation
│   ├── api/                             # API documentation
│   ├── architecture/                    # Architecture documentation
│   ├── examples/                        # Example code and usage
│   ├── guides/                          # How-to guides
│   │   └── sequential-execution-manager.md  # Sequential execution guide
│   └── prompts/                         # AI prompts and templates
│       ├── classification/              # Classification prompts
│       ├── coding/                      # Coding prompts
│       └── generation/                  # Generation prompts
├── libs/                                # Library code
│   ├── agents/                          # Agent system
│   │   ├── src/
│   │   │   ├── a2a-manager.ts           # Agent-to-agent manager
│   │   │   ├── agent-base/              # Base agent implementation
│   │   │   │   └── base-agent.ts        # Abstract base agent
│   │   │   ├── debug/                   # Debug agents
│   │   │   ├── doc/                     # Documentation agents
│   │   │   ├── git/                     # Git workflow agents
│   │   │   ├── index.ts                 # Main exports
│   │   │   └── orchestrator/            # Agent orchestration
│   │   └── test/                        # Agent tests
│   ├── core/                            # Core functionality
│   │   ├── src/
│   │   │   ├── config/                  # Configuration management
│   │   │   │   ├── config-manager.ts    # Configuration manager
│   │   │   │   └── framework-config.ts  # Framework configuration
│   │   │   ├── error/                   # Error handling
│   │   │   │   └── error-handler.ts     # Error handler
│   │   │   ├── i18n/                    # Internationalization
│   │   │   ├── index.ts                 # Main exports
│   │   │   ├── logging/                 # Logging system
│   │   │   │   └── logger.ts            # Logger implementation
│   │   │   └── security/                # Security functions
│   │   └── test/                        # Core tests
│   ├── mcp/                             # MCP integration
│   │   ├── src/
│   │   │   ├── client/                  # MCP client
│   │   │   │   └── claude-mcp-client.ts # Claude MCP client
│   │   │   ├── fallbacks/               # Fallback implementations
│   │   │   ├── routes/                  # MCP routes
│   │   │   ├── server/                  # MCP server implementation
│   │   │   └── services/                # MCP services
│   │   └── test/                        # MCP tests
│   ├── rag/                             # RAG system
│   │   ├── src/
│   │   │   ├── embeddings/              # Embedding generation
│   │   │   └── vectorstore/             # Vector store integration
│   │   └── test/                        # RAG tests
│   ├── shared/                          # Shared utilities
│   │   ├── src/
│   │   │   ├── testing/                 # Testing utilities
│   │   │   ├── types/                   # Shared TypeScript types
│   │   │   └── utils/                   # Shared utilities
│   │   └── test/                        # Shared utils tests
│   └── workflows/                       # Workflow implementations
│       ├── src/
│       │   ├── debugging/               # Debugging workflows
│       │   ├── index.ts                 # Main exports
│       │   ├── saar/                    # SAAR workflows
│       │   └── sequential/              # Sequential execution
│       │       ├── documentation/        # Documentation generation
│       │       │   └── sequential-doc-generator.ts  # Doc generator
│       │       ├── executors/           # Task executors
│       │       │   ├── base-executor.ts # Base executor
│       │       │   ├── cicd-executor.ts # CI/CD executor
│       │       │   ├── data-executor.ts # Data processing executor
│       │       │   ├── documentation-executor.ts  # Doc executor
│       │       │   └── index.ts         # Executor exports
│       │       ├── index.ts             # Sequential exports
│       │       ├── integration/         # Integration helpers
│       │       │   └── sequential-execution-manager.ts  # Integration
│       │       ├── planners/            # Planning components
│       │       │   ├── base-planner.ts  # Base planner
│       │       │   ├── cicd-planner.ts  # CI/CD planner
│       │       │   ├── data-planner.ts  # Data processing planner
│       │       │   ├── documentation-planner.ts  # Doc planner
│       │       │   └── index.ts         # Planner exports
│       │       ├── sequential-execution-manager.ts  # Main manager
│       │       ├── services/            # Supporting services
│       │       │   └── sequential-planner.ts  # Sequential planner
│       │       └── types.ts             # Type definitions
│       └── test/                        # Workflow tests
├── specs/                               # Specifications
│   ├── migrations/                      # Database migrations
│   │   └── 001_initial_schema.sql       # Initial schema
│   ├── openapi/                         # OpenAPI specifications
│   │   └── v1/                          # API v1
│   │       └── claude-api.yaml          # Claude API spec
│   └── schemas/                         # JSON schemas
│       └── api-schema.json              # API schema definition
├── tools/                               # Tools and scripts
│   ├── examples/                        # Example code
│   │   └── sequential-execution-manager-example.ts  # Example usage
│   ├── generators/                      # Code generators
│   └── scripts/                         # Utility scripts
│       ├── backup/                      # Backup scripts
│       ├── ci/                          # CI/CD scripts
│       ├── examples/                    # Example scripts
│       ├── install/                     # Installation scripts
│       ├── migration/                   # Migration scripts
│       │   ├── migrate.sh               # Migration script
│       │   └── README.md                # Migration guide
│       └── setup/                       # Setup scripts
├── .claude/                             # Claude AI configuration
├── .github/                             # GitHub configuration
│   ├── ISSUE_TEMPLATE/                  # Issue templates
│   ├── PULL_REQUEST_TEMPLATE.md         # PR template
│   └── workflows/                       # GitHub Actions
├── .vscode/                             # VS Code configuration
├── .gitignore                           # Git ignore file
├── .gitattributes                       # Git attributes
├── CLAUDE.md                            # Claude AI documentation
├── INTEGRATION-PLAN.md                  # Migration plan
├── LICENSE.md                           # License file
├── nx.json                              # Nx monorepo config
├── package.json                         # Package definition
├── README.md                            # Main documentation
├── REFACTORING-SUMMARY.md               # Refactoring summary
└── tsconfig.base.json                   # TypeScript config
```

## Structure Highlights

### 1. Monorepo Architecture
The framework uses a monorepo structure with clear separation between:
- **apps/**: End-user applications (CLI, API, web)
- **libs/**: Core libraries and reusable modules
- **configs/**: Configuration files
- **docs/**: Documentation
- **tools/**: Utilities and scripts

### 2. Module Organization
Functionality is organized into focused modules:
- **agents/**: Agent-based architecture components
- **core/**: Essential framework functionality
- **mcp/**: Model Context Protocol integration
- **rag/**: Retrieval Augmented Generation system
- **workflows/**: Workflow engines including sequential execution

### 3. Consistent Testing Structure
Each library has a corresponding test directory:
- **libs/module/test/**: Tests for the specific module
- **apps/module/test/**: Tests for the specific application

### 4. Documentation Structure
Documentation is consolidated and organized by type:
- **docs/api/**: API reference documentation
- **docs/architecture/**: System architecture documentation
- **docs/guides/**: How-to guides and tutorials
- **docs/examples/**: Code examples and usage patterns
- **docs/prompts/**: AI prompt templates

### 5. Configuration Management
Configuration is centralized and categorized:
- **configs/**: Root configuration directory
- **configs/module/**: Module-specific configuration

This structure provides a clean, maintainable architecture that follows modern best practices for TypeScript monorepos while ensuring backward compatibility through carefully designed proxy modules.