#!/usr/bin/env node

/**
 * Sequential Execution CLI Command
 * 
 * This command provides a CLI interface for the Sequential Execution Manager,
 * allowing interactive planning and execution across different domains.
 */

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { program } = require('commander');
const SequentialExecutionManager = require('../../tools/mcp/integration/sequential_execution_manager');
const logger = require('../../core/logging/logger').createLogger('sequential-execute-cli');

// Define the command
program
  .name('sequential-execute')
  .description('Interactive sequential planning and execution')
  .option('-d, --domain <domain>', 'Domain for planning (documentation, cicd, data, custom)')
  .option('-g, --goal <goal>', 'Goal to plan for')
  .option('-f, --fallback', 'Use fallback mode (no MCP dependency)')
  .option('-s, --steps <steps>', 'Maximum number of steps', parseInt)
  .option('--depth <depth>', 'Planning depth (shallow, medium, deep)')
  .option('-o, --output <file>', 'Save execution result to file')
  .option('--auto', 'Run the entire plan automatically')
  .option('--no-interactive', 'Run without interactive prompts');

// Parse arguments
program.parse(process.argv);
const options = program.opts();

/**
 * Main function for the CLI
 */
async function main() {
  try {
    console.log(chalk.bold.blue('Sequential Execution CLI'));
    console.log(chalk.gray('Interactive planning and execution'));
    console.log();
    
    // Get domain
    const domain = await getDomain();
    
    // Create an execution manager for the domain
    const manager = SequentialExecutionManager.forDomain(domain, {
      fallbackMode: options.fallback || false,
      maxSteps: options.steps || 20,
      planningDepth: options.depth || 'medium'
    });
    
    // Add an observer to display events
    if (options.interactive !== false) {
      manager.addObserver((event, data) => {
        switch (event) {
          case 'planStart':
            console.log(chalk.cyan('Generating plan...'));
            break;
          case 'planGenerated':
            console.log(chalk.green(`Plan generated with ${data.plan.length} steps`));
            break;
          case 'stepExecuteStart':
            console.log(chalk.cyan(`Executing step ${data.step.number}: ${data.step.description}`));
            break;
          case 'stepExecuted':
            console.log(chalk.green(`Step completed: ${data.result.summary}`));
            break;
          case 'stepSkipped':
            console.log(chalk.yellow(`Step skipped: ${data.step.description}`));
            break;
          case 'planComplete':
            console.log(chalk.green.bold('Plan execution completed!'));
            break;
        }
      });
    }
    
    // Get goal
    const goal = await getGoal(domain);
    
    // Generate plan
    console.log(chalk.white(`\nGenerating plan for: ${chalk.bold(goal)}\n`));
    await manager.generatePlan(goal);
    
    // Display the plan
    if (options.interactive !== false) {
      displayPlan(manager.currentPlan);
    }
    
    // Run entire plan automatically if requested
    if (options.auto) {
      console.log(chalk.cyan('\nExecuting entire plan automatically...\n'));
      const result = await manager.runEntirePlan();
      
      console.log(chalk.green.bold('\nExecution completed!\n'));
      console.log(chalk.white('Summary:'));
      console.log(chalk.white(result.summary));
      
      // Save result if requested
      if (options.output) {
        saveResult(result, options.output);
      }
      
      return;
    }
    
    // Interactive execution
    if (options.interactive !== false) {
      await interactiveExecution(manager);
    }
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Get the domain to use
 * @returns {Promise<string>} The domain
 */
async function getDomain() {
  // Use command line option if provided
  if (options.domain) {
    return options.domain;
  }
  
  // Use interactive prompt if no option provided
  if (options.interactive !== false) {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'domain',
        message: 'Select a domain for sequential planning:',
        choices: [
          { name: 'Documentation Generation', value: 'documentation' },
          { name: 'CI/CD Automation', value: 'cicd' },
          { name: 'Data Processing', value: 'data' },
          { name: 'Custom/Generic', value: 'custom' }
        ]
      }
    ]);
    
    return answers.domain;
  }
  
  // Default to custom
  return 'custom';
}

/**
 * Get the goal to plan for
 * @param {string} domain - The domain
 * @returns {Promise<string>} The goal
 */
async function getGoal(domain) {
  // Use command line option if provided
  if (options.goal) {
    return options.goal;
  }
  
  // Use interactive prompt if no option provided
  if (options.interactive !== false) {
    let defaultGoal = '';
    let message = 'Enter a goal for planning:';
    
    // Provide domain-specific examples
    switch (domain) {
      case 'documentation':
        defaultGoal = 'Generate documentation for src/components/MyComponent.jsx in markdown format';
        message = 'Enter a goal for documentation generation:';
        break;
      case 'cicd':
        defaultGoal = 'Build and deploy my-app to staging environment. Include tests.';
        message = 'Enter a goal for CI/CD automation:';
        break;
      case 'data':
        defaultGoal = 'Perform ETL operation from MySQL database to data warehouse.';
        message = 'Enter a goal for data processing:';
        break;
    }
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'goal',
        message,
        default: defaultGoal
      }
    ]);
    
    return answers.goal;
  }
  
  // No goal provided
  throw new Error('No goal provided. Use --goal option or interactive mode.');
}

