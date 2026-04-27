---
name: claude-api
description: This skill should be used when the user asks to "use the Claude API", "call the Anthropic API", "build with Claude", "integrate Claude into my app", "use the Anthropic SDK", "stream Claude responses", "implement tool use with Claude", "build an AI chatbot with Claude", or any task involving the Anthropic Python or TypeScript SDK.
version: 1.0.0
---

# Claude API Development

This skill guides building applications with the Claude API using the official Anthropic SDKs.

## Setup

### Python

```bash
pip install anthropic
export ANTHROPIC_API_KEY="your-api-key"
```

### TypeScript / Node.js

```bash
npm install @anthropic-ai/sdk
export ANTHROPIC_API_KEY="your-api-key"
```

## Basic Usage

### Python

```python
import anthropic

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

message = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Explain quantum entanglement simply."}
    ]
)
print(message.content[0].text)
```

### TypeScript

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [
        { role: "user", content: "Explain quantum entanglement simply." }
    ],
});
console.log(message.content[0].text);
```

## Model Selection

| Model | Use Case | Context Window |
|-------|----------|----------------|
| `claude-opus-4-6` | Most capable, complex reasoning | 200K tokens |
| `claude-sonnet-4-6` | Balanced performance/cost | 200K tokens |
| `claude-haiku-4-5-20251001` | Fast, lightweight tasks | 200K tokens |

## Streaming

### Python

```python
with client.messages.stream(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Write a poem about the sea."}]
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

### TypeScript

```typescript
const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Write a poem about the sea." }],
});

for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        process.stdout.write(event.delta.text);
    }
}
```

## System Prompts

```python
message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    system="You are a senior software engineer. Be concise and technical.",
    messages=[{"role": "user", "content": "Review this code."}]
)
```

## Multi-Turn Conversations

```python
conversation = []

def chat(user_message: str) -> str:
    conversation.append({"role": "user", "content": user_message})
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=conversation
    )
    assistant_message = response.content[0].text
    conversation.append({"role": "assistant", "content": assistant_message})
    return assistant_message

print(chat("What's the capital of France?"))
print(chat("What's the population of that city?"))
```

## Tool Use (Function Calling)

```python
tools = [
    {
        "name": "get_weather",
        "description": "Get current weather for a location",
        "input_schema": {
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "City name"},
                "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
            },
            "required": ["location"]
        }
    }
]

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    tools=tools,
    messages=[{"role": "user", "content": "What's the weather in Paris?"}]
)

# Check if Claude wants to use a tool
if response.stop_reason == "tool_use":
    tool_use = next(b for b in response.content if b.type == "tool_use")
    tool_name = tool_use.name
    tool_input = tool_use.input

    # Call your actual function here
    tool_result = {"temperature": 18, "condition": "partly cloudy"}

    # Continue conversation with tool result
    final_response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        tools=tools,
        messages=[
            {"role": "user", "content": "What's the weather in Paris?"},
            {"role": "assistant", "content": response.content},
            {
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": tool_use.id,
                    "content": str(tool_result)
                }]
            }
        ]
    )
    print(final_response.content[0].text)
```

## Vision (Image Input)

```python
import base64

# From file
with open("image.jpg", "rb") as f:
    image_data = base64.standard_b64encode(f.read()).decode("utf-8")

message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": image_data}
            },
            {"type": "text", "text": "Describe what you see in this image."}
        ]
    }]
)
```

## Error Handling

```python
from anthropic import APIError, RateLimitError, APIStatusError

try:
    response = client.messages.create(...)
except RateLimitError:
    print("Rate limited — wait before retrying")
except APIStatusError as e:
    print(f"API error {e.status_code}: {e.message}")
except APIError as e:
    print(f"Unexpected error: {e}")
```

## Best Practices

- Store `ANTHROPIC_API_KEY` in environment variables, never in code
- Use `claude-sonnet-4-6` for most tasks; reserve `claude-opus-4-6` for complex reasoning
- Set `max_tokens` explicitly — don't rely on defaults
- For production, implement retry logic with exponential backoff on rate limit errors
- Use streaming for long responses to improve perceived latency
- Cache responses for identical prompts to reduce costs
- Use `system` parameter for persistent instructions instead of repeating them in every message
- For tool use, validate tool inputs before executing them
