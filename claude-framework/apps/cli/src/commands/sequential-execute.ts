import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import ora from 'ora';
import fs from 'fs';
import { SequentialExecutionManager, Domain, ExecutionResult, Plan, PlanStep } from '@claude-framework/workflows';

export const sequentialExecuteCommand = new Command()
  .name('sequential-execute')
  .alias('seq-exec')
  .description('Execute tasks with sequential planning')
  .option('-d, --domain <domain>', 'Domain for sequential execution', /^(documentation|cicd|data|general)$/i)
  .option('-p, --params <json>', 'JSON string of planning parameters')
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
  let domain = options.domain as Domain;
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
          { name: 'General Purpose', value: 'general' }
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
        console.log(chalk.cyan('🔍 Creating plan...'));
        break;
      case 'planCreated':
        console.log(chalk.green(`✅ Created plan with ${data.plan.steps.length} steps`));
        break;
      case 'planError':
        console.log(chalk.red(`❌ Failed to create plan: ${data.error}`));
        break;
      case 'stepExecuteStart':
        console.log(chalk.cyan(`⏳ Executing step "${data.step.name}"...`));
        break;
      case 'stepExecuted':
        console.log(chalk.green(`✅ Step "${data.step.name}" executed successfully`));
        break;
      case 'stepExecuteError':
        console.log(chalk.red(`❌ Step "${data.step.name}" failed: ${data.error}`));
        break;
      case 'stepSkipped':
        console.log(chalk.yellow(`⏭️ Step "${data.step.name}" skipped`));
        break;
      case 'planExecuteComplete':
        console.log(chalk.green('🎉 Plan execution completed'));
        break;
      case 'planExecuteError':
        console.log(chalk.red(`❌ Plan execution failed: ${data.error}`));
        break;
    }
  });
  
  // Get planning parameters
  let planParams: Record<string, any> = {};
  
  if (options.params) {
    try {
      planParams = JSON.parse(options.params);
    } catch (err) {
      console.error(chalk.red('Invalid JSON in --params option. Using empty params.'));
    }
  } else {
    planParams = await getInteractivePlanParams(domain);
  }
  
  // Create plan
  try {
    const planSpinner = ora('Creating plan...').start();
    
    const plan = await manager.createPlan(planParams);
    
    planSpinner.succeed('Plan created successfully');
    
    // Display the plan
    console.log();
    console.log(chalk.bold('🔍 Plan:'));
    
    plan.steps.forEach((step, index) => {
      console.log(`${chalk.bold.white(`${index + 1}.`)} ${step.name}: ${chalk.gray(step.description)}`);
      
      if (step.dependsOn && step.dependsOn.length > 0) {
        const dependsOnStepNames = step.dependsOn.map(depId => {
          const depStep = plan.steps.find(s => s.id === depId);
          return depStep ? depStep.name : depId;
        });
        
        console.log(`   ${chalk.yellow('Depends on:')} ${dependsOnStepNames.join(', ')}`);
      }
    });
    
    // Ask how to proceed
    const { executeOption } = await inquirer.prompt([
      {
        type: 'list',
        name: 'executeOption',
        message: 'What would you like to do next?',
        choices: [
          { name: 'Execute the plan step by step', value: 'stepByStep' },
          { name: 'Execute the entire plan automatically', value: 'automatic' },
          { name: 'Save the plan to a file', value: 'save' },
          { name: 'Exit', value: 'exit' }
        ]
      }
    ]);
    
    if (executeOption === 'exit') {
      console.log(chalk.gray('Exiting...'));
      return;
    }
    
    if (executeOption === 'save') {
      const { filePath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'filePath',
          message: 'Where would you like to save the plan?',
          default: `sequential-plan-${new Date().toISOString().split('T')[0]}.json`
        }
      ]);
      
      const directory = path.dirname(filePath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
      
      fs.writeFileSync(
        filePath,
        JSON.stringify({
          domain,
          plan,
          parameters: planParams,
          timestamp: new Date().toISOString()
        }, null, 2)
      );
      
      console.log(chalk.green(`Plan saved to ${filePath}`));
      return;
    }
    
    if (executeOption === 'stepByStep') {
      await executeStepByStep(manager, plan);
    } else if (executeOption === 'automatic') {
      await executeAutomatically(manager);
    }
    
    // Show final status
    if (manager.getState().isComplete) {
      console.log();
      console.log(chalk.bold.green('✅ Plan execution completed'));
      console.log();
      
      // Display summary
      const state = manager.getState();
      const summary = typeof state.executionResults === 'object' ? 
        generateSummary(domain, state.plan as Plan, state.executedSteps as PlanStep[], state.executionResults) :
        'No execution results available.';
      
      console.log(chalk.bold('📊 Execution Summary:'));
      console.log(summary);
    }
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}