/**
 * Display a plan in the console
 * @param {Array} plan - The plan to display
 */
function displayPlan(plan) {
  console.log(chalk.bold('\nPlan:'));
  plan.forEach((step) => {
    const statusColor = step.status === 'pending' 
      ? chalk.white 
      : step.status === 'completed' 
        ? chalk.green 
        : step.status === 'skipped' 
          ? chalk.yellow 
          : chalk.red;
    
    console.log(`${chalk.bold(`Step ${step.number}:`)} ${statusColor(step.description)}`);
    
    if (step.status === 'completed' && step.result) {
      console.log(`  ${chalk.gray(`→ ${step.result.summary}`)}`);
    } else if (step.status === 'failed' && step.result) {
      console.log(`  ${chalk.red(`→ ${step.result.summary}`)}`);
    }
  });
}

/**
 * Interactive execution of a plan
 * @param {SequentialExecutionManager} manager - The execution manager
 */
async function interactiveExecution(manager) {
  console.log(chalk.cyan('\nStarting interactive execution...\n'));
  
  while (manager.currentStep) {
    // Display current step
    console.log(chalk.bold(`Current step: ${manager.currentStep.number}`));
    console.log(chalk.white(manager.currentStep.description));
    console.log();
    
    // Get action
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Execute step', value: 'execute' },
          { name: 'Skip step', value: 'skip' },
          { name: 'Revise step', value: 'revise' },
          { name: 'Continue plan (add more steps)', value: 'continue' },
          { name: 'Show plan', value: 'show' },
          { name: 'Generate summary', value: 'summary' },
          { name: 'Execute remaining steps automatically', value: 'auto' },
          { name: 'Save execution result to file', value: 'save' },
          { name: 'Exit', value: 'exit' }
        ]
      }
    ]);
    
    // Perform action
    switch (answers.action) {
      case 'execute':
        try {
          await manager.executeCurrentStep();
        } catch (err) {
          console.error(chalk.red(`Error executing step: ${err.message}`));
        }
        break;
        
      case 'skip':
        await manager.skipCurrentStep();
        break;
        
      case 'revise':
        const revision = await inquirer.prompt([
          {
            type: 'input',
            name: 'description',
            message: 'Enter revised step description:',
            default: manager.currentStep.description
          }
        ]);
        
        await manager.reviseStep(manager.currentStep.id, revision.description);
        break;
        
      case 'continue':
        try {
          const newPlan = await manager.continuePlan();
          displayPlan(newPlan);
        } catch (err) {
          console.error(chalk.red(`Error continuing plan: ${err.message}`));
        }
        break;
        
      case 'show':
        displayPlan(manager.currentPlan);
        break;
        
      case 'summary':
        try {
          const summary = await manager.generateSummary();
          console.log(chalk.bold('\nSummary:'));
          console.log(chalk.white(summary));
        } catch (err) {
          console.error(chalk.red(`Error generating summary: ${err.message}`));
        }
        break;
        
      case 'auto':
        try {
          await manager.runEntirePlan();
          console.log(chalk.green.bold('\nAutomatic execution completed!'));
        } catch (err) {
          console.error(chalk.red(`Error during automatic execution: ${err.message}`));
        }
        break;
        
      case 'save':
        const saveAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'file',
            message: 'Enter output file path:',
            default: 'execution-result.json'
          }
        ]);
        
        saveResult(manager.getState(), saveAnswers.file);
        break;
        
      case 'exit':
        console.log(chalk.yellow('\nExiting interactive execution.'));
        return;
    }
    
    console.log(); // Add spacing between iterations
  }
  
  // Plan is complete
  console.log(chalk.green.bold('\nPlan execution completed!'));
  
  // Display summary
  if (manager.executionResult && manager.executionResult.summary) {
    console.log(chalk.bold('\nSummary:'));
    console.log(chalk.white(manager.executionResult.summary));
  }
  
  // Prompt to save result
  const savePrompt = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'save',
      message: 'Save execution result to file?',
      default: false
    }
  ]);
  
  if (savePrompt.save) {
    const saveAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'file',
        message: 'Enter output file path:',
        default: 'execution-result.json'
      }
    ]);
    
    saveResult(manager.getState(), saveAnswers.file);
  }
}

/**
 * Save execution result to a file
 * @param {Object} result - The execution result
 * @param {string} filePath - The file path to save to
 */
function saveResult(result, filePath) {
  try {
    // Format result in pretty JSON
    const output = JSON.stringify(result, null, 2);
    
    // Create directory if it doesn't exist
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    // Write to file
    fs.writeFileSync(filePath, output);
    
    console.log(chalk.green(`Result saved to ${filePath}`));
  } catch (err) {
    console.error(chalk.red(`Error saving result: ${err.message}`));
  }
}

// Run the command
main().catch(err => {
  console.error(chalk.red(`Fatal error: ${err.message}`));
  process.exit(1);
});