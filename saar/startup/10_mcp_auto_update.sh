#!/bin/bash

# 10_mcp_auto_update.sh
# SAAR Startup Component for MCP Tools Automatic Update

# Source common utilities
. "${SCRIPT_DIR}/00_common.sh"

print_banner "MCP Tools Automatic Update"

# Set paths
MCP_CONFIG_DIR="${HOME}/.claude/mcp"
MCP_UPDATER_JS="${SCRIPT_DIR}/mcp_tools_updater.js"
MCP_TOOLS_INTEGRATION_JS="${SCRIPT_DIR}/mcp_tools_integration.js"

# Ensure node is available
if ! command -v node &>/dev/null; then
    print_error "Node.js is required but not found in path"
    print_error "Please install Node.js before continuing"
    exit 1
fi

# Ensure updater script exists
if [ ! -f "$MCP_UPDATER_JS" ]; then
    print_warning "MCP tools updater script not found: $MCP_UPDATER_JS"
    print_info "The script should be installed automatically"
    exit 1
fi

# Ensure integration script exists
if [ ! -f "$MCP_TOOLS_INTEGRATION_JS" ]; then
    print_warning "MCP tools integration script not found: $MCP_TOOLS_INTEGRATION_JS"
    print_warning "The script should be installed automatically"
    exit 1
fi

# Create MCP config directory if it doesn't exist
if [ ! -d "$MCP_CONFIG_DIR" ]; then
    print_info "Creating MCP config directory: $MCP_CONFIG_DIR"
    mkdir -p "$MCP_CONFIG_DIR/logs" "$MCP_CONFIG_DIR/cache" "$MCP_CONFIG_DIR/fallbacks"
fi

# Function to check if update is needed
check_update_needed() {
    print_info "Checking if MCP tools update is needed..."
    
    # Check if update check is necessary by running the updater with status command
    local output
    output=$(node "$MCP_UPDATER_JS" status)
    
    if echo "$output" | grep -q "Status: Update due"; then
        return 0  # Update is needed
    else
        return 1  # No update needed
    fi
}

# Function to integrate additional MCP tools
integrate_tools() {
    print_info "Integrating additional MCP tools..."
    node "$MCP_TOOLS_INTEGRATION_JS" integrate
}

# Function to update MCP tools
update_tools() {
    print_info "Updating MCP tools..."
    node "$MCP_UPDATER_JS" update
}

# Function to ensure update scheduling
ensure_scheduled_updates() {
    print_info "Ensuring MCP tools updates are scheduled..."
    node "$MCP_UPDATER_JS" schedule
}

# Main function
main() {
    print_step "Setting up MCP tools automatic update system"
    
    # Integrate additional MCP tools
    integrate_tools
    
    # Check if update is needed
    if check_update_needed; then
        print_info "MCP tools update is needed"
        
        # Ask user if they want to update now
        if confirm "Would you like to update MCP tools now?"; then
            update_tools
        else
            print_info "Skipping update for now. It will be performed during the next scheduled update."
        fi
    else
        print_info "MCP tools are up to date"
    fi
    
    # Set up scheduled updates
    ensure_scheduled_updates
    
    # Add MCP tools update to saar.sh command list
    print_success "MCP tools automatic update system is now ready"
    print_info "You can manually update MCP tools with: saar.sh update-mcp"
    print_info "You can configure update settings with: saar.sh configure-mcp-update"
}

# Execute main function
main