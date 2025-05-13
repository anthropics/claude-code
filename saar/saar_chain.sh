#!/bin/bash

# SAAR Chain - Main Startup Chain Script
# Version: 2.1.0
# 
# This script chains together all the modular startup components
# for the Claude Neural Framework and Agentic OS.

# Base directory where the startup scripts are located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STARTUP_DIR="$SCRIPT_DIR/startup"

# Source the common utilities first
source "$STARTUP_DIR/00_common.sh"

# Function to check system status
do_status_check() {
  log "INFO" "Checking system status..."
  
  echo -e "${BOLD}AGENTIC OS STATUS${NC}"
  echo -e "======================"
  echo ""
  
  # Check workspace
  echo -e "${BOLD}Workspace:${NC}"
  if [ -f "$WORKSPACE_DIR/.claude/workspace.json" ]; then
    workspace_version=$(grep -o '"workspaceVersion": "[^"]*' "$WORKSPACE_DIR/.claude/workspace.json" | cut -d'"' -f4)
    setup_completed=$(grep -o '"setupCompleted": [^,]*' "$WORKSPACE_DIR/.claude/workspace.json" | cut -d' ' -f2)
    
    echo -e "Version: ${workspace_version:-Unknown}"
    echo -e "Setup complete: ${setup_completed:-false}"
  else
    echo -e "Status: ${YELLOW}Not initialized${NC}"
  fi
  echo ""
  
  # Check MCP servers
  echo -e "${BOLD}MCP Servers:${NC}"
  if [ -f "$WORKSPACE_DIR/core/mcp/server_config.json" ]; then
    if command -v jq &> /dev/null; then
      server_count=$(jq '.servers | length' "$WORKSPACE_DIR/core/mcp/server_config.json" 2>/dev/null || echo "Unknown")
      echo -e "Configured servers: ${server_count}"
      
      # List a few servers
      jq -r '.servers | keys | .[]' "$WORKSPACE_DIR/core/mcp/server_config.json" 2>/dev/null | head -n 5 | while read -r server; do
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
    running_servers=$(ps aux | grep -c "[n]ode.*mcp")
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
    memory_size=$(stat -c%s "$MEMORY_FILE" 2>/dev/null || stat -f%z "$MEMORY_FILE")
    echo -e "Status: ${GREEN}Active${NC}"
    echo -e "Size: ${memory_size} bytes"
  else
    echo -e "Status: ${YELLOW}Not initialized${NC}"
  fi
  echo ""
  
  # Check Schema UI
  echo -e "${BOLD}Schema UI:${NC}"
  if [ -d "$WORKSPACE_DIR/schema-ui-integration" ]; then
    echo -e "Status: ${GREEN}Installed${NC}"
    
    if [ -f "$WORKSPACE_DIR/schema-ui-integration/package.json" ]; then
      ui_version=$(grep -o '"version": "[^"]*' "$WORKSPACE_DIR/schema-ui-integration/package.json" | cut -d'"' -f4)
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
    profile_count=$(ls -1 "$CONFIG_DIR/profiles" | grep ".about.json" | wc -l)
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
  
  # Check Neural Framework components
  echo -e "${BOLD}Neural Framework:${NC}"
  if [ -d "$AI_DOCS_DIR" ]; then
    template_count=$(find "$AI_DOCS_DIR/templates" -type f | wc -l)
    echo -e "Status: ${GREEN}Installed${NC}"
    echo -e "Templates: ${template_count:-0}"
  else
    echo -e "Status: ${YELLOW}Not installed${NC}"
  fi
  echo ""
  
  # Check Debugging components
  echo -e "${BOLD}Debugging Components:${NC}"
  if [ -d "$TOOLS_DIR/debug" ]; then
    tool_count=$(find "$TOOLS_DIR/debug" -type f | wc -l)
    echo -e "Status: ${GREEN}Installed${NC}"
    echo -e "Debug tools: ${tool_count:-0}"
    
    # Check vector database
    if [ -d "$VECTORDB_DIR" ]; then
      echo -e "Vector DB: ${GREEN}Found${NC}"
    else
      echo -e "Vector DB: ${YELLOW}Not configured${NC}"
    fi
  else
    echo -e "Status: ${YELLOW}Not installed${NC}"
  fi
  echo ""
  
  # Check Autonomy components
  echo -e "${BOLD}Autonomy System:${NC}"
  if [ -d "$CONFIG_DIR/autonomy" ] && [ -d "$TOOLS_DIR/autonomy" ]; then
    echo -e "Status: ${GREEN}Installed${NC}"
    
    # Check for plans
    if [ -d "$CONFIG_DIR/autonomy/plans" ]; then
      plan_count=$(find "$CONFIG_DIR/autonomy/plans" -name "*.json" 2>/dev/null | wc -l)
      echo -e "Saved plans: ${plan_count:-0}"
    fi
    
    # Check autonomy configuration
    if [ -f "$CONFIG_DIR/autonomy/config.json" ] && command -v jq &> /dev/null; then
      deepthink_depth=$(jq -r '.deepthink.recursion_depth' "$CONFIG_DIR/autonomy/config.json" 2>/dev/null || echo "Unknown")
      echo -e "DeepThink depth: ${deepthink_depth}"
    fi
  else
    echo -e "Status: ${YELLOW}Not installed${NC}"
  fi
  echo ""
  
  log "INFO" "Status check complete"
}

