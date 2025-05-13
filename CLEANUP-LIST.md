# Redundant and Obsolete Files Cleanup List

This document lists files that are redundant or obsolete and can be safely removed as part of the Claude Framework integration process. The files listed here have been migrated to the new structure and maintaining them in their original locations would create maintenance issues.

## Core Components

### Configuration Files
```
/home/jan/Schreibtisch/TEST/claude-code/src/core/config/*.json
```
These configuration files have been migrated to `/claude-framework/configs/` in a more modular structure. The original flat structure is redundant.

### Error Handling
```
/home/jan/Schreibtisch/TEST/claude-code/src/core/error/error_handler.js
```
This file has been migrated to `/claude-framework/libs/core/src/error/` and a TypeScript version has been created.

### I18n Components
```
/home/jan/Schreibtisch/TEST/claude-code/src/core/i18n/i18n.js
/home/jan/Schreibtisch/TEST/claude-code/src/core/i18n/locales/*.json
```
These files have been migrated to `/claude-framework/libs/core/src/i18n/` and should be maintained there.

### Logging
```
/home/jan/Schreibtisch/TEST/claude-code/src/core/logging/logger.js
```
This file has been migrated to `/claude-framework/libs/core/src/logging/` and a TypeScript version exists.

### Schema Definitions
```
/home/jan/Schreibtisch/TEST/claude-code/src/core/schemas/
```
Schema files have been migrated to `/claude-framework/libs/core/src/schemas/`.

### Security Components
```
/home/jan/Schreibtisch/TEST/claude-code/src/core/security/*.js
```
These files have been migrated to `/claude-framework/libs/core/src/security/`.

### Utilities
```
/home/jan/Schreibtisch/TEST/claude-code/src/core/utils/schema_loader.js
```
This file has been migrated to `/claude-framework/libs/core/src/utils/`.

## MCP Components

### MCP Core Files
```
/home/jan/Schreibtisch/TEST/claude-code/src/core/mcp/*.js
```
These files have been migrated to `/claude-framework/libs/mcp/src/` and reorganized into subdirectories.

### MCP Routes
```
/home/jan/Schreibtisch/TEST/claude-code/src/core/mcp/routes/*.js
```
Route files have been migrated to `/claude-framework/libs/mcp/src/routes/`.

### MCP Fallbacks
```
/home/jan/Schreibtisch/TEST/claude-code/src/core/mcp/fallbacks/*.js
```
Fallback implementations have been migrated to `/claude-framework/libs/mcp/src/fallbacks/`.

### MCP Enterprise
```
/home/jan/Schreibtisch/TEST/claude-code/src/core/mcp/enterprise/*.js
```
Enterprise MCP components have been migrated to `/claude-framework/libs/mcp/src/enterprise/`.

### MCP Hooks
```
/home/jan/Schreibtisch/TEST/claude-code/src/hooks/mcp/*.js
```
MCP hooks have been migrated to `/claude-framework/apps/web/src/hooks/mcp/`.

### MCP Tools
```
/home/jan/Schreibtisch/TEST/claude-code/tools/mcp/*.js
/home/jan/Schreibtisch/TEST/claude-code/tools/mcp/integration/*.js
```
MCP tools have been migrated to `/claude-framework/tools/mcp/`.

## Agent Components

### Agent Framework
```
/home/jan/Schreibtisch/TEST/claude-code/agents/agent_communication_framework.md
```
This file has been migrated to `/claude-framework/libs/agents/src/`.

### Agent Commands
```
/home/jan/Schreibtisch/TEST/claude-code/agents/commands/*.md
```
Agent command files have been migrated to `/claude-framework/libs/agents/src/commands/`.

## SAAR Components

### SAAR System
```
/home/jan/Schreibtisch/TEST/claude-code/saar/
```
The entire SAAR system has been migrated to `/claude-framework/libs/workflows/src/saar/`.

## Documentation

### API Documentation
```
/home/jan/Schreibtisch/TEST/claude-code/ai_docs/api/
```
API documentation has been migrated to `/claude-framework/docs/api/`.

### Architecture Documentation
```
/home/jan/Schreibtisch/TEST/claude-code/ai_docs/architecture/
```
Architecture documentation has been migrated to `/claude-framework/docs/architecture/`.

### Guides
```
/home/jan/Schreibtisch/TEST/claude-code/ai_docs/guides/
/home/jan/Schreibtisch/TEST/claude-code/docs/guides/
```
All guides have been migrated and consolidated in `/claude-framework/docs/guides/`.

### Examples
```
/home/jan/Schreibtisch/TEST/claude-code/ai_docs/examples/
```
Example code and documentation has been migrated to `/claude-framework/docs/examples/`.

