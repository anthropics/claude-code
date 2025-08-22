# Claude Code - Puter Claude 4 Integration

**Revolutionary keyless access to Claude 4 models through Puter.js**

This enhanced version of Claude Code eliminates the need for traditional API keys by leveraging Puter's innovative "User Pays" model. Users authenticate through their Puter accounts and pay for their own usage, making it free for developers to deploy and distribute.

## 🚀 Key Features

### Claude 4 Models Available
- **Claude Sonnet 4** - Latest balanced model with enhanced reasoning
- **Claude Opus 4** - Most powerful model for complex tasks
- **Claude 3.7 Sonnet** - Fast responses with good capabilities
- **Claude 3.7 Opus** - Advanced capabilities with good speed

### Integration Benefits
- ✅ **No API Keys Required** - Eliminate API key management
- ✅ **Free for Developers** - Users pay for their own usage
- ✅ **CORS-Free** - Built-in networking layer
- ✅ **Simplified Architecture** - Reduce backend complexity
- ✅ **Latest Models** - Direct access to Claude 4
- ✅ **Web Interface** - Browser-based access included
- ✅ **Streaming Support** - Real-time responses
- ✅ **Model Comparison** - Compare responses across models

## 📦 Installation

### Global Installation
```bash
npm install -g @anthropic-ai/claude-code-puter
```

### Local Development
```bash
git clone https://github.com/anthropics/claude-code.git
cd claude-code/puter-integration
npm install
npm start
```

## 🔧 Quick Start

### 1. Authentication
First, sign in to Puter for Claude 4 access:
```bash
claude-puter auth signin
```

### 2. Check Available Models
```bash
claude-puter model list
```

### 3. Start Chatting
```bash
# Interactive chat
claude-puter chat

# Single message
claude-puter chat "Explain how async/await works in JavaScript"

# Use specific model
claude-puter chat "Write a Python web scraper" --model claude-opus-4

# Streaming response
claude-puter chat "Generate a React component" --stream
```

### 4. Code Assistance
```bash
# Review code
claude-puter code review src/app.js

# Explain code
claude-puter code explain components/Header.jsx

# Generate code
claude-puter code generate "REST API with Express and MongoDB" --language javascript

# Fix code issues
claude-puter code fix buggy-script.py
```

### 5. Web Interface
```bash
# Start web interface
claude-puter web --port 3000
```
Then open http://localhost:3000 in your browser.

## 🎯 Model Selection Guide

### Automatic Model Recommendation
```bash
# Get recommendation for task type
claude-puter model recommend coding --complexity medium
claude-puter model recommend research --complexity complex
claude-puter model recommend creative --complexity simple
```

### Manual Model Selection
```bash
# Set current model
claude-puter model set claude-opus-4

# Check current model
claude-puter auth status
```

### Model Comparison
```bash
# Compare responses from multiple models
claude-puter compare "Explain quantum computing" --models claude-sonnet-4,claude-opus-4
```

## 🌐 Web Interface Features

The included web interface provides:

- **Real-time Chat** - Interactive conversation with Claude 4
- **Model Switching** - Easy model selection
- **Streaming Responses** - Real-time text generation
- **Code Highlighting** - Syntax highlighting for code blocks
- **Quick Actions** - Pre-built prompts for common tasks
- **Authentication Management** - Sign in/out functionality
- **Responsive Design** - Works on desktop and mobile

## 🔌 API Integration

### Basic Usage
```javascript
const Claude4API = require('@anthropic-ai/claude-code-puter');

const claude4 = new Claude4API();

// Ensure user is authenticated
await claude4.ensureAuthenticated();

// Chat with Claude 4
const response = await claude4.chat('Explain React hooks', {
    model: 'claude-sonnet-4'
});

console.log(response.message.content[0].text);
```

### Streaming Responses
```javascript
await claude4.streamingChat('Write a Python function', (chunk) => {
    process.stdout.write(chunk);
}, { model: 'claude-sonnet-4' });
```

### Model Management
```javascript
// Set model
claude4.setModel('claude-opus-4');

// Get model info
const info = claude4.getModelInfo('claude-sonnet-4');
console.log(info.description);

// Select optimal model
const optimal = claude4.selectOptimalModel('coding', 'complex');
console.log(`Recommended: ${optimal}`);
```

### Authentication Status
```javascript
const status = claude4.getAuthStatus();
if (status.authenticated) {
    console.log(`Signed in as: ${status.username}`);
    console.log(`Current model: ${status.currentModel}`);
} else {
    console.log('Authentication required');
}
```

## 🔄 Migration from Traditional Claude API

### Before (Traditional API)
```javascript
// Required backend proxy and API key management
const response = await fetch('/api/claude', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${API_KEY}` // Security risk
    },
    body: JSON.stringify({ message })
});
```

### After (Puter Integration)
```javascript
// Direct frontend access, no API keys needed
const claude4 = new Claude4API();
const response = await claude4.chat(message, {
    model: 'claude-sonnet-4'
});
```

## 🛠️ Advanced Configuration

### Environment Variables
```bash
# Optional: Set default model
export CLAUDE4_DEFAULT_MODEL=claude-opus-4

# Optional: Set web interface port
export CLAUDE4_WEB_PORT=8080
```

### Custom Model Selection
```javascript
const claude4 = new Claude4API({
    defaultModel: 'claude-opus-4',
    autoSelectModel: true // Automatically select optimal model
});
```

## 📊 Model Comparison Results

When using the compare feature, you'll get detailed results:

```bash
$ claude-puter compare "Explain machine learning"

Model Comparison Results:

Claude Sonnet 4 (claude-sonnet-4):
Response Time: 1,234ms
Response: Machine learning is a subset of artificial intelligence...

Claude Opus 4 (claude-opus-4):
Response Time: 2,156ms
Response: Machine learning represents a paradigm shift in computing...
```

## 🔍 Troubleshooting

### Authentication Issues
```bash
# Check authentication status
claude-puter auth status

# Re-authenticate
claude-puter auth signout
claude-puter auth signin
```

### Model Access Issues
```bash
# List available models
claude-puter model list

# Check if model is supported
claude-puter model set claude-sonnet-4
```

### Web Interface Issues
```bash
# Start with different port
claude-puter web --port 8080

# Check if port is available
lsof -i :3000
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
git clone https://github.com/anthropics/claude-code.git
cd claude-code/puter-integration
npm install
npm run dev
```

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

## 📄 License

MIT License - see [LICENSE.md](../LICENSE.md) for details.

## 🔗 Links

- [Puter.com](https://puter.com) - The platform powering keyless access
- [Claude API Documentation](https://docs.anthropic.com/claude/reference)
- [Original Claude Code](https://github.com/anthropics/claude-code)
- [Discord Community](https://anthropic.com/discord)

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/anthropics/claude-code/issues)
- **Discord**: [Claude Developers Discord](https://anthropic.com/discord)
- **Email**: support@anthropic.com

---

**Made with ❤️ by the Anthropic team, enhanced with Puter integration**