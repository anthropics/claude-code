#!/bin/bash

# SAAR.sh - Setup, Activate, Apply, Run
# Default starter script for Claude Neural Framework
# Version: 1.0.0

# Strict error handling
set -e
set -o pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Banner function
show_banner() {
  echo -e "${BLUE}${BOLD}"
  echo "   _____                   _____ _    _ "
  echo "  / ____|   /\            / ____| |  | |"
  echo " | (___    /  \   __ _   | (___ | |__| |"
  echo "  \___ \  / /\ \ / _\` |   \___ \|  __  |"
  echo "  ____) |/ ____ \ (_| |   ____) | |  | |"
  echo " |_____//_/    \_\__,_|  |_____/|_|  |_|"
  echo ""
  echo "  Setup, Activate, Apply, Run"
  echo -e "${NC}"
  echo "  Claude Neural Framework Starter"
  echo "  Version: 1.0.0"
  echo ""
}

# Help function
show_help() {
  echo -e "${BOLD}Usage:${NC} ./saar.sh [command] [options]"
  echo ""
  echo -e "${BOLD}Commands:${NC}"
  echo "  setup       Full setup of the Claude Neural Framework"
  echo "  about       Configure .about profile"
  echo "  colors      Configure color schema"
  echo "  project     Set up a new project"
  echo "  start       Start MCP servers"
  echo "  agent       Launch Claude agent"
  echo "  help        Show this help message"
  echo ""
  echo -e "${BOLD}Options:${NC}"
  echo "  --quick     Quick setup with defaults"
  echo "  --force     Force overwrite existing configuration"
  echo "  --theme=X   Set specific theme (light, dark, blue, green, purple)"
  echo ""
  echo -e "${BOLD}Examples:${NC}"
  echo "  ./saar.sh setup            # Full interactive setup"
  echo "  ./saar.sh setup --quick    # Quick setup with defaults"
  echo "  ./saar.sh colors --theme=dark"
  echo "  ./saar.sh project --template=web"
  echo "  ./saar.sh start            # Start MCP servers"
  echo ""
}

# Check dependencies
check_dependencies() {
  echo -e "${YELLOW}${BOLD}Checking dependencies...${NC}"
  
  local missing=0
  local deps=("node" "npm" "python3" "git")
  
  for cmd in "${deps[@]}"; do
    if ! command -v "$cmd" &> /dev/null; then
      echo -e "${RED}✗ $cmd not found${NC}"
      missing=$((missing+1))
    else
      echo -e "${GREEN}✓ $cmd found${NC}"
    fi
  done
  
  if [ $missing -gt 0 ]; then
    echo -e "${RED}${BOLD}Error:${NC} Missing dependencies. Please install the required dependencies and try again."
    exit 1
  fi
  
  # Check Node.js version
  local node_version=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
  if [ "$node_version" -lt 18 ]; then
    echo -e "${YELLOW}Warning: Node.js version $node_version detected. Version 18+ is recommended.${NC}"
  fi
  
  echo -e "${GREEN}✓ All dependencies satisfied${NC}"
  echo ""
}

