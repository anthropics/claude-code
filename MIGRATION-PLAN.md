# Component Migration Plan

This document provides a detailed migration plan for each component in the Claude Framework. It outlines specific steps, dependencies, and considerations for migrating each component from its source location to the target structure.

## Core Components Migration

### 1. Configuration Files

**Source:** `/src/core/config/`  
**Target:** `/claude-framework/configs/`

**Steps:**
1. Identify all configuration files in source location
2. Group configuration files by domain (API, MCP, RAG, etc.)
3. Create dedicated subdirectories in target location for each domain
4. Consolidate duplicate or overlapping configurations
5. Convert JSON configurations to TypeScript where appropriate
6. Update references to configuration files throughout the codebase

**Dependencies:**
- Configuration loader utilities must be migrated first
- Schema loader utilities may need to be migrated simultaneously

**Special Considerations:**
- Ensure backward compatibility for existing configuration imports
- Preserve environment-specific configurations
- Document the new configuration structure

### 2. Error Handling

**Source:** `/src/core/error/`  
**Target:** `/claude-framework/libs/core/src/error/`

**Steps:**
1. Migrate error handler implementation
2. Migrate error types and classes
3. Update import paths in dependent files
4. Ensure consistent error handling patterns

**Dependencies:**
- Logging functionality may be required

**Special Considerations:**
- Maintain consistent error codes and messages
- Ensure error handling is framework-agnostic

### 3. Internationalization (i18n)

**Source:** `/src/core/i18n/`  
**Target:** `/claude-framework/libs/core/src/i18n/`

**Steps:**
1. Migrate i18n utilities and helpers
2. Migrate locale files and translations
3. Update import paths in dependent files
4. Ensure all strings are properly internationalized

**Dependencies:**
- Configuration loading for i18n settings

**Special Considerations:**
- Support for multiple languages and locale formats
- Handle locale file loading efficiently

### 4. Logging

**Source:** `/src/core/logging/`  
**Target:** `/claude-framework/libs/core/src/logging/`

**Steps:**
1. Migrate logger implementation
2. Update log level configuration
3. Migrate log formatting utilities
4. Update import paths in dependent files

**Dependencies:**
- Configuration for log levels and output targets

**Special Considerations:**
- Support different logging environments (development, production)
- Ensure consistent logging patterns

### 5. Schemas

**Source:** `/src/core/schemas/`  
**Target:** `/claude-framework/libs/core/src/schemas/`

**Steps:**
1. Migrate schema definitions
2. Migrate schema validation utilities
3. Update import paths in dependent files
4. Ensure schemas are properly documented

**Dependencies:**
- Schema loader utilities

**Special Considerations:**
- Maintain backward compatibility for existing schema versions
- Ensure consistent schema validation patterns

### 6. Security

**Source:** `/src/core/security/`  
**Target:** `/claude-framework/libs/core/src/security/`

**Steps:**
1. Migrate security utilities and helpers
2. Migrate authentication and authorization mechanisms
3. Update import paths in dependent files
4. Ensure security best practices are followed

**Dependencies:**
- Configuration for security settings

**Special Considerations:**
- Handle sensitive data securely
- Ensure proper input validation and sanitization

## MCP Components Migration

### 1. MCP Server

**Source:** `/src/core/mcp/`  
**Target:** `/claude-framework/libs/mcp/src/`

**Steps:**
1. Migrate MCP server implementation
2. Migrate MCP client implementations
3. Migrate MCP API endpoints
4. Migrate MCP utility functions
5. Update import paths in dependent files

**Dependencies:**
- Core utilities must be migrated first
- Configuration for MCP servers

**Special Considerations:**
- Maintain backward compatibility for existing MCP clients
- Ensure consistent API patterns
- Handle multiple MCP server types

### 2. MCP Routes

**Source:** `/src/core/mcp/routes/`  
**Target:** `/claude-framework/libs/mcp/src/routes/`

**Steps:**
1. Migrate route handlers
2. Migrate route middleware
3. Update import paths in dependent files
4. Ensure consistent routing patterns

**Dependencies:**
- MCP server implementation

**Special Considerations:**
- Handle route versioning
- Ensure proper input validation
- Eliminate duplicate implementations (e.g., proxies)

### 3. MCP Hooks

**Source:** `/src/hooks/mcp/`  
**Target:** `/claude-framework/apps/web/src/hooks/mcp/`

