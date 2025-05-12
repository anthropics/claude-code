#!/usr/bin/env bash

# =====================================================================
# SAAR Interactive Installation Launcher 
# Version: 1.0.0
# Date: 2025-05-12
# =====================================================================

# Strict error handling
set -e          # Exit immediately if a command exits with a non-zero status
set -u          # Treat unset variables as an error
set -o pipefail # Pipeline fails on any command failure

# Colors for output formatting
RESET='\033[0m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
BOLD='\033[1m'

# Configuration
INSTALL_DIR="${INSTALL_DIR:-${HOME}/claude-neural-framework}"
TEMP_DIR=$(mktemp -d)
INSTALLER_VERSION="1.0.0"

# Clean up on exit
cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Banner
show_banner() {
  clear
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
  echo -e "Interactive Installer v${INSTALLER_VERSION}"
  echo -e "=================================================="
  echo
}

# Progress indicator
show_progress() {
  local msg="$1"
  local chars=( "|" "/" "-" "\\" )
  local delay=0.1
  
  printf "${CYAN}%s${RESET} " "$msg"
  
  for i in {1..20}; do
    for char in "${chars[@]}"; do
      printf "\b${YELLOW}%s${RESET}" "$char"
      sleep $delay
    done
  done
  
  printf "\b${GREEN}✓${RESET}\n"
}

# Wait for user to press Enter
wait_for_enter() {
  echo
  read -p "Press Enter to continue..." dummy
}

# Ask for confirmation
confirm() {
  local msg="$1"
  local default="${2:-y}"
  
  if [[ "$default" == "y" ]]; then
    read -p "$msg [Y/n]: " response
    [[ -z "$response" || "$response" =~ ^[Yy] ]]
  else
    read -p "$msg [y/N]: " response
    [[ "$response" =~ ^[Yy] ]]
  fi
}

# Installation steps
step1_intro() {
  show_banner
  
  echo -e "${BOLD}Welcome to the Claude Neural Framework Interactive Installer${RESET}"
  echo
  echo -e "This installer will guide you through the process of setting up the"
  echo -e "Claude Neural Framework with interactive SAAR configuration."
  echo
  echo -e "${YELLOW}During this process, you will:${RESET}"
  echo -e " - Download the framework"
  echo -e " - Configure your environment"
  echo -e " - Set up your .about profile"
  echo -e " - Configure color schemas"
  echo -e " - Set up Schema UI integration"
  echo -e " - Configure MCP servers"
  
  echo
  echo -e "${BOLD}Installation Directory:${RESET} ${INSTALL_DIR}"
  echo
  
  if confirm "Would you like to proceed with installation?"; then
    return 0
  else
    echo -e "${RED}Installation cancelled.${RESET}"
    exit 1
  fi
}

step2_download() {
  show_banner
  echo -e "${BOLD}Step 1: Downloading Claude Neural Framework${RESET}"
  echo -e "=================================================="
  echo
  
  # Create installation directory
  if [ ! -d "$INSTALL_DIR" ]; then
    echo -e "Creating directory: $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"
  fi
  
  # Download or clone the repository
  if [ -d "$INSTALL_DIR/.git" ]; then
    echo -e "${YELLOW}Repository already exists at $INSTALL_DIR${RESET}"
    echo -e "Updating to the latest version..."
    (cd "$INSTALL_DIR" && git pull) || {
      echo -e "${RED}Failed to update repository. Continuing with existing files.${RESET}"
    }
  else
    echo -e "Downloading framework..."
    show_progress "Cloning repository"
    git clone https://github.com/username/claude-code.git "$INSTALL_DIR" || {
      echo -e "${RED}Failed to clone repository.${RESET}"
      exit 1
    }
  fi
  
  echo -e "${GREEN}✓ Download complete${RESET}"
  wait_for_enter
}

step3_install() {
  show_banner
  echo -e "${BOLD}Step 2: Setting Up Framework${RESET}"
  echo -e "=================================="
  echo
  
  # Change to installation directory
  cd "$INSTALL_DIR"
  
  # Check for installation script
  if [ -f "./optimized_simple_install.sh" ]; then
    INSTALL_SCRIPT="./optimized_simple_install.sh"
    echo -e "Using optimized installation script"
  elif [ -f "./simple_install.sh" ]; then
    INSTALL_SCRIPT="./simple_install.sh"
    echo -e "Using standard installation script"
  else
    echo -e "${RED}No installation script found.${RESET}"
    exit 1
  fi
  
  # Make script executable
  chmod +x "$INSTALL_SCRIPT"
  
  echo -e "${YELLOW}Running base installation script...${RESET}"
  "$INSTALL_SCRIPT" || {
    echo -e "${RED}Base installation failed.${RESET}"
    exit 1
  }
  
  echo -e "${GREEN}✓ Base installation complete${RESET}"
  wait_for_enter
}

