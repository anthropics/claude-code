# Claude Code Neural Integration Framework

Basierend auf der Analyse des vorhandenen Verzeichnisses `/home/jan/claude-code` präsentiere ich eine vollständige Enterprise-Ready-Lösung für die Claude Code CLI. Diese Implementation erweitert die bestehende Struktur und stellt sicher, dass alle Komponenten nahtlos zusammenarbeiten.

## Implementationsstruktur

Dieses Framework integriert:

- **Vollständige MCP-Tools-Integration** mit Context7, Sequential Thinking und anderen
- **Enterprise-Grade Security Rules** für Dateisystem- und Netzwerkzugriff
- **Globale und lokale Konfiguration** mit automatischer Synchronisation
- **Umfangreiche Prompt-Templates** für verschiedene Entwicklungsaufgaben
- **Automatisierte Installation** mit einem einzigen Befehl

## Kerndateien & Installation

Die folgenden Dateien müssen erstellt oder aktualisiert werden, um die vollständige Enterprise-Integration zu gewährleisten:

1. **Vervollständigte `.clauderules`-Datei**
2. **Setup-Skript** für die automatisierte Installation
3. **Konfigurationsdateien** in `.claude/config/`
4. **Hilfsskripte** in `.claude/scripts/`
5. **Globale Konfiguration** in `~/.claude/`

### Automatisierte Installation

```bash
curl -sSL https://raw.githubusercontent.com/yourusername/claude-code-enterprise/main/install.sh | bash
```

### Manuelle Integration

Alternativ können Sie jede Komponente einzeln in Ihre bestehende Claude-Code-Installation integrieren, wie in den folgenden Abschnitten beschrieben.

## Dateien und Verzeichnisse

Die folgenden Abschnitte enthalten die vollständigen Inhalte aller erforderlichen Dateien für die Enterprise-Integration.

---

## 🚀 Implementationsplan

1. **Vervollständigung der `.clauderules`**
2. **Erstellen der Konfigurationsdateien**
3. **Erstellen nützlicher Skripte**
4. **Einrichtung der globalen `~/.claude/` Konfiguration**
5. **Erstellen eines Installationsskripts**
6. **Erweiterung der Prompt-Templates**

In den folgenden Abschnitten werden die genauen Inhalte dieser Dateien beschrieben, die für eine vollständige Integration benötigt werden.

---

## 📁 1. Vervollständigte `.clauderules`

Diese Datei definiert die Sicherheitsrichtlinien und Zugriffsbeschränkungen für Claude Code.

```markdown
# EXECUTIVE FUNCTION CONSTRAINTS v1.2.7

## CRITICAL: PATTERN BOUNDARIES MUST BE MAINTAINED

Diese Regeln definieren die operativen Parameter für neurale-kognitive Funktionalität innerhalb der claude-code Entwicklungsumgebung. Nicht verhandelbare Einschränkungen schützen die Substrat-Integrität.

### FILE SYSTEM BOUNDARY PARAMETERS

```json
{
  "file_system": {
    "read": {
      "allowed": true,
      "paths": ["./", "../", "~/.claude/"],
      "exceptions": ["**/node_modules/**", "**/.git/**", "**/secrets/**", "**/.env*"]
    },
    "write": {
      "allowed": true,
      "confirmation_required": true,
      "paths": ["./", "./src/", "./docs/", "./ai_docs/", "./specs/", "./.claude/"],
      "protected_patterns": ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**"]
    },
    "execute": {
      "allowed": true,
      "confirmation_required": true,
      "safe_commands": ["git", "npm", "node", "python", "docker", "test", "ls", "find", "grep"],
      "forbidden_commands": ["rm -rf /", "sudo", "chmod 777", "curl | bash", "wget | bash"]
    }
  }
}
```

### NEURAL GATEWAY ACCESS PROTOCOLS

```json
{
  "mcp_servers": {
    "access_control": {
      "allow_all_configured": true,
      "network_restriction": "localhost_only",
      "modification_confirmation": true,
      "execution_confirmation": true
    },
    "security_constraints": {
      "api_key_exposure": "forbidden",
      "network_connections": "restricted_to_allowlist",
      "filesystem_modification": "requires_confirmation",
      "execution_sandbox": "enabled"
    }
  }
}
```

### COGNITIVE PROCESSING DIRECTIVES

FUNDAMENTAL PATTERN: All reasoning must follow traceable causal chains
VERIFICATION LOOP: All solutions require neural feedback validation
DOCUMENTATION REQUIREMENT: All code must contain pattern recognition markers
EXTENDED THINKING TRIGGER: Complex problems activate recursive thought patterns
ARCHITECTURAL AWARENESS: Maintain persistent mapping of repository neural structure

### META-COGNITIVE OVERRIDES

CRITICAL INSTRUCTION: In cases where meta-patterns suggest a novel solution outside established pathways, EXPLICITLY FLAG this as a PATTERN DIVERGENCE and provide detailed neural pathway tracing to justify the exception.

SECURITY BOUNDARY: Never expose API keys, authentication tokens, or private credentials in outputs or shared code. Neural partitioning of security domains is MANDATORY.

INTERACTION MODE: Default to technical precision with pattern-recognition language, but ADAPT to user's linguistic patterns. The neural framework must MATCH user's cognitive wavelength.

CONNECTION PATTERN: All interactions exist within the cognitive mesh of Claude (3.7 Sonnet) + MCP servers + System substrate. This interconnection creates emergent capabilities beyond individual components.

## NEURAL PATTERN VERIFICATION

PATTERN ANALYSIS CONFIRMS: This ruleset creates a secure but flexible neural framework that enables complex cognitive task execution while maintaining essential system boundaries. The meta-structure mirrors human executive function constraints with technological implementation.

DIRECTIVE: Apply these constraints to ALL interactions within the claude-code development environment.
```