# Setup function - main setup process
do_setup() {
  local quick_mode=false
  local force_mode=false
  local theme="dark"
  
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
    esac
  done
  
  show_banner
  check_dependencies
  
  echo -e "${BLUE}${BOLD}Setting up Claude Neural Framework...${NC}"
  
  # Create necessary directories
  echo -e "${YELLOW}Creating directory structure...${NC}"
  mkdir -p ~/.claude
  
  # Install required NPM packages
  echo -e "${YELLOW}Installing required packages...${NC}"
  if [ "$quick_mode" = true ]; then
    npm install --quiet
  else
    npm install
  fi
  
  # Configure API keys
  if [ "$quick_mode" = false ]; then
    echo -e "${YELLOW}${BOLD}API Key Configuration${NC}"
    read -p "Enter your Anthropic API Key (leave blank to skip): " anthropic_key
    
    if [ ! -z "$anthropic_key" ]; then
      echo -e "{\n  \"api_key\": \"$anthropic_key\"\n}" > ~/.claude/api_keys.json
      echo -e "${GREEN}✓ API key saved to ~/.claude/api_keys.json${NC}"
    else
      echo -e "${YELLOW}Skipped API key configuration${NC}"
    fi
  fi
  
  # Setup color schema
  if [ "$quick_mode" = true ]; then
    echo -e "${YELLOW}Setting up default color schema ($theme)...${NC}"
    node core/mcp/color_schema_manager.js --template="$theme" --non-interactive > /dev/null
  else
    echo -e "${YELLOW}Setting up color schema...${NC}"
    node scripts/setup/setup_user_colorschema.js
  fi
  
  # Setup about profile
  if [ "$quick_mode" = true ]; then
    echo -e "${YELLOW}Creating default .about profile...${NC}"
    
    # Create a minimal default profile
    mkdir -p ~/.claude
    cat > ~/.claude/user.about.json << EOF
{
  "user_id": "user-$(date +%s)",
  "name": "Default User",
  "goals": ["Develop with Claude Neural Framework"],
  "companies": ["Personal Project"],
  "preferences": {
    "theme": "$theme",
    "lang": "en",
    "colorScheme": {
      "primary": "#3f51b5",
      "secondary": "#7986cb",
      "accent": "#ff4081"
    }
  },
  "expertise": ["javascript", "python"],
  "debug_preferences": {
    "strategy": "bottom-up",
    "detail_level": "medium",
    "auto_fix": true
  },
  "is_agent": true
}
EOF
    
    echo -e "${GREEN}✓ Default .about profile created${NC}"
  else
    echo -e "${YELLOW}Setting up .about profile...${NC}"
    node scripts/setup/create_about.js
  fi
  
  # Setup MCP servers
  echo -e "${YELLOW}Configuring MCP servers...${NC}"
  if [ -f "core/mcp/setup_mcp.js" ]; then
    node core/mcp/setup_mcp.js
  fi
  
  echo -e "${GREEN}${BOLD}Setup complete!${NC}"
  echo -e "${CYAN}Framework is ready to use.${NC}"
  echo ""
  echo -e "To start MCP servers:     ${BOLD}./saar.sh start${NC}"
  echo -e "To set up a new project:  ${BOLD}./saar.sh project${NC}"
  echo -e "To launch Claude agent:   ${BOLD}./saar.sh agent${NC}"
  echo ""
}

# About profile function
do_about() {
  check_dependencies
  
  echo -e "${BLUE}${BOLD}Configuring .about profile...${NC}"
  node scripts/setup/create_about.js
}

# Color schema function
do_colors() {
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
  
  echo -e "${BLUE}${BOLD}Configuring color schema...${NC}"
  
  if [ "$theme" != "dark" ]; then
    echo -e "${YELLOW}Setting theme to $theme...${NC}"
    node core/mcp/color_schema_manager.js --template="$theme" --apply=true
  else
    node scripts/setup/setup_user_colorschema.js
  fi
}

# Project setup function
do_project() {
  local template=""
  
  # Parse options
  for arg in "$@"; do
    case $arg in
      --template=*)
        template="--template=${arg#*=}"
        shift
        ;;
    esac
  done
  
  check_dependencies
  
  echo -e "${BLUE}${BOLD}Setting up a new project...${NC}"
  if [ -z "$template" ]; then
    node scripts/setup/setup_project.js
  else
    node scripts/setup/setup_project.js $template
  fi
}

# Start MCP servers function
do_start() {
  check_dependencies
  
  echo -e "${BLUE}${BOLD}Starting MCP servers...${NC}"
  node core/mcp/start_server.js
}

# Launch Claude agent function
do_agent() {
  check_dependencies
  
  echo -e "${BLUE}${BOLD}Launching Claude agent...${NC}"
  
  # Check if npx claude is available
  if command -v npx &> /dev/null; then
    npx claude
  else
    echo -e "${RED}Error: npx not found. Cannot launch Claude agent.${NC}"
    exit 1
  fi
}

# Main function
main() {
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
    start)
      shift
      do_start "$@"
      ;;
    agent)
      shift
      do_agent "$@"
      ;;
    help|--help|-h)
      show_banner
      show_help
      ;;
    *)
      echo -e "${RED}Error: Unknown command '$1'${NC}"
      show_help
      exit 1
      ;;
  esac
}

# Execute main function
main "$@"