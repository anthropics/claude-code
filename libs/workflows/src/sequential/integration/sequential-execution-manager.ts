/**
 * Sequential Execution Manager (Integration Variant)
 * 
 * This module extends the core Sequential Execution Manager to provide
 * deeper integration with MCP services including Context7, sequential thinking,
 * and 21st-dev magic. It adds domain-specific handlers for these services while
 * maintaining compatibility with the core execution management capabilities.
 */

import * as path from 'path';
import * as fs from 'fs';
import { 
  SequentialExecutionManagerOptions, 
  PlanStep, 
  StepHandler, 
  ExecutionObserver,
  ExecutionOptions, 
  ExecutionResult,
  Domain,
  Plan
} from "./types";

// Import the core sequential execution manager
import { SequentialExecutionManager as CoreExecutionManager } from "./sequential-execution-manager";

// Import the sequential planner service
import { sequentialPlanner } from "./services/sequential-planner";

// Placeholder for logger
const createLogger = (name: string) => {
  return {
    info: (message: string, data?: any) => console.log(`[INFO] ${name}: ${message}`, data || ''),
    debug: (message: string, data?: any) => console.log(`[DEBUG] ${name}: ${message}`, data || ''),
    warn: (message: string, data?: any) => console.log(`[WARN] ${name}: ${message}`, data || ''),
    error: (message: string, data?: any) => console.log(`[ERROR] ${name}: ${message}`, data || '')
  };
};

const logger = createLogger('sequential-execution-manager-integration');

/**
 * Sequential Execution Manager Integration Class
 * Extends the core execution manager with MCP service integration
 */
export class SequentialExecutionManager extends CoreExecutionManager {
  private handlers: Map<string, StepHandler>;
  private currentGoal: string | null;
  private executionResult: {
    plan: PlanStep[],
    executedSteps: PlanStep[],
    summary: string
  } | null;
  
  /**
   * Create a new Sequential Execution Manager with integration extensions
   * @param domain Domain to use for planning
   * @param options Manager options
   */
  constructor(domain: Domain = 'general', options: SequentialExecutionManagerOptions = {}) {
    super(domain, options);
    
    this.handlers = new Map();
    this.currentGoal = null;
    this.executionResult = null;
    
    // Register MCP integration handlers
    this._registerMcpHandlers();
    
    logger.info('Sequential Execution Manager (Integration) initialized', {
      domain,
      fallbackMode: options.fallbackMode || false
    });
  }
  
