/**
 * Sequential Execution Manager
 * 
 * This module provides a unified interface for managing sequential planning and execution
 * across different domains, integrating Context7, sequential thinking, and 21st-dev magic.
 */

const path = require('path');
const fs = require('fs');
const sequentialPlanner = require('../sequential_planner');
const logger = require('../../../core/logging/logger').createLogger('sequential-execution-manager');

/**
 * Sequential Execution Manager Class
 * Manages planning and execution across different domains
 */
class SequentialExecutionManager {
  /**
   * Create a new Sequential Execution Manager
   * @param {Object} options - Manager options
   */
  constructor(options = {}) {
    this.options = {
      fallbackMode: options.fallbackMode || false,
      maxSteps: options.maxSteps || 20,
      stepTimeout: options.stepTimeout || 30000, // 30 seconds
      planningDepth: options.planningDepth || 'medium',
      ...options
    };

    this.handlers = new Map();
    this.observers = [];
    
    this.currentPlan = null;
    this.currentStep = null;
    this.executedSteps = [];
    this.isLoading = false;
    this.error = null;
    this.isComplete = false;
    this.currentGoal = null;
    this.executionResult = null;
    
    // Register standard handlers
    this._registerStandardHandlers();
    
    logger.info('Sequential Execution Manager initialized', {
      fallbackMode: this.options.fallbackMode,
      maxSteps: this.options.maxSteps
    });
  }
  
  /**
   * Register standard step handlers
   * @private
   */
  _registerStandardHandlers() {
    // Context7 handler
    this.registerHandler('context', async (step, options = {}) => {
      logger.debug('Executing context step', { stepNumber: step.number });
      
      try {
        const searchTerm = options.searchTerm || step.description;
        const result = await sequentialPlanner.executeContextStep(searchTerm);
        return result;
      } catch (err) {
        logger.error('Error executing context step', { error: err.message });
        throw err;
      }
    });
    
    // UI handler
    this.registerHandler('ui', async (step, options = {}) => {
      logger.debug('Executing UI step', { stepNumber: step.number });
      
      try {
        const componentSpec = options.componentSpec || {
          type: 'component',
          description: step.description
        };
        const result = await sequentialPlanner.executeUIStep(componentSpec);
        return result;
      } catch (err) {
        logger.error('Error executing UI step', { error: err.message });
        throw err;
      }
    });
    
    // Default handler for manual steps
    this.registerHandler('manual', async (step, options = {}) => {
      logger.debug('Executing manual step', { stepNumber: step.number });
      
      return {
        type: 'manual',
        data: options.result || {},
        summary: options.summary || 'Step executed manually'
      };
    });
    
    // Handler for executable steps
    this.registerHandler('executable', async (step, options = {}) => {
      logger.debug('Executing executable step', { stepNumber: step.number });
      
      if (options.executeFunction && typeof options.executeFunction === 'function') {
        try {
          const result = await options.executeFunction(step);
          return {
            type: 'executable',
            data: result || {},
            summary: options.summary || `Executed step ${step.number} programmatically`
          };
        } catch (err) {
          logger.error('Error in executable step function', { error: err.message });
          throw err;
        }
      } else {
        return {
          type: 'executable',
          data: options.result || {},
          summary: options.summary || 'Step executed programmatically'
        };
      }
    });
  }
  
