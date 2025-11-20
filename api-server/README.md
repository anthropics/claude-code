# Claude Code API Server

A FastAPI-based HTTP server that provides REST API endpoints for executing Claude Code commands programmatically.

## Features

- 🚀 **REST API**: Execute Claude Code via HTTP requests
- 📡 **Streaming Support**: Real-time streaming of Claude Code output
- 🔐 **Authentication**: API key-based authentication
- ⚙️ **Configurable**: Environment-based configuration
- 📝 **OpenAPI Docs**: Auto-generated API documentation
- 🎯 **Type Safe**: Full Pydantic model validation

## Quick Start

### 1. Installation

```bash
cd api-server

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Enable/disable authentication
ENABLE_AUTH=true

# Set your API key (required if ENABLE_AUTH=true)
CLAUDE_API_KEY=your-secret-api-key-here

# Server settings
HOST=0.0.0.0
PORT=8000

# Claude Code settings
CLAUDE_CODE_PATH=claude
DEFAULT_WORKING_DIR=/path/to/your/project
```

### 3. Run the Server

```bash
# Load environment variables
export $(cat .env | xargs)

# Start the server
python server.py
```

The server will start on `http://localhost:8000` (or your configured HOST:PORT).

## API Documentation

Once running, access the interactive API documentation at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Health Check

**GET** `/health`

Check if the service is running and Claude Code is available.

```bash
curl http://localhost:8000/health
```

Response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "claude_code_available": true
}
```

### Execute Claude Code (Complete Response)

**POST** `/api/execute`

Execute a Claude Code command and get the complete response after execution finishes.

**Headers:**
- `X-API-Key`: Your API key (required if authentication is enabled)
- `Content-Type`: application/json

**Request Body:**
```json
{
  "prompt": "List all files in the src/ directory",
  "working_directory": "/path/to/project",
  "session_id": "optional-session-id",
  "stream": false,
  "timeout": 300,
  "env_vars": {
    "CUSTOM_VAR": "value"
  }
}
```

**Fields:**
- `prompt` (required): The task/command for Claude Code
- `working_directory` (optional): Directory to execute in (defaults to DEFAULT_WORKING_DIR)
- `session_id` (optional): Session ID for continuity
- `stream` (optional): Must be false for this endpoint
- `timeout` (optional): Timeout in seconds (default: 300)
- `env_vars` (optional): Additional environment variables

**Example:**

```bash
curl -X POST http://localhost:8000/api/execute \
  -H "X-API-Key: your-secret-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a hello.py file that prints Hello World",
    "working_directory": "/tmp/test"
  }'
```

**Response:**
```json
{
  "success": true,
  "output": "I'll create a hello.py file...\n[file contents]\nDone!",
  "error": null,
  "exit_code": 0,
  "execution_time": 2.34,
  "timestamp": "2025-11-20T10:30:00.123456"
}
```

### Execute Claude Code (Streaming)

**POST** `/api/execute/stream`

Execute a Claude Code command and stream the response in real-time.

**Headers:**
- `X-API-Key`: Your API key (required if authentication is enabled)
- `Content-Type`: application/json

**Request Body:**
```json
{
  "prompt": "Analyze the codebase and find all TODO comments",
  "working_directory": "/path/to/project",
  "env_vars": {}
}
```

**Example:**

```bash
curl -X POST http://localhost:8000/api/execute/stream \
  -H "X-API-Key: your-secret-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "List all Python files in the project",
    "working_directory": "/home/user/my-project"
  }'
```

Response will be streamed as `text/event-stream`.

## Usage Examples

### Python Client

```python
import requests

API_URL = "http://localhost:8000"
API_KEY = "your-secret-api-key-here"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# Execute command
response = requests.post(
    f"{API_URL}/api/execute",
    headers=headers,
    json={
        "prompt": "Create a simple FastAPI hello world app",
        "working_directory": "/tmp/myapp",
        "timeout": 120
    }
)

result = response.json()
print(f"Success: {result['success']}")
print(f"Output:\n{result['output']}")
```

### Python Client (Streaming)

```python
import requests

API_URL = "http://localhost:8000"
API_KEY = "your-secret-api-key-here"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# Stream command output
response = requests.post(
    f"{API_URL}/api/execute/stream",
    headers=headers,
    json={
        "prompt": "Analyze all Python files and report code quality issues",
        "working_directory": "/home/user/project"
    },
    stream=True
)