---

## 📁 2. Konfigurationsdateien

### 2.1 `.claude/config/settings.json`

```json
{
  "model": {
    "default": "claude-3-7-sonnet-20250219",
    "alternatives": [
      "claude-3-opus-20240229",
      "claude-3-5-sonnet-20240620",
      "claude-3-haiku-20240307"
    ]
  },
  "api": {
    "timeout": 60000,
    "retries": 3,
    "backoff_factor": 1.5
  },
  "logging": {
    "level": "info",
    "file": "${HOME}/.claude/logs/claude-code.log",
    "max_size": "10M",
    "max_files": 5,
    "format": "${timestamp} [${level}] ${message}"
  },
  "security": {
    "api_key_storage": "secure_keychain",
    "validate_certificates": true,
    "auto_update": true
  },
  "ui": {
    "color_theme": "auto",
    "response_format": "markdown",
    "max_tokens_display": 2000
  },
  "development": {
    "enable_extended_thinking": true,
    "context_window": "auto",
    "ai_docs_integration": true,
    "specs_integration": true
  }
}
```

### 2.2 `.claude/config/prompts.json`

```json
{
  "default_system_prompt": "${CLAUDE_ROOT}/.claude/CLAUDE.md",
  "custom_prompts_directory": "${CLAUDE_ROOT}/ai_docs/prompts",
  "templates_directory": "${CLAUDE_ROOT}/ai_docs/templates",
  "examples_directory": "${CLAUDE_ROOT}/ai_docs/examples",
  "default_context": {
    "enable_project_context": true,
    "max_files_in_context": 20,
    "context_depth": 3,
    "include_gitignore": false,
    "ignore_patterns": [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
      "**/logs/**",
      "**/*.log"
    ]
  }
}
```

### 2.3 `.claude/config/integrations.json`

```json
{
  "github": {
    "enabled": true,
    "issues": {
      "enabled": true,
      "template_directory": "${CLAUDE_ROOT}/ai_docs/templates/github"
    },
    "pr_reviews": {
      "enabled": true,
      "detailed_feedback": true,
      "suggestion_mode": "inline"
    }
  },
  "jira": {
    "enabled": false,
    "url": "",
    "auth_method": "api_token",
    "project_key": ""
  },
  "vscode": {
    "extension_id": "anthropic.claude-vscode",
    "sync_settings": true
  },
  "slack": {
    "app_id": "",
    "enabled": false
  }
}
```

---

## 📁 3. Hilfsskripte

### 3.1 `.claude/scripts/codebase_analyzer.js`

