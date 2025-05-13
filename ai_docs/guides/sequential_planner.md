# Sequential Planner Guide

The Sequential Planner is a powerful feature that integrates Multiple MCP tools (Sequential Thinking, Context7, and 21st-dev-magic) to provide a comprehensive planning and execution system.

## Overview

The Sequential Planner allows you to:

1. Generate step-by-step plans for complex goals
2. Execute steps automatically or manually
3. Incorporate context lookups and UI component generation
4. Monitor and track execution progress
5. Generate summaries of executed plans

## Architecture

The Sequential Planner combines three key MCP tools:

1. **Sequential Thinking**: Generates step-by-step plans and reasoning
2. **Context7**: Provides document and knowledge retrieval
3. **21st-dev-magic**: Generates UI components based on specifications

The architecture follows this pattern:

```
┌─────────────────┐       ┌───────────────────┐       ┌──────────────────┐
│   User          │       │  Sequential       │       │ Individual       │
│   Interface     │──────▶│  Planner Hook     │──────▶│ MCP Hooks        │
│                 │       │                   │       │                  │
└─────────────────┘       └───────────────────┘       └──────────────────┘
                                                                │
                                                                │
                                                                ▼
                                                      ┌──────────────────┐
                                                      │ API Layer        │
                                                      │ /api/mcp/...     │
                                                      └──────────────────┘
                                                                │
                                                                │
                                                                ▼
                                                      ┌──────────────────┐
                                                      │ MCP Services     │
                                                      │                  │
                                                      └──────────────────┘
```

## Components

### Sequential Planner Hook

The `useMcpSequentialPlanner` hook provides a React interface for generating and executing plans:

```jsx
import { useMcpSequentialPlanner } from '../hooks/mcp';

function MyComponent() {
  const {
    plan,
    currentStep,
    executedSteps,
    isLoading,
    error,
    isComplete,
    generatePlan,
    continuePlanning,
    reviseStep,
    executeCurrentStep,
    skipCurrentStep,
    generateSummary,
    resetPlanner
  } = useMcpSequentialPlanner();
  
  // Use the planner...
}
```

### API Routes

The following API routes are available:

- `/api/mcp/sequential-planner/generate`: Generate a plan
- `/api/mcp/sequential-planner/continue`: Continue a plan
- `/api/mcp/sequential-planner/execute/context`: Execute a context step
- `/api/mcp/sequential-planner/execute/ui`: Execute a UI step
- `/api/mcp/sequential-planner/summary`: Generate a summary

### Utility Module

The `tools/mcp/sequential_planner.js` module provides utility functions for working with the planner:

```javascript
const sequentialPlanner = require('./tools/mcp/sequential_planner');

// Generate a plan
const plan = await sequentialPlanner.generatePlan('Create a user registration form');

// Execute a step
const result = await sequentialPlanner.executeStep(plan[0]);

// Run a complete planning cycle
const executionResult = await sequentialPlanner.runPlanningCycle(
  'Create a user registration form',
  ({ step, plan, executedSteps, isLastStep }) => {
    // Step callback
    console.log(`Executing step ${step.number}`);
    return undefined; // Let the planner execute the step
  }
);
```

### CLI Command

The Sequential Planner can be used from the command line:

```bash
# Start the interactive planner
node cli/commands/sequential-planner.js

# Specify a goal
node cli/commands/sequential-planner.js --goal "Create a user registration form"

# Customize the plan
node cli/commands/sequential-planner.js --goal "Create a user registration form" --steps 7 --depth deep
```

## Using the Sequential Planner

### Generating a Plan

```jsx
// Generate a plan
const plan = await generatePlan('Create a user registration form');
```

### Executing Steps

```jsx
// Execute the current step
const result = await executeCurrentStep();

// For manual steps, provide a result
const result = await executeCurrentStep({
  result: { message: 'I completed this step manually' },
  summary: 'Step executed manually'
});

// For context steps, provide a search term
const result = await executeCurrentStep({
  searchTerm: 'user registration best practices'
});

// For UI steps, provide a component specification
const result = await executeCurrentStep({
  componentSpec: {
    type: 'form',
    description: 'User registration form with name, email, and password fields'
  }
});
```

### Revising and Skipping Steps

```jsx
// Revise a step
const success = await reviseStep('step-2', 'Revised description of the step');

// Skip the current step
const success = skipCurrentStep();
```

### Generating Summaries

```jsx
// Generate a summary of executed steps
const summary = await generateSummary();
```

## Step Types

The Sequential Planner supports different types of steps:

- **Context Steps**: Steps that involve information lookup or document retrieval
- **UI Steps**: Steps that involve generating UI components
- **Executable Steps**: Steps that can be executed automatically
- **Manual Steps**: Steps that require manual execution

## Demo Component

The `McpSequentialPlannerDemo` component provides a user interface for interacting with the Sequential Planner:

```jsx
import McpSequentialPlannerDemo from './components/mcp/McpSequentialPlannerDemo';

function App() {
  return (
    <div>
      <McpSequentialPlannerDemo />
    </div>
  );
}
```

## Fallback Mode

The Sequential Planner includes a fallback implementation for when MCP services are not available. This ensures that planning and execution can still proceed, albeit with limited functionality.

To check if the API server is available:

```javascript
const isAvailable = await sequentialPlanner.checkApiServer();
```

## Best Practices

1. **Be Specific with Goals**: Provide clear, specific goals to generate better plans
2. **Use Context Steps Wisely**: Context steps help gather information before making decisions
3. **Review and Revise**: Always review generated plans and revise steps as needed
4. **Track Progress**: Use the executedSteps array to track progress
5. **Handle Errors**: Always check for errors during execution

## CLI Usage Examples

### Basic Usage

```bash
node cli/commands/sequential-planner.js
```

This starts an interactive session that prompts for a goal and guides you through the planning and execution process.

### Specify a Goal

```bash
node cli/commands/sequential-planner.js --goal "Create a user registration form with validation"
```

### Customize Plan Depth

```bash
node cli/commands/sequential-planner.js --goal "Design a database schema" --depth deep
```

### Set Initial Steps

```bash
node cli/commands/sequential-planner.js --goal "Implement API authentication" --steps 8
```

## Integration with Other Systems

The Sequential Planner can be integrated with other systems through the API routes or the utility module. For example, you could integrate it with a CI/CD pipeline to automate certain planning and execution steps.

### Documentation Generator

The Documentation Generator is an example of how the Sequential Planner can be integrated with other systems. It uses the Sequential Planner to generate comprehensive documentation for code files and directories.

See the [Documentation Generator Guide](./documentation_generator.md) for more information.