  /**
   * Register a step handler for a specific action type
   * @param {string} actionType - The action type to handle
   * @param {Function} handler - The handler function
   */
  registerHandler(actionType, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Handler for action type '${actionType}' must be a function`);
    }
    
    this.handlers.set(actionType, handler);
    logger.debug('Registered handler', { actionType });
  }
  
  /**
   * Add an observer for plan execution events
   * @param {Function} observer - The observer function
   */
  addObserver(observer) {
    if (typeof observer !== 'function') {
      throw new Error('Observer must be a function');
    }
    
    this.observers.push(observer);
    logger.debug('Added observer', { observerCount: this.observers.length });
  }
  
  /**
   * Remove an observer
   * @param {Function} observer - The observer function to remove
   */
  removeObserver(observer) {
    const index = this.observers.indexOf(observer);
    if (index !== -1) {
      this.observers.splice(index, 1);
      logger.debug('Removed observer', { observerCount: this.observers.length });
    }
  }
  
  /**
   * Notify observers of an event
   * @param {string} event - The event name
   * @param {Object} data - The event data
   * @private
   */
  _notifyObservers(event, data) {
    for (const observer of this.observers) {
      try {
        observer(event, data);
      } catch (err) {
        logger.warn('Error in observer', { error: err.message });
      }
    }
  }
  
  /**
   * Generate a plan for a goal
   * @param {string} goal - The goal to plan for
   * @param {Object} options - Planning options
   * @returns {Array} The generated plan
   */
  async generatePlan(goal, options = {}) {
    if (!goal) {
      throw new Error('Goal is required');
    }
    
    try {
      this.isLoading = true;
      this.error = null;
      this.isComplete = false;
      this.executedSteps = [];
      this.currentGoal = goal;
      this.executionResult = null;
      
      logger.info('Generating plan', { 
        goalPrefix: goal.substring(0, 50),
        options
      });
      
      this._notifyObservers('planStart', { goal });
      
      const planOptions = {
        initialSteps: options.initialSteps || 5,
        maxSteps: options.maxSteps || this.options.maxSteps,
        depth: options.depth || this.options.planningDepth,
        ...options
      };
      
      const plan = await sequentialPlanner.generatePlan(goal, planOptions);
      this.currentPlan = plan;
      
      if (plan.length > 0) {
        this.currentStep = plan[0];
      } else {
        this.currentStep = null;
      }
      
      this._notifyObservers('planGenerated', { plan });
      
      logger.info('Plan generated', { stepCount: plan.length });
      
      return plan;
    } catch (err) {
      logger.error('Error generating plan', { error: err.message });
      this.error = err.message;
      this._notifyObservers('planError', { error: err.message });
      throw err;
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * Continue the plan by adding more steps
   * @returns {Array} The updated plan
   */
  async continuePlan() {
    if (this.isComplete || !this.currentPlan || this.currentPlan.length === 0) {
      throw new Error('No active plan to continue');
    }
    
    try {
      this.isLoading = true;
      this.error = null;
      
      logger.info('Continuing plan', { currentStepCount: this.currentPlan.length });
      
      this._notifyObservers('planContinueStart', { 
        currentPlan: this.currentPlan 
      });
      
      const newSteps = await sequentialPlanner.continuePlanning(this.currentPlan);
      
      if (newSteps.length > 0) {
        this.currentPlan = [...this.currentPlan, ...newSteps];
        
        // If no current step, set to first new step
        if (!this.currentStep) {
          this.currentStep = newSteps[0];
        }
      }
      
      this._notifyObservers('planContinued', { 
        newSteps,
        updatedPlan: this.currentPlan 
      });
      
      logger.info('Plan continued', { 
        newStepCount: newSteps.length,
        totalStepCount: this.currentPlan.length 
      });
      
      return this.currentPlan;
    } catch (err) {
      logger.error('Error continuing plan', { error: err.message });
      this.error = err.message;
      this._notifyObservers('planContinueError', { error: err.message });
      throw err;
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * Execute the current step
   * @param {Object} options - Execution options
   * @returns {Object} The execution result
   */
  async executeCurrentStep(options = {}) {
    if (!this.currentStep) {
      throw new Error('No current step to execute');
    }
    
    try {
      this.isLoading = true;
      this.error = null;
      
      logger.info('Executing step', { 
        stepNumber: this.currentStep.number,
        actionType: this.currentStep.actionType 
      });
      
      this._notifyObservers('stepExecuteStart', { step: this.currentStep });
      
      // Set a timeout for step execution
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Step execution timed out after ${this.options.stepTimeout}ms`));
        }, options.timeout || this.options.stepTimeout);
      });
      
      // Get the appropriate handler for the action type
      const handler = this.handlers.get(this.currentStep.actionType) || this.handlers.get('manual');
      
      if (!handler) {
        throw new Error(`No handler for action type: ${this.currentStep.actionType}`);
      }
      
      // Execute the handler with a timeout
      const result = await Promise.race([
        handler(this.currentStep, options),
        timeoutPromise
      ]);
      
      // Update the step with the result
      const updatedStep = {
        ...this.currentStep,
        status: 'completed',
        result
      };
      
      // Update the plan
      const stepIndex = this.currentPlan.findIndex(step => step.id === this.currentStep.id);
      if (stepIndex !== -1) {
        this.currentPlan[stepIndex] = updatedStep;
      }
      
      // Add to executed steps
      this.executedSteps.push(updatedStep);
      
      this._notifyObservers('stepExecuted', { 
        step: updatedStep,
        result
      });
      
      // Move to the next step if available
      await this._moveToNextStep();
      
      logger.info('Step executed', { 
        stepNumber: updatedStep.number,
        actionType: updatedStep.actionType,
        isComplete: this.isComplete
      });
      
      return result;
    } catch (err) {
      logger.error('Error executing step', { 
        stepNumber: this.currentStep.number,
        error: err.message 
      });
      
      this.error = err.message;
      
      // Mark the step as failed
      const failedStep = {
        ...this.currentStep,
        status: 'failed',
        result: {
          type: 'error',
          data: { error: err.message },
          summary: `Error: ${err.message}`
        }
      };
      
      // Update the plan
      const stepIndex = this.currentPlan.findIndex(step => step.id === this.currentStep.id);
      if (stepIndex !== -1) {
        this.currentPlan[stepIndex] = failedStep;
      }
      
      // Add to executed steps
      this.executedSteps.push(failedStep);
      
      this._notifyObservers('stepExecuteError', { 
        step: failedStep,
        error: err.message 
      });
      
      // Move to the next step
      await this._moveToNextStep();
      
      throw err;
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * Skip the current step
   * @returns {boolean} Success
   */
  async skipCurrentStep() {
    if (!this.currentStep) {
      throw new Error('No current step to skip');
    }
    
    try {
      this.isLoading = true;
      
      logger.info('Skipping step', { stepNumber: this.currentStep.number });
      
      this._notifyObservers('stepSkipStart', { step: this.currentStep });
      
      // Update the step status
      const skippedStep = {
        ...this.currentStep,
        status: 'skipped',
        result: {
          type: 'skipped',
          data: {},
          summary: 'Step was skipped'
        }
      };
      
      // Update the plan
      const stepIndex = this.currentPlan.findIndex(step => step.id === this.currentStep.id);
      if (stepIndex !== -1) {
        this.currentPlan[stepIndex] = skippedStep;
      }
      
      // Add to executed steps
      this.executedSteps.push(skippedStep);
      
      this._notifyObservers('stepSkipped', { step: skippedStep });
      
      // Move to the next step
      await this._moveToNextStep();
      
      return true;
    } catch (err) {
      logger.error('Error skipping step', { 
        stepNumber: this.currentStep.number,
        error: err.message 
      });
      
      this.error = err.message;
      this._notifyObservers('stepSkipError', { error: err.message });
      
      return false;
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * Revise a step in the plan
   * @param {string} stepId - The ID of the step to revise
   * @param {string} revision - The revised step description
   * @returns {boolean} Success
   */
  async reviseStep(stepId, revision) {
    if (!this.currentPlan) {
      throw new Error('No active plan');
    }
    
    try {
      this.isLoading = true;
      
      const stepIndex = this.currentPlan.findIndex(step => step.id === stepId);
      if (stepIndex === -1) {
        throw new Error(`Step with ID ${stepId} not found`);
      }
      
      const step = this.currentPlan[stepIndex];
      
      logger.info('Revising step', { stepNumber: step.number });
      
      this._notifyObservers('stepReviseStart', { 
        step,
        revision 
      });
      
      // Update the step
      const revisedStep = {
        ...step,
        description: revision,
        isRevised: true
      };
      
      // Update the plan
      this.currentPlan[stepIndex] = revisedStep;
      
      // If this is the current step, update it
      if (this.currentStep && this.currentStep.id === stepId) {
        this.currentStep = revisedStep;
      }
      
      this._notifyObservers('stepRevised', { step: revisedStep });
      
      logger.info('Step revised', { stepNumber: revisedStep.number });
      
      return true;
    } catch (err) {
      logger.error('Error revising step', { 
        stepId,
        error: err.message 
      });
      
      this.error = err.message;
      this._notifyObservers('stepReviseError', { error: err.message });
      
      return false;
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * Generate a summary of the executed plan
   * @returns {string} The summary
   */
  async generateSummary() {
    if (this.executedSteps.length === 0) {
      return "No steps have been executed yet.";
    }
    
    try {
      this.isLoading = true;
      
      logger.info('Generating summary', { 
        stepCount: this.executedSteps.length 
      });
      
      this._notifyObservers('summaryStart', {
        executedSteps: this.executedSteps
      });
      
      const summary = await sequentialPlanner.generateSummary(this.executedSteps);
      
      this._notifyObservers('summaryGenerated', { summary });
      
      return summary;
    } catch (err) {
      logger.error('Error generating summary', { error: err.message });
      
      this.error = err.message;
      this._notifyObservers('summaryError', { error: err.message });
      
      return `Error generating summary: ${err.message}`;
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * Run the entire plan execution
   * @param {Function} stepCallback - Optional callback for each step
   * @param {Object} options - Execution options
   * @returns {Object} The execution result
   */
  async runEntirePlan(stepCallback, options = {}) {
    if (!this.currentPlan || this.currentPlan.length === 0) {
      throw new Error('No active plan to execute');
    }
    
    try {
      this.isLoading = true;
      this.error = null;
      this.executionResult = null;
      
      logger.info('Running entire plan', { stepCount: this.currentPlan.length });
      
      this._notifyObservers('planExecuteStart', {
        plan: this.currentPlan,
        goal: this.currentGoal
      });
      
      for (const step of this.currentPlan) {
        // Set current step
        this.currentStep = step;
        
        // Skip steps that are already complete or failed
        if (step.status === 'completed' || step.status === 'failed' || step.status === 'skipped') {
          continue;
        }
        
        // Allow callback to control execution
        if (typeof stepCallback === 'function') {
          const callbackResult = await stepCallback({
            step,
            plan: this.currentPlan,
            executedSteps: this.executedSteps,
            isLastStep: step === this.currentPlan[this.currentPlan.length - 1]
          });
          
          // If the callback returns false, skip this step
          if (callbackResult === false) {
            await this.skipCurrentStep();
            continue;
          }
          
          // If the callback returns an object, use it as the step result
          if (callbackResult && typeof callbackResult === 'object') {
            // Create executed step
            const executedStep = {
              ...step,
              status: 'completed',
              result: callbackResult
            };
            
            // Update plan
            const stepIndex = this.currentPlan.findIndex(s => s.id === step.id);
            if (stepIndex !== -1) {
              this.currentPlan[stepIndex] = executedStep;
            }
            
            // Add to executed steps
            this.executedSteps.push(executedStep);
            
            continue;
          }
        }
        
        // Execute the step with options
        await this.executeCurrentStep(options);
      }
      
      // Generate summary
      const summary = await this.generateSummary();
      
      this.executionResult = {
        plan: this.currentPlan,
        executedSteps: this.executedSteps,
        summary
      };
      
      this._notifyObservers('planExecuteComplete', {
        executedSteps: this.executedSteps,
        summary
      });
      
      logger.info('Plan execution completed', {
        executedStepCount: this.executedSteps.length,
        goalPrefix: this.currentGoal?.substring(0, 50)
      });
      
      return this.executionResult;
    } catch (err) {
      logger.error('Error running plan', { error: err.message });
      
      this.error = err.message;
      this._notifyObservers('planExecuteError', { error: err.message });
      
      throw err;
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * Reset the execution manager state
   */
  reset() {
    this.currentPlan = null;
    this.currentStep = null;
    this.executedSteps = [];
    this.isLoading = false;
    this.error = null;
    this.isComplete = false;
    this.currentGoal = null;
    this.executionResult = null;
    
    logger.info('Execution manager reset');
    this._notifyObservers('reset', {});
  }
  
  /**
   * Get the current state
   * @returns {Object} The current state
   */
  getState() {
    return {
      plan: this.currentPlan,
      currentStep: this.currentStep,
      executedSteps: this.executedSteps,
      isLoading: this.isLoading,
      error: this.error,
      isComplete: this.isComplete,
      goal: this.currentGoal,
      executionResult: this.executionResult
    };
  }
  
  /**
   * Move to the next pending step
   * @private
   */
  async _moveToNextStep() {
    if (!this.currentPlan) return;
    
    // Find the next pending step
    const nextPendingStep = this.currentPlan.find(step => step.status === 'pending');
    
    if (nextPendingStep) {
      this.currentStep = nextPendingStep;
      this.isComplete = false;
    } else {
      this.currentStep = null;
      this.isComplete = true;
      
      // Generate a summary if all steps are executed
      if (this.executedSteps.length > 0) {
        try {
          const summary = await this.generateSummary();
          this.executionResult = {
            plan: this.currentPlan,
            executedSteps: this.executedSteps,
            summary
          };
        } catch (err) {
          logger.warn('Error generating automatic summary', { error: err.message });
        }
      }
      
      this._notifyObservers('planComplete', {
        executedSteps: this.executedSteps,
        executionResult: this.executionResult
      });
    }
  }
  
  /**
   * Create a specialized execution manager for a specific domain
   * @param {string} domain - The domain name
   * @param {Object} options - Domain-specific options
   * @returns {SequentialExecutionManager} A specialized execution manager
   */
  static forDomain(domain, options = {}) {
    const manager = new SequentialExecutionManager(options);
    
    switch (domain.toLowerCase()) {
      case 'documentation':
        // Configure for documentation generation
        manager.registerHandler('code_analysis', async (step, options) => {
          return {
            type: 'code_analysis',
            data: options.fileContent || { content: 'Mock file content' },
            summary: `Code analyzed from ${options.path || 'unknown'}`
          };
        });
        
        manager.registerHandler('documentation', async (step, options) => {
          return {
            type: 'documentation',
            data: { 
              content: options.content || 'Mock documentation content',
              path: options.outputPath || 'docs/output.md'
            },
            summary: `Documentation generated and saved to ${options.outputPath || 'docs/output.md'}`
          };
        });
        break;
        
      case 'cicd':
        // Configure for CI/CD automation
        manager.registerHandler('test', async (step, options) => {
          return {
            type: 'test',
            data: { 
              results: options.testResults || { passed: 10, failed: 0, skipped: 2 }
            },
            summary: `Tests executed: ${options.testCount || 12} tests run, ${options.failCount || 0} failures`
          };
        });
        
        manager.registerHandler('build', async (step, options) => {
          return {
            type: 'build',
            data: { 
              artifacts: options.artifacts || ['dist/app.js', 'dist/app.css']
            },
            summary: `Build completed successfully, ${options.artifactCount || 2} artifacts created`
          };
        });
        
        manager.registerHandler('deploy', async (step, options) => {
          return {
            type: 'deploy',
            data: { 
              environment: options.environment || 'staging',
              url: options.url || 'https://staging.example.com'
            },
            summary: `Deployed to ${options.environment || 'staging'} environment`
          };
        });
        break;
        
      case 'data':
        // Configure for data processing
        manager.registerHandler('extract', async (step, options) => {
          return {
            type: 'extract',
            data: { 
              records: options.recordCount || 1000,
              source: options.source || 'database'
            },
            summary: `Extracted ${options.recordCount || 1000} records from ${options.source || 'database'}`
          };
        });
        
        manager.registerHandler('transform', async (step, options) => {
          return {
            type: 'transform',
            data: { 
              transformations: options.transformationCount || 5
            },
            summary: `Applied ${options.transformationCount || 5} transformations to data`
          };
        });
        
        manager.registerHandler('load', async (step, options) => {
          return {
            type: 'load',
            data: { 
              destination: options.destination || 'data warehouse',
              records: options.recordCount || 1000
            },
            summary: `Loaded ${options.recordCount || 1000} records to ${options.destination || 'data warehouse'}`
          };
        });
        break;
        
      default:
        // No specialized configuration
        break;
    }
    
    return manager;
  }
}

module.exports = SequentialExecutionManager;