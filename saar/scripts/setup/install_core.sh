#!/bin/bash

# ===========================================
# Claude Neural Core Installer
# Version: 1.1.0
# Date: 2025-05-11
# ===========================================

set -eo pipefail  # Exit on error, pipe failure

# Environment variables
: "${CLAUDE_API_KEY:=""}"
: "${MCP_API_KEY:=""}"
: "${NODE_VERSION:="20"}"
: "${PYTHON_VERSION:="3.10"}"
: "${CONFIG_DIR:="$HOME/.claude"}"
: "${LOG_LEVEL:="info"}"
: "${INSTALL_DIR:="$(pwd)"}"

# Color codes for output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print header
echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}        Claude Neural Core Installer         ${NC}"
echo -e "${BLUE}           Version 1.1.0                     ${NC}"
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

# Function to handle errors
handle_error() {
  print_error "An error occurred on line $1"
  exit 1
}

# Set up error handling
trap 'handle_error $LINENO' ERR

# Check if running as root
if [[ $EUID -eq 0 ]]; then
  print_error "This script should not be run as root. Please run as a normal user."
  exit 1
fi

# Create log directory
LOG_DIR="${INSTALL_DIR}/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/install-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

print_status "Logging to $LOG_FILE"

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
    
    # Detect OS
    if [ -f /etc/os-release ]; then
      . /etc/os-release
      OS=$ID
    elif [ -f /etc/debian_version ]; then
      OS="debian"
    elif [ -f /etc/redhat-release ]; then
      OS="fedora"
    elif [ -f /etc/arch-release ]; then
      OS="arch"
    else
      OS="unknown"
    fi
    
    case $OS in
      "debian"|"ubuntu")
        print_status "Detected Debian/Ubuntu system"
        sudo apt update
        sudo apt install -y curl git python3-pip nodejs npm
        ;;
      "fedora"|"rhel"|"centos")
        print_status "Detected Fedora/RHEL/CentOS system"
        sudo dnf install -y curl git python3-pip nodejs npm
        ;;
      "arch"|"manjaro")
        print_status "Detected Arch/Manjaro system"
        sudo pacman -Syu --noconfirm curl git python3 nodejs npm
        ;;
      *)
        print_error "Unable to detect package manager. Please install the required dependencies manually."
        echo "Required: curl git node npm python3"
        exit 1
        ;;
    esac
    
    print_success "Dependencies installed."
  else
    print_success "All required dependencies are installed."
  fi
}

# Setup Node.js environment
setup_node() {
  print_status "Setting up Node.js environment..."
  
  # Check Node.js version
  if command -v node &> /dev/null; then
    CURRENT_NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    
    if [ "$CURRENT_NODE_VERSION" -lt 18 ]; then
      print_warning "Node.js version is less than 18. It is recommended to use Node.js 18 or later."
      read -p "Do you want to install/upgrade Node.js using NVM? (y/n): " install_node
      
      if [[ $install_node == "y" ]]; then
        setup_nvm
      else
        print_warning "Continuing with the existing Node.js version. Some features may not work as expected."
      fi
    else
      print_success "Node.js version $CURRENT_NODE_VERSION is compatible."
    fi
  else
    print_warning "Node.js not found. Installing via NVM..."
    setup_nvm
  fi
  
  # Install required npm packages globally
  print_status "Installing global npm packages..."
  npm install -g @smithery/cli typescript ts-node
  print_success "Global npm packages installed."
  
  # Create .npmrc with recommended settings
  if [ ! -f "${INSTALL_DIR}/.npmrc" ]; then
    cat > "${INSTALL_DIR}/.npmrc" << EOF
save-exact=true
fund=false
audit=false
EOF
    print_success "Created .npmrc with recommended settings."
  fi
}

# Setup NVM and Node.js
setup_nvm() {
  print_status "Installing NVM and Node.js $NODE_VERSION..."
  # Install NVM if not already installed
  if ! command -v nvm &> /dev/null; then
    print_status "Installing NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
    
    # Source NVM immediately
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  fi
  
  # Install and use Node.js
  print_status "Installing Node.js $NODE_VERSION..."
  nvm install $NODE_VERSION
  nvm use $NODE_VERSION
  nvm alias default $NODE_VERSION
  print_success "Node.js $NODE_VERSION is now active."
  
  # Add NVM to profile if not already there
  if ! grep -q "NVM_DIR" "$HOME/.bashrc" && ! grep -q "NVM_DIR" "$HOME/.zshrc"; then
    print_status "Adding NVM to shell profile..."
    cat >> "$HOME/.bashrc" << EOF

# NVM
export NVM_DIR="\$HOME/.nvm"
[ -s "\$NVM_DIR/nvm.sh" ] && \. "\$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "\$NVM_DIR/bash_completion" ] && \. "\$NVM_DIR/bash_completion"  # This loads nvm bash_completion
EOF
    print_success "Added NVM to .bashrc"
  fi
}

