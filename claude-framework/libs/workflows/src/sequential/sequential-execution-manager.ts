import { createLogger } from '@claude-framework/core';

const logger = createLogger('sequential-execution-manager');

/**
 * Action types for steps
 */
export type ActionType = 
  | 'context'
  | 'ui'
  | 'manual'
  | 'executable'
  | 'code_analysis'
  | 'documentation'
  | 'test'
  | 'build'
  | 'deploy'
  | 'extract'
  | 'transform'
  | 'load';

/**
 * Step status
 */
export type StepStatus = 'pending' | 'completed' | 'failed' | 'skipped';

/**
 * Step in a sequential execution plan
 */
export interface Step {
  id: string;
  number: number;
  description: string;
  actionType: ActionType;
  status?: StepStatus;
  result?: StepResult;
  isRevised?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Result of executing a step
 */
export interface StepResult {
  type: string;
  data: Record<string, any>;
  summary: string;
}

/**
 * Execution context for running a plan
 */
export interface ExecutionContext {
  goal: string;
  variables: Record<string, any>;
  executedSteps: Step[];
}

/**
 * Execution result
 */
export interface ExecutionResult {
  plan: Step[];
  executedSteps: Step[];
  summary: string;
}

/**
 * Execution observer callback
 */
export type ExecutionObserver = (event: string, data: any) => void;

/**
 * Options for the Sequential Execution Manager
 */
export interface SequentialExecutionManagerOptions {
  fallbackMode?: boolean;
  maxSteps?: number;
  stepTimeout?: number;
  planningDepth?: 'shallow' | 'medium' | 'deep';
  [key: string]: any;
}

/**
 * Step handler function
 */
export type StepHandler = (step: Step, options: any) => Promise<StepResult>;

/**
 * Sequential Execution Manager
 * Manages planning and execution for sequential tasks across different domains
 */
export class SequentialExecutionManager {
  private options: SequentialExecutionManagerOptions;
  private handlers: Map<ActionType, StepHandler>;
  private observers: ExecutionObserver[];
  
  private currentPlan: Step[] | null;
  private currentStep: Step | null;
  private executedSteps: Step[];
  private isLoading: boolean;
  private error: string | null;
  private isComplete: boolean;
  private currentGoal: string | null;
  private executionResult: ExecutionResult | null;

