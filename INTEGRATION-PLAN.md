# Claude Framework Integration Plan

This document outlines the structured plan for integrating and migrating code from the source directories into the Claude framework target structure. It provides a clear mapping of source to target locations and highlights consolidation opportunities.

## Directory Mapping

### Core Components

| Source Directory | Target Directory | Notes |
|-----------------|------------------|-------|
| `/src/core/config` | `/claude-framework/configs/` | Split into modular config files by domain |
| `/src/core/error` | `/claude-framework/libs/core/src/error` | Error handling utilities |
| `/src/core/i18n` | `/claude-framework/libs/core/src/i18n` | Internationalization components |
| `/src/core/logging` | `/claude-framework/libs/core/src/logging` | Logging utilities |
| `/src/core/schemas` | `/claude-framework/libs/core/src/schemas` | Schema definitions |
| `/src/core/security` | `/claude-framework/libs/core/src/security` | Security utilities |
| `/src/core/utils` | `/claude-framework/libs/core/src/utils` | Common utilities |

### MCP Components

| Source Directory | Target Directory | Notes |
|-----------------|------------------|-------|
| `/src/core/mcp` | `/claude-framework/libs/mcp/src` | MCP server implementation |
| `/src/core/mcp/enterprise` | `/claude-framework/libs/mcp/src/enterprise` | Enterprise MCP functionality |
| `/src/core/mcp/fallbacks` | `/claude-framework/libs/mcp/src/fallbacks` | Fallback implementations |
| `/src/core/mcp/routes` | `/claude-framework/libs/mcp/src/routes` | MCP route handlers |
| `/src/hooks/mcp` | `/claude-framework/apps/web/src/hooks/mcp` | MCP React hooks |
| `/tools/mcp` | `/claude-framework/tools/mcp` | MCP tools and utilities |

### Agent Components

| Source Directory | Target Directory | Notes |
|-----------------|------------------|-------|
| `/agents` | `/claude-framework/libs/agents/src` | Agent implementation |
| `/agents/commands` | `/claude-framework/libs/agents/src/commands` | Agent commands |
| `/saar` | `/claude-framework/libs/workflows/src/saar` | SAAR workflow system |
| `/saar/scripts` | `/claude-framework/tools/scripts` | SAAR scripts |
| `/saar/startup` | `/claude-framework/libs/workflows/src/saar/startup` | SAAR startup scripts |

### Web Components

| Source Directory | Target Directory | Notes |
|-----------------|------------------|-------|
| `/src/components` | `/claude-framework/apps/web/src/components` | React components |
| `/src/contexts` | `/claude-framework/apps/web/src/contexts` | React contexts |
| `/src/hooks` | `/claude-framework/apps/web/src/hooks` | React hooks |
| `/src/schema-ui-integration` | `/claude-framework/apps/web/src/schema-ui-integration` | Schema UI integration |

### CLI Components

| Source Directory | Target Directory | Notes |
|-----------------|------------------|-------|
| `/cli` | `/claude-framework/apps/cli/src` | CLI implementation |
| `/cli/commands` | `/claude-framework/apps/cli/src/commands` | CLI commands |

### Documentation

| Source Directory | Target Directory | Notes |
|-----------------|------------------|-------|
| `/ai_docs` | `/claude-framework/docs` | Main documentation |
| `/docs` | `/claude-framework/docs` | Additional documentation |

### Specs and Configuration

| Source Directory | Target Directory | Notes |
|-----------------|------------------|-------|
| `/specs` | `/claude-framework/specs` | Specification files |
| `/specs/migrations` | `/claude-framework/specs/migrations` | Database migrations |
| `/specs/openapi` | `/claude-framework/specs/openapi` | OpenAPI specifications |
| `/specs/schemas` | `/claude-framework/specs/schemas` | JSON schemas |

### Hexagonal Architecture Components

| Source Directory | Target Directory | Notes |
|-----------------|------------------|-------|
| `/src/adapters` | `/claude-framework/apps/api/src/adapters` | Adapters (Hexagonal Architecture) |
| `/src/application` | `/claude-framework/apps/api/src/application` | Application services |
| `/src/domain` | `/claude-framework/apps/api/src/domain` | Domain objects |
| `/src/ports` | `/claude-framework/apps/api/src/ports` | Ports (interfaces) |

### Neural Framework Components

| Source Directory | Target Directory | Notes |
|-----------------|------------------|-------|
| `/src/core/rag` | `/claude-framework/libs/rag/src` | RAG framework |
| `/src/neural` | `/claude-framework/libs/rag/src` | Neural components |

### Tests

| Source Directory | Target Directory | Notes |
|-----------------|------------------|-------|
| `/src/tests/unit` | `/claude-framework/libs/*/test` | Unit tests go alongside their respective packages |
| `/src/tests/integration` | `/claude-framework/libs/*/test` | Integration tests go alongside their modules |
| `/src/tests/e2e` | `/claude-framework/apps/*/test` | E2E tests go with their respective apps |

## Consolidation Opportunities

### 1. Configuration Files
- Consolidate all configuration into the modular `/claude-framework/configs/` directory
- Use TypeScript for type-safe configuration where possible
- Implement a unified configuration loading mechanism

### 2. Documentation
- Consolidate all documentation into `/claude-framework/docs/`
- Maintain consistent structure between guide, API, and architecture documentation
- Remove duplicate documentation files

### 3. MCP Components
- Consolidate all MCP functionality into `/claude-framework/libs/mcp/`
- Remove proxy implementations and use direct imports
- Convert key files to TypeScript for better type safety

### 4. Scripts
- Consolidate all scripts into `/claude-framework/tools/scripts/`
- Ensure consistent naming and documentation
- Convert bash scripts to TypeScript/JavaScript where appropriate for better cross-platform support

## Migration Priority

1. Core utilities and configuration (high priority)
2. MCP implementation (high priority)  
3. SAAR workflow system (medium priority)
4. Agent components (medium priority)
5. Web and UI components (medium priority)
6. Documentation (lower priority)
7. Tests (lower priority)

## Post-Migration Tasks

1. Update all import paths to reflect new structure
2. Ensure TypeScript typings are consistent across the codebase
3. Verify all tests pass in the new structure
4. Update documentation to reflect new structure
5. Clean up any remaining duplicate or obsolete files