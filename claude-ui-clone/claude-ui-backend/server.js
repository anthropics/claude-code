const express = require('express');
const cors = require('cors');
const { query } = require('@anthropic-ai/claude-agent-sdk');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// User database (simple file-based for now)
const USERS_FILE = path.join(__dirname, 'users.json');
const PERMISSIONS_FILE = path.join(__dirname, 'permissions.json');
const CONVERSATIONS_DIR = path.join(__dirname, 'conversations');
const CLAUDE_SESSIONS_DIR = path.join(__dirname, 'users');
const USER_CONFIGS_DIR = path.join(__dirname, 'user-configs');

// Ensure directories exist
if (!fs.existsSync(CONVERSATIONS_DIR)) {
  fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true });
}
if (!fs.existsSync(CLAUDE_SESSIONS_DIR)) {
  fs.mkdirSync(CLAUDE_SESSIONS_DIR, { recursive: true });
}

// Initialize users file if it doesn't exist
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({}));
}

// Initialize permissions file if it doesn't exist
if (!fs.existsSync(PERMISSIONS_FILE)) {
  fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify({}));
}

app.use(cors());
app.use(express.json());

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  const user = users[username];

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username });
});

// Register endpoint (for initial setup)
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));

  if (users[username]) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  users[username] = { passwordHash, createdAt: new Date().toISOString() };

  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username });
});

// Get conversations for user
app.get('/api/conversations', authenticateToken, (req, res) => {
  const userConvFile = path.join(CONVERSATIONS_DIR, `${req.user.username}.json`);

  if (!fs.existsSync(userConvFile)) {
    return res.json([]);
  }

  const conversations = JSON.parse(fs.readFileSync(userConvFile, 'utf8'));
  res.json(conversations);
});

