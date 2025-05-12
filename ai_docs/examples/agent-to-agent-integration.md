# Agent-to-Agent Integration Example

This example demonstrates how to implement agent-to-agent communication using Claude Code within a containerized environment.

## Overview

Agent-to-agent (A2A) communication enables autonomous AI agents to collaborate on complex tasks by exchanging information, delegating subtasks, and coordinating their actions. This example shows how to implement a simple A2A protocol within Claude Code's containerized environment.

## Implementation

### 1. Agent Interface Definition

First, define a standard interface for agent communication:

```typescript
// agent-interface.ts
export interface AgentMessage {
  messageId: string;
  fromAgent: string;
  toAgent: string;
  type: 'REQUEST' | 'RESPONSE' | 'UPDATE' | 'ERROR';
  content: {
    task?: string;
    parameters?: Record<string, any>;
    result?: any;
    status?: string;
    error?: string;
  };
  timestamp: number;
  conversationId: string;
}

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  parameters: {
    name: string;
    type: string;
    description: string;
    required: boolean;
  }[];
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  sendMessage(message: AgentMessage): Promise<AgentMessage>;
  registerMessageHandler(handler: (message: AgentMessage) => Promise<AgentMessage>): void;
}
```

### 2. Agent Registry Service

Create a registry where agents can discover each other and their capabilities:

```typescript
// agent-registry.ts
import { Agent, AgentCapability } from './agent-interface';

export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<string, Agent> = new Map();
  
  private constructor() {}
  
  public static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }
  
  public registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
    console.log(`Agent registered: ${agent.name} (${agent.id})`);
  }
  
  public deregisterAgent(agentId: string): void {
    if (this.agents.has(agentId)) {
      this.agents.delete(agentId);
      console.log(`Agent deregistered: ${agentId}`);
    }
  }
  
  public getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }
  
  public getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
  
  public findAgentsWithCapability(capabilityId: string): Agent[] {
    return this.getAllAgents().filter(agent => 
      agent.capabilities.some(cap => cap.id === capabilityId)
    );
  }
  
  public getAgentCapabilities(agentId: string): AgentCapability[] {
    const agent = this.getAgent(agentId);
    return agent ? agent.capabilities : [];
  }
}
```

### 3. Base Agent Implementation

Create a base class for agents:

```typescript
// base-agent.ts
import { v4 as uuidv4 } from 'uuid';
import { Agent, AgentMessage, AgentCapability } from './agent-interface';
import { AgentRegistry } from './agent-registry';

export abstract class BaseAgent implements Agent {
  public id: string;
  public name: string;
  public description: string;
  public capabilities: AgentCapability[];
  private messageHandlers: ((message: AgentMessage) => Promise<AgentMessage>)[] = [];
  
  constructor(name: string, description: string, capabilities: AgentCapability[] = []) {
    this.id = uuidv4();
    this.name = name;
    this.description = description;
    this.capabilities = capabilities;
    
    // Auto-register with the registry
    AgentRegistry.getInstance().registerAgent(this);
  }
  
  public async sendMessage(message: AgentMessage): Promise<AgentMessage> {
    // Update the message with sender information if not set
    if (!message.fromAgent) {
      message.fromAgent = this.id;
    }
    
    // Set a timestamp if not present
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }
    
    // Generate message ID if not present
    if (!message.messageId) {
      message.messageId = uuidv4();
    }
    
    console.log(`[${this.name}] Sending message to ${message.toAgent}:`, 
      JSON.stringify(message.content, null, 2));
    
    // Find the target agent in the registry
    const targetAgent = AgentRegistry.getInstance().getAgent(message.toAgent);
    if (!targetAgent) {
      const errorMessage: AgentMessage = {
        messageId: uuidv4(),
        fromAgent: this.id,
        toAgent: message.fromAgent,
        type: 'ERROR',
        content: {
          error: `Agent ${message.toAgent} not found in registry`
        },
        timestamp: Date.now(),
        conversationId: message.conversationId
      };
      return errorMessage;
    }
    
    // Process the message through target agent's handlers
    const response = await targetAgent.processIncomingMessage(message);
    return response;
  }
  
  public registerMessageHandler(handler: (message: AgentMessage) => Promise<AgentMessage>): void {
    this.messageHandlers.push(handler);
  }
  
  public async processIncomingMessage(message: AgentMessage): Promise<AgentMessage> {
    console.log(`[${this.name}] Received message from ${message.fromAgent}:`, 
      JSON.stringify(message.content, null, 2));
    
    // Handle the message using registered handlers
    for (const handler of this.messageHandlers) {
      try {
        const response = await handler(message);
        if (response) {
          // Make sure response has proper metadata
          if (!response.messageId) response.messageId = uuidv4();
          if (!response.timestamp) response.timestamp = Date.now();
          if (!response.fromAgent) response.fromAgent = this.id;
          if (!response.toAgent) response.toAgent = message.fromAgent;
          if (!response.conversationId) response.conversationId = message.conversationId;
          
          return response;
        }
      } catch (error) {
        console.error(`Error in message handler for agent ${this.name}:`, error);
      }
    }
    
    // If no handler produced a response, create a default one
    return {
      messageId: uuidv4(),
      fromAgent: this.id,
      toAgent: message.fromAgent,
      type: 'RESPONSE',
      content: {
        status: 'Message received, but no action taken'
      },
      timestamp: Date.now(),
      conversationId: message.conversationId
    };
  }
  
  protected createRequestMessage(toAgent: string, task: string, parameters: Record<string, any>, conversationId?: string): AgentMessage {
    return {
      messageId: uuidv4(),
      fromAgent: this.id,
      toAgent,
      type: 'REQUEST',
      content: {
        task,
        parameters
      },
      timestamp: Date.now(),
      conversationId: conversationId || uuidv4()
    };
  }
}
```

