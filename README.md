# Claude Code Extended

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) ![](https://img.shields.io/badge/TypeScript-5.2%2B-blue?style=flat-square) ![](https://img.shields.io/badge/License-Apache%202.0-yellow?style=flat-square)

Claude Code Extended is an enhanced version of Anthropic's Claude Code that adds mobile remote access capabilities. It includes a backend server that enables secure remote access to Claude Code functionality through mobile applications, along with the original terminal-based agentic coding tool.

**Features:**
- Original Claude Code terminal functionality
- Remote access server for mobile applications
- WebSocket-based real-time communication
- Secure authentication with JWT tokens
- File system watching and synchronization
- Session management across devices
- Optional Tailscale integration for secure networking
- Cross-platform support (macOS, Linux, Windows)

<img src="./demo.gif" />

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Mobile Apps](#mobile-apps)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## 🚀 Quick Start

### For Terminal Usage (Original Claude Code)

1. Install dependencies:
```bash
npm install -g @anthropic-ai/claude-code-extended
```

2. Navigate to your project directory and run:
```bash
claude
```

### For Remote/Mobile Access

1. Clone and setup the server:
```bash
git clone https://github.com/jfuginay/claude-code.git
cd claude-code
npm install
```

2. Start the development server:
```bash
./start-dev.sh
```

3. Connect from mobile apps using the provided URLs.

## 📦 Installation

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager
- Git (for cloning the repository)

### Option 1: NPM Installation (Terminal Only)

```bash
npm install -g @anthropic-ai/claude-code-extended
```

### Option 2: Source Installation (Full Features)

```bash
# Clone the repository
git clone https://github.com/jfuginay/claude-code.git
cd claude-code

# Install dependencies
npm install

# Build the project
npm run build

# Optional: Link for global access
npm link
```

### Option 3: Development Installation

```bash
# Clone with development dependencies
git clone https://github.com/jfuginay/claude-code.git
cd claude-code
npm install

# Start in development mode
npm run dev
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root (or use `.env.example` as a template):

```bash
# Server Configuration
CLAUDE_PORT=3000
CLAUDE_HOST=0.0.0.0

# SSL Configuration (Production)
CLAUDE_SSL_ENABLED=false
CLAUDE_SSL_CERT=/path/to/cert.pem
CLAUDE_SSL_KEY=/path/to/key.pem

# Authentication
CLAUDE_JWT_SECRET=your-secret-key-here-at-least-64-characters-long-for-security
CLAUDE_SESSION_TIMEOUT=86400000
CLAUDE_MAX_DEVICES=10

# Database
CLAUDE_DB_PATH=./data/claude-code.db

# Logging
CLAUDE_LOG_LEVEL=info
CLAUDE_LOG_FILE=./data/logs/claude-code.log

# Tailscale Integration (Optional)
TAILSCALE_ENABLED=false
TAILSCALE_AUTH_KEY=your-tailscale-auth-key
TAILSCALE_HOSTNAME=claude-code-server

# Environment
NODE_ENV=production
```

### Setup Wizard

Run the interactive setup wizard to configure the server:

```bash
npm run setup
# or
claude-setup
```

## 🎯 Usage

### Terminal Mode

Navigate to your project directory and run Claude Code:

```bash
claude
```

Use natural language commands to:
- Execute routine coding tasks
- Explain complex code
- Handle git workflows
- Search and analyze your codebase
- Generate documentation

### Server Mode

#### Starting the Server

**Development:**
```bash
npm run dev
# or use the convenience script
./start-dev.sh
```

**Production:**
```bash
npm run build
npm start
# or
claude-server
```

**As a Daemon:**
```bash
claude-daemon start
```

#### Server Commands

```bash
# Build the project
npm run build

# Start production server
npm run start

# Start development server with hot reload
npm run dev

# Run setup wizard
npm run setup

# Start as daemon
npm run daemon

# Run tests
npm run test

# Lint code
npm run lint
npm run lint:fix

# Format code
npm run format
```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Start development server with hot reload
- `npm run start` - Start production server
- `npm run setup` - Run interactive setup wizard
- `npm run daemon` - Start server as background daemon
- `npm run test` - Run test suite
- `npm run lint` - Check code style
- `npm run format` - Format code with Prettier

## 📱 Mobile Apps

This project includes mobile applications for remote access:

### Android App
Located in `claude-code-android/` directory. See [Android Setup Guide](./claude-code-android/README.md) for installation instructions.

### iOS App
Located in `claude-code-ios/` directory. See [iOS Setup Guide](./claude-code-ios/README.md) for installation instructions.

### Connection Setup

1. Start the server using `./start-dev.sh`
2. Note the server URL and WebSocket URL displayed
3. Enter these URLs in your mobile app settings
4. Use default credentials (development):
   - Username: `admin`
   - Password: `admin123`

For detailed mobile setup instructions, see [MOBILE-SETUP.md](./MOBILE-SETUP.md).

## 📚 API Documentation

### Authentication Endpoints

- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - End user session
- `GET /api/auth/verify` - Verify JWT token

### Session Management

- `GET /api/sessions` - List active sessions
- `POST /api/sessions` - Create new session
- `DELETE /api/sessions/:id` - End session

### File Operations

- `GET /api/files` - List files in directory
- `GET /api/files/content` - Get file content
- `POST /api/files` - Create/update file
- `DELETE /api/files` - Delete file

### System Information

- `GET /api/system/info` - Get system information
- `GET /api/system/status` - Get server status

### WebSocket Events

- `terminal:input` - Send command to terminal
- `terminal:output` - Receive terminal output
- `file:changed` - File system change notification
- `session:created` - New session notification

For detailed API documentation, see [API.md](./docs/API.md).

## 🛠️ Development

### Project Structure

```
claude-code/
├── src/                    # TypeScript source code
│   ├── server.ts          # Main server entry point
│   ├── daemon.ts          # Daemon process management
│   ├── setup-wizard.ts    # Interactive setup
│   ├── routes/            # Express route handlers
│   ├── services/          # Business logic services
│   ├── middleware/        # Express middleware
│   ├── websocket/         # WebSocket handlers
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── dist/                   # Compiled JavaScript
├── data/                   # Database and logs
├── claude-code-android/    # Android mobile app
├── claude-code-ios/        # iOS mobile app
├── docs/                   # Documentation
└── examples/               # Usage examples
```

### Development Workflow

1. **Setup development environment:**
   ```bash
   npm install
   npm run build
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Make changes and test:**
   ```bash
   npm run lint
   npm run test
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

### Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Code Style

The project uses ESLint and Prettier for code formatting:

```bash
# Check code style
npm run lint

# Fix code style issues
npm run lint:fix

# Format code
npm run format
```

## 🔒 Security

### Authentication

- JWT-based authentication with configurable expiration
- Secure password hashing with bcrypt
- Session management with automatic cleanup
- Rate limiting to prevent brute force attacks

### Network Security

- HTTPS support with SSL/TLS certificates
- CORS protection with configurable origins
- Helmet.js for security headers
- Optional Tailscale integration for zero-trust networking

### Data Protection

- SQLite database with encrypted storage
- Configurable session timeouts
- Limited device registration per user
- Secure file access controls

### Production Recommendations

1. **Use strong JWT secrets** (minimum 64 characters)
2. **Enable HTTPS** with valid SSL certificates
3. **Configure firewall rules** to restrict access
4. **Regular security updates** and dependency scanning
5. **Monitor logs** for suspicious activity

## 🐛 Reporting Bugs

We welcome your feedback! You can:

1. Use the `/bug` command within Claude Code
2. File a [GitHub issue](https://github.com/jfuginay/claude-code/issues)
3. Contact us through the mobile app feedback feature

When reporting bugs, please include:
- Operating system and version
- Node.js version
- Steps to reproduce the issue
- Error messages or logs
- Expected vs actual behavior

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run tests: `npm run test`
5. Commit your changes: `git commit -m "Add feature"`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE.md](LICENSE.md) file for details.

## 📞 Support

- **Documentation:** [Official Docs](https://docs.anthropic.com/en/docs/claude-code/overview)
- **Issues:** [GitHub Issues](https://github.com/jfuginay/claude-code/issues)
- **Discussions:** [GitHub Discussions](https://github.com/jfuginay/claude-code/discussions)

## 🙏 Acknowledgments

- Original Claude Code by [Anthropic](https://github.com/anthropics/claude-code)
- Mobile app development frameworks
- Open source community contributors

---

## Data Collection, Usage, and Retention

When you use Claude Code Extended, data collection follows the same policies as the original Claude Code:

### How we use your data

We may use feedback to improve our products and services, but we will not train generative models using your feedback from Claude Code. Given their potentially sensitive nature, we store user feedback transcripts for only 30 days.

If you choose to send us feedback about Claude Code, such as transcripts of your usage, Anthropic may use that feedback to debug related issues and improve Claude Code's functionality (e.g., to reduce the risk of similar bugs occurring in the future).

### Privacy safeguards

We have implemented several safeguards to protect your data, including limited retention periods for sensitive information, restricted access to user session data, and clear policies against using feedback for model training.

For full details, please review our [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) and [Privacy Policy](https://www.anthropic.com/legal/privacy).