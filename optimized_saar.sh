#!/usr/bin/env bash

# =====================================================================
# SAAR.sh - Setup, Activate, Apply, Run
# Unified Agentic OS for Claude Neural Framework
# Version: 2.0.0
# =====================================================================

# Strict error handling
set -e
set -o pipefail

# =====================================================================
# Configuration Variables
# =====================================================================

# Colors for output
readonly RESET='\033[0m'
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'

# System paths
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly CONFIG_DIR="${HOME}/.claude"
readonly WORKSPACE_DIR="$(pwd)"
readonly STORAGE_DIR="${CONFIG_DIR}/storage"
readonly MEMORY_FILE="${STORAGE_DIR}/agentic-os-memory.json"
readonly THEME_FILE="${CONFIG_DIR}/theme.json"
readonly LOG_FILE="${CONFIG_DIR}/saar.log"

# Default values
readonly DEFAULT_USER="claudeuser"
readonly DEFAULT_THEME="dark"
readonly DEFAULT_NODE_VERSION="20"
readonly DEFAULT_LOG_LEVEL="info"
readonly VERSION="2.0.0"

# Global flags (set by command line arguments)
DEBUG_MODE="false"
QUIET_MODE="false"
FORCE_MODE="false"

# =====================================================================
# Logging System
# =====================================================================

# Initialize log directory
function init_log_dir() {
  mkdir -p "$(dirname "${LOG_FILE}")"
}

# Log a message with timestamp and level
# Usage: log <level> <message>
function log() {
  local level="$1"
  local message="$2"
  local timestamp
  timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  
  # Ensure log directory exists
  init_log_dir
  
  # Write to log file
  echo "[${timestamp}] [${level}] ${message}" >> "${LOG_FILE}"
  
  # Only print to console if not in quiet mode
  if [[ "${QUIET_MODE}" != "true" ]]; then
    case ${level} in
      INFO)
        echo -e "${GREEN}[INFO]${RESET} ${message}"
        ;;
      WARN)
        echo -e "${YELLOW}[WARN]${RESET} ${message}"
        ;;
      ERROR)
        echo -e "${RED}[ERROR]${RESET} ${message}" >&2
        ;;
      DEBUG)
        if [[ "${DEBUG_MODE}" = "true" ]]; then
          echo -e "${BLUE}[DEBUG]${RESET} ${message}"
        fi
        ;;
      *)
        echo -e "${message}"
        ;;
    esac
  fi
}

# =====================================================================
# Display Functions
# =====================================================================

# Show SAAR banner
function show_banner() {
  echo -e "${PURPLE}${BOLD}"
  echo "  █████╗  ██████╗ ███████╗███╗   ██╗████████╗██╗ ██████╗     ██████╗ ███████╗"
  echo " ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝██║██╔════╝    ██╔═══██╗██╔════╝"
  echo " ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ██║██║         ██║   ██║███████╗"
  echo " ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ██║██║         ██║   ██║╚════██║"
  echo " ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ██║╚██████╗    ╚██████╔╝███████║"
  echo " ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝ ╚═════╝     ╚═════╝ ╚══════╝"                                                           
  echo -e "${RESET}"
  echo -e "${CYAN}${BOLD}Claude Neural Framework - ONE Agentic OS${RESET}"
  echo -e "${BLUE}SAAR - Setup, Activate, Apply, Run${RESET}"
  echo "Version: ${VERSION}"
  echo
}

# Show help message
function show_help() {
  echo -e "${BOLD}Usage:${RESET} ./saar.sh [command] [options]"
  echo ""
  echo -e "${BOLD}Commands:${RESET}"
  echo "  setup       Full setup of the Agentic OS"
  echo "  about       Configure .about profile"
  echo "  colors      Configure color schema"
  echo "  project     Set up a new project"
  echo "  memory      Manage memory system"
  echo "  start       Start MCP servers and services"
  echo "  agent       Launch Claude agent"
  echo "  ui          Configure UI components"
  echo "  status      Show system status"
  echo "  enterprise  Manage enterprise features"
  echo "  help        Show this help message"
  echo ""
  echo -e "${BOLD}Options:${RESET}"
  echo "  --quick     Quick setup with defaults"
  echo "  --force     Force overwrite existing configuration"
  echo "  --theme=X   Set specific theme (light, dark, blue, green, purple)"
  echo "  --user=X    Set user ID for operations"
  echo "  --debug     Enable debug logging"
  echo "  --quiet     Suppress console output"
  echo ""
  echo -e "${BOLD}Examples:${RESET}"
  echo "  ./saar.sh setup                       # Full interactive setup"
  echo "  ./saar.sh setup --quick               # Quick setup with defaults"
  echo "  ./saar.sh colors --theme=dark         # Set dark theme"
  echo "  ./saar.sh project --name=myproject    # Create a new project"
  echo "  ./saar.sh memory backup               # Backup memory"
  echo "  ./saar.sh status                      # Show system status"
  echo ""
}

# =====================================================================
# Utility Functions
# =====================================================================

# Check if a command exists
# Usage: command_exists <command>
function command_exists() {
  command -v "$1" &> /dev/null
}

# Ensure directories exist
function ensure_directories() {
  log "DEBUG" "Creating directory structure"
  
  # Create necessary directories
  mkdir -p "${CONFIG_DIR}"
  mkdir -p "${STORAGE_DIR}"
  mkdir -p "${CONFIG_DIR}/backups"
  mkdir -p "${CONFIG_DIR}/profiles"
  
  # Create .claude directory in workspace if it doesn't exist
  if [[ ! -d "${WORKSPACE_DIR}/.claude" ]]; then
    mkdir -p "${WORKSPACE_DIR}/.claude"
  fi
  
  log "DEBUG" "Directory structure created"
}

# Check for required dependencies
function check_dependencies() {
  log "INFO" "Checking system dependencies"
  
  local missing=0
  local deps=("node" "npm" "python3" "git")
  
  for cmd in "${deps[@]}"; do
    if ! command_exists "${cmd}"; then
      log "ERROR" "${cmd} not found"
      missing=$((missing+1))
    else
      local version=""
      case ${cmd} in
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
      log "DEBUG" "Found ${cmd}: ${version}"
    fi
  done
  
  if [[ ${missing} -gt 0 ]]; then
    log "ERROR" "Missing ${missing} dependencies. Please install required dependencies."
    return 1
  fi
  
  # Check Node.js version
  local node_version
  node_version=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
  if [[ ${node_version} -lt 16 ]]; then
    log "WARN" "Node.js version ${node_version} detected. Version 16+ is recommended."
  fi
  
  # Check npm version
  local npm_version
  npm_version=$(npm -v | cut -d '.' -f 1)
  if [[ ${npm_version} -lt 7 ]]; then
    log "WARN" "npm version ${npm_version} detected. Version 7+ is recommended."
  fi
  
  log "INFO" "All dependencies satisfied"
  return 0
}

# Create or update a configuration file with error handling
# Usage: create_config_file <file_path> <content_function>
function create_config_file() {
  local file="$1"
  local content_function="$2"
  
  # Create directory if it doesn't exist
  mkdir -p "$(dirname "${file}")"
  
  # Backup existing file
  if [[ -f "${file}" && "${FORCE_MODE}" != "true" ]]; then
    local backup_file="${file}.backup.$(date +%Y%m%d%H%M%S)"
    cp "${file}" "${backup_file}" || {
      log "ERROR" "Failed to backup ${file} to ${backup_file}"
      return 1
    }
    log "INFO" "Backed up ${file} to ${backup_file}"
  fi
  
  # Create file
  ${content_function} > "${file}" || {
    log "ERROR" "Failed to write to ${file}"
    return 1
  }
  
  log "INFO" "Created/updated ${file}"
  return 0
}