/**
 * Execute a plan step by step
 * @param manager Execution manager
 * @param plan The plan to execute
 */
async function executeStepByStep(manager: SequentialExecutionManager, plan: Plan): Promise<void> {
  // Process each step
  for (const step of plan.steps) {
    console.log();
    console.log(chalk.bold.white(`Step: ${step.name}`));
    console.log(chalk.gray(step.description));
    
    // Check if dependencies are satisfied
    if (step.dependsOn && step.dependsOn.length > 0) {
      const unsatisfiedDeps = step.dependsOn.filter(depId => {
        const depStep = plan.steps.find(s => s.id === depId);
        return depStep && depStep.status !== 'completed';
      });
      
      if (unsatisfiedDeps.length > 0) {
        console.log(chalk.yellow('⚠️ This step has unsatisfied dependencies and cannot be executed yet.'));
        
        const { skipOption } = await inquirer.prompt([
          {
            type: 'list',
            name: 'skipOption',
            message: 'What would you like to do?',
            choices: [
              { name: 'Skip this step', value: 'skip' },
              { name: 'Try to execute anyway', value: 'execute' },
              { name: 'Exit', value: 'exit' }
            ]
          }
        ]);
        
        if (skipOption === 'exit') {
          console.log(chalk.gray('Exiting...'));
          return;
        }
        
        if (skipOption === 'skip') {
          manager.skipStep(step.id);
          continue;
        }
      }
    }
    
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
      manager.skipStep(step.id);
      continue;
    }
    
    // Execute the step
    try {
      const stepSpinner = ora('Executing step...').start();
      
      const result = await manager.executeStep(step.id);
      
      if (result.success) {
        stepSpinner.succeed('Step executed successfully');
      } else {
        stepSpinner.fail(`Step execution failed: ${result.error || 'Unknown error'}`);
      }
      
      // Display result details
      if (result.data) {
        console.log(chalk.gray('Result details:'));
        console.log(chalk.gray(JSON.stringify(result.data, null, 2)));
      }
      
      if (result.message) {
        console.log(chalk.white(result.message));
      }
    } catch (err) {
      console.error(chalk.red(`Error executing step: ${err instanceof Error ? err.message : String(err)}`));
    }
  }
}

/**
 * Execute a plan automatically
 * @param manager Execution manager
 */
async function executeAutomatically(manager: SequentialExecutionManager): Promise<void> {
  try {
    const executeSpinner = ora('Executing plan...').start();
    
    const result = await manager.executePlan();
    
    if (result.success) {
      executeSpinner.succeed('Plan executed successfully');
    } else {
      executeSpinner.fail(`Plan execution failed: ${result.error || 'Some steps failed'}`);
    }
    
    // Display completion statistics
    const completedCount = result.executedSteps.filter(s => s.status === 'completed').length;
    const skippedCount = result.executedSteps.filter(s => s.status === 'skipped').length;
    const failedCount = result.executedSteps.filter(s => s.status === 'failed').length;
    
    console.log();
    console.log(chalk.bold('📊 Execution Statistics:'));
    console.log(chalk.green(`✓ Completed: ${completedCount}`));
    console.log(chalk.yellow(`⏭️ Skipped: ${skippedCount}`));
    console.log(chalk.red(`✗ Failed: ${failedCount}`));
  } catch (err) {
    console.error(chalk.red(`Error executing plan: ${err instanceof Error ? err.message : String(err)}`));
  }
}

/**
 * Get interactive planning parameters based on domain
 * @param domain Planning domain
 * @returns Planning parameters
 */
