/**
 * Web Interface for Claude 4 Integration
 * Provides browser-based access to Puter Claude 4 features
 */

const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const WebSocket = require('ws');

class WebInterface {
    constructor(claude4API, port = 3000) {
        this.claude4 = claude4API;
        this.port = port;
        this.server = null;
        this.wss = null;
    }
    
    async start() {
        try {
            // Create HTTP server
            this.server = http.createServer(async (req, res) => {
                await this.handleRequest(req, res);
            });
            
            // Create WebSocket server
            this.wss = new WebSocket.Server({ server: this.server });
            this.setupWebSocketHandlers();
            
            // Start server
            this.server.listen(this.port, () => {
                console.log(chalk.green(`\n🌐 Claude 4 Web Interface started!`));
                console.log(chalk.blue(`   URL: http://localhost:${this.port}`));
                console.log(chalk.gray(`   WebSocket: ws://localhost:${this.port}`));
                console.log(chalk.yellow(`\n   Press Ctrl+C to stop the server\n`));
            });
            
            // Handle graceful shutdown
            process.on('SIGINT', () => {
                console.log(chalk.yellow('\nShutting down web interface...'));
                this.server.close(() => {
                    console.log(chalk.green('Web interface stopped.'));
                    process.exit(0);
                });
            });
            
        } catch (error) {
            console.error(chalk.red(`Failed to start web interface: ${error.message}`));
            process.exit(1);
        }
    }
    
    async handleRequest(req, res) {
        const url = req.url === '/' ? '/index.html' : req.url;
        
        try {
            if (url.startsWith('/api/')) {
                await this.handleAPIRequest(req, res);
            } else {
                await this.serveStaticFile(url, res);
            }
        } catch (error) {
            console.error(chalk.red(`Request error: ${error.message}`));
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    }
    
    async handleAPIRequest(req, res) {
        const url = new URL(req.url, `http://localhost:${this.port}`);
        const endpoint = url.pathname;
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        
        try {
            switch (endpoint) {
                case '/api/auth/status':
                    const authStatus = this.claude4.getAuthStatus();
                    res.writeHead(200);
                    res.end(JSON.stringify(authStatus));
                    break;
                    
                case '/api/models':
                    const models = this.claude4.availableModels.map(id => ({
                        id,
                        ...this.claude4.getModelInfo(id),
                        current: id === this.claude4.currentModel
                    }));
                    res.writeHead(200);
                    res.end(JSON.stringify(models));
                    break;
                    
                case '/api/chat':
                    if (req.method === 'POST') {
                        let body = '';
                        req.on('data', chunk => body += chunk);
                        req.on('end', async () => {
                            try {
                                const { message, model, stream } = JSON.parse(body);
                                
                                if (stream) {
                                    res.writeHead(400);
                                    res.end(JSON.stringify({ error: 'Use WebSocket for streaming' }));
                                    return;
                                }
                                
                                const response = await this.claude4.chat(message, { model });
                                res.writeHead(200);
                                res.end(JSON.stringify({
                                    response: response.message.content[0].text,
                                    model: model || this.claude4.currentModel
                                }));
                            } catch (error) {
                                res.writeHead(500);
                                res.end(JSON.stringify({ error: error.message }));
                            }
                        });
                    } else {
                        res.writeHead(405);
                        res.end(JSON.stringify({ error: 'Method not allowed' }));
                    }
                    break;
                    
                default:
                    res.writeHead(404);
                    res.end(JSON.stringify({ error: 'Endpoint not found' }));
            }
        } catch (error) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
        }
    }
    