### 4. Specialized Agent Examples

Now, implement specialized agents with different capabilities:

```typescript
// code-analyzer-agent.ts
import { BaseAgent } from './base-agent';
import { AgentMessage } from './agent-interface';

export class CodeAnalyzerAgent extends BaseAgent {
  constructor() {
    super(
      'Code Analyzer',
      'Analyzes code for patterns, complexity, and potential issues',
      [
        {
          id: 'complexity-analysis',
          name: 'Complexity Analysis',
          description: 'Analyzes the complexity of provided code',
          parameters: [
            {
              name: 'code',
              type: 'string',
              description: 'Code to analyze',
              required: true
            },
            {
              name: 'language',
              type: 'string',
              description: 'Programming language of the code',
              required: true
            }
          ]
        },
        {
          id: 'pattern-detection',
          name: 'Pattern Detection',
          description: 'Detects common patterns in code',
          parameters: [
            {
              name: 'code',
              type: 'string',
              description: 'Code to analyze',
              required: true
            },
            {
              name: 'patterns',
              type: 'array',
              description: 'Specific patterns to look for',
              required: false
            }
          ]
        }
      ]
    );
    
    this.registerMessageHandler(this.handleMessage.bind(this));
  }
  
  private async handleMessage(message: AgentMessage): Promise<AgentMessage> {
    if (message.type !== 'REQUEST') {
      return null; // Only handle request messages
    }
    
    const { task, parameters } = message.content;
    
    if (task === 'complexity-analysis') {
      return this.analyzeComplexity(message, parameters);
    } else if (task === 'pattern-detection') {
      return this.detectPatterns(message, parameters);
    }
    
    return null; // Not handled
  }
  
  private async analyzeComplexity(message: AgentMessage, parameters: any): Promise<AgentMessage> {
    const { code, language } = parameters;
    
    // Implementation of complexity analysis
    // This would analyze the cyclomatic complexity, cognitive complexity, etc.
    
    // Simplified example implementation
    const complexityScore = code.split('{').length - 1;
    const lines = code.split('\n').length;
    
    return {
      messageId: uuidv4(),
      fromAgent: this.id,
      toAgent: message.fromAgent,
      type: 'RESPONSE',
      content: {
        result: {
          cyclomaticComplexity: complexityScore,
          lines,
          complexityPerLine: complexityScore / lines,
          assessment: complexityScore > 10 ? 'High complexity' : 'Acceptable complexity'
        }
      },
      timestamp: Date.now(),
      conversationId: message.conversationId
    };
  }
  
  private async detectPatterns(message: AgentMessage, parameters: any): Promise<AgentMessage> {
    // Implementation of pattern detection
    // This would search for common patterns like singletons, factories, etc.
    
    // Simplified example implementation
    const { code, patterns } = parameters;
    const detectedPatterns = [];
    
    if (code.includes('new') && code.includes('getInstance')) {
      detectedPatterns.push('Singleton pattern detected');
    }
    
    if (code.includes('extends') || code.includes('implements')) {
      detectedPatterns.push('Inheritance pattern detected');
    }
    
    if (code.includes('Observable') || code.includes('addEventListener')) {
      detectedPatterns.push('Observer pattern detected');
    }
    
    return {
      messageId: uuidv4(),
      fromAgent: this.id,
      toAgent: message.fromAgent,
      type: 'RESPONSE',
      content: {
        result: {
          detectedPatterns
        }
      },
      timestamp: Date.now(),
      conversationId: message.conversationId
    };
  }
}

// documentation-agent.ts
import { BaseAgent } from './base-agent';
import { AgentMessage } from './agent-interface';

export class DocumentationAgent extends BaseAgent {
  constructor() {
    super(
      'Documentation Assistant',
      'Generates and analyzes documentation for code and projects',
      [
        {
          id: 'generate-docs',
          name: 'Generate Documentation',
          description: 'Generates documentation from code comments and structure',
          parameters: [
            {
              name: 'code',
              type: 'string',
              description: 'Code to document',
              required: true
            },
            {
              name: 'language',
              type: 'string',
              description: 'Programming language of the code',
              required: true
            },
            {
              name: 'format',
              type: 'string',
              description: 'Output format (markdown, html, etc.)',
              required: false
            }
          ]
        }
      ]
    );
    
    this.registerMessageHandler(this.handleMessage.bind(this));
  }
  
  private async handleMessage(message: AgentMessage): Promise<AgentMessage> {
    if (message.type !== 'REQUEST' || message.content.task !== 'generate-docs') {
      return null;
    }
    
    const { code, language, format = 'markdown' } = message.content.parameters;
    
    // Extract comments and function signatures from code
    // This is a simplified implementation
    
    const lines = code.split('\n');
    const documentation = [];
    let functionName = null;
    let comment = [];
    
    for (const line of lines) {
      if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
        comment.push(line.trim().replace(/^\/\/|^\/\*|\*\/$|\*/, '').trim());
      } else if (line.includes('function ') || line.includes('class ')) {
        if (line.includes('function ')) {
          functionName = line.match(/function\s+([a-zA-Z0-9_]+)/)?.[1];
        } else {
          functionName = line.match(/class\s+([a-zA-Z0-9_]+)/)?.[1];
        }
        
        if (functionName && comment.length > 0) {
          documentation.push({
            name: functionName,
            description: comment.join('\n'),
            type: line.includes('function ') ? 'function' : 'class'
          });
          
          comment = [];
          functionName = null;
        }
      }
    }
    
    // Format the documentation
    let formattedDocs = '';
    
    if (format === 'markdown') {
      formattedDocs = documentation.map(item => {
        return `## ${item.name} (${item.type})\n\n${item.description}\n`;
      }).join('\n');
    } else if (format === 'html') {
      formattedDocs = `<html><body>${documentation.map(item => {
        return `<h2>${item.name} (${item.type})</h2><p>${item.description}</p>`;
      }).join('')}</body></html>`;
    }
    
    return {
      messageId: uuidv4(),
      fromAgent: this.id,
      toAgent: message.fromAgent,
      type: 'RESPONSE',
      content: {
        result: {
          documentation: formattedDocs,
          format,
          extractedItems: documentation.length
        }
      },
      timestamp: Date.now(),
      conversationId: message.conversationId
    };
  }
}
```

### 5. Orchestrator Agent

Create an orchestrator to coordinate between specialized agents:

```typescript
// orchestrator-agent.ts
import { BaseAgent } from './base-agent';
import { AgentMessage, Agent } from './agent-interface';
import { AgentRegistry } from './agent-registry';

