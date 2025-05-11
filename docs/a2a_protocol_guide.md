# Agent-to-Agent (A2A) Protocol Guide

This guide provides comprehensive documentation for the Agent-to-Agent (A2A) protocol implementation in the Claude Neural Framework.

## Table of Contents

- [Introduction](#introduction)
- [Protocol Specification](#protocol-specification)
- [A2A Manager](#a2a-manager)
- [Message Flow](#message-flow)
- [Creating A2A Agents](#creating-a2a-agents)
- [Error Handling](#error-handling)
- [Security Considerations](#security-considerations)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)

## Introduction

The Agent-to-Agent (A2A) protocol enables different agents within the Claude Neural Framework to communicate with each other in a standardized way. This facilitates modular agent design, specialized capabilities, and complex multi-step workflows.

### Key Features

- **Standardized Communication**: Consistent message format for all agent interactions
- **Routing and Discovery**: Automatic routing of messages to the appropriate agent
- **Conversation Tracking**: Grouping of related messages through conversation IDs
- **Error Handling**: Standardized error reporting across agents
- **Extensibility**: Easy addition of new agent types to the ecosystem

## Protocol Specification

### Message Format

The A2A protocol uses a standardized JSON message format for all communications:

```json
{
  "from": "source-agent-id",
  "to": "target-agent-id",
  "task": "task-name",
  "params": {
    "param1": "value1",
    "param2": "value2"
  },
  "conversationId": "unique-conversation-identifier"
}
```

#### Required Fields

- **from**: The ID of the source agent (e.g., "user-agent", "git-agent")
- **to**: The ID of the target agent
- **task**: The task or action to perform

#### Optional Fields

- **params**: Object containing task-specific parameters
- **conversationId**: Unique identifier for grouping related messages
- **meta**: Additional metadata about the message or context

### Response Format

Responses follow the same general format but with the source and target agents swapped:

```json
{
  "to": "source-agent-id",
  "from": "target-agent-id",
  "conversationId": "unique-conversation-identifier",
  "task": "task-response",
  "params": {
    "status": "success|error",
    "result": "task-result",
    "error": "error-message"
  }
}
```

## A2A Manager

The A2A Manager (`core/mcp/a2a_manager.js`) serves as the central hub for routing messages between agents. It provides the following core functionality:

- Agent registration and discovery
- Message validation and routing
- Conversation history tracking
- Error handling

### Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│ Source      │     │                 │     │ Target      │
│ Agent       │────▶│  A2A Manager    │────▶│ Agent       │
└─────────────┘     │                 │     └─────────────┘
                    └─────────────────┘
                            │
                    ┌───────▼───────┐
                    │ Conversation  │
                    │ History       │
                    └───────────────┘
```

## Message Flow

1. **Message Creation**: An agent (or user) creates a message in the standard format
2. **Message Submission**: The message is submitted to the A2A Manager
3. **Validation**: The message is validated for required fields
4. **Routing**: The message is routed to the target agent
5. **Processing**: The target agent processes the message
6. **Response Creation**: The target agent creates a response message
7. **Response Routing**: The response is routed back to the source agent
8. **History**: All messages are stored in the conversation history

## Creating A2A Agents

To create a new A2A agent:

1. Create a handler function for processing messages
2. Register the agent with the A2A Manager
3. Implement task-specific logic in the handler

### Handler Implementation

```javascript
function handleA2AMessage(message) {
  // Validate message
  if (message.task !== 'expected-task') {
    return {
      to: message.from,
      from: 'my-agent',
      conversationId: message.conversationId,
      task: 'error',
      params: {
        status: 'error',
        error: 'Unsupported task'
      }
    };
  }

  // Process message
  const result = processTask(message.params);

  // Return response
  return {
    to: message.from,
    from: 'my-agent',
    conversationId: message.conversationId,
    task: 'task-response',
    params: {
      status: 'success',
      result: result
    }
  };
}
```

### Agent Registration

```javascript
const a2aManager = require('./core/mcp/a2a_manager');

// Register agent
a2aManager.registerAgent('my-agent', handleA2AMessage);
```

## Error Handling

Errors in the A2A protocol are communicated through the standard message format with a status of 'error':

```json
{
  "to": "source-agent-id",
  "from": "target-agent-id",
  "conversationId": "unique-conversation-identifier",
  "task": "error",
  "params": {
    "status": "error",
    "error": "Error message",
    "code": 400
  }
}
```

### Common Error Codes

- **400**: Bad Request - The message is malformed or missing required fields
- **404**: Not Found - The target agent does not exist
- **405**: Method Not Allowed - The task is not supported by the target agent
- **500**: Internal Error - An error occurred during task processing

## Security Considerations

The A2A protocol includes several security features:

1. **Validation**: All messages are validated before processing
2. **Agent Authorization**: Agents can restrict which other agents can send them messages
3. **Parameter Sanitization**: Parameters are sanitized before use
4. **Execution Boundaries**: Agents operate within defined security constraints

### Security Best Practices

- Validate all input parameters before use
- Limit task execution to necessary operations
- Use the minimal permissions required for each task
- Implement timeouts for long-running tasks
- Log all agent interactions for auditing

## Examples

### Git Agent Integration

```javascript
// Send a git status command
const message = {
  from: 'user-agent',
  to: 'git-agent',
  task: 'git-operation',
  params: {
    operation: 'status'
  },
  conversationId: 'git-session-123456'
};

// Send message through A2A Manager
const response = await a2aManager.sendMessage(message);

// Process response
if (response.params.status === 'success') {
  console.log(response.params.output);
} else {
  console.error(`Error: ${response.params.error}`);
}
```

### Multi-Agent Workflow

```javascript
async function analyzeCode() {
  // First agent: Code analysis
  const analysisMessage = {
    from: 'workflow-agent',
    to: 'code-analyzer',
    task: 'analyze-code',
    params: {
      file: 'src/main.js'
    }
  };
  
  const analysisResponse = await a2aManager.sendMessage(analysisMessage);
  
  // Second agent: Git operations based on analysis
  const gitMessage = {
    from: 'workflow-agent',
    to: 'git-agent',
    task: 'git-operation',
    params: {
      operation: 'commit',
      message: `Fix issues found in analysis: ${analysisResponse.params.result.summary}`,
      all: true
    }
  };
  
  return await a2aManager.sendMessage(gitMessage);
}
```

## Best Practices

### Message Design

- Use consistent task names across related operations
- Group related parameters logically
- Use descriptive error messages
- Include only necessary data in messages

### Agent Implementation

- Implement strict validation for incoming messages
- Provide detailed error information
- Use asynchronous processing for long-running tasks
- Maintain statelessness where possible

### Workflow Design

- Break complex workflows into discrete tasks
- Use conversation IDs to track related messages
- Implement proper error handling between steps
- Provide progress updates for multi-step workflows

## API Reference

### A2A Manager

#### registerAgent(agentId, handler)

Registers an agent with the A2A Manager.

- **agentId**: String - Unique identifier for the agent
- **handler**: Function - Function to handle incoming messages

```javascript
a2aManager.registerAgent('my-agent', handleA2AMessage);
```

#### async sendMessage(message)

Sends a message to an agent and returns the response.

- **message**: Object - A2A message to send
- **Returns**: Promise - Resolves to the agent's response

```javascript
const response = await a2aManager.sendMessage(message);
```

#### validateMessage(message)

Validates a message format.

- **message**: Object - A2A message to validate
- **Throws**: Error - If message is invalid

```javascript
a2aManager.validateMessage(message);
```

#### getConversation(conversationId)

Gets the history of a conversation.

- **conversationId**: String - Unique conversation identifier
- **Returns**: Array - List of messages in the conversation

```javascript
const history = a2aManager.getConversation('conversation-123');
```

#### listAgents()

Lists all available agents.

- **Returns**: Array - List of agent IDs

```javascript
const agents = a2aManager.listAgents();
```

---

This documentation provides a comprehensive guide to the Agent-to-Agent (A2A) protocol in the Claude Neural Framework. For specific agent implementations, refer to their respective documentation files.