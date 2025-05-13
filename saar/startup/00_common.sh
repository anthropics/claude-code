#!/bin/bash

# SAAR Startup - Common Functions
# Contains shared utility functions and variables used across all startup modules

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
ROLLBACK_LOG="$CONFIG_DIR/rollback.log"
STARTUP_LOCK="$CONFIG_DIR/startup.lock"

# Additional directories for neural framework and debug components
TOOLS_DIR="$CONFIG_DIR/tools"
TEMPLATES_DIR="$CONFIG_DIR/templates"
VECTORDB_DIR="$CONFIG_DIR/vectordb"
HISTORY_DIR="$CONFIG_DIR/history"
DASHBOARD_DIR="$TOOLS_DIR/dashboard"
CLAUDE_DIR="$WORKSPACE_DIR/.claude"
AI_DOCS_DIR="$WORKSPACE_DIR/ai_docs"
SPECS_DIR="$WORKSPACE_DIR/specs"

# Debug and quiet mode flags
export DEBUG_MODE=false
export QUIET_MODE=false

# Get a timestamp in standard format
get_timestamp() {
  date "+%Y-%m-%d %H:%M:%S"
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
      SUCCESS)
        echo -e "${CYAN}[SUCCESS]${NC} $message"
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

# Get a date with offset (compatible with BSD and GNU date)
get_date_with_offset() {
  local days=$1
  date -d "+$days days" "+%Y-%m-%d" 2>/dev/null || date -v+${days}d "+%Y-%m-%d"
}

# Check if a file exists
check_file_exists() {
  local file_path=$1
  local error_message=${2:-"File not found: $file_path"}
  
  if [ ! -f "$file_path" ]; then
    log "ERROR" "$error_message"
    return 1
  fi
  return 0
}

# Create directory if it doesn't exist
ensure_directory() {
  local dir_path=$1
  
  if [ ! -d "$dir_path" ]; then
    mkdir -p "$dir_path"
    log "DEBUG" "Created directory: $dir_path"
  fi
  return 0
}

# Cross-platform safe sed function
safe_sed() {
  local pattern="$1"
  local file="$2"
  local temp_file

  # Check if file exists
  if [ ! -f "$file" ]; then
    log "ERROR" "File not found: $file"
    return 1
  fi

  # Create a temporary file
  temp_file=$(mktemp)
  if [ $? -ne 0 ]; then
    log "ERROR" "Failed to create temporary file"
    return 1
  fi

  # Copy file content to temp file
  cat "$file" > "$temp_file"

  # Detect OS and apply sed
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "$pattern" "$temp_file" 2>/dev/null
  else
    # Linux and others
    sed -i "$pattern" "$temp_file" 2>/dev/null
  fi

  # Check if sed was successful
  if [ $? -eq 0 ]; then
    # Copy back only if successful
    cat "$temp_file" > "$file"
    log "DEBUG" "Successfully updated file: $file"
  else
    log "ERROR" "Failed to perform sed operation on $file"
    rm -f "$temp_file"
    return 1
  fi

  # Clean up
  rm -f "$temp_file"
  return 0
}

# Run a command with proper error handling and rollback capability
run_command() {
  local command=$1
  local error_message=${2:-"Command failed: $command"}
  local rollback_command=${3:-""}
  
  # Log the command being executed
  log "DEBUG" "Running command: $command"
  
  # Execute the command
  if ! eval "$command"; then
    log "ERROR" "$error_message"
    
    # If rollback command is provided, execute it
    if [ ! -z "$rollback_command" ]; then
      log "WARN" "Attempting to rollback: $rollback_command"
      
      # Log rollback to rollback log
      echo "$(get_timestamp) - ROLLBACK - Command: $command - Rollback: $rollback_command" >> "$ROLLBACK_LOG"
      
      # Execute rollback
      if ! eval "$rollback_command"; then
        log "ERROR" "Rollback failed: $rollback_command"
      else
        log "INFO" "Rollback successful"
      fi
    fi
    
    return 1
  fi
  
  log "DEBUG" "Command completed successfully"
  return 0
}

