# Claude Code - Enhanced with Puter Claude 4 Integration

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) [![npm]](https://www.npmjs.com/package/@anthropic-ai/claude-code) ![Puter Integration](https://img.shields.io/badge/Puter-Claude%204-purple?style=flat-square)

[npm]: https://img.shields.io/npm/v/@anthropic-ai/claude-code.svg?style=flat-square

**🚀 Now with Revolutionary Keyless Claude 4 Access via Puter Integration!**

Claude Code is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster by executing routine tasks, explaining complex code, and handling git workflows -- all through natural language commands. 

**NEW:** Enhanced with Puter's keyless authentication system providing direct access to Claude 4 models without API key management!

**Learn more in the [official documentation](https://docs.anthropic.com/en/docs/claude-code/overview)**.

<img src="./demo.gif" />

## 🎯 What's New: Puter Claude 4 Integration

### Revolutionary Features
- ✅ **No API Keys Required** - Eliminate API key management completely
- ✅ **Claude 4 Access** - Direct access to latest Claude Sonnet 4 and Claude Opus 4
- ✅ **User-Pays Model** - Free for developers, users pay for their own usage
- ✅ **Enhanced Security** - No API keys to expose or manage
- ✅ **Simplified Deployment** - Reduce backend complexity significantly
- ✅ **Web Interface** - Browser-based access included
- ✅ **Streaming Support** - Real-time responses
- ✅ **Model Comparison** - Compare responses across Claude 4 models

### Available Claude 4 Models
- **`claude-sonnet-4`** - Latest balanced model with enhanced reasoning
- **`claude-opus-4`** - Most powerful model for complex tasks
- **`claude-3-7-sonnet`** - Fast responses with good capabilities
- **`claude-3-7-opus`** - Advanced capabilities with good speed

## 🚀 Get Started

### Option 1: Traditional Claude Code
```sh
npm install -g @anthropic-ai/claude-code
```

### Option 2: Enhanced Puter Integration (Recommended)
```sh
# Clone the enhanced version
git clone -b puter-claude-4-integration https://github.com/anthropics/claude-code.git
cd claude-code/puter-integration
npm install

# Start using Claude 4 with keyless access
npm start
```

## 🔐 Puter Authentication Setup

### Quick Start with Puter
```sh
# Navigate to the Puter integration
cd puter-integration

# Sign in to Puter for Claude 4 access
node src/cli.js auth signin

# Check authentication status
node src/cli.js auth status

# Start chatting with Claude 4
node src/cli.js chat "Explain how React hooks work"
```

### Web Interface
```sh
# Start the web interface
node src/cli.js web --port 3000
```
Then open http://localhost:3000 in your browser for a full web-based Claude 4 experience!

## 🎨 Usage Examples

### CLI Commands
```sh
# Interactive chat with Claude 4
node src/cli.js chat

# Single message with specific model
node src/cli.js chat "Write a Python web scraper" --model claude-opus-4

# Streaming response
node src/cli.js chat "Generate a React component" --stream

# Code assistance
node src/cli.js code review src/app.js
node src/cli.js code explain components/Header.jsx
node src/cli.js code generate "REST API with Express" --language javascript

# Model management
node src/cli.js model list
node src/cli.js model set claude-sonnet-4
node src/cli.js model recommend coding --complexity complex

# Compare models
node src/cli.js compare "Explain machine learning" --models claude-sonnet-4,claude-opus-4
```

### Programmatic Usage
```javascript
const Claude4API = require('./puter-integration/src/claude4-api');

const claude4 = new Claude4API();

// Ensure authentication
await claude4.ensureAuthenticated();

// Chat with Claude 4
const response = await claude4.chat('Explain async/await in JavaScript', {
    model: 'claude-sonnet-4'
});

console.log(response.message.content[0].text);

// Streaming chat
await claude4.streamingChat('Write a Python function', (chunk) => {
    process.stdout.write(chunk);
}, { model: 'claude-opus-4' });
```

## 🔄 Migration from Traditional API

### Before (Traditional)
```javascript
// Required backend proxy and API key management
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY // Security risk
});

const response = await anthropic.messages.create({
    model: 'claude-3-sonnet-20240229',
    messages: [{ role: 'user', content: message }]
});
```

### After (Puter Integration)
```javascript
// Direct access, no API keys needed
const Claude4API = require('./puter-integration/src/claude4-api');
const claude4 = new Claude4API();

// User authenticates through Puter
await claude4.ensureAuthenticated();

// Direct Claude 4 access
const response = await claude4.chat(message, {
    model: 'claude-sonnet-4' // Latest Claude 4 model
});
```

## 🌐 Web Interface Features

The included web interface provides:

- **🔐 Puter Authentication** - Secure sign-in through Puter
- **💬 Real-time Chat** - Interactive conversation with Claude 4
- **🔄 Model Switching** - Easy selection between Claude 4 models
- **⚡ Streaming Responses** - Real-time text generation
- **🎨 Code Highlighting** - Syntax highlighting for code blocks
- **⚡ Quick Actions** - Pre-built prompts for common tasks
- **📱 Responsive Design** - Works on desktop and mobile

## 📊 Model Selection Guide

| Model | Best For | Speed | Reasoning | Use Case |
|-------|----------|-------|-----------|----------|
| `claude-sonnet-4` | Balanced performance | Fast | Excellent | General coding, analysis |
| `claude-opus-4` | Complex reasoning | Moderate | Superior | Research, complex projects |
| `claude-3-7-sonnet` | Quick responses | Very Fast | Good | Simple tasks, Q&A |
| `claude-3-7-opus` | Advanced tasks | Moderate | Very Good | Detailed analysis, advanced coding |

### Automatic Model Recommendation
```sh
# Get optimal model for task
node src/cli.js model recommend coding --complexity medium
# Output: Recommended model for coding (medium): Claude Sonnet 4

node src/cli.js model recommend research --complexity complex  
# Output: Recommended model for research (complex): Claude Opus 4
```

## 🛠️ Advanced Features

### Model Comparison
```sh
# Compare responses from multiple Claude 4 models
node src/cli.js compare "Explain quantum computing"

# Model Comparison Results:
# Claude Sonnet 4: 1,234ms - Quantum computing is a revolutionary...
# Claude Opus 4: 2,156ms - Quantum computing represents a paradigm...
```

### Code Assistance
```sh
# Comprehensive code review with Claude Opus 4
node src/cli.js code review src/complex-algorithm.js

# Quick code explanation with Claude Sonnet 4
node src/cli.js code explain utils/helpers.js

# Generate code with specific requirements
node src/cli.js code generate "GraphQL API with authentication" --language typescript
```

## 🔧 Configuration

### Environment Variables (Optional)
```bash
# Set default Claude 4 model
export CLAUDE4_DEFAULT_MODEL=claude-opus-4

# Set web interface port
export CLAUDE4_WEB_PORT=8080
```

### Custom Configuration
```javascript
const claude4 = new Claude4API({
    defaultModel: 'claude-opus-4',
    autoSelectModel: true // Automatically select optimal model
});
```

## 🚀 Deployment

### Docker Deployment
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY puter-integration/package*.json ./
RUN npm install

COPY puter-integration/ .

# No API keys needed with Puter integration!
EXPOSE 3000
CMD ["npm", "start"]
```

### Vercel/Netlify Deployment
```json
{
  "functions": {
    "api/**": {
      "runtime": "nodejs18.x"
    }
  },
  "env": {
    // No API keys required!
  }
}
```

## 📈 Benefits of Puter Integration

### For Developers
- ❌ **No API Key Management** - Eliminate security risks
- ❌ **No Backend Proxy** - Simplified architecture
- ❌ **No Billing Concerns** - Users pay for their own usage
- ✅ **Latest Models** - Access to Claude 4 immediately
- ✅ **Enhanced Security** - No credentials to expose
- ✅ **Easier Deployment** - Fewer configuration requirements

### For Users
- ✅ **Direct Control** - Manage your own usage and billing
- ✅ **Privacy** - Direct connection to Claude 4
- ✅ **Transparency** - See exactly what you're paying for
- ✅ **Latest Features** - Access to newest Claude 4 capabilities

## 🔍 Troubleshooting

### Authentication Issues
```sh
# Check authentication status
node src/cli.js auth status

# Re-authenticate if needed
node src/cli.js auth signout
node src/cli.js auth signin
```

### Model Issues
```sh
# List available models
node src/cli.js model list

# Reset to default model
node src/cli.js model set claude-sonnet-4
```

### Web Interface Issues
```sh
# Start with different port
node src/cli.js web --port 8080

# Check if port is available
lsof -i :3000
```

## 📚 Documentation

- **[Puter Integration Guide](puter-integration/PUTER_INTEGRATION_GUIDE.md)** - Complete implementation guide
- **[API Reference](puter-integration/README.md)** - Detailed API documentation
- **[Migration Guide](PUTER_INTEGRATION_GUIDE.md)** - Step-by-step migration instructions
- **[Web Interface Guide](puter-integration/docs/web-interface.md)** - Web interface documentation

## 🐛 Reporting Bugs

We welcome your feedback for both traditional Claude Code and the new Puter integration:

- **Traditional Issues**: Use the `/bug` command in Claude Code
- **Puter Integration Issues**: [GitHub Issues](https://github.com/anthropics/claude-code/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/anthropics/claude-code/discussions)

## 🤝 Connect on Discord

Join the [Claude Developers Discord](https://anthropic.com/discord) to:
- Get help with Puter integration
- Share feedback about Claude 4 models
- Connect with other developers
- Discuss your projects with the community

## 🔒 Data Collection, Usage, and Retention

### Traditional Claude Code
When you use traditional Claude Code, we collect feedback including usage data, conversation data, and user feedback submitted via the `/bug` command.

### Puter Integration
With Puter integration:
- **Authentication**: Handled by Puter's secure system
- **Usage Data**: Managed through your Puter account
- **Billing**: Direct user-pays model through Puter
- **Privacy**: Enhanced privacy with direct user control

### How We Use Your Data
We may use feedback to improve our products and services, but we will not train generative models using your feedback from Claude Code. Given their potentially sensitive nature, we store user feedback transcripts for only 30 days.

### Privacy Safeguards
We have implemented several safeguards including limited retention periods, restricted access to user session data, and clear policies against using feedback for model training.

For full details, please review our [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) and [Privacy Policy](https://www.anthropic.com/legal/privacy).

## 🎉 What's Next?

The Puter integration represents the future of AI tool development:

1. **Keyless Architecture** - No more API key management
2. **User-Centric Billing** - Users control their own costs
3. **Enhanced Security** - Eliminate credential exposure risks
4. **Simplified Development** - Focus on features, not infrastructure
5. **Latest AI Models** - Immediate access to Claude 4 capabilities

**Ready to experience the future of AI coding tools? Try the Puter integration today!**

---

**Made with ❤️ by the Anthropic team**  
**Enhanced with revolutionary Puter integration**