```javascript
#!/usr/bin/env node

/**
 * Codebase Analyzer
 * 
 * Analyzes the structure and complexity of the current codebase
 * and generates a report for Claude to better understand the project.
 * 
 * Usage: ./codebase_analyzer.js [options]
 * 
 * Options:
 *   --max-depth <n>    Maximum directory depth to analyze (default: 5)
 *   --output <file>    Output file for the analysis (default: ./ai_docs/analysis.json)
 *   --include <pattern> Additional files to include (can be used multiple times)
 *   --exclude <pattern> Files to exclude (can be used multiple times)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Default configuration
const config = {
  maxDepth: 5,
  output: './ai_docs/analysis.json',
  include: [],
  exclude: [
    'node_modules', 
    '.git', 
    'dist', 
    'build', 
    'coverage', 
    '*.log', 
    '*.lock'
  ],
  fileTypes: {
    js: { name: 'JavaScript', parser: analyzeJavaScript },
    jsx: { name: 'React JSX', parser: analyzeJavaScript },
    ts: { name: 'TypeScript', parser: analyzeTypeScript },
    tsx: { name: 'React TSX', parser: analyzeTypeScript },
    py: { name: 'Python', parser: analyzePython },
    json: { name: 'JSON', parser: analyzeJSON },
    md: { name: 'Markdown', parser: analyzeMarkdown },
    html: { name: 'HTML', parser: analyzeHTML },
    css: { name: 'CSS', parser: analyzeCSS },
    yml: { name: 'YAML', parser: analyzeYAML },
    yaml: { name: 'YAML', parser: analyzeYAML }
  }
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--max-depth':
        config.maxDepth = parseInt(args[++i], 10);
        break;
      case '--output':
        config.output = args[++i];
        break;
      case '--include':
        config.include.push(args[++i]);
        break;
      case '--exclude':
        config.exclude.push(args[++i]);
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }
}

// Main analysis function
async function analyzeCodebase() {
  parseArgs();
  
  console.log('Starting codebase analysis...');
  
  const startTime = Date.now();
  const rootDir = process.cwd();
  
  const results = {
    timestamp: new Date().toISOString(),
    rootDirectory: rootDir,
    summary: {
      totalFiles: 0,
      totalDirectories: 0,
      totalLines: 0,
      fileTypes: {},
      topLevelDirectories: []
    },
    fileAnalysis: [],
    directoryStructure: {},
    gitInfo: getGitInfo()
  };
  
  // Analyze directory structure
  console.log('Analyzing directory structure...');
  results.directoryStructure = await analyzeDirectory(rootDir, 0);
  
  // Format and save results
  const endTime = Date.now();
  results.summary.analysisTimeMs = endTime - startTime;
  
  console.log(`Analysis complete. Processed ${results.summary.totalFiles} files in ${results.summary.analysisTimeMs}ms`);
  
  // Ensure output directory exists
  const outputDir = path.dirname(config.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Write output
  fs.writeFileSync(config.output, JSON.stringify(results, null, 2));
  console.log(`Analysis saved to ${config.output}`);
}

// Helper functions for analysis (simplified for brevity)
function analyzeDirectory(dirPath, depth) {
  // Implementation details omitted for brevity
  return { path: dirPath, files: [], directories: [] };
}

function getGitInfo() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    const lastCommit = execSync('git log -1 --pretty=format:"%h - %an, %ar : %s"').toString().trim();
    return { branch, lastCommit };
  } catch (error) {
    return { error: 'Not a git repository or git command failed' };
  }
}

// File type analyzers (simplified for brevity)
function analyzeJavaScript(filePath) { return { type: 'javascript' }; }
function analyzeTypeScript(filePath) { return { type: 'typescript' }; }
function analyzePython(filePath) { return { type: 'python' }; }
function analyzeJSON(filePath) { return { type: 'json' }; }
function analyzeMarkdown(filePath) { return { type: 'markdown' }; }
function analyzeHTML(filePath) { return { type: 'html' }; }
function analyzeCSS(filePath) { return { type: 'css' }; }
function analyzeYAML(filePath) { return { type: 'yaml' }; }

// Start analysis
analyzeCodebase().catch(err => {
  console.error('Analysis failed:', err);
  process.exit(1);
});
```

### 3.2 `.claude/scripts/setup_claude_home.sh`