step4_saar_setup() {
  show_banner
  echo -e "${BOLD}Step 3: SAAR Setup${RESET}"
  echo -e "======================"
  echo
  
  # Change to installation directory
  cd "$INSTALL_DIR"
  
  # Check if SAAR script exists
  if [ ! -f "./saar.sh" ]; then
    echo -e "${RED}saar.sh script not found. Creating minimal version...${RESET}"
    cat > saar.sh << 'EOF'
#!/bin/bash

# SAAR.sh - Setup, Activate, Apply, Run
# Minimal version created by interactive installer
# Version: 1.0.0

echo "Running SAAR command: $1"
echo "This is a minimal implementation. Please install the full version."
EOF
    chmod +x saar.sh
  fi
  
  # Make SAAR script executable
  chmod +x ./saar.sh
  
  echo -e "${YELLOW}Running SAAR setup...${RESET}"
  
  # Show interactive setup options
  echo -e "SAAR setup can be run in interactive or quick mode:"
  echo -e "1) Interactive mode - Guided setup with detailed configuration"
  echo -e "2) Quick mode - Fast setup with sensible defaults"
  echo
  read -p "Select setup mode (1/2): " setup_mode
  
  if [ "$setup_mode" = "1" ]; then
    # Interactive mode
    echo -e "\nStarting interactive setup...\n"
    show_progress "Preparing interactive setup"
    ./saar.sh setup
  else
    # Quick mode
    echo -e "\nStarting quick setup...\n"
    show_progress "Preparing quick setup"
    ./saar.sh setup --quick --theme=dark
  fi
  
  echo -e "${GREEN}✓ SAAR setup complete${RESET}"
  wait_for_enter
}

step5_about_profile() {
  show_banner
  echo -e "${BOLD}Step 4: About Profile Configuration${RESET}"
  echo -e "====================================="
  echo
  
  # Change to installation directory
  cd "$INSTALL_DIR"
  
  echo -e "The .about profile contains information about your preferences and goals."
  echo -e "It helps the framework tailor the experience to your needs."
  echo
  
  if confirm "Would you like to configure your .about profile now?"; then
    echo -e "\nStarting about profile configuration...\n"
    show_progress "Preparing profile configuration"
    ./saar.sh about
  else
    echo -e "\n${YELLOW}Skipping about profile configuration.${RESET}"
    echo -e "You can configure it later with: ./saar.sh about"
  fi
  
  echo -e "${GREEN}✓ About profile configuration complete${RESET}"
  wait_for_enter
}

step6_colors() {
  show_banner
  echo -e "${BOLD}Step 5: Color Schema Configuration${RESET}"
  echo -e "====================================="
  echo
  
  # Change to installation directory
  cd "$INSTALL_DIR"
  
  echo -e "Choose a color schema for your environment:"
  echo -e "1) Dark theme  - Dark background with light text"
  echo -e "2) Light theme - Light background with dark text"
  echo -e "3) Blue theme  - Blue-tinted dark theme"
  echo -e "4) Green theme - Green-tinted dark theme"
  echo -e "5) Purple theme - Purple-tinted dark theme"
  echo -e "6) Custom theme - Configure your own colors"
  echo
  read -p "Select color theme (1-6): " color_choice
  
  case "$color_choice" in
    1) theme="dark" ;;
    2) theme="light" ;;
    3) theme="blue" ;;
    4) theme="green" ;;
    5) theme="purple" ;;
    6) theme="custom" ;;
    *) theme="dark" ;;
  esac
  
  echo -e "\nConfiguring ${theme} theme...\n"
  if [ "$theme" = "custom" ]; then
    ./saar.sh colors --theme=custom
  else
    show_progress "Applying $theme theme"
    ./saar.sh colors --theme="$theme"
  fi
  
  echo -e "${GREEN}✓ Color schema configuration complete${RESET}"
  wait_for_enter
}

step7_start_services() {
  show_banner
  echo -e "${BOLD}Step 6: Starting Services${RESET}"
  echo -e "==========================="
  echo
  
  # Change to installation directory
  cd "$INSTALL_DIR"
  
  echo -e "The framework includes several services:"
  echo -e "- MCP servers for advanced functionality"
  echo -e "- Schema UI for interface components"
  echo -e "- Dashboard for monitoring"
  echo
  
  if confirm "Would you like to start the services now?"; then
    echo -e "\nStarting services...\n"
    show_progress "Starting MCP servers"
    ./saar.sh start
  else
    echo -e "\n${YELLOW}Skipping service startup.${RESET}"
    echo -e "You can start services later with: ./saar.sh start"
  fi
  
  echo -e "${GREEN}✓ Services configuration complete${RESET}"
  wait_for_enter
}

step8_completion() {
  show_banner
  echo -e "${BOLD}Installation Complete!${RESET}"
  echo -e "======================"
  echo
  
  echo -e "${GREEN}The Claude Neural Framework has been successfully installed.${RESET}"
  echo
  echo -e "${BOLD}Installation Directory:${RESET} ${INSTALL_DIR}"
  echo
  echo -e "${BOLD}Getting Started:${RESET}"
  echo -e "1. Change to the installation directory: ${CYAN}cd \"$INSTALL_DIR\"${RESET}"
  echo -e "2. Start MCP servers: ${CYAN}./saar.sh start${RESET}"
  echo -e "3. Launch the Claude agent: ${CYAN}./saar.sh agent${RESET}"
  echo -e "4. Check system status: ${CYAN}./saar.sh status${RESET}"
  echo
  echo -e "${BOLD}Documentation:${RESET}"
  echo -e "- View the README.md file for framework overview"
  echo -e "- Browse the docs/ directory for detailed documentation"
  echo -e "- Run ${CYAN}./saar.sh help${RESET} for command reference"
  echo
  echo -e "${YELLOW}Don't forget to set your API keys in the environment:${RESET}"
  echo -e "export CLAUDE_API_KEY=\"your_anthropic_api_key_here\""
  echo
  
  echo -e "${GREEN}${BOLD}Thank you for installing the Claude Neural Framework!${RESET}"
  echo
}

# Execute all steps in sequence
run_installer() {
  step1_intro && 
  step2_download && 
  step3_install && 
  step4_saar_setup &&
  step5_about_profile &&
  step6_colors &&
  step7_start_services &&
  step8_completion
}

# Main execution
run_installer