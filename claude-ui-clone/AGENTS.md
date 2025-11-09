# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a **two-server application**: a Next.js frontend (port 3000) and a separate Express backend (port 3001). Unlike typical Next.js apps, the API routes in `/app/api/chat/` are NOT used. All API calls go to the Express backend at `http://{hostname}:3001`.

### Why Two Servers?

The Express backend enables:
- Per-user Claude Agent SDK session isolation (each user gets their own `cwd` directory)
- Persistent conversation storage across page refreshes
- Multi-user authentication with JWT tokens
- Per-user permission management for the Agent SDK
- File upload handling with user-specific directories

### User Isolation

Each user gets their own directory at `claude-ui-backend/users/{username}/`:
```
users/mike/
├── .claude/              # Claude Agent SDK session data
│   └── skills/          # Symlinked to global skills directory
└── attachments/         # User-uploaded files
```

When the backend calls the Agent SDK, it passes `cwd: userDir` to isolate the filesystem context per user.

### Session Continuity

The Agent SDK returns a `session_id` that the backend streams to the frontend as `{type: 'session_id', sessionId: '...'}`. The frontend stores this in the conversation object. When resuming a conversation, the frontend sends the `sessionId` back, and the backend uses `resume: sessionId` in the query options to continue the session.

## Development Commands

### Initial Setup
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd claude-ui-backend
npm install
cd ..

# Set up environment
cp .env.example .env.local
# Edit .env.local and add: ANTHROPIC_API_KEY=your_key_here
```

### Running the App
```bash
# Terminal 1: Start backend (required first)
cd claude-ui-backend
node server.js

# Terminal 2: Start frontend
npm run dev

# Access at http://localhost:3000
```

### Production Build
```bash
# Build frontend
npm run build
npm start  # Runs on port 3000

# Backend runs same command
cd claude-ui-backend
npm start  # Runs on port 3001
```

## Agent SDK Integration

### Streaming Architecture

The backend streams multiple event types via Server-Sent Events:
```javascript
{type: 'session_id', sessionId: string}
{type: 'text_block_start', blockIndex: number}
{type: 'text', content: string, blockIndex: number}
{type: 'tool_use', tool: string, toolUseId: string, blockIndex: number}
{type: 'text_block_end', blockIndex: number}
{type: 'result', done: true, ...metadata}
```

The frontend builds `contentBlocks[]` arrays that preserve block order, enabling inline tool usage indicators within messages.

### Query Configuration

Backend calls Agent SDK with:
```javascript
query({
  prompt: message,
  options: {
    cwd: userDir,                    // Per-user isolation
    includePartialMessages: true,    // Real-time streaming
    settingSources: ['project'],     // Enable skills discovery
    resume: sessionId,               // Continue conversation
    permissionMode: userPermissions.permissionMode || 'default',
    allowedTools: userPermissions.allowedTools,
    deniedTools: userPermissions.deniedTools,
    additionalDirectories: userPermissions.allowedDirectories
  }
})
```

### Skills Discovery

The backend symlinks each user's `.claude/skills/` directory to the global skills directory and sets `settingSources: ['project']` to enable automatic skill discovery.

## Permission Management

Permissions are stored in `claude-ui-backend/permissions.json` with structure:
```json
{
  "username": {
    "permissionMode": "default" | "acceptEdits" | "bypassPermissions",
    "allowedTools": ["Read", "Write", "Bash"],
    "deniedTools": ["WebSearch"],
    "allowedDirectories": ["/additional/path"]
  }
}
```

Only the admin user (hardcoded as "mike") can access the Settings UI to modify permissions.

## Authentication Flow

1. User logs in via `/api/login` → receives JWT token
2. Frontend stores token in `localStorage.getItem('token')`
3. All API calls include `Authorization: Bearer {token}` header
4. Backend middleware `authenticateToken()` validates JWT and attaches `req.user`

User credentials are stored in `claude-ui-backend/users.json` with bcrypt-hashed passwords.

## Data Storage

### Conversations
- Stored per-user in `claude-ui-backend/conversations/{username}.json`
- Each conversation has a frontend-generated UUID
- Includes `sessionId` from Agent SDK for resumption
- Frontend loads via `/api/conversations` on mount

### User Profiles
- Stored in `claude-ui-backend/user-configs/{username}.json`
- Contains `{firstName, lastName, email}`
- Loaded via `/api/user-config`

### File Uploads
- Uploaded via `/api/upload` with multer
- Stored in `users/{username}/attachments/`
- Returns relative path like `attachments/filename.png`
- User can reference in prompts (Agent SDK has access to their cwd)

## Styling & Theming

Uses Tailwind CSS v4 with new `@theme` directive in `globals.css`:
```css
@import "tailwindcss";

@theme {
  --color-claudeBg: rgb(250, 249, 245);
  /* ... exact Claude.ai colors */
}
```

Dark mode toggled via `localStorage.theme` and `document.documentElement.classList`.

## Network Configuration

Backend listens on `0.0.0.0` to accept network connections. Frontend dynamically constructs backend URL as `http://{window.location.hostname}:3001`, enabling same-network device testing.

## Key Files

| File | Purpose |
|------|---------|
| `app/page.tsx` | Main chat interface, SSE streaming handler, conversation state |
| `claude-ui-backend/server.js` | Express server, Agent SDK integration, JWT auth |
| `claude-ui-backend/permissions.json` | Per-user Agent SDK permission configs |
| `claude-ui-backend/users.json` | User credentials (bcrypt hashed) |
| `claude-ui-backend/conversations/{user}.json` | Per-user conversation history |
| `app/globals.css` | Tailwind v4 config with Claude.ai colors |
| `app/components/ChatMessage.tsx` | Message rendering with markdown + tool indicators |