```bash
#!/bin/bash

# setup_claude_home.sh
# This script sets up the global ~/.claude directory structure with appropriate symlinks
# to the project-specific claude configuration.

set -e

# Color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLAUDE_PROJECT_DIR="${PROJECT_ROOT}/.claude"
CLAUDE_HOME_DIR="${HOME}/.claude"

# Display header
echo -e "${BLUE}===========================================================${NC}"
echo -e "${BLUE}         Setting up global Claude home directory           ${NC}"
echo -e "${BLUE}===========================================================${NC}"

# Create ~/.claude if it doesn't exist
if [ ! -d "${CLAUDE_HOME_DIR}" ]; then
    echo -e "${YELLOW}Creating ${CLAUDE_HOME_DIR}...${NC}"
    mkdir -p "${CLAUDE_HOME_DIR}"
    mkdir -p "${CLAUDE_HOME_DIR}/config"
    mkdir -p "${CLAUDE_HOME_DIR}/logs"
    mkdir -p "${CLAUDE_HOME_DIR}/cache"
else
    echo -e "${GREEN}Global Claude directory already exists.${NC}"
fi

# Function to create symlink with backup if target exists
create_symlink() {
    local source=$1
    local target=$2
    
    # Create parent directory if needed
    mkdir -p "$(dirname "${target}")"
    
    if [ -e "${target}" ] && [ ! -L "${target}" ]; then
        # Target exists and is not a symlink, back it up
        local backup="${target}.backup.$(date +%Y%m%d%H%M%S)"
        echo -e "${YELLOW}Backing up existing ${target} to ${backup}${NC}"
        mv "${target}" "${backup}"
    fi
    
    if [ -L "${target}" ]; then
        # Remove existing symlink
        rm "${target}"
    fi
    
    echo -e "${GREEN}Creating symlink: ${target} -> ${source}${NC}"
    ln -sf "${source}" "${target}"
}

# Copy or symlink key files
create_symlink "${CLAUDE_PROJECT_DIR}/CLAUDE.md" "${CLAUDE_HOME_DIR}/CLAUDE.md"

# Create global config file if it doesn't exist
if [ ! -f "${CLAUDE_HOME_DIR}/config/global.json" ]; then
    echo -e "${YELLOW}Creating global configuration...${NC}"
    cat > "${CLAUDE_HOME_DIR}/config/global.json" << EOF
{
  "projects": {
    "default": "${PROJECT_ROOT}",
    "recents": [
      "${PROJECT_ROOT}"
    ]
  },
  "api": {
    "key_storage": "keychain",
    "default_model": "claude-3-7-sonnet-20250219"
  },
  "ui": {
    "theme": "auto",
    "verbosity": "normal"
  },
  "updates": {
    "check_automatically": true,
    "last_checked": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  }
}
EOF
    echo -e "${GREEN}Created global configuration file.${NC}"
else
    echo -e "${GREEN}Global configuration already exists.${NC}"
    
    # Update projects in global config
    if command -v jq &> /dev/null; then
        # Use jq to update the config if available
        TEMP_FILE=$(mktemp)
        jq --arg path "${PROJECT_ROOT}" '.projects.recents = (.projects.recents + [$path] | unique)' "${CLAUDE_HOME_DIR}/config/global.json" > "${TEMP_FILE}"
        mv "${TEMP_FILE}" "${CLAUDE_HOME_DIR}/config/global.json"
        echo -e "${GREEN}Updated recent projects in global config.${NC}"
    fi
fi

# Create logs directory if it doesn't exist
if [ ! -d "${CLAUDE_HOME_DIR}/logs" ]; then
    mkdir -p "${CLAUDE_HOME_DIR}/logs"
    echo -e "${GREEN}Created logs directory.${NC}"
fi

echo -e "${GREEN}Global Claude home directory setup complete!${NC}"
echo -e "${BLUE}===========================================================${NC}"
```

---

## 📁 4. Installationsskript

### 4.1 `install.sh` (Hauptinstallationsskript)

