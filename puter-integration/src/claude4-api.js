/**
 * Puter Claude 4 API Integration
 * Provides keyless access to Claude 4 models through Puter.js
 */

const puter = require('./puter-sdk');
const chalk = require('chalk');
const ora = require('ora');

class Claude4API {
    constructor(options = {}) {
        this.currentModel = options.defaultModel || 'claude-sonnet-4';
        this.isAuthenticated = false;
        this.availableModels = [
            'claude-sonnet-4',
            'claude-opus-4', 
            'claude-3-7-sonnet',
            'claude-3-7-opus'
        ];
        this.modelInfo = {
            'claude-sonnet-4': {
                name: 'Claude Sonnet 4',
                description: 'Latest balanced model with enhanced reasoning',
                bestFor: ['coding', 'analysis', 'general tasks'],
                speed: 'Fast',
                reasoning: 'Excellent'
            },
            'claude-opus-4': {
                name: 'Claude Opus 4',
                description: 'Most powerful model for complex reasoning',
                bestFor: ['research', 'complex analysis', 'creative writing'],
                speed: 'Moderate',
                reasoning: 'Superior'
            },
            'claude-3-7-sonnet': {
                name: 'Claude 3.7 Sonnet',
                description: 'Fast responses with good capabilities',
                bestFor: ['quick tasks', 'simple coding', 'Q&A'],
                speed: 'Very Fast',
                reasoning: 'Good'
            },
            'claude-3-7-opus': {
                name: 'Claude 3.7 Opus',
                description: 'Advanced capabilities with good speed',
                bestFor: ['detailed analysis', 'advanced coding', 'research'],
                speed: 'Moderate',
                reasoning: 'Very Good'
            }
        };
        
        this.init();
    }
    
    async init() {
        try {
            await this.checkAuthentication();
            console.log(chalk.green('✓ Claude 4 API initialized with Puter integration'));
        } catch (error) {
            console.log(chalk.yellow('⚠ Claude 4 API initialized - authentication required'));
        }
    }
    
    async checkAuthentication() {
        this.isAuthenticated = puter.auth.isSignedIn();
        return this.isAuthenticated;
    }
    
    async ensureAuthenticated() {
        if (!this.isAuthenticated) {
            const spinner = ora('Signing in to Puter for Claude 4 access...').start();
            try {
                await puter.auth.signIn();
                this.isAuthenticated = true;
                spinner.succeed('Successfully signed in to Puter - Claude 4 access enabled');
                
                const user = puter.auth.getUser();
                console.log(chalk.blue(`Welcome ${user.username}! You now have access to Claude 4 models.`));
            } catch (error) {
                spinner.fail('Authentication failed');
                throw new Error('Authentication required for Claude 4 access. Please sign in to Puter.');
            }
        }
    }
    
    setModel(modelId) {
        if (this.availableModels.includes(modelId)) {
            this.currentModel = modelId;
            const info = this.modelInfo[modelId];
            console.log(chalk.cyan(`Switched to ${info.name} (${modelId})`));
            console.log(chalk.gray(`Best for: ${info.bestFor.join(', ')}`));
        } else {
            throw new Error(`Invalid Claude 4 model: ${modelId}. Available models: ${this.availableModels.join(', ')}`);
        }
    }
    
    getModelInfo(modelId = null) {
        const model = modelId || this.currentModel;
        return this.modelInfo[model];
    }
    
    selectOptimalModel(taskType, complexity = 'medium') {
        const modelMatrix = {
            coding: {
                simple: 'claude-3-7-sonnet',
                medium: 'claude-sonnet-4',
                complex: 'claude-opus-4'
            },
            analysis: {
                simple: 'claude-3-7-sonnet',
                medium: 'claude-sonnet-4', 
                complex: 'claude-opus-4'
            },
            creative: {
                simple: 'claude-3-7-sonnet',
                medium: 'claude-sonnet-4',
                complex: 'claude-opus-4'
            },
            research: {
                simple: 'claude-sonnet-4',
                medium: 'claude-opus-4',
                complex: 'claude-opus-4'
            }
        };
        
        return modelMatrix[taskType]?.[complexity] || 'claude-sonnet-4';
    }
    
    async chat(message, options = {}) {
        await this.ensureAuthenticated();
        
        const requestOptions = {
            model: options.model || this.currentModel,
            stream: options.stream || false,
            ...options
        };
        
        const modelInfo = this.getModelInfo(requestOptions.model);
        console.log(chalk.blue(`Using ${modelInfo.name} for this request...`));
        
        try {
            const response = await puter.ai.chat(message, requestOptions);
            return response;
        } catch (error) {
            console.error(chalk.red(`Claude 4 API error: ${error.message}`));
            throw error;
        }
    }
    
    async streamingChat(message, onChunk, options = {}) {
        await this.ensureAuthenticated();
        
        const requestOptions = {
            model: options.model || this.currentModel,
            stream: true,
            ...options
        };
        
        try {
            const response = await puter.ai.chat(message, requestOptions);
            
            for await (const chunk of response) {
                if (chunk.text) {
                    onChunk(chunk.text);
                }
            }
        } catch (error) {
            console.error(chalk.red(`Claude 4 streaming error: ${error.message}`));
            throw error;
        }
    }
    
    async compareModels(prompt, models = ['claude-sonnet-4', 'claude-opus-4']) {
        const results = {};
        
        console.log(chalk.yellow(`Comparing responses from ${models.length} Claude 4 models...`));
        
        for (const model of models) {
            const spinner = ora(`Getting response from ${this.getModelInfo(model).name}...`).start();
            try {
                const startTime = Date.now();
                const response = await this.chat(prompt, { model });
                const endTime = Date.now();
                
                results[model] = {
                    response: response.message.content[0].text,
                    responseTime: endTime - startTime,
                    success: true,
                    model: this.getModelInfo(model)
                };
                
                spinner.succeed(`${this.getModelInfo(model).name}: ${endTime - startTime}ms`);
            } catch (error) {
                results[model] = {
                    error: error.message,
                    success: false,
                    model: this.getModelInfo(model)
                };
                spinner.fail(`${this.getModelInfo(model).name}: Error`);
            }
        }
        
        return results;
    }
    
    async signOut() {
        try {
            await puter.auth.signOut();
            this.isAuthenticated = false;
            console.log(chalk.green('Successfully signed out from Puter'));
        } catch (error) {
            console.error(chalk.red(`Sign out failed: ${error.message}`));
        }
    }
    
    getAuthStatus() {
        if (this.isAuthenticated) {
            const user = puter.auth.getUser();
            return {
                authenticated: true,
                username: user.username,
                currentModel: this.currentModel,
                availableModels: this.availableModels
            };
        } else {
            return {
                authenticated: false,
                message: 'Sign in required for Claude 4 access'
            };
        }
    }
}

module.exports = Claude4API;