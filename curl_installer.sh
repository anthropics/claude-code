#!/usr/bin/env bash

# =====================================================================
# Claude Neural Framework - One-Line Curl Installer
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
BOLD='\033[1m'

# Display banner
echo -e "${BLUE}${BOLD}=========================================================${RESET}"
echo -e "${BLUE}${BOLD}    Claude Neural Framework - One-Line Installer        ${RESET}"
echo -e "${BLUE}${BOLD}=========================================================${RESET}"
echo -e "${CYAN}Version: 1.0.0${RESET}"
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

# Ask for confirmation
echo -e "${YELLOW}This script will install the Claude Neural Framework to:${RESET}"
echo -e "${BOLD}${INSTALL_DIR}${RESET}\n"

read -p "Do you want to continue? (y/n): " -r REPLY
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${RED}Installation cancelled.${RESET}"
  exit 1
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

# Display final message
echo -e "\n${GREEN}${BOLD}===============================================${RESET}"
echo -e "${GREEN}${BOLD}  Claude Neural Framework One-Line Installation${RESET}"
echo -e "${GREEN}${BOLD}===============================================${RESET}"
echo -e "\n${CYAN}Installation has been completed successfully!${RESET}"
echo -e "\n${YELLOW}To use the framework:${RESET}"
echo -e "1. Set your API keys in the environment:"
echo -e "   ${BOLD}export CLAUDE_API_KEY=\"your_anthropic_api_key_here\"${RESET}"
echo -e "   ${BOLD}export MCP_API_KEY=\"your_mcp_api_key_here\"${RESET}"
echo -e "2. Navigate to ${BOLD}${INSTALL_DIR}${RESET}"
echo -e "3. Read the documentation in ${BOLD}README.md${RESET}"
echo -e "\n${GREEN}Thank you for installing the Claude Neural Framework!${RESET}\n"

exit 0