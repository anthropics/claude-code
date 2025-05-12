#!/bin/bash

# SAAR Startup - Dependency Checker
# Checks for required dependencies and versions

# Source common functions if running standalone
if [ -z "$LOG_FILE" ]; then
  source "$(dirname "$0")/00_common.sh"
fi

# Check basic dependencies
check_basic_dependencies() {
  log "INFO" "Checking basic system dependencies"

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
          version=$(node -v 2>/dev/null || echo "unknown")
          ;;
        npm)
          version=$(npm -v 2>/dev/null || echo "unknown")
          ;;
        python3)
          version=$(python3 --version 2>/dev/null || echo "unknown")
          ;;
        git)
          version=$(git --version 2>/dev/null || echo "unknown")
          ;;
      esac
      log "DEBUG" "Found $cmd: $version"
    fi
  done

  if [ $missing -gt 0 ]; then
    log "ERROR" "Missing $missing basic dependencies. Please install required dependencies."
    return 1
  fi

  # Check Node.js version - safely
  if node -v > /dev/null 2>&1; then
    local node_version
    node_version=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [[ "$node_version" =~ ^[0-9]+$ ]] && [ "$node_version" -lt 16 ]; then
      log "WARN" "Node.js version $node_version detected. Version 16+ is recommended."
    fi
  fi

  # Check npm version - safely
  if npm -v > /dev/null 2>&1; then
    local npm_version
    npm_version=$(npm -v | cut -d '.' -f 1)
    if [[ "$npm_version" =~ ^[0-9]+$ ]] && [ "$npm_version" -lt 7 ]; then
      log "WARN" "npm version $npm_version detected. Version 7+ is recommended."
    fi
  fi

  log "INFO" "All basic dependencies satisfied"
  return 0
}

# Check advanced dependencies
check_advanced_dependencies() {
  log "INFO" "Checking advanced dependencies"
  
  local missing=0
  local optional_missing=0
  
  # Python packages
  if command -v python3 &> /dev/null; then
    # Required packages
    local required_py_packages=("anthropic" "requests")
    for pkg in "${required_py_packages[@]}"; do
      if ! python3 -c "import $pkg" &> /dev/null; then
        log "WARN" "Python package $pkg not found"
        missing=$((missing+1))
      else
        log "DEBUG" "Found Python package: $pkg"
      fi
    done
    
    # Optional packages
    local optional_py_packages=("lancedb" "chromadb" "voyage" "sentence_transformers")
    for pkg in "${optional_py_packages[@]}"; do
      if ! python3 -c "import $pkg" &> /dev/null; then
        log "DEBUG" "Optional Python package $pkg not found"
        optional_missing=$((optional_missing+1))
      else
        log "DEBUG" "Found optional Python package: $pkg"
      fi
    done
  fi
  
  # Node.js packages
  if command -v npm &> /dev/null; then
    # Check if global package is installed
    check_npm_global_package() {
      local pkg=$1
      if ! npm list -g "$pkg" --depth=0 &> /dev/null; then
        return 1
      fi
      return 0
    }
    
    # Required npm packages
    local required_npm_packages=("@anthropic/sdk")
    for pkg in "${required_npm_packages[@]}"; do
      if ! check_npm_global_package "$pkg"; then
        log "WARN" "NPM package $pkg not found globally"
        missing=$((missing+1))
      else
        log "DEBUG" "Found NPM package: $pkg"
      fi
    done
  fi
  
  # OS-specific tools
  case "$(uname -s)" in
    Linux*)
      # Check for Linux tools
      local linux_tools=("jq")
      for tool in "${linux_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
          log "WARN" "Linux tool $tool not found"
          missing=$((missing+1))
        else
          log "DEBUG" "Found Linux tool: $tool"
        fi
      done
      ;;
    Darwin*)
      # Check for macOS tools
      local macos_tools=("jq")
      for tool in "${macos_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
          log "WARN" "macOS tool $tool not found"
          missing=$((missing+1))
        else
          log "DEBUG" "Found macOS tool: $tool"
        fi
      done
      ;;
  esac
  
  if [ $missing -gt 0 ]; then
    log "WARN" "Missing $missing advanced dependencies. Some features may not work correctly."
  fi
  
  if [ $optional_missing -gt 0 ]; then
    log "DEBUG" "Missing $optional_missing optional dependencies."
  fi
  
  log "INFO" "Advanced dependency check complete"
  return $([ $missing -eq 0 ])
}

# Setup advanced dependencies if needed
setup_advanced_dependencies() {
  log "INFO" "Setting up advanced dependencies"
  
  # Python packages
  if command -v python3 &> /dev/null && command -v pip3 &> /dev/null; then
    log "INFO" "Installing required Python packages"
    run_command "pip3 install anthropic requests" "Failed to install required Python packages"
    
    # Ask about optional packages
    if [ "$QUIET_MODE" != "true" ]; then
      read -p "Install optional Python packages for RAG functionality? (y/N): " install_optional
      if [[ "$install_optional" =~ ^[Yy]$ ]]; then
        log "INFO" "Installing optional Python packages"
        run_command "pip3 install lancedb chromadb voyage sentence-transformers" "Failed to install optional Python packages" 
      fi
    fi
  fi
  
  # Node.js packages
  if command -v npm &> /dev/null; then
    log "INFO" "Installing required NPM packages"
    run_command "npm install -g @anthropic/sdk" "Failed to install required NPM packages"
  fi
  
  # OS-specific tools
  case "$(uname -s)" in
    Linux*)
      if command -v apt-get &> /dev/null; then
        log "INFO" "Installing required Linux tools"
        run_command "sudo apt-get update && sudo apt-get install -y jq" "Failed to install required Linux tools"
      elif command -v yum &> /dev/null; then
        log "INFO" "Installing required Linux tools"
        run_command "sudo yum install -y jq" "Failed to install required Linux tools"
      fi
      ;;
    Darwin*)
      if command -v brew &> /dev/null; then
        log "INFO" "Installing required macOS tools"
        run_command "brew install jq" "Failed to install required macOS tools"
      else
        log "WARN" "Homebrew not found. Please install Homebrew to install required macOS tools."
      fi
      ;;
  esac
  
  log "INFO" "Advanced dependency setup complete"
  return 0
}

# Main dependency check function
check_dependencies() {
  # Check for startup lock
  check_startup_lock || return 1
  
  # Create lock
  create_startup_lock "dependency_check"
  
  # Run basic checks
  check_basic_dependencies || { release_startup_lock; return 1; }
  
  # Run advanced checks
  local advanced_check_result=0
  check_advanced_dependencies || advanced_check_result=1
  
  # Offer to install missing advanced dependencies
  if [ $advanced_check_result -ne 0 ] && [ "$QUIET_MODE" != "true" ]; then
    read -p "Install missing advanced dependencies? (y/N): " install_deps
    if [[ "$install_deps" =~ ^[Yy]$ ]]; then
      setup_advanced_dependencies
    fi
  fi
  
  # Release lock
  release_startup_lock
  
  return 0
}

# If running as a script (not sourced), execute the main function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  # Parse options
  parse_options "$@"
  
  # Run dependency check
  check_dependencies
fi