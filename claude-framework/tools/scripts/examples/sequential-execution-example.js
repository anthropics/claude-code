#!/usr/bin/env node

/**
 * Sequential Execution Manager Example
 * 
 * This example demonstrates how to use the Domain-Specific Sequential Execution Manager
 * for documentation, CI/CD, and data processing tasks.
 */

const { SequentialExecutionManager } = require('@claude-framework/workflows');
const chalk = require('chalk');

async function runExample() {
  console.log(chalk.bold.blue('🚀 Sequential Execution Manager Example'));
  console.log(chalk.gray('Demonstrating domain-specific execution flows'));
  console.log();
  
  // ---- DOCUMENTATION DOMAIN EXAMPLE ----
  
  console.log(chalk.white.bold('🔍 Documentation Domain Example'));
  
  // Create a documentation domain manager
  const docManager = SequentialExecutionManager.forDomain('documentation', {
    fallbackMode: true, // Use fallback mode to avoid MCP server dependency
    maxSteps: 5,
    planningDepth: 'medium'
  });
  
  // Add an observer to monitor events
  docManager.addObserver((event, data) => {
    switch (event) {
      case 'planStart':
        console.log(chalk.cyan('  🔍 Creating plan...'));
        break;
      case 'planCreated':
        console.log(chalk.green(`  ✅ Plan created with ${data.plan.steps.length} steps`));
        break;
      case 'stepExecuteStart':
        console.log(chalk.cyan(`  ⏳ Executing step "${data.step.name}"`));
        break;
      case 'stepExecuted':
        console.log(chalk.green(`  ✅ Step "${data.step.name}" completed`));
        break;
      case 'planExecuteComplete':
        console.log(chalk.green.bold('  🎉 Execution completed!'));
        break;
    }
  });
  
  try {
    // Create a documentation plan with specific parameters
    const docPlanParams = {
      name: 'API Documentation Generation',
      description: 'Generate documentation for the Sequential Execution Manager API',
      patterns: ['**/*.ts'],
      excludePatterns: ['**/*.test.ts', '**/node_modules/**'],
      format: 'markdown',
      outputDir: './docs/api',
      extractExamples: true,
      includeApi: true
    };
    
    console.log(chalk.white(`Creating documentation plan with parameters:`));
    console.log(chalk.gray(JSON.stringify(docPlanParams, null, 2)));
    
    const docPlan = await docManager.createPlan(docPlanParams);
    
    // Display the plan
    console.log();
    console.log(chalk.bold('Documentation Plan:'));
    docPlan.steps.forEach((step, index) => {
      console.log(`  ${chalk.bold.white(`${index + 1}.`)} ${step.name}`);
      if (step.dependsOn && step.dependsOn.length > 0) {
        console.log(`     ${chalk.yellow('Depends on:')} ${step.dependsOn.join(', ')}`);
      }
    });
    
    // Execute the plan
    console.log();
    console.log(chalk.bold('Executing Documentation Plan:'));
    
    const docResult = await docManager.executePlan();
    
    // Display statistics
    console.log();
    console.log(chalk.bold('Documentation Execution Stats:'));
    const docCompletedSteps = docResult.executedSteps.filter(s => s.status === 'completed').length;
    const docSkippedSteps = docResult.executedSteps.filter(s => s.status === 'skipped').length;
    const docFailedSteps = docResult.executedSteps.filter(s => s.status === 'failed').length;
    
    console.log(`  ${chalk.green(`✓ Completed: ${docCompletedSteps}`)}`);
    console.log(`  ${chalk.yellow(`⏭️ Skipped: ${docSkippedSteps}`)}`);
    console.log(`  ${chalk.red(`✗ Failed: ${docFailedSteps}`)}`);
    
    // ---- CI/CD DOMAIN EXAMPLE ----
    
    console.log();
    console.log(chalk.white.bold('🔄 CI/CD Domain Example'));
    
    // Create a CI/CD domain manager
    const cicdManager = SequentialExecutionManager.forDomain('cicd', {
      fallbackMode: true,
      maxSteps: 10
    });
    
    // Create a CI/CD plan with specific parameters
    const cicdPlanParams = {
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
    };
    
    console.log(chalk.white(`Creating CI/CD plan with parameters:`));
    console.log(chalk.gray(JSON.stringify(cicdPlanParams, null, 2)));
    
    const cicdPlan = await cicdManager.createPlan(cicdPlanParams);
    
    // Display the plan
    console.log();
    console.log(chalk.bold('CI/CD Plan:'));
    cicdPlan.steps.forEach((step, index) => {
      console.log(`  ${chalk.bold.white(`${index + 1}.`)} ${step.name}`);
    });
    
    // Execute only the first step for demonstration
    if (cicdPlan.steps.length > 0) {
      console.log();
      console.log(chalk.bold('Executing first CI/CD step:'));
      
      const stepResult = await cicdManager.executeStep(cicdPlan.steps[0].id);
      
      console.log(chalk.white(`Step result: ${stepResult.message || 'Completed'}`));
      if (stepResult.data) {
        console.log(chalk.gray('Result data:'));
        console.log(chalk.gray(JSON.stringify(stepResult.data, null, 2)));
      }
    }
    
    // ---- DATA PROCESSING DOMAIN EXAMPLE ----
    
    console.log();
    console.log(chalk.white.bold('📊 Data Processing Domain Example'));
    
    // Create a Data Processing domain manager
    const dataManager = SequentialExecutionManager.forDomain('data', {
      fallbackMode: true
    });
    
    // Create a data processing plan with specific parameters
    const dataPlanParams = {
      name: 'Data Analysis Workflow',
      description: 'Collect, transform, and analyze customer data',
      workflowType: 'analysis',
      sources: ['database', 'api'],
      formats: ['json', 'csv'],
      transformations: ['normalize', 'aggregate', 'filter'],
      destination: './data/processed',
      analysisTypes: ['statistical', 'predictive'],
      generateReports: true,
      interactive: true
    };
    
    console.log(chalk.white(`Creating Data Processing plan with parameters:`));
    console.log(chalk.gray(JSON.stringify(dataPlanParams, null, 2)));
    
    const dataPlan = await dataManager.createPlan(dataPlanParams);
    
    // Display the plan
    console.log();
    console.log(chalk.bold('Data Processing Plan:'));
    dataPlan.steps.forEach((step, index) => {
      console.log(`  ${chalk.bold.white(`${index + 1}.`)} ${step.name}`);
    });
    
    console.log();
    console.log(chalk.green.bold('🎉 All examples completed successfully!'));
    
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
  }
}

// Run the example
runExample().catch(err => {
  console.error(chalk.red(`Fatal error: ${err.message}`));
  process.exit(1);
});