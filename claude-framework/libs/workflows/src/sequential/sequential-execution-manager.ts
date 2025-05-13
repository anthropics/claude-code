import { Logger } from '@claude-framework/core/logging';
import { ConfigManager } from '@claude-framework/core/config';
import { ExecutionError } from '@claude-framework/core/error';
import { 
  Domain,
  Plan, 
  PlanStep,
  ExecutionResult, 
  ExecutionObserver,
  SequentialExecutionManagerOptions,
  PlanExecutionResult
} from './types';
import { 
  BasePlanner,
  DocumentationPlanner,
  CICDPlanner,
  DataPlanner
} from './planners';
import {
  BaseExecutor,
  DocumentationExecutor,
  CICDExecutor,
  DataExecutor
} from './executors';

/**
 * Sequential Execution Manager
 * Manages planning and execution for sequential tasks across different domains
 */
export class SequentialExecutionManager {
  private logger: Logger;
  private options: SequentialExecutionManagerOptions;
  private observers: ExecutionObserver[];
  private planners: Map<Domain, BasePlanner>;
  private executors: Map<Domain, BaseExecutor>;
  
  private currentPlan: Plan | null;
  private currentStep: PlanStep | null;
  private executedSteps: PlanStep[];
  private executionResults: Record<string, ExecutionResult>;
  private isLoading: boolean;
  private error: string | null;
  private isComplete: boolean;
  private domain: Domain;

  /**
   * Create a new Sequential Execution Manager
   * @param domain Domain to use for planning
   * @param options Manager options
   */
  constructor(domain: Domain = 'general', options: SequentialExecutionManagerOptions = {}) {
    this.logger = new Logger('SequentialExecutionManager');
    this.options = {
      fallbackMode: options.fallbackMode || false,
      maxSteps: options.maxSteps || 20,
      stepTimeout: options.stepTimeout || 30000, // 30 seconds
      planningDepth: options.planningDepth || 'medium',
      ...options
    };

    this.observers = [];
    this.planners = new Map();
    this.executors = new Map();
    
    this.currentPlan = null;
    this.currentStep = null;
    this.executedSteps = [];
    this.executionResults = {};
    this.isLoading = false;
    this.error = null;
    this.isComplete = false;
    this.domain = domain;

    // Register planners and executors
    this._registerPlannersAndExecutors();
    
    this.logger.info('Sequential Execution Manager initialized', {
      domain,
      fallbackMode: this.options.fallbackMode,
      maxSteps: this.options.maxSteps
    });
  }

  /**
   * Register planners and executors for different domains
   */
  private _registerPlannersAndExecutors(): void {
    // Register planners
    this.planners.set('documentation', new DocumentationPlanner());
    this.planners.set('cicd', new CICDPlanner());
    this.planners.set('data', new DataPlanner());

    // Register executors
    this.executors.set('documentation', new DocumentationExecutor());
    this.executors.set('cicd', new CICDExecutor());
    this.executors.set('data', new DataExecutor());
    
    this.logger.debug('Registered planners and executors', { 
      plannerCount: this.planners.size,
      executorCount: this.executors.size
    });
  }

  /**
   * Add an observer for plan execution events
   * @param observer Observer function
   */
  public addObserver(observer: ExecutionObserver): void {
    if (typeof observer !== 'function') {
      throw new Error('Observer must be a function');
    }
    
    this.observers.push(observer);
    this.logger.debug('Added observer', { observerCount: this.observers.length });
  }

  /**
   * Remove an observer
   * @param observer Observer function to remove
   */
  public removeObserver(observer: ExecutionObserver): void {
    const index = this.observers.indexOf(observer);
    if (index !== -1) {
      this.observers.splice(index, 1);
      this.logger.debug('Removed observer', { observerCount: this.observers.length });
    }
  }

