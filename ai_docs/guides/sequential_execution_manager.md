# Sequential Execution Manager Guide

The Sequential Execution Manager provides a powerful, unified interface for sequential planning and execution across different domains, integrating Context7, sequential thinking, and 21st-dev-magic MCP tools.

## Overview

The Sequential Execution Manager is an advanced evolution of the Sequential Planner that adds:

1. **Domain-Specific Planning**: Specialized planning and execution for different domains
2. **Step Handlers**: Custom handlers for different types of actions
3. **Observer Pattern**: Real-time notifications of planning and execution events
4. **Event-Driven Execution**: Event-based workflow for better control and integration
5. **Error Handling**: Robust error handling and recovery
6. **State Management**: Complete state tracking throughout the execution process

## Architecture

The Sequential Execution Manager is built on top of the Sequential Planner and provides a higher-level interface for managing complex planning and execution scenarios:

```
┌─────────────────┐       ┌───────────────────┐       ┌──────────────────┐
│   Client        │       │  Sequential       │       │ Sequential       │
│   Application   │──────▶│  Execution Mgr    │──────▶│ Planner          │
│                 │       │                   │       │                  │
└─────────────────┘       └───────────────────┘       └──────────────────┘
                                    │                          │
                                    ▼                          ▼
                          ┌───────────────────┐       ┌──────────────────┐
                          │  Step Handlers    │       │ MCP Tools        │
                          │  & Observers      │──────▶│                  │
                          └───────────────────┘       └──────────────────┘
```

## Implementation Details

The Sequential Execution Manager (`tools/mcp/integration/sequential_execution_manager.js`) is implemented as a JavaScript class that manages plan generation and execution:

```javascript
class SequentialExecutionManager {
  constructor(options = {}) {
    // Initialize options
    this.options = {
      fallbackMode: options.fallbackMode || false,
      maxSteps: options.maxSteps || 20,
      stepTimeout: options.stepTimeout || 30000, // 30 seconds
      planningDepth: options.planningDepth || 'medium',
      ...options
    };
    
    // Initialize state
    this.handlers = new Map();
    this.observers = [];
    this.currentPlan = null;
    this.currentStep = null;
    this.executedSteps = [];
    this.isLoading = false;
    this.error = null;
    this.isComplete = false;
    this.currentGoal = null;
    this.executionResult = null;
    
    // Register standard handlers
    this._registerStandardHandlers();
  }
  
  // Core methods
  async generatePlan(goal, options = {}) { ... }
  async continuePlan() { ... }
  async executeCurrentStep(options = {}) { ... }
  async skipCurrentStep() { ... }
  async reviseStep(stepId, revision) { ... }
  async generateSummary() { ... }
  async runEntirePlan(stepCallback, options = {}) { ... }
  
  // Handler and observer management
  registerHandler(actionType, handler) { ... }
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

The Sequential Execution Manager supports domain-specific planning and execution through specialized configurations:

### Documentation Generation

```javascript
const manager = SequentialExecutionManager.forDomain('documentation', {
  fallbackMode: false,
  maxSteps: 20,
  planningDepth: 'deep'
});

await manager.generatePlan('Generate documentation for src/components/MyComponent.jsx in markdown format');
```

### CI/CD Automation

```javascript
const manager = SequentialExecutionManager.forDomain('cicd', {
  fallbackMode: false,
  maxSteps: 15,
  planningDepth: 'medium'
});

await manager.generatePlan('Build and deploy my-app to staging environment. Include tests.');
```

### Data Processing

```javascript
const manager = SequentialExecutionManager.forDomain('data', {
  fallbackMode: false,
  maxSteps: 10,
  planningDepth: 'medium'
});

await manager.generatePlan('Perform ETL operation from MySQL database to data warehouse.');
```

## Features

### Step Handlers

Step handlers are functions that execute specific types of actions. You can register custom handlers for different action types:

```javascript
manager.registerHandler('custom_action', async (step, options) => {
  // Execute custom action
  return {
    type: 'custom_action',
    data: { /* result data */ },
    summary: 'Custom action executed'
  };
});
```

The Sequential Execution Manager includes built-in handlers for:

1. **Context Steps**: Using Context7 to gather information
2. **UI Steps**: Using 21st-dev/magic to generate UI components
3. **Manual Steps**: For user-guided execution
4. **Executable Steps**: For programmatic execution

### Observer Pattern

The Sequential Execution Manager uses the observer pattern to notify clients of events during planning and execution:

```javascript
manager.addObserver((event, data) => {
  switch (event) {
    case 'planStart':
      console.log('Plan generation started');
      break;
    case 'stepExecuted':
      console.log(`Step ${data.step.number} executed: ${data.result.summary}`);
      break;
    case 'planComplete':
      console.log('Plan execution completed');
      break;
    // Handle other events...
  }
});
```

### Step-by-Step Execution

You can execute a plan step by step, with full control over each step:

```javascript
await manager.generatePlan('Generate documentation for src/components/MyComponent.jsx');

