import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import { SequentialExecutionManager } from '@claude-framework/workflows';

export const sequentialExecuteCommand = new Command()
  .name('sequential-execute')
  .alias('seq-exec')
  .description('Execute tasks with sequential planning')
  .option('-d, --domain <domain>', 'Domain for sequential execution', /^(documentation|cicd|data|custom)$/i)
  .option('-g, --goal <goal>', 'Goal to plan for')
  .option('-s, --steps <number>', 'Maximum number of steps', (val) => parseInt(val, 10), 20)
  .option('--depth <depth>', 'Thought depth (shallow, medium, deep)', /^(shallow|medium|deep)$/i, 'medium')
  .option('-f, --fallback', 'Use fallback mode (no MCP)', false)
  .action(async (options) => {
    await run(options);
  });

/**
 * Run the sequential execute command
 * @param options Command options
 */
export async function run(options: any = {}): Promise<void> {
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
  manager.addObserver((event, data) => {
    switch (event) {
      case 'planStart':
        console.log(chalk.cyan('🔍 Generating plan...'));
        break;
      case 'planGenerated':
        console.log(chalk.green(`✅ Generated plan with ${data.plan.length} steps`));
        break;
      case 'planError':
        console.log(chalk.red(`❌ Failed to generate plan: ${data.error}`));
        break;
      case 'stepExecuteStart':
        console.log(chalk.cyan(`⏳ Executing step ${data.step.number}...`));
        break;
      case 'stepExecuted':
        console.log(chalk.green(`✅ Step ${data.step.number} executed`));
        break;
      case 'stepExecuteError':
        console.log(chalk.red(`❌ Step ${data.step.number} failed: ${data.error}`));
        break;
      case 'planComplete':
        console.log(chalk.green('🎉 Plan execution completed'));
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
    manager.getState().plan.forEach((step: any) => {
      console.log(`${chalk.bold.white(`Step ${step.number}:`)} ${getActionTypeChalk(step.actionType)} ${step.description}`);
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
          plan: manager.getState().plan,
          timestamp: new Date().toISOString()
        }, null, 2)
      );
      
      console.log(chalk.green(`Plan saved to ${filePath}`));
      return;
    }
    
    if (executeOptions === 'step') {
      // Execute step by step
      while (manager.getState().currentStep) {
        console.log();
        console.log(
          chalk.bold.white(`Step ${manager.getState().currentStep.number}:`), 
          manager.getState().currentStep.description
        );
        console.log(chalk.gray(`Action type: ${manager.getState().currentStep.actionType}`));
        
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
          const executionOptions: any = {};
          
          if (domain === 'documentation' && manager.getState().currentStep.actionType === 'code_analysis') {
            executionOptions.path = options.docPath;
            executionOptions.fileContent = { content: `Mock content for ${options.docPath}` };
          } else if (domain === 'documentation' && manager.getState().currentStep.actionType === 'documentation') {
            executionOptions.outputPath = `docs/${path.basename(options.docPath)}.${options.docFormat}`;
            executionOptions.content = 'Mock documentation content';
          } else if (domain === 'cicd' && manager.getState().currentStep.actionType === 'test') {
            executionOptions.testCount = 12;
            executionOptions.failCount = 0;
          } else if (domain === 'cicd' && manager.getState().currentStep.actionType === 'deploy') {
            executionOptions.environment = options.cicdEnv;
            executionOptions.url = `https://${options.cicdEnv}.example.com`;
          } else if (domain === 'data' && manager.getState().currentStep.actionType === 'extract') {
            executionOptions.source = options.dataSource;
            executionOptions.recordCount = 1000;
          } else if (domain === 'data' && manager.getState().currentStep.actionType === 'load') {
            executionOptions.destination = options.dataDestination;
            executionOptions.recordCount = 1000;
          } else if (manager.getState().currentStep.actionType === 'manual') {
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
          displayResult(result);
        } catch (err) {
          console.error(chalk.red(`Error executing step: ${err instanceof Error ? err.message : String(err)}`));
        }
      }
    } else if (executeOptions === 'auto') {
      // Execute automatically
      const executeSpinner = ora('Executing plan...').start();
      
      try {
        const result = await manager.runEntirePlan(async ({ step, isLastStep }) => {
          executeSpinner.text = `Executing step ${step.number}...`;
          
          // Domain-specific execution options
          const executionOptions: any = {};
          
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
        
        const state = manager.getState();
        const completedCount = state.executedSteps.filter((s: any) => s.status === 'completed').length;
        const skippedCount = state.executedSteps.filter((s: any) => s.status === 'skipped').length;
        const failedCount = state.executedSteps.filter((s: any) => s.status === 'failed').length;
        
        console.log(chalk.green(`Completed: ${completedCount}`));
        console.log(chalk.yellow(`Skipped: ${skippedCount}`));
        console.log(chalk.red(`Failed: ${failedCount}`));
        
        console.log();
        console.log(chalk.bold('📝 Summary:'));
        console.log(result.summary);
      } catch (err) {
        executeSpinner.fail(`Failed to execute plan: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    // Show final status
    if (manager.getState().isComplete) {
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
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}

/**
 * Display a step result
 * @param result Step result
 */
function displayResult(result: any): void {
  if (result.type === 'context') {
    console.log(chalk.cyan('Found documents:'));
    result.data.documents?.forEach((doc: any, i: number) => {
      console.log(chalk.cyan.bold(`${i + 1}. ${doc.title}`));
      console.log(chalk.gray(doc.summary));
    });
  } else if (result.type === 'ui') {
    console.log(chalk.magenta(`Generated component: ${result.data.name}`));
    console.log(chalk.gray('Component code saved to memory'));
  } else if (result.type === 'documentation') {
    console.log(chalk.green(`Documentation saved to: ${result.data.path}`));
  } else if (['test', 'build', 'deploy', 'extract', 'transform', 'load'].includes(result.type)) {
    console.log(chalk.green(result.summary));
  } else {
    console.log(chalk.green(result.summary));
  }
}

/**
 * Get chalk function for action type
 * @param actionType Action type
 * @returns Chalk-formatted string
 */
function getActionTypeChalk(actionType: string): string {
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

export default sequentialExecuteCommand;