  /**
   * Register MCP integration handlers
   * @private
   */
  private _registerMcpHandlers(): void {
    // Context7 handler
    this.registerHandler('context', async (step, options = {}) => {
      logger.debug('Executing context step via MCP', { stepNumber: step.number });
      
      try {
        const searchTerm = options.searchTerm || step.description;
        const result = await sequentialPlanner.executeContextStep(searchTerm);
        return result;
      } catch (err) {
        logger.error('Error executing context step', { error: err.message });
        throw err;
      }
    });
    
    // UI handler via 21st-dev-magic
    this.registerHandler('ui', async (step, options = {}) => {
      logger.debug('Executing UI step via MCP', { stepNumber: step.number });
      
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
   * @param actionType The action type to handle
   * @param handler The handler function
   */
  registerHandler(actionType: string, handler: StepHandler): void {
    if (typeof handler !== 'function') {
      throw new Error(`Handler for action type '${actionType}' must be a function`);
    }
    
    this.handlers.set(actionType, handler);
    logger.debug('Registered handler', { actionType });
  }
  
  /**
   * Generate a plan for a goal using the MCP sequential thinking service
   * @param goal The goal to plan for
   * @param options Planning options
   * @returns Plan object with steps
   */
  public async generatePlanFromGoal(goal: string, options: ExecutionOptions = {}): Promise<Plan> {
    if (!goal) {
      throw new Error('Goal is required');
    }
    
    try {
      logger.info('Generating plan from goal', { 
        goalPrefix: goal.substring(0, 50),
        options
      });
      
      this.currentGoal = goal;
      
      // Convert core options to planner options
      const planOptions = {
        initialSteps: options.initialSteps || 5,
        maxSteps: options.maxSteps || this.options.maxSteps,
        depth: options.depth || this.options.planningDepth,
        ...options
      };
      
      // Generate steps using the planner service
      const steps = await sequentialPlanner.generatePlan(goal, planOptions);
      
      // Create a plan object from the steps
      const timestamp = Date.now();
      const plan: Plan = {
        id: `plan-${timestamp}`,
        name: options.name as string || `Plan for ${goal.substring(0, 30)}`,
        description: options.description as string || goal,
        domain: options.domain as Domain || 'general',
        steps,
        createdAt: new Date(),
        status: 'created'
      };
      
      logger.info('Plan generated from goal', { stepCount: steps.length });
      
      // Create the plan using the parent class method
      return await this.createPlan({ existingPlan: plan, ...options });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Error generating plan from goal', { error: errorMessage });
      throw err;
    }
  }
  
  /**
   * Continue a plan by generating additional steps
   * @returns The updated plan
   */
  public async continuePlan(): Promise<Plan | null> {
    if (!this.currentPlan) {
      throw new Error('No active plan to continue');
    }
    
    try {
      logger.info('Continuing plan with MCP integration', { 
        planId: this.currentPlan.id,
        currentStepCount: this.currentPlan.steps.length 
      });
      
      // Generate new steps using the planner service
      const newSteps = await sequentialPlanner.continuePlanning(this.currentPlan.steps);
      
      if (newSteps.length === 0) {
        return this.currentPlan;
      }
      
      // Update the current plan with new steps
      const updatedSteps = [...this.currentPlan.steps, ...newSteps];
      const updatedPlan: Plan = {
        ...this.currentPlan,
        steps: updatedSteps
      };
      
      // Update the current plan using the parent method
      return await this.createPlan({ existingPlan: updatedPlan });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Error continuing plan', { error: errorMessage });
      throw err;
    }
  }
  
  /**
   * Generate a summary of the executed plan using the MCP sequential thinking service
   * @returns The summary text
   */
  public async generateDetailedSummary(): Promise<string> {
    if (!this.currentPlan || this.executedSteps.length === 0) {
      return "No plan has been executed yet.";
    }
    
    try {
      logger.info('Generating detailed summary with MCP integration', { 
        planId: this.currentPlan.id,
        stepCount: this.executedSteps.length 
      });
      
      // Generate summary using the planner service
      const summary = await sequentialPlanner.generateSummary(this.currentPlan.steps);
      
      // Store the summary in the execution result
      this.executionResult = {
        plan: this.currentPlan.steps,
        executedSteps: this.executedSteps,
        summary
      };
      
      return summary;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Error generating detailed summary', { error: errorMessage });
      return `Error generating summary: ${errorMessage}`;
    }
  }
  
  /**
   * Run the entire plan execution with MCP integration
   * @param stepCallback Optional callback for each step
   * @param options Execution options
   * @returns The execution result
   */
  public async runEntirePlan(
    stepCallback?: (data: { 
      step: PlanStep; 
      plan: Plan; 
      isLastStep: boolean;
    }) => Promise<boolean | ExecutionResult | void>,
    options: ExecutionOptions = {}
  ): Promise<{
    plan: Plan;
    executedSteps: PlanStep[];
    summary: string;
  }> {
    if (!this.currentPlan) {
      throw new Error('No current plan to execute');
    }
    
    // First execute the plan using the core implementation
    const result = await this.executePlan(options);
    
    // Generate a more detailed summary using MCP services
    const detailedSummary = await this.generateDetailedSummary();
    
    return {
      plan: this.currentPlan,
      executedSteps: result.executedSteps,
      summary: detailedSummary
    };
  }
  
  /**
   * Reset the execution manager state including integration-specific fields
   */
  public reset(): void {
    // Reset core state
    super.reset();
    
    // Reset integration-specific state
    this.currentGoal = null;
    this.executionResult = null;
    
    logger.info('Integration execution manager reset');
  }
  
  /**
   * Get the current state including integration-specific fields
   * @returns Extended state object
   */
  public getExtendedState(): Record<string, any> {
    // Get core state
    const coreState = super.getState();
    
    // Add integration-specific state
    return {
      ...coreState,
      goal: this.currentGoal,
      executionResult: this.executionResult,
      hasIntegration: true
    };
  }
  
  /**
   * Create a specialized execution manager for a specific domain with MCP integration
   * @param domain Domain to create manager for
   * @param options Manager options
   * @returns Domain-specific manager instance with MCP integration
   */
  public static forDomain(domain: Domain, options: SequentialExecutionManagerOptions = {}): SequentialExecutionManager {
    const manager = new SequentialExecutionManager(domain, options);
    
    switch (domain.toLowerCase()) {
      case 'documentation':
        // Configure for documentation generation with MCP integration
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
        // Configure for CI/CD automation with MCP integration
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
        // Configure for data processing with MCP integration
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
        // Default integration handlers already registered in constructor
        break;
    }
    
    return manager;
  }
}