    async serveStaticFile(url, res) {
        const filePath = path.join(__dirname, 'web', url);
        
        try {
            const content = await this.getWebContent(url);
            const contentType = this.getContentType(url);
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        } catch (error) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
        }
    }
    
    async getWebContent(url) {
        // Return embedded web content
        switch (url) {
            case '/index.html':
                return this.getIndexHTML();
            case '/style.css':
                return this.getStyleCSS();
            case '/script.js':
                return this.getScriptJS();
            default:
                throw new Error('File not found');
        }
    }
    
    getContentType(url) {
        const ext = path.extname(url).toLowerCase();
        const types = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json'
        };
        return types[ext] || 'text/plain';
    }
    
    setupWebSocketHandlers() {
        this.wss.on('connection', (ws) => {
            console.log(chalk.blue('New WebSocket connection'));
            
            ws.on('message', async (data) => {
                try {
                    const { type, payload } = JSON.parse(data);
                    
                    switch (type) {
                        case 'chat_stream':
                            const { message, model } = payload;
                            
                            ws.send(JSON.stringify({
                                type: 'stream_start',
                                model: model || this.claude4.currentModel
                            }));
                            
                            await this.claude4.streamingChat(message, (chunk) => {
                                ws.send(JSON.stringify({
                                    type: 'stream_chunk',
                                    chunk
                                }));
                            }, { model });
                            
                            ws.send(JSON.stringify({
                                type: 'stream_end'
                            }));
                            break;
                            
                        case 'auth_signin':
                            try {
                                await this.claude4.ensureAuthenticated();
                                ws.send(JSON.stringify({
                                    type: 'auth_success',
                                    status: this.claude4.getAuthStatus()
                                }));
                            } catch (error) {
                                ws.send(JSON.stringify({
                                    type: 'auth_error',
                                    error: error.message
                                }));
                            }
                            break;
                            
                        case 'set_model':
                            try {
                                this.claude4.setModel(payload.model);
                                ws.send(JSON.stringify({
                                    type: 'model_changed',
                                    model: payload.model
                                }));
                            } catch (error) {
                                ws.send(JSON.stringify({
                                    type: 'error',
                                    error: error.message
                                }));
                            }
                            break;
                    }
                } catch (error) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: error.message
                    }));
                }
            });
            
            ws.on('close', () => {
                console.log(chalk.gray('WebSocket connection closed'));
            });
        });
    }
    
    getIndexHTML() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude Code - Puter Claude 4 Integration</title>
    <link rel="stylesheet" href="/style.css">
    <script src="https://js.puter.com/v2/"></script>
</head>
<body>
    <div class="container">
        <header>
            <h1>🤖 Claude Code</h1>
            <p>Enhanced with Puter Claude 4 Integration</p>
        </header>
        
        <div id="auth-section">
            <div id="auth-status">Checking authentication...</div>
            <button id="signin-btn" style="display: none;">Sign In to Puter</button>
            <button id="signout-btn" style="display: none;">Sign Out</button>
        </div>
        
        <div id="main-interface" style="display: none;">
            <div class="model-section">
                <label for="model-select">Claude 4 Model:</label>
                <select id="model-select">
                    <option value="claude-sonnet-4">Claude Sonnet 4 (Balanced)</option>
                    <option value="claude-opus-4">Claude Opus 4 (Most Powerful)</option>
                    <option value="claude-3-7-sonnet">Claude 3.7 Sonnet (Fast)</option>
                    <option value="claude-3-7-opus">Claude 3.7 Opus (Advanced)</option>
                </select>
                <div id="model-info"></div>
            </div>
            
            <div class="chat-section">
                <div id="messages"></div>
                <div class="input-section">
                    <textarea id="message-input" placeholder="Ask Claude 4 about your code..."></textarea>
                    <div class="button-group">
                        <button id="send-btn">Send</button>
                        <button id="stream-btn">Stream</button>
                        <button id="clear-btn">Clear</button>
                    </div>
                </div>
            </div>
            
            <div class="features-section">
                <h3>Quick Actions</h3>
                <div class="feature-buttons">
                    <button class="feature-btn" data-action="code-review">Code Review</button>
                    <button class="feature-btn" data-action="explain-code">Explain Code</button>
                    <button class="feature-btn" data-action="generate-code">Generate Code</button>
                    <button class="feature-btn" data-action="fix-bugs">Fix Bugs</button>
                </div>
            </div>
        </div>
    </div>
    
    <script src="/script.js"></script>
</body>
</html>`;
    }
    
    getStyleCSS() {
        return `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: #333;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

header {
    text-align: center;
    margin-bottom: 30px;
    color: white;
}

header h1 {
    font-size: 3rem;
    margin-bottom: 10px;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

header p {
    font-size: 1.2rem;
    opacity: 0.9;
}

#auth-section {
    background: white;
    padding: 20px;
    border-radius: 10px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    text-align: center;
    margin-bottom: 20px;
}

#main-interface {
    background: white;
    border-radius: 10px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    overflow: hidden;
}

.model-section {
    padding: 20px;
    border-bottom: 1px solid #eee;
    background: #f8f9fa;
}

.model-section label {
    font-weight: 600;
    margin-right: 10px;
}

#model-select {
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 5px;
    font-size: 14px;
}

#model-info {
    margin-top: 10px;
    padding: 10px;
    background: #e3f2fd;
    border-radius: 5px;
    font-size: 14px;
    color: #1976d2;
}

.chat-section {
    height: 500px;
    display: flex;
    flex-direction: column;
}

#messages {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
    border-bottom: 1px solid #eee;
}

.message {
    margin-bottom: 15px;
    padding: 10px;
    border-radius: 8px;
}

.message.user {
    background: #e3f2fd;
    margin-left: 20%;
}

.message.assistant {
    background: #f3e5f5;
    margin-right: 20%;
}

