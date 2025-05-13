#!/bin/bash

# SAAR Startup - Environment Setup
# Initializes the environment, configurations, and API keys

# Source common functions if running standalone
if [ -z "$LOG_FILE" ]; then
  source "$(dirname "$0")/00_common.sh"
fi

# Setup Schema UI integration
setup_schema_ui() {
  local theme=$1
  local user_id=$2
  
  if [ -d "$WORKSPACE_DIR/schema-ui-integration" ]; then
    log "INFO" "Setting up Schema UI"
    chmod +x "$WORKSPACE_DIR/schema-ui-integration/saar.sh"
    "$WORKSPACE_DIR/schema-ui-integration/saar.sh" setup --quick --theme="$theme" --user="$user_id"
  else
    log "WARN" "Schema UI integration not found. Skipping setup."
  fi
}

# Setup color schema
setup_color_schema() {
  local quick_mode=$1
  local theme=$2
  
  if [ "$quick_mode" = true ]; then
    log "INFO" "Setting up default color schema ($theme)"
    if [ -f "$WORKSPACE_DIR/core/mcp/color_schema_manager.js" ]; then
      node "$WORKSPACE_DIR/core/mcp/color_schema_manager.js" --template="$theme" --non-interactive > /dev/null
    elif [ -f "$WORKSPACE_DIR/scripts/setup/color_schema_wrapper.js" ]; then
      node "$WORKSPACE_DIR/scripts/setup/color_schema_wrapper.js" --template="$theme" --non-interactive > /dev/null
    else
      log "WARN" "Color schema manager not found. Skipping color schema setup."
    fi
  else
    log "INFO" "Setting up color schema interactively"
    if [ -f "$WORKSPACE_DIR/scripts/setup/setup_user_colorschema.js" ]; then
      node "$WORKSPACE_DIR/scripts/setup/setup_user_colorschema.js"
    else
      log "WARN" "Color schema setup script not found. Skipping color schema setup."
    fi
  fi
}

# Setup about profile
setup_about_profile() {
  local quick_mode=$1
  local user_id=$2
  local theme=$3
  
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
    log "INFO" "Setting up .about profile interactively"
    if [ -f "$WORKSPACE_DIR/scripts/setup/create_about.js" ]; then
      node "$WORKSPACE_DIR/scripts/setup/create_about.js" --user="$user_id"
    else
      log "WARN" "About profile creation script not found. Skipping interactive profile setup."
    fi
  fi
}

# Setup MCP servers
setup_mcp_servers() {
  log "INFO" "Configuring MCP servers"
  if [ -f "$WORKSPACE_DIR/core/mcp/setup_mcp.js" ]; then
    run_command "node \"$WORKSPACE_DIR/core/mcp/setup_mcp.js\"" "Failed to set up MCP servers" 
  else
    log "WARN" "MCP setup script not found. Skipping MCP server configuration."
  fi
  
  # Create symlink for easy access
  if [ -f "$WORKSPACE_DIR/core/mcp/start_server.js" ] && [ ! -L "$CONFIG_DIR/bin/start_mcp.js" ]; then
    log "INFO" "Creating symlink to MCP starter in $CONFIG_DIR/bin/"
    mkdir -p "$CONFIG_DIR/bin"
    ln -sf "$WORKSPACE_DIR/core/mcp/start_server.js" "$CONFIG_DIR/bin/start_mcp.js"
    log "INFO" "Symlink created"
  fi
}

# Setup Git Agent
setup_git_agent() {
  log "INFO" "Setting up Git Agent"

  if [ -f "$WORKSPACE_DIR/scripts/setup/setup_git_agent.js" ]; then
    run_command "node \"$WORKSPACE_DIR/scripts/setup/setup_git_agent.js\"" "Failed to set up Git Agent"
    log "INFO" "Git Agent setup complete"
  else
    log "WARN" "Git Agent setup script not found. Skipping Git Agent setup."
  fi
}