**Steps:**
1. Migrate MCP React hooks
2. Update hook dependencies
3. Test hooks with UI components
4. Update import paths in dependent files

**Dependencies:**
- MCP client implementation

**Special Considerations:**
- Ensure hooks follow React best practices
- Handle loading and error states consistently

## Agent Components Migration

### 1. Agent Framework

**Source:** `/agents/`  
**Target:** `/claude-framework/libs/agents/src/`

**Steps:**
1. Migrate agent base classes
2. Migrate agent utility functions
3. Migrate agent communication framework
4. Update import paths in dependent files

**Dependencies:**
- Core utilities must be migrated first

**Special Considerations:**
- Maintain agent-to-agent communication protocols
- Ensure consistent agent patterns

### 2. Agent Commands

**Source:** `/agents/commands/`  
**Target:** `/claude-framework/libs/agents/src/commands/`

**Steps:**
1. Migrate command implementations
2. Migrate command utilities
3. Update import paths in dependent files
4. Ensure commands are properly documented

**Dependencies:**
- Agent framework implementation

**Special Considerations:**
- Maintain backward compatibility for existing command formats
- Ensure consistent command patterns

### 3. SAAR Workflow System

**Source:** `/saar/`  
**Target:** `/claude-framework/libs/workflows/src/saar/`

**Steps:**
1. Migrate SAAR core implementation
2. Migrate SAAR utilities and helpers
3. Migrate SAAR configuration
4. Update import paths in dependent files

**Dependencies:**
- Core utilities must be migrated first
- Agent framework may be required

**Special Considerations:**
- Maintain workflow compatibility
- Ensure consistent workflow patterns
- Preserve startup sequence logic

## Web Components Migration

### 1. React Components

**Source:** `/src/components/`  
**Target:** `/claude-framework/apps/web/src/components/`

**Steps:**
1. Identify component dependencies
2. Group components by domain
3. Migrate components in dependency order
4. Update import paths in dependent files
5. Test components in new location

**Dependencies:**
- MCP hooks may be required
- Context providers may be required

**Special Considerations:**
- Ensure consistent styling patterns
- Maintain component API compatibility
- Test complex component interactions

### 2. React Contexts

**Source:** `/src/contexts/`  
**Target:** `/claude-framework/apps/web/src/contexts/`

**Steps:**
1. Migrate context implementations
2. Migrate context providers
3. Update import paths in dependent components
4. Test context functionality in new location

**Dependencies:**
- None

**Special Considerations:**
- Ensure consistent context patterns
- Maintain context API compatibility
- Avoid unnecessary re-renders

### 3. Schema UI Integration

**Source:** `/src/schema-ui-integration/`  
**Target:** `/claude-framework/apps/web/src/schema-ui-integration/`

**Steps:**
1. Migrate schema UI components
2. Migrate schema utilities and helpers
3. Update import paths in dependent files
4. Test schema UI functionality in new location

**Dependencies:**
- Schema definitions must be migrated first
- Core UI components may be required

**Special Considerations:**
- Ensure consistent form handling
- Maintain schema compatibility
- Support custom form layouts

## CLI Components Migration

### 1. CLI Implementation

**Source:** `/cli/`  
**Target:** `/claude-framework/apps/cli/src/`

**Steps:**
1. Migrate CLI core implementation
2. Migrate CLI utilities and helpers
3. Update import paths in dependent files
4. Test CLI functionality in new location

**Dependencies:**
- Core utilities must be migrated first

**Special Considerations:**
- Maintain command-line interface compatibility
- Ensure consistent CLI patterns
- Test cross-platform compatibility

### 2. CLI Commands

**Source:** `/cli/commands/`  
**Target:** `/claude-framework/apps/cli/src/commands/`

**Steps:**
1. Migrate command implementations
2. Group commands by domain
3. Update import paths in dependent files
4. Test command functionality in new location

**Dependencies:**
- CLI implementation must be migrated first

**Special Considerations:**
- Maintain command-line interface compatibility
- Ensure consistent command patterns
- Document command options and arguments

## RAG Components Migration

### 1. RAG Framework

**Source:** `/src/core/rag/`  
**Target:** `/claude-framework/libs/rag/src/`

