#!/usr/bin/env node

/**
 * Claude Code CLI with Puter Claude 4 Integration
 * Enhanced version with keyless Claude 4 access
 */

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const boxen = require('boxen');
const figlet = require('figlet');
const Claude4API = require('./claude4-api');
const CodeAssistant = require('./code-assistant');
const WebInterface = require('./web-interface');

const program = new Command();
const claude4 = new Claude4API();
const codeAssistant = new CodeAssistant(claude4);

program
    .name('claude-puter')
    .description('Claude Code with Puter Claude 4 keyless integration')
    .version('1.0.0');

// Display welcome banner
function showWelcomeBanner() {
    console.log(chalk.cyan(figlet.textSync('Claude Code', { horizontalLayout: 'full' })));
    console.log(chalk.blue('Enhanced with Puter Claude 4 Integration'));
    console.log();
    
    const authStatus = claude4.getAuthStatus();
    if (authStatus.authenticated) {
        console.log(boxen(
            chalk.green(`✓ Authenticated as: ${authStatus.username}\n`) +
            chalk.blue(`Current Model: ${claude4.getModelInfo().name}\n`) +
            chalk.gray(`Available Models: ${authStatus.availableModels.length}`),
            { padding: 1, borderColor: 'green' }
        ));
    } else {
        console.log(boxen(
            chalk.yellow('⚠ Not authenticated\n') +
            chalk.gray('Sign in required for Claude 4 access\n') +
            chalk.blue('Use: claude-puter auth signin'),
            { padding: 1, borderColor: 'yellow' }
        ));
    }
    console.log();
}

// Authentication commands
program
    .command('auth')
    .description('Manage Puter authentication for Claude 4 access')
    .addCommand(
        new Command('signin')
            .description('Sign in to Puter for Claude 4 access')
            .action(async () => {
                try {
                    await claude4.ensureAuthenticated();
                    console.log(chalk.green('\n✓ Successfully authenticated with Puter!'));
                    console.log(chalk.blue('You now have access to Claude 4 models.'));
                } catch (error) {
                    console.error(chalk.red(`Authentication failed: ${error.message}`));
                    process.exit(1);
                }
            })
    )
    .addCommand(
        new Command('signout')
            .description('Sign out from Puter')
            .action(async () => {
                await claude4.signOut();
            })
    )
    .addCommand(
        new Command('status')
            .description('Show authentication status')
            .action(() => {
                const status = claude4.getAuthStatus();
                if (status.authenticated) {
                    console.log(chalk.green('✓ Authenticated'));
                    console.log(chalk.blue(`User: ${status.username}`));
                    console.log(chalk.blue(`Current Model: ${claude4.getModelInfo().name}`));
                    console.log(chalk.gray(`Available Models: ${status.availableModels.join(', ')}`));
                } else {
                    console.log(chalk.yellow('⚠ Not authenticated'));
                    console.log(chalk.gray(status.message));
                }
            })
    );

// Model management commands
program
    .command('model')
    .description('Manage Claude 4 models')
    .addCommand(
        new Command('list')
            .description('List available Claude 4 models')
            .action(() => {
                console.log(chalk.blue('Available Claude 4 Models:\n'));
                claude4.availableModels.forEach(modelId => {
                    const info = claude4.getModelInfo(modelId);
                    const current = modelId === claude4.currentModel ? chalk.green(' (current)') : '';
                    console.log(chalk.cyan(`${modelId}${current}`));
                    console.log(chalk.gray(`  ${info.description}`));
                    console.log(chalk.gray(`  Best for: ${info.bestFor.join(', ')}`));
                    console.log(chalk.gray(`  Speed: ${info.speed}, Reasoning: ${info.reasoning}`));
                    console.log();
                });
            })
    )
    .addCommand(
        new Command('set <model>')
            .description('Set the current Claude 4 model')
            .action((model) => {
                try {
                    claude4.setModel(model);
                } catch (error) {
                    console.error(chalk.red(error.message));
                    process.exit(1);
                }
            })
    )
    .addCommand(
        new Command('recommend <task>')
            .description('Get model recommendation for a task type')
            .option('-c, --complexity <level>', 'Task complexity (simple, medium, complex)', 'medium')
            .action((task, options) => {
                const recommended = claude4.selectOptimalModel(task, options.complexity);
                const info = claude4.getModelInfo(recommended);
                console.log(chalk.green(`Recommended model for ${task} (${options.complexity}): ${info.name}`));
                console.log(chalk.gray(`Reason: ${info.description}`));
                
                const answer = inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'switch',
                        message: 'Switch to this model?',
                        default: true
                    }
                ]);
                
                if (answer.switch) {
                    claude4.setModel(recommended);
                }
            })
    );

