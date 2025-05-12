# Claude Neural Framework Installation Guide

There are several ways to install the Claude Neural Framework. Choose the method that best fits your needs.

## Option 1: One-Line Curl Installer (Recommended)

### Standard Installation

The fastest way to install is using our one-line curl installer:

```bash
curl -sSL https://raw.githubusercontent.com/username/claude-code/main/curl_installer.sh | bash
```

This will:
1. Download the installer script
2. Check requirements
3. Clone the repository to ~/claude-neural-framework (default)
4. Run the base installation process
5. Configure your environment

### Interactive Installation (SAAR Guided Setup)

For a comprehensive guided setup experience with step-by-step configuration:

```bash
curl -sSL https://raw.githubusercontent.com/username/claude-code/main/curl_installer.sh | bash -s -- --interactive
```

The interactive installer provides:
- Guided setup process
- SAAR command configuration
- About profile creation
- Color schema customization
- Service configuration
- Enhanced onboarding experience

### Quick Installation

For a faster installation with sensible defaults:

```bash
curl -sSL https://raw.githubusercontent.com/username/claude-code/main/curl_installer.sh | bash -s -- --quick
```

This runs the installer with minimal prompts and sensible defaults.

### Custom Installation Directory

You can specify a custom installation directory with any of the above methods:

```bash
export INSTALL_DIR=/path/to/custom/directory
curl -sSL https://raw.githubusercontent.com/username/claude-code/main/curl_installer.sh | bash
```

Combine with other options as needed:

```bash
export INSTALL_DIR=/path/to/custom/directory
curl -sSL https://raw.githubusercontent.com/username/claude-code/main/curl_installer.sh | bash -s -- --interactive
```

## Option 2: Manual Installation

If you prefer more control over the installation process:

```bash
# Clone repository
git clone https://github.com/username/claude-code.git
cd claude-code

# Run installation script
./optimized_simple_install.sh  # Recommended - enhanced version
# or
./simple_install.sh            # Basic version

# Set up SAAR (optional)
./saar.sh setup                # Interactive setup
# or
./saar.sh setup --quick        # Quick setup with defaults
```

## Option 3: Docker Installation

For containerized deployment:

```bash
# Pull the Docker image
docker pull username/claude-neural-framework:latest

# Run the container
docker run -e CLAUDE_API_KEY=your_api_key -p 8080:8080 username/claude-neural-framework:latest
```

## SAAR Framework

The SAAR (Setup, Activate, Apply, Run) framework provides a comprehensive management interface for your Claude Neural Framework installation. After installation, you can use it to:

```bash
# Set up the environment
./saar.sh setup

# Configure your about profile
./saar.sh about

# Customize color schemes
./saar.sh colors --theme=dark

# Set up a new project
./saar.sh project

# Start MCP servers and services
./saar.sh start

# Launch Claude agent
./saar.sh agent

# Check system status
./saar.sh status

# Manage enterprise features
./saar.sh enterprise
```

## After Installation

Once installed, you need to configure your API keys:

```bash
# Configure API keys
export CLAUDE_API_KEY="your_anthropic_api_key_here"
export MCP_API_KEY="your_mcp_api_key_here"  # Optional
export VOYAGE_API_KEY="your_voyage_api_key_here"  # Optional, for embeddings
```

## System Requirements

- **OS**: Linux, macOS, or Windows with WSL2
- **Node.js**: v18+ (recommended)
- **Python**: v3.8+ (for RAG components)
- **Disk space**: 1GB+ free space
- **Dependencies**: git, curl, npm

## Troubleshooting

If you encounter issues during installation:

1. Check the installation log:
   ```bash
   cat ~/claude-neural-framework/installation_log_*.log
   ```

2. Verify your API keys:
   ```bash
   echo $CLAUDE_API_KEY | wc -c  # Should be >30 characters
   ```

3. Check Node.js version:
   ```bash
   node -v  # Should be v18.0.0 or higher
   ```

4. Check SAAR status:
   ```bash
   ./saar.sh status
   ```

For more detailed troubleshooting, refer to the [documentation](docs/guides/installation_troubleshooting.md).