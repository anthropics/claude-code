# Agent-to-Agent Communication

Facilitate communication between agents by generating, sending, and interpreting agent messages according to the A2A protocol.

## Usage
/agent-to-agent $ARGUMENTS

## Parameters
- from: Source agent identifier (default: 'user-agent')
- to: Target agent identifier (required)
- task: Task or action to perform (required)
- params: JSON string containing parameters (default: '{}')
- conversationId: Conversation identifier for related messages (optional)

## Example
/agent-to-agent --to=code-analyzer --task=analyze-complexity --params='{"code": "function factorial(n) { return n <= 1 ? 1 : n * factorial(n-1); }", "language": "javascript"}'

The command will:
1. Create a properly formatted agent message
2. Route the message to the specified agent
3. Wait for and display the response
4. Format the response appropriately based on content type
5. Provide additional context for understanding the result

This command is useful for:
- Testing agent-to-agent communication
- Performing complex tasks that involve multiple specialized agents
- Debugging agent functionality
- Exploring available agent capabilities
- Creating multi-step workflows by chaining agent interactions

Results are returned in a structured format matching the agent message protocol specification.