  /**
   * Notify observers of an event
   * @param event Event name
   * @param data Event data
   */
  private _notifyObservers(event: string, data: any): void {
    for (const observer of this.observers) {
      try {
        observer(event, data);
      } catch (err) {
        this.logger.warn('Error in observer', { 
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
  }

  /**
   * Create a plan for the specified domain
   * @param params Planning parameters
   * @returns The created plan
   */
  public async createPlan(params: Record<string, any> = {}): Promise<Plan> {
    try {
      this.isLoading = true;
      this.error = null;
      
      this.logger.info('Creating plan', { domain: this.domain, params });
      
      this._notifyObservers('planStart', { domain: this.domain, params });
      
      // Get the planner for the domain
      const planner = this.planners.get(this.domain);
      if (!planner) {
        throw new Error(`No planner registered for domain: ${this.domain}`);
      }
      
      // In fallback mode, create a simple plan
      if (this.options.fallbackMode) {
        this.logger.info('Using fallback mode for planning');
        const plan = this._createFallbackPlan(params);
        this.currentPlan = plan;
        
        if (plan.steps.length > 0) {
          this.currentStep = plan.steps[0];
        } else {
          this.currentStep = null;
        }
        
        this._notifyObservers('planCreated', { plan });
        
        this.logger.info('Plan created', { 
          planId: plan.id, 
          stepCount: plan.steps.length 
        });
        
        return plan;
      }
      
      // Create the plan using the domain-specific planner
      const plan = await planner.createPlan(params);
      
      this.currentPlan = plan;
      
      if (plan.steps.length > 0) {
        this.currentStep = plan.steps[0];
      } else {
        this.currentStep = null;
      }
      
      this._notifyObservers('planCreated', { plan });
      
      this.logger.info('Plan created', { 
        planId: plan.id, 
        stepCount: plan.steps.length 
      });
      
      return plan;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error('Error creating plan', { error: errorMessage });
      
      this.error = errorMessage;
      this._notifyObservers('planError', { error: errorMessage });
      
      throw new ExecutionError(`Failed to create plan: ${errorMessage}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Create a fallback plan for testing purposes
   * @param params Planning parameters
   * @returns A simple fallback plan
   */
  private _createFallbackPlan(params: Record<string, any>): Plan {
    const timestamp = Date.now();
    let steps: PlanStep[] = [];
    
    // Create different fallback plans based on domain
    switch (this.domain) {
      case 'documentation':
        steps = [
          {
            id: `step-${timestamp}-1`,
            number: 1,
            name: 'Analyze codebase structure',
            description: 'Scan codebase to identify components requiring documentation',
            actionType: 'code_analysis',
            status: 'pending',
            data: { patterns: ['**/*.ts', '**/*.js'] }
          },
          {
            id: `step-${timestamp}-2`,
            number: 2,
            name: 'Extract documentation from code',
            description: 'Parse JSDoc, TSDoc and other documentation comments',
            status: 'pending',
            actionType: 'extract',
            dependsOn: [`step-${timestamp}-1`],
            data: { extractComments: true, extractTypes: true }
          },
          {
            id: `step-${timestamp}-3`,
            number: 3,
            name: 'Generate documentation',
            description: 'Create documentation files based on extracted information',
            status: 'pending',
            actionType: 'documentation',
            dependsOn: [`step-${timestamp}-2`],
            data: { format: 'markdown', outputDir: './docs' }
          }
        ];
        break;
        
      case 'cicd':
        steps = [
          {
            id: `step-${timestamp}-1`,
            number: 1,
            name: 'Lint code',
            description: 'Run code linting to ensure code quality',
            actionType: 'test',
            status: 'pending',
            data: { linters: ['eslint'], fix: false }
          },
          {
            id: `step-${timestamp}-2`,
            number: 2,
            name: 'Run tests',
            description: 'Execute test suite',
            actionType: 'test',
            status: 'pending',
            dependsOn: [`step-${timestamp}-1`],
            data: { testTypes: ['unit', 'integration'], coverage: true }
          },
          {
            id: `step-${timestamp}-3`,
            number: 3,
            name: 'Build project',
            description: 'Compile and build the project',
            actionType: 'build',
            status: 'pending',
            dependsOn: [`step-${timestamp}-2`],
            data: { production: true, optimize: true }
          }
        ];
        break;
        
      case 'data':
        steps = [
          {
            id: `step-${timestamp}-1`,
            number: 1,
            name: 'Collect data',
            description: 'Gather data from specified sources',
            actionType: 'extract',
            status: 'pending',
            data: { sources: ['local'], formats: ['json', 'csv'] }
          },
          {
            id: `step-${timestamp}-2`,
            number: 2,
            name: 'Transform data',
            description: 'Process and transform the data',
            actionType: 'transform',
            status: 'pending',
            dependsOn: [`step-${timestamp}-1`],
            data: { transformations: ['normalize', 'filter'], inPlace: false }
          },
          {
            id: `step-${timestamp}-3`,
            number: 3,
            name: 'Store processed data',
            description: 'Save the processed data to the target location',
            actionType: 'load',
            status: 'pending',
            dependsOn: [`step-${timestamp}-2`],
            data: { destination: './data/processed', format: 'json' }
          }
        ];
        break;
        
      default:
        steps = [
          {
            id: `step-${timestamp}-1`,
            number: 1,
            name: 'Research information',
            description: 'Gather information related to the task',
            actionType: 'context',
            status: 'pending'
          },
          {
            id: `step-${timestamp}-2`,
            number: 2,
            name: 'Process information',
            description: 'Process and analyze the gathered information',
            actionType: 'ui',
            status: 'pending',
            dependsOn: [`step-${timestamp}-1`]
          },
          {
            id: `step-${timestamp}-3`,
            number: 3,
            name: 'Generate output',
            description: 'Generate output based on processed information',
            actionType: 'manual',
            status: 'pending',
            dependsOn: [`step-${timestamp}-2`]
          }
        ];
        break;
    }
    
    return {
      id: `plan-${timestamp}`,
      name: params.name || `${this.domain.charAt(0).toUpperCase() + this.domain.slice(1)} Plan`,
      description: params.description || `Fallback plan for ${this.domain} domain`,
      domain: this.domain,
      steps,
      createdAt: new Date(),
      status: 'created'
    };
  }

  /**
   * Execute the current plan
   * @param options Execution options
   * @returns Results of the execution
   */
  public async executePlan(options: Record<string, any> = {}): Promise<PlanExecutionResult> {
    if (!this.currentPlan) {
      throw new Error('No current plan to execute');
    }
    
    try {
      this.isLoading = true;
      this.error = null;
      this.executedSteps = [];
      this.executionResults = {};
      this.isComplete = false;
      
      // Update plan status
      this.currentPlan.status = 'in_progress';
      
      this.logger.info('Executing plan', { 
        planId: this.currentPlan.id, 
        stepCount: this.currentPlan.steps.length 
      });
      
      this._notifyObservers('planExecuteStart', { plan: this.currentPlan });
      
      // Get the executor for the domain
      const executor = this.executors.get(this.domain);
      if (!executor) {
        throw new Error(`No executor registered for domain: ${this.domain}`);
      }
      
      // Build the execution context
      const context: Record<string, any> = {};
      
      // Process steps
      for (const step of this.currentPlan.steps) {
        // Set current step
        this.currentStep = step;
        
        // Check if dependencies are satisfied
        if (step.dependsOn && step.dependsOn.length > 0) {
          const unsatisfiedDeps = step.dependsOn.filter(depId => {
            const depStep = this.currentPlan!.steps.find(s => s.id === depId);
            return !depStep || depStep.status !== 'completed';
          });
          
          if (unsatisfiedDeps.length > 0) {
            this.logger.warn('Skipping step due to unsatisfied dependencies', { 
              stepId: step.id, 
              unsatisfiedDeps 
            });
            
            // Mark step as skipped
            step.status = 'skipped';
            this.executedSteps.push(step);
            
            this._notifyObservers('stepSkipped', { step });
            continue;
          }
        }
        
        // Mark step as in progress
        step.status = 'in_progress';
        this._notifyObservers('stepExecuteStart', { step });
        
        try {
          // Execute step with timeout
          const executorOptions = {
            ...options,
            timeout: options.timeout || this.options.stepTimeout,
            fallbackMode: this.options.fallbackMode
          };
          
          // Set a timeout for step execution
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Step execution timed out after ${executorOptions.timeout}ms`));
            }, executorOptions.timeout);
          });
          
          // Execute the step with timeout
          const result = await Promise.race([
            executor.executeStep(step, context),
            timeoutPromise
          ]);
          
          // Store result in execution context for future steps
          context[step.id] = result;
          
          // Update the step status
          step.status = 'completed';
          this.executedSteps.push(step);
          this.executionResults[step.id] = result;
          
          this._notifyObservers('stepExecuted', { step, result });
          
          this.logger.info('Step executed', { 
            stepId: step.id, 
            success: result.success
          });
          
          // If step failed and it's required for future steps, stop execution
          if (!result.success) {
            this.logger.warn('Step failed, but continuing execution', { 
              stepId: step.id,
              error: result.error
            });
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          this.logger.error('Error executing step', { 
            stepId: step.id, 
            error: errorMessage
          });
          
          // Create error result
          const errorResult: ExecutionResult = {
            type: 'error',
            data: { error: errorMessage },
            summary: `Error: ${errorMessage}`,
            success: false,
            stepId: step.id,
            error: errorMessage,
            message: `Error: ${errorMessage}`
          };
          
          // Store error result in context and results
          context[step.id] = errorResult;
          this.executionResults[step.id] = errorResult;
          
          // Update step status
          step.status = 'failed';
          this.executedSteps.push(step);
          
          this._notifyObservers('stepExecuteError', { step, error: errorMessage });
          
          // Stop execution if option is set
          if (options.stopOnError) {
            this.error = errorMessage;
            this.currentPlan.status = 'failed';
            break;
          }
        }
      }
      
