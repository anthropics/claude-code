# Streaming Input vs Single Message Mode

The Claude Agent SDK supports two distinct input modes for agent interaction, each optimized for different use cases.

## Overview

1. **Streaming Input Mode** (Recommended) - Interactive sessions with full agent capabilities
2. **Single Message Input** - Simple one-shot queries for stateless environments

## Streaming Input Mode (Recommended)

Streaming input mode is the preferred approach as it provides the complete agent experience with rich interactive capabilities.

### How It Works

Streaming input mode operates as a long-lived process where agents maintain an active session and can:
- Accept continuous user input over time
- Handle interruptions gracefully mid-task
- Surface permission requests to users for review
- Manage session state effectively across multiple turns
- Provide real-time streaming responses

### Key Benefits

#### 🖼️ Image Uploads
Attach images directly to messages for visual analysis and understanding. The agent can process and reason about visual content.

#### 📨 Queued Messages
Send multiple messages that process sequentially, with the ability to interrupt ongoing operations when needed.

#### 🛠️ Full Tool Integration
Access all built-in tools and custom MCP servers during active sessions, enabling comprehensive agent capabilities.

#### 🔧 Hooks Support
Use lifecycle hooks to customize behavior at various points in the agent's execution flow.

#### ⚡ Real-time Feedback
Responses stream as they're generated, providing immediate feedback to users and enabling progressive rendering.

#### 💭 Context Persistence
Maintain conversation context across multiple turns naturally, allowing the agent to reference previous interactions.

### Implementation Example - TypeScript

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

// Create an async generator for streaming input
async function* userInputStream() {
  yield "Analyze this codebase";

  // Simulate user providing additional context
  await new Promise(resolve => setTimeout(resolve, 2000));
  yield "Focus specifically on the authentication module";

  // User provides an image
  await new Promise(resolve => setTimeout(resolve, 1000));
  yield {
    text: "Here's a diagram of the architecture",
    images: [{
      path: "./architecture.png",
      mediaType: "image/png"
    }]
  };
}

// Process streaming responses
for await (const message of query(userInputStream())) {
  if (message.type === 'assistant') {
    console.log('Assistant:', message.content);
  }
}
```

### Implementation Example - Python

```python
from claude_agent_sdk import ClaudeSDKClient
import asyncio

async def streaming_conversation():
    client = ClaudeSDKClient()

    # First message
    async for message in client.send("What's the weather like?"):
        print(message)

    # Follow-up message - maintains context
    async for message in client.send("What about tomorrow?"):
        print(message)

    # Agent remembers we're talking about weather

asyncio.run(streaming_conversation())
```

### When to Use Streaming Input

Use streaming input mode when:
- Building interactive applications (chatbots, coding assistants, etc.)
- You need to attach images or other rich media
- Context should persist across multiple user messages
- You want to interrupt long-running tasks
- Real-time streaming responses improve UX
- Using hooks to customize agent behavior

## Single Message Input

Single message input mode handles one-shot queries using session state and resuming capabilities. It's simpler but more limited.

### How It Works

Each query is treated as an independent interaction. You can optionally continue a previous session by providing session context, but the mode is designed for stateless operation.

### When to Use

Single message input is appropriate when:
- You need simple one-shot responses without follow-ups
- No image attachments are required
- Operating in stateless environments (like AWS Lambda functions)
- Building simple automation scripts
- Context persistence isn't needed

### Limitations

Single message mode does **NOT** support:
- ❌ Direct image attachments
- ❌ Dynamic message queueing
- ❌ Real-time interruption during execution
- ❌ Hook integration for lifecycle events
- ❌ Natural multi-turn conversations

### Implementation Example - TypeScript

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

// Simple one-shot query
const messages = [];
for await (const message of query("What's 2+2?")) {
  messages.push(message);
}

console.log(messages);

// To continue a session, you'd need to manually manage state
// This is more complex than streaming mode
```

### Implementation Example - Python

```python
from claude_agent_sdk import query
import asyncio

async def single_query():
    messages = []
    async for message in query("Explain Python decorators"):
        messages.append(message)

    # Process all messages at once
    for msg in messages:
        print(msg)

asyncio.run(single_query())
```

### Session Continuation

If you need to continue a conversation in single message mode, you must manually manage session state:

```python
from claude_agent_sdk import query, ClaudeAgentOptions
import asyncio

async def continued_session():
    # First query
    session_id = None
    async for message in query("What's the capital of France?"):
        if message.type == "system":
            session_id = message.session_id

    # Continue session (requires manual state management)
    options = ClaudeAgentOptions(
        continue_session=session_id  # This is conceptual - actual API may differ
    )
    async for message in query("What's its population?", options):
        print(message)

asyncio.run(continued_session())
```

## Comparison Table

| Feature | Streaming Input | Single Message |
|---------|----------------|----------------|
| Image attachments | ✅ Yes | ❌ No |
| Multi-turn conversations | ✅ Natural | ⚠️ Manual state management |
| Interruption support | ✅ Yes | ❌ No |
| Hooks integration | ✅ Yes | ❌ No |
| Real-time streaming | ✅ Yes | ⚠️ Batch processing |
| Stateless environments | ⚠️ Requires session management | ✅ Yes |
| Complexity | Medium | Low |
| Use case | Interactive apps | Simple automation |

## Recommendation

**For most applications, streaming input mode provides superior functionality and user experience** through persistent sessions and rich interaction capabilities.

Only use single message mode if:
1. You're in a truly stateless environment (serverless functions)
2. You need exactly one response with no follow-up
3. You don't need any of the advanced features

## Migration from Single to Streaming

If you started with single message mode and need more features, migration is straightforward:

### Before (Single Message)
```python
async for message in query("Help me code"):
    print(message)
```

### After (Streaming)
```python
client = ClaudeSDKClient()
async for message in client.send("Help me code"):
    print(message)

# Now you can send follow-ups
async for message in client.send("Can you explain that?"):
    print(message)
```

## Best Practices

### For Streaming Input
1. **Handle Interrupts**: Implement graceful interruption handling
2. **Stream Responses**: Render responses progressively for better UX
3. **Use Context**: Leverage multi-turn context for better results
4. **Implement Hooks**: Add logging and monitoring via hooks
5. **Manage Sessions**: Properly clean up sessions when done

### For Single Message
1. **Keep It Simple**: Use for truly one-shot queries
2. **Don't Force It**: If you need follow-ups, use streaming instead
3. **Handle Errors**: Single messages can fail; have retry logic
4. **Consider Batching**: If you have multiple queries, consider batching

## See Also

- [TypeScript SDK Reference](./typescript/index.md)
- [Python SDK Reference](./python/index.md)
- [Agent SDK Overview](./overview.md)
