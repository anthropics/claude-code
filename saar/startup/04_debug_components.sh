#!/bin/bash
# SAAR - Debug Components Module
# 
# This module handles the Neural Recursive Debugging components
# and related debug tools.

# Function to setup debug components
setup_debug_components() {
  log "INFO" "Setting up Neural Recursive Debugging system..."

  # Create the necessary directories
  mkdir -p "$CONFIG_DIR/debug" "$TOOLS_DIR/debug" "$TEMPLATES_DIR" 
  mkdir -p "$VECTORDB_DIR" "$HISTORY_DIR" "$DASHBOARD_DIR"

  log "INFO" "Directories created for debugging components"

  # Copy debugging tools from the main repository
  copy_debug_tools
  
  # Setup vector database for code analysis
  setup_vector_db
  
  # Copy prompt templates
  copy_debug_templates
  
  # Setup dashboard
  install_debug_dashboard
  
  # Setup Git hooks for debugging integration
  setup_debug_git_hooks
  
  log "SUCCESS" "Neural Recursive Debugging system setup completed"
}

# Function to copy debugging tools
copy_debug_tools() {
  log "INFO" "Copying debugging tools..."
  
  # Check if source files exist
  if [ ! -f "$WORKSPACE_DIR/scripts/debug_workflow_engine.js" ]; then
    log "ERROR" "Missing debug_workflow_engine.js"
    return 1
  fi
  
  # Copy main debugging tools
  copy_file "$WORKSPACE_DIR/scripts/debug_workflow_engine.js" "$TOOLS_DIR/debug/"
  copy_file "$WORKSPACE_DIR/scripts/error_trigger.js" "$TOOLS_DIR/debug/"
  copy_file "$WORKSPACE_DIR/scripts/auto_debug.py" "$TOOLS_DIR/debug/"
  
  if [ -f "$WORKSPACE_DIR/core/rag/recursive_watcher.py" ]; then
    copy_file "$WORKSPACE_DIR/core/rag/recursive_watcher.py" "$TOOLS_DIR/debug/"
  else
    log "WARN" "recursive_watcher.py not found"
  fi
  
  # Copy configuration
  if [ -f "$WORKSPACE_DIR/core/config/debug_workflow_config.json" ]; then
    copy_file "$WORKSPACE_DIR/core/config/debug_workflow_config.json" "$CONFIG_DIR/debug/"
  else
    log "WARN" "debug_workflow_config.json not found"
  fi
  
  # Copy Git feature manager
  if [ -f "$WORKSPACE_DIR/scripts/setup/git_feature_manager.sh" ]; then
    copy_file "$WORKSPACE_DIR/scripts/setup/git_feature_manager.sh" "$TOOLS_DIR/debug/"
    chmod +x "$TOOLS_DIR/debug/git_feature_manager.sh"
  else
    log "WARN" "git_feature_manager.sh not found"
  fi
  
  log "SUCCESS" "Debugging tools copied"
}

# Function to copy debug templates
copy_debug_templates() {
  log "INFO" "Copying debug templates..."
  
  # Create templates directory if it doesn't exist
  mkdir -p "$TEMPLATES_DIR"
  
  # Check and copy all required templates
  local templates=(
    "recursive_bug_analysis.md"
    "stack_overflow_debugging.md"
    "recursive_optimization.md"
    "complex_bug_hunt.md"
    "systematic_debugging_workflow.md"
  )
  
  for template in "${templates[@]}"; do
    if [ -f "$WORKSPACE_DIR/docs/prompts/$template" ]; then
      copy_file "$WORKSPACE_DIR/docs/prompts/$template" "$TEMPLATES_DIR/"
    else
      log "WARN" "Template not found: $template"
    fi
  done
  
  log "SUCCESS" "Debug templates copied"
}