# Setup Python environment
setup_python() {
  print_status "Setting up Python environment..."
  
  # Check Python version
  if command -v python3 &> /dev/null; then
    CURRENT_PYTHON_VERSION=$(python3 -c 'import sys; print(sys.version_info.major * 10 + sys.version_info.minor)')
    
    if [ "$CURRENT_PYTHON_VERSION" -lt 38 ]; then
      print_warning "Python version is less than 3.8. It is recommended to use Python 3.8 or later."
      print_warning "Continuing with the existing Python version. Some features may not work as expected."
    else
      print_success "Python version $(python3 --version) is compatible."
    fi
  else
    print_error "Python 3 not found. Please install Python 3.8 or later."
    exit 1
  fi
  
  # Create and activate a virtual environment
  if [ ! -d "${INSTALL_DIR}/venv" ]; then
    print_status "Creating Python virtual environment..."
    python3 -m venv "${INSTALL_DIR}/venv"
    print_success "Virtual environment created."
  else
    print_warning "Virtual environment already exists."
  fi
  
  # Activate the virtual environment and install dependencies
  print_status "Installing Python dependencies..."
  source "${INSTALL_DIR}/venv/bin/activate"
  pip install -U pip wheel setuptools
  
  # Check if requirements.txt exists
  if [ -f "${INSTALL_DIR}/requirements.txt" ]; then
    pip install -r "${INSTALL_DIR}/requirements.txt"
  else
    # Install common dependencies
    pip install requests numpy pandas matplotlib anthropic lancedb chromadb
    
    # Create requirements.txt with installed packages
    pip freeze > "${INSTALL_DIR}/requirements.txt"
    print_success "Created requirements.txt with installed packages."
  fi
  
  print_success "Python dependencies installed."
  deactivate
}

# Configure Claude integration
configure_claude() {
  print_status "Configuring Claude integration..."
  
  # Ensure .claude directory exists in home directory
  if [ ! -d "$CONFIG_DIR" ]; then
    mkdir -p "$CONFIG_DIR"
    print_success "Created $CONFIG_DIR directory."
  fi
  
  # Subdirectories
  for subdir in config commands logs scripts; do
    if [ ! -d "$CONFIG_DIR/$subdir" ]; then
      mkdir -p "$CONFIG_DIR/$subdir"
      print_success "Created $CONFIG_DIR/$subdir directory."
    fi
  done
  
  # Check if CLAUDE.md already exists in home directory
  if [ ! -f "$CONFIG_DIR/CLAUDE.md" ]; then
    # Create symlink to CLAUDE.md
    if [ -f "${INSTALL_DIR}/.claude/CLAUDE.md" ]; then
      ln -sf "${INSTALL_DIR}/.claude/CLAUDE.md" "$CONFIG_DIR/CLAUDE.md"
      print_success "Created symlink to CLAUDE.md in home directory."
    else
      print_warning "CLAUDE.md not found in the project directory."
    fi
  else
    # Compare files
    if [ -f "${INSTALL_DIR}/.claude/CLAUDE.md" ] && cmp -s "${INSTALL_DIR}/.claude/CLAUDE.md" "$CONFIG_DIR/CLAUDE.md"; then
      print_warning "CLAUDE.md already exists in home directory and is identical."
    else
      print_warning "CLAUDE.md already exists in home directory but is different."
      read -p "Do you want to replace it? (y/n): " replace_claude
      
      if [[ $replace_claude == "y" ]]; then
        ln -sf "${INSTALL_DIR}/.claude/CLAUDE.md" "$CONFIG_DIR/CLAUDE.md"
        print_success "Replaced CLAUDE.md in home directory."
      fi
    fi
  fi
  
  # Copy config.json if it doesn't exist
  if [ ! -f "$CONFIG_DIR/config/config.json" ]; then
    if [ -f "${INSTALL_DIR}/.claude/config/config.json" ]; then
      cp "${INSTALL_DIR}/.claude/config/config.json" "$CONFIG_DIR/config/config.json"
      print_success "Copied config.json to home directory."
    else
      # Create default config.json
      cat > "$CONFIG_DIR/config/config.json" << EOF
{
  "version": "1.0.0",
  "api": {
    "provider": "anthropic",
    "model": "claude-3-7-sonnet-20250219",
    "temperature": 0.7,
    "max_tokens": 4096
  },
  "defaults": {
    "system_prompt_path": "$CONFIG_DIR/CLAUDE.md",
    "working_directory": "${INSTALL_DIR}"
  },
  "paths": {
    "projects": "${INSTALL_DIR}",
    "templates": "${INSTALL_DIR}/core/templates",
    "prompts": "${INSTALL_DIR}/core/prompts",
    "output": "${INSTALL_DIR}/output"
  },
  "commands": {
    "directory": "${INSTALL_DIR}/.claude/commands"
  },
  "mcp": {
    "config_path": "${INSTALL_DIR}/config/mcp.json",
    "auto_start": true,
    "default_servers": [
      "sequentialthinking",
      "context7-mcp",
      "desktop-commander"
    ]
  },
  "security": {
    "execution_confirmation": true,
    "file_write_confirmation": true,
    "allowed_directories": ["${INSTALL_DIR}", "$CONFIG_DIR"]
  },
  "logging": {
    "enabled": true,
    "level": "$LOG_LEVEL",
    "path": "$CONFIG_DIR/logs"
  }
}
EOF
      print_success "Created default config.json."
    fi
    
    # Ask for API key if not set
    if [ -z "$CLAUDE_API_KEY" ]; then
      read -p "Enter your Anthropic API key (leave empty to configure later): " input_api_key
      if [ ! -z "$input_api_key" ]; then
        CLAUDE_API_KEY=$input_api_key
        
        # Store API key in environment file
        cat > "$CONFIG_DIR/config/.env" << EOF
CLAUDE_API_KEY=$CLAUDE_API_KEY
EOF
        chmod 600 "$CONFIG_DIR/config/.env"
        print_success "API key saved to $CONFIG_DIR/config/.env"
      else
        print_warning "No API key provided. You'll need to configure it later."
      fi
    else
      # Store API key in environment file
      cat > "$CONFIG_DIR/config/.env" << EOF
CLAUDE_API_KEY=$CLAUDE_API_KEY
EOF
      chmod 600 "$CONFIG_DIR/config/.env"
      print_success "API key from environment variable saved to $CONFIG_DIR/config/.env"
    fi
  else
    print_warning "config.json already exists in home directory."
  fi
  
  print_success "Claude integration configured."
}

