#!/usr/bin/env bash

# =====================================================================
# Claude Neural Framework - One-Line Curl Installer
# Version: 1.1.0
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

# Parse arguments
INTERACTIVE_MODE=false
QUICK_INSTALL=false

for arg in "$@"; do
  case "$arg" in
    -i|--interactive)
      INTERACTIVE_MODE=true
      shift
      ;;
    -q|--quick)
      QUICK_INSTALL=true
      shift
      ;;
  esac
done

# Display banner
echo -e "${BLUE}${BOLD}=========================================================${RESET}"
echo -e "${BLUE}${BOLD}    Claude Neural Framework - One-Line Installer        ${RESET}"
echo -e "${BLUE}${BOLD}=========================================================${RESET}"
echo -e "${CYAN}Version: 1.1.0${RESET}"
echo -e "${CYAN}Date: $(date '+%Y-%m-%d')${RESET}"
echo -e "${BLUE}${BOLD}=========================================================${RESET}\n"

# Check requirements
echo -e "${CYAN}${BOLD}Checking requirements...${RESET}"

# Check required commands
for cmd in curl git; do
  if ! command -v $cmd &> /dev/null; then
    echo -e "${RED}${BOLD}Error: $cmd is not installed.${RESET}"
    echo -e "Please install $cmd and try again."
    exit 1
  fi
done

# Installation directory
INSTALL_DIR="${INSTALL_DIR:-${HOME}/claude-neural-framework}"

# Ask for confirmation (skip if quick mode)
if [ "$QUICK_INSTALL" = false ]; then
  echo -e "${YELLOW}This script will install the Claude Neural Framework to:${RESET}"
  echo -e "${BOLD}${INSTALL_DIR}${RESET}\n"
  
  if [ "$INTERACTIVE_MODE" = true ]; then
    echo -e "${YELLOW}Installation mode: ${PURPLE}Interactive SAAR Setup${RESET}"
    echo -e "This will guide you through the complete setup process, including:"
    echo -e "- Base framework installation"
    echo -e "- SAAR command configuration"
    echo -e "- About profile setup"
    echo -e "- Color schema customization"
    echo -e "- MCP server configuration"
  else
    echo -e "${YELLOW}Installation mode: ${GREEN}Standard${RESET}"
    echo -e "This will install the framework with default settings."
  fi
  
  echo
  read -p "Do you want to continue? (y/n): " -r REPLY
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Installation cancelled.${RESET}"
    exit 1
  fi
fi

# Create installation directory
echo -e "\n${CYAN}${BOLD}Setting up installation directory...${RESET}"
mkdir -p "${INSTALL_DIR}"
cd "${INSTALL_DIR}"

# Clone or download the repository
echo -e "\n${CYAN}${BOLD}Downloading framework...${RESET}"

if [ -d "${INSTALL_DIR}/.git" ]; then
  echo "Git repository already exists, updating..."
  git pull origin main
else
  echo "Cloning repository..."
  git clone https://github.com/username/claude-code.git "${INSTALL_DIR}"
fi

# Interactive vs Standard installation
if [ "$INTERACTIVE_MODE" = true ]; then
  # Download and run the interactive installer
  echo -e "\n${CYAN}${BOLD}Setting up interactive installer...${RESET}"
  SAAR_INSTALLER="${INSTALL_DIR}/saar_installer.sh"
  
  # Download or update saar_installer.sh
  curl -sSL https://raw.githubusercontent.com/username/claude-code/main/saar_installer.sh -o "${SAAR_INSTALLER}"
  chmod +x "${SAAR_INSTALLER}"
  
  # Run interactive installer
  echo -e "\n${PURPLE}${BOLD}Starting interactive SAAR installation process...${RESET}"
  "${SAAR_INSTALLER}"
  INSTALL_RESULT=$?
  
  if [ $INSTALL_RESULT -ne 0 ]; then
    echo -e "\n${RED}${BOLD}Interactive installation encountered an error.${RESET}"
    echo -e "Falling back to standard installation..."
    INTERACTIVE_MODE=false
  else
    # If interactive installation succeeded, skip the standard installation
    STANDARD_INSTALL_NEEDED=false
  fi
fi

# Standard installation (if not already done through interactive mode)
if [ "$INTERACTIVE_MODE" = false ]; then
  # Check if optimized_simple_install.sh exists, use simple_install.sh as fallback
  if [ -f "${INSTALL_DIR}/optimized_simple_install.sh" ]; then
    INSTALL_SCRIPT="${INSTALL_DIR}/optimized_simple_install.sh"
    echo -e "\n${CYAN}${BOLD}Using optimized installation script...${RESET}"
  elif [ -f "${INSTALL_DIR}/simple_install.sh" ]; then
    INSTALL_SCRIPT="${INSTALL_DIR}/simple_install.sh"
    echo -e "\n${CYAN}${BOLD}Using standard installation script...${RESET}"
  else
    echo -e "${RED}${BOLD}Error: Installation script not found.${RESET}"
    echo "Please download the framework manually and run the installation script."
    exit 1
  fi
  
  # Make script executable
  chmod +x "${INSTALL_SCRIPT}"
  
  # Run installation script
  echo -e "\n${CYAN}${BOLD}Running installation script...${RESET}"
  "${INSTALL_SCRIPT}"
  
  # Setup SAAR if available
  if [ -f "${INSTALL_DIR}/saar.sh" ]; then
    chmod +x "${INSTALL_DIR}/saar.sh"
    
    if [ "$QUICK_INSTALL" = true ]; then
      echo -e "\n${CYAN}${BOLD}Running quick SAAR setup...${RESET}"
      "${INSTALL_DIR}/saar.sh" setup --quick --theme=dark
    else
      echo -e "\n${YELLOW}To complete setup with the SAAR tool, run:${RESET}"
      echo -e "${BOLD}cd ${INSTALL_DIR} && ./saar.sh setup${RESET}"
    fi
  fi
fi

# Display final message
echo -e "\n${GREEN}${BOLD}===============================================${RESET}"
echo -e "${GREEN}${BOLD}  Claude Neural Framework Installation Complete  ${RESET}"
echo -e "${GREEN}${BOLD}===============================================${RESET}"
echo -e "\n${CYAN}Installation has been completed successfully!${RESET}"
echo -e "\n${YELLOW}To use the framework:${RESET}"
echo -e "1. Set your API keys in the environment:"
echo -e "   ${BOLD}export CLAUDE_API_KEY=\"your_anthropic_api_key_here\"${RESET}"
echo -e "   ${BOLD}export MCP_API_KEY=\"your_mcp_api_key_here\"${RESET}"
echo -e "2. Navigate to ${BOLD}${INSTALL_DIR}${RESET}"
echo -e "3. Manage your installation with ${BOLD}./saar.sh${RESET}"
echo -e "   - Start all services: ${BOLD}./saar.sh start${RESET}"
echo -e "   - Launch Claude agent: ${BOLD}./saar.sh agent${RESET}"
echo -e "   - Check system status: ${BOLD}./saar.sh status${RESET}"
echo -e "\n${GREEN}Thank you for installing the Claude Neural Framework!${RESET}\n"

exit 0