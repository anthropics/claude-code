#!/bin/bash

# SAAR.sh - Setup, Activate, Apply, Run
# Unified Agentic OS for Claude Neural Framework
# Version: 2.0.0

# Strict error handling
set -e
set -o pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
CONFIG_DIR="$HOME/.claude"
WORKSPACE_DIR="$(pwd)"
STORAGE_DIR="$CONFIG_DIR/storage"
MEMORY_FILE="$STORAGE_DIR/agentic-os-memory.json"
THEME_FILE="$CONFIG_DIR/theme.json"
DEFAULT_USER="claudeuser"
LOG_FILE="$CONFIG_DIR/saar.log"

# Banner function
show_banner() {
  echo -e "${PURPLE}${BOLD}"
  echo "  █████╗  ██████╗ ███████╗███╗   ██╗████████╗██╗ ██████╗     ██████╗ ███████╗"
  echo " ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝██║██╔════╝    ██╔═══██╗██╔════╝"
  echo " ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ██║██║         ██║   ██║███████╗"
  echo " ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ██║██║         ██║   ██║╚════██║"
  echo " ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ██║╚██████╗    ╚██████╔╝███████║"
  echo " ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝ ╚═════╝     ╚═════╝ ╚══════╝"                                                           
  echo -e "${NC}"
  echo -e "${CYAN}${BOLD}Claude Neural Framework - ONE Agentic OS${NC}"
  echo -e "${BLUE}SAAR - Setup, Activate, Apply, Run${NC}"
  echo "Version: 2.0.0"
  echo
}

# Log function
log() {
  local level=$1
  local message=$2
  
  # Create log directory if it doesn't exist
  mkdir -p "$(dirname "$LOG_FILE")"
  
  # Get timestamp
  local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  
  # Log to file
  echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
  
  # Also print to console if not in quiet mode
  if [ "$QUIET_MODE" != "true" ]; then
    case $level in
      INFO)
        echo -e "${GREEN}[INFO]${NC} $message"
        ;;
      WARN)
        echo -e "${YELLOW}[WARN]${NC} $message"
        ;;
      ERROR)
        echo -e "${RED}[ERROR]${NC} $message"
        ;;
      DEBUG)
        if [ "$DEBUG_MODE" = "true" ]; then
          echo -e "${BLUE}[DEBUG]${NC} $message"
        fi
        ;;
      *)
        echo -e "$message"
        ;;
    esac
  fi
}

# Help function
show_help() {
  echo -e "${BOLD}Usage:${NC} ./saar.sh [command] [options]"
  echo ""
  echo -e "${BOLD}Commands:${NC}"
  echo "  setup       Full setup of the Agentic OS"
  echo "  about       Configure .about profile"
  echo "  colors      Configure color schema"
  echo "  project     Set up a new project"
  echo "  memory      Manage memory system"
  echo "  start       Start MCP servers and services"
  echo "  agent       Launch Claude agent"
  echo "  ui          Configure UI components"
  echo "  status      Show system status"
  echo "  help        Show this help message"
  echo ""
  echo -e "${BOLD}Options:${NC}"
  echo "  --quick     Quick setup with defaults"
  echo "  --force     Force overwrite existing configuration"
  echo "  --theme=X   Set specific theme (light, dark, blue, green, purple)"
  echo "  --user=X    Set user ID for operations"
  echo "  --debug     Enable debug logging"
  echo "  --quiet     Suppress console output"
  echo ""
  echo -e "${BOLD}Examples:${NC}"
  echo "  ./saar.sh setup                 # Full interactive setup"
  echo "  ./saar.sh setup --quick         # Quick setup with defaults"
  echo "  ./saar.sh colors --theme=dark   # Set dark theme"
  echo "  ./saar.sh memory backup         # Backup memory"
  echo "  ./saar.sh status                # Show system status"
  echo "  ./saar.sh ui customize          # Customize UI components"
  echo ""
}

