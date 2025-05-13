#!/bin/bash
# SAAR-MCP Integration - Dynamic Command Dispatcher
# Version: 1.0.0
#
# Provides unified command structure and seamless integration
# between SAAR framework and MCP tools.

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common utilities
source "$SCRIPT_DIR/saar/startup/00_common.sh"

# Display banner
show_banner
echo -e "${CYAN}${BOLD}SAAR-MCP Integration${NC}"
echo "Version: 1.0.0"
echo ""

# MCP Integration configuration
MCP_CONFIG_DIR="$HOME/.claude/mcp"
TOOLS_CACHE="$MCP_CONFIG_DIR/cache/tools_cache.json"
FALLBACK_DIR="$MCP_CONFIG_DIR/fallbacks"

# Ensure directories
ensure_directory "$MCP_CONFIG_DIR/logs"
ensure_directory "$MCP_CONFIG_DIR/cache" 
ensure_directory "$FALLBACK_DIR"

# Command mapping
declare -A COMMAND_MAP
COMMAND_MAP["neural"]="05_neural_framework.sh:run_neural_operation"
COMMAND_MAP["autonomy"]="06_autonomy.sh:run_autonomy"
COMMAND_MAP["mcp"]="07_mcp_integration.sh:run_mcp_operation"
COMMAND_MAP["deepthink"]="07_mcp_integration.sh:run_deepthink"
COMMAND_MAP["ui-dashboard"]="08_dashboard.sh:run_dashboard"
COMMAND_MAP["cross-tool"]="07_mcp_integration.sh:run_cross_tool_workflow"
COMMAND_MAP["validate"]="07_mcp_integration.sh:run_mcp_operation validate"
COMMAND_MAP["workflow"]="07_mcp_integration.sh:run_mcp_operation workflow"
COMMAND_MAP["memory"]="09_memory_integration.sh:run_memory_operation"

# Check MCP tools availability
check_mcp_tools() {
  log "INFO" "Checking MCP tools availability..."
  
  # Run MCP validator
  if [ -f "$TOOLS_DIR/mcp/validator.js" ]; then
    node "$TOOLS_DIR/mcp/validator.js"
    return $?
  else
    log "WARN" "MCP validator not found. Installing MCP integration first..."
    
    # Source MCP integration module
    source "$SCRIPT_DIR/saar/startup/07_mcp_integration.sh"
    
    # Setup MCP integration
    setup_mcp_integration
    
    # Now run the validator
    if [ -f "$TOOLS_DIR/mcp/validator.js" ]; then
      node "$TOOLS_DIR/mcp/validator.js"
      return $?
    else
      log "ERROR" "Failed to install MCP validator"
      return 1
    fi
  fi
}

# Initialize MCP integration
initialize_integration() {
  log "INFO" "Initializing SAAR-MCP integration..."
  
  # Ensure essential files exist
  if [ ! -f "$MCP_CONFIG_DIR/config.json" ]; then
    # Source MCP integration module
    source "$SCRIPT_DIR/saar/startup/07_mcp_integration.sh"
    
    # Setup MCP integration
    setup_mcp_integration
  fi
  
  # Check MCP tools
  check_mcp_tools
  
  log "SUCCESS" "SAAR-MCP integration initialized"
}

# Main dispatcher function
dispatch_command() {
  local command=$1
  shift
  
  # Check if command exists in mapping
  if [[ -n "${COMMAND_MAP[$command]}" ]]; then
    # Split the mapping into script name and function
    IFS=':' read -r script_name function_name <<< "${COMMAND_MAP[$command]}"
    
    # Check if script exists
    if [ -f "$SCRIPT_DIR/saar/startup/$script_name" ]; then
      # Source the script
      source "$SCRIPT_DIR/saar/startup/$script_name"
      
      # Call the function
      $function_name "$@"
    else
      log "ERROR" "Script not found: $script_name"
      return 1
    fi
  elif [ "$command" = "help" ]; then
    show_help
  else
    log "ERROR" "Unknown command: $command"
    echo "Run '$0 help' for available commands"
    return 1
  fi
}

# Help function
show_help() {
  echo -e "${BOLD}SAAR-MCP Integration${NC}"
  echo -e "======================="
  echo ""
  echo -e "${BOLD}Available commands:${NC}"
  echo "  neural <command>      Neural framework operations"
  echo "  autonomy <command>    Autonomy and DeepThink operations"
  echo "  mcp <command>         MCP tool operations"
  echo "  deepthink <prompt>    Run DeepThink with a prompt"
  echo "  memory <command>      Memory persistence operations"
  echo "  ui-dashboard          Launch modern UI dashboard"
  echo "  cross-tool <workflow> Run a cross-tool workflow"
  echo "  validate              Validate MCP tools availability"
  echo "  workflow <command>    Manage cross-tool workflows"
  echo "  help                  Show this help message"
  echo ""
  echo -e "${BOLD}Examples:${NC}"
  echo "  $0 validate                     # Check MCP tools availability"
  echo "  $0 deepthink \"Create a test plan\" # Generate an execution plan through deep thinking"
  echo "  $0 memory search \"architecture\"  # Search for thoughts about architecture"
  echo "  $0 ui-dashboard                 # Launch the monitoring dashboard"
  echo "  $0 cross-tool code_analysis     # Run the code analysis workflow"
  echo ""
}

# Check for arguments
if [ $# -eq 0 ]; then
  show_help
  exit 0
fi

# Process special parameters first
for arg in "$@"; do
  case $arg in
    --debug)
      export DEBUG_MODE=true
      log "DEBUG" "Debug mode enabled"
      ;;
    --initialize)
      initialize_integration
      exit $?
      ;;
  esac
done

# Initialize if needed
if [ ! -f "$MCP_CONFIG_DIR/config.json" ]; then
  initialize_integration
fi

# Dispatch the command
dispatch_command "$@"
exit $?