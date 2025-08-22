/**
 * Code Assistant with Claude 4 Integration
 * Specialized coding features using Puter's Claude 4 models
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');

class CodeAssistant {
    constructor(claude4API) {
        this.claude4 = claude4API;
    }
    
    async reviewCode(filePath) {
        if (!filePath) {
            const { file } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'file',
                    message: 'Enter file path to review:',
                    validate: (input) => input.trim() !== '' || 'File path is required'
                }
            ]);
            filePath = file;
        }
        
        const spinner = ora('Reading file and preparing review...').start();
        
        try {
            const code = await fs.readFile(filePath, 'utf8');
            const language = this.detectLanguage(filePath);
            
            spinner.text = 'Performing comprehensive code review with Claude Opus 4...';
            
            const prompt = `As Claude Opus 4, perform a comprehensive code review of this ${language} file (${path.basename(filePath)}):

\`\`\`${language}
${code}
\`\`\`

Please analyze:
1. Code quality and best practices
2. Potential bugs or security issues
3. Performance optimizations
4. Maintainability improvements
5. Documentation suggestions
6. Architecture and design patterns

Provide specific, actionable feedback with examples where appropriate.`;
            
            const response = await this.claude4.chat(prompt, { model: 'claude-opus-4' });
            
            spinner.succeed('Code review completed!');
            
            console.log(chalk.blue('\n📋 Code Review Results:\n'));
            console.log(chalk.cyan(`File: ${filePath}`));
            console.log(chalk.cyan(`Language: ${language}`));
            console.log(chalk.cyan(`Reviewed by: Claude Opus 4\n`));
            console.log(response.message.content[0].text);
            
            // Ask if user wants to save the review
            const { save } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'save',
                    message: 'Save review to file?',
                    default: false
                }
            ]);
            
            if (save) {
                const reviewPath = `${filePath}.review.md`;
                const reviewContent = `# Code Review: ${path.basename(filePath)}\n\n**Reviewed by:** Claude Opus 4\n**Date:** ${new Date().toISOString()}\n**Language:** ${language}\n\n## Review Results\n\n${response.message.content[0].text}`;
                
                await fs.writeFile(reviewPath, reviewContent);
                console.log(chalk.green(`Review saved to: ${reviewPath}`));
            }
            
        } catch (error) {
            spinner.fail('Code review failed');
            console.error(chalk.red(`Error: ${error.message}`));
        }
    }
    
    async explainCode(filePath) {
        if (!filePath) {
            const { file } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'file',
                    message: 'Enter file path to explain:',
                    validate: (input) => input.trim() !== '' || 'File path is required'
                }
            ]);
            filePath = file;
        }
        
        const spinner = ora('Reading file and preparing explanation...').start();
        
        try {
            const code = await fs.readFile(filePath, 'utf8');
            const language = this.detectLanguage(filePath);
            
            spinner.text = 'Generating detailed explanation with Claude Sonnet 4...';
            
            const prompt = `As Claude Sonnet 4, provide a comprehensive explanation of this ${language} code from ${path.basename(filePath)}:

\`\`\`${language}
${code}
\`\`\`

Please explain:
1. What this code does (high-level purpose)
2. How it works (step-by-step breakdown)
3. Key algorithms or patterns used
4. Important functions/classes and their roles
5. Dependencies and external interactions
6. Any notable design decisions

Make the explanation clear and educational, suitable for someone learning this codebase.`;
            
            const response = await this.claude4.chat(prompt, { model: 'claude-sonnet-4' });
            
            spinner.succeed('Code explanation completed!');
            
            console.log(chalk.blue('\n📖 Code Explanation:\n'));
            console.log(chalk.cyan(`File: ${filePath}`));
            console.log(chalk.cyan(`Language: ${language}`));
            console.log(chalk.cyan(`Explained by: Claude Sonnet 4\n`));
            console.log(response.message.content[0].text);
            
        } catch (error) {
            spinner.fail('Code explanation failed');
            console.error(chalk.red(`Error: ${error.message}`));
        }
    }
    
    async generateCode(description, language = 'javascript') {
        const spinner = ora('Generating code with Claude Sonnet 4...').start();
        
        try {
            const prompt = `As Claude Sonnet 4, generate ${language} code based on this description:

"${description}"

Requirements:
1. Write clean, well-structured code
2. Include comprehensive comments
3. Follow ${language} best practices
4. Add error handling where appropriate
5. Include usage examples
6. Make it production-ready

Provide the complete implementation with explanations.`;
            
            const response = await this.claude4.chat(prompt, { model: 'claude-sonnet-4' });
            
            spinner.succeed('Code generation completed!');
            
            console.log(chalk.blue('\n🔧 Generated Code:\n'));
            console.log(chalk.cyan(`Description: ${description}`));
            console.log(chalk.cyan(`Language: ${language}`));
            console.log(chalk.cyan(`Generated by: Claude Sonnet 4\n`));
            console.log(response.message.content[0].text);
            
            // Ask if user wants to save the code
            const { save } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'save',
                    message: 'Save generated code to file?',
                    default: true
                }
            ]);
            
            if (save) {
                const { filename } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'filename',
                        message: 'Enter filename:',
                        default: `generated-code.${this.getFileExtension(language)}`,
                        validate: (input) => input.trim() !== '' || 'Filename is required'
                    }
                ]);
                
                const codeContent = `// Generated by Claude Sonnet 4\n// Description: ${description}\n// Date: ${new Date().toISOString()}\n\n${response.message.content[0].text}`;
                
                await fs.writeFile(filename, codeContent);
                console.log(chalk.green(`Code saved to: ${filename}`));
            }
            
        } catch (error) {
            spinner.fail('Code generation failed');
            console.error(chalk.red(`Error: ${error.message}`));
        }
    }
    
    async fixCode(filePath) {
        if (!filePath) {
            const { file } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'file',
                    message: 'Enter file path to fix:',
                    validate: (input) => input.trim() !== '' || 'File path is required'
                }
            ]);
            filePath = file;
        }
        
        const spinner = ora('Analyzing code for issues...').start();
        
        try {
            const code = await fs.readFile(filePath, 'utf8');
            const language = this.detectLanguage(filePath);
            
            spinner.text = 'Identifying and fixing issues with Claude Opus 4...';
            
            const prompt = `As Claude Opus 4, analyze this ${language} code and fix any issues you find:

\`\`\`${language}
${code}
\`\`\`

Please:
1. Identify bugs, errors, or potential issues
2. Fix syntax errors and logical problems
3. Improve code quality and performance
4. Add missing error handling
5. Optimize where possible
6. Maintain the original functionality

Provide the corrected code with explanations of what was fixed.`;
            
            const response = await this.claude4.chat(prompt, { model: 'claude-opus-4' });
            
            spinner.succeed('Code analysis and fixes completed!');
            
            console.log(chalk.blue('\n🔧 Code Fixes:\n'));
            console.log(chalk.cyan(`File: ${filePath}`));
            console.log(chalk.cyan(`Language: ${language}`));
            console.log(chalk.cyan(`Fixed by: Claude Opus 4\n`));
            console.log(response.message.content[0].text);
            
            // Ask if user wants to apply the fixes
            const { apply } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'apply',
                    message: 'Apply fixes to the original file?',
                    default: false
                }
            ]);
            
            if (apply) {
                // Create backup first
                const backupPath = `${filePath}.backup.${Date.now()}`;
                await fs.copyFile(filePath, backupPath);
                console.log(chalk.yellow(`Backup created: ${backupPath}`));
                
                // Extract fixed code from response (this would need more sophisticated parsing)
                // For now, just save the full response
                const fixedContent = `// Fixed by Claude Opus 4\n// Original backed up to: ${backupPath}\n// Date: ${new Date().toISOString()}\n\n${response.message.content[0].text}`;
                
                await fs.writeFile(`${filePath}.fixed`, fixedContent);
                console.log(chalk.green(`Fixed code saved to: ${filePath}.fixed`));
                console.log(chalk.yellow('Please review the fixes before replacing the original file.'));
            }
            
        } catch (error) {
            spinner.fail('Code fixing failed');
            console.error(chalk.red(`Error: ${error.message}`));
        }
    }
    
    detectLanguage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.py': 'python',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp',
            '.php': 'php',
            '.rb': 'ruby',
            '.go': 'go',
            '.rs': 'rust',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.less': 'less',
            '.sql': 'sql',
            '.sh': 'bash',
            '.ps1': 'powershell',
            '.r': 'r',
            '.m': 'matlab',
            '.pl': 'perl'
        };
        
        return languageMap[ext] || 'text';
    }
    
    getFileExtension(language) {
        const extensionMap = {
            'javascript': 'js',
            'typescript': 'ts',
            'python': 'py',
            'java': 'java',
            'cpp': 'cpp',
            'c': 'c',
            'csharp': 'cs',
            'php': 'php',
            'ruby': 'rb',
            'go': 'go',
            'rust': 'rs',
            'swift': 'swift',
            'kotlin': 'kt',
            'scala': 'scala',
            'html': 'html',
            'css': 'css',
            'scss': 'scss',
            'sql': 'sql',
            'bash': 'sh',
            'powershell': 'ps1'
        };
        
        return extensionMap[language.toLowerCase()] || 'txt';
    }
}

module.exports = CodeAssistant;