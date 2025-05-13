#!/usr/bin/env node

/**
 * Documentation Generator CLI Command
 * 
 * This command uses the Sequential Planner to generate comprehensive documentation
 * for code files and directories.
 */

const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs');
const docGenerator = require('../../tools/documentation/sequential_doc_generator');

/**
 * Run the documentation generator command
 * @param {Object} options - Command options
 */
async function run(options = {}) {
  console.log(chalk.bold.blue('📚 Documentation Generator'));
  console.log(chalk.gray('Generate comprehensive documentation with sequential planning'));
  console.log();
  
  // Validate options
  if (!options.path) {
    console.error(chalk.red('Error: Path is required'));
    console.log('Usage: claude-cli generate-documentation <path> [--format=<format>] [--output=<output>] [--includePrivate]');
    return;
  }
  
  // Resolve path
  const resolvedPath = path.resolve(process.cwd(), options.path);
  
  // Check if path exists
  if (!fs.existsSync(resolvedPath)) {
    console.error(chalk.red(`Error: Path does not exist: ${resolvedPath}`));
    return;
  }
  
  // Format options
  const format = options.format || 'markdown';
  if (!['markdown', 'md', 'html', 'json'].includes(format)) {
    console.error(chalk.red(`Error: Invalid format: ${format}. Supported formats: markdown, html, json`));
    return;
  }
  
  // Output path
  let outputPath = options.output;
  if (!outputPath) {
    const extension = format === 'markdown' ? 'md' : format;
    const fileName = path.basename(resolvedPath).replace(/\.[^/.]+$/, '');
    outputPath = path.join(process.cwd(), 'docs', `${fileName}.${extension}`);
  } else {
    outputPath = path.resolve(process.cwd(), outputPath);
  }
  
  // Show options
  console.log(chalk.bold('📋 Documentation Options:'));
  console.log(chalk.gray(`Path: ${resolvedPath}`));
  console.log(chalk.gray(`Format: ${format}`));
  console.log(chalk.gray(`Output: ${outputPath}`));
  console.log(chalk.gray(`Include Private: ${options.includePrivate ? 'Yes' : 'No'}`));
  console.log();
  
  // Generate documentation
  const spinner = ora('Generating documentation...').start();
  
  try {
    const result = await docGenerator.generateDocumentation({
      path: resolvedPath,
      format,
      output: outputPath,
      includePrivate: options.includePrivate
    });
    
    if (result.success) {
      spinner.succeed('Documentation generated successfully!');
      
      // Show executed steps
      console.log();
      console.log(chalk.bold('📝 Generation Process:'));
      result.executedSteps.forEach((step, index) => {
        const stepNumber = chalk.bold.white(`Step ${step.number}:`);
        const statusColor = step.status === 'completed' ? chalk.green : chalk.yellow;
        console.log(`${stepNumber} ${statusColor(step.status)} - ${step.description.substring(0, 80)}${step.description.length > 80 ? '...' : ''}`);
        if (step.result) {
          console.log(`   ${chalk.gray('➔')} ${step.result.substring(0, 80)}${step.result.length > 80 ? '...' : ''}`);
        }
      });
      
      console.log();
      console.log(chalk.bold('🔍 Summary:'));
      console.log(result.summary);
      
      console.log();
      console.log(chalk.bold.green(`✅ Documentation saved to: ${outputPath}`));
      
      // Suggest next steps
      console.log();
      console.log(chalk.bold('📋 Next Steps:'));
      console.log(chalk.gray(`- Review the generated documentation`));
      console.log(chalk.gray(`- Manually add missing details if needed`));
      console.log(chalk.gray(`- Share with team members`));
    } else {
      spinner.fail(`Failed to generate documentation: ${result.error}`);
    }
  } catch (error) {
    spinner.fail(`Error generating documentation: ${error.message}`);
    console.error(chalk.red(error.stack));
  }
}

// If this script is run directly, execute the command
if (require.main === module) {
  // Parse command line arguments
  const argv = require('yargs')
    .usage('Usage: $0 <path> [options]')
    .demandCommand(1, 'Please provide a path to generate documentation for')
    .option('format', {
      describe: 'Output format',
      type: 'string',
      default: 'markdown',
      choices: ['markdown', 'md', 'html', 'json']
    })
    .option('output', {
      describe: 'Output file path',
      type: 'string'
    })
    .option('includePrivate', {
      describe: 'Whether to include private methods/properties',
      type: 'boolean',
      default: false
    })
    .help()
    .argv;
  
  run({
    path: argv._[0],
    format: argv.format,
    output: argv.output,
    includePrivate: argv.includePrivate
  }).catch(err => {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  });
}

module.exports = { run };