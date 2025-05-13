/**
 * Setup Chain of Command Module
 * 
 * This module implements the Chain of Command pattern for the setup process
 * in SAAR.sh, including rollback capabilities for each step.
 * 
 * Features:
 * - Sequential setup steps with dependencies
 * - Automatic rollback on failure
 * - Progress tracking
 * - Resumable setup process
 * - Custom validation for each step
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');
const { spawn, execSync } = require('child_process');

// Try to get error handler and config manager if available
let errorHandler, configManager;
try {
  const errorHandlerPath = path.join(__dirname, '../../core/error/error_handler.js.enhanced');
  if (fs.existsSync(errorHandlerPath)) {
    errorHandler = require(errorHandlerPath).defaultErrorHandler;
  } else {
    errorHandler = require('../../core/error/error_handler').defaultErrorHandler;
  }
} catch (error) {
  // Create simple logging function if error handler not available
  errorHandler = {
    log: (level, message, component) => {
      console.log(`[${level.toUpperCase()}] [${component}] ${message}`);
    },
    handleError: (error) => {
      console.error(`[ERROR] ${error.message}`);
      return error;
    }
  };
}

try {
  const configManagerPath = path.join(__dirname, '../../core/config/config_manager.js.enhanced');
  if (fs.existsSync(configManagerPath)) {
    configManager = require(configManagerPath).defaultConfigManager;
  } else {
    configManager = require('../../core/config/config_manager').defaultConfigManager;
  }
} catch (error) {
  // Simple config functions if config manager not available
  configManager = {
    get: (path, defaultValue) => defaultValue,
    set: () => true,
    initialize: () => ({}),
    loadFile: (filePath) => {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (error) {
        return {};
      }
    },
    saveFile: (filePath, content) => {
      try {
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
        return true;
      } catch (error) {
        return false;
      }
    }
  };
}

// Constants
const SETUP_STATES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ROLLED_BACK: 'rolled_back',
  SKIPPED: 'skipped'
};

/**
 * Setup Step class
 */
class SetupStep {
  constructor(options = {}) {
    this.options = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
      name: 'Unnamed Step',
      description: '',
      executor: null,
      rollback: null,
      validator: null,
      dependencies: [],
      optional: false,
      timeout: 60000, // 1 minute
      retryCount: 0,
      retryDelay: 3000, // 3 seconds
      ...options
    };
    