# Create a startup lock
create_startup_lock() {
  local stage=$1
  echo "{\"stage\": \"$stage\", \"timestamp\": \"$(get_timestamp)\", \"pid\": $$}" > "$STARTUP_LOCK"
}

# Release the startup lock
release_startup_lock() {
  rm -f "$STARTUP_LOCK"
}

# Check for startup lock
check_startup_lock() {
  if [ -f "$STARTUP_LOCK" ]; then
    local lock_pid=$(grep -o '\"pid\": [0-9]*' "$STARTUP_LOCK" | cut -d' ' -f2)
    local lock_stage=$(grep -o '\"stage\": \"[^\"]*' "$STARTUP_LOCK" | cut -d'"' -f4)
    local lock_timestamp=$(grep -o '\"timestamp\": \"[^\"]*' "$STARTUP_LOCK" | cut -d'"' -f4)
    
    # Check if the process is still running
    if ps -p "$lock_pid" > /dev/null 2>&1; then
      log "WARN" "Another startup process is running (PID: $lock_pid, Stage: $lock_stage, Started: $lock_timestamp)"
      return 1
    else
      log "WARN" "Found stale lock file. Removing."
      release_startup_lock
      return 0
    fi
  fi
  
  return 0
}

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
  echo "Version: 2.1.0"
  echo
}

# Parse options
parse_options() {
  local args=("$@")
  
  # Process global options
  for arg in "${args[@]}"; do
    case $arg in
      --debug)
        export DEBUG_MODE=true
        log "DEBUG" "Debug mode enabled"
        ;;
      --quiet)
        export QUIET_MODE=true
        ;;
    esac
  done
}

# Initialize the environment
init_environment() {
  # Check for startup lock first
  check_startup_lock || return 1
  
  # Create lock
  create_startup_lock "init"
  
  # Ensure directories exist
  ensure_directory "$CONFIG_DIR"
  ensure_directory "$STORAGE_DIR"
  ensure_directory "$CONFIG_DIR/backups"
  ensure_directory "$CONFIG_DIR/profiles"
  ensure_directory "$CONFIG_DIR/bin"
  
  # Create .claude directory in workspace if it doesn't exist
  if [ ! -d "$WORKSPACE_DIR/.claude" ]; then
    mkdir -p "$WORKSPACE_DIR/.claude"
  fi
  
  # Create rollback log if it doesn't exist
  if [ ! -f "$ROLLBACK_LOG" ]; then
    touch "$ROLLBACK_LOG"
  fi
  
  # Release lock
  release_startup_lock
  
  return 0
}

# Compare two version strings
# Returns 0 if version1 >= version2, 1 otherwise
compare_versions() {
  local version1="$1"
  local version2="$2"
  
  # Remove any non-version characters (only keep numbers and dots)
  version1=$(echo "$version1" | sed 's/[^0-9.]//g')
  version2=$(echo "$version2" | sed 's/[^0-9.]//g')
  
  if [ "$(printf '%s\n' "$version1" "$version2" | sort -V | head -n1)" = "$version2" ]; then
    return 0
  else
    return 1
  fi
}

# Copy a file with error checking
copy_file() {
  local source=$1
  local destination=$2
  
  # Check if source exists
  if [ ! -f "$source" ]; then
    log "ERROR" "Source file does not exist: $source"
    return 1
  fi
  
  # Create destination directory if needed
  local dest_dir=$(dirname "$destination")
  if [ ! -d "$dest_dir" ]; then
    mkdir -p "$dest_dir"
  fi
  
  # Copy the file
  if ! cp "$source" "$destination"; then
    log "ERROR" "Failed to copy $source to $destination"
    return 1
  fi
  
  log "DEBUG" "Copied $source to $destination"
  return 0
}

# Export common functions
export -f get_timestamp
export -f log
export -f get_date_with_offset
export -f check_file_exists
export -f ensure_directory
export -f safe_sed
export -f run_command
export -f create_startup_lock
export -f release_startup_lock
export -f check_startup_lock
export -f show_banner
export -f compare_versions
export -f init_environment
export -f parse_options
export -f copy_file

# Initialize environment when this script is sourced
init_environment