export class OrchestratorAgent extends BaseAgent {
  constructor() {
    super(
      'Task Orchestrator',
      'Coordinates tasks between specialized agents',
      [
        {
          id: 'code-analysis-workflow',
          name: 'Code Analysis Workflow',
          description: 'Orchestrates comprehensive code analysis using multiple agents',
          parameters: [
            {
              name: 'code',
              type: 'string',
              description: 'Code to analyze',
              required: true
            },
            {
              name: 'language',
              type: 'string',
              description: 'Programming language of the code',
              required: true
            }
          ]
        }
      ]
    );
    
    this.registerMessageHandler(this.handleMessage.bind(this));
  }
  
  private async handleMessage(message: AgentMessage): Promise<AgentMessage> {
    if (message.type !== 'REQUEST' || message.content.task !== 'code-analysis-workflow') {
      return null;
    }
    
    const { code, language } = message.content.parameters;
    const results = {};
    
    // 1. Find complexity analyzer agent
    const complexityAgents = AgentRegistry.getInstance()
      .findAgentsWithCapability('complexity-analysis');
    
    if (complexityAgents.length > 0) {
      const analyzerAgent = complexityAgents[0];
      
      // Send complexity analysis request
      const complexityRequest = this.createRequestMessage(
        analyzerAgent.id,
        'complexity-analysis',
        { code, language },
        message.conversationId
      );
      
      const complexityResponse = await this.sendMessage(complexityRequest);
      results.complexity = complexityResponse.content.result;
    }
    
    // 2. Find pattern detection agent
    const patternAgents = AgentRegistry.getInstance()
      .findAgentsWithCapability('pattern-detection');
    
    if (patternAgents.length > 0) {
      const patternAgent = patternAgents[0];
      
      // Send pattern detection request
      const patternRequest = this.createRequestMessage(
        patternAgent.id,
        'pattern-detection',
        { code },
        message.conversationId
      );
      
      const patternResponse = await this.sendMessage(patternRequest);
      results.patterns = patternResponse.content.result;
    }
    
    // 3. Find documentation agent
    const docAgents = AgentRegistry.getInstance()
      .findAgentsWithCapability('generate-docs');
    
    if (docAgents.length > 0) {
      const docAgent = docAgents[0];
      
      // Send documentation generation request
      const docRequest = this.createRequestMessage(
        docAgent.id,
        'generate-docs',
        { code, language, format: 'markdown' },
        message.conversationId
      );
      
      const docResponse = await this.sendMessage(docRequest);
      results.documentation = docResponse.content.result;
    }
    
    // Combine all results and return
    return {
      messageId: uuidv4(),
      fromAgent: this.id,
      toAgent: message.fromAgent,
      type: 'RESPONSE',
      content: {
        result: {
          complexity: results.complexity,
          patterns: results.patterns,
          documentation: results.documentation,
          summary: {
            analysisTimestamp: new Date().toISOString(),
            language,
            codeSize: code.length,
            codeLines: code.split('\n').length
          }
        }
      },
      timestamp: Date.now(),
      conversationId: message.conversationId
    };
  }
}
```

### 6. Usage Example

Here's how to use the agent system:

```typescript
// main.ts
import { CodeAnalyzerAgent } from './code-analyzer-agent';
import { DocumentationAgent } from './documentation-agent';
import { OrchestratorAgent } from './orchestrator-agent';
import { AgentRegistry } from './agent-registry';