# Function to setup vector database for code analysis
setup_vector_db() {
  log "INFO" "Setting up vector database for code analysis..."
  
  # Check if the vector database updater exists
  if [ ! -f "$WORKSPACE_DIR/scripts/update_vector_db.js" ]; then
    log "ERROR" "Vector database updater not found"
    return 1
  fi
  
  # Copy the vector database updater
  copy_file "$WORKSPACE_DIR/scripts/update_vector_db.js" "$TOOLS_DIR/"
  
  # Setup npm packages if npm is available
  if command -v npm &> /dev/null; then
    log "INFO" "Installing required npm packages for vector database..."
    
    # Save current directory
    local current_dir=$(pwd)
    
    # Change to config directory and initialize npm if needed
    cd "$CONFIG_DIR" || { log "ERROR" "Failed to change to config directory"; return 1; }
    
    if [ ! -f "package.json" ]; then
      npm init -y > /dev/null || { log "ERROR" "Failed to initialize npm"; cd "$current_dir"; return 1; }
    fi
    
    # Install required packages
    npm install --no-fund --silent sqlite3 commander || { log "ERROR" "Failed to install npm packages"; cd "$current_dir"; return 1; }
    
    # Return to original directory
    cd "$current_dir" || { log "ERROR" "Failed to return to original directory"; return 1; }
    
    log "SUCCESS" "Vector database dependencies installed"
  else
    log "WARN" "npm not found, vector database dependencies must be installed manually"
    log "WARN" "Required dependencies: sqlite3, commander"
  fi
  
  # Start initial code indexing in the background
  log "INFO" "Starting initial code indexing in the background..."
  
  # Check if node is available
  if ! command -v node &> /dev/null; then
    log "ERROR" "Node.js not found, cannot start indexing"
    return 1
  fi
  
  # Run indexing in the background
  node "$TOOLS_DIR/update_vector_db.js" index --path "$WORKSPACE_DIR" &
  
  # Store the PID for later use
  local indexing_pid=$!
  echo "$indexing_pid" > "$CONFIG_DIR/.indexing_pid"
  
  log "SUCCESS" "Code indexing started (PID: $indexing_pid)"
  log "INFO" "The indexing process runs in the background and may take some time to complete"
}

# Function to install debug dashboard
install_debug_dashboard() {
  log "INFO" "Installing debug dashboard..."
  
  # Check if dashboard components exist
  if [ ! -f "$WORKSPACE_DIR/scripts/dashboard/dashboard.html" ] || \
     [ ! -f "$WORKSPACE_DIR/scripts/dashboard/server.js" ] || \
     [ ! -f "$WORKSPACE_DIR/scripts/dashboard/start-dashboard.sh" ]; then
    log "ERROR" "Dashboard components not found"
    return 1
  fi
  
  # Copy dashboard components
  copy_file "$WORKSPACE_DIR/scripts/dashboard/dashboard.html" "$DASHBOARD_DIR/"
  copy_file "$WORKSPACE_DIR/scripts/dashboard/server.js" "$DASHBOARD_DIR/"
  copy_file "$WORKSPACE_DIR/scripts/dashboard/start-dashboard.sh" "$DASHBOARD_DIR/"
  
  # Make the startup script executable
  chmod +x "$DASHBOARD_DIR/start-dashboard.sh"
  
  # Create a symlink for easy access
  if [ -f "$CONFIG_DIR/bin/start-dashboard.sh" ]; then
    rm "$CONFIG_DIR/bin/start-dashboard.sh"
  fi
  
  # Create bin directory if it doesn't exist
  mkdir -p "$CONFIG_DIR/bin"
  
  # Create symlink
  ln -sf "$DASHBOARD_DIR/start-dashboard.sh" "$CONFIG_DIR/bin/start-dashboard.sh"
  
  log "SUCCESS" "Debug dashboard installed"
  log "INFO" "You can start the dashboard with: $CONFIG_DIR/bin/start-dashboard.sh"
}