# Configure MCP servers
configure_mcp() {
  print_status "Configuring MCP servers..."
  
  # Check if the mcp.json file exists
  if [ -f "${INSTALL_DIR}/config/mcp.json" ]; then
    MCP_CONFIG="${INSTALL_DIR}/config/mcp.json"
  elif [ -f "${INSTALL_DIR}/.mcp.json" ]; then
    # Copy old style config to new location
    mkdir -p "${INSTALL_DIR}/config"
    cp "${INSTALL_DIR}/.mcp.json" "${INSTALL_DIR}/config/mcp.json"
    MCP_CONFIG="${INSTALL_DIR}/config/mcp.json"
    print_status "Moved .mcp.json to config/mcp.json"
  else
    print_error "MCP configuration file not found. MCP servers cannot be configured."
    return 1
  fi
  
  # Set up MCP API key environment
  if [ -z "$MCP_API_KEY" ]; then
    read -p "Enter your MCP API key (leave empty to configure later): " input_mcp_key
    if [ ! -z "$input_mcp_key" ]; then
      MCP_API_KEY=$input_mcp_key
      
      # Store MCP key in environment file
      if [ -f "$CONFIG_DIR/config/.env" ]; then
        # Append to existing file
        echo "MCP_API_KEY=$MCP_API_KEY" >> "$CONFIG_DIR/config/.env"
      else
        # Create new file
        cat > "$CONFIG_DIR/config/.env" << EOF
MCP_API_KEY=$MCP_API_KEY
EOF
        chmod 600 "$CONFIG_DIR/config/.env"
      fi
      print_success "MCP API key saved to $CONFIG_DIR/config/.env"
    else
      print_warning "No MCP API key provided. You'll need to configure it later."
    fi
  else
    # Store MCP key in environment file if not already there
    if [ -f "$CONFIG_DIR/config/.env" ] && ! grep -q "MCP_API_KEY" "$CONFIG_DIR/config/.env"; then
      echo "MCP_API_KEY=$MCP_API_KEY" >> "$CONFIG_DIR/config/.env"
      print_success "MCP API key from environment variable saved to $CONFIG_DIR/config/.env"
    fi
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
  for dir in core integration scripts docs config; do
    if [ ! -d "${INSTALL_DIR}/$dir" ]; then
      mkdir -p "${INSTALL_DIR}/$dir"
      print_success "Created $dir directory."
    fi
  done
  
  # Create subdirectories
  for dir in core/{agent,embedding,rag,mcp} \
             integration/{api,database,anthropic} \
             scripts/{setup,cli,utils} \
             docs/{guides,api,examples} \
             config/templates; do
    if [ ! -d "${INSTALL_DIR}/$dir" ]; then
      mkdir -p "${INSTALL_DIR}/$dir"
      print_success "Created $dir directory."
    fi
  done
  
  # Create .claude directory structure if it doesn't exist
  for dir in .claude/{commands,config,scripts}; do
    if [ ! -d "${INSTALL_DIR}/$dir" ]; then
      mkdir -p "${INSTALL_DIR}/$dir"
      print_success "Created $dir directory."
    fi
  done
  
  # Create output and logs directories
  for dir in output logs; do
    if [ ! -d "${INSTALL_DIR}/$dir" ]; then
      mkdir -p "${INSTALL_DIR}/$dir"
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
  
  # Initialize Git repository if not already
  if [ ! -d "${INSTALL_DIR}/.git" ]; then
    print_status "Initializing Git repository..."
    git init "${INSTALL_DIR}"
    
    # Create .gitignore if it doesn't exist
    if [ ! -f "${INSTALL_DIR}/.gitignore" ]; then
      cat > "${INSTALL_DIR}/.gitignore" << EOF
# Environment
.env
venv/
node_modules/
__pycache__/
*.pyc

# Logs
logs/
*.log

# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
*.swo

# Build
dist/
build/
*.egg-info/

# Sensitive
*_key*
*_token*
EOF
      print_success "Created .gitignore file."
    fi
    
    print_success "Git repository initialized."
  fi
}