async function main() {
  // Initialize the agent system
  const analyzerAgent = new CodeAnalyzerAgent();
  const documentationAgent = new DocumentationAgent();
  const orchestrator = new OrchestratorAgent();
  
  console.log('Agent system initialized with the following agents:');
  console.log(AgentRegistry.getInstance().getAllAgents().map(a => a.name).join(', '));
  
  // Example code to analyze
  const sampleCode = `
    /**
     * A simple calculator class
     */
    class Calculator {
      /**
       * Adds two numbers
       * @param a First number
       * @param b Second number
       * @returns Sum of a and b
       */
      add(a, b) {
        return a + b;
      }
      
      /**
       * Multiplies two numbers
       * @param a First number
       * @param b Second number
       * @returns Product of a and b
       */
      multiply(a, b) {
        return a * b;
      }
    }
  `;
  
  // Create a message to send to the orchestrator
  const request = {
    messageId: uuidv4(),
    fromAgent: 'user-agent', // Simulating a user agent
    toAgent: orchestrator.id,
    type: 'REQUEST',
    content: {
      task: 'code-analysis-workflow',
      parameters: {
        code: sampleCode,
        language: 'javascript'
      }
    },
    timestamp: Date.now(),
    conversationId: uuidv4()
  };
  
  console.log('\nSending request to orchestrator...');
  
  // Send the message and wait for response
  const response = await orchestrator.processIncomingMessage(request);
  
  console.log('\nFinal results:');
  console.log(JSON.stringify(response.content.result, null, 2));
}

main().catch(console.error);
```

## Running in Docker Container

To run this system in a containerized environment, create a Dockerfile:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

CMD ["node", "dist/main.js"]
```

And a docker-compose.yml file for easy orchestration:

```yaml
version: '3'
services:
  agent-system:
    build:
      context: .
      dockerfile: Dockerfile
    volumes:
      - ./src:/app/src
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
```

Build and run with:

```bash
docker-compose up --build
```

## Conclusion

This example demonstrates a flexible architecture for implementing agent-to-agent communication within Claude Code's containerized environment. The system allows specialized agents to collaborate on complex tasks while maintaining a clean separation of concerns. The registry-based discovery mechanism enables new agent types to be added dynamically without modifying existing code.

For production use, consider adding:
1. Persistent storage for agent state and conversation history
2. Authentication and authorization between agents
3. Retry mechanisms for failed communications
4. More sophisticated task planning and dependency management
5. Additional specialized agents for specific domains