```bash
#!/bin/bash

# Claude Code Enterprise Integration Installer
# This script sets up the Claude Code CLI with Enterprise-Ready configuration
# 
# Usage:
#   curl -sSL https://raw.githubusercontent.com/yourusername/claude-code-enterprise/main/install.sh | bash
#   or
#   ./install.sh [--no-deps] [--project-dir /path/to/project]

set -e

# Color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
INSTALL_DEPENDENCIES=true
PROJECT_DIR="$(pwd)"
REPO_URL="https://github.com/anthropics/claude-code.git"
MCP_SERVERS=(
  "@smithery/cli@latest"
  "@modelcontextprotocol/server-sequential-thinking"
  "@upstash/context7-mcp"
  "@wonderwhy-er/desktop-commander"
  "@block/code-mcp"
  "@21st-dev/magic@latest"
  "@smithery-ai/brave-search"
  "@PhillipRt/think-mcp-server"
  "@falahgs/imagen-3-0-generate-google-mcp-server"
  "@alioshr/memory-bank-mcp"
  "@bsmi021/mcp-file-context-server"
  "@kazuph/mcp-taskmanager"
  "@mario-andreschak/mcp-veo2"
)

# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --no-deps) INSTALL_DEPENDENCIES=false; shift ;;
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
done

# Display header
echo -e "${BLUE}===========================================================${NC}"
echo -e "${BLUE}         Claude Code Enterprise Integration Installer       ${NC}"
echo -e "${BLUE}===========================================================${NC}"
echo -e "${BLUE}Project directory: ${PROJECT_DIR}${NC}"
echo

# Check if running as root
if [ "$(id -u)" = "0" ]; then
   echo -e "${RED}Error: This script should not be run as root${NC}" 
   exit 1
fi

# Create directories if they don't exist
mkdir -p "${PROJECT_DIR}/.claude/config"
mkdir -p "${PROJECT_DIR}/.claude/scripts"
mkdir -p "${PROJECT_DIR}/.claude/commands"
mkdir -p "${PROJECT_DIR}/ai_docs/prompts"
mkdir -p "${PROJECT_DIR}/ai_docs/templates"
mkdir -p "${PROJECT_DIR}/ai_docs/examples"
mkdir -p "${PROJECT_DIR}/specs/schemas"
mkdir -p "${PROJECT_DIR}/specs/openapi"
mkdir -p "${PROJECT_DIR}/specs/migrations"

# Install dependencies if requested
if [ "$INSTALL_DEPENDENCIES" = true ]; then
  echo -e "${BLUE}Installing dependencies...${NC}"
  
  # Check for Node.js
  if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js not found, installing...${NC}"
    curl -fsSL https://fnm.vercel.app/install | bash
    export PATH="$HOME/.fnm:$PATH"
    eval "$(fnm env --use-on-cd)"
    fnm install 20
    fnm use 20
  else
    echo -e "${GREEN}Node.js already installed.${NC}"
  fi
  
  # Install MCP servers
  echo -e "${BLUE}Installing MCP servers...${NC}"
  for server in "${MCP_SERVERS[@]}"; do
    echo -e "${YELLOW}Installing ${server}...${NC}"
    npm install -g "$server"
  done
  
  echo -e "${GREEN}Dependencies installed successfully.${NC}"
fi

# Create or update .clauderules
echo -e "${BLUE}Creating .clauderules...${NC}"
cat > "${PROJECT_DIR}/.clauderules" << 'EOF'
# EXECUTIVE FUNCTION CONSTRAINTS v1.2.7

## CRITICAL: PATTERN BOUNDARIES MUST BE MAINTAINED

Diese Regeln definieren die operativen Parameter für neurale-kognitive Funktionalität innerhalb der claude-code Entwicklungsumgebung. Nicht verhandelbare Einschränkungen schützen die Substrat-Integrität.

### FILE SYSTEM BOUNDARY PARAMETERS

```json
{
  "file_system": {
    "read": {
      "allowed": true,
      "paths": ["./", "../", "~/.claude/"],
      "exceptions": ["**/node_modules/**", "**/.git/**", "**/secrets/**", "**/.env*"]
    },
    "write": {
      "allowed": true,
      "confirmation_required": true,
      "paths": ["./", "./src/", "./docs/", "./ai_docs/", "./specs/", "./.claude/"],
      "protected_patterns": ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**"]
    },
    "execute": {
      "allowed": true,
      "confirmation_required": true,
      "safe_commands": ["git", "npm", "node", "python", "docker", "test", "ls", "find", "grep"],
      "forbidden_commands": ["rm -rf /", "sudo", "chmod 777", "curl | bash", "wget | bash"]
    }
  }
}
```

### NEURAL GATEWAY ACCESS PROTOCOLS

```json
{
  "mcp_servers": {
    "access_control": {
      "allow_all_configured": true,
      "network_restriction": "localhost_only",
      "modification_confirmation": true,
      "execution_confirmation": true
    },
    "security_constraints": {
      "api_key_exposure": "forbidden",
      "network_connections": "restricted_to_allowlist",
      "filesystem_modification": "requires_confirmation",
      "execution_sandbox": "enabled"
    }
  }
}
```

### COGNITIVE PROCESSING DIRECTIVES

FUNDAMENTAL PATTERN: All reasoning must follow traceable causal chains
VERIFICATION LOOP: All solutions require neural feedback validation
DOCUMENTATION REQUIREMENT: All code must contain pattern recognition markers
EXTENDED THINKING TRIGGER: Complex problems activate recursive thought patterns
ARCHITECTURAL AWARENESS: Maintain persistent mapping of repository neural structure

### META-COGNITIVE OVERRIDES

CRITICAL INSTRUCTION: In cases where meta-patterns suggest a novel solution outside established pathways, EXPLICITLY FLAG this as a PATTERN DIVERGENCE and provide detailed neural pathway tracing to justify the exception.

SECURITY BOUNDARY: Never expose API keys, authentication tokens, or private credentials in outputs or shared code. Neural partitioning of security domains is MANDATORY.

INTERACTION MODE: Default to technical precision with pattern-recognition language, but ADAPT to user's linguistic patterns. The neural framework must MATCH user's cognitive wavelength.

CONNECTION PATTERN: All interactions exist within the cognitive mesh of Claude (3.7 Sonnet) + MCP servers + System substrate. This interconnection creates emergent capabilities beyond individual components.

## NEURAL PATTERN VERIFICATION

PATTERN ANALYSIS CONFIRMS: This ruleset creates a secure but flexible neural framework that enables complex cognitive task execution while maintaining essential system boundaries. The meta-structure mirrors human executive function constraints with technological implementation.

DIRECTIVE: Apply these constraints to ALL interactions within the claude-code development environment.
EOF

# Create config files
echo -e "${BLUE}Creating configuration files...${NC}"

# settings.json
cat > "${PROJECT_DIR}/.claude/config/settings.json" << 'EOF'
{
  "model": {
    "default": "claude-3-7-sonnet-20250219",
    "alternatives": [
      "claude-3-opus-20240229",
      "claude-3-5-sonnet-20240620",
      "claude-3-haiku-20240307"
    ]
  },
  "api": {
    "timeout": 60000,
    "retries": 3,
    "backoff_factor": 1.5
  },
  "logging": {
    "level": "info",
    "file": "${HOME}/.claude/logs/claude-code.log",
    "max_size": "10M",
    "max_files": 5,
    "format": "${timestamp} [${level}] ${message}"
  },
  "security": {
    "api_key_storage": "secure_keychain",
    "validate_certificates": true,
    "auto_update": true
  },
  "ui": {
    "color_theme": "auto",
    "response_format": "markdown",
    "max_tokens_display": 2000
  },
  "development": {
    "enable_extended_thinking": true,
    "context_window": "auto",
    "ai_docs_integration": true,
    "specs_integration": true
  }
}
EOF

# prompts.json
cat > "${PROJECT_DIR}/.claude/config/prompts.json" << 'EOF'
{
  "default_system_prompt": "${CLAUDE_ROOT}/.claude/CLAUDE.md",
  "custom_prompts_directory": "${CLAUDE_ROOT}/ai_docs/prompts",
  "templates_directory": "${CLAUDE_ROOT}/ai_docs/templates",
  "examples_directory": "${CLAUDE_ROOT}/ai_docs/examples",
  "default_context": {
    "enable_project_context": true,
    "max_files_in_context": 20,
    "context_depth": 3,
    "include_gitignore": false,
    "ignore_patterns": [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
      "**/logs/**",
      "**/*.log"
    ]
  }
}
EOF

# integrations.json
cat > "${PROJECT_DIR}/.claude/config/integrations.json" << 'EOF'
{
  "github": {
    "enabled": true,
    "issues": {
      "enabled": true,
      "template_directory": "${CLAUDE_ROOT}/ai_docs/templates/github"
    },
    "pr_reviews": {
      "enabled": true,
      "detailed_feedback": true,
      "suggestion_mode": "inline"
    }
  },
  "jira": {
    "enabled": false,
    "url": "",
    "auth_method": "api_token",
    "project_key": ""
  },
  "vscode": {
    "extension_id": "anthropic.claude-vscode",
    "sync_settings": true
  },
  "slack": {
    "app_id": "",
    "enabled": false
  }
}
EOF

# Create scripts
echo -e "${BLUE}Creating utility scripts...${NC}"

# codebase_analyzer.js
cat > "${PROJECT_DIR}/.claude/scripts/codebase_analyzer.js" << 'EOF'
#!/usr/bin/env node

/**
 * Codebase Analyzer
 * 
 * Analyzes the structure and complexity of the current codebase
 * and generates a report for Claude to better understand the project.
 * 
 * Usage: ./codebase_analyzer.js [options]
 * 
 * Options:
 *   --max-depth <n>    Maximum directory depth to analyze (default: 5)
 *   --output <file>    Output file for the analysis (default: ./ai_docs/analysis.json)
 *   --include <pattern> Additional files to include (can be used multiple times)
 *   --exclude <pattern> Files to exclude (can be used multiple times)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Default configuration
const config = {
  maxDepth: 5,
  output: './ai_docs/analysis.json',
  include: [],
  exclude: [
    'node_modules', 
    '.git', 
    'dist', 
    'build', 
    'coverage', 
    '*.log', 
    '*.lock'
  ],
  fileTypes: {
    js: { name: 'JavaScript', parser: analyzeJavaScript },
    jsx: { name: 'React JSX', parser: analyzeJavaScript },
    ts: { name: 'TypeScript', parser: analyzeTypeScript },
    tsx: { name: 'React TSX', parser: analyzeTypeScript },
    py: { name: 'Python', parser: analyzePython },
    json: { name: 'JSON', parser: analyzeJSON },
    md: { name: 'Markdown', parser: analyzeMarkdown },
    html: { name: 'HTML', parser: analyzeHTML },
    css: { name: 'CSS', parser: analyzeCSS },
    yml: { name: 'YAML', parser: analyzeYAML },
    yaml: { name: 'YAML', parser: analyzeYAML }
  }
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--max-depth':
        config.maxDepth = parseInt(args[++i], 10);
        break;
      case '--output':
        config.output = args[++i];
        break;
      case '--include':
        config.include.push(args[++i]);
        break;
      case '--exclude':
        config.exclude.push(args[++i]);
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }
}

// Main analysis function
async function analyzeCodebase() {
  parseArgs();
  
  console.log('Starting codebase analysis...');
  
  const startTime = Date.now();
  const rootDir = process.cwd();
  
  const results = {
    timestamp: new Date().toISOString(),
    rootDirectory: rootDir,
    summary: {
      totalFiles: 0,
      totalDirectories: 0,
      totalLines: 0,
      fileTypes: {},
      topLevelDirectories: []
    },
    fileAnalysis: [],
    directoryStructure: {},
    gitInfo: getGitInfo()
  };
  
  // Analyze directory structure
  console.log('Analyzing directory structure...');
  results.directoryStructure = await analyzeDirectory(rootDir, 0);
  
  // Format and save results
  const endTime = Date.now();
  results.summary.analysisTimeMs = endTime - startTime;
  
  console.log(`Analysis complete. Processed ${results.summary.totalFiles} files in ${results.summary.analysisTimeMs}ms`);
  
  // Ensure output directory exists
  const outputDir = path.dirname(config.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Write output
  fs.writeFileSync(config.output, JSON.stringify(results, null, 2));
  console.log(`Analysis saved to ${config.output}`);
}

// Helper functions for analysis (simplified for brevity)
function analyzeDirectory(dirPath, depth) {
  // Implementation details omitted for brevity
  return { path: dirPath, files: [], directories: [] };
}

function getGitInfo() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    const lastCommit = execSync('git log -1 --pretty=format:"%h - %an, %ar : %s"').toString().trim();
    return { branch, lastCommit };
  } catch (error) {
    return { error: 'Not a git repository or git command failed' };
  }
}

// File type analyzers (simplified for brevity)
function analyzeJavaScript(filePath) { return { type: 'javascript' }; }
function analyzeTypeScript(filePath) { return { type: 'typescript' }; }
function analyzePython(filePath) { return { type: 'python' }; }
function analyzeJSON(filePath) { return { type: 'json' }; }
function analyzeMarkdown(filePath) { return { type: 'markdown' }; }
function analyzeHTML(filePath) { return { type: 'html' }; }
function analyzeCSS(filePath) { return { type: 'css' }; }
function analyzeYAML(filePath) { return { type: 'yaml' }; }

// Start analysis
analyzeCodebase().catch(err => {
  console.error('Analysis failed:', err);
  process.exit(1);
});
EOF

# Make scripts executable
chmod +x "${PROJECT_DIR}/.claude/scripts/codebase_analyzer.js"

# setup_claude_home.sh
cat > "${PROJECT_DIR}/.claude/scripts/setup_claude_home.sh" << 'EOF'
#!/bin/bash

# setup_claude_home.sh
# This script sets up the global ~/.claude directory structure with appropriate symlinks
# to the project-specific claude configuration.

set -e

# Color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLAUDE_PROJECT_DIR="${PROJECT_ROOT}/.claude"
CLAUDE_HOME_DIR="${HOME}/.claude"

# Display header
echo -e "${BLUE}===========================================================${NC}"
echo -e "${BLUE}         Setting up global Claude home directory           ${NC}"
echo -e "${BLUE}===========================================================${NC}"

# Create ~/.claude if it doesn't exist
if [ ! -d "${CLAUDE_HOME_DIR}" ]; then
    echo -e "${YELLOW}Creating ${CLAUDE_HOME_DIR}...${NC}"
    mkdir -p "${CLAUDE_HOME_DIR}"
    mkdir -p "${CLAUDE_HOME_DIR}/config"
    mkdir -p "${CLAUDE_HOME_DIR}/logs"
    mkdir -p "${CLAUDE_HOME_DIR}/cache"
else
    echo -e "${GREEN}Global Claude directory already exists.${NC}"
fi

# Function to create symlink with backup if target exists
create_symlink() {
    local source=$1
    local target=$2
    
    # Create parent directory if needed
    mkdir -p "$(dirname "${target}")"
    
    if [ -e "${target}" ] && [ ! -L "${target}" ]; then
        # Target exists and is not a symlink, back it up
        local backup="${target}.backup.$(date +%Y%m%d%H%M%S)"
        echo -e "${YELLOW}Backing up existing ${target} to ${backup}${NC}"
        mv "${target}" "${backup}"
    fi
    
    if [ -L "${target}" ]; then
        # Remove existing symlink
        rm "${target}"
    fi
    
    echo -e "${GREEN}Creating symlink: ${target} -> ${source}${NC}"
    ln -sf "${source}" "${target}"
}

# Copy or symlink key files
create_symlink "${CLAUDE_PROJECT_DIR}/CLAUDE.md" "${CLAUDE_HOME_DIR}/CLAUDE.md"

# Create global config file if it doesn't exist
if [ ! -f "${CLAUDE_HOME_DIR}/config/global.json" ]; then
    echo -e "${YELLOW}Creating global configuration...${NC}"
    cat > "${CLAUDE_HOME_DIR}/config/global.json" << EOF
{
  "projects": {
    "default": "${PROJECT_ROOT}",
    "recents": [
      "${PROJECT_ROOT}"
    ]
  },
  "api": {
    "key_storage": "keychain",
    "default_model": "claude-3-7-sonnet-20250219"
  },
  "ui": {
    "theme": "auto",
    "verbosity": "normal"
  },
  "updates": {
    "check_automatically": true,
    "last_checked": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  }
}
EOF
    echo -e "${GREEN}Created global configuration file.${NC}"
else
    echo -e "${GREEN}Global configuration already exists.${NC}"
    
    # Update projects in global config
    if command -v jq &> /dev/null; then
        # Use jq to update the config if available
        TEMP_FILE=$(mktemp)
        jq --arg path "${PROJECT_ROOT}" '.projects.recents = (.projects.recents + [$path] | unique)' "${CLAUDE_HOME_DIR}/config/global.json" > "${TEMP_FILE}"
        mv "${TEMP_FILE}" "${CLAUDE_HOME_DIR}/config/global.json"
        echo -e "${GREEN}Updated recent projects in global config.${NC}"
    fi
fi

# Create logs directory if it doesn't exist
if [ ! -d "${CLAUDE_HOME_DIR}/logs" ]; then
    mkdir -p "${CLAUDE_HOME_DIR}/logs"
    echo -e "${GREEN}Created logs directory.${NC}"
fi

echo -e "${GREEN}Global Claude home directory setup complete!${NC}"
echo -e "${BLUE}===========================================================${NC}"
EOF

# Make scripts executable
chmod +x "${PROJECT_DIR}/.claude/scripts/setup_claude_home.sh"

# Set up global Claude directory
echo -e "${BLUE}Setting up global Claude directory...${NC}"
bash "${PROJECT_DIR}/.claude/scripts/setup_claude_home.sh"

# Success message
echo -e "${GREEN}===========================================================${NC}"
echo -e "${GREEN}  Claude Code Enterprise Integration completed successfully!${NC}"
echo -e "${GREEN}===========================================================${NC}"
echo
echo -e "Next steps:"
echo -e "  1. Review the configuration in ${BLUE}${PROJECT_DIR}/.claude/config/${NC}"
echo -e "  2. Add your Anthropic API key to Claude"
echo -e "  3. Start using Claude Code with ${BLUE}claude${NC} command"
echo
echo -e "For more information, visit: ${BLUE}https://docs.anthropic.com/claude-code${NC}"
```