    this.state = SETUP_STATES.PENDING;
    this.error = null;
    this.result = null;
    this.startTime = null;
    this.endTime = null;
    this.retries = 0;
  }
  
  /**
   * Execute the step
   */
  async execute(context = {}) {
    if (this.state === SETUP_STATES.COMPLETED) {
      errorHandler.log('info', `Step ${this.options.name} already completed, skipping`, 'SetupChain');
      return { success: true, result: this.result };
    }
    
    if (!this.options.executor) {
      errorHandler.log('error', `Step ${this.options.name} has no executor`, 'SetupChain');
      this.state = SETUP_STATES.FAILED;
      return { success: false, error: new Error('No executor defined') };
    }
    
    try {
      errorHandler.log('info', `Executing step: ${this.options.name}`, 'SetupChain');
      this.state = SETUP_STATES.IN_PROGRESS;
      this.startTime = Date.now();
      
      // Create execution promise with timeout
      const executionPromise = new Promise(async (resolve, reject) => {
        try {
          // Call the executor with context
          const result = await this.options.executor(context);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      // Apply timeout
      const timeoutPromise = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Step timeout after ${this.options.timeout}ms`));
        }, this.options.timeout);
        
        // Clear timeout when execution promise resolves or rejects
        executionPromise
          .then(() => clearTimeout(timeoutId))
          .catch(() => clearTimeout(timeoutId));
      });
      
      // Race execution against timeout
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      // Validate result if validator exists
      if (this.options.validator) {
        const isValid = await this.options.validator(result, context);
        if (!isValid) {
          throw new Error(`Validation failed for step: ${this.options.name}`);
        }
      }
      
      // Success
      this.state = SETUP_STATES.COMPLETED;
      this.result = result;
      this.endTime = Date.now();
      
      errorHandler.log('info', `Step completed: ${this.options.name}`, 'SetupChain');
      
      return { success: true, result };
    } catch (error) {
      this.error = error;
      this.endTime = Date.now();
      
      // Check if retries are available
      if (this.retries < this.options.retryCount) {
        errorHandler.log('warn', `Retrying step ${this.options.name} (${this.retries + 1}/${this.options.retryCount})`, 'SetupChain');
        
        // Wait for retry delay
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
        
        this.retries++;
        return this.execute(context);
      }
      
      // Mark as failed if no more retries
      this.state = SETUP_STATES.FAILED;
      
      errorHandler.log('error', `Step failed: ${this.options.name} - ${error.message}`, 'SetupChain');
      
      return { success: false, error };
    }
  }
  
  /**
   * Rollback the step
   */
  async rollback(context = {}) {
    if (this.state !== SETUP_STATES.COMPLETED && this.state !== SETUP_STATES.FAILED) {
      return { success: true, message: `Step ${this.options.name} not executed, no rollback needed` };
    }
    
    if (!this.options.rollback) {
      errorHandler.log('warn', `No rollback defined for step: ${this.options.name}`, 'SetupChain');
      this.state = SETUP_STATES.ROLLED_BACK;
      return { success: true, message: 'No rollback defined' };
    }
    
    try {
      errorHandler.log('info', `Rolling back step: ${this.options.name}`, 'SetupChain');
      
      // Call the rollback function with context and step result
      await this.options.rollback(context, this.result);
      
      this.state = SETUP_STATES.ROLLED_BACK;
      
      errorHandler.log('info', `Rollback completed for step: ${this.options.name}`, 'SetupChain');
      
      return { success: true };
    } catch (error) {
      errorHandler.log('error', `Rollback failed for step ${this.options.name}: ${error.message}`, 'SetupChain');
      return { success: false, error };
    }
  }
  
  /**
   * Skip the step
   */
  skip() {
    if (this.state === SETUP_STATES.IN_PROGRESS || this.state === SETUP_STATES.COMPLETED) {
      return false;
    }
    
    this.state = SETUP_STATES.SKIPPED;
    errorHandler.log('info', `Step skipped: ${this.options.name}`, 'SetupChain');
    return true;
  }
  
  /**
   * Check if step can be executed based on dependencies
   */
  canExecute(completedStepIds) {
    if (this.state !== SETUP_STATES.PENDING) {
      return false;
    }
    
    if (!this.options.dependencies || this.options.dependencies.length === 0) {
      return true;
    }
    
    return this.options.dependencies.every(depId => completedStepIds.includes(depId));
  }
  
  /**
   * Get step status
   */
  getStatus() {
    return {
      id: this.options.id,
      name: this.options.name,
      description: this.options.description,
      state: this.state,
      duration: this.startTime && this.endTime ? this.endTime - this.startTime : null,
      error: this.error ? this.error.message : null,
      optional: this.options.optional,
      dependencies: this.options.dependencies,
      retries: this.retries
    };
  }
}

/**
 * Setup Chain class
 */
class SetupChain extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      name: 'Setup Chain',
      continueOnError: false,
      saveStateOnFailure: true,
      stateFile: path.join(os.homedir(), '.claude', 'setup_state.json'),
      logComponent: 'SetupChain',
      ...options
    };
    
    this.steps = [];
    this.context = {};
    this.currentStepIndex = -1;
    this.running = false;
    this.completed = false;
    this.failed = false;
    this.startTime = null;
    this.endTime = null;
  }
  
  /**
   * Add a setup step
   */
  addStep(stepOptions) {
    const step = stepOptions instanceof SetupStep 
      ? stepOptions 
      : new SetupStep(stepOptions);
    
    this.steps.push(step);
    
    return step.options.id;
  }
  
  /**
   * Add multiple steps at once
   */
  addSteps(stepsOptions) {
    const ids = [];
    
    for (const stepOptions of stepsOptions) {
      const id = this.addStep(stepOptions);
      ids.push(id);
    }
    
    return ids;
  }
  
  /**
   * Run the setup chain
   */
  async run(initialContext = {}) {
    if (this.running) {
      errorHandler.log('warn', 'Setup chain already running', this.options.logComponent);
      return { success: false, error: new Error('Already running') };
    }
    
    try {
      this.running = true;
      this.startTime = Date.now();
      this.context = { ...initialContext };
      
      // Emit start event
      this.emit('start', {
        name: this.options.name,
        stepCount: this.steps.length
      });
      
      errorHandler.log('info', `Starting setup chain: ${this.options.name} with ${this.steps.length} steps`, this.options.logComponent);
      
      // Try to load previous state
      this.loadState();
      
      // Execute steps
      const completedStepIds = this.steps
        .filter(step => step.state === SETUP_STATES.COMPLETED)
        .map(step => step.options.id);
      
      // Find next step to execute
      let nextStepIndex = this.findNextStep(completedStepIds);
      
      while (nextStepIndex !== -1) {
        this.currentStepIndex = nextStepIndex;
        const step = this.steps[nextStepIndex];
        
        // Emit step start event
        this.emit('stepStart', {
          index: nextStepIndex,
          id: step.options.id,
          name: step.options.name
        });
        
        // Execute step
        const result = await step.execute(this.context);
        
        if (result.success) {
          // Add step result to context
          this.context[step.options.id] = result.result;
          
          // Add to completed steps
          completedStepIds.push(step.options.id);
          
          // Emit step complete event
          this.emit('stepComplete', {
            index: nextStepIndex,
            id: step.options.id,
            name: step.options.name,
            duration: step.endTime - step.startTime
          });
        } else {
          // Emit step error event
          this.emit('stepError', {
            index: nextStepIndex,
            id: step.options.id,
            name: step.options.name,
            error: result.error.message
          });
          
          // Handle failure based on options
          if (!this.options.continueOnError && !step.options.optional) {
            // Save state if configured
            if (this.options.saveStateOnFailure) {
              this.saveState();
            }
            
            // Rollback if needed
            await this.rollback(nextStepIndex - 1);
            
            this.failed = true;
            this.endTime = Date.now();
            this.running = false;
            
            // Emit fail event
            this.emit('fail', {
              step: step.getStatus(),
              error: result.error.message
            });
            
            errorHandler.log('error', `Setup chain failed at step ${step.options.name}: ${result.error.message}`, this.options.logComponent);
            
            return { 
              success: false, 
              error: result.error, 
              completedSteps: completedStepIds.length,
              totalSteps: this.steps.length,
              failedStep: step.getStatus()
            };
          }
        }
        
        // Save state after each step
        this.saveState();
        
        // Find next step
        nextStepIndex = this.findNextStep(completedStepIds);
      }
      
      // Check if all required steps completed
      const allRequired = this.steps
        .filter(step => !step.options.optional)
        .every(step => step.state === SETUP_STATES.COMPLETED);
      
      this.completed = allRequired;
      this.endTime = Date.now();
      this.running = false;
      
      // Emit complete event if successful
      if (this.completed) {
        this.emit('complete', {
          stepCount: this.steps.length,
          duration: this.endTime - this.startTime
        });
        
        errorHandler.log('info', `Setup chain completed successfully: ${this.options.name}`, this.options.logComponent);
      } else {
        this.failed = true;
        
        // Emit fail event
        this.emit('fail', {
          reason: 'Not all required steps completed'
        });
        
        errorHandler.log('error', 'Not all required steps completed', this.options.logComponent);
      }
      
      return {
        success: this.completed,
        completedSteps: completedStepIds.length,
        totalSteps: this.steps.length,
        duration: this.endTime - this.startTime,
        context: this.context
      };
    } catch (error) {
      this.failed = true;
      this.endTime = Date.now();
      this.running = false;
      
      // Emit error event
      this.emit('error', {
        error: error.message
      });
      
      errorHandler.log('error', `Setup chain error: ${error.message}`, this.options.logComponent);
      
      return { 
        success: false, 
        error,
        completedSteps: this.steps.filter(step => step.state === SETUP_STATES.COMPLETED).length,
        totalSteps: this.steps.length
      };
    }
  }
  
  /**
   * Find the next step to execute
   */
  findNextStep(completedStepIds) {
    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      
      if (step.canExecute(completedStepIds)) {
        return i;
      }
    }
    
    return -1;
  }
  
  /**
   * Rollback the chain from a specific step
   */
  async rollback(fromStepIndex = this.steps.length - 1) {
    if (fromStepIndex < 0) {
      return { success: true, message: 'No steps to rollback' };
    }
    
    errorHandler.log('info', `Rolling back from step index ${fromStepIndex}`, this.options.logComponent);
    
    // Emit rollback start event
    this.emit('rollbackStart', {
      fromStep: this.steps[fromStepIndex].options.name
    });
    
    // Rollback steps in reverse order
    for (let i = fromStepIndex; i >= 0; i--) {
      const step = this.steps[i];
      
      if (step.state === SETUP_STATES.COMPLETED || step.state === SETUP_STATES.FAILED) {
        errorHandler.log('info', `Rolling back step: ${step.options.name}`, this.options.logComponent);
        
        // Emit step rollback event
        this.emit('stepRollback', {
          index: i,
          id: step.options.id,
          name: step.options.name
        });
        
        // Rollback step
        const result = await step.rollback(this.context);
        
        if (!result.success) {
          errorHandler.log('error', `Rollback failed for step ${step.options.name}: ${result.error.message}`, this.options.logComponent);
          
          // Emit rollback error event
          this.emit('rollbackError', {
            step: step.getStatus(),
            error: result.error.message
          });
        }
      }
    }
    
    // Emit rollback complete event
    this.emit('rollbackComplete');
    
    errorHandler.log('info', 'Rollback completed', this.options.logComponent);
    
    return { success: true };
  }
  
  /**
   * Save the current state to a file
   */
  saveState() {
    try {
      const state = {
        name: this.options.name,
        steps: this.steps.map(step => ({
          id: step.options.id,
          name: step.options.name,
          state: step.state,
          result: step.result,
          error: step.error ? step.error.message : null
        })),
        context: this.context,
        timestamp: new Date().toISOString()
      };
      
      fs.writeFileSync(this.options.stateFile, JSON.stringify(state, null, 2), 'utf8');
      
      return true;
    } catch (error) {
      errorHandler.log('error', `Failed to save state: ${error.message}`, this.options.logComponent);
      return false;
    }
  }
  
  /**
   * Load state from file
   */
  loadState() {
    try {
      if (!fs.existsSync(this.options.stateFile)) {
        return false;
      }
      
      const stateData = fs.readFileSync(this.options.stateFile, 'utf8');
      const state = JSON.parse(stateData);
      
      // Only load state if it's for the same chain
      if (state.name !== this.options.name) {
        return false;
      }
      
      // Update steps state
      for (const storedStep of state.steps) {
        const step = this.steps.find(s => s.options.id === storedStep.id);
        
        if (step) {
          step.state = storedStep.state;
          step.result = storedStep.result;
          
          if (storedStep.error) {
            step.error = new Error(storedStep.error);
          }
        }
      }
      
      // Update context
      if (state.context) {
        this.context = { ...this.context, ...state.context };
      }
      
      errorHandler.log('info', `Loaded state from ${this.options.stateFile}`, this.options.logComponent);
      
      return true;
    } catch (error) {
      errorHandler.log('error', `Failed to load state: ${error.message}`, this.options.logComponent);
      return false;
    }
  }
  
  /**
   * Get chain status
   */
  getStatus() {
    return {
      name: this.options.name,
      running: this.running,
      completed: this.completed,
      failed: this.failed,
      currentStep: this.currentStepIndex >= 0 ? this.steps[this.currentStepIndex].getStatus() : null,
      steps: this.steps.map(step => step.getStatus()),
      completedSteps: this.steps.filter(step => step.state === SETUP_STATES.COMPLETED).length,
      totalSteps: this.steps.length,
      duration: this.startTime && this.endTime ? this.endTime - this.startTime : null
    };
  }
  
  /**
   * Reset chain state
   */
  reset() {
    for (const step of this.steps) {
      step.state = SETUP_STATES.PENDING;
      step.error = null;
      step.result = null;
      step.startTime = null;
      step.endTime = null;
      step.retries = 0;
    }
    
    this.context = {};
    this.currentStepIndex = -1;
    this.running = false;
    this.completed = false;
    this.failed = false;
    this.startTime = null;
    this.endTime = null;
    
    // Remove state file if it exists
    if (fs.existsSync(this.options.stateFile)) {
      try {
        fs.unlinkSync(this.options.stateFile);
      } catch (error) {
        errorHandler.log('error', `Failed to remove state file: ${error.message}`, this.options.logComponent);
      }
    }
    
    return true;
  }
  
  /**
   * Get step by ID
   */
  getStep(stepId) {
    return this.steps.find(step => step.options.id === stepId);
  }
  
  /**
   * Skip a step by ID
   */
  skipStep(stepId) {
    const step = this.getStep(stepId);
    
    if (!step) {
      return false;
    }
    
    return step.skip();
  }
}

// Create setup chain for SAAR.sh
function createSaarSetupChain(options = {}) {
  const chain = new SetupChain({
    name: 'SAAR.sh Setup Chain',
    stateFile: path.join(os.homedir(), '.claude', 'saar_setup_state.json'),
    ...options
  });
  
  // Common step options
  const commonOptions = {
    timeout: 120000, // 2 minutes
    retryCount: 2
  };
  
  // Add steps
  chain.addStep({
    ...commonOptions,
    id: 'check_dependencies',
    name: 'Check Dependencies',
    description: 'Verify required system dependencies',
    executor: async (context) => {
      const dependencies = ['node', 'npm', 'python3', 'git'];
      const missing = [];
      
      for (const dep of dependencies) {
        try {
          execSync(`which ${dep}`, { stdio: 'ignore' });
        } catch (error) {
          missing.push(dep);
        }
      }
      
      if (missing.length > 0) {
        throw new Error(`Missing dependencies: ${missing.join(', ')}`);
      }
      
      return { dependencies };
    },
    validator: (result) => {
      return result && result.dependencies;
    },
    rollback: async () => {
      // No rollback needed for checking dependencies
      return true;
    }
  });
  
  chain.addStep({
    ...commonOptions,
    id: 'create_directories',
    name: 'Create Directories',
    description: 'Create necessary directories',
    dependencies: ['check_dependencies'],
    executor: async (context) => {
      const directories = [
        path.join(os.homedir(), '.claude'),
        path.join(os.homedir(), '.claude', 'config'),
        path.join(os.homedir(), '.claude', 'storage'),
        path.join(os.homedir(), '.claude', 'backups'),
        path.join(os.homedir(), '.claude', 'profiles'),
        path.join(os.homedir(), '.claude', 'agents'),
        path.join(os.homedir(), '.claude', 'logs')
      ];
      
      const created = [];
      
      for (const dir of directories) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          created.push(dir);
        }
      }
      
      return { created };
    },
    rollback: async (context, result) => {
      // Only remove directories that we created
      if (result && result.created) {
        for (const dir of result.created) {
          if (fs.existsSync(dir)) {
            fs.rmdirSync(dir, { recursive: true });
          }
        }
      }
      
      return true;
    }
  });
  
  chain.addStep({
    ...commonOptions,
    id: 'install_packages',
    name: 'Install Packages',
    description: 'Install required npm packages',
    dependencies: ['check_dependencies', 'create_directories'],
    executor: async (context) => {
      return new Promise((resolve, reject) => {
        const npm = spawn('npm', ['install', '--quiet'], {
          stdio: 'pipe'
        });
        
        let output = '';
        
        npm.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        npm.stderr.on('data', (data) => {
          output += data.toString();
        });
        
        npm.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`npm install failed with code ${code}: ${output}`));
          } else {
            resolve({ code, output });
          }
        });
      });
    },
    rollback: async () => {
      // No rollback for npm install - would need to track installed packages
      return true;
    }
  });
  
  chain.addStep({
    ...commonOptions,
    id: 'create_config',
    name: 'Create Configuration',
    description: 'Create default configuration files',
    dependencies: ['create_directories'],
    executor: async (context) => {
      const configFiles = {
        'global_config.json': {
          version: '1.0.0',
          setup: {
            completed: true,
            timestamp: new Date().toISOString()
          }
        },
        'mcp_config.json': {
          version: '1.0.0',
          servers: {
            sequentialthinking: {
              enabled: true,
              autostart: true,
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
              description: 'Recursive thought generation for complex problems'
            },
            'brave-search': {
              enabled: true,
              autostart: false,
              command: 'npx',
              args: ['-y', '@smithery/cli@latest', 'run', '@smithery-ai/brave-search'],
              api_key_env: 'MCP_API_KEY',
              description: 'External knowledge acquisition'
            }
          }
        }
      };
      
      const createdFiles = [];
      
      for (const [fileName, content] of Object.entries(configFiles)) {
        const filePath = path.join(os.homedir(), '.claude', 'config', fileName);
        
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
          createdFiles.push(filePath);
        }
      }
      
      return { createdFiles };
    },
    rollback: async (context, result) => {
      if (result && result.createdFiles) {
        for (const file of result.createdFiles) {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        }
      }
      
      return true;
    }
  });
  
  chain.addStep({
    ...commonOptions,
    id: 'setup_git_agent',
    name: 'Setup Git Agent',
    description: 'Configure git agent',
    dependencies: ['install_packages'],
    optional: true,
    executor: async (context) => {
      const gitAgentPath = path.join(process.cwd(), 'scripts', 'setup', 'setup_git_agent.js');
      
      if (!fs.existsSync(gitAgentPath)) {
        throw new Error('Git agent setup script not found');
      }
      
      return new Promise((resolve, reject) => {
        const node = spawn('node', [gitAgentPath], {
          stdio: 'pipe'
        });
        
        let output = '';
        
        node.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        node.stderr.on('data', (data) => {
          output += data.toString();
        });
        
        node.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Git agent setup failed with code ${code}: ${output}`));
          } else {
            resolve({ code, output });
          }
        });
      });
    },
    rollback: async () => {
      // Git agent setup doesn't need rollback
      return true;
    }
  });
  
  chain.addStep({
    ...commonOptions,
    id: 'setup_neural_framework',
    name: 'Setup Neural Framework',
    description: 'Configure neural framework',
    dependencies: ['install_packages'],
    optional: true,
    executor: async (context) => {
      const neuralFrameworkPath = path.join(process.cwd(), 'scripts', 'setup', 'setup_neural_framework.sh.enhanced');
      const originalPath = path.join(process.cwd(), 'scripts', 'setup', 'setup_neural_framework.sh');
      
      // Use enhanced version if available, otherwise use original
      const scriptPath = fs.existsSync(neuralFrameworkPath) 
        ? neuralFrameworkPath 
        : originalPath;
      
      if (!fs.existsSync(scriptPath)) {
        throw new Error('Neural framework setup script not found');
      }
      
      // Make script executable
      try {
        fs.chmodSync(scriptPath, '755');
      } catch (error) {
        console.error(`Warning: Could not make ${scriptPath} executable: ${error.message}`);
      }
      
      return new Promise((resolve, reject) => {
        const bash = spawn('bash', [scriptPath], {
          stdio: 'pipe'
        });
        
        let output = '';
        
        bash.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        bash.stderr.on('data', (data) => {
          output += data.toString();
        });
        
        bash.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Neural framework setup failed with code ${code}: ${output}`));
          } else {
            resolve({ code, output });
          }
        });
      });
    },
    rollback: async () => {
      // Neural framework setup doesn't need rollback
      return true;
    }
  });
  
  chain.addStep({
    ...commonOptions,
    id: 'setup_recursive_debugging',
    name: 'Setup Recursive Debugging',
    description: 'Configure recursive debugging tools',
    dependencies: ['install_packages'],
    optional: true,
    executor: async (context) => {
      const recursiveDebuggingPath = path.join(process.cwd(), 'scripts', 'setup', 'install_recursive_debugging.sh');
      
      if (!fs.existsSync(recursiveDebuggingPath)) {
        throw new Error('Recursive debugging setup script not found');
      }
      
      // Make script executable
      try {
        fs.chmodSync(recursiveDebuggingPath, '755');
      } catch (error) {
        console.error(`Warning: Could not make ${recursiveDebuggingPath} executable: ${error.message}`);
      }
      
      return new Promise((resolve, reject) => {
        const bash = spawn('bash', [recursiveDebuggingPath, process.cwd()], {
          stdio: 'pipe'
        });
        
        let output = '';
        
        bash.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        bash.stderr.on('data', (data) => {
          output += data.toString();
        });
        
        bash.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Recursive debugging setup failed with code ${code}: ${output}`));
          } else {
            resolve({ code, output });
          }
        });
      });
    },
    rollback: async () => {
      // Recursive debugging setup doesn't need rollback
      return true;
    }
  });
  
  chain.addStep({
    ...commonOptions,
    id: 'setup_a2a',
    name: 'Setup Agent-to-Agent',
    description: 'Configure agent-to-agent communication',
    dependencies: ['install_packages'],
    executor: async (context) => {
      const a2aManagerPath = path.join(process.cwd(), 'core', 'mcp', 'a2a_manager.js.enhanced');
      const originalPath = path.join(process.cwd(), 'core', 'mcp', 'a2a_manager.js');
      
      // Use enhanced version if available, otherwise use original
      const scriptPath = fs.existsSync(a2aManagerPath) 
        ? a2aManagerPath 
        : originalPath;
      
      if (!fs.existsSync(scriptPath)) {
        throw new Error('A2A manager script not found');
      }
      
      return new Promise((resolve, reject) => {
        const node = spawn('node', [scriptPath, 'setup'], {
          stdio: 'pipe'
        });
        
        let output = '';
        
        node.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        node.stderr.on('data', (data) => {
          output += data.toString();
        });
        
        node.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`A2A setup failed with code ${code}: ${output}`));
          } else {
            resolve({ code, output });
          }
        });
      });
    },
    rollback: async () => {
      // A2A setup doesn't need rollback
      return true;
    }
  });
  
  chain.addStep({
    ...commonOptions,
    id: 'create_completion_file',
    name: 'Create Completion File',
    description: 'Create setup completion marker',
    dependencies: ['check_dependencies', 'create_directories', 'install_packages', 'create_config'],
    executor: async (context) => {
      const completionFile = path.join(os.homedir(), '.claude', 'setup_complete');
      
      fs.writeFileSync(completionFile, new Date().toISOString(), 'utf8');
      
      return { completionFile };
    },
    rollback: async (context, result) => {
      if (result && result.completionFile) {
        if (fs.existsSync(result.completionFile)) {
          fs.unlinkSync(result.completionFile);
        }
      }
      
      return true;
    }
  });
  
  return chain;
}