.message.error {
    background: #ffebee;
    color: #c62828;
}

.message-header {
    font-weight: 600;
    margin-bottom: 5px;
    font-size: 14px;
}

.message-content {
    line-height: 1.5;
}

.message-content pre {
    background: #f5f5f5;
    padding: 10px;
    border-radius: 5px;
    overflow-x: auto;
    margin: 10px 0;
}

.message-content code {
    background: #f5f5f5;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'Monaco', 'Consolas', monospace;
}

.input-section {
    padding: 20px;
}

#message-input {
    width: 100%;
    height: 80px;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 5px;
    resize: vertical;
    font-family: inherit;
    font-size: 14px;
}

.button-group {
    margin-top: 10px;
    display: flex;
    gap: 10px;
}

button {
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s;
}

#send-btn {
    background: #4caf50;
    color: white;
}

#send-btn:hover {
    background: #45a049;
}

#stream-btn {
    background: #2196f3;
    color: white;
}

#stream-btn:hover {
    background: #1976d2;
}

#clear-btn {
    background: #ff9800;
    color: white;
}

#clear-btn:hover {
    background: #f57c00;
}

#signin-btn {
    background: #9c27b0;
    color: white;
    padding: 12px 24px;
    font-size: 16px;
}

#signin-btn:hover {
    background: #7b1fa2;
}

#signout-btn {
    background: #f44336;
    color: white;
}

#signout-btn:hover {
    background: #d32f2f;
}

.features-section {
    padding: 20px;
    border-top: 1px solid #eee;
    background: #f8f9fa;
}

.features-section h3 {
    margin-bottom: 15px;
    color: #333;
}

.feature-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
}

.feature-btn {
    background: #6c757d;
    color: white;
    padding: 12px;
    text-align: center;
}

.feature-btn:hover {
    background: #5a6268;
}

.loading {
    opacity: 0.6;
    pointer-events: none;
}

