# Sequential Execution Manager Integration

This document explains how the Sequential Execution Manager has been integrated into the Claude Framework.

## Overview

The Sequential Execution Manager is a powerful framework component that manages planning and execution for sequential tasks across different domains. It has been implemented in TypeScript within the Claude Framework and integrated with JavaScript proxy modules to maintain backward compatibility.

## Architecture

The integration follows a layered architecture:

1. **Core Implementation**:
   - `claude-framework/libs/workflows/src/sequential/sequential-execution-manager.ts`: The main implementation with core functionality
   - `claude-framework/libs/workflows/src/sequential/types.ts`: TypeScript interfaces and types

2. **Integration Layer**:
   - `claude-framework/libs/workflows/src/sequential/integration/sequential-execution-manager.ts`: Extends the core manager with MCP integration capabilities
   - Provides specialized handlers for Context7, 21st-dev-magic, and other MCP services

3. **Backward Compatibility Layers**:
   - `tools/mcp/integration/sequential_execution_manager.js`: JS proxy for old import paths
   - `src/tools/mcp/integration/sequential_execution_manager.js`: Alternate JS proxy for src directory

## Components

The Sequential Execution Manager consists of the following components:

### 1. Core Components

- **Sequential Execution Manager**: Main class that orchestrates planning and execution
- **Domain-specific Planners**: Specialized planners for documentation, CI/CD, data processing
- **Domain-specific Executors**: Specialized executors that run steps for each domain

### 2. Integration Components

- **MCP Integration**: Integration with Model Context Protocol (MCP) services
- **Context7 Integration**: Handlers for fetching context from documentation
- **21st-dev-magic Integration**: Handlers for UI component generation
- **Sequential Thinking Integration**: Integration with sequential thinking MCP for plan generation

### 3. Services

- **Sequential Planner Service**: Provides planning capabilities through MCP integration

## Usage

### Using the Core Manager

```typescript
import { SequentialExecutionManager } from '@claude-framework/workflows/sequential';

// Create a manager for a specific domain
const manager = SequentialExecutionManager.forDomain('documentation');

// Create a plan
const plan = await manager.createPlan({
  name: 'Generate API Documentation',
  description: 'Generate comprehensive API documentation for the project'
});

// Execute the plan
const result = await manager.executePlan();

console.log(result.summary);
```

### Using the Integration Manager

```typescript
import { SequentialExecutionManager } from '@claude-framework/workflows/sequential/integration';

// Create a manager with MCP integration
const manager = new SequentialExecutionManager('documentation');

// Generate a plan from a high-level goal
const plan = await manager.generatePlanFromGoal(
  'Create comprehensive API documentation with examples and tutorials'
);

// Execute the plan
const result = await manager.runEntirePlan();

console.log(result.summary);
```

### Legacy Usage (Deprecated)

```javascript
// Deprecated: Use the claude-framework imports instead
const SequentialExecutionManager = require('./tools/mcp/integration/sequential_execution_manager');

const manager = new SequentialExecutionManager('documentation');
// ...
```

## Backward Compatibility

The integration maintains backward compatibility through proxy modules that redirect to the TypeScript implementation. These modules emit warnings in development mode to encourage migration to the new imports.

## Domain Support

The Sequential Execution Manager supports the following domains:

1. **Documentation**: Planning and execution for documentation generation
2. **CI/CD**: Continuous integration and deployment workflows
3. **Data Processing**: ETL (Extract, Transform, Load) workflows
4. **General**: Generic sequential planning and execution

Each domain has specialized planners and executors with domain-specific step types and handlers.

## Future Enhancements

Planned enhancements for the Sequential Execution Manager:

1. **Additional Domains**: Adding support for more specialized domains
2. **Enhanced MCP Integration**: Deeper integration with MCP services
3. **Visualization**: Tools for visualizing plans and execution progress
4. **Extensibility**: Plug-in architecture for custom domains and handlers