// Chat commands
program
    .command('chat [message]')
    .description('Start interactive chat with Claude 4')
    .option('-m, --model <model>', 'Specify Claude 4 model to use')
    .option('-s, --stream', 'Enable streaming responses')
    .action(async (message, options) => {
        if (options.model) {
            claude4.setModel(options.model);
        }
        
        if (message) {
            // Single message mode
            try {
                if (options.stream) {
                    console.log(chalk.blue('Response (streaming):'));
                    await claude4.streamingChat(message, (chunk) => {
                        process.stdout.write(chunk);
                    });
                    console.log('\n');
                } else {
                    const response = await claude4.chat(message);
                    console.log(chalk.blue('Response:'));
                    console.log(response.message.content[0].text);
                }
            } catch (error) {
                console.error(chalk.red(`Error: ${error.message}`));
                process.exit(1);
            }
        } else {
            // Interactive mode
            await startInteractiveChat(options);
        }
    });

// Code assistance commands
program
    .command('code')
    .description('Code assistance with Claude 4')
    .addCommand(
        new Command('review [file]')
            .description('Review code with Claude Opus 4')
            .action(async (file) => {
                await codeAssistant.reviewCode(file);
            })
    )
    .addCommand(
        new Command('explain [file]')
            .description('Explain code with Claude 4')
            .action(async (file) => {
                await codeAssistant.explainCode(file);
            })
    )
    .addCommand(
        new Command('generate <description>')
            .description('Generate code with Claude Sonnet 4')
            .option('-l, --language <lang>', 'Programming language', 'javascript')
            .action(async (description, options) => {
                await codeAssistant.generateCode(description, options.language);
            })
    )
    .addCommand(
        new Command('fix [file]')
            .description('Fix code issues with Claude 4')
            .action(async (file) => {
                await codeAssistant.fixCode(file);
            })
    );

// Web interface command
program
    .command('web')
    .description('Start web interface for Claude 4')
    .option('-p, --port <port>', 'Port number', '3000')
    .action(async (options) => {
        const webInterface = new WebInterface(claude4, options.port);
        await webInterface.start();
    });

// Compare models command
program
    .command('compare <prompt>')
    .description('Compare responses from different Claude 4 models')
    .option('-m, --models <models>', 'Comma-separated list of models', 'claude-sonnet-4,claude-opus-4')
    .action(async (prompt, options) => {
        const models = options.models.split(',').map(m => m.trim());
        try {
            const results = await claude4.compareModels(prompt, models);
            
            console.log(chalk.blue('\nModel Comparison Results:\n'));
            
            for (const [modelId, result] of Object.entries(results)) {
                console.log(chalk.cyan(`${result.model.name} (${modelId}):`));
                if (result.success) {
                    console.log(chalk.green(`Response Time: ${result.responseTime}ms`));
                    console.log(chalk.white(result.response.substring(0, 200) + '...'));
                } else {
                    console.log(chalk.red(`Error: ${result.error}`));
                }
                console.log(chalk.gray('─'.repeat(50)));
            }
        } catch (error) {
            console.error(chalk.red(`Comparison failed: ${error.message}`));
            process.exit(1);
        }
    });

// Interactive chat function
async function startInteractiveChat(options) {
    console.log(chalk.blue('Starting interactive chat with Claude 4...'));
    console.log(chalk.gray('Type "exit" to quit, "help" for commands\n'));
    
    while (true) {
        const { message } = await inquirer.prompt([
            {
                type: 'input',
                name: 'message',
                message: 'You:',
                prefix: chalk.blue('>')
            }
        ]);
        
        if (message.toLowerCase() === 'exit') {
            console.log(chalk.yellow('Goodbye!'));
            break;
        }
        
        if (message.toLowerCase() === 'help') {
            console.log(chalk.blue('Available commands:'));
            console.log(chalk.gray('  exit - Exit chat'));
            console.log(chalk.gray('  /model <name> - Switch model'));
            console.log(chalk.gray('  /status - Show current model'));
            console.log(chalk.gray('  /stream - Toggle streaming mode'));
            continue;
        }
        
        if (message.startsWith('/model ')) {
            const modelName = message.substring(7).trim();
            try {
                claude4.setModel(modelName);
            } catch (error) {
                console.error(chalk.red(error.message));
            }
            continue;
        }
        
        if (message === '/status') {
            const info = claude4.getModelInfo();
            console.log(chalk.blue(`Current model: ${info.name}`));
            continue;
        }
        
        try {
            console.log(chalk.blue('Claude 4:'));
            if (options.stream) {
                await claude4.streamingChat(message, (chunk) => {
                    process.stdout.write(chunk);
                });
                console.log('\n');
            } else {
                const response = await claude4.chat(message);
                console.log(response.message.content[0].text);
            }
        } catch (error) {
            console.error(chalk.red(`Error: ${error.message}`));
        }
        
        console.log();
    }
}

// Show banner and parse commands
if (process.argv.length === 2) {
    showWelcomeBanner();
    program.help();
} else {
    program.parse();
}