for line in response.iter_lines():
    if line:
        print(line.decode('utf-8'))
```

### JavaScript/Node.js Client

```javascript
const fetch = require('node-fetch');

const API_URL = 'http://localhost:8000';
const API_KEY = 'your-secret-api-key-here';

async function executeClaude(prompt, workingDir) {
  const response = await fetch(`${API_URL}/api/execute`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: prompt,
      working_directory: workingDir,
      timeout: 180
    })
  });

  const result = await response.json();
  console.log('Success:', result.success);
  console.log('Output:', result.output);
  return result;
}

// Usage
executeClaude('List all files', '/tmp/project');
```

### cURL Examples

**Basic request:**
```bash
curl -X POST http://localhost:8000/api/execute \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Show git status"}'
```

**With custom working directory:**
```bash
curl -X POST http://localhost:8000/api/execute \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Find all TODO comments in Python files",
    "working_directory": "/home/user/myproject"
  }'
```

**Streaming response:**
```bash
curl -X POST http://localhost:8000/api/execute/stream \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Analyze the codebase structure"}' \
  --no-buffer
```

## Configuration Options

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ENABLE_AUTH` | Enable API key authentication | `true` | No |
| `CLAUDE_API_KEY` | API key for authentication | - | Yes (if auth enabled) |
| `HOST` | Server host address | `0.0.0.0` | No |
| `PORT` | Server port | `8000` | No |
| `CLAUDE_CODE_PATH` | Path to Claude Code CLI | `claude` | No |
| `DEFAULT_WORKING_DIR` | Default working directory | Current dir | No |

### Disabling Authentication

For local development or trusted environments, you can disable authentication:

```bash
export ENABLE_AUTH=false
python server.py
```

Then make requests without the `X-API-Key` header:

```bash
curl -X POST http://localhost:8000/api/execute \
  -H "Content-Type: application/json" \
  -d '{"prompt": "List files"}'
```

## Production Deployment

### Using systemd

Create `/etc/systemd/system/claude-api.service`:

```ini
[Unit]
Description=Claude Code API Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/claude-code/api-server
Environment="PATH=/path/to/venv/bin"
EnvironmentFile=/path/to/claude-code/api-server/.env
ExecStart=/path/to/venv/bin/python server.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable claude-api
sudo systemctl start claude-api
sudo systemctl status claude-api
```

### Using Docker

Create `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

EXPOSE 8000

CMD ["python", "server.py"]
```

Build and run:
```bash
docker build -t claude-api .
docker run -d \
  -p 8000:8000 \
  -e CLAUDE_API_KEY=your-key \
  -e ENABLE_AUTH=true \
  claude-api
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # For streaming
        proxy_buffering off;
        proxy_cache off;
    }
}
```

## Security Considerations

1. **API Keys**: Always use strong, random API keys in production
2. **HTTPS**: Use HTTPS in production (configure via reverse proxy)
3. **CORS**: Configure `allow_origins` in server.py for production
4. **Rate Limiting**: Consider adding rate limiting for production use
5. **Timeouts**: Set appropriate timeouts to prevent resource exhaustion
6. **Input Validation**: The server validates inputs, but be cautious with prompts
7. **Working Directory**: Restrict working directories to safe paths

## Troubleshooting

### Claude Code not found

Error: `claude_code_available: false`

Solution: Set correct path in `.env`:
```bash
CLAUDE_CODE_PATH=/usr/local/bin/claude
```

### Authentication errors

Error: `Invalid or missing API key`

Solution: Ensure you're sending the correct header:
```bash
-H "X-API-Key: your-actual-api-key"
```

### Timeout errors

Error: `Execution timed out after 300 seconds`

Solution: Increase timeout in request:
```json
{"prompt": "...", "timeout": 600}
```

### Permission errors

Error: `Permission denied`

Solution: Ensure the server has access to the working directory and Claude Code CLI.

## Development

### Running Tests

```bash
# Install dev dependencies
pip install pytest httpx

# Run tests
pytest test_server.py
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

See the main repository LICENSE.md file.

## Support

For issues and questions:
- Check the troubleshooting section above
- Review the API documentation at `/docs`
- Open an issue in the main repository