      // Determine if plan was completed successfully
      const allStepsCompleted = this.currentPlan.steps.every(step => 
        step.status === 'completed' || step.status === 'skipped'
      );
      
      const success = allStepsCompleted && 
        Object.values(this.executionResults).every(result => result.success);
      
      // Update plan status
      this.currentPlan.status = success ? 'completed' : 'failed';
      this.isComplete = true;
      
      // Generate summary
      const summary = this._generateSummary();
      
      const executionResult: PlanExecutionResult = {
        planId: this.currentPlan.id,
        domain: this.domain,
        success,
        executedSteps: this.executedSteps,
        results: this.executionResults,
        summary
      };
      
      this._notifyObservers('planExecuteComplete', { executionResult });
      
      this.logger.info('Plan execution completed', { 
        planId: this.currentPlan.id, 
        success
      });
      
      return executionResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error('Error executing plan', { error: errorMessage });
      
      this.error = errorMessage;
      
      if (this.currentPlan) {
        this.currentPlan.status = 'failed';
      }
      
      this._notifyObservers('planExecuteError', { error: errorMessage });
      
      throw new ExecutionError(`Failed to execute plan: ${errorMessage}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Execute a specific step in the current plan
   * @param stepId ID of the step to execute
   * @param options Execution options
   * @returns Result of the execution
   */
  public async executeStep(stepId: string, options: Record<string, any> = {}): Promise<ExecutionResult> {
    if (!this.currentPlan) {
      throw new Error('No current plan to execute step from');
    }
    
    // Find the step in the plan
    const step = this.currentPlan.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step with ID ${stepId} not found in the current plan`);
    }
    
    try {
      this.isLoading = true;
      this.error = null;
      
      // Set current step
      this.currentStep = step;
      
      // Check if dependencies are satisfied
      if (step.dependsOn && step.dependsOn.length > 0) {
        const unsatisfiedDeps = step.dependsOn.filter(depId => {
          const depStep = this.currentPlan!.steps.find(s => s.id === depId);
          return !depStep || depStep.status !== 'completed';
        });
        
        if (unsatisfiedDeps.length > 0) {
          const error = `Cannot execute step: unsatisfied dependencies ${unsatisfiedDeps.join(', ')}`;
          this.logger.error(error);
          throw new Error(error);
        }
      }
      
      this.logger.info('Executing step', { 
        stepId: step.id, 
        name: step.name
      });
      
      // Mark step as in progress
      step.status = 'in_progress';
      this._notifyObservers('stepExecuteStart', { step });
      
      // Get the executor for the domain
      const executor = this.executors.get(this.domain);
      if (!executor) {
        throw new Error(`No executor registered for domain: ${this.domain}`);
      }
      
      // Build context from previously executed steps
      const context: Record<string, any> = {};
      for (const result of Object.entries(this.executionResults)) {
        context[result[0]] = result[1];
      }
      
      // Set a timeout for step execution
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Step execution timed out after ${options.timeout || this.options.stepTimeout}ms`));
        }, options.timeout || this.options.stepTimeout);
      });
      
      // Execute the step with timeout
      const result = await Promise.race([
        executor.executeStep(step, context),
        timeoutPromise
      ]);
      
      // Store result
      this.executionResults[step.id] = result;
      
      // Update step status
      step.status = result.success ? 'completed' : 'failed';
      
      // Add to executed steps if not already present
      if (!this.executedSteps.find(s => s.id === step.id)) {
        this.executedSteps.push(step);
      }
      
      this._notifyObservers('stepExecuted', { step, result });
      
      this.logger.info('Step executed', { 
        stepId: step.id, 
        success: result.success
      });
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error('Error executing step', { 
        stepId: step.id, 
        error: errorMessage
      });
      
      this.error = errorMessage;
      
      // Create error result
      const errorResult: ExecutionResult = {
        type: 'error',
        data: { error: errorMessage },
        summary: `Error: ${errorMessage}`,
        success: false,
        stepId: step.id,
        error: errorMessage,
        message: `Error: ${errorMessage}`
      };
      
      // Store error result
      this.executionResults[step.id] = errorResult;
      
      // Update step status
      step.status = 'failed';
      
      // Add to executed steps if not already present
      if (!this.executedSteps.find(s => s.id === step.id)) {
        this.executedSteps.push(step);
      }
      
      this._notifyObservers('stepExecuteError', { step, error: errorMessage });
      
      throw new ExecutionError(`Failed to execute step: ${errorMessage}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Skip a specific step in the current plan
   * @param stepId ID of the step to skip
   * @returns Success status
   */
  public skipStep(stepId: string): boolean {
    if (!this.currentPlan) {
      throw new Error('No current plan to skip step from');
    }
    
    // Find the step in the plan
    const step = this.currentPlan.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step with ID ${stepId} not found in the current plan`);
    }
    
    try {
      this.logger.info('Skipping step', { stepId: step.id });
      
      this._notifyObservers('stepSkipStart', { step });
      
      // Update step status
      step.status = 'skipped';
      
      // Add to executed steps if not already present
      if (!this.executedSteps.find(s => s.id === step.id)) {
        this.executedSteps.push(step);
      }
      
      this._notifyObservers('stepSkipped', { step });
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error('Error skipping step', { 
        stepId: step.id, 
        error: errorMessage
      });
      
      this._notifyObservers('stepSkipError', { error: errorMessage });
      
      return false;
    }
  }

  /**
   * Generate a summary of the executed plan
   * @returns Summary text
   */
  private _generateSummary(): string {
    if (!this.currentPlan || this.executedSteps.length === 0) {
      return 'No plan has been executed yet.';
    }
    
    const completedCount = this.executedSteps.filter(s => s.status === 'completed').length;
    const failedCount = this.executedSteps.filter(s => s.status === 'failed').length;
    const skippedCount = this.executedSteps.filter(s => s.status === 'skipped').length;
    
    // Determine successful steps
    const successfulSteps = this.executedSteps
      .filter(s => s.status === 'completed')
      .map(s => `- ${s.name || s.description}`).join('\n');
    
    // Determine failed steps
    const failedSteps = this.executedSteps
      .filter(s => s.status === 'failed')
      .map(s => {
        const result = this.executionResults[s.id];
        return `- ${s.name || s.description}: ${result?.error || 'Unknown error'}`;
      }).join('\n');
    
    // Generate summary
    let summary = `# ${this.currentPlan.name} Execution Summary\n\n`;
    summary += `## Overview\n\n`;
    summary += `- **Domain**: ${this.currentPlan.domain}\n`;
    summary += `- **Status**: ${this.currentPlan.status}\n`;
    summary += `- **Steps**: ${this.currentPlan.steps.length} total, ${completedCount} completed, ${failedCount} failed, ${skippedCount} skipped\n\n`;
    
    if (completedCount > 0) {
      summary += `## Completed Steps\n\n${successfulSteps}\n\n`;
    }
    
    if (failedCount > 0) {
      summary += `## Failed Steps\n\n${failedSteps}\n\n`;
    }
    
    summary += `## Execution Time\n\n`;
    summary += `Execution completed at ${new Date().toISOString()}\n`;
    
    return summary;
  }

  /**
   * Reset the execution manager state
   */
  public reset(): void {
    this.currentPlan = null;
    this.currentStep = null;
    this.executedSteps = [];
    this.executionResults = {};
    this.isLoading = false;
    this.error = null;
    this.isComplete = false;
    
    this.logger.info('Execution manager reset');
    this._notifyObservers('reset', {});
  }

  /**
   * Get the current state
   * @returns Current state object
   */
  public getState(): Record<string, any> {
    return {
      domain: this.domain,
      plan: this.currentPlan,
      currentStep: this.currentStep,
      executedSteps: this.executedSteps,
      executionResults: this.executionResults,
      isLoading: this.isLoading,
      error: this.error,
      isComplete: this.isComplete
    };
  }

  /**
   * Factory method to create a manager for a specific domain
   * @param domain Domain to create manager for
   * @param options Manager options
   * @returns Domain-specific manager instance
   */
  public static forDomain(domain: Domain, options: SequentialExecutionManagerOptions = {}): SequentialExecutionManager {
    return new SequentialExecutionManager(domain, options);
  }
}

/**
 * Export types
 */
export * from './types';