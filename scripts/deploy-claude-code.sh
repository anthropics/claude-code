#!/bin/bash

# Claude Code Deployment & Development Utility
# For plugin marketplace management, releases, and development setup

set -e

echo "╔════════════════════════════════════════════╗"
echo "║      🤖 CLAUDE CODE DEPLOYMENT TOOL       ║"
echo "║   Plugin Marketplace & Release Manager    ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check if running from correct directory
cd "$PROJECT_ROOT"

# Validate we're in the Claude Code repository
if [ ! -d ".claude-plugin" ] || [ ! -f ".claude-plugin/marketplace.json" ]; then
    echo -e "${RED}❌ Error: Not in Claude Code plugin marketplace repository${NC}"
    echo "Expected .claude-plugin/marketplace.json"
    exit 1
fi

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}❌ Required command not found: $1${NC}"
        echo -e "${YELLOW}Install it and try again${NC}"
        exit 1
    fi
}

validate_plugin_structure() {
    local plugin_name=$1
    local plugin_path="$PROJECT_ROOT/plugins/$plugin_name"

    if [ ! -d "$plugin_path" ]; then
        echo -e "${RED}❌ Plugin directory not found: $plugin_path${NC}"
        return 1
    fi

    local has_content=false
    if [ -d "$plugin_path/commands" ] && [ "$(ls -A "$plugin_path/commands" 2>/dev/null)" ]; then
        has_content=true
    fi
    if [ -d "$plugin_path/agents" ] && [ "$(ls -A "$plugin_path/agents" 2>/dev/null)" ]; then
        has_content=true
    fi

    if [ "$has_content" = false ]; then
        echo -e "${RED}❌ Plugin must have commands/ or agents/ directory with content${NC}"
        return 1
    fi

    echo -e "${GREEN}✅ Plugin structure valid${NC}"
    return 0
}

# ============================================================================
# MENU FUNCTIONS
# ============================================================================

show_main_menu() {
    print_header "MAIN MENU"
    echo "What would you like to do?"
    echo ""
    echo "📦 PLUGIN MANAGEMENT:"
    echo "  1) Create new plugin"
    echo "  2) Add plugin to marketplace"
    echo "  3) Update plugin metadata"
    echo "  4) List all plugins"
    echo "  5) Validate plugin structure"
    echo ""
    echo "🚀 RELEASE MANAGEMENT:"
    echo "  6) Prepare new release"
    echo "  7) View current version"
    echo "  8) Generate changelog"
    echo ""
    echo "🛠️  DEVELOPMENT:"
    echo "  9) Setup development environment"
    echo "  10) Test plugin locally"
    echo "  11) Run GitHub Actions locally"
    echo ""
    echo "📚 DOCUMENTATION:"
    echo "  12) Generate plugin documentation"
    echo "  13) View deployment guide"
    echo ""
    echo "  0) Exit"
    echo ""
    read -p "Enter choice (0-13): " CHOICE
}

# ============================================================================
# PLUGIN MANAGEMENT
# ============================================================================