### Prompts
```
/home/jan/Schreibtisch/TEST/claude-code/ai_docs/prompts/
```
Prompt templates have been migrated to `/claude-framework/docs/prompts/`.

### Recommendations
```
/home/jan/Schreibtisch/TEST/claude-code/ai_docs/recommendations/
```
Recommendation documents have been migrated to `/claude-framework/docs/recommendations/`.

### Templates
```
/home/jan/Schreibtisch/TEST/claude-code/ai_docs/templates/
```
Template files have been migrated to `/claude-framework/docs/templates/`.

### Tutorials
```
/home/jan/Schreibtisch/TEST/claude-code/ai_docs/tutorials/
```
Tutorial documents have been migrated to `/claude-framework/docs/tutorials/`.

## Specification Files

### OpenAPI Specs
```
/home/jan/Schreibtisch/TEST/claude-code/specs/openapi/
```
OpenAPI specification files have been migrated to `/claude-framework/specs/openapi/`.

### Schema Files
```
/home/jan/Schreibtisch/TEST/claude-code/specs/schemas/
```
Schema specification files have been migrated to `/claude-framework/specs/schemas/`.

### Database Migrations
```
/home/jan/Schreibtisch/TEST/claude-code/specs/migrations/
```
Database migration files have been migrated to `/claude-framework/specs/migrations/`.

## Temporary and Backup Files

### Proxy and Original Versions
```
/home/jan/Schreibtisch/TEST/claude-code/src/core/mcp/routes/*.proxy
/home/jan/Schreibtisch/TEST/claude-code/src/core/mcp/routes/*.original
/home/jan/Schreibtisch/TEST/claude-code/src/core/mcp/fallbacks/*.proxy
/home/jan/Schreibtisch/TEST/claude-code/src/core/mcp/fallbacks/*.original
/home/jan/Schreibtisch/TEST/claude-code/tools/mcp/integration/*.proxy
/home/jan/Schreibtisch/TEST/claude-code/tools/mcp/integration/*.original
```
These files are proxy implementations or original versions that have been replaced by the new structure.

### New Versions
```
/home/jan/Schreibtisch/TEST/claude-code/src/core/mcp/fallbacks/*.new
```
These files are newer versions that have been integrated into the framework structure.

## CLI Components

### CLI Commands
```
/home/jan/Schreibtisch/TEST/claude-code/cli/commands/
```
CLI commands have been migrated to `/claude-framework/apps/cli/src/commands/`.

## Web Components

### React Components
```
/home/jan/Schreibtisch/TEST/claude-code/src/components/
```
React components have been migrated to `/claude-framework/apps/web/src/components/`.

### React Contexts
```
/home/jan/Schreibtisch/TEST/claude-code/src/contexts/
```
React contexts have been migrated to `/claude-framework/apps/web/src/contexts/`.

### React Hooks
```
/home/jan/Schreibtisch/TEST/claude-code/src/hooks/
```
React hooks have been migrated to `/claude-framework/apps/web/src/hooks/`.

## Testing Files

### Unit Tests
```
/home/jan/Schreibtisch/TEST/claude-code/src/tests/unit/
```
Unit tests have been migrated to per-package test directories in `/claude-framework/libs/*/test/`.

### Integration Tests
```
/home/jan/Schreibtisch/TEST/claude-code/src/tests/integration/
```
Integration tests have been migrated to per-package test directories in `/claude-framework/libs/*/test/`.

### End-to-End Tests
```
/home/jan/Schreibtisch/TEST/claude-code/src/tests/e2e/
```
End-to-end tests have been migrated to per-application test directories in `/claude-framework/apps/*/test/`.

## Tools and Scripts

### Documentation Tools
```
/home/jan/Schreibtisch/TEST/claude-code/src/tools/documentation/
```
Documentation generation tools have been migrated to `/claude-framework/tools/documentation/`.

## Sequential Execution Framework

### Sequential Planner
```
/home/jan/Schreibtisch/TEST/claude-code/src/tools/mcp/sequential_planner.js
```
This has been migrated to `/claude-framework/libs/workflows/src/sequential/services/sequential-planner.ts`.

### Sequential Documentation Generator
```
/home/jan/Schreibtisch/TEST/claude-code/src/tools/documentation/sequential_doc_generator.js
```
This has been migrated to `/claude-framework/libs/workflows/src/sequential/documentation/sequential-doc-generator.ts`.

## Note on Clean-up Approach

When cleaning up these files, consider the following approach:

1. **Staged Cleanup**: Remove files in stages, starting with the most clearly redundant ones
2. **Verification**: After each stage, verify that the system still functions as expected
3. **Documentation**: Update documentation to reflect the removal of these files
4. **Import Path Updates**: Ensure all import paths have been updated to reflect the new structure before removing files
5. **Communication**: Communicate changes to all developers to ensure everyone is aware of the new structure