async function getInteractivePlanParams(domain: Domain): Promise<Record<string, any>> {
  switch (domain) {
    case 'documentation':
      const docAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'patterns',
          message: 'File patterns to document (comma separated):',
          default: '**/*.ts,**/*.js',
          filter: (input) => input.split(',').map((s: string) => s.trim())
        },
        {
          type: 'input',
          name: 'excludePatterns',
          message: 'Patterns to exclude (comma separated):',
          default: 'node_modules/**,dist/**,**/*.test.*',
          filter: (input) => input.split(',').map((s: string) => s.trim())
        },
        {
          type: 'list',
          name: 'format',
          message: 'Output format:',
          choices: ['markdown', 'html', 'json'],
          default: 'markdown'
        },
        {
          type: 'input',
          name: 'outputDir',
          message: 'Output directory:',
          default: './docs'
        },
        {
          type: 'confirm',
          name: 'extractExamples',
          message: 'Extract examples from code?',
          default: true
        },
        {
          type: 'confirm',
          name: 'includeApi',
          message: 'Generate API documentation?',
          default: true
        }
      ]);
      
      return {
        name: 'Documentation Generation',
        description: `Generate documentation for ${docAnswers.patterns.join(', ')}`,
        ...docAnswers
      };
      
    case 'cicd':
      const cicdAnswers = await inquirer.prompt([
        {
          type: 'list',
          name: 'pipelineType',
          message: 'Pipeline type:',
          choices: ['standard', 'deployment', 'complete'],
          default: 'standard'
        },
        {
          type: 'input',
          name: 'linters',
          message: 'Linters to use (comma separated):',
          default: 'eslint,stylelint',
          filter: (input) => input.split(',').map((s: string) => s.trim())
        },
        {
          type: 'confirm',
          name: 'autoFix',
          message: 'Auto-fix linting issues?',
          default: false
        },
        {
          type: 'input',
          name: 'testTypes',
          message: 'Test types to run (comma separated):',
          default: 'unit,integration',
          filter: (input) => input.split(',').map((s: string) => s.trim())
        },
        {
          type: 'confirm',
          name: 'coverage',
          message: 'Collect test coverage?',
          default: true
        }
      ]);
      
      // Ask deployment questions if needed
      if (cicdAnswers.pipelineType === 'deployment' || cicdAnswers.pipelineType === 'complete') {
        const deployAnswers = await inquirer.prompt([
          {
            type: 'list',
            name: 'environment',
            message: 'Deployment environment:',
            choices: ['development', 'staging', 'production'],
            default: 'staging'
          },
          {
            type: 'list',
            name: 'deployStrategy',
            message: 'Deployment strategy:',
            choices: ['standard', 'blue-green', 'canary'],
            default: 'standard'
          },
          {
            type: 'confirm',
            name: 'notifications',
            message: 'Send notifications?',
            default: true
          }
        ]);
        
        Object.assign(cicdAnswers, deployAnswers);
      }
      
      return {
        name: `${cicdAnswers.pipelineType.charAt(0).toUpperCase() + cicdAnswers.pipelineType.slice(1)} CI/CD Pipeline`,
        description: `Run a ${cicdAnswers.pipelineType} CI/CD pipeline`,
        ...cicdAnswers
      };
      
    case 'data':
      const dataAnswers = await inquirer.prompt([
        {
          type: 'list',
          name: 'workflowType',
          message: 'Workflow type:',
          choices: ['processing', 'analysis', 'complete'],
          default: 'processing'
        },
        {
          type: 'input',
          name: 'sources',
          message: 'Data sources (comma separated):',
          default: 'local',
          filter: (input) => input.split(',').map((s: string) => s.trim())
        },
        {
          type: 'input',
          name: 'formats',
          message: 'Data formats (comma separated):',
          default: 'json,csv',
          filter: (input) => input.split(',').map((s: string) => s.trim())
        },
        {
          type: 'input',
          name: 'transformations',
          message: 'Transformations to apply (comma separated):',
          default: 'normalize,filter',
          filter: (input) => input.split(',').map((s: string) => s.trim())
        },
        {
          type: 'input',
          name: 'destination',
          message: 'Output destination:',
          default: './data/processed'
        }
      ]);
      
      // Ask analysis questions if needed
      if (dataAnswers.workflowType === 'analysis' || dataAnswers.workflowType === 'complete') {
        const analysisAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'analysisTypes',
            message: 'Analysis types (comma separated):',
            default: 'statistical,exploratory',
            filter: (input) => input.split(',').map((s: string) => s.trim())
          },
          {
            type: 'confirm',
            name: 'generateReports',
            message: 'Generate analysis reports?',
            default: true
          },
          {
            type: 'confirm',
            name: 'interactive',
            message: 'Create interactive visualizations?',
            default: true
          }
        ]);
        
        Object.assign(dataAnswers, analysisAnswers);
      }
      
      return {
        name: `Data ${dataAnswers.workflowType.charAt(0).toUpperCase() + dataAnswers.workflowType.slice(1)} Workflow`,
        description: `Process data with a ${dataAnswers.workflowType} workflow`,
        ...dataAnswers
      };
      
    case 'general':
    default:
      const generalAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Plan name:',
          default: 'General Plan'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Plan description:',
          default: 'General purpose sequential execution plan'
        }
      ]);
      
      return generalAnswers;
  }
}