create_new_plugin() {
    print_header "CREATE NEW PLUGIN"

    read -p "Plugin name (e.g., my-awesome-plugin): " PLUGIN_NAME

    # Validate plugin name
    if [[ ! "$PLUGIN_NAME" =~ ^[a-z0-9-]+$ ]]; then
        echo -e "${RED}❌ Invalid plugin name. Use lowercase letters, numbers, and hyphens only.${NC}"
        return 1
    fi

    local plugin_path="$PROJECT_ROOT/plugins/$PLUGIN_NAME"

    if [ -d "$plugin_path" ]; then
        echo -e "${RED}❌ Plugin already exists: $PLUGIN_NAME${NC}"
        return 1
    fi

    echo -e "${BLUE}Creating plugin directory structure...${NC}"
    mkdir -p "$plugin_path"/{commands,agents}

    read -p "Plugin display name: " DISPLAY_NAME
    read -p "Plugin description: " DESCRIPTION

    # Create README
    cat > "$plugin_path/README.md" << EOF
# $DISPLAY_NAME

$DESCRIPTION

## Installation

This plugin is included in the Claude Code marketplace.

## Commands

<!-- List your commands here -->

## Agents

<!-- List your agents here -->

## Usage

\`\`\`bash
claude
> /$PLUGIN_NAME
\`\`\`

## Development

See [Plugin Development Guide](../../docs/plugin-development.md)
EOF

    # Create example command
    cat > "$plugin_path/commands/example.md" << 'EOF'
---
name: example
description: Example command for your plugin
---

# Example Command

This is an example command. Replace this with your actual command implementation.

## Instructions

1. Do something useful
2. Provide helpful output
3. Complete the task

## Example Usage

```bash
claude
> /example
```
EOF

    # Create example agent
    cat > "$plugin_path/agents/example-agent.md" << 'EOF'
---
name: example-agent
description: Example agent for your plugin
model: sonnet
---

# Example Agent

This is an example agent. Replace this with your actual agent implementation.

## Capabilities

- Capability 1
- Capability 2
- Capability 3

## Usage

The agent will be invoked automatically based on context or can be called explicitly.
EOF

    echo -e "${GREEN}✅ Plugin created: $plugin_path${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Edit the command/agent files in: $plugin_path"
    echo "2. Test your plugin locally: option 10 in main menu"
    echo "3. Add to marketplace: option 2 in main menu"
}

add_plugin_to_marketplace() {
    print_header "ADD PLUGIN TO MARKETPLACE"

    # List available plugins not in marketplace
    echo -e "${BLUE}Available plugins:${NC}"
    local index=1
    local plugins=()

    for plugin_dir in "$PROJECT_ROOT/plugins"/*; do
        if [ -d "$plugin_dir" ]; then
            local plugin_name=$(basename "$plugin_dir")
            # Check if already in marketplace
            if ! grep -q "\"name\": \"$plugin_name\"" "$PROJECT_ROOT/.claude-plugin/marketplace.json" 2>/dev/null; then
                echo "  $index) $plugin_name"
                plugins+=("$plugin_name")
                ((index++))
            fi
        fi
    done

    if [ ${#plugins[@]} -eq 0 ]; then
        echo -e "${YELLOW}No plugins available to add. All plugins are already in marketplace.${NC}"
        return 0
    fi

    echo ""
    read -p "Select plugin number (or 0 to cancel): " PLUGIN_INDEX

    if [ "$PLUGIN_INDEX" = "0" ]; then
        return 0
    fi

    if [ "$PLUGIN_INDEX" -lt 1 ] || [ "$PLUGIN_INDEX" -gt ${#plugins[@]} ]; then
        echo -e "${RED}❌ Invalid selection${NC}"
        return 1
    fi

    local selected_plugin="${plugins[$((PLUGIN_INDEX-1))]}"

    # Validate plugin structure
    if ! validate_plugin_structure "$selected_plugin"; then
        return 1
    fi

    read -p "Plugin category (development/productivity/security/other): " CATEGORY
    read -p "Plugin description: " DESCRIPTION

    echo -e "${YELLOW}Note: You'll need to manually add this plugin to .claude-plugin/marketplace.json${NC}"
    echo ""
    echo "Add this entry:"
    echo ""
    cat << EOF
{
  "name": "$selected_plugin",
  "description": "$DESCRIPTION",
  "category": "$CATEGORY",
  "source": "./plugins/$selected_plugin",
  "version": "1.0.0",
  "author": "Anthropic",
  "license": "MIT"
}
EOF
    echo ""
    echo -e "${GREEN}✅ Plugin ready to be added to marketplace${NC}"
}

list_plugins() {
    print_header "INSTALLED PLUGINS"

    echo -e "${BLUE}Reading marketplace.json...${NC}"
    echo ""

    if command -v jq &> /dev/null; then
        jq -r '.plugins[] | "  • \(.name) - \(.description)"' "$PROJECT_ROOT/.claude-plugin/marketplace.json"
    else
        grep -A 2 '"name"' "$PROJECT_ROOT/.claude-plugin/marketplace.json" | grep -v '^--$'
    fi

    echo ""
    echo -e "${CYAN}Total: $(grep -c '"name"' "$PROJECT_ROOT/.claude-plugin/marketplace.json" || echo 0) plugins${NC}"
}

validate_all_plugins() {
    print_header "VALIDATE ALL PLUGINS"

    local failed=0
    local passed=0

    for plugin_dir in "$PROJECT_ROOT/plugins"/*; do
        if [ -d "$plugin_dir" ]; then
            local plugin_name=$(basename "$plugin_dir")
            echo -e "${BLUE}Validating: $plugin_name${NC}"

            if validate_plugin_structure "$plugin_name"; then
                ((passed++))
            else
                ((failed++))
            fi
        fi
    done

    echo ""
    echo -e "${GREEN}✅ Passed: $passed${NC}"
    echo -e "${RED}❌ Failed: $failed${NC}"
}

# ============================================================================
# RELEASE MANAGEMENT
# ============================================================================

prepare_release() {
    print_header "PREPARE NEW RELEASE"

    check_command "git"

    echo -e "${BLUE}Current branch:${NC}"
    git branch --show-current

    echo ""
    echo -e "${YELLOW}⚠️  Note: This script prepares release metadata.${NC}"
    echo -e "${YELLOW}   Actual npm publishing is done by maintainers with proper credentials.${NC}"
    echo ""

    read -p "New version number (e.g., 1.2.3): " NEW_VERSION

    if [[ ! "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo -e "${RED}❌ Invalid version format. Use semantic versioning (e.g., 1.2.3)${NC}"
        return 1
    fi

    echo ""
    echo -e "${BLUE}Preparing release v$NEW_VERSION...${NC}"

    # Update CHANGELOG
    local today=$(date +%Y-%m-%d)
    echo "## [$NEW_VERSION] - $today" > /tmp/changelog_entry.txt
    echo "" >> /tmp/changelog_entry.txt
    echo "### Added" >> /tmp/changelog_entry.txt
    echo "- " >> /tmp/changelog_entry.txt
    echo "" >> /tmp/changelog_entry.txt
    echo "### Changed" >> /tmp/changelog_entry.txt
    echo "- " >> /tmp/changelog_entry.txt
    echo "" >> /tmp/changelog_entry.txt
    echo "### Fixed" >> /tmp/changelog_entry.txt
    echo "- " >> /tmp/changelog_entry.txt
    echo "" >> /tmp/changelog_entry.txt

    echo -e "${GREEN}✅ Release preparation template created${NC}"
    echo ""
    echo "Edit /tmp/changelog_entry.txt and add to CHANGELOG.md"
    echo ""
    echo "Then run:"
    echo "  git add CHANGELOG.md"
    echo "  git commit -m 'chore: Release v$NEW_VERSION'"
    echo "  git tag v$NEW_VERSION"
    echo "  git push origin v$NEW_VERSION"
}

view_version() {
    print_header "CURRENT VERSION"

    if [ -f "package.json" ]; then
        if command -v jq &> /dev/null; then
            local version=$(jq -r '.version' package.json)
            echo -e "${GREEN}Version: $version${NC}"
        else
            grep '"version"' package.json
        fi
    else
        echo -e "${YELLOW}No package.json found${NC}"
    fi

    echo ""
    echo -e "${BLUE}Recent tags:${NC}"
    git tag --sort=-v:refname | head -5 || echo "No tags found"
}

generate_changelog() {
    print_header "GENERATE CHANGELOG"

    check_command "git"

    echo -e "${BLUE}Generating changelog from recent commits...${NC}"
    echo ""

    git log --pretty=format:"- %s (%h)" --no-merges -20

    echo ""
    echo ""
    echo -e "${CYAN}Copy relevant entries to CHANGELOG.md${NC}"
}

# ============================================================================
# DEVELOPMENT SETUP
# ============================================================================

setup_dev_environment() {
    print_header "DEVELOPMENT ENVIRONMENT SETUP"

    echo -e "${BLUE}Checking prerequisites...${NC}"
    echo ""

    # Check Node.js
    if command -v node &> /dev/null; then
        echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
    else
        echo -e "${RED}❌ Node.js not found${NC}"
        echo "   Install from: https://nodejs.org/"
    fi

    # Check npm
    if command -v npm &> /dev/null; then
        echo -e "${GREEN}✅ npm: $(npm --version)${NC}"
    else
        echo -e "${RED}❌ npm not found${NC}"
    fi

    # Check git
    if command -v git &> /dev/null; then
        echo -e "${GREEN}✅ git: $(git --version)${NC}"
    else
        echo -e "${RED}❌ git not found${NC}"
    fi

    # Check Claude Code
    if command -v claude &> /dev/null; then
        echo -e "${GREEN}✅ Claude Code installed${NC}"
    else
        echo -e "${YELLOW}⚠️  Claude Code not found${NC}"
        echo ""
        read -p "Install Claude Code now? (y/n): " INSTALL_CLAUDE
        if [ "$INSTALL_CLAUDE" = "y" ]; then
            echo "Installing Claude Code..."
            npm install -g @anthropic-ai/claude-code
        fi
    fi

    echo ""
    echo -e "${BLUE}Setting up environment variables...${NC}"

    if [ ! -f "$HOME/.claude/config" ]; then
        echo -e "${YELLOW}⚠️  Claude Code not configured${NC}"
        echo ""
        echo "You'll need an Anthropic API key:"
        echo "1. Go to https://console.anthropic.com/"
        echo "2. Create an API key"
        echo "3. Run: claude config"
        echo "4. Enter your API key"
    else
        echo -e "${GREEN}✅ Claude Code configured${NC}"
    fi

    echo ""
    echo -e "${GREEN}✅ Development environment check complete${NC}"
}

test_plugin_locally() {
    print_header "TEST PLUGIN LOCALLY"

    echo -e "${BLUE}Available plugins:${NC}"
    local index=1
    local plugins=()

    for plugin_dir in "$PROJECT_ROOT/plugins"/*; do
        if [ -d "$plugin_dir" ]; then
            local plugin_name=$(basename "$plugin_dir")
            echo "  $index) $plugin_name"
            plugins+=("$plugin_name")
            ((index++))
        fi
    done

    echo ""
    read -p "Select plugin to test (or 0 to cancel): " PLUGIN_INDEX

    if [ "$PLUGIN_INDEX" = "0" ]; then
        return 0
    fi

    if [ "$PLUGIN_INDEX" -lt 1 ] || [ "$PLUGIN_INDEX" -gt ${#plugins[@]} ]; then
        echo -e "${RED}❌ Invalid selection${NC}"
        return 1
    fi

    local selected_plugin="${plugins[$((PLUGIN_INDEX-1))]}"

    echo ""
    echo -e "${BLUE}Testing plugin: $selected_plugin${NC}"
    echo ""
    echo "Plugin location: $PROJECT_ROOT/plugins/$selected_plugin"
    echo ""
    echo -e "${CYAN}To test this plugin with Claude Code:${NC}"
    echo "1. Link this repository to Claude Code:"
    echo "   mkdir -p ~/.claude/plugins"
    echo "   ln -s $PROJECT_ROOT/plugins/$selected_plugin ~/.claude/plugins/"
    echo ""
    echo "2. Run Claude Code in a test directory:"
    echo "   cd /tmp/test-project"
    echo "   claude"
    echo ""
    echo "3. Try the plugin commands (check plugins/$selected_plugin/commands/)"
}

run_github_actions_locally() {
    print_header "RUN GITHUB ACTIONS LOCALLY"

    if ! command -v act &> /dev/null; then
        echo -e "${YELLOW}⚠️  'act' not installed${NC}"
        echo ""
        echo "Install act to run GitHub Actions locally:"
        echo "  macOS: brew install act"
        echo "  Linux: curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash"
        echo ""
        echo "More info: https://github.com/nektos/act"
        return 0
    fi

    echo -e "${BLUE}Available workflows:${NC}"
    ls -1 .github/workflows/

    echo ""
    read -p "Enter workflow filename (or 'all' for all workflows): " WORKFLOW

    if [ "$WORKFLOW" = "all" ]; then
        act -l
    else
        act -W ".github/workflows/$WORKFLOW"
    fi
}

# ============================================================================
# DOCUMENTATION
# ============================================================================

generate_plugin_docs() {
    print_header "GENERATE PLUGIN DOCUMENTATION"

    local output_file="$PROJECT_ROOT/PLUGINS.md"

    cat > "$output_file" << 'EOF'
# Claude Code Plugin Documentation

This document lists all available plugins in the Claude Code marketplace.

## Available Plugins

EOF

    for plugin_dir in "$PROJECT_ROOT/plugins"/*; do
        if [ -d "$plugin_dir" ]; then
            local plugin_name=$(basename "$plugin_dir")
            echo "Processing: $plugin_name"

            cat >> "$output_file" << EOF

### $plugin_name

EOF

            if [ -f "$plugin_dir/README.md" ]; then
                tail -n +2 "$plugin_dir/README.md" >> "$output_file"
            else
                echo "No README.md found for $plugin_name" >> "$output_file"
            fi

            echo "" >> "$output_file"
        fi
    done

    echo -e "${GREEN}✅ Documentation generated: $output_file${NC}"
}

show_deployment_guide() {
    print_header "DEPLOYMENT GUIDE"

    cat << 'EOF'
# Claude Code Deployment Guide

## For Plugin Developers

### 1. Create Your Plugin
```bash
./scripts/deploy-claude-code.sh
# Choose option 1: Create new plugin
```

### 2. Develop Locally
- Edit plugin files in `plugins/your-plugin/`
- Create commands in `commands/*.md`
- Create agents in `agents/*.md`

### 3. Test Your Plugin
```bash
# Link to local Claude Code
ln -s $(pwd)/plugins/your-plugin ~/.claude/plugins/

# Test in a project
cd /path/to/test/project
claude
> /your-command
```

### 4. Submit to Marketplace
1. Create a PR to this repository
2. Add your plugin entry to `.claude-plugin/marketplace.json`
3. Wait for review and approval
4. Plugin becomes available to all Claude Code users!

## For Maintainers

### Release Process

1. **Update Version**
   - Edit version in package.json (if applicable)
   - Update CHANGELOG.md

2. **Create Release**
   ```bash
   git add .
   git commit -m "chore: Release v1.2.3"
   git tag v1.2.3
   git push origin main
   git push origin v1.2.3
   ```

3. **NPM Publishing** (Anthropic team only)
   ```bash
   npm publish --access public
   ```

4. **Announce Release**
   - Create GitHub release
   - Update documentation
   - Notify community

## Architecture

```
Claude Code (npm package)
    ↓
Loads plugins from:
    - Built-in marketplace (this repo)
    - User's ~/.claude/plugins/
    ↓
Executes commands/agents
    ↓
Calls Anthropic Claude API
```

## Distribution Channels

1. **NPM Registry** - Main CLI distribution
2. **GitHub** - Source code & marketplace
3. **Docker Hub** - Development containers
4. **Marketplace** - Plugin repository

## No Server Deployment Needed!

Claude Code is a CLI tool. It does NOT need:
- ❌ Web hosting (Railway/Render/Fly.io)
- ❌ Database hosting (PostgreSQL/MySQL)
- ❌ Load balancers
- ❌ Email services
- ❌ Payment processing

Users install it with:
```bash
npm install -g @anthropic-ai/claude-code
```

That's it!

EOF

    echo ""
    echo -e "${CYAN}Press Enter to continue...${NC}"
    read
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    while true; do
        show_main_menu

        case $CHOICE in
            1) create_new_plugin ;;
            2) add_plugin_to_marketplace ;;
            3) echo -e "${YELLOW}Update plugin metadata: Edit .claude-plugin/marketplace.json manually${NC}" ;;
            4) list_plugins ;;
            5) validate_all_plugins ;;
            6) prepare_release ;;
            7) view_version ;;
            8) generate_changelog ;;
            9) setup_dev_environment ;;
            10) test_plugin_locally ;;
            11) run_github_actions_locally ;;
            12) generate_plugin_docs ;;
            13) show_deployment_guide ;;
            0)
                echo ""
                echo -e "${GREEN}✨ Happy coding with Claude!${NC}"
                echo ""
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid choice${NC}"
                ;;
        esac

        echo ""
        echo -e "${CYAN}Press Enter to return to main menu...${NC}"
        read
    done
}

# Run main function
main
