# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Claude Neural Framework is a comprehensive platform for integrating Claude AI capabilities with development workflows. It combines agent-based architecture, Model Context Protocol (MCP) integration, and Retrieval Augmented Generation (RAG) in a consistent environment.

## Architecture

The framework is structured into several main components:

1. **Core**: Core functionality including MCP integration and configuration
2. **Agents**: Agent-to-agent communication framework and specialized agents
3. **MCP**: Integration with various MCP servers for extended functionality
4. **RAG**: Retrieval Augmented Generation framework for context-aware responses
5. **Workflows**: Sequential planning and execution engines
6. **Apps**: Applications including CLI, API, and web interface

## Development Conventions

### Code Style

- TypeScript is used throughout the codebase with strict typing
- Use functional programming patterns where appropriate
- Follow the hexagonal architecture pattern for better separation of concerns
- Use dependency injection for better testability

### Testing

- Write unit tests for all core functionality
- Use integration tests for testing between modules
- Use E2E tests for testing applications
- Use mocks and test doubles for external dependencies

### Documentation

- Document all public APIs with JSDoc comments
- Keep README files up-to-date
- Document architectural decisions
- Use diagrams to explain complex systems

## Running the Framework

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build the project
npm run build
```

## MCP Integration

The framework integrates with various MCP servers:

- **sequentialthinking**: Recursive thought generation
- **context7**: Context awareness and documentation access
- **desktop-commander**: Filesystem integration and shell execution
- **brave-search**: External knowledge acquisition
- **think-mcp**: Meta-cognitive reflection

## Agent System

The agent system is based on specialized agents that communicate with each other through a standardized protocol:

- **Debug Agents**: For recursive debugging and bug hunting
- **Documentation Agents**: For generating documentation from code
- **Git Agents**: For integrating with Git workflows
- **Orchestrator**: For coordinating agent activities

## RAG Framework

The RAG framework provides context-aware responses by:

1. Indexing code and documentation
2. Generating embeddings for efficient retrieval
3. Retrieving relevant context for a given query
4. Generating responses augmented with retrieved information

## Sequential Thinking and Planning

The framework implements sequential thinking and planning through:

1. Breaking down complex problems into steps
2. Generating plans for achieving goals
3. Executing plans step by step
4. Monitoring and adapting to changes during execution