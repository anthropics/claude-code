#!/bin/bash

# Simple installation script for Claude Neural Framework
set -e

echo "=== Installing Claude Neural Framework ==="

# Create directory structure
echo "Creating directory structure..."
mkdir -p core/config core/mcp core/rag
mkdir -p cognitive/prompts/classification cognitive/prompts/generation cognitive/prompts/coding cognitive/templates
mkdir -p agents/commands
mkdir -p docs/guides docs/api docs/examples
mkdir -p tools
mkdir -p ~/.claude

# Create cognitive framework file
echo "Creating core framework file..."
cat > cognitive/core_framework.md << 'EOF'
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
EOF

# Create symbolic link to CLAUDE.md
echo "Creating symbolic link to CLAUDE.md..."
ln -sf $(pwd)/cognitive/core_framework.md ~/.claude/CLAUDE.md

# Create MCP configuration file
echo "Creating MCP configuration file..."
mkdir -p core/config
cat > core/config/mcp_config.json << 'EOF'
{
  "version": "1.0.0",
  "servers": {
    "sequentialthinking": {
      "enabled": true,
      "autostart": true,
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "description": "Recursive thought generation for complex problems"
    },
    "brave-search": {
      "enabled": true,
      "autostart": false,
      "command": "npx",
      "args": ["-y", "@smithery/cli@latest", "run", "@smithery-ai/brave-search"],
      "api_key_env": "MCP_API_KEY",
      "description": "External knowledge acquisition"
    }
  }
}
EOF

# Create RAG configuration file
echo "Creating RAG configuration file..."
cat > core/config/rag_config.json << 'EOF'
{
  "database": {
    "type": "lancedb",
    "connection": {
      "path": "data/lancedb"
    },
    "dimensions": 1024
  },
  "embedding": {
    "provider": "voyage",
    "model": "voyage-2",
    "dimensions": 1024,
    "api_key_env": "VOYAGE_API_KEY"
  },
  "retrieval": {
    "top_k": 5,
    "similarity_threshold": 0.7,
    "reranking": false
  }
}
EOF

# Create security constraints file
echo "Creating security constraints file..."
cat > core/config/security_constraints.json << 'EOF'
{
  "execution": {
    "confirmation_required": true,
    "allowed_commands": ["git", "npm", "node", "python", "docker", "test", "ls", "find", "grep"],
    "blocked_commands": ["rm -rf /", "sudo", "chmod 777", "curl | bash", "wget | bash"]
  },
  "filesystem": {
    "read": {
      "allowed": true,
      "paths": ["./", "../", "~/.claude/"]
    },
    "write": {
      "allowed": true,
      "confirmation_required": true,
      "paths": ["./", "./src/", "./docs/", "./ai_docs/", "./specs/", "./.claude/"]
    }
  },
  "network": {
    "allowed": true,
    "restricted_domains": ["localhost"]
  }
}
EOF

# Create README template
echo "Creating README file..."
cat > README.md << 'EOF'
# Claude Neural Framework

> Eine fortschrittliche Integrationsplattform für Claude's KI-Fähigkeiten mit MCP und RAG

## Übersicht

Das Claude Neural Framework bietet eine umfassende Lösung für die Integration von Claude's kognitiven Fähigkeiten in Entwicklungs-Workflows. Es kombiniert agentenbasierte Architektur, MCP-Integration (Model Context Protocol) und fortschrittliches Prompt-Engineering in einer konsistenten Arbeitsumgebung.

## Installation

```bash
# Repository klonen
git clone https://github.com/username/claude-code.git
cd claude-code

# Installation ausführen
./simple_install.sh

# API-Schlüssel konfigurieren
export CLAUDE_API_KEY="YOUR_CLAUDE_API_KEY"
```

## Hauptfunktionen

- **MCP-Integration**: Nahtlose Verbindung mit Model Context Protocol-Servern
- **RAG-Framework**: Retrieval Augmented Generation für kontextbasierte KI-Antworten
- **Agentenarchitektur**: Strukturiertes Agent-zu-Agent-Kommunikationsprotokoll
- **Codeanalyse**: Tiefgreifendes Verständnis von Codestrukturen und -mustern

## Verzeichnisstruktur

```
claude-code/
├── core/                # Kernfunktionalität
│   ├── config/          # Konfigurationsdateien
│   ├── mcp/             # MCP-Integration
│   └── rag/             # RAG-Framework
├── agents/              # Agentenbasierte Architektur
│   └── commands/        # Agentenbefehle
├── cognitive/           # Kognitive Komponenten
│   ├── prompts/         # Prompt-Bibliothek
│   └── templates/       # Wiederverwendbare Templates
└── docs/                # Dokumentation
    ├── architecture/    # Architekturdetails
    ├── guides/          # Anleitungen
    └── examples/        # Beispiele
```
EOF

echo "=== Installation complete ==="
echo "Next steps:"
echo "1. Configure your CLAUDE_API_KEY in the environment"
echo "2. Install npm dependencies if needed: npm install @anthropic/sdk"
echo "3. Install Python dependencies if needed: pip install anthropic lancedb voyage"