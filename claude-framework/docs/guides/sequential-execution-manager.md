# Sequential Execution Manager Guide

The Sequential Execution Manager provides a powerful, unified interface for sequential planning and execution across different domains, integrating with domain-specific planners and executors.

## Overview

The Sequential Execution Manager is a comprehensive tool for planning and executing complex tasks that:

1. **Domain-Specific Planning**: Creates specialized plans for documentation, CI/CD, data processing, and more
2. **Step Dependencies**: Defines dependencies between steps to ensure proper execution order
3. **Execution Monitoring**: Observes execution progress through the observer pattern
4. **Error Handling**: Provides robust error handling with detailed error information
5. **Fallback Mode**: Runs without MCP server dependency for testing and development
6. **Extensible Architecture**: Easily extends with new domain-specific planners and executors

## Architecture

The Sequential Execution Manager is built on a modular architecture that separates concerns and allows for domain-specific implementations:

```
┌─────────────────────────────────────────────┐
│            SequentialExecutionManager        │
└───────────────┬───────────────┬─────────────┘
                │               │
    ┌───────────▼───────┐   ┌───▼───────────┐
    │  Domain Planners  │   │ Domain Executors │
    └───────────────────┘   └─────────────────┘
```

The manager uses:

1. **Domain Planners**: Create specialized execution plans based on domain-specific parameters
2. **Domain Executors**: Execute steps in the plan using domain-specific logic
3. **Observer Pattern**: Notify clients of events during planning and execution
4. **State Management**: Track the state of execution throughout the process

## Implementation Details

The Sequential Execution Manager (`libs/workflows/src/sequential/sequential-execution-manager.ts`) is implemented as a TypeScript class that manages plan generation and execution:

```typescript
class SequentialExecutionManager {
  constructor(domain = 'general', options = {}) {
    // Initialize options
    this.options = {
      fallbackMode: options.fallbackMode || false,
      maxSteps: options.maxSteps || 20,
      stepTimeout: options.stepTimeout || 30000, // 30 seconds
      planningDepth: options.planningDepth || 'medium',
      ...options
    };
    
    // Initialize state
    this.planners = new Map();
    this.executors = new Map();
    this.observers = [];
    this.currentPlan = null;
    this.currentStep = null;
    this.executedSteps = [];
    this.executionResults = {};
    this.isLoading = false;
    this.error = null;
    this.isComplete = false;
    this.domain = domain;
    
    // Register planners and executors
    this._registerPlannersAndExecutors();
  }
  
  // Core methods
  async createPlan(params = {}) { ... }
  async executePlan(options = {}) { ... }
  async executeStep(stepId, options = {}) { ... }
  async skipStep(stepId) { ... }
  
  // Observer management
  addObserver(observer) { ... }
  removeObserver(observer) { ... }
  
  // State management
  reset() { ... }
  getState() { ... }
  
  // Static factory method for domain-specific instances
  static forDomain(domain, options = {}) { ... }
}
```

## Domain-Specific Planning

The Sequential Execution Manager supports domain-specific planning through specialized planners:

### Documentation Generation

```typescript
const manager = SequentialExecutionManager.forDomain('documentation');

// Create a documentation plan with specific parameters
const plan = await manager.createPlan({
  name: 'API Documentation Generation',
  description: 'Generate documentation for the project API',
  patterns: ['**/*.ts'],
  excludePatterns: ['**/*.test.ts'],
  format: 'markdown',
  outputDir: './docs/api',
  extractExamples: true,
  includeApi: true
});
```

### CI/CD Automation

```typescript
const manager = SequentialExecutionManager.forDomain('cicd');

// Create a CI/CD plan with specific parameters
const plan = await manager.createPlan({
  name: 'Deployment Pipeline',
  description: 'Build, test, and deploy the application to staging',
  pipelineType: 'deployment',
  linters: ['eslint'],
  autoFix: true,
  testTypes: ['unit', 'integration'],
  coverage: true,
  environment: 'staging',
  deployStrategy: 'standard',
  notifications: true
});
```

### Data Processing

```typescript
const manager = SequentialExecutionManager.forDomain('data');

// Create a data processing plan with specific parameters
const plan = await manager.createPlan({
  name: 'Data Analysis Workflow',
  description: 'Collect, transform, and analyze customer data',
  workflowType: 'analysis',
  sources: ['database', 'api'],
  formats: ['json', 'csv'],
  transformations: ['normalize', 'aggregate'],
  destination: './data/processed',
  analysisTypes: ['statistical', 'predictive'],
  generateReports: true,
  interactive: true
});
```

## Execution

### Automatic Execution

You can execute an entire plan automatically:

```typescript
// Create a plan
const plan = await manager.createPlan(params);

// Execute the plan
const result = await manager.executePlan();

// Check execution result
if (result.success) {
  console.log('Plan executed successfully');
  console.log(`Executed ${result.executedSteps.length} steps`);
} else {
  console.error('Plan execution failed:', result.error);
}
```

### Step-by-Step Execution

You can execute a plan step by step, with full control over each step:

```typescript
// Create a plan
const plan = await manager.createPlan(params);

// Execute steps one by one
for (const step of plan.steps) {
  // Execute the step
  try {
    const result = await manager.executeStep(step.id);
    console.log(`Step "${step.name}" executed: ${result.success}`);
  } catch (err) {
    console.error(`Step "${step.name}" failed:`, err.message);
    // Option to skip remaining steps or continue
  }
}
```

### Skipping Steps

You can skip steps that you don't want to execute:

```typescript
// Skip a specific step
manager.skipStep(stepId);
```

## Observer Pattern

The Sequential Execution Manager uses the observer pattern to notify clients of events during planning and execution:

```typescript
manager.addObserver((event, data) => {
  switch (event) {
    case 'planStart':
      console.log('Plan creation started');
      break;
    case 'planCreated':
      console.log(`Plan created with ${data.plan.steps.length} steps`);
      break;
    case 'stepExecuteStart':
      console.log(`Executing step: ${data.step.name}`);
      break;
    case 'stepExecuted':
      console.log(`Step completed: ${data.step.name}`);
      break;
    case 'stepSkipped':
      console.log(`Step skipped: ${data.step.name}`);
      break;
    case 'planExecuteComplete':
      console.log('Plan execution completed');
      break;
    case 'planExecuteError':
      console.error('Plan execution failed:', data.error);
      break;
    // Handle other events...
  }
});
```

## Integration with Applications

### CLI Integration

The Sequential Execution Manager is integrated with the CLI through the `sequential-execute` command:

```bash
# Start the interactive planner for a specific domain
npx claude-cli sequential-execute --domain documentation

# Use JSON parameters
npx claude-cli sequential-execute --domain cicd --params '{"pipelineType":"deployment"}'

# Use fallback mode (no MCP)
npx claude-cli sequential-execute --domain data --fallback

# Customize maximum steps
npx claude-cli sequential-execute --steps 15
```

### React Integration Example

The Sequential Execution Manager can be integrated with React components:

```tsx
import { useState } from 'react';
import { SequentialExecutionManager } from '@claude-framework/workflows';

function DocumentationGenerator() {
  const [manager] = useState(() => 
    SequentialExecutionManager.forDomain('documentation')
  );
  const [plan, setPlan] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const handleCreatePlan = async (params) => {
    try {
      setLoading(true);
      setError(null);
      const newPlan = await manager.createPlan(params);
      setPlan(newPlan);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleExecutePlan = async () => {
    try {
      setLoading(true);
      setError(null);
      const executionResult = await manager.executePlan();
      setResult(executionResult);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Render UI for plan creation and execution...
}
```

## Domain-Specific Planners and Executors

The Sequential Execution Manager includes specialized planners and executors for different domains:

### Documentation Domain

**Planner:** Generates plans for documenting code bases with steps like:
1. Analyze codebase structure
2. Extract documentation from code
3. Generate documentation files
4. Validate documentation
5. Generate API documentation (optional)

**Executor:** Executes documentation steps with specialized logic for code analysis, documentation extraction, and generation.

### CI/CD Domain

**Planner:** Generates plans for CI/CD workflows with steps like:
1. Lint code
2. Run tests
3. Build project
4. Deploy project (for deployment pipelines)
5. Verify deployment (for deployment pipelines)
6. Send notifications (optional)

**Executor:** Executes CI/CD steps with specialized logic for testing, building, and deployment.

### Data Domain

**Planner:** Generates plans for data processing with steps like:
1. Collect data
2. Validate data
3. Transform data
4. Analyze data (for analysis workflows)
5. Visualize results (for analysis workflows)
6. Store processed data

**Executor:** Executes data processing steps with specialized logic for data collection, transformation, analysis, and storage.

## Events

The Sequential Execution Manager emits the following events:

- **planStart**: When plan creation starts
- **planCreated**: When a plan is created
- **planError**: When an error occurs during plan creation
- **stepExecuteStart**: When step execution starts
- **stepExecuted**: When a step is executed
- **stepExecuteError**: When an error occurs during step execution
- **stepSkipped**: When a step is skipped
- **stepSkipError**: When an error occurs during step skipping
- **planExecuteStart**: When plan execution starts
- **planExecuteComplete**: When plan execution completes
- **planExecuteError**: When an error occurs during plan execution
- **reset**: When the manager is reset

## API Reference

### Constructor

