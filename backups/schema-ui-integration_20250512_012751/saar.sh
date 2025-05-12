#!/bin/bash

# SAAR.sh - Setup, Activate, Apply, Run
# Script for Claude Schema UI integration and setup

# Color settings
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
SCHEMA_UI_VERSION="1.0.0"
DEFAULT_USER="claudeuser"
CONFIG_DIR="$HOME/.claude"
STORAGE_DIR="$CONFIG_DIR/storage"
THEME_FILE="$CONFIG_DIR/theme.json"
MEMORY_FILE="$STORAGE_DIR/claude-schema-ui:profile.json"

# Banner
print_banner() {
  echo -e "${PURPLE}${BOLD}"
  echo "  _________.__                                ____ ___.___ "
  echo " /   _____/|  |__ _____    _____ _____      |    |   \\   \\"
  echo " \\_____  \\ |  |  \\\\__  \\  /     \\\\__  \\     |    |   /   /"
  echo " /        \\|   Y  \\/ __ \\|  Y Y  \\/ __ \\_   |    |  /|   |"
  echo "/_______  /|___|  (____  /__|_|  (____  /\\__|______/ |___|"
  echo "        \\/      \\/     \\/      \\/     \\/"
  echo -e "${NC}"
  echo -e "${CYAN}${BOLD}Claude Schema UI Integration (v$SCHEMA_UI_VERSION)${NC}"
  echo -e "${BLUE}SAAR - Setup, Activate, Apply, Run${NC}"
  echo
}

# Check requirements
check_requirements() {
  echo -e "${YELLOW}Checking system requirements...${NC}"
  
  # Check for Node.js
  if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is required but not installed.${NC}"
    echo -e "Please install Node.js from https://nodejs.org/ (v14+ recommended)"
    exit 1
  fi
  
  node_version=$(node -v | cut -d 'v' -f 2)
  echo -e "- Node.js: ${GREEN}v$node_version${NC}"
  
  # Check for npm
  if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is required but not installed.${NC}"
    exit 1
  fi
  
  npm_version=$(npm -v)
  echo -e "- npm: ${GREEN}v$npm_version${NC}"
  
  # Ensure config directory exists
  if [ ! -d "$CONFIG_DIR" ]; then
    mkdir -p "$CONFIG_DIR"
    echo -e "- Claude config directory: ${GREEN}Created at $CONFIG_DIR${NC}"
  else
    echo -e "- Claude config directory: ${GREEN}Found at $CONFIG_DIR${NC}"
  fi
  
  # Ensure storage directory exists
  if [ ! -d "$STORAGE_DIR" ]; then
    mkdir -p "$STORAGE_DIR"
    echo -e "- Storage directory: ${GREEN}Created at $STORAGE_DIR${NC}"
  else
    echo -e "- Storage directory: ${GREEN}Found at $STORAGE_DIR${NC}"
  fi
  
  echo -e "${GREEN}All requirements satisfied!${NC}\n"
}

# Setup function
setup() {
  local quick_mode=$1
  local theme=$2
  
  echo -e "${BLUE}${BOLD}[1/4] SETUP: Initializing Schema UI...${NC}"
  
  if [ "$quick_mode" = true ]; then
    echo -e "${YELLOW}Running in quick mode with defaults...${NC}"
    apply_template
  else
    # Interactive setup
    echo -e "${CYAN}Let's set up your Schema UI integration.${NC}"
    read -p "Enter your user ID [$DEFAULT_USER]: " user_id
    user_id=${user_id:-$DEFAULT_USER}
    
    read -p "Choose a theme (light, dark, blue, green, purple) [dark]: " selected_theme
    theme=${selected_theme:-dark}
    
    apply_template
  fi
  
  echo -e "${GREEN}Setup complete!${NC}\n"
}

# Activate function
activate() {
  echo -e "${BLUE}${BOLD}[2/4] ACTIVATE: Configuring memory persistence...${NC}"
  
  # Create storage directory if it doesn't exist
  if [ ! -d "$STORAGE_DIR" ]; then
    mkdir -p "$STORAGE_DIR"
    echo -e "- Created storage directory: ${GREEN}$STORAGE_DIR${NC}"
  fi
  
  # Initialize memory file if it doesn't exist
  if [ ! -f "$MEMORY_FILE" ]; then
    echo "{}" > "$MEMORY_FILE"
    echo -e "- Initialized memory file: ${GREEN}$MEMORY_FILE${NC}"
  else
    echo -e "- Using existing memory file: ${GREEN}$MEMORY_FILE${NC}"
  fi
  
  echo -e "${GREEN}Memory system activated!${NC}\n"
}

