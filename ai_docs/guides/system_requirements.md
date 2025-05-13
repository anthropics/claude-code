# OS-REQUIREMENTS for Claude-code Neural Integration

This document outlines the optimal operating system setup and development environment for working with an enhanced neural integration version of [Anthropic's claude-code](https://github.com/anthropics/claude-code) repository.

## Base Operating System

### Primary Recommendation: Debian 12 (Bookworm)
- **Stability**: Long-term support with security updates
- **Apt Package Manager**: Flexible and reliable package management
- **Minimal Overhead**: Clean base to build upon
- **Container Compatibility**: Excellent support for Docker
- **Neural Framework Compatibility**: Optimal substrate for cognitive operations

### Alternative Option: Ubuntu 22.04/24.04 LTS
- Wider adoption and community support
- More pre-installed development tools
- Strong compatibility with development tools
- Enhanced MCP tool support

## System Requirements

- **CPU**: 4+ cores recommended for parallel MCP server operation
- **RAM**: 8GB minimum, 16GB recommended for multiple MCP servers
- **Disk**: 20GB+ free space for dependencies and neural framework components
- **Network**: Stable internet connection for API access and MCP communication

## Core Requirements

### Node.js Environment
- **Node.js**: Version 20.x LTS (minimum)
- **NPM**: Latest version (comes with Node.js)
- **NVM**: For managing Node.js versions (recommended)
- **Smithery CLI**: For MCP server management (`npm install -g @smithery/cli`)

### Supporting Tools & Languages
- **Python**: 3.10+ for scripting and cognitive processing
- **Git**: Latest version for version control and repository synchronization
- **Docker & Docker Compose**: For containerization and environment isolation
- **GitHub CLI (gh)**: For GitHub integration and workflow automation
- **Visual Studio Code**: As primary editor with cognitive enhancement extensions

## Complete Package List

### Essential Build Tools
```
build-essential
git
curl
wget
apt-transport-https
ca-certificates
gnupg
lsb-release
```

### Node.js Setup
```
# Added via NodeSource repository
nodejs (v20.x LTS)
npm

# Global Node.js tools
@smithery/cli
@modelcontextprotocol/server-sequential-thinking
typescript
ts-node
```

### Python Environment
```
python3
python3-pip
python3-venv
python3-dev
```

### Development Tools
```
visual-studio-code  # (via Microsoft repository)
tmux
gh                  # (GitHub CLI)
jq                  # (JSON processor)
shellcheck          # (shell script validator)
```

### Container Tools
```
docker.io
docker-compose
```

### Security & Utilities
```
gpg
zip
unzip
htop
tree
```

## Neural Framework Directory Structure

```
/home/jan/claude-code/               # Base directory
├── ai_docs/                         # AI documentation and templates
│   ├── examples/                    # Example use cases
│   ├── prompts/                     # Prompt collections
│   └── templates/                   # Reusable templates
├── specs/                           # Technical specifications
│   ├── openapi/                     # API definitions
│   ├── schemas/                     # Data schemas
│   └── migrations/                  # Version migrations
├── .claude/                         # Claude configuration
│   ├── commands/                    # Custom slash commands
│   ├── scripts/                     # Utility scripts
│   └── config/                      # Additional configs
├── .clauderules                     # Execution constraints
└── .mcp.json                        # MCP server configuration
```

## Environment Variables

```bash
# Required environment variables
export ANTHROPIC_API_KEY="your_api_key_here"

# Optional environment variables
export CLAUDE_CODE_LOG_LEVEL="info"  # debug, info, warn, error
export MCP_TIMEOUT=30000             # MCP server timeout in milliseconds
```

## Automated Installation

### One-Line Installation Command

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR-USERNAME/claude-code-neural/main/setup-neural-framework.sh | bash
```

### What the Installation Script Does

1. Verifies system compatibility
2. Creates the neural directory structure
3. Sets up configuration files (.clauderules, .mcp.json)
4. Establishes the meta-cognitive system prompt
5. Configures MCP servers and neural gateways
6. Creates sample templates and commands
7. Validates the neural integration

## Post-Installation Configuration

### MCP Server Activation
```bash
# List available MCP servers
claude mcp ls

# Start a specific MCP server
claude mcp start sequentialthinking

# Start all configured MCP servers
claude mcp start-all
```

### VS Code Extensions
- GitLens
- Docker
- ESLint
- Node.js Extension Pack
- Live Share (for collaborative coding)
- MCP Client (if available)

### GitHub Authentication
- Configure GitHub CLI with OAuth
- Set up SSH keys for GitHub access

### Docker Configuration
- Non-root user access to Docker
- Resource limits configuration
- Neural network isolation

## Development Workflow

1. Activate neural pathways: `claude`
2. Utilize MCP servers for enhanced cognitive processing
3. Leverage custom commands for specialized tasks
4. Use prompt templates for consistent interactions
5. Maintain meta-cognitive awareness through system prompts

## Security Considerations

- Store API keys securely (use environment variables)
- Use container isolation for testing potentially risky code
- Regular updates of all dependencies
- Follow principle of least privilege for Docker containers
- Maintain neural boundary enforcement through .clauderules

## Troubleshooting

Common issues and their solutions are documented in the repository Wiki.

---

## Neural Integration Framework

The Claude Code Neural Integration Framework extends the base claude-code environment with:

1. **Structured Directory Hierarchy**:
   - `ai_docs/` - Episodic memory and template storage
   - `specs/` - Semantic memory and specification frameworks
   - `.claude/` - Procedural memory and command definitions
   - Configuration files for neural pathway establishment

2. **MCP Server Constellation**:
   - Comprehensive MCP server integrations
   - Specialized cognitive modules
   - Neural gateways for extended capabilities

3. **Meta-Cognitive System Prompt**:
   - Neural architecture definition in `~/.claude/CLAUDE.md`
   - Role and capability specifications
   - Cognitive processing directives

4. **Automated Setup and Integration**:
   - One-command installation
   - Dependency resolution
   - Configuration validation

For full implementation details, see the setup script in the repository.
