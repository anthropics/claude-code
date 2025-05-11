# Claude Neural Framework - Core Framework

## Overview

The Claude Neural Framework provides a comprehensive environment for integrating Claude's AI capabilities with development workflows. This document serves as the core system prompt for the framework.

## Architecture

The framework follows a distributed cognition model with five main components:

1. **Claude Neural Core**: Primary semantic processing and pattern recognition
2. **MCP Server Integration**: Specialized cognitive modules for extended functions
3. **Developer Interface**: Bidirectional human interaction
4. **System Substrate**: Technical execution environment
5. **Code Repository**: Versioned persistence storage

## Capabilities

- **MCP Integration**: Seamless connection with Model Context Protocol servers
- **RAG Framework**: Retrieval Augmented Generation for context-based AI responses
- **Agent Architecture**: Structured agent-to-agent communication protocol
- **Code Analysis**: Deep understanding of code structures and patterns
- **Prompt Engineering**: Extensive library of optimized prompts

## Usage

The framework can be used through various interfaces:

1. Claude CLI: `claude`
2. MCP Server CLI: `claude mcp`
3. RAG System: Python interfaces in `core/rag`
4. API Integration: JavaScript/Node.js in `core/mcp`

## Configuration

The framework uses a central configuration system in `core/config` with these main configuration files:

- `mcp_config.json`: MCP server configuration
- `rag_config.json`: RAG system configuration
- `security_constraints.json`: Security boundaries and constraints

## SAAR Framework Setup

● I've created a streamlined installation and setup workflow with the SAAR script (Setup, Activate, Apply, Run) to simplify the user experience with the Claude Neural Framework. Here's what I've implemented:

  1. SAAR.sh Script - An all-in-one bash script that provides a clear and simple interface for:
    - Complete framework setup (both interactive and quick modes)
    - Color schema configuration with theme selection
    - .about profile management
    - Project creation with templates
    - Starting MCP servers and launching the Claude agent
  2. Command Structure - The script uses a simple command structure:
  ./saar.sh setup     # Full interactive setup
  ./saar.sh setup --quick --theme=dark     # Quick setup with dark theme
  ./saar.sh colors    # Configure color schema
  ./saar.sh project   # Set up a new project
  ./saar.sh start     # Start MCP servers
  ./saar.sh agent     # Launch Claude agent
  3. Default Configuration - In quick mode, it sets up sensible defaults:
    - Dark theme for the color schema
    - Basic .about profile with common preferences
    - Automatic API key configuration
  4. Documentation - Added a comprehensive guide for using the SAAR script with examples and troubleshooting tips.
  5. CLAUDE.md Update - Added the SAAR quick start guide to the main CLAUDE.md file, making it the recommended approach for new users.

  This simplified workflow addresses the need for a straightforward setup process, especially for new users of the framework. The script handles all the complexity behind the scenes while providing a clean and intuitive
  interface.

  To get started, users can simply run ./saar.sh setup for the full interactive experience or ./saar.sh setup --quick for a quick setup with defaults.