# Setup Virtual User Agent
setup_virtual_user_agent() {
  local user_id=$1

  log "INFO" "Setting up Virtual User Agent for $user_id"

  # Create agent directory
  local agent_dir="$CONFIG_DIR/agents"
  ensure_directory "$agent_dir"

  # Create Virtual User Agent configuration
  local agent_config="$agent_dir/${user_id}_agent.json"

  cat > "$agent_config" << EOF
{
  "version": "1.0.0",
  "agentId": "virtual-agent-${user_id}",
  "userId": "$user_id",
  "created": "$(get_timestamp)",
  "lastActive": "$(get_timestamp)",
  "capabilities": [
    "dashboard-management",
    "project-monitoring",
    "code-assistance",
    "documentation-generation"
  ],
  "preferences": {
    "autoStart": true,
    "notificationLevel": "important",
    "dashboardIntegration": true
  },
  "status": "active"
}
EOF

  log "INFO" "Virtual User Agent setup complete"
  log "DEBUG" "Agent configuration saved to: $agent_config"

  return 0
}

# Setup User Main Dashboard
setup_user_main_dashboard() {
  local user_id=$1
  local theme=$2

  log "INFO" "Setting up User Main Dashboard for $user_id"

  # Create dashboard directory
  local dashboard_dir="$CONFIG_DIR/dashboard"
  ensure_directory "$dashboard_dir"

  # Create dashboard configuration
  local dashboard_config="$dashboard_dir/${user_id}_dashboard.json"

  cat > "$dashboard_config" << EOF
{
  "version": "1.0.0",
  "dashboardId": "main-dashboard-${user_id}",
  "userId": "$user_id",
  "created": "$(get_timestamp)",
  "lastModified": "$(get_timestamp)",
  "theme": "$theme",
  "panels": [
    {
      "id": "projects",
      "title": "Projects",
      "position": "top-left",
      "type": "project-list",
      "size": "medium"
    },
    {
      "id": "agent-status",
      "title": "Virtual Agent Status",
      "position": "top-right",
      "type": "agent-status",
      "size": "small"
    },
    {
      "id": "recent-activities",
      "title": "Recent Activities",
      "position": "bottom",
      "type": "activity-log",
      "size": "large"
    }
  ],
  "settings": {
    "refreshInterval": 30,
    "autoRefresh": true,
    "defaultView": "overview",
    "showAgentStatus": true
  }
}
EOF

  # Create symlink to dashboard starter
  if [ -f "$WORKSPACE_DIR/scripts/dashboard/start-dashboard.sh" ]; then
    log "INFO" "Creating dashboard start script"

    # Create user dashboard directory
    ensure_directory "$CONFIG_DIR/bin"

    # Create dashboard starter script
    cat > "$CONFIG_DIR/bin/start-dashboard.sh" << EOF
#!/bin/bash

# User Main Dashboard Starter Script
# Generated by SAAR Startup

# Set environment variables
export USERMAINDASHBOARD="$dashboard_config"
export USERAGENT="$CONFIG_DIR/agents/${user_id}_agent.json"
export USER_ID="$user_id"
export DASHBOARD_THEME="$theme"

# Start the dashboard
if [ -f "$WORKSPACE_DIR/scripts/dashboard/start-dashboard.sh" ]; then
  bash "$WORKSPACE_DIR/scripts/dashboard/start-dashboard.sh"
else
  echo "Dashboard script not found: $WORKSPACE_DIR/scripts/dashboard/start-dashboard.sh"
  exit 1
fi
EOF

    # Make script executable
    chmod +x "$CONFIG_DIR/bin/start-dashboard.sh"

    log "INFO" "Dashboard start script created: $CONFIG_DIR/bin/start-dashboard.sh"
  else
    log "WARN" "Dashboard script not found. Dashboard integration will be limited."
  fi

  log "INFO" "User Main Dashboard setup complete"
  log "DEBUG" "Dashboard configuration saved to: $dashboard_config"

  return 0
}

# Configure API keys
setup_configure_api_keys() {
  local quick_mode=$1
  
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
}

# Install required NPM packages
setup_install_packages() {
  local quick_mode=$1
  
  log "INFO" "Installing required packages"
  
  if [ ! -f "$WORKSPACE_DIR/package.json" ]; then
    log "WARN" "No package.json found in workspace. Skipping package installation."
    return 0
  fi
  
  if [ "$quick_mode" = true ]; then
    run_command "cd \"$WORKSPACE_DIR\" && npm install --quiet" "Failed to install NPM packages"
  else
    run_command "cd \"$WORKSPACE_DIR\" && npm install" "Failed to install NPM packages"
  fi
  
  return 0
}