**Steps:**
1. Migrate RAG core implementation
2. Migrate RAG utilities and helpers
3. Migrate embeddings and vector store integration
4. Update import paths in dependent files

**Dependencies:**
- Core utilities must be migrated first

**Special Considerations:**
- Handle database connections carefully
- Ensure consistent RAG patterns
- Support multiple vector store backends

### 2. Neural Components

**Source:** `/src/neural/`  
**Target:** `/claude-framework/libs/rag/src/`

**Steps:**
1. Migrate neural models and providers
2. Migrate embedding services
3. Migrate text chunking utilities
4. Update import paths in dependent files

**Dependencies:**
- RAG framework may be required

**Special Considerations:**
- Handle model loading efficiently
- Support multiple embedding models
- Ensure consistent neural patterns

## Documentation Migration

### 1. Main Documentation

**Source:** `/ai_docs/`  
**Target:** `/claude-framework/docs/`

**Steps:**
1. Identify documentation categories
2. Group documentation by domain
3. Eliminate duplicate documentation
4. Update documentation references

**Dependencies:**
- None

**Special Considerations:**
- Maintain consistent documentation structure
- Update references to code paths
- Ensure documentation accuracy post-migration

### 2. Additional Documentation

**Source:** `/docs/`  
**Target:** `/claude-framework/docs/`

**Steps:**
1. Merge with main documentation
2. Eliminate duplicate documentation
3. Update documentation references

**Dependencies:**
- Main documentation must be migrated first

**Special Considerations:**
- Resolve conflicts with main documentation
- Maintain consistent documentation structure
- Update references to code paths

## Testing Migration

### 1. Unit Tests

**Source:** `/src/tests/unit/`  
**Target:** `/claude-framework/libs/*/test/`

**Steps:**
1. Migrate tests alongside their implementation
2. Update import paths in test files
3. Ensure tests pass in new location
4. Add missing tests for new functionality

**Dependencies:**
- Implementation code must be migrated first

**Special Considerations:**
- Maintain consistent testing patterns
- Ensure good test coverage
- Group tests logically by component

### 2. Integration Tests

**Source:** `/src/tests/integration/`  
**Target:** `/claude-framework/libs/*/test/`

**Steps:**
1. Migrate tests alongside their implementation
2. Update import paths in test files
3. Ensure tests pass in new location
4. Add missing tests for new functionality

**Dependencies:**
- Implementation code must be migrated first
- Unit tests should be migrated first

**Special Considerations:**
- Handle test fixtures and setup
- Ensure tests are not overly coupled to implementation
- Group tests logically by component

### 3. End-to-End Tests

**Source:** `/src/tests/e2e/`  
**Target:** `/claude-framework/apps/*/test/`

**Steps:**
1. Migrate tests alongside their application
2. Update import paths in test files
3. Ensure tests pass in new location
4. Add missing tests for new functionality

**Dependencies:**
- Application code must be migrated first
- Integration tests should be migrated first

**Special Considerations:**
- Handle test fixtures and setup
- Ensure tests are not brittle
- Group tests logically by application

## Post-Migration Tasks

### 1. Update Import Paths

**Steps:**
1. Identify all import statements in the codebase
2. Update import paths to reflect new structure
3. Ensure circular dependencies are resolved
4. Test functionality after import path updates

### 2. TypeScript Migration

**Steps:**
1. Identify key JavaScript files for conversion
2. Add TypeScript type definitions
3. Convert files to TypeScript
4. Update import paths to reflect new file extensions
5. Ensure TypeScript compiler is satisfied

### 3. Clean Up Redundant Files

**Steps:**
1. Identify files that have been migrated
2. Remove redundant files from source directories
3. Ensure no functionality is lost
4. Update references to removed files

### 4. Documentation Update

**Steps:**
1. Update documentation to reflect new structure
2. Add migration guide for users
3. Update API documentation
4. Ensure documentation accuracy

### 5. Testing

**Steps:**
1. Run all tests in new structure
2. Fix any failing tests
3. Add missing tests for new functionality
4. Ensure good test coverage

## Migration Timeline

1. **Week 1**: Core utilities and configuration
2. **Week 1-2**: MCP implementation
3. **Week 2**: SAAR workflow system
4. **Week 2-3**: Agent components
5. **Week 3**: Web and CLI components
6. **Week 3-4**: Documentation and tests
7. **Week 4**: Post-migration tasks and cleanup