# Check dependencies
check_dependencies() {
  log "INFO" "Checking system dependencies"
  
  local missing=0
  local deps=("node" "npm" "python3" "git")
  
  for cmd in "${deps[@]}"; do
    if ! command -v "$cmd" &> /dev/null; then
      log "ERROR" "$cmd not found"
      missing=$((missing+1))
    else
      local version=""
      case $cmd in
        node)
          version=$(node -v)
          ;;
        npm)
          version=$(npm -v)
          ;;
        python3)
          version=$(python3 --version)
          ;;
        git)
          version=$(git --version)
          ;;
      esac
      log "DEBUG" "Found $cmd: $version"
    fi
  done
  
  if [ $missing -gt 0 ]; then
    log "ERROR" "Missing $missing dependencies. Please install required dependencies."
    exit 1
  fi
  
  # Check Node.js version
  local node_version=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
  if [ "$node_version" -lt 16 ]; then
    log "WARN" "Node.js version $node_version detected. Version 16+ is recommended."
  fi
  
  # Check npm version
  local npm_version=$(npm -v | cut -d '.' -f 1)
  if [ "$npm_version" -lt 7 ]; then
    log "WARN" "npm version $npm_version detected. Version 7+ is recommended."
  }
  
  log "INFO" "All dependencies satisfied"
}

# Ensure directories
ensure_directories() {
  # Create necessary directories
  log "DEBUG" "Creating directory structure"
  
  mkdir -p "$CONFIG_DIR"
  mkdir -p "$STORAGE_DIR"
  mkdir -p "$CONFIG_DIR/backups"
  mkdir -p "$CONFIG_DIR/profiles"
  
  # Create .claude directory in workspace if it doesn't exist
  if [ ! -d "$WORKSPACE_DIR/.claude" ]; then
    mkdir -p "$WORKSPACE_DIR/.claude"
  fi
  
  log "DEBUG" "Directory structure created"
}

# Setup function - main setup process
do_setup() {
  local quick_mode=false
  local force_mode=false
  local theme="dark"
  local user_id="$DEFAULT_USER"
  
  # Parse options
  for arg in "$@"; do
    case $arg in
      --quick)
        quick_mode=true
        shift
        ;;
      --force)
        force_mode=true
        shift
        ;;
      --theme=*)
        theme="${arg#*=}"
        shift
        ;;
      --user=*)
        user_id="${arg#*=}"
        shift
        ;;
    esac
  done
  
  show_banner
  check_dependencies
  ensure_directories
  
  log "INFO" "Setting up Agentic OS"
  
  # Install required NPM packages
  log "INFO" "Installing required packages"
  if [ "$quick_mode" = true ]; then
    npm install --quiet
  else
    npm install
  fi
  
  # Configure API keys
  if [ "$quick_mode" = false ]; then
    log "INFO" "API Key Configuration"
    read -p "Enter your Anthropic API Key (leave blank to skip): " anthropic_key
    
    if [ ! -z "$anthropic_key" ]; then
      echo -e "{\n  \"api_key\": \"$anthropic_key\"\n}" > "$CONFIG_DIR/api_keys.json"
      log "INFO" "API key saved to $CONFIG_DIR/api_keys.json"
    else
      log "WARN" "Skipped API key configuration"
    fi
  fi
  
  # Setup Schema UI integration
  if [ -d "schema-ui-integration" ]; then
    log "INFO" "Setting up Schema UI"
    chmod +x schema-ui-integration/saar.sh
    ./schema-ui-integration/saar.sh setup --quick --theme="$theme" --user="$user_id"
  else
    log "WARN" "Schema UI integration not found. Skipping setup."
  }
  
  # Setup color schema
  if [ "$quick_mode" = true ]; then
    log "INFO" "Setting up default color schema ($theme)"
    node core/mcp/color_schema_manager.js --template="$theme" --non-interactive > /dev/null
  else
    log "INFO" "Setting up color schema"
    node scripts/setup/setup_user_colorschema.js
  fi
  
  # Setup about profile
  if [ "$quick_mode" = true ]; then
    log "INFO" "Creating default .about profile"
    
    # Create a minimal default profile
    cat > "$CONFIG_DIR/profiles/$user_id.about.json" << EOF
{
  "userId": "$user_id",
  "personal": {
    "name": "Default User",
    "skills": ["JavaScript", "Python", "AI"]
  },
  "goals": {
    "shortTerm": ["Setup Agentic OS"],
    "longTerm": ["Build advanced AI agents"]
  },
  "preferences": {
    "uiTheme": "$theme",
    "language": "en",
    "colorScheme": {
      "primary": "#3f51b5",
      "secondary": "#7986cb",
      "accent": "#ff4081"
    }
  },
  "agentSettings": {
    "isActive": true,
    "capabilities": ["Code Analysis", "Document Summarization"],
    "debugPreferences": {
      "strategy": "bottom-up",
      "detailLevel": "medium",
      "autoFix": true
    }
  }
}
EOF
    
    log "INFO" "Default .about profile created"
  else
    log "INFO" "Setting up .about profile"
    node scripts/setup/create_about.js
  fi
  
  # Setup MCP servers
  log "INFO" "Configuring MCP servers"
  if [ -f "core/mcp/setup_mcp.js" ]; then
    node core/mcp/setup_mcp.js
  fi
  
  # Initialize memory system
  log "INFO" "Initializing memory system"
  do_memory init
  
  # Create project directories if needed
  log "INFO" "Setting up workspace structure"
  mkdir -p "$WORKSPACE_DIR/projects"
  
  # Setup workspace config
  log "INFO" "Creating workspace configuration"
  echo "{\"workspaceVersion\": \"2.0.0\", \"setupCompleted\": true, \"lastUpdate\": \"$(date '+%Y-%m-%d')\"}" > "$WORKSPACE_DIR/.claude/workspace.json"
  
  # Create system record in memory
  echo "{\"systemId\": \"agentic-os-$(date +%s)\", \"setupDate\": \"$(date '+%Y-%m-%d')\", \"setupMode\": \"$([[ "$quick_mode" == true ]] && echo 'quick' || echo 'interactive')\"}" > "$STORAGE_DIR/system-info.json"
  
  log "INFO" "Setup complete"
  echo -e "${GREEN}${BOLD}Agentic OS setup complete!${NC}"
  echo -e "${CYAN}Your system is ready to use.${NC}"
  echo ""
  echo -e "To start all services:    ${BOLD}./saar.sh start${NC}"
  echo -e "To configure a project:   ${BOLD}./saar.sh project${NC}"
  echo -e "To launch Claude agent:   ${BOLD}./saar.sh agent${NC}"
  echo -e "To check system status:   ${BOLD}./saar.sh status${NC}"
  echo ""
}

