# Agent Skills with the API

Agent Skills extend Claude's capabilities through organized collections of instructions, scripts, and resources. They enable Claude to perform specialized tasks like working with Office documents, PDFs, and other complex file formats.

## Overview

Agent Skills integrate with the Messages API via the code execution tool and come from two sources:

### Anthropic Skills
Pre-built skills provided by Anthropic for common tasks:
- **`pptx`** - Create and edit PowerPoint presentations
- **`xlsx`** - Work with Excel spreadsheets
- **`docx`** - Process Word documents
- **`pdf`** - Extract and analyze PDF content

### Custom Skills
User-created and managed skills via the Skills API for organization-specific needs.

## Key Requirements

To use Agent Skills, you need:

1. **Anthropic API key** - For authentication
2. **Beta headers** - Enable code execution and Skills support
3. **Code execution tool** - Must be enabled in your request

## Using Skills

Skills are specified in the `container` parameter when creating messages. You can use up to 8 skills per request.

### Basic Usage - Python

```python
import anthropic

client = anthropic.Anthropic()

message = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    extra_headers={
        "anthropic-beta": "code-execution-2024-10-22,skills-2024-10-22"
    },
    tools=[
        {"type": "code_execution"}
    ],
    container={
        "skills": [
            {
                "type": "anthropic",
                "skill_id": "pptx",
                "version": "latest"
            }
        ]
    },
    messages=[
        {
            "role": "user",
            "content": "Create a presentation about AI trends with 5 slides"
        }
    ]
)
```

### Using Multiple Skills

```python
container = {
    "skills": [
        {"type": "anthropic", "skill_id": "pptx", "version": "latest"},
        {"type": "anthropic", "skill_id": "xlsx", "version": "latest"},
        {"type": "anthropic", "skill_id": "pdf", "version": "latest"}
    ]
}

message = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    extra_headers={
        "anthropic-beta": "code-execution-2024-10-22,skills-2024-10-22"
    },
    tools=[{"type": "code_execution"}],
    container=container,
    messages=[
        {
            "role": "user",
            "content": "Extract data from report.pdf and create an Excel summary"
        }
    ]
)
```

### Using Custom Skills

```python
container = {
    "skills": [
        {
            "type": "custom",
            "skill_id": "my-custom-skill",
            "version": "1.0.0"
        }
    ]
}
```

## Managing Custom Skills

The Skills API provides endpoints for managing your custom skills.

### Create a Skill

Upload a skill directory (maximum 8MB total size):

```python
import anthropic
import os

client = anthropic.Anthropic()

# Create skill from directory
with open("my-skill.zip", "rb") as f:
    skill = client.skills.create(
        name="my-custom-skill",
        version="1.0.0",
        files=f
    )

print(f"Created skill: {skill.skill_id}")
```

### List Skills

Retrieve all available skills with optional filtering:

```python
# List all skills
skills = client.skills.list()

for skill in skills:
    print(f"{skill.name} (v{skill.version}): {skill.skill_id}")

# Filter by name
specific_skills = client.skills.list(name="my-custom-skill")
```

### Retrieve Skill Details

Get information about a specific skill:

```python
skill = client.skills.retrieve("skill_abc123")

print(f"Name: {skill.name}")
print(f"Version: {skill.version}")
print(f"Created: {skill.created_at}")
print(f"Description: {skill.description}")
```

### Delete a Skill

Remove a skill and all its versions:

```python
# Delete specific version first
client.skills.delete_version("skill_abc123", "1.0.0")

# Then delete the skill
client.skills.delete("skill_abc123")
```

### Version Management

Pin to specific versions or use "latest":

```python
# Use latest version (recommended for development)
container = {
    "skills": [
        {"type": "custom", "skill_id": "my-skill", "version": "latest"}
    ]
}

# Pin to specific version (recommended for production)
container = {
    "skills": [
        {"type": "custom", "skill_id": "my-skill", "version": "1.2.3"}
    ]
}
```

## Key Capabilities

### Download Generated Files

Skills can generate files that you can download using the Files API:

```python
# After Claude generates a file
message = client.messages.create(...)

# Extract file IDs from the response
for content in message.content:
    if content.type == "tool_use" and content.name == "code_execution":
        result = content.result
        if "file_id" in result:
            file_id = result["file_id"]

            # Download the file
            file_content = client.files.retrieve(file_id)
            with open("output.pptx", "wb") as f:
                f.write(file_content)
```

### Multi-turn Conversations

Reuse container IDs to maintain context across multiple messages:

```python
# First message
response1 = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    extra_headers={
        "anthropic-beta": "code-execution-2024-10-22,skills-2024-10-22"
    },
    tools=[{"type": "code_execution"}],
    container={
        "skills": [{"type": "anthropic", "skill_id": "xlsx", "version": "latest"}]
    },
    messages=[
        {"role": "user", "content": "Create a sales report spreadsheet"}
    ]
)

# Get container ID
container_id = response1.container_id

# Follow-up message using same container
response2 = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    extra_headers={
        "anthropic-beta": "code-execution-2024-10-22,skills-2024-10-22"
    },
    tools=[{"type": "code_execution"}],
    container={"id": container_id},
    messages=[
        {"role": "user", "content": "Create a sales report spreadsheet"},
        {"role": "assistant", "content": response1.content},
        {"role": "user", "content": "Add a chart showing monthly trends"}
    ]
)
```

### Long-running Operations

Handle tasks that require multiple steps with `pause_turn`:

```python
response = client.messages.create(...)

while response.stop_reason == "pause_turn":
    # Task is still running
    print("Processing...")

    # Continue the conversation
    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        extra_headers={
            "anthropic-beta": "code-execution-2024-10-22,skills-2024-10-22"
        },
        tools=[{"type": "code_execution"}],
        container={"id": response.container_id},
        messages=[
            # Previous messages...
            {"role": "assistant", "content": response.content},
            {"role": "user", "content": "continue"}
        ]
    )

print("Task completed!")
```

### Combine Multiple Skills

Create complex workflows by combining different skills:

```python
container = {
    "skills": [
        {"type": "anthropic", "skill_id": "pdf", "version": "latest"},
        {"type": "anthropic", "skill_id": "xlsx", "version": "latest"},
        {"type": "anthropic", "skill_id": "pptx", "version": "latest"}
    ]
}

message = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=2048,
    extra_headers={
        "anthropic-beta": "code-execution-2024-10-22,skills-2024-10-22"
    },
    tools=[{"type": "code_execution"}],
    container=container,
    messages=[
        {
            "role": "user",
            "content": "Extract data from quarterly-report.pdf, analyze it in Excel, and create a presentation summarizing the findings"
        }
    ]
)
```

## Constraints

Be aware of these limitations when working with skills:

### Request Limits
- **Maximum 8 skills** per request
- Total skill package size under **8MB**

### Execution Environment
- **No network access** during skill execution
- **No runtime package installation** (all dependencies must be included)

### Version Management
- Must delete all versions before deleting a skill
- Version pinning recommended for production use

## TypeScript Example

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

async function useSkills() {
    const message = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        extra_headers: {
            'anthropic-beta': 'code-execution-2024-10-22,skills-2024-10-22'
        },
        tools: [{ type: 'code_execution' }],
        container: {
            skills: [
                { type: 'anthropic', skill_id: 'docx', version: 'latest' }
            ]
        },
        messages: [
            {
                role: 'user',
                content: 'Create a professional resume document'
            }
        ]
    });

    console.log(message);
}

useSkills();
```

## Creating Custom Skills

Custom skills are packaged as directories containing:

### Skill Structure
```
my-skill/
├── skill.json          # Skill metadata and configuration
├── main.py            # Entry point script
├── requirements.txt   # Python dependencies (pre-installed)
└── resources/         # Additional files and data
    └── templates/
```

### skill.json Example
```json
{
    "name": "my-custom-skill",
    "version": "1.0.0",
    "description": "Processes custom data formats",
    "entrypoint": "main.py",
    "language": "python",
    "dependencies": [
        "pandas==2.0.0",
        "numpy==1.24.0"
    ]
}
```

### Best Practices

1. **Include all dependencies**: Skills run in isolated environments
2. **Keep size under 8MB**: Compress and optimize where possible
3. **Version your skills**: Use semantic versioning
4. **Document your skills**: Include clear descriptions and examples
5. **Test thoroughly**: Validate in development before production use

## Error Handling

```python
try:
    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        extra_headers={
            "anthropic-beta": "code-execution-2024-10-22,skills-2024-10-22"
        },
        tools=[{"type": "code_execution"}],
        container={
            "skills": [
                {"type": "anthropic", "skill_id": "pptx", "version": "latest"}
            ]
        },
        messages=[{"role": "user", "content": "Create a presentation"}]
    )
except anthropic.BadRequestError as e:
    print(f"Invalid request: {e}")
except anthropic.RateLimitError as e:
    print(f"Rate limit exceeded: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

## Use Cases

### Document Processing
- Extract data from PDFs
- Generate reports in Word format
- Create automated presentations

### Data Analysis
- Process Excel spreadsheets
- Generate charts and visualizations
- Combine data from multiple sources

### Automation Workflows
- Convert between document formats
- Batch process multiple files
- Generate standardized reports

### Custom Business Logic
- Industry-specific document processing
- Specialized data transformations
- Integration with proprietary formats

## See Also

- [Tool Use Overview](./tool-use/overview.md) - Learn about Claude's tool capabilities
- [Agent SDK Overview](../agent-sdk/overview.md) - Build agents with skills
- [Code Execution](https://docs.anthropic.com/en/docs/build-with-claude/code-execution) - Code execution documentation
- [Skills API Reference](https://docs.anthropic.com/en/api/skills) - Complete API reference