// Export modules
module.exports = {
  SetupChain,
  SetupStep,
  SETUP_STATES,
  createSaarSetupChain
};

// If this is the main module, run the setup chain
if (require.main === module) {
  const chain = createSaarSetupChain();
  
  // Log events
  chain.on('start', (data) => {
    console.log(`\nStarting setup: ${data.name} (${data.stepCount} steps)\n`);
  });
  
  chain.on('stepStart', (data) => {
    console.log(`[${data.index + 1}/${chain.steps.length}] Running: ${data.name}...`);
  });
  
  chain.on('stepComplete', (data) => {
    console.log(`[${data.index + 1}/${chain.steps.length}] Completed: ${data.name} (${data.duration}ms)`);
  });
  
  chain.on('stepError', (data) => {
    console.error(`[${data.index + 1}/${chain.steps.length}] Error: ${data.name} - ${data.error}`);
  });
  
  chain.on('complete', (data) => {
    console.log(`\nSetup completed successfully in ${data.duration}ms`);
  });
  
  chain.on('fail', (data) => {
    console.error('\nSetup failed:');
    
    if (data.step) {
      console.error(`Step: ${data.step.name}`);
      console.error(`Error: ${data.error}`);
    } else {
      console.error(`Reason: ${data.reason}`);
    }
  });
  
  chain.on('rollbackStart', (data) => {
    console.log(`\nRolling back from step: ${data.fromStep}`);
  });
  
  chain.on('stepRollback', (data) => {
    console.log(`Rolling back step: ${data.name}`);
  });
  
  chain.on('rollbackComplete', () => {
    console.log('Rollback completed');
  });
  
  // Run the chain
  chain.run()
    .then((result) => {
      if (result.success) {
        console.log('\nSetup completed successfully!');
        console.log(`Completed ${result.completedSteps}/${result.totalSteps} steps`);
      } else {
        console.error('\nSetup failed:');
        
        if (result.error) {
          console.error(`Error: ${result.error.message}`);
        }
        
        if (result.failedStep) {
          console.error(`Failed step: ${result.failedStep.name}`);
        }
        
        console.error(`Completed ${result.completedSteps}/${result.totalSteps} steps`);
      }
      
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error(`Unexpected error: ${error.message}`);
      process.exit(1);
    });
}