# =====================================================================
# Core Command Functions
# =====================================================================

# Setup function - main setup process
function do_setup() {
  local quick_mode="false"
  local theme="${DEFAULT_THEME}"
  local user_id="${DEFAULT_USER}"
  
  # Parse options
  for arg in "$@"; do
    case ${arg} in
      --quick)
        quick_mode="true"
        ;;
      --force)
        FORCE_MODE="true"
        ;;
      --theme=*)
        theme="${arg#*=}"
        ;;
      --user=*)
        user_id="${arg#*=}"
        ;;
    esac
  done
  
  show_banner
  if ! check_dependencies; then
    log "ERROR" "Dependency check failed. Exiting."
    exit 1
  fi
  ensure_directories
  
  log "INFO" "Setting up Agentic OS"
  
  # Install required NPM packages
  log "INFO" "Installing required packages"
  if [[ "${quick_mode}" = "true" ]]; then
    npm install --quiet || log "WARN" "npm install failed, continuing anyway"
  else
    npm install || {
      log "ERROR" "npm install failed"
      exit 1
    }
  fi
  
  # Configure API keys
  if [[ "${quick_mode}" = "false" ]]; then
    log "INFO" "API Key Configuration"
    read -p "Enter your Anthropic API Key (leave blank to skip): " anthropic_key
    
    if [[ -n "${anthropic_key}" ]]; then
      create_config_file "${CONFIG_DIR}/api_keys.json" function() {
        echo -e "{\n  \"api_key\": \"${anthropic_key}\"\n}"
      }
      log "INFO" "API key saved to ${CONFIG_DIR}/api_keys.json"
    else
      log "WARN" "Skipped API key configuration"
    fi
  fi
  
  # Setup Schema UI integration
  if [[ -d "schema-ui-integration" ]]; then
    log "INFO" "Setting up Schema UI"
    if [[ ! -x "schema-ui-integration/saar.sh" ]]; then
      chmod +x schema-ui-integration/saar.sh
    fi
    ./schema-ui-integration/saar.sh setup --quick --theme="${theme}" --user="${user_id}" || {
      log "WARN" "Schema UI setup failed, continuing anyway"
    }
  else
    log "WARN" "Schema UI integration not found. Skipping setup."
  fi
  
  # Setup color schema
  if [[ "${quick_mode}" = "true" ]]; then
    log "INFO" "Setting up default color schema (${theme})"
    if [[ -f "core/mcp/color_schema_manager.js" ]]; then
      node core/mcp/color_schema_manager.js --template="${theme}" --non-interactive > /dev/null || {
        log "WARN" "Color schema setup failed, continuing anyway"
      }
    else
      log "WARN" "Color schema manager not found, skipping color schema setup"
    fi
  else
    log "INFO" "Setting up color schema"
    if [[ -f "scripts/setup/setup_user_colorschema.js" ]]; then
      node scripts/setup/setup_user_colorschema.js || {
        log "WARN" "Color schema setup failed, continuing anyway"
      }
    else
      log "WARN" "Color schema setup script not found, skipping color schema setup"
    fi
  fi
  
  # Setup about profile
  if [[ "${quick_mode}" = "true" ]]; then
    log "INFO" "Creating default .about profile"
    
    # Create a minimal default profile
    create_config_file "${CONFIG_DIR}/profiles/${user_id}.about.json" function() {
      cat << EOF
{
  "userId": "${user_id}",
  "personal": {
    "name": "Default User",
    "skills": ["JavaScript", "Python", "AI"]
  },
  "goals": {
    "shortTerm": ["Setup Agentic OS"],
    "longTerm": ["Build advanced AI agents"]
  },
  "preferences": {
    "uiTheme": "${theme}",
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
    }
    
    log "INFO" "Default .about profile created"
  else
    log "INFO" "Setting up .about profile"
    if [[ -f "scripts/setup/create_about.js" ]]; then
      node scripts/setup/create_about.js || {
        log "WARN" "About profile setup failed, continuing anyway"
      }
    else
      log "WARN" "About profile setup script not found, skipping profile setup"
    fi
  fi
  
  # Setup MCP servers
  log "INFO" "Configuring MCP servers"
  if [[ -f "core/mcp/setup_mcp.js" ]]; then
    node core/mcp/setup_mcp.js || {
      log "WARN" "MCP server setup failed, continuing anyway"
    }
  else
    log "WARN" "MCP server setup script not found, skipping MCP server setup"
  fi
  
  # Initialize memory system
  log "INFO" "Initializing memory system"
  do_memory init || {
    log "WARN" "Memory system initialization failed, continuing anyway"
  }
  
  # Create project directories if needed
  log "INFO" "Setting up workspace structure"
  mkdir -p "${WORKSPACE_DIR}/projects"
  
  # Setup workspace config
  log "INFO" "Creating workspace configuration"
  create_config_file "${WORKSPACE_DIR}/.claude/workspace.json" function() {
    echo "{\"workspaceVersion\": \"${VERSION}\", \"setupCompleted\": true, \"lastUpdate\": \"$(date '+%Y-%m-%d')\"}"
  }
  
  # Create system record in memory
  create_config_file "${STORAGE_DIR}/system-info.json" function() {
    echo "{\"systemId\": \"agentic-os-$(date +%s)\", \"setupDate\": \"$(date '+%Y-%m-%d')\", \"setupMode\": \"$([[ "${quick_mode}" == "true" ]] && echo 'quick' || echo 'interactive')\"}"
  }
  
  log "INFO" "Setup complete"
  echo -e "${GREEN}${BOLD}Agentic OS setup complete!${RESET}"
  echo -e "${CYAN}Your system is ready to use.${RESET}"
  echo ""
  echo -e "To start all services:    ${BOLD}./saar.sh start${RESET}"
  echo -e "To configure a project:   ${BOLD}./saar.sh project${RESET}"
  echo -e "To launch Claude agent:   ${BOLD}./saar.sh agent${RESET}"
  echo -e "To check system status:   ${BOLD}./saar.sh status${RESET}"
  echo ""
}

# About profile function
function do_about() {
  local user_id="${DEFAULT_USER}"
  
  # Parse options
  for arg in "$@"; do
    case ${arg} in
      --user=*)
        user_id="${arg#*=}"
        ;;
    esac
  done
  
  if ! check_dependencies; then
    log "ERROR" "Dependency check failed. Exiting."
    exit 1
  fi
  ensure_directories
  
  log "INFO" "Configuring .about profile for user ${user_id}"
  
  # Check if we have the create_about.js script
  if [[ -f "scripts/setup/create_about.js" ]]; then
    node scripts/setup/create_about.js --user="${user_id}" || {
      log "ERROR" "About profile creation failed"
      exit 1
    }
  else
    # Fallback to using schema-ui-integration if available
    if [[ -d "schema-ui-integration" ]]; then
      log "INFO" "Using Schema UI for profile configuration"
      if [[ ! -x "schema-ui-integration/saar.sh" ]]; then
        chmod +x schema-ui-integration/saar.sh
      fi
      ./schema-ui-integration/saar.sh setup --user="${user_id}" || {
        log "ERROR" "Schema UI profile configuration failed"
        exit 1
      }
    else
      log "ERROR" "No profile configuration tools found"
      exit 1
    fi
  fi
  
  log "INFO" "Profile configuration complete"
}