# Create startup scripts
create_startup_scripts() {
  print_status "Creating startup scripts..."
  
  # Create claude-start.sh script
  cat > "${INSTALL_DIR}/scripts/cli/claude_start.sh" << EOF
#!/bin/bash
# Claude Neural Core CLI starter script

# Load environment variables
if [ -f "$CONFIG_DIR/config/.env" ]; then
  export \$(grep -v '^#' "$CONFIG_DIR/config/.env" | xargs -0)
fi

# Start Claude CLI
npx @smithery/cli "\$@"
EOF
  chmod +x "${INSTALL_DIR}/scripts/cli/claude_start.sh"
  print_success "Created claude_start.sh script."
  
  # Create mcp-start.sh script
  cat > "${INSTALL_DIR}/scripts/cli/mcp_start.sh" << EOF
#!/bin/bash
# MCP servers starter script

# Load environment variables
if [ -f "$CONFIG_DIR/config/.env" ]; then
  export \$(grep -v '^#' "$CONFIG_DIR/config/.env" | xargs -0)
fi

# Default servers to start
SERVERS=("sequentialthinking" "context7-mcp" "desktop-commander")

# Check if servers were specified
if [ \$# -gt 0 ]; then
  SERVERS=("\$@")
fi

echo "Starting MCP servers: \${SERVERS[*]}"

# Start each server
for server in "\${SERVERS[@]}"; do
  echo "Starting \$server..."
  npx @smithery/cli mcp start \$server &
done

echo "MCP servers started. Press Ctrl+C to stop."
wait
EOF
  chmod +x "${INSTALL_DIR}/scripts/cli/mcp_start.sh"
  print_success "Created mcp_start.sh script."
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
  create_startup_scripts
  
  print_status "Setting up example files and templates..."
  
  echo -e "\n${GREEN}=============================================${NC}"
  echo -e "${GREEN}       Claude Neural Core Installation        ${NC}"
  echo -e "${GREEN}                 Complete!                    ${NC}"
  echo -e "${GREEN}=============================================${NC}"
  echo -e "\nYou can now use the Claude Neural Integration Framework."
  echo -e "\n${YELLOW}Next steps:${NC}"
  echo -e "  1. Set your Anthropic API key in $CONFIG_DIR/config/.env (if not already set)"
  echo -e "  2. Start using the framework with: ${INSTALL_DIR}/scripts/cli/claude_start.sh"
  echo -e "  3. Explore the documentation in the docs/ directory"
  echo -e "  4. Start MCP servers with: ${INSTALL_DIR}/scripts/cli/mcp_start.sh"
  echo -e "\n${BLUE}Documentation${NC}"
  echo -e "  - Framework overview: docs/guides/framework_overview.md"
  echo -e "  - API documentation: docs/api/"
  echo -e "  - Example workflows: docs/examples/"
  echo -e "\n${BLUE}=============================================${NC}"
}

# Run the main function
main

# Exit successfully
exit 0
