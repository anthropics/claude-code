import { PlanStep, ExecutionResult } from "./types";
import { Logger } from '@claude-framework/core/logging';

/**
 * Base abstract class for all domain-specific executors.
 * Defines the common interface and functionality for executors.
 */
export abstract class BaseExecutor {
  /**
   * The domain this executor is responsible for
   */
  protected domain: string;
  
  /**
   * Logger instance for this executor
   */
  protected logger: Logger;

  /**
   * Creates a new executor for the specified domain
   * 
   * @param domain The domain this executor handles
   */
  constructor(domain: string) {
    this.domain = domain;
    this.logger = new Logger(`${domain}Executor`);
  }

  /**
   * Gets the domain of this executor
   * 
   * @returns The executor's domain name
   */
  getDomain(): string {
    return this.domain;
  }

  /**
   * Executes a single plan step
   * 
   * @param step The plan step to execute
   * @param context Execution context with data from previous steps
   * @returns Result of the execution
   */
  abstract executeStep(step: PlanStep, context: Record<string, any>): Promise<ExecutionResult>;
}