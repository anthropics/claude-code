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

# For a simpler installation
./simple_install.sh

# Configure API keys
export CLAUDE_API_KEY="YOUR_CLAUDE_API_KEY"
export MCP_API_KEY="YOUR_MCP_API_KEY"
export VOYAGE_API_KEY="YOUR_VOYAGE_API_KEY"  # If using Voyage embeddings

# Setup RAG components (optional)
python core/rag/setup_database.py

# Start MCP server
node core/mcp/start_server.js
```

## Common Tasks and Commands

### SAAR (Setup, Activate, Apply, Run) Workflow

I've created a streamlined installation and setup workflow with the SAAR script to simplify the user experience with the Claude Neural Framework. Here's what I've implemented:

1. SAAR.sh Script - An all-in-one bash script that provides a clear and simple interface for:
   - Complete framework setup (both interactive and quick modes)
   - Color schema configuration with theme selection
   - .about profile management
   - Project creation with templates
   - Starting MCP servers and launching the Claude agent
2. Command Structure - The script uses a simple command structure:
   ```bash
   ./saar.sh setup     # Full interactive setup
   ./saar.sh setup --quick --theme=dark     # Quick setup with dark theme
   ./saar.sh colors    # Configure color schema
   ./saar.sh project   # Set up a new project
   ./saar.sh start     # Start MCP servers
   ./saar.sh agent     # Launch Claude agent
   ```
3. Default Configuration - In quick mode, it sets up sensible defaults:
   - Dark theme for the color schema
   - Basic .about profile with common preferences
   - Automatic API key configuration
4. Documentation - Added a comprehensive guide for using the SAAR script with examples and troubleshooting tips.
5. CLAUDE.md Update - Added the SAAR quick start guide to the main CLAUDE.md file, making it the recommended approach for new users.

This simplified workflow addresses the need for a straightforward setup process, especially for new users of the framework. The script handles all the complexity behind the scenes while providing a clean and intuitive interface.

To get started, users can simply run `./saar.sh setup` for the full interactive experience or `./saar.sh setup --quick` for a quick setup with defaults.

### Manual Installation and Setup

```bash
# Install dependencies
npm install

# Configure MCP servers
node core/mcp/setup_mcp.js

# Start all MCP servers
node core/mcp/start_server.js

# Start a specific MCP server
node core/mcp/start_server.js sequentialthinking

# Set up user color schema (interactive)
node scripts/setup/setup_user_colorschema.js

# Set specific color schema
node core/mcp/color_schema_manager.js --template=dark

# Apply color schema to existing UI components
node core/mcp/color_schema_manager.js --template=light --apply=true
```

### RAG Framework

```bash
# Setup RAG database
python core/rag/setup_database.py

# Setup with specific database type
python core/rag/setup_database.py --db-type lancedb

# Only check configuration without setting up database
python core/rag/setup_database.py --check-only

# Generate embeddings
python -m core.rag.generate_embeddings --input path/to/documents

# Test RAG query
python -m core.rag.query_test --query "your test query"
```

### Debugging Tools

```bash
# Run the recursive debugging workflow engine
node scripts/debug_workflow_engine.js --workflow standard --file path/to/file

# Run specific debugging workflows
node scripts/debug_workflow_engine.js --workflow quick --file path/to/file
node scripts/debug_workflow_engine.js --workflow deep --file path/to/file
node scripts/debug_workflow_engine.js --workflow performance --file path/to/file

# Run specific debugging commands
claude-cli debug recursive --template recursive_bug_analysis --file recursive_function.js
claude-cli optimize --template recursive_optimization --file slow_algorithm.py
claude-cli workflow --template systematic_debugging_workflow --file buggy_system.js
```

## Important Files

- `/core/mcp/claude_integration.js`: Core integration with Claude API and RAG functionality
- `/core/mcp/server_config.json`: MCP server configuration
- `/cognitive/core_framework.md`: Main system prompt definitions
- `/core/config/mcp_config.json`: MCP server connection details
- `/core/config/rag_config.json`: RAG system configuration
- `/core/config/security_constraints.json`: Security boundaries and constraints
- `/core/rag/rag_framework.py`: RAG system implementation

## Development Guidelines

1. **MCP Integration**: When working with MCP servers, refer to the configuration in `core/mcp/server_config.json` and use the established protocols in `core/mcp/claude_mcp_client.js`

2. **Prompt Templates**: Use and extend existing prompt templates in the `cognitive/prompts` directory, maintaining the established XML tag structure

3. **RAG System**: The RAG system supports multiple vector databases (LanceDB, ChromaDB) and embedding models (Voyage AI, Hugging Face)

4. **Agent Communication**: Follow the agent-to-agent communication protocol defined in the `agents` directory

5. **Configuration**: System configuration is centralized in `core/config` for consistency

6. **Debugging Workflows**: For recursive debugging, use the workflow engine in `scripts/debug_workflow_engine.js` with the appropriate templates

## System Requirements

- **OS**: Linux, macOS or WSL2 on Windows
- **Node.js**: Version 18+ (recommended: 20 LTS)
- **Python**: Version 3.8+ (recommended: 3.10+)
- **Git**: Latest stable version
- **RAM**: Minimum 4GB, 8GB+ recommended
- **Storage**: 1GB+ free disk space

## Python Dependencies

- `anthropic`: For Claude API integration
- `lancedb` or `chromadb`: For vector database functionality
- `voyage`: For Voyage AI embeddings (optional)
- `sentence-transformers`: For Hugging Face embeddings (optional)

## MCP Servers

The framework integrates with these MCP servers:

- **sequentialthinking**: Recursive thought generation
- **context7**: Context awareness and documentation access
- **desktop-commander**: Filesystem integration and shell execution
- **brave-search**: External knowledge acquisition
- **think-mcp**: Meta-cognitive reflection