# Color schema function
function do_colors() {
  local theme="${DEFAULT_THEME}"
  local apply="true"
  
  # Parse options
  for arg in "$@"; do
    case ${arg} in
      --theme=*)
        theme="${arg#*=}"
        ;;
      --no-apply)
        apply="false"
        ;;
    esac
  done
  
  if ! check_dependencies; then
    log "ERROR" "Dependency check failed. Exiting."
    exit 1
  fi
  ensure_directories
  
  log "INFO" "Configuring color schema"
  
  # Update color schema using color_schema_manager
  if [[ -f "core/mcp/color_schema_manager.js" ]]; then
    if [[ "${theme}" != "custom" ]]; then
      log "INFO" "Setting theme to ${theme}"
      node core/mcp/color_schema_manager.js --template="${theme}" --apply="${apply}" || {
        log "ERROR" "Color schema configuration failed"
        exit 1
      }
    else
      log "INFO" "Starting interactive color schema configuration"
      if [[ -f "scripts/setup/setup_user_colorschema.js" ]]; then
        node scripts/setup/setup_user_colorschema.js || {
          log "ERROR" "Interactive color schema configuration failed"
          exit 1
        }
      else
        log "ERROR" "Interactive color schema configuration script not found"
        exit 1
      fi
    fi
  else
    log "ERROR" "Color schema manager not found"
    exit 1
  fi
  
  # Update Schema UI theme if available
  if [[ -d "schema-ui-integration" ]]; then
    log "INFO" "Updating Schema UI theme to ${theme}"
    if [[ ! -x "schema-ui-integration/saar.sh" ]]; then
      chmod +x schema-ui-integration/saar.sh
    fi
    ./schema-ui-integration/saar.sh apply --theme="${theme}" || {
      log "WARN" "Schema UI theme update failed, continuing anyway"
    }
  fi
  
  # Save theme to system memory
  create_config_file "${STORAGE_DIR}/theme-info.json" function() {
    echo "{\"activeTheme\": \"${theme}\", \"lastUpdated\": \"$(date '+%Y-%m-%d')\"}"
  }
  
  log "INFO" "Color schema configuration complete"
}

