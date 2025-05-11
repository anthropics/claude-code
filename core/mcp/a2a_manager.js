#!/usr/bin/env node

/**
 * A2A Manager
 * ===========
 * 
 * Manages agent-to-agent communication in the Claude Neural Framework.
 * Routes messages between agents, validates message format,
 * and handles agent discovery.
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { v4: uuidv4 } = require('uuid');

// Agent modules
const gitAgent = require('./git_agent');

// Agent registry
const AGENT_REGISTRY = {
  'git-agent': gitAgent.handleA2AMessage
};

/**
 * A2A Manager class
 */
class A2AManager {
  constructor() {
    this.conversations = new Map();
  }

  /**
   * Register an agent with the manager
   * @param {String} agentId - Agent identifier
   * @param {Function} handler - A2A message handler function
   */
  registerAgent(agentId, handler) {
    AGENT_REGISTRY[agentId] = handler;
  }

  /**
   * Send a message to an agent
   * @param {Object} message - A2A message to send
   * @returns {Promise<Object>} - Agent response
   */
  async sendMessage(message) {
    try {
      // Validate message format
      this.validateMessage(message);

      // Add conversation ID if not present
      if (!message.conversationId) {
        message.conversationId = uuidv4();
      }

      // Store in conversation history
      this.storeMessage(message);

      // Get target agent
      const targetAgent = message.to;

      // Check if agent exists
      if (!AGENT_REGISTRY[targetAgent]) {
        const notFoundResponse = {
          to: message.from,
          from: 'a2a-manager',
          conversationId: message.conversationId,
          task: 'error',
          params: {
            status: 'error',
            error: `Agent not found: ${targetAgent}`,
            code: 404
          }
        };
        this.storeMessage(notFoundResponse);
        return notFoundResponse;
      }

      // Route message to agent
      try {
        const response = await AGENT_REGISTRY[targetAgent](message);

        // Validate response
        if (!response || !response.to || !response.from) {
          throw new Error('Invalid response from agent');
        }

        // Store response in conversation history
        this.storeMessage(response);

        return response;
      } catch (error) {
        const errorResponse = {
          to: message.from,
          from: targetAgent,
          conversationId: message.conversationId,
          task: 'error',
          params: {
            status: 'error',
            error: error.message,
            code: 500
          }
        };

        // Store error in conversation history
        this.storeMessage(errorResponse);

        return errorResponse;
      }
    } catch (error) {
      return {
        to: message.from || 'unknown',
        from: 'a2a-manager',
        conversationId: message.conversationId || uuidv4(),
        task: 'error',
        params: {
          status: 'error',
          error: `A2A manager error: ${error.message}`,
          code: 500
        }
      };
    }
  }

  /**
   * Validate a message format
   * @param {Object} message - A2A message to validate
   * @throws {Error} - If message is invalid
   */
  validateMessage(message) {
    // Required fields
    if (!message.to) {
      throw new Error('Missing required field: to');
    }
    
    if (!message.task) {
      throw new Error('Missing required field: task');
    }
    
    // Check params
    if (!message.params) {
      message.params = {};
    }
    
    // Add default from if not present
    if (!message.from) {
      message.from = 'user-agent';
    }
  }

  /**
   * Store a message in the conversation history
   * @param {Object} message - A2A message to store
   */
  storeMessage(message) {
    const { conversationId } = message;
    
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, []);
    }
    
    this.conversations.get(conversationId).push({
      timestamp: new Date(),
      message
    });
  }

  /**
   * Get conversation history
   * @param {String} conversationId - Conversation identifier
   * @returns {Array} - Conversation history
   */
  getConversation(conversationId) {
    return this.conversations.get(conversationId) || [];
  }

  /**
   * List available agents
   * @returns {Array} - List of available agent IDs
   */
  listAgents() {
    return Object.keys(AGENT_REGISTRY);
  }
}

// Singleton instance
const a2aManager = new A2AManager();

/**
 * Process A2A request from command line
 */
async function processFromCommandLine() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: node a2a_manager.js --to=<agent-id> --task=<task> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --from=<agent-id>           Source agent identifier (default: \'user-agent\')');
    console.log('  --to=<agent-id>             Target agent identifier (required)');
    console.log('  --task=<task>               Task or action to perform (required)');
    console.log('  --params=<json-string>      JSON string containing parameters (default: \'{}\')');
    console.log('  --conversationId=<id>       Conversation identifier for related messages (optional)');
    console.log('  --list-agents               List available agents');
    console.log('');
    console.log('Available agents:');
    
    const agents = a2aManager.listAgents();
    agents.forEach(agent => {
      console.log(`  - ${agent}`);
    });
    
    return;
  }
  
  // Check for list-agents flag
  if (args.includes('--list-agents')) {
    console.log('Available agents:');
    
    const agents = a2aManager.listAgents();
    agents.forEach(agent => {
      console.log(`  - ${agent}`);
    });
    
    return;
  }
  
  // Parse arguments into message format
  const message = {
    from: 'user-agent',
    params: {}
  };
  
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const parts = arg.substring(2).split('=');
      if (parts.length === 2) {
        const [key, value] = parts;
        
        if (key === 'params') {
          try {
            message.params = JSON.parse(value);
          } catch (error) {
            console.error('Error parsing params JSON:', error.message);
            process.exit(1);
          }
        } else {
          message[key] = value;
        }
      }
    }
  });
  
  // Send message
  try {
    const response = await a2aManager.sendMessage(message);
    
    // Pretty print response
    console.log('--- A2A Response ---');
    console.log(`From: ${response.from}`);
    console.log(`Task: ${response.task}`);
    console.log(`Status: ${response.params?.status || '-'}`);
    
    if (response.params?.output) {
      console.log('');
      console.log(response.params.output);
    }
    
    if (response.error) {
      console.error(`Error: ${response.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Export A2A manager
module.exports = a2aManager;

// When run directly
if (require.main === module) {
  processFromCommandLine().catch(console.error);
}