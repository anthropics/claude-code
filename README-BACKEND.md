# Claude Code Extended - Backend Server

A powerful backend server that extends Claude Code with mobile remote access capabilities, providing WebSocket-based terminal streaming, REST APIs for file operations, and comprehensive session management.

## Features

- **Real-time Terminal Streaming**: WebSocket-based terminal sessions with full PTY support
- **REST API**: Comprehensive APIs for authentication, session management, and file operations
- **Device Pairing**: Secure device pairing with QR codes and JWT authentication
- **Session Persistence**: Sessions survive disconnections and can be resumed across devices
- **File System Operations**: Read, write, watch files with git integration
- **Tailscale Integration**: Secure remote access through Tailscale mesh networks
- **Background Daemon**: Run as a system service with process management
- **Health Monitoring**: Built-in health checks, metrics, and logging

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Setup Wizard

```bash
npm run setup
# or after building:
claude-setup
```

The setup wizard will guide you through:
- Server configuration (port, SSL, etc.)
- Admin user creation
- Device registration
- Advanced settings (JWT, Tailscale, etc.)

### 3. Start the Server

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run build
npm start

# Or using the CLI
claude-server

# Background daemon mode
claude-daemon start
```

## Configuration

Configuration is stored in `~/.claude-code-extended/config.json` by default. You can override the location with the `CLAUDE_CONFIG_DIR` environment variable.

### Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
# Server settings
CLAUDE_PORT=3000
CLAUDE_HOST=0.0.0.0

# Authentication
CLAUDE_JWT_SECRET=your-secret-key-here
CLAUDE_SESSION_TIMEOUT=86400000  # 24 hours

# Database
CLAUDE_DB_PATH=./data/claude-code.db

# Tailscale (optional)
TAILSCALE_ENABLED=true
TAILSCALE_AUTH_KEY=your-auth-key
```

## API Documentation

### Authentication

All API endpoints (except health checks) require authentication via JWT tokens.

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "admin",
  "password": "password123",
  "email": "admin@example.com"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}
```

#### Device Pairing
```http
POST /api/auth/pair/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "deviceName": "iPhone 15",
  "deviceType": "mobile",
  "platform": "iOS 17.0",
  "userAgent": "Claude Code Mobile/1.0"
}
```

### Sessions

#### Create Session
```http
POST /api/sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "workingDirectory": "/home/user/project",
  "settings": {
    "shell": "/bin/bash",
    "theme": "dark"
  }
}
```

#### List Sessions
```http
GET /api/sessions
Authorization: Bearer <token>
```

#### Send Terminal Input
```http
POST /api/sessions/{sessionId}/input
Authorization: Bearer <token>
Content-Type: application/json

{
  "data": "ls -la\n"
}
```

### Files

#### Read File
```http
POST /api/files/read
Authorization: Bearer <token>
Content-Type: application/json

{
  "path": "src/main.js",
  "encoding": "utf8"
}
```

#### Write File
```http
POST /api/files/write
Authorization: Bearer <token>
Content-Type: application/json

{
  "path": "src/main.js",
  "content": "console.log('Hello World');",
  "encoding": "utf8"
}
```

#### Git Operations
```http
POST /api/files/git
Authorization: Bearer <token>
Content-Type: application/json

{
  "command": "status",
  "workingDirectory": "/home/user/project"
}
```

### System

#### Health Check
```http
GET /api/system/health
```

#### Server Status
```http
GET /api/system/status
Authorization: Bearer <token>
```

## WebSocket API

Connect to `/ws` with a JWT token as query parameter:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws?token=your-jwt-token');

// Create session
ws.send(JSON.stringify({
  type: 'session:create',
  data: {
    workingDirectory: '/home/user',
    settings: { shell: '/bin/bash' }
  }
}));

// Send terminal input
ws.send(JSON.stringify({
  type: 'terminal:input',
  sessionId: 'session-id',
  data: { data: 'ls -la\n' }
}));

// Receive terminal output
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'terminal:output') {
    console.log(message.data.data);
  }
};
```

## Daemon Management

### Start as Daemon
```bash
claude-daemon start
```

### Check Status
```bash
claude-daemon status
```

### View Logs
```bash
claude-daemon logs
claude-daemon logs 100  # Last 100 lines
```

### Stop Daemon
```bash
claude-daemon stop
```

### Restart Daemon
```bash
claude-daemon restart
```

## Tailscale Integration

Enable secure remote access through Tailscale:

1. Install Tailscale on your server
2. Get an auth key from https://tailscale.com/
3. Configure during setup or set environment variables:
   ```bash
   TAILSCALE_ENABLED=true
   TAILSCALE_AUTH_KEY=your-auth-key
   TAILSCALE_HOSTNAME=claude-code-server
   ```

The server will automatically connect to your Tailscale network and be accessible via Magic DNS.

## Security

- All API endpoints use JWT authentication
- Device pairing uses secure QR codes with time-limited codes
- File operations are sandboxed to prevent path traversal
- Rate limiting prevents abuse
- Optional SSL/TLS encryption
- Tailscale provides zero-trust networking

## Development

### Project Structure

```
src/
├── types/           # TypeScript type definitions
├── services/        # Core business logic services
├── middleware/      # Express middleware
├── routes/          # API route handlers
├── websocket/       # WebSocket server implementation
├── utils/           # Utility functions
├── server.ts        # Main server application
├── setup-wizard.ts  # Interactive setup wizard
└── daemon.ts        # Daemon process manager
```

### Building

```bash
npm run build    # Build TypeScript to JavaScript
npm run dev      # Development with hot reload
npm run lint     # Run ESLint
npm run format   # Format code with Prettier
```

### Testing

```bash
npm test         # Run tests
npm run test:watch  # Watch mode for tests
```

## Deployment

### Systemd Service (Linux)

Create `/etc/systemd/system/claude-code.service`:

```ini
[Unit]
Description=Claude Code Extended Server
After=network.target

[Service]
Type=simple
User=claude
WorkingDirectory=/opt/claude-code-extended
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable claude-code
sudo systemctl start claude-code
```

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY data/ ./data/

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  claude-code:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ~/.claude-code-extended:/root/.claude-code-extended
    environment:
      - NODE_ENV=production
      - CLAUDE_JWT_SECRET=your-secret-key
```

## Monitoring

The server provides comprehensive monitoring through:

- Health check endpoint (`/api/system/health`)
- Metrics endpoint (`/api/system/metrics`)
- Structured logging with Winston
- Process monitoring through daemon manager

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Change port in config or environment
   export CLAUDE_PORT=3001
   ```

2. **Database connection issues**
   ```bash
   # Check database path permissions
   ls -la ~/.claude-code-extended/claude-code.db
   ```

3. **Tailscale connection failed**
   ```bash
   # Check Tailscale status
   tailscale status
   ```

4. **WebSocket connection refused**
   - Verify server is running
   - Check firewall settings
   - Ensure JWT token is valid

### Logs

Logs are stored in:
- Development: Console output
- Production: `~/.claude-code-extended/logs/claude-code.log`
- Daemon mode: `~/.claude-code-extended/logs/daemon.log`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

Apache 2.0 - See LICENSE file for details.

## Support

For issues and questions:
- Check the troubleshooting section
- Review logs for error details
- Open an issue on GitHub
- Contact support team

## Changelog

### v1.0.0
- Initial release
- WebSocket terminal streaming
- REST API for file operations
- Device pairing with QR codes
- Session management
- Tailscale integration
- Daemon mode
- Comprehensive logging and monitoring