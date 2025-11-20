# Usage Examples for Claude Code API

This document provides practical examples of integrating the Claude Code API into various applications and workflows.

## Table of Contents

- [Quick Start](#quick-start)
- [Python Examples](#python-examples)
- [JavaScript/Node.js Examples](#javascriptnodejs-examples)
- [cURL Examples](#curl-examples)
- [Integration Patterns](#integration-patterns)
- [Common Use Cases](#common-use-cases)

## Quick Start

### Start the Server

```bash
cd api-server
./start_server.sh
```

### Test with cURL

```bash
curl http://localhost:8000/health
```

## Python Examples

### Basic Execution

```python
import requests

def execute_claude(prompt: str) -> dict:
    """Execute a Claude Code command."""
    response = requests.post(
        "http://localhost:8000/api/execute",
        headers={
            "X-API-Key": "your-api-key",
            "Content-Type": "application/json"
        },
        json={"prompt": prompt}
    )
    response.raise_for_status()
    return response.json()

# Example usage
result = execute_claude("List all Python files in the current directory")
print(result['output'])
```

### Streaming Response

```python
import requests

def stream_claude(prompt: str):
    """Stream Claude Code output in real-time."""
    response = requests.post(
        "http://localhost:8000/api/execute/stream",
        headers={
            "X-API-Key": "your-api-key",
            "Content-Type": "application/json"
        },
        json={"prompt": prompt},
        stream=True
    )
    response.raise_for_status()

    for line in response.iter_lines():
        if line:
            print(line.decode('utf-8'))

# Example usage
stream_claude("Analyze the codebase structure")
```

### Error Handling

```python
import requests
from typing import Optional

def safe_execute_claude(
    prompt: str,
    timeout: int = 300
) -> Optional[dict]:
    """Execute with proper error handling."""
    try:
        response = requests.post(
            "http://localhost:8000/api/execute",
            headers={
                "X-API-Key": "your-api-key",
                "Content-Type": "application/json"
            },
            json={
                "prompt": prompt,
                "timeout": timeout
            },
            timeout=timeout + 10  # Add buffer for network
        )
        response.raise_for_status()
        result = response.json()

        if not result['success']:
            print(f"Execution failed: {result['error']}")
            return None

        return result

    except requests.exceptions.Timeout:
        print(f"Request timed out after {timeout} seconds")
        return None
    except requests.exceptions.HTTPError as e:
        print(f"HTTP error: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None

# Example usage
result = safe_execute_claude("Complex task", timeout=600)
if result:
    print(f"Completed in {result['execution_time']:.2f}s")
```

### Async with aiohttp

```python
import aiohttp
import asyncio

async def async_execute_claude(prompt: str) -> dict:
    """Execute Claude Code asynchronously."""
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "http://localhost:8000/api/execute",
            headers={
                "X-API-Key": "your-api-key",
                "Content-Type": "application/json"
            },
            json={"prompt": prompt}
        ) as response:
            response.raise_for_status()
            return await response.json()

# Example usage
async def main():
    tasks = [
        async_execute_claude("Task 1"),
        async_execute_claude("Task 2"),
        async_execute_claude("Task 3")
    ]
    results = await asyncio.gather(*tasks)
    for i, result in enumerate(results, 1):
        print(f"Task {i}: {result['success']}")

asyncio.run(main())
```

## JavaScript/Node.js Examples

### Basic Execution (fetch)

```javascript
async function executeClaude(prompt) {
    const response = await fetch('http://localhost:8000/api/execute', {
        method: 'POST',
        headers: {
            'X-API-Key': 'your-api-key',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

// Example usage
executeClaude('List all JavaScript files')
    .then(result => console.log(result.output))
    .catch(error => console.error('Error:', error));
```

### Streaming Response

```javascript
async function streamClaude(prompt) {
    const response = await fetch('http://localhost:8000/api/execute/stream', {
        method: 'POST',
        headers: {
            'X-API-Key': 'your-api-key',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        process.stdout.write(text);
    }
}

// Example usage
streamClaude('Analyze the project structure')
    .catch(error => console.error('Error:', error));
```

### Using Axios

```javascript
const axios = require('axios');

const claudeAPI = axios.create({
    baseURL: 'http://localhost:8000',
    headers: {
        'X-API-Key': 'your-api-key',
        'Content-Type': 'application/json'
    }
});

async function executeClaude(prompt, options = {}) {
    try {
        const response = await claudeAPI.post('/api/execute', {
            prompt,
            ...options
        });
        return response.data;
    } catch (error) {
        if (error.response) {
            console.error('Error:', error.response.status, error.response.data);
        } else {
            console.error('Error:', error.message);
        }
        throw error;
    }
}

// Example usage
executeClaude('Find all TODO comments', { timeout: 60 })
    .then(result => {
        console.log('Success:', result.success);
        console.log('Output:', result.output);
    });
```

### Express.js Webhook Integration

```javascript
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Webhook endpoint that triggers Claude Code
app.post('/webhook/process', async (req, res) => {
    const { task, repo_path } = req.body;

    try {
        const response = await axios.post(
            'http://localhost:8000/api/execute',
            {
                prompt: task,
                working_directory: repo_path,
                timeout: 300
            },
            {
                headers: {
                    'X-API-Key': process.env.CLAUDE_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            result: response.data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(3000, () => {
    console.log('Webhook server running on port 3000');
});
```

## cURL Examples

### Basic Request

```bash
curl -X POST http://localhost:8000/api/execute \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "List all files in the src directory"
  }'
```

### With Custom Working Directory

```bash
curl -X POST http://localhost:8000/api/execute \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Run tests",
    "working_directory": "/home/user/myproject",
    "timeout": 180
  }'
```

### Streaming Request

```bash
curl -X POST http://localhost:8000/api/execute/stream \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Analyze code quality"
  }' \
  --no-buffer
```

### Pretty Print JSON Response

```bash
curl -X POST http://localhost:8000/api/execute \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Show git status"}' \
  | jq '.'
```

## Integration Patterns

### CI/CD Integration (GitHub Actions)

```yaml
name: Code Analysis
on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Claude Code Analysis
        run: |
          curl -X POST ${{ secrets.CLAUDE_API_URL }}/api/execute \
            -H "X-API-Key: ${{ secrets.CLAUDE_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d "{
              \"prompt\": \"Analyze this code for security issues\",
              \"working_directory\": \"$GITHUB_WORKSPACE\",
              \"timeout\": 300
            }" > analysis.json

      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: analysis-results
          path: analysis.json
```

### Slack Bot Integration

```python
from slack_bolt import App
import requests

app = App(token=os.environ["SLACK_BOT_TOKEN"])

@app.command("/claude")
def handle_claude_command(ack, command, say):
    ack()

    prompt = command['text']

    try:
        result = requests.post(
            "http://localhost:8000/api/execute",
            headers={"X-API-Key": os.environ["CLAUDE_API_KEY"]},
            json={"prompt": prompt, "timeout": 60}
        ).json()

        if result['success']:
            say(f"✅ {result['output']}")
        else:
            say(f"❌ Error: {result['error']}")
    except Exception as e:
        say(f"❌ Failed to execute: {str(e)}")

if __name__ == "__main__":
    app.start(port=3000)
```

### Discord Bot Integration

```python
import discord
import requests
from discord.ext import commands

bot = commands.Bot(command_prefix='!')

@bot.command()
async def claude(ctx, *, prompt):
    """Execute Claude Code command"""
    await ctx.send(f"🔄 Executing: {prompt}")

    try:
        result = requests.post(
            "http://localhost:8000/api/execute",
            headers={"X-API-Key": os.environ["CLAUDE_API_KEY"]},
            json={"prompt": prompt, "timeout": 120}
        ).json()

        if result['success']:
            # Discord has message length limits
            output = result['output'][:1900]
            await ctx.send(f"```\n{output}\n```")
        else:
            await ctx.send(f"❌ Error: {result['error']}")
    except Exception as e:
        await ctx.send(f"❌ Failed: {str(e)}")

bot.run(os.environ['DISCORD_TOKEN'])
```

## Common Use Cases

### 1. Code Review Automation

```python
def review_pull_request(repo_path: str, pr_number: int) -> dict:
    """Automated PR review using Claude Code."""
    prompt = f"""
    Review the changes in pull request #{pr_number}.
    Check for:
    - Code quality issues
    - Security vulnerabilities
    - Best practice violations
    - Test coverage

    Provide a detailed review with specific line references.
    """

    return execute_claude(prompt, working_directory=repo_path)
```

### 2. Automated Documentation

```python
def generate_documentation(repo_path: str) -> dict:
    """Generate documentation for a codebase."""
    prompt = """
    Generate comprehensive documentation for this project:
    - README with project overview
    - API documentation
    - Setup instructions
    - Usage examples
    """

    return execute_claude(prompt, working_directory=repo_path)
```

### 3. Bug Triage

```python
def triage_bug_report(bug_description: str, repo_path: str) -> dict:
    """Analyze and triage a bug report."""
    prompt = f"""
    Analyze this bug report:
    {bug_description}

    1. Identify likely affected files
    2. Suggest potential causes
    3. Recommend investigation steps
    """

    return execute_claude(prompt, working_directory=repo_path)
```

### 4. Batch Processing

```python
import asyncio

async def process_repositories(repos: list) -> list:
    """Process multiple repositories in parallel."""
    tasks = []

    for repo in repos:
        task = async_execute_claude(
            prompt=f"Analyze security in {repo['name']}",
            working_directory=repo['path']
        )
        tasks.append(task)

    return await asyncio.gather(*tasks)

# Usage
repos = [
    {"name": "repo1", "path": "/path/to/repo1"},
    {"name": "repo2", "path": "/path/to/repo2"}
]

results = asyncio.run(process_repositories(repos))
```

### 5. Scheduled Tasks (Cron)

```bash
#!/bin/bash
# daily-analysis.sh

# Daily code analysis
curl -X POST http://localhost:8000/api/execute \
  -H "X-API-Key: ${CLAUDE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Generate daily code quality report",
    "working_directory": "/home/user/projects/main",
    "timeout": 600
  }' | jq '.output' > "/var/reports/$(date +%Y%m%d)-report.txt"
```

Add to crontab:
```
0 2 * * * /home/user/scripts/daily-analysis.sh
```

## Best Practices

1. **Timeout Management**: Set appropriate timeouts based on task complexity
2. **Error Handling**: Always implement proper error handling
3. **Rate Limiting**: Implement rate limiting for production use
4. **Logging**: Log all API calls for debugging and auditing
5. **Security**: Never expose API keys in client-side code
6. **Working Directory**: Always specify working_directory for clarity
7. **Async Operations**: Use async/await for non-blocking operations

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check API key in headers
2. **Timeout**: Increase timeout value or optimize prompt
3. **500 Error**: Check Claude Code installation and logs
4. **Empty Output**: Verify working_directory exists and is accessible

### Debug Mode

Enable verbose logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

View server logs:
```bash
tail -f /var/log/claude-api.log
```