# Project setup function
function do_project() {
  local template=""
  local project_name=""
  
  # Parse options
  for arg in "$@"; do
    case ${arg} in
      --template=*)
        template="${arg#*=}"
        ;;
      --name=*)
        project_name="${arg#*=}"
        ;;
    esac
  done
  
  if ! check_dependencies; then
    log "ERROR" "Dependency check failed. Exiting."
    exit 1
  fi
  ensure_directories
  
  log "INFO" "Setting up a new project"
  
  # Prompt for project name if not provided
  if [[ -z "${project_name}" ]]; then
    read -p "Enter project name: " project_name
    if [[ -z "${project_name}" ]]; then
      log "ERROR" "Project name is required"
      exit 1
    fi
  fi
  
  # Create project directory with absolute path
  local project_dir="${WORKSPACE_DIR}/projects/${project_name}"
  log "INFO" "Creating project: ${project_name} at ${project_dir}"
  
  # Use setup_project.js if available
  if [[ -f "scripts/setup/setup_project.js" ]]; then
    if [[ -z "${template}" ]]; then
      node scripts/setup/setup_project.js --name="${project_name}" || {
        log "ERROR" "Project setup failed"
        exit 1
      }
    else
      node scripts/setup/setup_project.js --template="${template}" --name="${project_name}" || {
        log "ERROR" "Project setup failed"
        exit 1
      }
    fi
  else
    # Manual project setup
    log "INFO" "Creating project: ${project_name}"
    mkdir -p "${project_dir}"
    
    # Create basic project structure
    mkdir -p "${project_dir}/src"
    mkdir -p "${project_dir}/docs"
    mkdir -p "${project_dir}/tests"
    
    # Create package.json
    create_config_file "${project_dir}/package.json" function() {
      cat << EOF
{
  "name": "${project_name}",
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
    }
    
    # Create README.md
    create_config_file "${project_dir}/README.md" function() {
      cat << EOF
# ${project_name}

Project created with Claude Agentic OS.

## Getting Started

\`\`\`
npm install
npm start
\`\`\`
EOF
    }
    
    log "INFO" "Project created successfully at ${project_dir}"
  fi
  
  log "INFO" "Project setup complete"
}

# Memory management function
function do_memory() {
  local operation="${1:-status}"
  local target="${2:-all}"
  
  if ! check_dependencies; then
    log "ERROR" "Dependency check failed. Exiting."
    exit 1
  fi
  ensure_directories
  
  log "INFO" "Memory system operation: ${operation} for ${target}"
  
  case ${operation} in
    init)
      # Initialize memory system
      log "INFO" "Initializing memory system"
      mkdir -p "${STORAGE_DIR}"
      
      # Create memory file if it doesn't exist
      if [[ ! -f "${MEMORY_FILE}" ]]; then
        echo "{}" > "${MEMORY_FILE}"
        log "INFO" "Memory file created: ${MEMORY_FILE}"
      fi
      ;;
      
    backup)
      # Backup memory
      log "INFO" "Backing up memory system"
      local backup_file="${CONFIG_DIR}/backups/memory-backup-$(date +%Y%m%d-%H%M%S).json"
      
      # Create backup directory if it doesn't exist
      mkdir -p "${CONFIG_DIR}/backups"
      
      # Copy memory files
      if [[ "${target}" = "all" || "${target}" = "memory" ]]; then
        if [[ -f "${MEMORY_FILE}" ]]; then
          cp "${MEMORY_FILE}" "${backup_file}" || {
            log "ERROR" "Failed to backup memory file"
            exit 1
          }
          log "INFO" "Memory backed up to: ${backup_file}"
        fi
      fi
      
      # Copy profiles
      if [[ "${target}" = "all" || "${target}" = "profiles" ]]; then
        local profile_backup="${CONFIG_DIR}/backups/profiles-backup-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "${profile_backup}"
        
        if [[ -d "${CONFIG_DIR}/profiles" ]]; then
          cp -r "${CONFIG_DIR}/profiles/"* "${profile_backup}/" 2>/dev/null || true
          log "INFO" "Profiles backed up to: ${profile_backup}"
        fi
      fi
      
      # Create backup manifest
      create_config_file "${CONFIG_DIR}/backups/backup-manifest-$(date +%Y%m%d-%H%M%S).json" function() {
        echo "{\"date\": \"$(date '+%Y-%m-%d %H:%M:%S')\", \"files\": [\"${backup_file}\"]}"
      }
      
      log "INFO" "Backup completed"
      ;;
      
    restore)
      # Restore memory from backup
      log "INFO" "Restoring memory system"
      
      if [[ -z "$2" ]]; then
        # List available backups
        log "INFO" "Available backups:"
        ls -lt "${CONFIG_DIR}/backups" | grep "memory-backup-" | head -n 5
        echo ""
        read -p "Enter backup filename to restore (or 'latest' for most recent): " backup_name
        
        if [[ "${backup_name}" = "latest" ]]; then
          backup_name=$(ls -t "${CONFIG_DIR}/backups" | grep "memory-backup-" | head -n 1)
        fi
      else
        backup_name="$2"
      fi
      
      if [[ -f "${CONFIG_DIR}/backups/${backup_name}" ]]; then
        # Backup current state before restoring
        cp "${MEMORY_FILE}" "${MEMORY_FILE}.bak" || {
          log "ERROR" "Failed to backup current memory file"
          exit 1
        }
        
        # Restore from backup
        cp "${CONFIG_DIR}/backups/${backup_name}" "${MEMORY_FILE}" || {
          log "ERROR" "Failed to restore from backup"
          exit 1
        }
        log "INFO" "Memory restored from: ${backup_name}"
      else
        log "ERROR" "Backup file not found: ${backup_name}"
        exit 1
      fi
      ;;
      
    clear)
      # Clear memory
      log "WARN" "Clearing memory system"
      
      read -p "Are you sure you want to clear memory? This cannot be undone. (y/N): " confirm
      if [[ "${confirm}" =~ ^[Yy]$ ]]; then
        # Backup before clearing
        do_memory backup all || {
          log "ERROR" "Failed to backup memory before clearing"
          exit 1
        }
        
        # Clear memory file
        echo "{}" > "${MEMORY_FILE}" || {
          log "ERROR" "Failed to clear memory file"
          exit 1
        }
        log "INFO" "Memory cleared"
      else
        log "INFO" "Memory clear canceled"
      fi
      ;;
      
    status)
      # Show memory status
      log "INFO" "Memory system status"
      
      echo -e "${BOLD}Memory System Status:${RESET}"
      
      if [[ -f "${MEMORY_FILE}" ]]; then
        local memory_size
        local memory_date
        
        if command_exists stat; then
          # Try to get file size using stat
          memory_size=$(stat -c%s "${MEMORY_FILE}" 2>/dev/null || stat -f%z "${MEMORY_FILE}" 2>/dev/null)
          memory_date=$(stat -c%y "${MEMORY_FILE}" 2>/dev/null || stat -f%m "${MEMORY_FILE}" 2>/dev/null)
        else
          # Fallback to using ls
          memory_size=$(ls -l "${MEMORY_FILE}" | awk '{ print $5 }')
          memory_date=$(ls -l --time-style="+%Y-%m-%d %H:%M:%S" "${MEMORY_FILE}" 2>/dev/null | awk '{ print $6, $7 }')
        fi
        
        echo -e "Memory file: ${GREEN}Found${RESET}"
        echo -e "Size: ${memory_size:-Unknown} bytes"
        echo -e "Last modified: ${memory_date:-Unknown}"
        
        # Count items in JSON
        if command_exists jq; then
          local profile_count
          local theme_count
          
          profile_count=$(jq '.profiles | length' "${MEMORY_FILE}" 2>/dev/null || echo "Unknown")
          theme_count=$(jq '.themes | length' "${MEMORY_FILE}" 2>/dev/null || echo "Unknown")
          
          echo -e "Profiles: ${profile_count}"
          echo -e "Themes: ${theme_count}"
        else
          echo -e "Detailed status unavailable (jq not installed)"
        fi
      else
        echo -e "Memory file: ${RED}Not found${RESET}"
      fi
      
      # Check backup status
      if [[ -d "${CONFIG_DIR}/backups" ]]; then
        local backup_count
        local latest_backup
        
        backup_count=$(ls -1 "${CONFIG_DIR}/backups" | grep "memory-backup-" | wc -l)
        latest_backup=$(ls -t "${CONFIG_DIR}/backups" | grep "memory-backup-" | head -n 1)
        
        echo -e "${BOLD}Backups:${RESET}"
        echo -e "Total backups: ${backup_count}"
        echo -e "Latest backup: ${latest_backup:-None}"
      else
        echo -e "${BOLD}Backups:${RESET} None found"
      fi
      ;;
      
    *)
      log "ERROR" "Unknown memory operation: ${operation}"
      echo -e "Available operations: init, backup, restore, clear, status"
      exit 1
      ;;
  esac
}

# Start services function
function do_start() {
  local components="${1:-all}"
  
  if ! check_dependencies; then
    log "ERROR" "Dependency check failed. Exiting."
    exit 1
  fi
  ensure_directories
  
  log "INFO" "Starting Agentic OS services: ${components}"
  
  # Start MCP servers if available
  if [[ "${components}" = "all" || "${components}" = "mcp" ]]; then
    if [[ -f "core/mcp/start_server.js" ]]; then
      log "INFO" "Starting MCP servers"
      node core/mcp/start_server.js || {
        log "ERROR" "Failed to start MCP servers"
        exit 1
      }
    else
      log "WARN" "MCP server startup script not found"
    fi
  fi
  
  # Start web dashboard if available
  if [[ "${components}" = "all" || "${components}" = "dashboard" ]]; then
    if [[ -f "scripts/dashboard/server.js" ]]; then
      log "INFO" "Starting web dashboard"
      node scripts/dashboard/server.js &
      local dashboard_pid=$!
      log "INFO" "Dashboard started with PID: ${dashboard_pid}"
      echo ${dashboard_pid} > "${WORKSPACE_DIR}/.claude/.dashboard_pid"
    else
      log "WARN" "Dashboard server script not found"
    fi
  fi
  
  # Start Schema UI if available
  if [[ "${components}" = "all" || "${components}" = "ui" ]]; then
    if [[ -d "schema-ui-integration" ]]; then
      log "INFO" "Starting Schema UI components"
      if [[ ! -x "schema-ui-integration/saar.sh" ]]; then
        chmod +x schema-ui-integration/saar.sh
      fi
      ./schema-ui-integration/saar.sh run || {
        log "WARN" "Failed to start Schema UI components"
      }
    else
      log "WARN" "Schema UI integration not found"
    fi
  fi
  
  log "INFO" "Services started"
}

# Agent function
function do_agent() {
  local mode="${1:-interactive}"
  
  if ! check_dependencies; then
    log "ERROR" "Dependency check failed. Exiting."
    exit 1
  fi
  ensure_directories
  
  log "INFO" "Launching Claude agent in ${mode} mode"
  
  # Check if npx claude is available
  if command_exists npx; then
    if [[ "${mode}" = "interactive" ]]; then
      npx claude || {
        log "ERROR" "Failed to launch Claude agent"
        exit 1
      }
    else
      npx claude --mode="${mode}" || {
        log "ERROR" "Failed to launch Claude agent with mode: ${mode}"
        exit 1
      }
    fi
  else
    log "ERROR" "npx not found. Cannot launch Claude agent."
    exit 1
  fi
}

# UI configuration function
function do_ui() {
  local operation="${1:-status}"
  local theme="${DEFAULT_THEME}"
  
  # Parse options
  for arg in "$@"; do
    case ${arg} in
      --theme=*)
        theme="${arg#*=}"
        ;;
    esac
  done
  
  if ! check_dependencies; then
    log "ERROR" "Dependency check failed. Exiting."
    exit 1
  fi
  ensure_directories
  
  log "INFO" "UI operation: ${operation}"
  
  # Check if Schema UI is available
  if [[ ! -d "schema-ui-integration" ]]; then
    log "ERROR" "Schema UI not found. Attempting to download..."
    
    if command_exists git; then
      git clone https://github.com/claude-framework/schema-ui.git schema-ui-integration || {
        log "ERROR" "Failed to download Schema UI"
        exit 1
      }
      log "INFO" "Schema UI downloaded successfully"
      
      if [[ -f "schema-ui-integration/saar.sh" ]]; then
        chmod +x schema-ui-integration/saar.sh
      else
        log "ERROR" "Schema UI saar.sh script not found"
        exit 1
      fi
    else
      log "ERROR" "git command not found, cannot download Schema UI"
      exit 1
    fi
  fi
  
  # Make script executable
  if [[ -f "schema-ui-integration/saar.sh" && ! -x "schema-ui-integration/saar.sh" ]]; then
    chmod +x schema-ui-integration/saar.sh
  fi
  
  # Execute Schema UI command
  case ${operation} in
    status)
      log "INFO" "Checking UI status"
      ./schema-ui-integration/saar.sh help || {
        log "ERROR" "Failed to check UI status"
        exit 1
      }
      ;;
      
    setup)
      log "INFO" "Setting up UI components"
      ./schema-ui-integration/saar.sh setup --theme="${theme}" || {
        log "ERROR" "Failed to setup UI components"
        exit 1
      }
      ;;
      
    customize)
      log "INFO" "Customizing UI components"
      ./schema-ui-integration/saar.sh all --theme="${theme}" || {
        log "ERROR" "Failed to customize UI components"
        exit 1
      }
      ;;
      
    run)
      log "INFO" "Running UI components"
      ./schema-ui-integration/saar.sh run || {
        log "ERROR" "Failed to run UI components"
        exit 1
      }
      ;;
      
    *)
      log "ERROR" "Unknown UI operation: ${operation}"
      echo -e "Available operations: status, setup, customize, run"
      exit 1
      ;;
  esac
}

# Enterprise function
function do_enterprise() {
  local operation="${1:-status}"
  local sub_operation="${2:-}"
  local license_key="${3:-}"
  
  if ! check_dependencies; then
    log "ERROR" "Dependency check failed. Exiting."
    exit 1
  fi
  ensure_directories
  
  log "INFO" "Enterprise operation: ${operation}"
  
  # Create enterprise directories
  mkdir -p "${CONFIG_DIR}/enterprise"
  mkdir -p "${CONFIG_DIR}/enterprise/logs"
  mkdir -p "${CONFIG_DIR}/enterprise/license"
  
  # Create enterprise config directory in workspace if it doesn't exist
  if [[ -d "schema-ui-integration" && ! -d "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config" ]]; then
    mkdir -p "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config"
  fi
  
  # Execute enterprise operation
  case ${operation} in
    setup)
      log "INFO" "Setting up enterprise features"
      
      # Check if enterprise configuration exists
      if [[ -d "schema-ui-integration" && -f "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml" ]]; then
        log "INFO" "Enterprise configuration found"
      else
        log "WARN" "Enterprise configuration not found. Creating default configuration."
        
        # Create enterprise config directory
        if [[ -d "schema-ui-integration" ]]; then
          mkdir -p "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config"
          
          # Create default enterprise configuration
          create_config_file "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml" function() {
            cat << 'EOF'
# Enterprise Configuration
version: "1.0.0"
environment: "production"

# Security Configuration
security:
  sso:
    enabled: false
    providers:
      - name: "okta"
        enabled: false
        client_id: ""
        client_secret: ""
        auth_url: ""
        token_url: ""
      - name: "azure_ad"
        enabled: false
        tenant_id: ""
        client_id: ""
        client_secret: ""

  # Access Control
  rbac:
    enabled: true
    default_role: "user"
    roles:
      - name: "admin"
        permissions: ["*"]
      - name: "user"
        permissions: ["read", "write", "execute"]
      - name: "viewer"
        permissions: ["read"]

  # Compliance
  compliance:
    audit_logging: true
    data_retention_days: 90
    encryption:
      enabled: true
      algorithm: "AES-256"

# Performance
performance:
  cache:
    enabled: true
    ttl_seconds: 3600
  rate_limiting:
    enabled: true
    requests_per_minute: 100

# Monitoring
monitoring:
  metrics:
    enabled: true
    interval_seconds: 60
  alerts:
    enabled: false
    channels:
      - type: "email"
        recipients: []
      - type: "slack"
        webhook_url: ""

# Teams
teams:
  enabled: true
  max_members_per_team: 25

# License
license:
  type: "trial"
  expiration: ""
  features:
    multi_user: true
    advanced_analytics: false
    priority_support: false
EOF
          }
          log "INFO" "Default enterprise configuration created"
        else
          log "WARN" "Schema UI not found, skipping enterprise configuration"
        fi
      fi
      
      # Create or update VERSION.txt
      create_config_file "${WORKSPACE_DIR}/VERSION.txt" function() {
        echo "Enterprise Beta 1.0.0"
      }
      
      # Create README if it doesn't exist
      if [[ ! -f "${WORKSPACE_DIR}/ENTERPRISE_README.md" ]]; then
        log "INFO" "Creating enterprise README"
        
        create_config_file "${WORKSPACE_DIR}/ENTERPRISE_README.md" function() {
          cat << 'EOF'
# Claude Neural Framework - Enterprise Edition

## Overview

The Enterprise Edition of the Claude Neural Framework provides enhanced capabilities designed for organizational use with multi-user support, advanced security, and compliance features.

## Features

- **SSO Integration**: Connect with your organization's identity providers (Okta, Azure AD)
- **Team Collaboration**: Manage teams and shared resources
- **Audit Logging**: Comprehensive audit trails for all system activities
- **Enhanced Security**: Role-based access control and data encryption
- **Compliance Tools**: Features to help meet regulatory requirements
- **Performance Optimization**: Advanced caching and rate limiting
- **Enterprise Support**: Priority support channels

## Getting Started

```bash
# Set up enterprise features
./saar.sh enterprise setup

# Activate your license
./saar.sh enterprise license activate YOUR_LICENSE_KEY

# Configure SSO
./saar.sh enterprise sso configure

# Manage teams
./saar.sh enterprise teams manage
```

## Configuration

Enterprise configuration is stored in `schema-ui-integration/enterprise/config/enterprise.yaml`. You can edit this file directly or use the CLI commands to modify specific settings.

## License Management

Your enterprise license controls access to premium features. To activate or check your license:

```bash
# Activate license
./saar.sh enterprise license activate YOUR_LICENSE_KEY

# Check license status
./saar.sh enterprise license status
```

## User Management

Enterprise Edition supports multi-user environments with role-based access control:

```bash
# Add a new user
./saar.sh enterprise users add --name="John Doe" --email="john@example.com" --role="admin"

# List all users
./saar.sh enterprise users list

# Change user role
./saar.sh enterprise users update --email="john@example.com" --role="user"
```

## Team Management

Create and manage teams for collaborative work:

```bash
# Create a new team
./saar.sh enterprise teams create --name="Engineering" --description="Engineering team"

# Add users to team
./saar.sh enterprise teams add-member --team="Engineering" --email="john@example.com"

# List team members
./saar.sh enterprise teams list-members --team="Engineering"
```

## Support

For enterprise support, please contact support@example.com or use the in-app support channel.
EOF
        }
        log "INFO" "Enterprise README created"
      fi
      
      # Create enterprise license directory
      if [[ -d "schema-ui-integration" && ! -d "${WORKSPACE_DIR}/schema-ui-integration/enterprise/license" ]]; then
        mkdir -p "${WORKSPACE_DIR}/schema-ui-integration/enterprise/license"
        
        # Create license file
        create_config_file "${WORKSPACE_DIR}/schema-ui-integration/enterprise/LICENSE.md" function() {
          cat << 'EOF'
# Enterprise License Agreement

This is a placeholder for the Claude Neural Framework Enterprise License Agreement.

The actual license agreement would contain terms and conditions for the use of the Enterprise Edition of the Claude Neural Framework, including:

1. License Grant
2. Restrictions on Use
3. Subscription Terms
4. Support and Maintenance
5. Confidentiality
6. Intellectual Property Rights
7. Warranty Disclaimer
8. Limitation of Liability
9. Term and Termination
10. General Provisions

For a valid license agreement, please contact your sales representative or visit our website.
EOF
        }
      fi
      
      # Update memory with enterprise status
      local timestamp
      timestamp=$(date "+%Y-%m-%d %H:%M:%S")
      create_config_file "${CONFIG_DIR}/enterprise/status.json" function() {
        echo "{\"enterprise\": {\"activated\": true, \"activationDate\": \"${timestamp}\", \"version\": \"1.0.0\", \"type\": \"beta\"}}"
      }
      
      log "INFO" "Enterprise setup complete"
      log "INFO" "For detailed information, please read ${WORKSPACE_DIR}/ENTERPRISE_README.md"
      ;;
      
    # Handle license operations (activate, status, deactivate)
    license)
      case ${sub_operation} in
        activate)
          log "INFO" "Activating enterprise license"
          
          if [[ -z "${license_key}" ]]; then
            read -p "Enter your license key: " license_key
          fi
          
          if [[ -z "${license_key}" ]]; then
            log "ERROR" "No license key provided"
            exit 1
          fi
          
          # Save license key
          local timestamp
          timestamp=$(date "+%Y-%m-%d %H:%M:%S")
          local expiration
          
          # Try to compute expiration date 30 days in future
          if date -d "+30 days" "+%Y-%m-%d" &>/dev/null; then
            expiration=$(date -d "+30 days" "+%Y-%m-%d")
          elif date -v+30d "+%Y-%m-%d" &>/dev/null; then
            expiration=$(date -v+30d "+%Y-%m-%d")
          else
            # Fallback if date commands fail
            expiration=$(date "+%Y-%m-%d")
          fi
          
          create_config_file "${CONFIG_DIR}/enterprise/license/license.json" function() {
            echo "{\"key\": \"${license_key}\", \"activated\": true, \"activationDate\": \"${timestamp}\", \"expirationDate\": \"${expiration}\", \"type\": \"beta\"}"
          }
          
          # Update license in configuration if yq is available
          if command_exists yq && [[ -f "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml" ]]; then
            yq eval '.license.type = "beta" | .license.expiration = "'"${expiration}"'"' -i "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml" || {
              log "WARN" "Failed to update enterprise.yaml with yq, using sed instead"
              
              # Backup configuration
              cp "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml" "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml.bak"
              
              # Update with sed
              if sed --version 2>/dev/null | grep -q GNU; then
                # GNU sed
                sed -i "s/license:/license:\n  type: \"beta\"/" "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml"
                sed -i "s/expiration: \"\"/expiration: \"${expiration}\"/" "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml"
              else
                # BSD sed or other variant
                sed -i "" "s/license:/license:\n  type: \"beta\"/" "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml"
                sed -i "" "s/expiration: \"\"/expiration: \"${expiration}\"/" "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml"
              fi
            }
          elif [[ -f "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml" ]]; then
            # Backup configuration
            cp "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml" "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml.bak"
            
            # Update with sed
            if sed --version 2>/dev/null | grep -q GNU; then
              # GNU sed
              sed -i "s/license:/license:\n  type: \"beta\"/" "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml"
              sed -i "s/expiration: \"\"/expiration: \"${expiration}\"/" "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml"
            else
              # BSD sed or other variant
              sed -i "" "s/license:/license:\n  type: \"beta\"/" "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml"
              sed -i "" "s/expiration: \"\"/expiration: \"${expiration}\"/" "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml"
            fi
          fi
          
          log "INFO" "License activated successfully"
          log "INFO" "License valid until: ${expiration}"
          ;;
          
        status)
          log "INFO" "Checking license status"
          
          if [[ -f "${CONFIG_DIR}/enterprise/license/license.json" ]]; then
            local license_info
            license_info=$(cat "${CONFIG_DIR}/enterprise/license/license.json")
            
            local license_type=""
            local activation_date=""
            local expiration_date=""
            
            # Extract information with grep or a more robust approach
            if command_exists grep; then
              license_type=$(echo "${license_info}" | grep -o '"type": "[^"]*' | cut -d'"' -f4)
              activation_date=$(echo "${license_info}" | grep -o '"activationDate": "[^"]*' | cut -d'"' -f4)
              expiration_date=$(echo "${license_info}" | grep -o '"expirationDate": "[^"]*' | cut -d'"' -f4)
            else
              # Fallback if grep is not available
              license_type="unknown"
              activation_date="unknown"
              expiration_date="unknown"
            fi
            
            echo -e "${BOLD}License Status:${RESET}"
            echo -e "Type: ${license_type:-Unknown}"
            echo -e "Activation Date: ${activation_date:-Unknown}"
            echo -e "Expiration Date: ${expiration_date:-Unknown}"
            
            # Check if license is expired
            if [[ -n "${expiration_date}" ]]; then
              local current_date
              current_date=$(date "+%Y-%m-%d")
              if [[ "${current_date}" > "${expiration_date}" ]]; then
                echo -e "Status: ${RED}Expired${RESET}"
              else
                echo -e "Status: ${GREEN}Active${RESET}"
              fi
            else
              echo -e "Status: ${YELLOW}Unknown${RESET}"
            fi
          else
            echo -e "${BOLD}License Status:${RESET}"
            echo -e "Status: ${YELLOW}Not activated${RESET}"
            echo -e "Run './saar.sh enterprise license activate' to activate your license"
          fi
          ;;
          
        deactivate)
          log "WARN" "Deactivating enterprise license"
          
          read -p "Are you sure you want to deactivate your license? (y/N): " confirm
          if [[ "${confirm}" =~ ^[Yy]$ ]]; then
            if [[ -f "${CONFIG_DIR}/enterprise/license/license.json" ]]; then
              # Backup license
              cp "${CONFIG_DIR}/enterprise/license/license.json" "${CONFIG_DIR}/enterprise/license/license.json.bak"
              
              # Deactivate license
              local deactivation_date
              deactivation_date=$(date "+%Y-%m-%d %H:%M:%S")
              
              # Update license file
              if command_exists sed; then
                if sed --version 2>/dev/null | grep -q GNU; then
                  # GNU sed
                  sed -i "s/\"activated\": true/\"activated\": false, \"deactivationDate\": \"${deactivation_date}\"/" "${CONFIG_DIR}/enterprise/license/license.json"
                else
                  # BSD sed or other variant
                  sed -i "" "s/\"activated\": true/\"activated\": false, \"deactivationDate\": \"${deactivation_date}\"/" "${CONFIG_DIR}/enterprise/license/license.json"
                fi
              else
                # Fallback if sed is not available
                create_config_file "${CONFIG_DIR}/enterprise/license/license.json" function() {
                  echo "{\"activated\": false, \"deactivationDate\": \"${deactivation_date}\"}"
                }
              fi
              
              log "INFO" "License deactivated"
            else
              log "WARN" "No license found to deactivate"
            fi
          else
            log "INFO" "License deactivation canceled"
          fi
          ;;
          
        *)
          log "ERROR" "Unknown license operation: ${sub_operation}"
          echo -e "Available operations: activate, status, deactivate"
          exit 1
          ;;
      esac
      ;;
      
    # Add support for users, teams, and status operations...
    status)
      log "INFO" "Checking enterprise status"
      
      echo -e "${BOLD}ENTERPRISE STATUS${RESET}"
      echo -e "======================"
      echo ""
      
      # Check license status
      if [[ -f "${CONFIG_DIR}/enterprise/license/license.json" ]]; then
        local license_info
        license_info=$(cat "${CONFIG_DIR}/enterprise/license/license.json")
        
        local license_type=""
        local activation_date=""
        local expiration_date=""
        
        # Extract information
        if command_exists grep; then
          license_type=$(echo "${license_info}" | grep -o '"type": "[^"]*' | cut -d'"' -f4)
          activation_date=$(echo "${license_info}" | grep -o '"activationDate": "[^"]*' | cut -d'"' -f4)
          expiration_date=$(echo "${license_info}" | grep -o '"expirationDate": "[^"]*' | cut -d'"' -f4)
        fi
        
        echo -e "${BOLD}License:${RESET}"
        echo -e "Type: ${license_type:-Unknown}"
        echo -e "Activated: ${activation_date:-Unknown}"
        echo -e "Expires: ${expiration_date:-Unknown}"
        
        # Check if license is expired
        if [[ -n "${expiration_date}" ]]; then
          local current_date
          current_date=$(date "+%Y-%m-%d")
          if [[ "${current_date}" > "${expiration_date}" ]]; then
            echo -e "Status: ${RED}Expired${RESET}"
          else
            echo -e "Status: ${GREEN}Active${RESET}"
          fi
        else
          echo -e "Status: ${YELLOW}Unknown${RESET}"
        fi
      else
        echo -e "${BOLD}License:${RESET} ${YELLOW}Not activated${RESET}"
      fi
      echo ""
      
      # Check enterprise configuration
      if [[ -f "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml" ]]; then
        echo -e "${BOLD}Configuration:${RESET} ${GREEN}Found${RESET}"
        
        # Extract some key settings
        if command_exists grep; then
          local sso_enabled=""
          local rbac_enabled=""
          local audit_logging=""
          
          sso_enabled=$(grep "sso:" -A 2 "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml" | grep "enabled:" | cut -d':' -f2 | tr -d ' ')
          rbac_enabled=$(grep "rbac:" -A 2 "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml" | grep "enabled:" | cut -d':' -f2 | tr -d ' ')
          audit_logging=$(grep "audit_logging:" "${WORKSPACE_DIR}/schema-ui-integration/enterprise/config/enterprise.yaml" | cut -d':' -f2 | tr -d ' ')
          
          echo -e "SSO: ${sso_enabled:-false}"
          echo -e "RBAC: ${rbac_enabled:-false}"
          echo -e "Audit Logging: ${audit_logging:-false}"
        fi
      else
        echo -e "${BOLD}Configuration:${RESET} ${YELLOW}Not found${RESET}"
      fi
      echo ""
      
      # Check for user and team directories
      local user_count=0
      local team_count=0
      
      if [[ -d "${CONFIG_DIR}/enterprise/users" ]]; then
        user_count=$(ls -1 "${CONFIG_DIR}/enterprise/users" 2>/dev/null | grep -c "\.json$" || echo 0)
      fi
      
      if [[ -d "${CONFIG_DIR}/enterprise/teams" ]]; then
        team_count=$(ls -1 "${CONFIG_DIR}/enterprise/teams" 2>/dev/null | grep -c "\.json$" || echo 0)
      fi
      
      echo -e "${BOLD}Users:${RESET} ${user_count} registered"
      echo -e "${BOLD}Teams:${RESET} ${team_count} created"
      echo ""
      
      # Check enterprise components
      echo -e "${BOLD}Components:${RESET}"
      
      for component in "SSO Provider" "RBAC Manager" "Audit Logger" "Team Collaboration" "Enterprise Dashboard"; do
        echo -e "- $component: ${YELLOW}Ready to configure${RESET}"
      done
      
      log "INFO" "Enterprise status check complete"
      ;;
      
    # Add user management operations
    users)
      case ${sub_operation} in
        list)
          log "INFO" "Listing enterprise users"
          
          if [[ -d "${CONFIG_DIR}/enterprise/users" ]]; then
            echo -e "${BOLD}Enterprise Users:${RESET}"
            
            # Check if there are any user files
            local user_files
            user_files=$(ls -1 "${CONFIG_DIR}/enterprise/users/"*.json 2>/dev/null)
            
            if [[ -n "${user_files}" ]]; then
              for user_file in "${CONFIG_DIR}/enterprise/users/"*.json; do
                if [[ -f "${user_file}" ]]; then
                  local user_data
                  user_data=$(cat "${user_file}")
                  
                  local user_email=""
                  local user_name=""
                  local user_role=""
                  
                  # Extract user information
                  if command_exists grep; then
                    user_email=$(echo "${user_data}" | grep -o '"email": "[^"]*' | cut -d'"' -f4)
                    user_name=$(echo "${user_data}" | grep -o '"name": "[^"]*' | cut -d'"' -f4)
                    user_role=$(echo "${user_data}" | grep -o '"role": "[^"]*' | cut -d'"' -f4)
                  fi
                  
                  echo -e "${CYAN}${user_name:-Unknown}${RESET} (${user_email:-Unknown}) - ${BOLD}Role:${RESET} ${user_role:-User}"
                fi
              done
            else
              echo -e "No users found"
            fi
          else
            echo -e "No users found"
          fi
          ;;
          
        add)
          log "INFO" "Adding enterprise user"
          
          # Parse options
          local user_name=""
          local user_email=""
          local user_role="user"
          
          for arg in "$@"; do
            case ${arg} in
              --name=*)
                user_name="${arg#*=}"
                ;;
              --email=*)
                user_email="${arg#*=}"
                ;;
              --role=*)
                user_role="${arg#*=}"
                ;;
            esac
          done
          
          if [[ -z "${user_name}" ]]; then
            read -p "Enter user name: " user_name
          fi
          
          if [[ -z "${user_email}" ]]; then
            read -p "Enter user email: " user_email
          fi
          
          if [[ -z "${user_email}" ]]; then
            log "ERROR" "Email is required"
            exit 1
          fi
          
          # Create users directory if it doesn't exist
          mkdir -p "${CONFIG_DIR}/enterprise/users"
          
          # Create user file
          local user_id
          user_id=$(echo "${user_email}" | sed 's/[^a-zA-Z0-9]/_/g')
          local timestamp
          timestamp=$(date "+%Y-%m-%d %H:%M:%S")
          
          create_config_file "${CONFIG_DIR}/enterprise/users/${user_id}.json" function() {
            cat << EOF
{
  "id": "${user_id}",
  "name": "${user_name}",
  "email": "${user_email}",
  "role": "${user_role}",
  "created": "${timestamp}",
  "lastModified": "${timestamp}",
  "status": "active"
}
EOF
          }
          
          log "INFO" "User added successfully"
          ;;
          
        # Additional user management operations can be implemented here
        
        *)
          log "ERROR" "Unknown users operation: ${sub_operation}"
          echo -e "Available operations: list, add, update, delete"
          exit 1
          ;;
      esac
      ;;
      
    # Add team management operations
    teams)
      case ${sub_operation} in
        list)
          log "INFO" "Listing enterprise teams"
          
          if [[ -d "${CONFIG_DIR}/enterprise/teams" ]]; then
            echo -e "${BOLD}Enterprise Teams:${RESET}"
            
            # Check if there are any team files
            local team_files
            team_files=$(ls -1 "${CONFIG_DIR}/enterprise/teams/"*.json 2>/dev/null)
            
            if [[ -n "${team_files}" ]]; then
              for team_file in "${CONFIG_DIR}/enterprise/teams/"*.json; do
                if [[ -f "${team_file}" ]]; then
                  local team_data
                  team_data=$(cat "${team_file}")
                  
                  local team_name=""
                  local team_id=""
                  local team_description=""
                  
                  # Extract team information
                  if command_exists grep; then
                    team_name=$(echo "${team_data}" | grep -o '"name": "[^"]*' | cut -d'"' -f4)
                    team_id=$(echo "${team_data}" | grep -o '"id": "[^"]*' | cut -d'"' -f4)
                    team_description=$(echo "${team_data}" | grep -o '"description": "[^"]*' | cut -d'"' -f4)
                  fi
                  
                  echo -e "${CYAN}${team_name:-Unknown}${RESET} (${team_id:-Unknown}) - ${team_description:-No description}"
                fi
              done
            else
              echo -e "No teams found"
            fi
          else
            echo -e "No teams found"
          fi
          ;;
          
        # Additional team management operations can be implemented here
        
        *)
          log "ERROR" "Unknown teams operation: ${sub_operation}"
          echo -e "Available operations: list, create, add-member"
          exit 1
          ;;
      esac
      ;;
      
    *)
      log "ERROR" "Unknown enterprise operation: ${operation}"
      echo -e "Available operations: setup, license, users, teams, status"
      exit 1
      ;;
  esac
}

# Status function
function do_status() {
  if ! check_dependencies; then
    log "ERROR" "Dependency check failed. Exiting."
    exit 1
  fi
  ensure_directories
  
  show_banner
  
  log "INFO" "Checking system status"
  
  echo -e "${BOLD}AGENTIC OS STATUS${RESET}"
  echo -e "======================"
  echo ""
  
  # Check workspace
  echo -e "${BOLD}Workspace:${RESET}"
  if [[ -f "${WORKSPACE_DIR}/.claude/workspace.json" ]]; then
    local workspace_data
    workspace_data=$(cat "${WORKSPACE_DIR}/.claude/workspace.json")
    
    local workspace_version=""
    local setup_completed=""
    
    # Extract workspace information
    if command_exists grep; then
      workspace_version=$(echo "${workspace_data}" | grep -o '"workspaceVersion": "[^"]*' | cut -d'"' -f4)
      setup_completed=$(echo "${workspace_data}" | grep -o '"setupCompleted": [^,]*' | cut -d' ' -f2)
    fi
    
    echo -e "Version: ${workspace_version:-Unknown}"
    echo -e "Setup complete: ${setup_completed:-false}"
  else
    echo -e "Status: ${YELLOW}Not initialized${RESET}"
  fi
  echo ""
  
  # Check MCP servers
  echo -e "${BOLD}MCP Servers:${RESET}"
  if [[ -f "core/mcp/server_config.json" ]]; then
    if command_exists jq; then
      local server_count
      server_count=$(jq '.servers | length' "core/mcp/server_config.json" 2>/dev/null || echo "Unknown")
      echo -e "Configured servers: ${server_count}"
      
      # List a few servers
      jq -r '.servers | keys | .[]' "core/mcp/server_config.json" 2>/dev/null | head -n 5 | while read -r server; do
        echo -e "- $server"
      done
    else
      echo -e "Configuration: ${GREEN}Found${RESET}"
    fi
  else
    echo -e "Status: ${YELLOW}Not configured${RESET}"
  fi
  
  # Check if any MCP servers are running
  if command_exists ps && command_exists grep; then
    local running_servers
    running_servers=$(ps aux | grep -c "[n]ode.*mcp" || echo 0)
    if [[ "${running_servers}" -gt 0 ]]; then
      echo -e "Running servers: ${GREEN}${running_servers}${RESET}"
    else
      echo -e "Running servers: ${YELLOW}None${RESET}"
    fi
  fi
  echo ""
  
  # Check memory system
  echo -e "${BOLD}Memory System:${RESET}"
  if [[ -f "${MEMORY_FILE}" ]]; then
    local memory_size=""
    
    if command_exists stat; then
      memory_size=$(stat -c%s "${MEMORY_FILE}" 2>/dev/null || stat -f%z "${MEMORY_FILE}" 2>/dev/null)
    elif command_exists ls; then
      memory_size=$(ls -l "${MEMORY_FILE}" | awk '{ print $5 }')
    fi
    
    echo -e "Status: ${GREEN}Active${RESET}"
    echo -e "Size: ${memory_size:-Unknown} bytes"
  else
    echo -e "Status: ${YELLOW}Not initialized${RESET}"
  fi
  echo ""
  
  # Check Schema UI
  echo -e "${BOLD}Schema UI:${RESET}"
  if [[ -d "schema-ui-integration" ]]; then
    echo -e "Status: ${GREEN}Installed${RESET}"
    
    if [[ -f "schema-ui-integration/package.json" ]]; then
      local ui_version=""
      
      if command_exists grep; then
        ui_version=$(grep -o '"version": "[^"]*' "schema-ui-integration/package.json" | cut -d'"' -f4)
      fi
      
      echo -e "Version: ${ui_version:-Unknown}"
    fi
  else
    echo -e "Status: ${YELLOW}Not installed${RESET}"
  fi
  echo ""
  
  # Check API keys
  echo -e "${BOLD}API Keys:${RESET}"
  if [[ -f "${CONFIG_DIR}/api_keys.json" ]]; then
    echo -e "Anthropic API key: ${GREEN}Configured${RESET}"
  else
    echo -e "Anthropic API key: ${YELLOW}Not configured${RESET}"
  fi
  echo ""
  
  # Check .about profile
  echo -e "${BOLD}User Profiles:${RESET}"
  if [[ -d "${CONFIG_DIR}/profiles" ]]; then
    local profile_count
    profile_count=$(ls -1 "${CONFIG_DIR}/profiles/"*.about.json 2>/dev/null | wc -l || echo 0)
    echo -e "Available profiles: ${profile_count}"
    
    # List a few profiles
    local profile_files
    profile_files=$(ls -1 "${CONFIG_DIR}/profiles/"*.about.json 2>/dev/null | head -n 3)
    
    if [[ -n "${profile_files}" ]]; then
      echo "${profile_files}" | while read -r profile; do
        echo -e "- $(basename "${profile}" .about.json)"
      done
      
      if [[ ${profile_count} -gt 3 ]]; then
        echo -e "... and $((profile_count-3)) more"
      fi
    fi
  else
    echo -e "Status: ${YELLOW}No profiles found${RESET}"
  fi
  echo ""
  
  # Display Node.js and npm versions
  echo -e "${BOLD}Environment:${RESET}"
  echo -e "Node.js: $(node -v)"
  echo -e "npm: $(npm -v)"
  echo -e "OS: $(uname -s) $(uname -r)"
  echo ""
  
  log "INFO" "Status check complete"
}

# =====================================================================
# Main Function
# =====================================================================

function main() {
  # Process global options
  for arg in "$@"; do
    case ${arg} in
      --debug)
        DEBUG_MODE="true"
        shift
        ;;
      --quiet)
        QUIET_MODE="true"
        shift
        ;;
    esac
  done
  
  # Initialize log directory
  init_log_dir
  
  # Show help if no arguments
  if [[ $# -eq 0 ]]; then
    show_banner
    show_help
    exit 0
  fi
  
  # Parse command
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
    enterprise)
      shift
      do_enterprise "$@"
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

# Run main function
main "$@"