// Execute current step
await manager.executeCurrentStep();

// Skip a step
await manager.skipCurrentStep();

// Revise a step
await manager.reviseStep('step-2', 'Updated step description');

// Generate summary
const summary = await manager.generateSummary();
```

### Automatic Execution

You can execute an entire plan automatically:

```javascript
await manager.generatePlan('Generate documentation for src/components/MyComponent.jsx');

// Execute entire plan
const result = await manager.runEntirePlan((step) => {
  console.log(`Executing step ${step.number}`);
  return undefined; // Let the manager execute the step
});
```

## Integration with Applications

### Documentation Generator

The Sequential Execution Manager is used to implement the Documentation Generator (`tools/documentation/sequential_doc_generator.js`), which generates comprehensive documentation for code files:

```javascript
const sequentialPlanner = require('../mcp/sequential_planner');

async function generateDocumentation(options) {
  // Create goal for sequential planner
  const goal = `Generate comprehensive documentation for ${options.path} in ${options.format} format`;

  // Run the sequential planner
  const result = await sequentialPlanner.runPlanningCycle(goal, async ({ step }) => {
    // Custom handling for different steps...
  });

  return {
    success: true,
    output: options.output,
    summary: result.summary,
    executedSteps: result.executedSteps
  };
}
```

### React Integration

The Sequential Execution Manager can be integrated with React components through custom hooks like `useMcpSequentialPlanner`:

```jsx
function McpDocumentationGenerator() {
  const [path, setPath] = useState('');
  const [format, setFormat] = useState('markdown');
  
  const {
    plan,
    currentStep,
    executedSteps,
    isLoading,
    error,
    isComplete,
    generatePlan,
    executeCurrentStep,
    skipCurrentStep,
    generateSummary,
    resetPlanner
  } = useMcpSequentialPlanner();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const goal = `Generate comprehensive documentation for ${path} in ${format} format`;
    await generatePlan(goal);
  };
  
  // Rendering UI for plan execution...
}
```

## Command-Line Interface

The Sequential Execution Manager is available through the command-line interface:

```bash
# Start the interactive planner for a specific domain
node cli/commands/sequential-execute.js --domain=documentation

# Specify a goal
node cli/commands/sequential-execute.js --domain=cicd --goal="Build and deploy my-app to staging"

# Use fallback mode (no MCP)
node cli/commands/sequential-execute.js --domain=data --fallback

