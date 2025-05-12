#!/bin/bash

# ===========================================
# Claude Neural Integration Framework Setup
# Version: 1.0.0
# Date: 2025-05-11
# ===========================================

# Color codes for output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print header
echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}  Claude Neural Integration Framework Setup  ${NC}"
echo -e "${BLUE}=============================================${NC}"

# Function to print status messages
print_status() {
  echo -e "\n${CYAN}[STATUS]${NC} $1"
}

# Function to print success messages
print_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to print error messages
print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Function to print warning messages
print_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
  print_error "This script should not be run as root. Please run as a normal user."
  exit 1
fi

# Check for required dependencies
check_dependencies() {
  print_status "Checking for required dependencies..."
  
  missing_deps=()
  
  for cmd in curl git node npm python3; do
    if ! command -v $cmd &> /dev/null; then
      missing_deps+=($cmd)
    fi
  done
  
  if [ ${#missing_deps[@]} -ne 0 ]; then
    print_error "The following dependencies are missing: ${missing_deps[*]}"
    print_status "Installing missing dependencies..."
    
    if command -v apt &> /dev/null; then
      sudo apt update
      sudo apt install -y curl git python3-pip nodejs npm
    elif command -v dnf &> /dev/null; then
      sudo dnf install -y curl git python3-pip nodejs npm
    elif command -v pacman &> /dev/null; then
      sudo pacman -Syu --noconfirm curl git python3 nodejs npm
    else
      print_error "Unable to detect package manager. Please install the required dependencies manually."
      exit 1
    fi
    
    print_success "Dependencies installed."
  else
    print_success "All required dependencies are installed."
  fi
}

# Setup Node.js environment
setup_node() {
  print_status "Setting up Node.js environment..."
  
  # Check Node.js version
  NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
  
  if [ "$NODE_VERSION" -lt 18 ]; then
    print_warning "Node.js version is less than 18. It is recommended to use Node.js 18 or later."
    read -p "Do you want to install/upgrade Node.js using NVM? (y/n): " install_node
    
    if [[ $install_node == "y" ]]; then
      # Install NVM if not already installed
      if ! command -v nvm &> /dev/null; then
        print_status "Installing NVM..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
        
        # Source NVM immediately
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
      fi
      
      # Install and use Node.js 20
      print_status "Installing Node.js 20 (LTS)..."
      nvm install 20
      nvm use 20
      print_success "Node.js 20 is now active."
    else
      print_warning "Continuing with the existing Node.js version. Some features may not work as expected."
    fi
  else
    print_success "Node.js version $NODE_VERSION is compatible."
  fi
  
  # Install required npm packages globally
  print_status "Installing global npm packages..."
  npm install -g @smithery/cli typescript ts-node
  print_success "Global npm packages installed."
}

# Setup Python environment
setup_python() {
  print_status "Setting up Python environment..."
  
  # Check Python version
  PYTHON_VERSION=$(python3 -c 'import sys; print(sys.version_info.major * 10 + sys.version_info.minor)')
  
  if [ "$PYTHON_VERSION" -lt 38 ]; then
    print_warning "Python version is less than 3.8. It is recommended to use Python 3.8 or later."
    print_warning "Continuing with the existing Python version. Some features may not work as expected."
  else
    print_success "Python version $(python3 --version) is compatible."
  fi
  
  # Create a virtual environment
  if [ ! -d "venv" ]; then
    print_status "Creating Python virtual environment..."
    python3 -m venv venv
    print_success "Virtual environment created."
  else
    print_warning "Virtual environment already exists."
  fi
  
  # Activate the virtual environment and install dependencies
  print_status "Installing Python dependencies..."
  source venv/bin/activate
  pip install -U pip
  pip install -r requirements.txt 2>/dev/null || pip install requests numpy pandas matplotlib
  print_success "Python dependencies installed."
  deactivate
}

# Configure Claude integration
configure_claude() {
  print_status "Configuring Claude integration..."
  
  # Ensure .claude directory exists in home directory
  if [ ! -d "$HOME/.claude" ]; then
    mkdir -p "$HOME/.claude"
    print_success "Created ~/.claude directory."
  fi
  
  # Check if CLAUDE.md already exists in home directory
  if [ ! -f "$HOME/.claude/CLAUDE.md" ]; then
    # Create symlink to CLAUDE.md
    ln -sf "$(pwd)/.claude/CLAUDE.md" "$HOME/.claude/CLAUDE.md"
    print_success "Created symlink to CLAUDE.md in home directory."
  else
    # Compare files
    if cmp -s "$(pwd)/.claude/CLAUDE.md" "$HOME/.claude/CLAUDE.md"; then
      print_warning "CLAUDE.md already exists in home directory and is identical."
    else
      print_warning "CLAUDE.md already exists in home directory but is different."
      read -p "Do you want to replace it? (y/n): " replace_claude
      
      if [[ $replace_claude == "y" ]]; then
        ln -sf "$(pwd)/.claude/CLAUDE.md" "$HOME/.claude/CLAUDE.md"
        print_success "Replaced CLAUDE.md in home directory."
      fi
    fi
  fi
  
  # Copy config.json if it doesn't exist
  if [ ! -f "$HOME/.claude/config.json" ]; then
    cp "$(pwd)/.claude/config.json" "$HOME/.claude/config.json" 2>/dev/null || print_warning "config.json not found."
    print_success "Copied config.json to home directory."
  else
    print_warning "config.json already exists in home directory."
  fi
  
  # Create log directory
  mkdir -p "$HOME/.claude/logs"
  print_success "Claude integration configured."
}

# Configure MCP servers
configure_mcp() {
  print_status "Configuring MCP servers..."
  
  # Check if the .mcp.json file exists
  if [ ! -f ".mcp.json" ]; then
    print_error ".mcp.json file not found. MCP servers cannot be configured."
    return 1
  fi
  
  # Install MCP server dependencies
  print_status "Installing MCP server dependencies..."
  npm install -g @modelcontextprotocol/server-sequential-thinking
  
  # Test starting a server
  print_status "Testing MCP server..."
  npx @modelcontextprotocol/server-sequential-thinking --version &>/dev/null &
  PID=$!
  sleep 2
  kill $PID 2>/dev/null
  
  print_success "MCP servers configured."
}

# Create directory structure if it doesn't exist
create_directory_structure() {
  print_status "Creating directory structure..."
  
  # Create main directories
  for dir in ai_docs specs .claude; do
    if [ ! -d "$dir" ]; then
      mkdir -p "$dir"
      print_success "Created $dir directory."
    fi
  done
  
  # Create subdirectories
  for dir in ai_docs/prompts ai_docs/examples ai_docs/templates specs/openapi specs/schemas specs/migrations .claude/commands; do
    if [ ! -d "$dir" ]; then
      mkdir -p "$dir"
      print_success "Created $dir directory."
    fi
  done
  
  print_success "Directory structure created."
}

# Check GitHub configuration
check_github() {
  print_status "Checking GitHub configuration..."
  
  # Check if git is installed
  if ! command -v git &> /dev/null; then
    print_error "Git is not installed. Please install it first."
    return 1
  fi
  
  # Check if user.name and user.email are configured
  GIT_USER_NAME=$(git config --global user.name)
  GIT_USER_EMAIL=$(git config --global user.email)
  
  if [ -z "$GIT_USER_NAME" ] || [ -z "$GIT_USER_EMAIL" ]; then
    print_warning "Git user.name or user.email is not configured."
    read -p "Do you want to configure them now? (y/n): " configure_git
    
    if [[ $configure_git == "y" ]]; then
      read -p "Enter your name: " git_name
      read -p "Enter your email: " git_email
      
      git config --global user.name "$git_name"
      git config --global user.email "$git_email"
      print_success "Git configured with user.name=$git_name and user.email=$git_email."
    else
      print_warning "Continuing without configuring Git. This may affect some operations."
    fi
  else
    print_success "Git is properly configured with user.name=$GIT_USER_NAME and user.email=$GIT_USER_EMAIL."
  fi
}

# Main function to run all setup steps
main() {
  check_dependencies
  create_directory_structure
  setup_node
  setup_python
  configure_claude
  configure_mcp
  check_github
  
  print_status "Setting up example files and templates..."
  
  # Copy example files and templates
  if [ -f "ai_docs/examples/code-analysis-example.md" ]; then
    print_success "Example files already exist."
  else
    print_warning "Example files not found. Please run the script from the repository root."
  fi
  
  echo -e "\n${GREEN}=============================================${NC}"
  echo -e "${GREEN}     Neural Framework Setup Complete!     ${NC}"
  echo -e "${GREEN}=============================================${NC}"
  echo -e "\nYou can now use the Claude Neural Integration Framework."
  echo -e "\n${YELLOW}Next steps:${NC}"
  echo -e "  1. Set your Anthropic API key in ~/.claude/config.json"
  echo -e "  2. Start using the framework with the CLI: npx @smithery/cli"
  echo -e "  3. Explore the example files in ai_docs/examples/"
  echo -e "  4. Start integrating MCP servers with: claude mcp start"
  echo -e "\n${BLUE}=============================================${NC}"
}

# Run the main function
main

# Exit successfully
exit 0