# Function to setup Git hooks for debugging integration
setup_debug_git_hooks() {
  log "INFO" "Setting up Git hooks for debugging integration..."
  
  # Check if we're in a Git repository
  if ! command -v git &> /dev/null || ! git -C "$WORKSPACE_DIR" rev-parse --is-inside-work-tree &> /dev/null; then
    log "WARN" "Not a Git repository or Git not installed, skipping Git hooks setup"
    return 0
  fi
  
  # Hooks directory
  local hooks_dir="$WORKSPACE_DIR/.git/hooks"
  
  # Check if hooks directory exists
  if [ ! -d "$hooks_dir" ]; then
    log "ERROR" "Git hooks directory not found: $hooks_dir"
    return 1
  fi
  
  # Setup pre-commit hook
  local pre_commit_hook="$hooks_dir/pre-commit"
  
  # Backup existing hook if present
  if [ -f "$pre_commit_hook" ]; then
    log "INFO" "Backing up existing pre-commit hook to pre-commit.bak"
    cp "$pre_commit_hook" "$pre_commit_hook.bak"
  fi
  
  # Create pre-commit hook
  cat > "$pre_commit_hook" << 'EOF'
#!/bin/bash

# Neural Recursive Debugging - Pre-Commit-Hook
echo "Running recursive debug check..."

# Path to debugging tools
CLAUDE_DIR=".claude"
DEBUG_DIR="$CLAUDE_DIR/tools/debug"
DEBUG_ENGINE="$DEBUG_DIR/debug_workflow_engine.js"

# Check if debug engine exists
if [ ! -f "$DEBUG_ENGINE" ]; then
    echo "Debug engine not found: $DEBUG_ENGINE"
    exit 0  # Don't fail the commit
fi

# Get list of changed files
changed_files=$(git diff --cached --name-only --diff-filter=ACMR)

# Filter for code files
code_files=$(echo "$changed_files" | grep -E '\.(js|py|ts|java|cpp|c|go|rs)$' || true)

if [ -z "$code_files" ]; then
    echo "No relevant code files changed."
    exit 0
fi

# Check for recursive functions
for file in $code_files; do
    echo "Checking $file..."
    
    # Quick check for recursive patterns
    if grep -q -E '(function\s+\w+\s*\([^)]*\)\s*\{.*\1\s*\()|(def\s+\w+\s*\([^)]*\).*\1\s*\()' "$file"; then
        echo "Potential recursive function found in $file."
        
        # Run quick analysis
        if ! node "$DEBUG_ENGINE" run quick --file "$file" --output json; then
            echo "Warning: Recursion issue found in $file."
            echo "Commit will proceed, but please check the file for stack overflow risks."
        fi
    fi
done

# Always exit successfully (don't block)
exit 0
EOF

  # Make the hook executable
  chmod +x "$pre_commit_hook"
  log "SUCCESS" "Pre-commit hook installed"
  
  # Setup post-checkout hook
  local post_checkout_hook="$hooks_dir/post-checkout"
  
  # Backup existing hook if present
  if [ -f "$post_checkout_hook" ]; then
    log "INFO" "Backing up existing post-checkout hook to post-checkout.bak"
    cp "$post_checkout_hook" "$post_checkout_hook.bak"
  fi
  
  # Create post-checkout hook
  cat > "$post_checkout_hook" << 'EOF'
#!/bin/bash

# Neural Recursive Debugging - Post-Checkout-Hook
BRANCH=$(git branch --show-current)

# Only for feature branches
if [[ "$BRANCH" == feature/* ]]; then
    echo "Feature branch detected: $BRANCH"
    
    # Update vector database
    CLAUDE_DIR=".claude"
    VECTOR_UPDATER="$CLAUDE_DIR/tools/update_vector_db.js"
    
    if [ -f "$VECTOR_UPDATER" ]; then
        echo "Updating vector database for branch $BRANCH..."
        node "$VECTOR_UPDATER" branch "$BRANCH" &
    fi
fi

exit 0
EOF

  # Make the hook executable
  chmod +x "$post_checkout_hook"
  log "SUCCESS" "Post-checkout hook installed"
}

# Function to run recursive debugging workflow
run_debug_workflow() {
  log "INFO" "Running recursive debugging workflow..."
  
  local workflow=${1:-"standard"}
  local file_path=${2:-""}
  
  # Check if debug engine exists
  if [ ! -f "$TOOLS_DIR/debug/debug_workflow_engine.js" ]; then
    log "ERROR" "Debug workflow engine not found"
    return 1
  fi
  
  # Check if file path is provided
  if [ -z "$file_path" ]; then
    log "ERROR" "No file specified for debugging"
    log "INFO" "Usage: run_debug_workflow <workflow> <file_path>"
    return 1
  fi
  
  # Check if file exists
  if [ ! -f "$file_path" ]; then
    log "ERROR" "File not found: $file_path"
    return 1
  }
  
  # Run the debug workflow
  log "INFO" "Running $workflow debug workflow on $file_path"
  node "$TOOLS_DIR/debug/debug_workflow_engine.js" run "$workflow" --file "$file_path"
  
  log "SUCCESS" "Debug workflow completed"
}

# Function to create a debug report
create_debug_report() {
  log "INFO" "Creating debug report..."
  
  local report_file="$CONFIG_DIR/debug/debug_report_$(date +'%Y%m%d_%H%M%S').json"
  
  # Collect system information
  log "INFO" "Collecting system information..."
  
  {
    echo "{"
    echo "  \"report_time\": \"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\","
    echo "  \"system_info\": {"
    
    # Node.js version
    if command -v node &> /dev/null; then
      echo "    \"node_version\": \"$(node -v)\","
    else
      echo "    \"node_version\": \"not installed\","
    fi
    
    # Python version
    if command -v python3 &> /dev/null; then
      echo "    \"python_version\": \"$(python3 --version 2>&1)\","
    else
      echo "    \"python_version\": \"not installed\","
    fi
    
    # Git version
    if command -v git &> /dev/null; then
      echo "    \"git_version\": \"$(git --version)\","
    else
      echo "    \"git_version\": \"not installed\","
    fi
    
    # OS information
    echo "    \"os_type\": \"$(uname -s)\","
    echo "    \"os_release\": \"$(uname -r)\""
    
    echo "  },"
    
    # Debug tools status
    echo "  \"debug_tools\": {"
    
    # Check debug workflow engine
    if [ -f "$TOOLS_DIR/debug/debug_workflow_engine.js" ]; then
      echo "    \"debug_workflow_engine\": \"installed\","
    else
      echo "    \"debug_workflow_engine\": \"not installed\","
    fi
    
    # Check vector database updater
    if [ -f "$TOOLS_DIR/update_vector_db.js" ]; then
      echo "    \"vector_db_updater\": \"installed\","
    else
      echo "    \"vector_db_updater\": \"not installed\","
    fi
    
    # Check dashboard
    if [ -f "$DASHBOARD_DIR/start-dashboard.sh" ]; then
      echo "    \"dashboard\": \"installed\","
    else
      echo "    \"dashboard\": \"not installed\","
    fi
    
    # Check Git hooks
    if [ -f "$WORKSPACE_DIR/.git/hooks/pre-commit" ] && grep -q "Neural Recursive Debugging" "$WORKSPACE_DIR/.git/hooks/pre-commit"; then
      echo "    \"git_hooks\": \"installed\""
    else
      echo "    \"git_hooks\": \"not installed\""
    fi
    
    echo "  },"
    
    # Debug configuration
    echo "  \"debug_config\": {"
    
    # Check debug configuration file
    if [ -f "$CONFIG_DIR/debug/debug_workflow_config.json" ]; then
      echo "    \"workflow_config\": \"present\","
      
      # Get number of workflows
      if command -v jq &> /dev/null; then
        local workflow_count=$(jq '.workflows | length' "$CONFIG_DIR/debug/debug_workflow_config.json" 2>/dev/null || echo "unknown")
        echo "    \"workflow_count\": $workflow_count"
      else
        echo "    \"workflow_count\": \"unknown (jq not installed)\""
      fi
    else
      echo "    \"workflow_config\": \"missing\","
      echo "    \"workflow_count\": 0"
    fi
    
    echo "  }"
    
    echo "}"
  } > "$report_file"
  
  log "SUCCESS" "Debug report created: $report_file"
  
  # Display the report path
  echo "Debug report saved to: $report_file"
}