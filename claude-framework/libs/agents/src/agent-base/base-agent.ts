import { createLogger, Logger } from '@claude-framework/core';

/**
 * Agent configuration
 */
export interface AgentConfig {
  name: string;
  description?: string;
  capabilities?: string[];
  [key: string]: any;
}

/**
 * Task to be executed by an agent
 */
export interface Task {
  id: string;
  type: string;
  description: string;
  data?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high';
  deadline?: Date;
}

/**
 * Result of a task execution
 */
export interface TaskResult {
  taskId: string;
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Base agent class for all agents in the system
 */
export abstract class BaseAgent {
  protected config: AgentConfig;
  protected logger: Logger;

  /**
   * Create a new base agent
   * @param config Agent configuration
   */
  constructor(config: AgentConfig) {
    this.config = config;
    this.logger = createLogger(`agent:${config.name}`);
  }

  /**
   * Get the agent's name
   * @returns Agent name
   */
  public getName(): string {
    return this.config.name;
  }

  /**
   * Get the agent's description
   * @returns Agent description
   */
  public getDescription(): string {
    return this.config.description || 'No description provided';
  }

  /**
   * Get the agent's capabilities
   * @returns Agent capabilities
   */
  public getCapabilities(): string[] {
    return this.config.capabilities || [];
  }

  /**
   * Check if the agent can handle a specific task type
   * @param taskType Task type
   * @returns Whether the agent can handle the task
   */
  public canHandle(taskType: string): boolean {
    return this.getSupportedTaskTypes().includes(taskType);
  }

  /**
   * Get the task types supported by this agent
   * @returns Supported task types
   */
  public abstract getSupportedTaskTypes(): string[];

  /**
   * Execute a task
   * @param task Task to execute
   * @returns Task execution result
   */
  public abstract execute(task: Task): Promise<TaskResult>;

  /**
   * Validate a task before execution
   * @param task Task to validate
   * @returns Whether the task is valid
   */
  protected validateTask(task: Task): boolean {
    // Base validation, can be extended by subclasses
    if (!task.id || !task.type || !task.description) {
      return false;
    }
    
    return this.canHandle(task.type);
  }

  /**
   * Create a success result
   * @param taskId Task ID
   * @param data Result data
   * @param metadata Result metadata
   * @returns Success task result
   */
  protected createSuccessResult(
    taskId: string, 
    data?: Record<string, any>, 
    metadata?: Record<string, any>
  ): TaskResult {
    return {
      taskId,
      success: true,
      data,
      metadata,
    };
  }

  /**
   * Create an error result
   * @param taskId Task ID
   * @param error Error message
   * @param metadata Result metadata
   * @returns Error task result
   */
  protected createErrorResult(
    taskId: string, 
    error: string, 
    metadata?: Record<string, any>
  ): TaskResult {
    return {
      taskId,
      success: false,
      error,
      metadata,
    };
  }
}