# Apply function
apply() {
  local theme=$1
  theme=${theme:-dark}
  
  echo -e "${BLUE}${BOLD}[3/4] APPLY: Setting up theme and configuration...${NC}"
  
  # Apply theme
  echo -e "- Applying ${CYAN}$theme${NC} theme..."
  
  # Create theme file based on selection
  case "$theme" in
    light)
      cat > "$THEME_FILE" << EOF
{
  "name": "Light Theme",
  "colors": {
    "primary": "#3f51b5",
    "secondary": "#7986cb",
    "accent": "#ff4081",
    "success": "#4caf50",
    "warning": "#ff9800",
    "danger": "#f44336",
    "info": "#2196f3",
    "background": "#f8f9fa",
    "surface": "#ffffff",
    "text": "#212121",
    "textSecondary": "#757575",
    "border": "#e0e0e0"
  }
}
EOF
      ;;
    dark)
      cat > "$THEME_FILE" << EOF
{
  "name": "Dark Theme",
  "colors": {
    "primary": "#bb86fc",
    "secondary": "#03dac6",
    "accent": "#cf6679",
    "success": "#4caf50",
    "warning": "#ff9800",
    "danger": "#cf6679",
    "info": "#2196f3",
    "background": "#121212",
    "surface": "#1e1e1e",
    "text": "#ffffff",
    "textSecondary": "#b0b0b0",
    "border": "#333333"
  }
}
EOF
      ;;
    blue)
      cat > "$THEME_FILE" << EOF
{
  "name": "Blue Theme",
  "colors": {
    "primary": "#1565c0",
    "secondary": "#42a5f5",
    "accent": "#82b1ff",
    "success": "#4caf50",
    "warning": "#ff9800",
    "danger": "#f44336",
    "info": "#29b6f6",
    "background": "#f5f9ff",
    "surface": "#ffffff",
    "text": "#263238",
    "textSecondary": "#546e7a",
    "border": "#bbdefb"
  }
}
EOF
      ;;
    green)
      cat > "$THEME_FILE" << EOF
{
  "name": "Green Theme",
  "colors": {
    "primary": "#2e7d32",
    "secondary": "#66bb6a",
    "accent": "#81c784",
    "success": "#388e3c",
    "warning": "#ff9800",
    "danger": "#f44336",
    "info": "#0288d1",
    "background": "#f1f8e9",
    "surface": "#ffffff",
    "text": "#212121",
    "textSecondary": "#757575",
    "border": "#c8e6c9"
  }
}
EOF
      ;;
    purple)
      cat > "$THEME_FILE" << EOF
{
  "name": "Purple Theme",
  "colors": {
    "primary": "#6a1b9a",
    "secondary": "#9c27b0",
    "accent": "#e040fb",
    "success": "#4caf50",
    "warning": "#ff9800",
    "danger": "#f44336",
    "info": "#2196f3",
    "background": "#f3e5f5",
    "surface": "#ffffff",
    "text": "#212121",
    "textSecondary": "#757575",
    "border": "#e1bee7"
  }
}
EOF
      ;;
    *)
      echo -e "${RED}Unknown theme: $theme. Using dark theme as default.${NC}"
      apply "dark"
      return
      ;;
  esac
  
  echo -e "- Theme file created: ${GREEN}$THEME_FILE${NC}"
  echo -e "${GREEN}Configuration applied!${NC}\n"
}