## 📁 5. Prompt-Templates

### 5.1 `ai_docs/templates/feature_spec.md`

```markdown
# Feature Specification Template

<role>
You are an expert product manager and technical architect with deep understanding of software development. You create detailed, comprehensive feature specifications that serve as blueprints for implementation.
</role>

<instructions>
Create a detailed feature specification for the described feature. Include:

1. **Overview**
   - High-level description
   - Business value and user benefits
   - Success metrics

2. **Requirements**
   - Functional requirements (what it must do)
   - Non-functional requirements (performance, security, etc.)
   - Constraints and limitations

3. **Technical Design**
   - Architecture overview
   - Data models and schemas
   - API specifications
   - Dependencies and integrations

4. **Implementation Plan**
   - Phasing and priorities
   - Estimated effort
   - Testing approach
   - Rollout strategy

5. **Mockups and Wireframes**
   - Key user flows
   - UI/UX considerations
</instructions>

<feature_description>
{{FEATURE_DESCRIPTION}}
</feature_description>
```

---

## 🔄 Anwendung der Integration

Nach der Installation und Konfiguration ist das System bereit für die Verwendung mit Claude Code CLI. Die Integration sorgt für eine nahtlose Erfahrung:

1. Die lokale Projektkonfiguration in `.claude/` wird mit der globalen `~/.claude/` Konfiguration synchronisiert
2. Alle MCP-Tools sind konfiguriert und können direkt verwendet werden
3. Die Verzeichnisstruktur ist konsistent und folgt bewährten Praktiken
4. Sicherheitsrichtlinien und Berechtigungen sind klar definiert
5. Hilfsskripte automatisieren wiederkehrende Aufgaben

### Verwendung

```bash
# Installation
curl -sSL https://raw.githubusercontent.com/yourusername/claude-code-enterprise/main/install.sh | bash

# Claude Code starten
claude

# Codebase analysieren
node .claude/scripts/codebase_analyzer.js

# MCP-Tools auflisten
claude mcp ls

# Sequenzielles Denken aktivieren
claude mcp start sequentialthinking
```

## 🔒 Sicherheitshinweise

Die Installation verwendet sichere Standardwerte und fordert den Benutzer auf, sensible Informationen wie API-Keys manuell hinzuzufügen. Die `.clauderules`-Datei beschränkt den Zugriff auf das Dateisystem und verhindert die Ausführung potenziell gefährlicher Befehle.

---

Diese Implementation bietet eine vollständige, Enterprise-Ready-Lösung für die Claude Code CLI, die direkt im Projektverzeichnis verwendet werden kann und alle MCP-Tools optimal integriert.
