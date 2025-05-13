import { createLogger } from '@claude-framework/core';
import { BaseAgent, Task, TaskResult } from './agent-base/base-agent';

const logger = createLogger('a2a-manager');

/**
 * Message format for agent-to-agent communication
 */
export interface A2AMessage {
  id: string;
  from: string;
  to: string;
  type: 'request' | 'response' | 'broadcast';
  content: Task | TaskResult;
  metadata?: Record<string, any>;
  timestamp: number;
}

/**
 * Agent-to-Agent Communication Manager
 * Handles the routing of messages between agents
 */
export class A2AManager {
  private static instance: A2AManager;
  private agents: Map<string, BaseAgent>;
  private messageQueue: A2AMessage[];
  private subscribers: Map<string, ((message: A2AMessage) => void)[]>;

  /**
   * Get the singleton instance of the A2AManager
   */
  public static getInstance(): A2AManager {
    if (!A2AManager.instance) {
      A2AManager.instance = new A2AManager();
    }
    return A2AManager.instance;
  }

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.agents = new Map();
    this.messageQueue = [];
    this.subscribers = new Map();
    
    // Start processing messages
    setInterval(() => this.processQueue(), 100);
  }

  /**
   * Register an agent with the manager
   * @param agent Agent instance
   */
  public registerAgent(agent: BaseAgent): void {
    const name = agent.getName();
    
    if (this.agents.has(name)) {
      logger.warn(`Agent with name ${name} already registered, overwriting`);
    }
    
    this.agents.set(name, agent);
    logger.info(`Registered agent: ${name}`);
  }

  /**
   * Unregister an agent from the manager
   * @param agentName Agent name
   */
  public unregisterAgent(agentName: string): void {
    if (this.agents.has(agentName)) {
      this.agents.delete(agentName);
      logger.info(`Unregistered agent: ${agentName}`);
    }
  }

  /**
   * Get an agent by name
   * @param agentName Agent name
   * @returns Agent instance or undefined
   */
  public getAgent(agentName: string): BaseAgent | undefined {
    return this.agents.get(agentName);
  }

  /**
   * Get all registered agents
   * @returns Map of agent names to agent instances
   */
  public getAgents(): Map<string, BaseAgent> {
    return this.agents;
  }

  /**
   * Send a message from one agent to another
   * @param message Message to send
   */
  public sendMessage(message: A2AMessage): void {
    this.messageQueue.push({
      ...message,
      timestamp: Date.now(),
    });
    logger.debug(`Queued message from ${message.from} to ${message.to}`, { messageId: message.id });
  }

  /**
   * Send a task to an agent and get the result
   * @param fromAgent Sender agent name
   * @param toAgent Recipient agent name
   * @param task Task to execute
   * @returns Promise resolving to the task result
   */
  public async sendTask(fromAgent: string, toAgent: string, task: Task): Promise<TaskResult> {
    return new Promise((resolve, reject) => {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Subscribe to response
      const subscriptionId = this.subscribe((message) => {
        if (message.id === messageId && message.from === toAgent && message.to === fromAgent && message.type === 'response') {
          this.unsubscribe(subscriptionId);
          resolve(message.content as TaskResult);
        }
      });
      
      // Send message
      this.sendMessage({
        id: messageId,
        from: fromAgent,
        to: toAgent,
        type: 'request',
        content: task,
        timestamp: Date.now(),
      });
      
      // Set timeout
      setTimeout(() => {
        this.unsubscribe(subscriptionId);
        reject(new Error(`Timeout waiting for response from ${toAgent}`));
      }, 30000); // 30 seconds timeout
    });
  }

  /**
   * Broadcast a message to all agents
   * @param fromAgent Sender agent name
   * @param task Task to broadcast
   */
  public broadcastTask(fromAgent: string, task: Task): void {
    const messageId = `broadcast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    this.sendMessage({
      id: messageId,
      from: fromAgent,
      to: '*',
      type: 'broadcast',
      content: task,
      timestamp: Date.now(),
    });
  }

  /**
   * Subscribe to messages
   * @param callback Callback function to be called when a message is received
   * @returns Subscription ID
   */
  public subscribe(callback: (message: A2AMessage) => void): string {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    if (!this.subscribers.has(id)) {
      this.subscribers.set(id, []);
    }
    
    this.subscribers.get(id)!.push(callback);
    
    return id;
  }

  /**
   * Unsubscribe from messages
   * @param subscriptionId Subscription ID
   */
  public unsubscribe(subscriptionId: string): void {
    if (this.subscribers.has(subscriptionId)) {
      this.subscribers.delete(subscriptionId);
    }
  }

  /**
   * Process the message queue
   */
  private processQueue(): void {
    if (this.messageQueue.length === 0) {
      return;
    }
    
    const message = this.messageQueue.shift()!;
    
    // Notify subscribers
    for (const [, callbacks] of this.subscribers) {
      for (const callback of callbacks) {
        callback(message);
      }
    }
    
    // Process message based on type
    if (message.type === 'request') {
      this.processRequest(message);
    }
  }

  /**
   * Process a request message
   * @param message Request message
   */
  private async processRequest(message: A2AMessage): Promise<void> {
    const { from, to, content } = message;
    
    // Broadcast message
    if (to === '*') {
      for (const [agentName, agent] of this.agents) {
        if (agentName !== from) {
          try {
            const task = content as Task;
            if (agent.canHandle(task.type)) {
              agent.execute(task)
                .then((result) => {
                  logger.debug(`Broadcast execution completed by ${agentName}`, { taskId: task.id });
                })
                .catch((error) => {
                  logger.error(`Error executing broadcast task by ${agentName}`, { taskId: task.id, error });
                });
            }
          } catch (error) {
            logger.error(`Error processing broadcast message for ${agentName}`, { error });
          }
        }
      }
      return;
    }
    
    // Direct message
    const targetAgent = this.agents.get(to);
    if (!targetAgent) {
      logger.warn(`Agent ${to} not found for message ${message.id}`);
      
      // Send error response
      this.sendMessage({
        id: message.id,
        from: to,
        to: from,
        type: 'response',
        content: {
          taskId: (content as Task).id,
          success: false,
          error: `Agent ${to} not found`,
        },
        timestamp: Date.now(),
      });
      
      return;
    }
    
    try {
      const task = content as Task;
      
      if (!targetAgent.canHandle(task.type)) {
        this.sendMessage({
          id: message.id,
          from: to,
          to: from,
          type: 'response',
          content: {
            taskId: task.id,
            success: false,
            error: `Agent ${to} cannot handle task type ${task.type}`,
          },
          timestamp: Date.now(),
        });
        return;
      }
      
      const result = await targetAgent.execute(task);
      
      // Send response
      this.sendMessage({
        id: message.id,
        from: to,
        to: from,
        type: 'response',
        content: result,
        timestamp: Date.now(),
      });
      
      logger.debug(`Task execution completed by ${to}`, { taskId: task.id });
    } catch (error) {
      logger.error(`Error executing task by ${to}`, { messageId: message.id, error });
      
      // Send error response
      this.sendMessage({
        id: message.id,
        from: to,
        to: from,
        type: 'response',
        content: {
          taskId: (content as Task).id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
        timestamp: Date.now(),
      });
    }
  }
}

export default A2AManager.getInstance();