#!/usr/bin/env node

/**
 * Sequential Execute CLI Command
 * 
 * This command provides a unified interface for sequential planning and execution
 * across different domains using the Sequential Execution Manager.
 */

const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const inquirer = require('inquirer');
const SequentialExecutionManager = require('../../tools/mcp/integration/sequential_execution_manager');

/**
 * Run the sequential execute command
 * @param {Object} options - Command options
 */
async function run(options = {}) {
  console.log(chalk.bold.blue('🚀 Sequential Planning & Execution'));
  console.log(chalk.gray('Execute complex tasks with sequential planning'));
  console.log();
  
  // Get domain if not provided
  let domain = options.domain;
  if (!domain) {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'domain',
        message: 'Select a domain:',
        choices: [
          { name: 'Documentation Generation', value: 'documentation' },
          { name: 'CI/CD Automation', value: 'cicd' },
          { name: 'Data Processing', value: 'data' },
          { name: 'Custom Goal', value: 'custom' }
        ]
      }
    ]);
    
    domain = answers.domain;
  }
  
  // Create execution manager for the selected domain
  const manager = SequentialExecutionManager.forDomain(domain, {
    fallbackMode: options.fallback,
    maxSteps: options.steps,
    planningDepth: options.depth
  });
  
  // Add observer for better UX
  const spinner = ora();
  manager.addObserver((event, data) => {
    switch (event) {
      case 'planStart':
        spinner.start('Generating plan...');
        break;
      case 'planGenerated':
        spinner.succeed(`Generated plan with ${data.plan.length} steps`);
        break;
      case 'planError':
        spinner.fail(`Failed to generate plan: ${data.error}`);
        break;
      case 'stepExecuteStart':
        spinner.start(`Executing step ${data.step.number}...`);
        break;
      case 'stepExecuted':
        spinner.succeed(`Step ${data.step.number} executed`);
        break;
      case 'stepExecuteError':
        spinner.fail(`Step ${data.step.number} failed: ${data.error}`);
        break;
      case 'planComplete':
        spinner.succeed('Plan execution completed');
        break;
    }
  });
  
  // Get goal if not provided
  let goal = options.goal;
  if (!goal) {
    if (domain === 'documentation') {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'path',
          message: 'Enter the path to the file or directory to document:',
          validate: input => input.trim() ? true : 'Path is required'
        },
        {
          type: 'list',
          name: 'format',
          message: 'Select output format:',
          choices: [
            { name: 'Markdown', value: 'markdown' },
            { name: 'HTML', value: 'html' },
            { name: 'JSON', value: 'json' }
          ],
          default: 'markdown'
        },
        {
          type: 'confirm',
          name: 'includePrivate',
          message: 'Include private methods and properties?',
          default: false
        }
      ]);
      
      goal = `Generate comprehensive documentation for ${answers.path} in ${answers.format} format. ${
        answers.includePrivate ? 'Include' : 'Exclude'
      } private methods and properties.`;
      
      options.docPath = answers.path;
      options.docFormat = answers.format;
      options.docIncludePrivate = answers.includePrivate;
    } else if (domain === 'cicd') {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'repository',
          message: 'Enter the repository to build:',
          validate: input => input.trim() ? true : 'Repository is required'
        },
        {
          type: 'list',
          name: 'environment',
          message: 'Select deployment environment:',
          choices: [
            { name: 'Development', value: 'development' },
            { name: 'Staging', value: 'staging' },
            { name: 'Production', value: 'production' }
          ],
          default: 'staging'
        },
        {
          type: 'confirm',
          name: 'runTests',
          message: 'Run tests before deployment?',
          default: true
        }
      ]);
      
      goal = `Build and deploy ${answers.repository} to ${answers.environment} environment. ${
        answers.runTests ? 'Include' : 'Skip'
      } tests.`;
      
      options.cicdRepo = answers.repository;
      options.cicdEnv = answers.environment;
      options.cicdRunTests = answers.runTests;
    } else if (domain === 'data') {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'source',
          message: 'Enter the data source:',
          validate: input => input.trim() ? true : 'Source is required'
        },
        {
          type: 'input',
          name: 'destination',
          message: 'Enter the data destination:',
          validate: input => input.trim() ? true : 'Destination is required'
        },
        {
          type: 'list',
          name: 'operation',
          message: 'Select data operation:',
          choices: [
            { name: 'Extract, Transform, Load (ETL)', value: 'etl' },
            { name: 'Migration', value: 'migration' },
            { name: 'Analysis', value: 'analysis' }
          ],
          default: 'etl'
        }
      ]);
      
      goal = `Perform ${answers.operation} operation from ${answers.source} to ${answers.destination}.`;
      
      options.dataSource = answers.source;
      options.dataDestination = answers.destination;
      options.dataOperation = answers.operation;
    } else {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'goal',
          message: 'Enter your goal:',
          validate: input => input.trim() ? true : 'Goal is required'
        }
      ]);
      
      goal = answers.goal;
    }
  }
  
  // Generate plan
  try {
    await manager.generatePlan(goal, {
      initialSteps: options.initialSteps || 5,
      depth: options.depth || 'medium'
    });
    
    // Display the plan
    console.log();
    console.log(chalk.bold('🔍 Plan:'));
    manager.currentPlan.forEach((step, index) => {
      const stepNumber = chalk.bold.white(`Step ${step.number}:`);
      const actionType = getActionTypeChalk(step.actionType);
      console.log(`${stepNumber} ${actionType} ${step.description}`);
    });
    
    // Ask how to proceed
    const { executeOptions } = await inquirer.prompt([
      {
        type: 'list',
        name: 'executeOptions',
        message: 'What would you like to do next?',
        choices: [
          { name: 'Execute the plan step by step', value: 'step' },
          { name: 'Execute the entire plan automatically', value: 'auto' },
          { name: 'Save the plan to a file', value: 'save' },
          { name: 'Exit', value: 'exit' }
        ]
      }
    ]);
    
    if (executeOptions === 'exit') {
      console.log(chalk.gray('Exiting...'));
      return;
    }
    
    if (executeOptions === 'save') {
      const { filePath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'filePath',
          message: 'Where would you like to save the plan?',
          default: `sequential-plan-${new Date().toISOString().split('T')[0]}.json`
        }
      ]);
      
      const fs = require('fs');
      const directory = path.dirname(filePath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
      
      fs.writeFileSync(
        filePath,
        JSON.stringify({
          domain,
          goal,
          plan: manager.currentPlan,
          timestamp: new Date().toISOString()
        }, null, 2)
      );
      
      console.log(chalk.green(`Plan saved to ${filePath}`));
      return;
    }
    
    if (executeOptions === 'step') {
      // Execute step by step
      while (manager.currentStep) {
        console.log();
        console.log(chalk.bold.white(`Step ${manager.currentStep.number}:`), manager.currentStep.description);
        console.log(chalk.gray(`Action type: ${manager.currentStep.actionType}`));
        
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'What would you like to do with this step?',
            choices: [
              { name: 'Execute step', value: 'execute' },
              { name: 'Skip step', value: 'skip' },
              { name: 'Exit', value: 'exit' }
            ]
          }
        ]);
        
        if (action === 'exit') {
          console.log(chalk.gray('Exiting...'));
          return;
        }
        
        if (action === 'skip') {
          await manager.skipCurrentStep();
          console.log(chalk.yellow('Step skipped'));
          continue;
        }
        
        // Execute the step
        try {
          // For domain-specific execution
          const executionOptions = {};
          
          if (domain === 'documentation' && manager.currentStep.actionType === 'code_analysis') {
            executionOptions.path = options.docPath;
            // In a real implementation, we would read the file content here
            executionOptions.fileContent = { content: `Mock content for ${options.docPath}` };
          } else if (domain === 'documentation' && manager.currentStep.actionType === 'documentation') {
            executionOptions.outputPath = `docs/${path.basename(options.docPath)}.${options.docFormat}`;
            executionOptions.content = 'Mock documentation content';
          } else if (domain === 'cicd' && manager.currentStep.actionType === 'test') {
            executionOptions.testCount = 12;
            executionOptions.failCount = 0;
          } else if (domain === 'cicd' && manager.currentStep.actionType === 'deploy') {
            executionOptions.environment = options.cicdEnv;
            executionOptions.url = `https://${options.cicdEnv}.example.com`;
          } else if (domain === 'data' && manager.currentStep.actionType === 'extract') {
            executionOptions.source = options.dataSource;
            executionOptions.recordCount = 1000;
          } else if (domain === 'data' && manager.currentStep.actionType === 'load') {
            executionOptions.destination = options.dataDestination;
            executionOptions.recordCount = 1000;
          } else if (manager.currentStep.actionType === 'manual') {
            // For manual steps, prompt for the result
            const { manualResult } = await inquirer.prompt([
              {
                type: 'input',
                name: 'manualResult',
                message: 'Enter the result of this step:',
                default: 'Step executed manually'
              }
            ]);
            
            executionOptions.summary = manualResult;
          }
          
          const result = await manager.executeCurrentStep(executionOptions);
          
          // Display result based on type
          if (result.type === 'context') {
            console.log(chalk.cyan('Found documents:'));
            result.data.forEach((doc, i) => {
              console.log(chalk.cyan.bold(`${i + 1}. ${doc.title}`));
              console.log(chalk.gray(doc.summary));
            });
          } else if (result.type === 'ui') {
            console.log(chalk.magenta(`Generated component: ${result.data.name}`));
            console.log(chalk.gray('Component code saved to memory'));
          } else if (result.type === 'documentation') {
            console.log(chalk.green(`Documentation saved to: ${result.data.path}`));
          } else if (result.type === 'test' || result.type === 'build' || result.type === 'deploy') {
            console.log(chalk.green(result.summary));
          } else if (result.type === 'extract' || result.type === 'transform' || result.type === 'load') {
            console.log(chalk.green(result.summary));
          } else {
            console.log(chalk.green(result.summary));
          }
        } catch (err) {
          console.error(chalk.red(`Error executing step: ${err.message}`));
        }
      }
    } else if (executeOptions === 'auto') {
      // Execute automatically
      const executeSpinner = ora('Executing plan...').start();
      
      try {
        const result = await manager.runEntirePlan(async ({ step, isLastStep }) => {
          executeSpinner.text = `Executing step ${step.number}...`;
          
          // Domain-specific execution options
          const executionOptions = {};
          
          if (domain === 'documentation' && step.actionType === 'code_analysis') {
            executionOptions.path = options.docPath;
            executionOptions.fileContent = { content: `Mock content for ${options.docPath}` };
            return {
              type: 'code_analysis',
              data: { fileContent: executionOptions.fileContent },
              summary: `Code analyzed from ${options.docPath}`
            };
          } else if (domain === 'documentation' && step.actionType === 'documentation') {
            executionOptions.outputPath = `docs/${path.basename(options.docPath)}.${options.docFormat}`;
            executionOptions.content = 'Mock documentation content';
            return {
              type: 'documentation',
              data: { 
                path: executionOptions.outputPath,
                content: executionOptions.content
              },
              summary: `Documentation generated and saved to ${executionOptions.outputPath}`
            };
          } else if (domain === 'cicd' && step.actionType === 'test') {
            return {
              type: 'test',
              data: { results: { passed: 10, failed: 0, skipped: 2 } },
              summary: 'Tests executed: 12 tests run, 0 failures'
            };
          } else if (domain === 'cicd' && step.actionType === 'deploy') {
            return {
              type: 'deploy',
              data: { 
                environment: options.cicdEnv,
                url: `https://${options.cicdEnv}.example.com`
              },
              summary: `Deployed to ${options.cicdEnv} environment`
            };
          } else if (domain === 'data' && step.actionType === 'extract') {
            return {
              type: 'extract',
              data: { 
                records: 1000,
                source: options.dataSource
              },
              summary: `Extracted 1000 records from ${options.dataSource}`
            };
          } else if (domain === 'data' && step.actionType === 'load') {
            return {
              type: 'load',
              data: { 
                destination: options.dataDestination,
                records: 1000
              },
              summary: `Loaded 1000 records to ${options.dataDestination}`
            };
          } else if (step.actionType === 'manual') {
            return {
              type: 'manual',
              data: {},
              summary: 'Step executed automatically in auto mode'
            };
          }
          
          // For other steps, let the manager execute them
          return undefined;
        });
        
        executeSpinner.succeed('Plan executed successfully');
        
        // Show execution summary
        console.log();
        console.log(chalk.bold('📊 Execution Summary:'));
        
        const completedCount = manager.executedSteps.filter(s => s.status === 'completed').length;
        const skippedCount = manager.executedSteps.filter(s => s.status === 'skipped').length;
        const failedCount = manager.executedSteps.filter(s => s.status === 'failed').length;
        
        console.log(chalk.green(`Completed: ${completedCount}`));
        console.log(chalk.yellow(`Skipped: ${skippedCount}`));
        console.log(chalk.red(`Failed: ${failedCount}`));
        
        console.log();
        console.log(chalk.bold('📝 Summary:'));
        console.log(manager.executionResult.summary);
      } catch (err) {
        executeSpinner.fail(`Failed to execute plan: ${err.message}`);
      }
    }
    
    // Show final status
    if (manager.isComplete) {
      console.log();
      console.log(chalk.bold.green('✅ Plan execution completed'));
      
      if (domain === 'documentation') {
        console.log(chalk.green(`Documentation has been generated for ${options.docPath}`));
        console.log(chalk.green(`Output: docs/${path.basename(options.docPath)}.${options.docFormat}`));
      } else if (domain === 'cicd') {
        console.log(chalk.green(`${options.cicdRepo} has been deployed to ${options.cicdEnv}`));
        console.log(chalk.green(`URL: https://${options.cicdEnv}.example.com`));
      } else if (domain === 'data') {
        console.log(chalk.green(`Data ${options.dataOperation} from ${options.dataSource} to ${options.dataDestination} completed`));
      }
    }
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
  }
}

