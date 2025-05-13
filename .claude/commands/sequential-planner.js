#!/usr/bin/env node

/**
 * Sequential Planner CLI Command
 * 
 * This command allows using the sequential planner from the command line.
 */

const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const sequentialPlanner = require('../../tools/mcp/sequential_planner');

/**
 * Run the sequential planner command
 * @param {Object} options - Command options
 */
async function run(options = {}) {
  console.log(chalk.bold.blue('📝 Sequential Planner'));
  console.log(chalk.gray('Integrate sequential thinking, Context7, and 21st-dev-magic'));
  console.log();
  
  // Prompt for the goal if not provided
  let goal = options.goal;
  if (!goal) {
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'goal',
        message: 'What goal would you like to plan for?',
        validate: input => input.trim() ? true : 'Goal is required'
      }
    ]);
    goal = answer.goal;
  }
  
  // Generate plan
  const spinner = ora('Generating plan...').start();
  let plan;
  try {
    plan = await sequentialPlanner.generatePlan(goal, {
      initialSteps: options.steps || 5,
      depth: options.depth || 'medium'
    });
    spinner.succeed(`Generated plan with ${plan.length} steps`);
  } catch (err) {
    spinner.fail(`Failed to generate plan: ${err.message}`);
    process.exit(1);
  }
  
  // Display the plan
  console.log();
  console.log(chalk.bold('🔍 Plan:'));
  plan.forEach((step, index) => {
    const stepNumber = chalk.bold.white(`Step ${step.number}:`);
    const actionType = getActionTypeChalk(step.actionType);
    console.log(`${stepNumber} ${actionType} ${step.description}`);
  });
  
  // Ask if the user wants to execute the plan
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
    const fs = require('fs');
    const path = require('path');
    
    const { filePath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'filePath',
        message: 'Where would you like to save the plan?',
        default: `sequential-plan-${new Date().toISOString().split('T')[0]}.json`
      }
    ]);
    
    // Ensure the directory exists
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    // Save the plan
    fs.writeFileSync(
      filePath,
      JSON.stringify({ goal, plan, timestamp: new Date().toISOString() }, null, 2)
    );
    
    console.log(chalk.green(`Plan saved to ${filePath}`));
    return;
  }
  
  // Execute the plan
  const executedSteps = [];
  
  if (executeOptions === 'step') {
    // Execute step by step
    for (const step of plan) {
      console.log();
      console.log(chalk.bold.white(`Step ${step.number}:`), step.description);
      console.log(chalk.gray(`Action type: ${step.actionType}`));
      
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
        executedSteps.push({
          ...step,
          status: 'skipped',
          result: {
            type: 'skipped',
            summary: 'Step was skipped'
          }
        });
        console.log(chalk.yellow('Step skipped'));
        continue;
      }
      
      // Execute the step
      const executeSpinner = ora(`Executing step ${step.number}...`).start();
      try {
        let result;
        
        if (step.actionType === 'manual') {
          // For manual steps, prompt for the result
          executeSpinner.stop();
          
          const { manualResult } = await inquirer.prompt([
            {
              type: 'input',
              name: 'manualResult',
              message: 'Enter the result of this step:',
              default: 'Step executed manually'
            }
          ]);
          
          result = {
            type: 'manual',
            data: {},
            summary: manualResult
          };
        } else {
          // Execute automatically
          result = await sequentialPlanner.executeStep(step);
        }
        
        executedSteps.push({
          ...step,
          status: 'completed',
          result
        });
        
        executeSpinner.succeed(`Step ${step.number} executed`);
        
        if (result.type === 'context') {
          console.log(chalk.cyan('Found documents:'));
          result.data.forEach((doc, i) => {
            console.log(chalk.cyan.bold(`${i + 1}. ${doc.title}`));
            console.log(chalk.gray(doc.summary));
          });
        } else if (result.type === 'ui') {
          console.log(chalk.magenta(`Generated component: ${result.data.name}`));
          console.log(chalk.gray('Component code saved to memory'));
        }
      } catch (err) {
        executeSpinner.fail(`Failed to execute step: ${err.message}`);
        
        executedSteps.push({
          ...step,
          status: 'failed',
          result: {
            type: 'error',
            data: { error: err.message },
            summary: `Error: ${err.message}`
          }
        });
      }
    }
  } else if (executeOptions === 'auto') {
    // Execute automatically
    const executeSpinner = ora('Executing plan...').start();
    
    try {
      const result = await sequentialPlanner.runPlanningCycle(goal, async ({ step, isLastStep }) => {
        executeSpinner.text = `Executing step ${step.number}...`;
        
        // For manual steps in automatic mode, use a default result
        if (step.actionType === 'manual') {
          return {
            type: 'manual',
            data: {},
            summary: 'Step executed automatically in auto mode'
          };
        }
        
        // Otherwise, let the planner execute it
        return undefined;
      });
      
      executeSpinner.succeed('Plan executed successfully');
      
      executedSteps.push(...result.executedSteps);
    } catch (err) {
      executeSpinner.fail(`Failed to execute plan: ${err.message}`);
    }
  }
  
  // Generate summary if steps were executed
  if (executedSteps.length > 0) {
    console.log();
    console.log(chalk.bold('📊 Execution Summary:'));
    
    const completedCount = executedSteps.filter(s => s.status === 'completed').length;
    const skippedCount = executedSteps.filter(s => s.status === 'skipped').length;
    const failedCount = executedSteps.filter(s => s.status === 'failed').length;
    
    console.log(chalk.green(`Completed: ${completedCount}`));
    console.log(chalk.yellow(`Skipped: ${skippedCount}`));
    console.log(chalk.red(`Failed: ${failedCount}`));
    
    // Generate a full summary
    const summarySpinner = ora('Generating summary...').start();
    try {
      const summary = await sequentialPlanner.generateSummary(executedSteps);
      summarySpinner.succeed('Summary generated');
      
      console.log();
      console.log(chalk.bold('📝 Summary:'));
      console.log(summary);
    } catch (err) {
      summarySpinner.fail(`Failed to generate summary: ${err.message}`);
    }
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
    .option('goal', {
      describe: 'Goal to plan for',
      type: 'string'
    })
    .option('steps', {
      describe: 'Number of initial steps',
      type: 'number',
      default: 5
    })
    .option('depth', {
      describe: 'Thought depth (shallow, medium, deep)',
      type: 'string',
      default: 'medium',
      choices: ['shallow', 'medium', 'deep']
    })
    .help()
    .argv;
  
  run(argv).catch(err => {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  });
}

module.exports = { run };