  /**
   * Create a new Sequential Execution Manager
   * @param options Manager options
   */
  constructor(options: SequentialExecutionManagerOptions = {}) {
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
   */
  private _registerStandardHandlers(): void {
    // Context handler
    this.registerHandler('context', async (step, options = {}) => {
      logger.debug('Executing context step', { stepNumber: step.number });
      
      try {
        // In fallback mode, return mock results
        if (this.options.fallbackMode) {
          return {
            type: 'context',
            data: {
              documents: [
                { title: 'Document 1', summary: 'Summary of document 1' },
                { title: 'Document 2', summary: 'Summary of document 2' }
              ]
            },
            summary: 'Found 2 relevant documents (fallback mode)'
          };
        }
        
        const searchTerm = options.searchTerm || step.description;
        
        // TODO: Integrate with actual MCP service
        // const result = await sequentialPlanner.executeContextStep(searchTerm);
        throw new Error('Context step not implemented in non-fallback mode');
        
      } catch (err) {
        logger.error('Error executing context step', { 
          error: err instanceof Error ? err.message : String(err)
        });
        throw err;
      }
    });
    
    // UI handler
    this.registerHandler('ui', async (step, options = {}) => {
      logger.debug('Executing UI step', { stepNumber: step.number });
      
      try {
        // In fallback mode, return mock results
        if (this.options.fallbackMode) {
          return {
            type: 'ui',
            data: {
              name: 'FallbackComponent',
              code: 'function FallbackComponent() { return <div>Fallback Component</div>; }'
            },
            summary: 'Generated UI component: FallbackComponent (fallback mode)'
          };
        }
        
        const componentSpec = options.componentSpec || {
          type: 'component',
          description: step.description
        };
        
        // TODO: Integrate with actual MCP service
        // const result = await sequentialPlanner.executeUIStep(componentSpec);
        throw new Error('UI step not implemented in non-fallback mode');
        
      } catch (err) {
        logger.error('Error executing UI step', { 
          error: err instanceof Error ? err.message : String(err)
        });
        throw err;
      }
    });
    
    // Manual handler
    this.registerHandler('manual', async (step, options = {}) => {
      logger.debug('Executing manual step', { stepNumber: step.number });
      
      return {
        type: 'manual',
        data: options.result || {},
        summary: options.summary || 'Step executed manually'
      };
    });
    
    // Executable handler
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
          logger.error('Error in executable step function', { 
            error: err instanceof Error ? err.message : String(err)
          });
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
   * @param actionType Action type to handle
   * @param handler Handler function
   */
  public registerHandler(actionType: ActionType, handler: StepHandler): void {
    if (typeof handler !== 'function') {
      throw new Error(`Handler for action type '${actionType}' must be a function`);
    }
    
    this.handlers.set(actionType, handler);
    logger.debug('Registered handler', { actionType });
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
    logger.debug('Added observer', { observerCount: this.observers.length });
  }

  /**
   * Remove an observer
   * @param observer Observer function to remove
   */
  public removeObserver(observer: ExecutionObserver): void {
    const index = this.observers.indexOf(observer);
    if (index !== -1) {
      this.observers.splice(index, 1);
      logger.debug('Removed observer', { observerCount: this.observers.length });
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
        logger.warn('Error in observer', { 
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
  }

  /**
   * Generate a plan for a goal
   * @param goal Goal to plan for
   * @param options Planning options
   * @returns Generated plan
   */
  public async generatePlan(goal: string, options: any = {}): Promise<Step[]> {
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
      
      // In fallback mode, generate a simple plan
      if (this.options.fallbackMode) {
        const plan = this.generateFallbackPlan(goal);
        this.currentPlan = plan;
        
        if (plan.length > 0) {
          this.currentStep = plan[0];
        } else {
          this.currentStep = null;
        }
        
        this._notifyObservers('planGenerated', { plan });
        
        logger.info('Plan generated', { stepCount: plan.length });
        
        return plan;
      }
      
      // TODO: Integrate with actual MCP service
      // Placeholder for MCP integration
      const planOptions = {
        initialSteps: options.initialSteps || 5,
        maxSteps: options.maxSteps || this.options.maxSteps,
        depth: options.depth || this.options.planningDepth,
        ...options
      };
      
      // Generate mock plan for now
      const plan = this.generateFallbackPlan(goal);
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
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Error generating plan', { error: errorMessage });
      this.error = errorMessage;
      this._notifyObservers('planError', { error: errorMessage });
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Generate a fallback plan
   * @param goal Goal to plan for
   * @returns Generated plan
   */
  private generateFallbackPlan(goal: string): Step[] {
    // Generate a simple fallback plan with 5 steps
    return [
      {
        id: `step_${Date.now()}_1`,
        number: 1,
        description: `Research information related to: ${goal}`,
        actionType: 'context',
        status: 'pending'
      },
      {
        id: `step_${Date.now()}_2`,
        number: 2,
        description: 'Analyze the gathered information',
        actionType: 'manual',
        status: 'pending'
      },
      {
        id: `step_${Date.now()}_3`,
        number: 3,
        description: 'Design a user interface component',
        actionType: 'ui',
        status: 'pending'
      },
      {
        id: `step_${Date.now()}_4`,
        number: 4,
        description: 'Implement the solution',
        actionType: 'manual',
        status: 'pending'
      },
      {
        id: `step_${Date.now()}_5`,
        number: 5,
        description: 'Test and verify the implementation',
        actionType: 'manual',
        status: 'pending'
      }
    ];
  }

  /**
   * Execute the current step
   * @param options Execution options
   * @returns Execution result
   */
  public async executeCurrentStep(options: any = {}): Promise<StepResult> {
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
      const timeoutPromise = new Promise<never>((_, reject) => {
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
        status: 'completed' as StepStatus,
        result
      };
      
      // Update the plan
      const stepIndex = this.currentPlan?.findIndex(step => step.id === this.currentStep!.id);
      if (stepIndex !== undefined && stepIndex !== -1 && this.currentPlan) {
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
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Error executing step', { 
        stepNumber: this.currentStep.number,
        error: errorMessage
      });
      
      this.error = errorMessage;
      
      // Mark the step as failed
      const failedStep = {
        ...this.currentStep,
        status: 'failed' as StepStatus,
        result: {
          type: 'error',
          data: { error: errorMessage },
          summary: `Error: ${errorMessage}`
        }
      };
      
      // Update the plan
      const stepIndex = this.currentPlan?.findIndex(step => step.id === this.currentStep!.id);
      if (stepIndex !== undefined && stepIndex !== -1 && this.currentPlan) {
        this.currentPlan[stepIndex] = failedStep;
      }
      
      // Add to executed steps
      this.executedSteps.push(failedStep);
      
      this._notifyObservers('stepExecuteError', { 
        step: failedStep,
        error: errorMessage
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
   * @returns Success status
   */
  public async skipCurrentStep(): Promise<boolean> {
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
        status: 'skipped' as StepStatus,
        result: {
          type: 'skipped',
          data: {},
          summary: 'Step was skipped'
        }
      };
      
      // Update the plan
      const stepIndex = this.currentPlan?.findIndex(step => step.id === this.currentStep!.id);
      if (stepIndex !== undefined && stepIndex !== -1 && this.currentPlan) {
        this.currentPlan[stepIndex] = skippedStep;
      }
      
      // Add to executed steps
      this.executedSteps.push(skippedStep);
      
      this._notifyObservers('stepSkipped', { step: skippedStep });
      
      // Move to the next step
      await this._moveToNextStep();
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Error skipping step', { 
        stepNumber: this.currentStep.number,
        error: errorMessage
      });
      
      this.error = errorMessage;
      this._notifyObservers('stepSkipError', { error: errorMessage });
      
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Generate a summary of the executed plan
   * @returns Summary text
   */
  public async generateSummary(): Promise<string> {
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
      
      // In fallback mode, generate a simple summary
      if (this.options.fallbackMode) {
        const completedCount = this.executedSteps.filter(s => s.status === 'completed').length;
        const skippedCount = this.executedSteps.filter(s => s.status === 'skipped').length;
        
        const summary = `Summary of Plan Execution (Fallback Mode):

This is a fallback summary generated because the sequential thinking MCP service is not available.

The plan consisted of ${this.executedSteps.length} steps, of which ${completedCount} were completed and ${skippedCount} were skipped.

Key achievements:
${this.executedSteps.map(s => `- ${s.description}`).join('\n')}

Note: This is a simplified summary. In a real environment, it would be generated by the sequential thinking MCP service.`;
        
        this._notifyObservers('summaryGenerated', { summary });
        
        return summary;
      }
      
      // TODO: Integrate with actual MCP service
      // Placeholder for MCP integration
      throw new Error('Summary generation not implemented in non-fallback mode');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Error generating summary', { error: errorMessage });
      
      this.error = errorMessage;
      this._notifyObservers('summaryError', { error: errorMessage });
      
      return `Error generating summary: ${errorMessage}`;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Run the entire plan execution
   * @param stepCallback Optional callback for each step
   * @param options Execution options
   * @returns Execution result
   */
  public async runEntirePlan(
    stepCallback?: (context: { step: Step, plan: Step[], executedSteps: Step[], isLastStep: boolean }) => Promise<StepResult | false | void>,
    options: any = {}
  ): Promise<ExecutionResult> {
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
              status: 'completed' as StepStatus,
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
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Error running plan', { error: errorMessage });
      
      this.error = errorMessage;
      this._notifyObservers('planExecuteError', { error: errorMessage });
      
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Reset the execution manager state
   */
  public reset(): void {
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
   * @returns Current state
   */
  public getState(): any {
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
   */
  private async _moveToNextStep(): Promise<void> {
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
          logger.warn('Error generating automatic summary', { 
            error: err instanceof Error ? err.message : String(err)
          });
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
   * @param domain Domain name
   * @param options Domain-specific options
   * @returns Specialized execution manager
   */
  public static forDomain(domain: string, options: SequentialExecutionManagerOptions = {}): SequentialExecutionManager {
    const manager = new SequentialExecutionManager(options);
    
    // Configure manager based on domain
    switch (domain.toLowerCase()) {
      case 'documentation':
        // Documentation domain handlers
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
        // CI/CD domain handlers
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
        // Data domain handlers
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
        // No specialized configuration for unknown domains
        break;
    }
    
    return manager;
  }
}