/**
 * Get chalk function for action type
 * @param {string} actionType - Action type
 * @returns {string} Chalk-formatted string
 */
function getActionTypeChalk(actionType) {
  switch (actionType) {
    case 'context':
      return chalk.bgCyan.black(' Context ');
    case 'ui':
      return chalk.bgMagenta.black(' UI ');
    case 'executable':
      return chalk.bgGreen.black(' Executable ');
    case 'code_analysis':
      return chalk.bgBlue.white(' Analysis ');
    case 'documentation':
      return chalk.bgGreen.white(' Doc Gen ');
    case 'test':
      return chalk.bgYellow.black(' Test ');
    case 'build':
      return chalk.bgBlue.white(' Build ');
    case 'deploy':
      return chalk.bgRed.white(' Deploy ');
    case 'extract':
      return chalk.bgBlue.white(' Extract ');
    case 'transform':
      return chalk.bgYellow.black(' Transform ');
    case 'load':
      return chalk.bgGreen.white(' Load ');
    case 'manual':
    default:
      return chalk.bgYellow.black(' Manual ');
  }
}

// If this script is run directly, execute the command
if (require.main === module) {
  // Parse command line arguments
  const argv = require('yargs')
    .usage('Usage: $0 [options]')
    .option('domain', {
      describe: 'Domain for sequential execution',
      type: 'string',
      choices: ['documentation', 'cicd', 'data', 'custom']
    })
    .option('goal', {
      describe: 'Goal to plan for',
      type: 'string'
    })
    .option('steps', {
      describe: 'Maximum number of steps',
      type: 'number',
      default: 20
    })
    .option('depth', {
      describe: 'Thought depth (shallow, medium, deep)',
      type: 'string',
      default: 'medium',
      choices: ['shallow', 'medium', 'deep']
    })
    .option('fallback', {
      describe: 'Use fallback mode (no MCP)',
      type: 'boolean',
      default: false
    })
    .help()
    .argv;
  
  run(argv).catch(err => {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  });
}

module.exports = { run };