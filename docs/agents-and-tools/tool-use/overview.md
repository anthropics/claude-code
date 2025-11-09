# Tool Use with Claude - Overview

Claude can interact with external tools and functions to extend its capabilities beyond text generation. This enables Claude to perform actions, retrieve data, and integrate with external systems.

## Key Concepts

Claude supports two primary tool types:

### Client Tools
Execute on your systems, giving you full control over implementation and execution. These include:
- **Custom tools** you create for your specific use cases
- **Anthropic-defined tools** like computer use and text editing

### Server Tools
Execute on Anthropic's servers with no client-side implementation required. These include:
- **Web search** - Search the internet for current information
- **Web fetch** - Retrieve and process web content

## How Tool Use Works

The tool use workflow follows four steps:

### 1. Provide Tools and Prompt
Define your tools in the API request with:
- **Name**: A clear identifier for the tool
- **Description**: Explains what the tool does and when to use it
- **Input schema**: JSON Schema defining expected parameters

```python
tools = [
    {
        "name": "get_weather",
        "description": "Get the current weather for a location",
        "input_schema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City name or ZIP code"
                },
                "units": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "description": "Temperature units"
                }
            },
            "required": ["location"]
        }
    }
]
```

### 2. Claude Decides
The model assesses whether any tools would help answer the prompt. If yes:
- Claude constructs properly formatted tool requests
- Response includes `stop_reason: "tool_use"`
- Tool calls appear in the response content blocks

### 3. Execute and Return Results
Your system:
- Executes the requested tool with provided parameters
- Formats the result
- Returns it in a `tool_result` content block

```python
{
    "role": "user",
    "content": [
        {
            "type": "tool_result",
            "tool_use_id": "toolu_123",
            "content": "Temperature: 72°F, Conditions: Sunny"
        }
    ]
}
```

### 4. Generate Response
Claude processes the tool results and formulates a natural language response incorporating the retrieved data.

## Tool Capabilities

### Parallel Execution
Claude can call multiple independent tools simultaneously to improve efficiency:

```json
{
    "content": [
        {
            "type": "tool_use",
            "id": "toolu_1",
            "name": "get_weather",
            "input": {"location": "New York"}
        },
        {
            "type": "tool_use",
            "id": "toolu_2",
            "name": "get_weather",
            "input": {"location": "Los Angeles"}
        }
    ]
}
```

### Sequential Chaining
Tools can pass outputs to subsequent tools, enabling multi-step workflows:
1. First tool retrieves data
2. Second tool processes the data
3. Third tool formats the result

### JSON Mode
Use tools to enforce structured output following specific schemas. This is useful for:
- Extracting structured data from text
- Generating formatted responses
- Ensuring consistent output formats

### Handling Missing Parameters

Different Claude models handle missing information differently:

- **Claude Opus**: Better at asking for clarification when parameters are missing
- **Claude Sonnet**: May infer reasonable default values for missing parameters

**Best Practice**: Provide clear descriptions and mark parameters as required when they cannot be reasonably inferred.

## Pricing

Tool use incurs costs based on several factors:

### Token Costs
- **Input tokens**: Tool definitions and schemas count toward input
- **Output tokens**: Both `tool_use` and `tool_result` blocks count
- **System prompt overhead**: Additional 313-346 tokens depending on model and `tool_choice` setting

### Server Tool Costs
- **Web search**: Additional per-use fees apply
- Check current pricing documentation for specific rates

### Optimization Tips
1. **Reuse schemas**: Use references for repeated structures
2. **Concise descriptions**: Clear but brief tool descriptions
3. **Batch operations**: Combine related operations when possible

## Implementation Examples

### Basic Tool Definition - Python

```python
import anthropic

client = anthropic.Anthropic()

tools = [
    {
        "name": "get_stock_price",
        "description": "Get the current stock price for a given ticker symbol",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol (e.g., AAPL, GOOGL)"
                }
            },
            "required": ["ticker"]
        }
    }
]

message = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    tools=tools,
    messages=[
        {"role": "user", "content": "What's the current price of Apple stock?"}
    ]
)
```

### Tool Execution - TypeScript

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

async function executeTools(message: Anthropic.Message) {
    // Check if Claude wants to use tools
    if (message.stop_reason === 'tool_use') {
        const toolResults = [];

        for (const content of message.content) {
            if (content.type === 'tool_use') {
                // Execute the tool
                const result = await executeTool(content.name, content.input);

                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: content.id,
                    content: JSON.stringify(result)
                });
            }
        }

        // Send results back to Claude
        const response = await client.messages.create({
            model: 'claude-sonnet-4-5',
            max_tokens: 1024,
            messages: [
                ...previousMessages,
                { role: 'assistant', content: message.content },
                { role: 'user', content: toolResults }
            ]
        });

        return response;
    }
}
```

### Multiple Tools - Shell

```bash
curl https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4-5",
    "max_tokens": 1024,
    "tools": [
      {
        "name": "get_weather",
        "description": "Get weather for a location",
        "input_schema": {
          "type": "object",
          "properties": {
            "location": {"type": "string"}
          },
          "required": ["location"]
        }
      },
      {
        "name": "get_time",
        "description": "Get current time for a timezone",
        "input_schema": {
          "type": "object",
          "properties": {
            "timezone": {"type": "string"}
          },
          "required": ["timezone"]
        }
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": "What is the weather and time in Tokyo?"
      }
    ]
  }'
```

## Best Practices

### Tool Design
1. **Clear naming**: Use descriptive, action-oriented names
2. **Detailed descriptions**: Explain what the tool does and when to use it
3. **Well-defined schemas**: Use JSON Schema validation features
4. **Required vs optional**: Clearly mark which parameters are required

### Error Handling
1. **Validate inputs**: Check parameters before execution
2. **Return meaningful errors**: Provide context in error messages
3. **Handle timeouts**: Implement appropriate timeout logic
4. **Retry logic**: Add retries for transient failures

### Security
1. **Validate all inputs**: Never trust tool parameters blindly
2. **Limit scope**: Only expose necessary tools
3. **Audit usage**: Log all tool executions
4. **Rate limiting**: Implement appropriate rate limits

### Performance
1. **Parallel when possible**: Allow Claude to call independent tools simultaneously
2. **Cache results**: Reuse results when appropriate
3. **Optimize schemas**: Keep schemas concise but complete
4. **Batch operations**: Combine related operations

## Common Patterns

### Calculator Tool
Simple arithmetic operations with type validation.

### Customer Service Agent
Tools for looking up orders, checking inventory, and processing refunds.

### JSON Extraction
Using tools to enforce structured output for data extraction tasks.

### Web Research
Combining web search and web fetch for comprehensive information gathering.

## Resources

- [Agent SDK Overview](../../agent-sdk/overview.md) - Build agents with built-in tool support
- [MCP Connector](../mcp-connector.md) - Connect to Model Context Protocol servers
- [Agent Skills](../agent-skills.md) - Extend capabilities with skills

## Additional Documentation

For complete implementation guides and advanced patterns, see:
- Tool use cookbooks
- API reference documentation
- Code examples repository
