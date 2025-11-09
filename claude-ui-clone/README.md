# Claude UI Clone

A modern, feature-rich Claude AI chat interface built with Next.js and the Claude Agent SDK. This project demonstrates how to build a production-ready chat application with streaming responses, conversation management, and a beautiful UI that matches Claude's design.

![Claude UI Clone](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8?logo=tailwindcss)

## Features

- 🎨 **Clean, Modern UI** - Matches Claude's interface design
- 💬 **Real-time Streaming** - See responses as they're generated
- 📱 **Responsive Design** - Works on desktop and mobile
- 🌙 **Dark Mode** - Full dark/light theme support
- 💾 **Conversation History** - Manage multiple conversations with localStorage persistence
- 🎯 **Markdown Support** - Full markdown rendering with syntax highlighting
- ⚡ **Fast & Efficient** - Built with Next.js 16 and React Server Components
- 🔐 **Agent SDK Integration** - Powered by the official Claude Agent SDK

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **AI Integration**: Claude Agent SDK
- **Markdown**: react-markdown with syntax highlighting
- **State Management**: React hooks + localStorage

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- An Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com))

## Getting Started

### 1. Clone or Navigate to the Project

\`\`\`bash
cd claude-ui-clone
\`\`\`

### 2. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 3. Set Up Environment Variables

Create a \`.env.local\` file in the root directory:

\`\`\`bash
cp .env.example .env.local
\`\`\`

Then add your Anthropic API key:

\`\`\`env
ANTHROPIC_API_KEY=your_api_key_here
\`\`\`

### 4. Run the Development Server

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

\`\`\`
claude-ui-clone/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts          # API endpoint using Agent SDK
│   ├── components/
│   │   ├── ChatMessage.tsx       # Message display component
│   │   ├── ChatInput.tsx         # Message input component
│   │   ├── Sidebar.tsx           # Conversation sidebar
│   │   └── ThemeToggle.tsx       # Dark mode toggle
│   ├── page.tsx                  # Main chat interface
│   ├── layout.tsx                # Root layout with theme support
│   └── globals.css               # Global styles
├── package.json
└── README.md
\`\`\`

## Key Components

### ChatMessage
Displays individual messages with support for:
- User and assistant roles
- Markdown formatting
- Code syntax highlighting
- Streaming indicator

### ChatInput
Feature-rich input component with:
- Auto-resizing textarea
- Keyboard shortcuts (Enter to send, Shift+Enter for new line)
- Disabled state during message processing
- Send button

### Sidebar
Conversation management with:
- List of all conversations
- New conversation creation
- Conversation selection
- Delete conversations
- Collapsible design

### ThemeToggle
Toggle between light and dark themes with persistence to localStorage.

## API Integration

The \`/api/chat/route.ts\` endpoint demonstrates how to use the Claude Agent SDK:

\`\`\`typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

// Stream responses from Claude
for await (const msg of query(prompt, options)) {
  // Process and stream messages
}
\`\`\`

Features:
- Streaming responses using Server-Sent Events
- Conversation history management
- Error handling
- Tool permissions configuration

## Configuration

### Agent SDK Options

The app is configured with:
- **Model**: \`claude-sonnet-4-5\`
- **Permission Mode**: \`bypassPermissions\` (for demo)
- **Allowed Tools**: \`Read\`, \`Write\`, \`Bash\`, \`Grep\`, \`Glob\`

You can modify these in \`/app/api/chat/route.ts\`.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| \`ANTHROPIC_API_KEY\` | Your Anthropic API key | Yes |

## Learn More

- [Claude Agent SDK Documentation](../docs/agent-sdk/overview.md)
- [Next.js Documentation](https://nextjs.org/docs)
- [Anthropic API Reference](https://docs.anthropic.com)