// Save conversations for user
app.post('/api/conversations', authenticateToken, (req, res) => {
  const userConvFile = path.join(CONVERSATIONS_DIR, `${req.user.username}.json`);
  fs.writeFileSync(userConvFile, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// Chat endpoint
app.post('/api/chat', authenticateToken, async (req, res) => {
  const { message, sessionId } = req.body;
  const username = req.user.username;

  console.log(`[CHAT] User: ${username}, Message: ${message.substring(0, 50)}..., SessionId: ${sessionId || 'new'}`);

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid message' });
  }

  // Load user permissions
  const permissions = JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf8'));
  const userPermissions = permissions[username] || {
    allowedTools: [],
    deniedTools: [],
    allowedDirectories: [],
    permissionMode: 'default'
  };

  // Create user's directory
  const userDir = path.join(CLAUDE_SESSIONS_DIR, username);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Build options based on user permissions
    const queryOptions = {
      cwd: userDir,
      includePartialMessages: true,  // Enable real-time streaming
      settingSources: ['project'],  // Enable skills discovery from .claude/skills/
    };

    // If sessionId is provided, resume from that session
    if (sessionId) {
      queryOptions.resume = sessionId;
    }

    // Handle permission mode
    if (userPermissions.permissionMode === 'bypassPermissions') {
      // Use permissionMode directly like Python SDK
      queryOptions.permissionMode = 'bypassPermissions';
    } else {
      // Use the standard permission mode
      queryOptions.permissionMode = userPermissions.permissionMode;

      // Add allowed/denied tools if specified
      if (userPermissions.allowedTools && userPermissions.allowedTools.length > 0) {
        queryOptions.allowedTools = userPermissions.allowedTools;
      }
      if (userPermissions.deniedTools && userPermissions.deniedTools.length > 0) {
        queryOptions.deniedTools = userPermissions.deniedTools;
      }
      if (userPermissions.allowedDirectories && userPermissions.allowedDirectories.length > 0) {
        queryOptions.additionalDirectories = userPermissions.allowedDirectories;
      }
    }

    console.log('[CHAT] Query options:', JSON.stringify(queryOptions, null, 2));

    const queryInstance = query({
      prompt: message,
      options: queryOptions
    });

    let fullResponse = '';
    let currentSessionId = null;
    let currentTextBlock = '';
    let textBlockIndex = 0;

    console.log('[CHAT] Starting to process SDK messages...');

    // Process streaming response
    for await (const sdkMsg of queryInstance) {
      console.log('[CHAT] SDK Message type:', sdkMsg.type);
      // Capture the Claude session_id from the first message
      if (sdkMsg.session_id && !currentSessionId) {
        currentSessionId = sdkMsg.session_id;

        // Send session_id to frontend so it can track it
        res.write(`data: ${JSON.stringify({
          type: 'session_id',
          sessionId: currentSessionId,
          done: false
        })}\n\n`);
      }

      // Handle stream events for real-time streaming (when using includePartialMessages)
      if (sdkMsg.type === 'stream_event') {
        const event = sdkMsg.event;

        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'text') {
            // Starting a new text block, flush previous if any
            if (currentTextBlock) {
              res.write(`data: ${JSON.stringify({
                type: 'text_block_end',
                blockIndex: textBlockIndex,
                done: false
              })}\n\n`);
              currentTextBlock = '';
            }
            textBlockIndex = event.index;
            res.write(`data: ${JSON.stringify({
              type: 'text_block_start',
              blockIndex: textBlockIndex,
              done: false
            })}\n\n`);
          } else if (event.content_block.type === 'tool_use') {
            // Flush any current text block before tool use
            if (currentTextBlock) {
              res.write(`data: ${JSON.stringify({
                type: 'text_block_end',
                blockIndex: textBlockIndex,
                done: false
              })}\n\n`);
              currentTextBlock = '';
            }
            console.log('[CHAT] Sending tool_use event:', event.content_block.name, 'at index', event.index);
            res.write(`data: ${JSON.stringify({
              type: 'tool_use',
              tool: event.content_block.name,
              toolUseId: event.content_block.id,
              blockIndex: event.index,
              done: false
            })}\n\n`);
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            currentTextBlock += event.delta.text;
            fullResponse += event.delta.text;
            res.write(`data: ${JSON.stringify({
              type: 'text',
              content: event.delta.text,
              blockIndex: event.index,
              done: false
            })}\n\n`);
          }
        } else if (event.type === 'content_block_stop') {
          // Block finished
          if (currentTextBlock) {
            res.write(`data: ${JSON.stringify({
              type: 'text_block_end',
              blockIndex: event.index,
              done: false
            })}\n\n`);
            currentTextBlock = '';
          }
        }
      }

      // Handle result message
      else if (sdkMsg.type === 'result') {
        const resultInfo = {
          type: 'result',
          done: true,
          isError: sdkMsg.is_error,
          numTurns: sdkMsg.num_turns,
          totalCostUsd: sdkMsg.total_cost_usd,
          durationMs: sdkMsg.duration_ms
        };

        if (sdkMsg.subtype === 'success') {
          resultInfo.result = sdkMsg.result;
        } else {
          resultInfo.errors = sdkMsg.errors;
          resultInfo.subtype = sdkMsg.subtype;
        }

        res.write(`data: ${JSON.stringify(resultInfo)}\n\n`);
        break;
      }
    }

    res.end();
  } catch (error) {
    console.error('Error in chat:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message,
      done: true
    })}\n\n`);
    res.end();
  }
});

// Clear conversation history endpoint
app.delete('/api/conversations/:sessionId', authenticateToken, (req, res) => {
  const username = req.user.username;
  const sessionId = req.params.sessionId;

  // Delete the session directory
  const sessionDir = path.join(CLAUDE_SESSIONS_DIR, username, 'claude', sessionId);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }

  res.json({ success: true });
});

// Admin middleware - only mike can access
const adminOnly = (req, res, next) => {
  if (req.user.username !== 'mike') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Get list of all users
app.get('/api/admin/users', authenticateToken, adminOnly, (req, res) => {
  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  res.json({ users: Object.keys(users) });
});

// Get permissions for a specific user
app.get('/api/admin/permissions/:username', authenticateToken, adminOnly, (req, res) => {
  const { username } = req.params;
  const permissions = JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf8'));

  const userPermissions = permissions[username] || {
    allowedTools: [],
    deniedTools: [],
    allowedDirectories: [],
    permissionMode: 'default'
  };

  res.json(userPermissions);
});

// Update permissions for a specific user
app.put('/api/admin/permissions/:username', authenticateToken, adminOnly, (req, res) => {
  const { username } = req.params;
  const newPermissions = req.body;

  const permissions = JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf8'));
  permissions[username] = newPermissions;
  fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(permissions, null, 2));

  res.json({ success: true });
});

// Get user config
app.get('/api/user/config/:username', authenticateToken, (req, res) => {
  const { username } = req.params;
  const configFile = path.join(USER_CONFIGS_DIR, `${username.toLowerCase()}.json`);

  if (!fs.existsSync(configFile)) {
    return res.status(404).json({ error: 'User config not found' });
  }

  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  res.json(config);
});

// Get file tree from user's claude folder
app.get('/api/files/tree', authenticateToken, (req, res) => {
  const username = req.user.username;
  const claudeDir = path.join(CLAUDE_SESSIONS_DIR, username, 'claude');

  const buildTree = (dirPath, relativePath = '') => {
    if (!fs.existsSync(dirPath)) {
      return null;
    }

    const stats = fs.statSync(dirPath);
    const name = path.basename(dirPath);

    if (stats.isFile()) {
      return {
        name,
        path: relativePath,
        type: 'file'
      };
    }

    if (stats.isDirectory()) {
      const children = fs.readdirSync(dirPath)
        .filter(item => !item.startsWith('.'))
        .map(item => buildTree(
          path.join(dirPath, item),
          path.join(relativePath, item)
        ))
        .filter(item => item !== null)
        .sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'directory' ? -1 : 1;
        });

      return {
        name: name || 'claude',
        path: relativePath,
        type: 'directory',
        children
      };
    }

    return null;
  };

  const tree = buildTree(claudeDir, '');
  res.json(tree);
});

// File upload endpoint
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const username = req.user.username;
      const userDir = path.join(CLAUDE_SESSIONS_DIR, username);
      const attachmentsDir = path.join(userDir, 'attachments');

      // Ensure attachments directory exists
      if (!fs.existsSync(attachmentsDir)) {
        fs.mkdirSync(attachmentsDir, { recursive: true });
      }

      cb(null, attachmentsDir);
    },
    filename: (req, file, cb) => {
      // Keep original filename
      cb(null, file.originalname);
    }
  })
});

app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Return relative path from user directory (includes attachments/ prefix)
  const relativePath = `attachments/${req.file.filename}`;
  res.json({
    success: true,
    filename: req.file.filename,
    relativePath: relativePath,
    size: req.file.size
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT} and accessible from network`);
});
