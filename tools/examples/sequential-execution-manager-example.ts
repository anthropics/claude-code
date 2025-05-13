/**
 * Sequential Execution Manager - TypeScript Integration Example
 * 
 * This example demonstrates how to use the Sequential Execution Manager
 * with TypeScript from the claude-framework with MCP integration.
 */

// Import the Sequential Execution Manager from the framework
import { 
  SequentialExecutionManager,
  Plan,
  PlanExecutionResult,
  ExecutionResult
} from "./../libs/workflows/src/sequential";

// Import the Integration variant if you need MCP integration:
import { 
  SequentialExecutionManager as IntegrationManager 
} from "./../libs/workflows/src/sequential/integration";

/**
 * Example: Creating and executing a documentation plan
 */
async function runDocumentationExample(): Promise<PlanExecutionResult> {
  try {
    console.log('Running Documentation Example...');
    
    // Create a manager for documentation domain
    const manager = SequentialExecutionManager.forDomain('documentation');
    
    // Create a plan for generating API documentation
    const plan = await manager.createPlan({
      name: 'API Documentation Plan',
      description: 'Generate API documentation for the project',
      outputFormat: 'markdown',
      outputDir: './docs/api'
    });
    
    console.log(`Created plan with ${plan.steps.length} steps`);
    
    // Log each step in the plan
    plan.steps.forEach((step, index) => {
      console.log(`Step ${index + 1}: ${step.name || step.description}`);
    });
    
    // Add an observer to track execution events
    manager.addObserver((event, data) => {
      if (event === 'stepExecuted') {
        console.log(`Executed step: ${data.step.name || data.step.description}`);
      }
    });
    
    // Execute the plan
    console.log('\nExecuting plan...');
    const result = await manager.executePlan({
      fallbackMode: true, // Use fallback mode for example purposes
    });
    
    // Display the results
    console.log('\nExecution Results:');
    console.log(`Status: ${result.success ? 'Success' : 'Failed'}`);
    console.log(`Executed Steps: ${result.executedSteps.length}`);
    console.log('\nSummary:');
    console.log(result.summary);
    
    return result;
  } catch (err) {
    console.error('Error running documentation example:', err);
    throw err;
  }
}

/**
 * Example: Using the Integration Manager with MCP
 */
async function runIntegrationExample(): Promise<any> {
  try {
    console.log('\nRunning Integration Example...');
    
    // Create a manager with MCP integration
    const manager = new IntegrationManager('documentation');
    
    // Generate a plan from a high-level goal
    const plan = await manager.generatePlanFromGoal(
      'Create comprehensive API documentation with examples and tutorials'
    );
    
    console.log(`Generated plan with ${plan.steps.length} steps from goal`);
    
    // Log each step in the plan
    plan.steps.forEach((step, index) => {
      console.log(`Step ${index + 1}: ${step.name || step.description}`);
    });
    
    // Execute the plan
    console.log('\nExecuting plan...');
    const result = await manager.runEntirePlan();
    
    // Display the results
    console.log('\nExecution Results:');
    console.log(`Status: ${result.plan.status}`);
    console.log(`Executed Steps: ${result.executedSteps.length}`);
    console.log('\nSummary:');
    console.log(result.summary);
    
    return result;
  } catch (err) {
    console.error('Error running integration example:', err);
    throw err;
  }
}

/**
 * Run all examples
 */
async function runAllExamples(): Promise<void> {
  try {
    await runDocumentationExample();
    await runIntegrationExample();
    
    console.log('\nAll examples completed successfully!');
  } catch (err) {
    console.error('Error running examples:', err);
  }
}

// Export the example functions for use in other modules
export {
  runDocumentationExample,
  runIntegrationExample,
  runAllExamples
};