# Setup workspace
setup_workspace() {
  local user_id=$1
  local theme=$2
  local quick_mode=$3

  # Create project directories if needed
  log "INFO" "Setting up workspace structure"
  ensure_directory "$WORKSPACE_DIR/projects"

  # Setup workspace config
  log "INFO" "Creating workspace configuration"
  ensure_directory "$WORKSPACE_DIR/.claude"
  echo "{\"workspaceVersion\": \"2.1.0\", \"setupCompleted\": true, \"lastUpdate\": \"$(date '+%Y-%m-%d')\"}" > "$WORKSPACE_DIR/.claude/workspace.json"

  # Create system record in memory
  ensure_directory "$STORAGE_DIR"
  echo "{\"systemId\": \"agentic-os-$(date +%s)\", \"setupDate\": \"$(date '+%Y-%m-%d')\", \"setupMode\": \"$([[ \"$quick_mode\" == true ]] && echo 'quick' || echo 'interactive')\"}" > "$STORAGE_DIR/system-info.json"

  # Setup Virtual User Agent
  setup_virtual_user_agent "$user_id"

  # Setup User Main Dashboard
  setup_user_main_dashboard "$user_id" "$theme"
}

# Parse setup options
parse_setup_options() {
  local options=("$@")
  local quick_mode=false
  local force_mode=false
  local theme="dark"
  local user_id="$DEFAULT_USER"
  
  # Parse options
  for arg in "${options[@]}"; do
    case $arg in
      --quick)
        quick_mode=true
        ;;
      --force)
        force_mode=true
        ;;
      --theme=*)
        theme="${arg#*=}"
        ;;
      --user=*)
        user_id="${arg#*=}"
        ;;
    esac
  done
  
  echo "$quick_mode $force_mode $theme $user_id"
}

# Main setup function
do_setup() {
  # Check for startup lock
  check_startup_lock || return 1
  
  # Create lock
  create_startup_lock "setup"
  
  # Parse options
  read -r quick_mode force_mode theme user_id <<< $(parse_setup_options "$@")
  
  log "INFO" "Setting up Agentic OS"
  log "DEBUG" "Setup options: quick_mode=$quick_mode, force_mode=$force_mode, theme=$theme, user_id=$user_id"
  
  # Load dependency checker if available
  if [ -f "$(dirname "$0")/01_dependency_check.sh" ]; then
    source "$(dirname "$0")/01_dependency_check.sh"
    check_dependencies || { release_startup_lock; return 1; }
  else
    log "WARN" "Dependency checker not found. Skipping dependency check."
  fi
  
  # Execute setup phases
  setup_install_packages "$quick_mode"
  setup_configure_api_keys "$quick_mode"
  setup_schema_ui "$theme" "$user_id"
  setup_color_schema "$quick_mode" "$theme"
  setup_about_profile "$quick_mode" "$user_id" "$theme"
  setup_mcp_servers
  setup_git_agent
  
  # Initialize memory if needed
  if [ ! -f "$MEMORY_FILE" ]; then
    log "INFO" "Initializing memory system"
    ensure_directory "$STORAGE_DIR"
    echo "{}" > "$MEMORY_FILE"
    log "INFO" "Memory file created: $MEMORY_FILE"
  fi
  
  # Setup workspace last (depends on previous steps)
  setup_workspace "$user_id" "$theme" "$quick_mode"
  
  # Release the lock
  release_startup_lock
  
  log "INFO" "Setup complete"
  
  # Show completion message
  echo -e "${GREEN}${BOLD}Agentic OS setup complete!${NC}"
  echo -e "${CYAN}Your system is ready to use.${NC}"
  echo ""
  echo -e "To start all services:    ${BOLD}./saar.sh start${NC}"
  echo -e "To configure a project:   ${BOLD}./saar.sh project${NC}"
  echo -e "To launch Claude agent:   ${BOLD}./saar.sh agent${NC}"
  echo -e "To launch the dashboard:  ${BOLD}./saar.sh dashboard${NC}"
  echo -e "To check system status:   ${BOLD}./saar.sh status${NC}"
  echo ""
  
  return 0
}

# If running as a script (not sourced), execute the main function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  # Parse options
  parse_options "$@"
  
  # Run setup
  do_setup "$@"
fi