# About profile function
do_about() {
  local user_id="$DEFAULT_USER"
  
  # Parse options
  for arg in "$@"; do
    case $arg in
      --user=*)
        user_id="${arg#*=}"
        shift
        ;;
    esac
  done
  
  check_dependencies
  ensure_directories
  
  log "INFO" "Configuring .about profile for user $user_id"
  
  # Check if we have the create_about.js script
  if [ -f "scripts/setup/create_about.js" ]; then
    node scripts/setup/create_about.js --user="$user_id"
  else
    # Fallback to using schema-ui-integration if available
    if [ -d "schema-ui-integration" ]; then
      log "INFO" "Using Schema UI for profile configuration"
      chmod +x schema-ui-integration/saar.sh
      ./schema-ui-integration/saar.sh setup --user="$user_id"
    else
      log "ERROR" "No profile configuration tools found"
      exit 1
    fi
  fi
  
  log "INFO" "Profile configuration complete"
}

# Color schema function
do_colors() {
  local theme="dark"
  local apply=true
  
  # Parse options
  for arg in "$@"; do
    case $arg in
      --theme=*)
        theme="${arg#*=}"
        shift
        ;;
      --no-apply)
        apply=false
        shift
        ;;
    esac
  done
  
  check_dependencies
  ensure_directories
  
  log "INFO" "Configuring color schema"
  
  # Update color schema using color_schema_manager
  if [ -f "core/mcp/color_schema_manager.js" ]; then
    if [ "$theme" != "custom" ]; then
      log "INFO" "Setting theme to $theme"
      node core/mcp/color_schema_manager.js --template="$theme" --apply=$apply
    else
      log "INFO" "Starting interactive color schema configuration"
      node scripts/setup/setup_user_colorschema.js
    fi
  fi
  
  # Update Schema UI theme if available
  if [ -d "schema-ui-integration" ]; then
    log "INFO" "Updating Schema UI theme to $theme"
    chmod +x schema-ui-integration/saar.sh
    ./schema-ui-integration/saar.sh apply --theme="$theme"
  fi
  
  # Save theme to system memory
  echo "{\"activeTheme\": \"$theme\", \"lastUpdated\": \"$(date '+%Y-%m-%d')\"}" > "$STORAGE_DIR/theme-info.json"
  
  log "INFO" "Color schema configuration complete"
}