# Show the banner
show_banner

# Process command line arguments
if [ $# -eq 0 ]; then
  echo "Usage: $0 <command> [options]"
  echo "Run '$0 help' for available commands"
  exit 0
fi

# Command dispatcher
case "$1" in
  setup)
    shift
    
    log "INFO" "Starting setup chain..."
    
    # Source and run dependency check
    source "$STARTUP_DIR/01_dependency_check.sh"
    check_dependencies || exit 1
    
    # Source and run setup
    source "$STARTUP_DIR/02_setup.sh"
    do_setup "$@"
    
    # Source and run specialized components setup
    source "$STARTUP_DIR/03_specialized_components.sh"
    setup_specialized_components
    
    # Source and run debug components setup
    source "$STARTUP_DIR/04_debug_components.sh"
    setup_debug_components
    
    # Source and run neural framework setup
    source "$STARTUP_DIR/05_neural_framework.sh"
    setup_neural_framework
    
    # Source and run autonomy components setup
    source "$STARTUP_DIR/06_autonomy.sh"
    setup_autonomy_components
    
    log "INFO" "Setup chain completed successfully"
    ;;
    
  start)
    shift
    
    log "INFO" "Starting services..."
    
    # Start specific services based on arguments
    components=${1:-"all"}
    
    # Start MCP servers if available
    if [ "$components" = "all" ] || [ "$components" = "mcp" ]; then
      if [ -f "$WORKSPACE_DIR/core/mcp/start_server.js" ]; then
        log "INFO" "Starting MCP servers"
        node "$WORKSPACE_DIR/core/mcp/start_server.js"
      else
        log "ERROR" "MCP server starter not found: $WORKSPACE_DIR/core/mcp/start_server.js"
      fi
    fi
    
    # Start web dashboard if available
    if [ "$components" = "all" ] || [ "$components" = "dashboard" ]; then
      if [ -f "$WORKSPACE_DIR/scripts/dashboard/server.js" ]; then
        log "INFO" "Starting web dashboard"
        node "$WORKSPACE_DIR/scripts/dashboard/server.js" &
      else
        log "ERROR" "Dashboard server not found: $WORKSPACE_DIR/scripts/dashboard/server.js"
      fi
    fi
    
    # Start A2A Manager if available
    if [ "$components" = "all" ] || [ "$components" = "a2a" ]; then
      if [ -f "$WORKSPACE_DIR/core/mcp/a2a_manager.js" ]; then
        log "INFO" "Starting Agent-to-Agent Manager"
        node "$WORKSPACE_DIR/core/mcp/a2a_manager.js" &
        log "INFO" "A2A Manager started"
      else
        log "ERROR" "A2A Manager not found: $WORKSPACE_DIR/core/mcp/a2a_manager.js"
      fi
    fi
    
    # Start Schema UI if available
    if [ "$components" = "all" ] || [ "$components" = "ui" ]; then
      if [ -d "$WORKSPACE_DIR/schema-ui-integration" ]; then
        log "INFO" "Starting Schema UI components"
        chmod +x "$WORKSPACE_DIR/schema-ui-integration/saar.sh"
        "$WORKSPACE_DIR/schema-ui-integration/saar.sh" run
      else
        log "ERROR" "Schema UI integration not found: $WORKSPACE_DIR/schema-ui-integration"
      fi
    fi
    
    log "INFO" "Services started"
    ;;
    
  agent)
    shift
    
    log "INFO" "Launching Claude agent..."
    
    # Determine the mode
    mode=${1:-"interactive"}
    
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
    ;;
    
  dashboard)
    shift
    
    log "INFO" "Launching dashboard..."
    
    # Get user ID or use default
    user_id="$DEFAULT_USER"
    for arg in "$@"; do
      case $arg in
        --user=*)
          user_id="${arg#*=}"
          shift
          ;;
      esac
    done
    
    # Check if the dashboard starter script exists
    if [ -f "$CONFIG_DIR/bin/start-dashboard.sh" ]; then
      chmod +x "$CONFIG_DIR/bin/start-dashboard.sh"
      "$CONFIG_DIR/bin/start-dashboard.sh"
    else
      log "WARN" "Dashboard script not found: $CONFIG_DIR/bin/start-dashboard.sh"
      log "INFO" "Attempting to start dashboard directly..."
      
      # Direct fallback
      if [ -f "$WORKSPACE_DIR/scripts/dashboard/start-dashboard.sh" ]; then
        log "INFO" "Using direct dashboard script"
        chmod +x "$WORKSPACE_DIR/scripts/dashboard/start-dashboard.sh"
        
        # Prepare environment variables
        dashboard_config="$CONFIG_DIR/dashboard/${user_id}_dashboard.json"
        agent_config="$CONFIG_DIR/agents/${user_id}_agent.json"
        
        # Check if configs exist, create them if needed
        if [ ! -f "$dashboard_config" ] || [ ! -f "$agent_config" ]; then
          log "WARN" "Dashboard or agent configuration not found. Creating default configurations..."
          
          # Source setup script to create required configurations
          source "$STARTUP_DIR/02_setup.sh"
          
          # Get theme from storage or use default
          theme="dark"
          if [ -f "$STORAGE_DIR/theme-info.json" ]; then
            theme=$(grep -o '"activeTheme": "[^"]*' "$STORAGE_DIR/theme-info.json" 2>/dev/null | cut -d'"' -f4 || echo "dark")
          fi
          
          # Setup configs
          setup_virtual_user_agent "$user_id"
          setup_user_main_dashboard "$user_id" "$theme"
        fi
        
        # Set environment variables
        export USERMAINDASHBOARD="$dashboard_config"
        export USERAGENT="$agent_config"
        export USER_ID="$user_id"
        export DASHBOARD_THEME="dark"
        
        # Start dashboard
        "$WORKSPACE_DIR/scripts/dashboard/start-dashboard.sh"
      else
        log "ERROR" "Dashboard script not found: $WORKSPACE_DIR/scripts/dashboard/start-dashboard.sh"
        log "ERROR" "Cannot launch dashboard."
        exit 1
      fi
    fi
    ;;
    
  a2a)
    shift
    
    # Agent-to-Agent operations
    operation=${1:-"start"}
    target=${2:-""}
    message=${3:-""}
    
    log "INFO" "A2A operation: $operation"
    
    case $operation in
      start)
        # Start A2A Manager
        if [ -f "$WORKSPACE_DIR/core/mcp/a2a_manager.js" ]; then
          log "INFO" "Starting Agent-to-Agent Manager"
          node "$WORKSPACE_DIR/core/mcp/a2a_manager.js"
        else
          log "ERROR" "A2A Manager not found: $WORKSPACE_DIR/core/mcp/a2a_manager.js"
          exit 1
        fi
        ;;
        
      send)
        # Send a message to an agent
        if [ -z "$target" ]; then
          log "ERROR" "Target agent not specified"
          echo "Usage: $0 a2a send <target-agent> <message>"
          exit 1
        fi
        
        if [ -f "$WORKSPACE_DIR/core/mcp/a2a_manager.js" ]; then
          log "INFO" "Sending message to agent: $target"
          node "$WORKSPACE_DIR/core/mcp/a2a_manager.js" --to="$target" --message="$message"
        else
          log "ERROR" "A2A Manager not found: $WORKSPACE_DIR/core/mcp/a2a_manager.js"
          exit 1
        fi
        ;;
        
      list)
        # List available agents
        log "INFO" "Listing available agents"
        if [ -f "$WORKSPACE_DIR/core/mcp/a2a_manager.js" ]; then
          node "$WORKSPACE_DIR/core/mcp/a2a_manager.js" --list
        else
          log "ERROR" "A2A Manager not found: $WORKSPACE_DIR/core/mcp/a2a_manager.js"
          exit 1
        fi
        ;;
        
      setup)
        # Setup all specialized agents
        log "INFO" "Setting up specialized agents"
        
        # Source specialized components script
        source "$STARTUP_DIR/03_specialized_components.sh"
        
        # Setup specialized agents
        setup_specialized_agents
        ;;
        
      register)
        # Register a specific agent
        if [ -z "$target" ]; then
          log "ERROR" "Agent type not specified"
          echo "Usage: $0 a2a register <agent-type>"
          exit 1
        fi
        
        # Source specialized components script to access agent registration functions
        source "$STARTUP_DIR/03_specialized_components.sh"
        
        # Setup specialized agents, focusing on the target agent
        agent_types=("$target")
        setup_specialized_agents
        ;;
        
      *)
        log "ERROR" "Unknown A2A operation: $operation"
        echo "Available operations: start, send, list, setup, register"
        exit 1
        ;;
    esac
    ;;
    
  debug)
    shift
    
    # Debug tools operations
    operation=${1:-"help"}
    file_path=${2:-""}
    
    # Source debug components script
    source "$STARTUP_DIR/04_debug_components.sh"
    
    case $operation in
      workflow)
        # Run a debug workflow
        workflow_type=${2:-"standard"}
        file_path=${3:-""}
        
        if [ -z "$file_path" ]; then
          log "ERROR" "No file specified for debugging"
          echo "Usage: $0 debug workflow <workflow_type> <file_path>"
          exit 1
        fi
        
        run_debug_workflow "$workflow_type" "$file_path"
        ;;
        
      report)
        # Create a debug report
        create_debug_report
        ;;
        
      install)
        # Install debug components
        setup_debug_components
        ;;
        
      help|*)
        echo "Debug Tools Usage:"
        echo "  $0 debug workflow <type> <file> - Run a debug workflow (standard|quick|deep)"
        echo "  $0 debug report                - Generate debug components report"
        echo "  $0 debug install               - Install debug components"
        echo "  $0 debug help                  - Show this help"
        ;;
    esac
    ;;
    
  neural)
    shift
    
    # Neural framework operations
    operation=${1:-"help"}
    
    # Source neural framework script
    source "$STARTUP_DIR/05_neural_framework.sh"
    
    case $operation in
      install)
        # Install neural framework
        setup_neural_framework
        ;;
        
      templates)
        # Create AI documentation templates
        setup_ai_templates
        ;;
        
      commands)
        # Create Claude commands
        setup_claude_commands
        ;;
        
      specs)
        # Create specifications
        setup_specs
        ;;
        
      help|*)
        echo "Neural Framework Usage:"
        echo "  $0 neural install     - Install complete neural framework"
        echo "  $0 neural templates   - Create AI documentation templates"
        echo "  $0 neural commands    - Create Claude commands"
        echo "  $0 neural specs       - Create specifications"
        echo "  $0 neural help        - Show this help"
        ;;
    esac
    ;;
    
  autonomy)
    shift
    
    # Autonomy operations
    operation=${1:-"help"}
    
    # Source autonomy script
    source "$STARTUP_DIR/06_autonomy.sh"
    
    # Execute autonomy operation with all remaining arguments
    run_autonomy "$@"
    ;;
    
  status)
    # Source additional modules needed for status check
    source "$STARTUP_DIR/02_setup.sh"
    
    # Run status check
    do_status_check
    ;;
    
  help)
    show_banner
    echo -e "${BOLD}Usage:${NC} $0 [command] [options]"
    echo ""
    echo -e "${BOLD}Core Commands:${NC}"
    echo "  setup       Full setup of the Agentic OS"
    echo "  start       Start MCP servers and services"
    echo "  agent       Launch Claude agent"
    echo "  dashboard   Launch User Main Dashboard"
    echo "  status      Show system status"
    echo "  help        Show this help message"
    echo ""
    echo -e "${BOLD}Specialized Commands:${NC}"
    echo "  a2a         Agent-to-Agent communication operations"
    echo "  debug       Neural Recursive Debugging tools"
    echo "  neural      Neural Framework operations"
    echo "  autonomy    DeepThink and autonomous execution"
    echo ""
    echo -e "${BOLD}Common Options:${NC}"
    echo "  --debug     Enable debug logging"
    echo "  --quiet     Suppress console output"
    echo ""
    echo -e "${BOLD}Setup Options:${NC}"
    echo "  --quick     Quick setup with defaults"
    echo "  --force     Force overwrite existing configuration"
    echo "  --theme=X   Set specific theme (light, dark, blue, green, purple)"
    echo "  --user=X    Set user ID for operations"
    echo ""
    echo -e "${BOLD}Examples:${NC}"
    echo "  $0 setup                         # Full interactive setup"
    echo "  $0 setup --quick                 # Quick setup with defaults"
    echo "  $0 agent                         # Launch Claude agent interactively"
    echo "  $0 dashboard --user=john         # Launch Dashboard for specific user"
    echo "  $0 a2a start                     # Start Agent-to-Agent manager"
    echo "  $0 debug workflow quick file.js  # Run quick debug workflow on file.js"
    echo "  $0 neural install                # Install Neural Framework components"
    echo "  $0 autonomy think 'Create tests' # Generate execution plan through deep thinking"
    echo ""
    ;;
    
  *)
    log "ERROR" "Unknown command: $1"
    echo "Run '$0 help' for available commands"
    exit 1
    ;;
esac

exit 0