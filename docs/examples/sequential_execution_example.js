#!/usr/bin/env node

/**
 * Sequential Execution Manager Example
 * 
 * This example demonstrates how to use the Sequential Execution Manager
 * for a simple documentation generation task.
 */

const path = require('path');
const chalk = require('chalk');
const SequentialExecutionManager = require('../../tools/mcp/integration/sequential_execution_manager');

async function runExample() {
  console.log(chalk.bold.blue('🚀 Sequential Execution Manager Example'));
  console.log(chalk.gray('Demonstrating a simple execution flow'));
  console.log();
  
  // Create an execution manager for documentation
  const manager = SequentialExecutionManager.forDomain('documentation', {
    fallbackMode: true, // Use fallback mode to avoid MCP server dependency
    maxSteps: 5,
    planningDepth: 'medium'
  });
  
  // Add an observer to monitor events
  manager.addObserver((event, data) => {
    switch (event) {
      case 'planStart':
        console.log(chalk.cyan('🔍 Generating plan...'));
        break;
      case 'planGenerated':
        console.log(chalk.green(`✅ Plan generated with ${data.plan.length} steps`));
        break;
      case 'stepExecuteStart':
        console.log(chalk.cyan(`⏳ Executing step ${data.step.number}: ${data.step.description}`));
        break;
      case 'stepExecuted':
        console.log(chalk.green(`✅ Step ${data.step.number} completed: ${data.result.summary}`));
        break;
      case 'planComplete':
        console.log(chalk.green.bold('🎉 Execution completed!'));
        break;
    }
  });
  
  try {
    // Generate a simple plan
    const goal = 'Document the README.md file and generate a summary';
    console.log(chalk.white.bold(`Goal: ${goal}`));
    
    await manager.generatePlan(goal);
    
    // Display the plan
    console.log();
    console.log(chalk.bold('Generated Plan:'));
    manager.currentPlan.forEach((step, index) => {
      console.log(`${chalk.bold.white(`Step ${step.number}:`)} ${step.description}`);
    });
    
    // Execute the plan
    console.log();
    console.log(chalk.bold('Executing Plan:'));
    
    // Custom execution to simulate real actions
    const executionResult = await manager.runEntirePlan(async ({ step }) => {
      // Customize execution based on step type
      if (step.actionType === 'code_analysis') {
        return {
          type: 'code_analysis',
          data: { 
            content: '# Sample README\n\nThis is a sample README file.',
            path: 'README.md'
          },
          summary: 'Analyzed README.md content'
        };
      } else if (step.actionType === 'documentation') {
        return {
          type: 'documentation',
          data: { 
            path: 'docs/README.md',
            content: '# README Documentation\n\nThis document describes the README.md file.'
          },
          summary: 'Generated documentation for README.md'
        };
      }
      
      // For other steps, let the manager handle it
      return undefined;
    });
    
    // Display the summary
    console.log();
    console.log(chalk.bold('Execution Summary:'));
    console.log(executionResult.summary);
    
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
  }
}

// Run the example
runExample().catch(err => {
  console.error(chalk.red(`Fatal error: ${err.message}`));
  process.exit(1);
});