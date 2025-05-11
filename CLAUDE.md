# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Claude Neural Framework is a comprehensive platform for integrating Claude AI capabilities with development workflows. It combines agent-based architecture, Model Context Protocol (MCP) integration, and Retrieval Augmented Generation (RAG) in a consistent environment.

## Architecture

The framework is structured into several main components:

1. **Core**: Core functionality including MCP integration and configuration
2. **Cognitive**: Prompt templates, classification models, and AI guidance
3. **Agents**: Agent-to-agent communication framework and commands
4. **RAG**: Retrieval Augmented Generation framework for context-aware responses
5. **MCP Integration**: Connection to various MCP servers for extended functionality

## Setup and Installation

The framework can be installed using the installation script:

```bash
# Clone repository
git clone https://github.com/username/claude-code.git
cd claude-code

# Run installation script
./installation/install.sh

# Configure API keys
export CLAUDE_API_KEY="YOUR_CLAUDE_API_KEY"
export MCP_API_KEY="YOUR_MCP_API_KEY"

# Setup RAG components (optional)
python core/rag/setup_database.py

# Start MCP server
node core/mcp/start_server.js
```

## Common Tasks and Commands

### Installation and Setup

```bash
# Install dependencies
npm install

# Configure MCP servers
node core/mcp/setup_mcp.js

# Start MCP servers
node core/mcp/start_server.js
```

### Development

```bash
# Run development server
npx claude

# Check MCP server status
npx claude mcp ls

# Start a specific MCP server
npx claude mcp start sequentialthinking
```

### RAG Framework

```bash
# Setup RAG database
python core/rag/setup_database.py

# Generate embeddings
python -m core.rag.generate_embeddings --input path/to/documents

# Test RAG query
python -m core.rag.query_test --query "your test query"
```

## Important Files

- `/core/mcp/claude_integration.js`: Core integration with Claude API and RAG functionality
- `/core/mcp/server_config.json`: MCP server configuration
- `/cognitive/core_framework.md`: Main system prompt definitions
- `/core/config/mcp_config.json`: MCP server connection details
- `/core/rag/rag_framework.py`: RAG system implementation

## Development Guidelines

1. **MCP Integration**: When working with MCP servers, refer to the configuration in `core/mcp/server_config.json` and use the established protocols in `core/mcp/claude_mcp_client.js`

2. **Prompt Templates**: Use and extend existing prompt templates in the `cognitive/prompts` directory, maintaining the established XML tag structure

3. **RAG System**: The RAG system supports multiple vector databases (LanceDB, ChromaDB) and embedding models (Voyage AI)

4. **Agent Communication**: Follow the agent-to-agent communication protocol defined in the `agents` directory

5. **Configuration**: System configuration is centralized in `core/config` for consistency

## System Requirements

- **OS**: Linux, macOS or WSL2 on Windows
- **Node.js**: Version 18+ (recommended: 20 LTS)
- **Python**: Version 3.8+ (recommended: 3.10+)
- **Git**: Latest stable version
- **RAM**: Minimum 4GB, 8GB+ recommended
- **Storage**: 1GB+ free disk space

## MCP Servers

The framework integrates with these MCP servers:

- **sequentialthinking**: Recursive thought generation
- **context7**: Context awareness and documentation access
- **desktop-commander**: Filesystem integration and shell execution
- **brave-search**: External knowledge acquisition
- **think-mcp**: Meta-cognitive reflection