```typescript
const manager = new SequentialExecutionManager(domain, options);
```

**Parameters:**

- `domain` (string): The domain name ('documentation', 'cicd', 'data', or 'general')
- `options` (Object): Configuration options
  - `fallbackMode` (boolean): Whether to use fallback mode (no MCP)
  - `maxSteps` (number): Maximum number of steps in a plan
  - `stepTimeout` (number): Timeout for step execution in milliseconds
  - `planningDepth` (string): Depth of planning ('shallow', 'medium', 'deep')

### Static Methods

#### `forDomain(domain, options)`

Create a specialized execution manager for a specific domain.

**Parameters:**

- `domain` (string): The domain name ('documentation', 'cicd', 'data', or 'general')
- `options` (Object): Domain-specific options

**Returns:**

A specialized execution manager for the specified domain.

### Instance Methods

#### `createPlan(params)`

Create a plan with domain-specific parameters.

**Parameters:**

- `params` (Object): Domain-specific parameters

**Returns:**

The created plan.

#### `executePlan(options)`

Execute the current plan.

**Parameters:**

- `options` (Object): Execution options
  - `stopOnError` (boolean): Whether to stop execution on error

**Returns:**

The execution result.

#### `executeStep(stepId, options)`

Execute a specific step in the current plan.

**Parameters:**

- `stepId` (string): The ID of the step to execute
- `options` (Object): Execution options

**Returns:**

The execution result.

#### `skipStep(stepId)`

Skip a specific step in the current plan.

**Parameters:**

- `stepId` (string): The ID of the step to skip

**Returns:**

Success (boolean).

#### `addObserver(observer)`

Add an observer for plan execution events.

**Parameters:**

- `observer` (Function): The observer function

#### `removeObserver(observer)`

Remove an observer.

**Parameters:**

- `observer` (Function): The observer function to remove

#### `reset()`

Reset the execution manager state.

#### `getState()`

Get the current state.

**Returns:**

The current state (Object).

## Types

### Plan

```typescript
interface Plan {
  id: string;
  name: string;
  description: string;
  domain: string;
  steps: PlanStep[];
  createdAt: Date;
  status: PlanStatus;
}
```

### PlanStep

```typescript
interface PlanStep {
  id: string;
  name: string;
  description: string;
  status: StepStatus;
  dependsOn?: string[];
  data?: Record<string, any>;
}
```

### ExecutionResult

```typescript
interface ExecutionResult {
  success: boolean;
  stepId: string;
  message?: string;
  error?: string;
  data?: Record<string, any>;
}
```

### PlanExecutionResult

```typescript
interface PlanExecutionResult {
  planId: string;
  domain: string;
  success: boolean;
  executedSteps: PlanStep[];
  results: Record<string, ExecutionResult>;
  error?: string;
  summary?: string;
}
```

## Best Practices

1. **Choose the Right Domain**: Select the appropriate domain for your task to get the most relevant planning.
2. **Provide Detailed Parameters**: The more detailed your parameters, the better the plan will be.
3. **Handle Errors**: Always handle errors that might occur during planning and execution.
4. **Use Observers**: Add observers to monitor execution progress and respond to events.
5. **Step Dependencies**: Respect step dependencies when executing steps manually.
6. **Timeouts**: Set appropriate timeout values to prevent long-running steps.
7. **Fallback Mode**: Use fallback mode for testing and development when MCP services are not available.
8. **Reset When Done**: Reset the execution manager state when done to free resources.

## Example Usage

Here's a complete example of using the Sequential Execution Manager:

```typescript
import { SequentialExecutionManager } from '@claude-framework/workflows';

async function generateDocumentation() {
  // Create a manager for documentation domain
  const manager = SequentialExecutionManager.forDomain('documentation', {
    fallbackMode: true // Use fallback mode for testing
  });
  
  // Add an observer
  manager.addObserver((event, data) => {
    console.log(`Event: ${event}`);
  });
  
  try {
    // Create a plan with specific parameters
    const plan = await manager.createPlan({
      name: 'API Documentation',
      description: 'Generate API documentation for the project',
      patterns: ['**/*.ts'],
      excludePatterns: ['**/*.test.ts'],
      format: 'markdown',
      outputDir: './docs/api',
      extractExamples: true,
      includeApi: true
    });
    
    console.log(`Plan created with ${plan.steps.length} steps`);
    
    // Execute the plan
    const result = await manager.executePlan();
    
    if (result.success) {
      console.log('Documentation generated successfully');
      console.log(`Generated ${result.executedSteps.length} documentation files`);
    } else {
      console.error('Documentation generation failed:', result.error);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}
```

## See Also

- [Sequential Planner Guide](./sequential-planner.md)
- [Documentation Generator Guide](./documentation-generator.md)