# Project setup function
do_project() {
  local template=""
  local project_name=""
  
  # Parse options
  for arg in "$@"; do
    case $arg in
      --template=*)
        template="${arg#*=}"
        shift
        ;;
      --name=*)
        project_name="${arg#*=}"
        shift
        ;;
    esac
  done
  
  check_dependencies
  ensure_directories
  
  log "INFO" "Setting up a new project"
  
  # Use setup_project.js if available
  if [ -f "scripts/setup/setup_project.js" ]; then
    if [ -z "$template" ]; then
      node scripts/setup/setup_project.js ${project_name:+--name="$project_name"}
    else
      node scripts/setup/setup_project.js --template="$template" ${project_name:+--name="$project_name"}
    fi
  else
    # Manual project setup
    if [ -z "$project_name" ]; then
      read -p "Enter project name: " project_name
    fi
    
    log "INFO" "Creating project: $project_name"
    mkdir -p "$WORKSPACE_DIR/projects/$project_name"
    
    # Create basic project structure
    mkdir -p "$WORKSPACE_DIR/projects/$project_name/src"
    mkdir -p "$WORKSPACE_DIR/projects/$project_name/docs"
    mkdir -p "$WORKSPACE_DIR/projects/$project_name/tests"
    
    # Create package.json
    cat > "$WORKSPACE_DIR/projects/$project_name/package.json" << EOF
{
  "name": "$project_name",
  "version": "0.1.0",
  "description": "Project created with Claude Agentic OS",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}
EOF
    
    # Create README.md
    cat > "$WORKSPACE_DIR/projects/$project_name/README.md" << EOF
# $project_name

Project created with Claude Agentic OS.

## Getting Started