# Customize planning
node cli/commands/sequential-execute.js --steps=15 --depth=deep
```

## Events

The Sequential Execution Manager emits the following events:

- **planStart**: When plan generation starts
- **planGenerated**: When a plan is generated
- **planError**: When an error occurs during plan generation
- **planContinueStart**: When plan continuation starts
- **planContinued**: When a plan is continued
- **planContinueError**: When an error occurs during plan continuation
- **stepExecuteStart**: When step execution starts
- **stepExecuted**: When a step is executed
- **stepExecuteError**: When an error occurs during step execution
- **stepSkipStart**: When step skipping starts
- **stepSkipped**: When a step is skipped
- **stepSkipError**: When an error occurs during step skipping
- **stepReviseStart**: When step revision starts
- **stepRevised**: When a step is revised
- **stepReviseError**: When an error occurs during step revision
- **summaryStart**: When summary generation starts
- **summaryGenerated**: When a summary is generated
- **summaryError**: When an error occurs during summary generation
- **planExecuteStart**: When plan execution starts
- **planExecuteComplete**: When plan execution completes
- **planExecuteError**: When an error occurs during plan execution
- **planComplete**: When a plan is complete
- **reset**: When the manager is reset

## API Reference

### Constructor

```javascript
const manager = new SequentialExecutionManager(options);
```

**Options:**

- `fallbackMode` (boolean): Whether to use fallback mode (no MCP)
- `maxSteps` (number): Maximum number of steps in a plan
- `stepTimeout` (number): Timeout for step execution in milliseconds
- `planningDepth` (string): Depth of planning ('shallow', 'medium', 'deep')

### Static Methods

#### `forDomain(domain, options)`

Create a specialized execution manager for a specific domain.

**Parameters:**

- `domain` (string): The domain name ('documentation', 'cicd', 'data', or 'custom')
- `options` (Object): Domain-specific options

**Returns:**

A specialized execution manager for the specified domain.

### Instance Methods

#### `registerHandler(actionType, handler)`

Register a step handler for a specific action type.

**Parameters:**

- `actionType` (string): The action type to handle
- `handler` (Function): The handler function

#### `addObserver(observer)`

Add an observer for plan execution events.

**Parameters:**

- `observer` (Function): The observer function

#### `removeObserver(observer)`

Remove an observer.

**Parameters:**

- `observer` (Function): The observer function to remove

#### `generatePlan(goal, options)`

Generate a plan for a goal.

**Parameters:**

- `goal` (string): The goal to plan for
- `options` (Object): Planning options
  - `initialSteps` (number): Initial number of steps to generate
  - `maxSteps` (number): Maximum number of steps
  - `depth` (string): Planning depth ('shallow', 'medium', 'deep')

**Returns:**

The generated plan.

#### `continuePlan()`

Continue the plan by adding more steps.

**Returns:**

The updated plan.

#### `executeCurrentStep(options)`

Execute the current step.

**Parameters:**

- `options` (Object): Execution options

**Returns:**

The execution result.

#### `skipCurrentStep()`

Skip the current step.

**Returns:**

Success (boolean).

#### `reviseStep(stepId, revision)`

Revise a step in the plan.

**Parameters:**

- `stepId` (string): The ID of the step to revise
- `revision` (string): The revised step description

**Returns:**

Success (boolean).

#### `generateSummary()`

Generate a summary of the executed plan.

**Returns:**

The summary (string).

#### `runEntirePlan(stepCallback, options)`

Run the entire plan execution.

**Parameters:**

- `stepCallback` (Function): Optional callback for each step
- `options` (Object): Execution options

**Returns:**

The execution result.

#### `reset()`

Reset the execution manager state.

#### `getState()`

Get the current state.

**Returns:**

The current state (Object).

## Integration Examples

### Documentation Generation

```javascript
const manager = SequentialExecutionManager.forDomain('documentation');

await manager.generatePlan('Generate documentation for src/components/MyComponent.jsx in markdown format');

manager.addObserver((event, data) => {
  if (event === 'stepExecuted' && data.step.actionType === 'documentation') {
    console.log(`Documentation generated: ${data.result.data.path}`);
  }
});

const result = await manager.runEntirePlan();
console.log(`Documentation generated at: ${result.executedSteps.find(s => s.actionType === 'documentation').result.data.path}`);
```

### CI/CD Automation

```javascript
const manager = SequentialExecutionManager.forDomain('cicd');

await manager.generatePlan('Build and deploy my-app to staging environment. Include tests.');

manager.addObserver((event, data) => {
  if (event === 'stepExecuted' && data.step.actionType === 'deploy') {
    console.log(`Deployed to: ${data.result.data.url}`);
  }
});

const result = await manager.runEntirePlan();
console.log(`Deployment completed: ${result.summary}`);
```

### Data Processing

```javascript
const manager = SequentialExecutionManager.forDomain('data');

await manager.generatePlan('Perform ETL operation from MySQL database to data warehouse.');

manager.addObserver((event, data) => {
  if (event === 'stepExecuted' && data.step.actionType === 'load') {
    console.log(`Loaded ${data.result.data.records} records to ${data.result.data.destination}`);
  }
});

const result = await manager.runEntirePlan();
console.log(`ETL operation completed: ${result.summary}`);
```

## Command-Line Interface

The Sequential Execution Manager provides a command-line interface through the `sequential-execute.js` command:

```bash
node cli/commands/sequential-execute.js --help
```

This command provides an interactive interface for:

1. Selecting a domain (documentation, CI/CD, data, or custom)
2. Entering a goal or customizing domain-specific parameters
3. Generating a plan
4. Executing the plan step by step or automatically
5. Saving the plan to a file

## Best Practices

1. **Use Domain-Specific Planning**: Use the `forDomain` method to create a specialized execution manager for your domain.
2. **Register Custom Handlers**: Register custom handlers for domain-specific action types.
3. **Add Observers**: Add observers to track planning and execution events.
4. **Handle Errors**: Use try-catch blocks to handle errors during planning and execution.
5. **Provide Timeout**: Set appropriate timeout values for step execution to prevent long-running steps.
6. **Use Fallback Mode**: Use fallback mode when MCP services are not available.
7. **Monitor State**: Use the `getState` method to monitor the current state of the execution manager.
8. **Reset When Done**: Use the `reset` method to reset the execution manager when done.

## See Also

- [Sequential Planner Guide](./sequential_planner.md)
- [Documentation Generator Guide](./documentation_generator.md)