.typing-indicator {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
    .container {
        padding: 10px;
    }
    
    header h1 {
        font-size: 2rem;
    }
    
    .message.user {
        margin-left: 10%;
    }
    
    .message.assistant {
        margin-right: 10%;
    }
    
    .button-group {
        flex-direction: column;
    }
    
    .feature-buttons {
        grid-template-columns: 1fr;
    }
}`;
    }
    
    getScriptJS() {
        return `class Claude4WebInterface {
    constructor() {
        this.ws = null;
        this.currentModel = 'claude-sonnet-4';
        this.isAuthenticated = false;
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.connectWebSocket();
        await this.checkAuthStatus();
        await this.loadModels();
    }
    
    setupEventListeners() {
        document.getElementById('signin-btn').addEventListener('click', () => this.signIn());
        document.getElementById('signout-btn').addEventListener('click', () => this.signOut());
        document.getElementById('send-btn').addEventListener('click', () => this.sendMessage());
        document.getElementById('stream-btn').addEventListener('click', () => this.sendStreamingMessage());
        document.getElementById('clear-btn').addEventListener('click', () => this.clearMessages());
        
        document.getElementById('model-select').addEventListener('change', (e) => {
            this.setModel(e.target.value);
        });
        
        document.getElementById('message-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.sendMessage();
            }
        });
        
        document.querySelectorAll('.feature-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleFeatureAction(e.target.dataset.action);
            });
        });
    }
    
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(\`\${protocol}//\${window.location.host}\`);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            setTimeout(() => this.connectWebSocket(), 3000);
        };
    }
    
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'stream_start':
                this.addMessage('assistant', '', data.model, true);
                break;
                
            case 'stream_chunk':
                this.appendToLastMessage(data.chunk);
                break;
                
            case 'stream_end':
                this.finalizeLastMessage();
                break;
                
            case 'auth_success':
                this.isAuthenticated = true;
                this.updateAuthUI();
                break;
                
            case 'auth_error':
                alert(\`Authentication failed: \${data.error}\`);
                break;
                
            case 'model_changed':
                this.currentModel = data.model;
                this.updateModelInfo();
                break;
                
            case 'error':
                this.addMessage('error', data.error);
                break;
        }
    }
    
    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/status');
            const status = await response.json();
            this.isAuthenticated = status.authenticated;
            this.updateAuthUI();
        } catch (error) {
            console.error('Failed to check auth status:', error);
        }
    }
    
    async loadModels() {
        try {
            const response = await fetch('/api/models');
            const models = await response.json();
            
            const select = document.getElementById('model-select');
            select.innerHTML = '';
            
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = \`\${model.name} (\${model.speed})\`;
                if (model.current) {
                    option.selected = true;
                    this.currentModel = model.id;
                }
                select.appendChild(option);
            });
            
            this.updateModelInfo();
        } catch (error) {
            console.error('Failed to load models:', error);
        }
    }
    
    updateAuthUI() {
        const authStatus = document.getElementById('auth-status');
        const signinBtn = document.getElementById('signin-btn');
        const signoutBtn = document.getElementById('signout-btn');
        const mainInterface = document.getElementById('main-interface');
        
        if (this.isAuthenticated) {
            authStatus.textContent = '✓ Authenticated - Claude 4 Access Enabled';
            authStatus.style.color = '#4caf50';
            signinBtn.style.display = 'none';
            signoutBtn.style.display = 'inline-block';
            mainInterface.style.display = 'block';
        } else {
            authStatus.textContent = '⚠ Not authenticated - Sign in required for Claude 4 access';
            authStatus.style.color = '#ff9800';
            signinBtn.style.display = 'inline-block';
            signoutBtn.style.display = 'none';
            mainInterface.style.display = 'none';
        }
    }
    
    updateModelInfo() {
        // This would be populated with model info from the API
        const modelInfo = document.getElementById('model-info');
        modelInfo.textContent = \`Current model: \${this.currentModel}\`;
    }
    
    async signIn() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'auth_signin'
            }));
        } else {
            // Fallback to direct Puter auth
            try {
                await puter.auth.signIn();
                this.isAuthenticated = true;
                this.updateAuthUI();
            } catch (error) {
                alert(\`Sign in failed: \${error.message}\`);
            }
        }
    }
    
    async signOut() {
        try {
            await puter.auth.signOut();
            this.isAuthenticated = false;
            this.updateAuthUI();
        } catch (error) {
            console.error('Sign out failed:', error);
        }
    }
    
    setModel(modelId) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'set_model',
                payload: { model: modelId }
            }));
        }
    }
    
    async sendMessage() {
        const input = document.getElementById('message-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        this.addMessage('user', message);
        input.value = '';
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message,
                    model: this.currentModel
                })
            });
            
            const data = await response.json();
            
            if (data.error) {
                this.addMessage('error', data.error);
            } else {
                this.addMessage('assistant', data.response, data.model);
            }
        } catch (error) {
            this.addMessage('error', \`Request failed: \${error.message}\`);
        }
    }
    
    sendStreamingMessage() {
        const input = document.getElementById('message-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        this.addMessage('user', message);
        input.value = '';
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'chat_stream',
                payload: {
                    message,
                    model: this.currentModel
                }
            }));
        } else {
            this.addMessage('error', 'WebSocket not connected');
        }
    }
    
    addMessage(role, content, model = null, isStreaming = false) {
        const messagesContainer = document.getElementById('messages');
        const messageId = \`msg-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
        
        const messageDiv = document.createElement('div');
        messageDiv.id = messageId;
        messageDiv.className = \`message \${role}\`;
        
        const modelInfo = model ? \` (\${model})\` : '';
        const streamingIndicator = isStreaming ? '<span class="typing-indicator"></span>' : '';
        
        messageDiv.innerHTML = \`
            <div class="message-header">
                <strong>\${role}\${modelInfo}</strong>
                <span class="timestamp">\${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="message-content">\${this.formatContent(content)}\${streamingIndicator}</div>
        \`;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        return messageId;
    }
    
    appendToLastMessage(chunk) {
        const messages = document.querySelectorAll('.message.assistant');
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const contentElement = lastMessage.querySelector('.message-content');
            const currentContent = contentElement.textContent.replace('⚪', ''); // Remove typing indicator
            contentElement.innerHTML = this.formatContent(currentContent + chunk) + '<span class="typing-indicator"></span>';
            
            const messagesContainer = document.getElementById('messages');
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
    
    finalizeLastMessage() {
        const messages = document.querySelectorAll('.message.assistant');
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const contentElement = lastMessage.querySelector('.message-content');
            const content = contentElement.textContent.replace('⚪', '');
            contentElement.innerHTML = this.formatContent(content);
        }
    }
    
    formatContent(content) {
        return content
            .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
            .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }
    
    clearMessages() {
        document.getElementById('messages').innerHTML = '';
    }
    
    handleFeatureAction(action) {
        const prompts = {
            'code-review': 'Please review this code for quality, bugs, and improvements:\n\n```\n// Paste your code here\n```',
            'explain-code': 'Please explain how this code works:\n\n```\n// Paste your code here\n```',
            'generate-code': 'Please generate code for: ',
            'fix-bugs': 'Please identify and fix bugs in this code:\n\n```\n// Paste your code here\n```'
        };
        
        const input = document.getElementById('message-input');
        input.value = prompts[action] || '';
        input.focus();
    }
}

// Initialize the interface when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new Claude4WebInterface();
});`;
    }
}

module.exports = WebInterface;