\`\`\`
npm install
npm start
\`\`\`
EOF
    
    log "INFO" "Project created successfully"
  fi
  
  log "INFO" "Project setup complete"
}

# Memory management function
do_memory() {
  local operation=${1:-"status"}
  local target=${2:-"all"}
  
  check_dependencies
  ensure_directories
  
  log "INFO" "Memory system operation: $operation for $target"
  
  case $operation in
    init)
      # Initialize memory system
      log "INFO" "Initializing memory system"
      mkdir -p "$STORAGE_DIR"
      
      # Create memory file if it doesn't exist
      if [ ! -f "$MEMORY_FILE" ]; then
        echo "{}" > "$MEMORY_FILE"
        log "INFO" "Memory file created: $MEMORY_FILE"
      fi
      ;;
      
    backup)
      # Backup memory
      log "INFO" "Backing up memory system"
      local backup_file="$CONFIG_DIR/backups/memory-backup-$(date +%Y%m%d-%H%M%S).json"
      
      # Create backup directory if it doesn't exist
      mkdir -p "$CONFIG_DIR/backups"
      
      # Copy memory files
      if [ "$target" = "all" ] || [ "$target" = "memory" ]; then
        if [ -f "$MEMORY_FILE" ]; then
          cp "$MEMORY_FILE" "$backup_file"
          log "INFO" "Memory backed up to: $backup_file"
        fi
      fi
      
      # Copy profiles
      if [ "$target" = "all" ] || [ "$target" = "profiles" ]; then
        local profile_backup="$CONFIG_DIR/backups/profiles-backup-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$profile_backup"
        
        if [ -d "$CONFIG_DIR/profiles" ]; then
          cp -r "$CONFIG_DIR/profiles/"* "$profile_backup/"
          log "INFO" "Profiles backed up to: $profile_backup"
        fi
      }
      
      # Create backup manifest
      echo "{\"date\": \"$(date '+%Y-%m-%d %H:%M:%S')\", \"files\": [\"$backup_file\"]}" > "$CONFIG_DIR/backups/backup-manifest-$(date +%Y%m%d-%H%M%S).json"
      
      log "INFO" "Backup completed"
      ;;
      
    restore)
      # Restore memory from backup
      log "INFO" "Restoring memory system"
      
      if [ -z "$2" ]; then
        # List available backups
        log "INFO" "Available backups:"
        ls -lt "$CONFIG_DIR/backups" | grep "memory-backup-" | head -n 5
        echo ""
        read -p "Enter backup filename to restore (or 'latest' for most recent): " backup_name
        
        if [ "$backup_name" = "latest" ]; then
          backup_name=$(ls -t "$CONFIG_DIR/backups" | grep "memory-backup-" | head -n 1)
        fi
      else
        backup_name="$2"
      fi
      
      if [ -f "$CONFIG_DIR/backups/$backup_name" ]; then
        # Backup current state before restoring
        cp "$MEMORY_FILE" "$MEMORY_FILE.bak"
        
        # Restore from backup
        cp "$CONFIG_DIR/backups/$backup_name" "$MEMORY_FILE"
        log "INFO" "Memory restored from: $backup_name"
      else
        log "ERROR" "Backup file not found: $backup_name"
        exit 1
      fi
      ;;
      
    clear)
      # Clear memory
      log "WARN" "Clearing memory system"
      
      read -p "Are you sure you want to clear memory? This cannot be undone. (y/N): " confirm
      if [[ "$confirm" =~ ^[Yy]$ ]]; then
        # Backup before clearing
        do_memory backup all
        
        # Clear memory file
        echo "{}" > "$MEMORY_FILE"
        log "INFO" "Memory cleared"
      else
        log "INFO" "Memory clear canceled"
      fi
      ;;
      
    status)
      # Show memory status
      log "INFO" "Memory system status"
      
      echo -e "${BOLD}Memory System Status:${NC}"
      
      if [ -f "$MEMORY_FILE" ]; then
        local memory_size=$(stat -c%s "$MEMORY_FILE" 2>/dev/null || stat -f%z "$MEMORY_FILE")
        local memory_date=$(stat -c%y "$MEMORY_FILE" 2>/dev/null || stat -f%m "$MEMORY_FILE")
        
        echo -e "Memory file: ${GREEN}Found${NC}"
        echo -e "Size: ${memory_size} bytes"
        echo -e "Last modified: ${memory_date}"
        
        # Count items in JSON
        if command -v jq &> /dev/null; then
          local profile_count=$(jq '.profiles | length' "$MEMORY_FILE" 2>/dev/null || echo "Unknown")
          local theme_count=$(jq '.themes | length' "$MEMORY_FILE" 2>/dev/null || echo "Unknown")
          
          echo -e "Profiles: ${profile_count}"
          echo -e "Themes: ${theme_count}"
        else
          echo -e "Detailed status unavailable (jq not installed)"
        fi
      else
        echo -e "Memory file: ${RED}Not found${NC}"
      fi
      
      # Check backup status
      if [ -d "$CONFIG_DIR/backups" ]; then
        local backup_count=$(ls -1 "$CONFIG_DIR/backups" | grep "memory-backup-" | wc -l)
        local latest_backup=$(ls -t "$CONFIG_DIR/backups" | grep "memory-backup-" | head -n 1)
        
        echo -e "${BOLD}Backups:${NC}"
        echo -e "Total backups: ${backup_count}"
        echo -e "Latest backup: ${latest_backup:-None}"
      else
        echo -e "${BOLD}Backups:${NC} None found"
      fi
      ;;
      
    *)
      log "ERROR" "Unknown memory operation: $operation"
      echo -e "Available operations: init, backup, restore, clear, status"
      exit 1
      ;;
  esac
}

# Start services function
do_start() {
  local components=${1:-"all"}
  
  check_dependencies
  ensure_directories
  
  log "INFO" "Starting Agentic OS services: $components"
  
  # Start MCP servers if available
  if [ "$components" = "all" ] || [ "$components" = "mcp" ]; then
    if [ -f "core/mcp/start_server.js" ]; then
      log "INFO" "Starting MCP servers"
      node core/mcp/start_server.js
    fi
  fi
  
  # Start web dashboard if available
  if [ "$components" = "all" ] || [ "$components" = "dashboard" ]; then
    if [ -f "scripts/dashboard/server.js" ]; then
      log "INFO" "Starting web dashboard"
      node scripts/dashboard/server.js &
    fi
  fi
  
  # Start Schema UI if available
  if [ "$components" = "all" ] || [ "$components" = "ui" ]; then
    if [ -d "schema-ui-integration" ]; then
      log "INFO" "Starting Schema UI components"
      chmod +x schema-ui-integration/saar.sh
      ./schema-ui-integration/saar.sh run
    fi
  fi
  
  log "INFO" "Services started"
}

# Agent function
do_agent() {
  local mode=${1:-"interactive"}
  
  check_dependencies
  ensure_directories
  
  log "INFO" "Launching Claude agent in $mode mode"
  
  # Check if npx claude is available
  if command -v npx &> /dev/null; then
    if [ "$mode" = "interactive" ]; then
      npx claude
    else
      npx claude --mode="$mode"
    fi
  else
    log "ERROR" "npx not found. Cannot launch Claude agent."
    exit 1
  fi
}

# UI configuration function
do_ui() {
  local operation=${1:-"status"}
  local theme="dark"
  
  # Parse options
  for arg in "$@"; do
    case $arg in
      --theme=*)
        theme="${arg#*=}"
        shift
        ;;
    esac
  done
  
  check_dependencies
  ensure_directories
  
  log "INFO" "UI operation: $operation"
  
  # Check if Schema UI is available
  if [ ! -d "schema-ui-integration" ]; then
    log "ERROR" "Schema UI not found. Attempting to download..."
    
    if git clone https://github.com/claude-framework/schema-ui.git schema-ui-integration; then
      log "INFO" "Schema UI downloaded successfully"
      chmod +x schema-ui-integration/saar.sh
    else
      log "ERROR" "Failed to download Schema UI"
      exit 1
    fi
  fi
  
  # Make script executable
  chmod +x schema-ui-integration/saar.sh
  
  # Execute Schema UI command
  case $operation in
    status)
      log "INFO" "Checking UI status"
      ./schema-ui-integration/saar.sh help
      ;;
      
    setup)
      log "INFO" "Setting up UI components"
      ./schema-ui-integration/saar.sh setup --theme="$theme"
      ;;
      
    customize)
      log "INFO" "Customizing UI components"
      ./schema-ui-integration/saar.sh all --theme="$theme"
      ;;
      
    run)
      log "INFO" "Running UI components"
      ./schema-ui-integration/saar.sh run
      ;;
      
    *)
      log "ERROR" "Unknown UI operation: $operation"
      echo -e "Available operations: status, setup, customize, run"
      exit 1
      ;;
  esac
}

# Status function
do_status() {
  check_dependencies
  ensure_directories
  
  show_banner
  
  log "INFO" "Checking system status"
  
  echo -e "${BOLD}AGENTIC OS STATUS${NC}"
  echo -e "======================"
  echo ""
  
  # Check workspace
  echo -e "${BOLD}Workspace:${NC}"
  if [ -f "$WORKSPACE_DIR/.claude/workspace.json" ]; then
    local workspace_version=$(grep -o '"workspaceVersion": "[^"]*' "$WORKSPACE_DIR/.claude/workspace.json" | cut -d'"' -f4)
    local setup_completed=$(grep -o '"setupCompleted": [^,]*' "$WORKSPACE_DIR/.claude/workspace.json" | cut -d' ' -f2)
    
    echo -e "Version: ${workspace_version:-Unknown}"
    echo -e "Setup complete: ${setup_completed:-false}"
  else
    echo -e "Status: ${YELLOW}Not initialized${NC}"
  fi
  echo ""
  
  # Check MCP servers
  echo -e "${BOLD}MCP Servers:${NC}"
  if [ -f "core/mcp/server_config.json" ]; then
    if command -v jq &> /dev/null; then
      local server_count=$(jq '.servers | length' "core/mcp/server_config.json" 2>/dev/null || echo "Unknown")
      echo -e "Configured servers: ${server_count}"
      
      # List a few servers
      jq -r '.servers | keys | .[]' "core/mcp/server_config.json" 2>/dev/null | head -n 5 | while read -r server; do
        echo -e "- $server"
      done
    else
      echo -e "Configuration: ${GREEN}Found${NC}"
    fi
  else
    echo -e "Status: ${YELLOW}Not configured${NC}"
  fi
  
  # Check if any MCP servers are running
  if command -v ps &> /dev/null && command -v grep &> /dev/null; then
    local running_servers=$(ps aux | grep -c "[n]ode.*mcp")
    if [ "$running_servers" -gt 0 ]; then
      echo -e "Running servers: ${GREEN}$running_servers${NC}"
    else
      echo -e "Running servers: ${YELLOW}None${NC}"
    fi
  fi
  echo ""
  
  # Check memory system
  echo -e "${BOLD}Memory System:${NC}"
  if [ -f "$MEMORY_FILE" ]; then
    local memory_size=$(stat -c%s "$MEMORY_FILE" 2>/dev/null || stat -f%z "$MEMORY_FILE")
    echo -e "Status: ${GREEN}Active${NC}"
    echo -e "Size: ${memory_size} bytes"
  else
    echo -e "Status: ${YELLOW}Not initialized${NC}"
  fi
  echo ""
  
  # Check Schema UI
  echo -e "${BOLD}Schema UI:${NC}"
  if [ -d "schema-ui-integration" ]; then
    echo -e "Status: ${GREEN}Installed${NC}"
    
    if [ -f "schema-ui-integration/package.json" ]; then
      local ui_version=$(grep -o '"version": "[^"]*' "schema-ui-integration/package.json" | cut -d'"' -f4)
      echo -e "Version: ${ui_version:-Unknown}"
    fi
  else
    echo -e "Status: ${YELLOW}Not installed${NC}"
  fi
  echo ""
  
  # Check API keys
  echo -e "${BOLD}API Keys:${NC}"
  if [ -f "$CONFIG_DIR/api_keys.json" ]; then
    echo -e "Anthropic API key: ${GREEN}Configured${NC}"
  else
    echo -e "Anthropic API key: ${YELLOW}Not configured${NC}"
  fi
  echo ""
  
  # Check .about profile
  echo -e "${BOLD}User Profiles:${NC}"
  if [ -d "$CONFIG_DIR/profiles" ]; then
    local profile_count=$(ls -1 "$CONFIG_DIR/profiles" | grep ".about.json" | wc -l)
    echo -e "Available profiles: ${profile_count}"
    
    # List a few profiles
    ls -1 "$CONFIG_DIR/profiles" | grep ".about.json" | head -n 3 | while read -r profile; do
      echo -e "- ${profile%.about.json}"
    done
    
    if [ "$profile_count" -gt 3 ]; then
      echo -e "... and $((profile_count-3)) more"
    fi
  else
    echo -e "Status: ${YELLOW}No profiles found${NC}"
  fi
  echo ""
  
  # Check Node.js and npm versions
  echo -e "${BOLD}Environment:${NC}"
  echo -e "Node.js: $(node -v)"
  echo -e "npm: $(npm -v)"
  echo -e "OS: $(uname -s) $(uname -r)"
  echo ""
  
  log "INFO" "Status check complete"
}

# Main function
main() {
  # Global flags
  export DEBUG_MODE=false
  export QUIET_MODE=false
  
  # Process global options first
  for arg in "$@"; do
    case $arg in
      --debug)
        export DEBUG_MODE=true
        log "DEBUG" "Debug mode enabled"
        shift
        ;;
      --quiet)
        export QUIET_MODE=true
        shift
        ;;
    esac
  done
  
  if [ $# -eq 0 ]; then
    show_banner
    show_help
    exit 0
  fi
  
  # Command parser
  case "$1" in
    setup)
      shift
      do_setup "$@"
      ;;
    about)
      shift
      do_about "$@"
      ;;
    colors)
      shift
      do_colors "$@"
      ;;
    project)
      shift
      do_project "$@"
      ;;
    memory)
      shift
      do_memory "$@"
      ;;
    start)
      shift
      do_start "$@"
      ;;
    agent)
      shift
      do_agent "$@"
      ;;
    ui)
      shift
      do_ui "$@"
      ;;
    status)
      shift
      do_status "$@"
      ;;
    help|--help|-h)
      show_banner
      show_help
      ;;
    *)
      log "ERROR" "Unknown command: $1"
      show_help
      exit 1
      ;;
  esac
}

# Execute main function
main "$@"