/**
 * Generate a human-readable summary of execution results
 * @param domain The domain of the plan
 * @param plan The executed plan
 * @param executedSteps The steps that were executed
 * @param executionResults The execution results
 * @returns Formatted summary
 */
function generateSummary(
  domain: Domain, 
  plan: Plan, 
  executedSteps: PlanStep[], 
  executionResults: Record<string, ExecutionResult>
): string {
  const completedCount = executedSteps.filter(s => s.status === 'completed').length;
  const skippedCount = executedSteps.filter(s => s.status === 'skipped').length;
  const failedCount = executedSteps.filter(s => s.status === 'failed').length;
  
  let summary = '';
  
  // Add domain-specific summary
  switch (domain) {
    case 'documentation':
      const docResults = Object.values(executionResults)
        .filter(r => r.success)
        .reduce((acc, r) => {
          if (r.data?.generatedFiles) {
            acc.generatedFiles = (acc.generatedFiles || []).concat(r.data.generatedFiles);
          }
          if (r.data?.apiDocFiles) {
            acc.apiDocFiles = (acc.apiDocFiles || []).concat(r.data.apiDocFiles);
          }
          return acc;
        }, {} as any);
      
      const docFileCount = (docResults.generatedFiles?.length || 0) + (docResults.apiDocFiles?.length || 0);
      
      summary += `Documentation generated with ${docFileCount} files.\n`;
      if (docResults.generatedFiles?.length > 0) {
        summary += `Main documentation files: ${docResults.generatedFiles.length}\n`;
      }
      if (docResults.apiDocFiles?.length > 0) {
        summary += `API documentation files: ${docResults.apiDocFiles.length}\n`;
      }
      break;
      
    case 'cicd':
      const deployResult = Object.values(executionResults)
        .find(r => r.success && r.data?.deployResults);
      
      if (deployResult) {
        const deployData = deployResult.data?.deployResults;
        summary += `Deployed to ${deployData.environment} environment.\n`;
        summary += `Deployment URL: ${deployData.url}\n`;
        summary += `Deployment ID: ${deployData.deploymentId}\n`;
      } else {
        summary += `CI process completed with ${completedCount} successful steps.\n`;
      }
      break;
      
    case 'data':
      const dataResults = Object.values(executionResults)
        .filter(r => r.success)
        .reduce((acc, r) => {
          if (r.data?.dataCollectionResults) {
            acc.recordsCollected = r.data.dataCollectionResults.totalRecords;
          }
          if (r.data?.transformationResults) {
            acc.recordsTransformed = r.data.transformationResults.outputRecords;
          }
          if (r.data?.storageResults) {
            acc.storageResults = r.data.storageResults;
          }
          return acc;
        }, {} as any);
      
      if (dataResults.recordsCollected) {
        summary += `Collected ${dataResults.recordsCollected} records.\n`;
      }
      if (dataResults.recordsTransformed) {
        summary += `Transformed ${dataResults.recordsTransformed} records.\n`;
      }
      if (dataResults.storageResults) {
        summary += `Stored ${dataResults.storageResults.files.length} files (${Math.round(dataResults.storageResults.totalSize/1024/1024 * 100) / 100}MB).\n`;
        summary += `Storage location: ${dataResults.storageResults.destination}\n`;
      }
      break;
      
    default:
      summary += `Plan executed with ${completedCount} successful steps.\n`;
      break;
  }
  
  // Add statistics
  summary += `\nStatistics:\n`;
  summary += `- Total steps: ${plan.steps.length}\n`;
  summary += `- Completed: ${completedCount}\n`;
  summary += `- Skipped: ${skippedCount}\n`;
  summary += `- Failed: ${failedCount}\n`;
  
  // Add failed step details if any
  if (failedCount > 0) {
    summary += `\nFailed steps:\n`;
    executedSteps
      .filter(s => s.status === 'failed')
      .forEach(step => {
        const result = executionResults[step.id];
        summary += `- ${step.name}: ${result?.error || 'Unknown error'}\n`;
      });
  }
  
  return summary;
}

export default sequentialExecuteCommand;