# Run function
run() {
  echo -e "${BLUE}${BOLD}[4/4] RUN: Starting Schema UI...${NC}"
  
  # If we're in a git repo, check if we have the module
  if [ -d ".git" ]; then
    if [ ! -d "schema-ui" ] && [ ! -d "node_modules/claude-schema-ui" ]; then
      echo -e "${YELLOW}Schema UI not found in project. Would you like to add it?${NC}"
      read -p "Add Schema UI to project? (Y/n): " add_ui
      if [[ "$add_ui" =~ ^[Yy]$ ]] || [ -z "$add_ui" ]; then
        echo -e "- Adding Schema UI to project..."
        
        # Check if we should use npm or git
        read -p "Use npm package or git submodule? (npm/git) [npm]: " install_method
        install_method=${install_method:-npm}
        
        if [ "$install_method" = "npm" ]; then
          npm install claude-schema-ui --save
          echo -e "- ${GREEN}Schema UI installed via npm${NC}"
        else
          git submodule add https://github.com/claude-framework/schema-ui.git schema-ui
          echo -e "- ${GREEN}Schema UI added as git submodule${NC}"
        fi
      fi
    else
      echo -e "- Schema UI ${GREEN}already installed${NC}"
    fi
  fi
  
  # Check for an example file to run
  if [ -f "src/examples/profile.jsx" ]; then
    echo -e "- Found example file: ${GREEN}src/examples/profile.jsx${NC}"
    echo -e "- Starting example..."
    npm run dev
  else
    # Create an example file
    echo -e "- Creating example profile component..."
    
    # Create examples directory if it doesn't exist
    mkdir -p src/examples
    
    # Create profile example
    cat > src/examples/profile.jsx << EOF
import React from 'react';
import { 
  MemoryProvider, 
  MemoryProfileForm, 
  ProfileHistory 
} from 'claude-schema-ui';

export default function ProfileExample() {
  const userId = 'claudeuser';
  
  const handleSave = (profileData) => {
    console.log('Profile saved:', profileData);
  };
  
  return (
    <div className="profile-example">
      <h1>Claude Profile</h1>
      
      <MemoryProvider userId={userId}>
        <div className="profile-container">
          <MemoryProfileForm
            userId={userId}
            onSave={handleSave}
          />
          
          <ProfileHistory 
            userId={userId}
            limit={5}
            showTimestamp={true}
          />
        </div>
      </MemoryProvider>
    </div>
  );
}
EOF
    
    echo -e "- ${GREEN}Example file created${NC}"
    echo -e "- To view the example:"
    echo -e "  1. Import it in your React application"
    echo -e "  2. Run your development server (e.g., npm run dev)"
  fi
  
  echo -e "${GREEN}Schema UI is ready to use!${NC}\n"
  
  # Open documentation
  echo -e "${CYAN}Would you like to open the documentation?${NC}"
  read -p "Open documentation? (Y/n): " open_docs
  if [[ "$open_docs" =~ ^[Yy]$ ]] || [ -z "$open_docs" ]; then
    if command -v xdg-open &> /dev/null; then
      xdg-open "https://github.com/claude-framework/schema-ui"
    elif command -v open &> /dev/null; then
      open "https://github.com/claude-framework/schema-ui"
    else
      echo -e "Visit: ${BLUE}https://github.com/claude-framework/schema-ui${NC}"
    fi
  fi
}

# Apply a template configuration
apply_template() {
  local template_name=${1:-default}
  
  case "$template_name" in
    minimal)
      echo -e "- Applying ${CYAN}minimal${NC} template..."
      # Minimal setup with just the essentials
      # Implementation details here
      ;;
    full)
      echo -e "- Applying ${CYAN}full${NC} template..."
      # Full-featured setup with all components
      # Implementation details here
      ;;
    *)
      echo -e "- Applying ${CYAN}default${NC} template..."
      # Default balanced setup
      # Implementation details here
      ;;
  esac
}

# Show help
show_help() {
  print_banner
  echo -e "${BOLD}Usage:${NC} ./saar.sh [command] [options]"
  echo
  echo -e "${BOLD}Commands:${NC}"
  echo -e "  ${GREEN}setup${NC}        Set up Schema UI (interactive or quick)"
  echo -e "  ${GREEN}activate${NC}     Initialize memory persistence"
  echo -e "  ${GREEN}apply${NC}        Apply theme and configuration"
  echo -e "  ${GREEN}run${NC}          Start Schema UI components"
  echo -e "  ${GREEN}all${NC}          Run all steps in sequence"
  echo -e "  ${GREEN}help${NC}         Show this help message"
  echo
  echo -e "${BOLD}Options:${NC}"
  echo -e "  ${YELLOW}--quick${NC}       Use default settings (non-interactive setup)"
  echo -e "  ${YELLOW}--theme=NAME${NC}   Set theme (light, dark, blue, green, purple)"
  echo -e "  ${YELLOW}--user=ID${NC}      Set user ID (default: claudeuser)"
  echo
  echo -e "${BOLD}Examples:${NC}"
  echo -e "  ./saar.sh setup                    # Interactive setup"
  echo -e "  ./saar.sh setup --quick            # Quick setup with defaults"
  echo -e "  ./saar.sh setup --theme=blue       # Setup with blue theme"
  echo -e "  ./saar.sh all --quick --theme=dark # Run all steps with dark theme"
  echo
}

# Main logic
main() {
  # Show banner
  print_banner
  
  # Process command line arguments
  local command=$1
  shift
  
  # Default options
  local quick_mode=false
  local theme="dark"
  local user_id=$DEFAULT_USER
  
  # Process options
  for arg in "$@"; do
    case $arg in
      --quick)
        quick_mode=true
        ;;
      --theme=*)
        theme="${arg#*=}"
        ;;
      --user=*)
        user_id="${arg#*=}"
        ;;
      *)
        echo -e "${RED}Unknown option: $arg${NC}"
        show_help
        exit 1
        ;;
    esac
  done
  
  # Check requirements
  check_requirements
  
  # Execute command
  case $command in
    setup)
      setup $quick_mode $theme
      ;;
    activate)
      activate
      ;;
    apply)
      apply $theme
      ;;
    run)
      run
      ;;
    all)
      setup $quick_mode $theme
      activate
      apply $theme
      run
      ;;
    help)
      show_help
      ;;
    *)
      echo -e "${RED}Unknown command: $command${NC}"
      show_help
      exit 1
      ;;
  esac
}

# Run the script
main "$@"