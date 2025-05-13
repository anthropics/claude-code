/**
 * Sequential Execution Manager - Integration Example
 * 
 * This example demonstrates how to use the Sequential Execution Manager
 * from the claude-framework with MCP integration.
 */

// Import the Sequential Execution Manager from the framework
const { SequentialExecutionManager } = require('../../claude-framework/libs/workflows/src/sequential');

// For TypeScript users:
// import { SequentialExecutionManager } from '@claude-framework/workflows/sequential';

// Import the Integration variant if you need MCP integration:
// const { SequentialExecutionManager: IntegrationManager } = require('../../claude-framework/libs/workflows/src/sequential/integration');
// For TypeScript users:
// import { SequentialExecutionManager as IntegrationManager } from '@claude-framework/workflows/sequential/integration';

/**
 * Example: Creating and executing a documentation plan
 */
async function runDocumentationExample() {
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
 * Example: Creating and executing a CI/CD plan
 */
async function runCICDExample() {
  try {
    console.log('\nRunning CI/CD Example...');
    
    // Create a manager for CI/CD domain
    const manager = SequentialExecutionManager.forDomain('cicd');
    
    // Create a plan for CI/CD pipeline
    const plan = await manager.createPlan({
      name: 'CI/CD Pipeline Plan',
      description: 'Run CI/CD pipeline for the project',
      branch: 'main',
      environment: 'staging'
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
    console.error('Error running CI/CD example:', err);
    throw err;
  }
}

/**
 * Example: Creating and executing a data processing plan
 */
async function runDataExample() {
  try {
    console.log('\nRunning Data Processing Example...');
    
    // Create a manager for data domain
    const manager = SequentialExecutionManager.forDomain('data');
    
    // Create a plan for data processing
    const plan = await manager.createPlan({
      name: 'Data Processing Plan',
      description: 'Process and transform data from source to destination',
      sourceFormat: 'csv',
      destinationFormat: 'json',
      transformations: ['normalize', 'deduplicate', 'aggregate']
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
    console.error('Error running data processing example:', err);
    throw err;
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    await runDocumentationExample();
    await runCICDExample();
    await runDataExample();
    
    console.log('\nAll examples completed successfully!');
  } catch (err) {
    console.error('Error running examples:', err);
  }
}

// Run the examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}

// Export the example functions for use in other modules
module.exports = {
  runDocumentationExample,
  runCICDExample,
  runDataExample,
  runAllExamples
};