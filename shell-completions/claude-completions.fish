# Fish shell completions for claude command

# Global options
complete -c claude -s d -l debug -d "Enable debug mode"
complete -c claude -l verbose -d "Override verbose mode setting from config"
complete -c claude -s p -l print -d "Print response and exit (useful for pipes)"
complete -c claude -l output-format -xa "text json stream-json" -d "Output format (only works with --print)"
complete -c claude -l input-format -xa "text stream-json" -d "Input format (only works with --print)"
complete -c claude -l mcp-debug -d "[DEPRECATED] Enable MCP debug mode"
complete -c claude -l dangerously-skip-permissions -d "Bypass all permission checks"
complete -c claude -l allowedTools -d "Comma or space-separated list of tool names to allow"
complete -c claude -l disallowedTools -d "Comma or space-separated list of tool names to deny"
complete -c claude -l mcp-config -rF -d "Load MCP servers from a JSON file or string"
complete -c claude -l append-system-prompt -d "Append a system prompt to the default system prompt"
complete -c claude -l permission-mode -xa "acceptEdits bypassPermissions default plan" -d "Permission mode to use for the session"
complete -c claude -s c -l continue -d "Continue the most recent conversation"
complete -c claude -s r -l resume -d "Resume a conversation - provide a session ID or interactively select"
complete -c claude -l model -xa "sonnet opus haiku claude-sonnet-4-20250514" -d "Model for the current session"
complete -c claude -l fallback-model -xa "sonnet opus haiku claude-sonnet-4-20250514" -d "Enable automatic fallback to specified model when default model is overloaded"
complete -c claude -l settings -rF -d "Path to a settings JSON file to load additional settings from"
complete -c claude -l add-dir -rF -d "Additional directories to allow tool access to"
complete -c claude -l ide -d "Automatically connect to IDE on startup if exactly one valid IDE is available"
complete -c claude -l strict-mcp-config -d "Only use MCP servers from --mcp-config, ignoring all other MCP configurations"
complete -c claude -l session-id -d "Use a specific session ID for the conversation (must be a valid UUID)"
complete -c claude -s v -l version -d "Output the version number"
complete -c claude -s h -l help -d "Display help for command"

# Main commands
complete -c claude -f -n "__fish_use_subcommand" -a "config" -d "Manage configuration"
complete -c claude -f -n "__fish_use_subcommand" -a "mcp" -d "Configure and manage MCP servers"
complete -c claude -f -n "__fish_use_subcommand" -a "migrate-installer" -d "Migrate from global npm installation to local installation"
complete -c claude -f -n "__fish_use_subcommand" -a "setup-token" -d "Set up a long-lived authentication token"
complete -c claude -f -n "__fish_use_subcommand" -a "doctor" -d "Check the health of your Claude Code auto-updater"
complete -c claude -f -n "__fish_use_subcommand" -a "update" -d "Check for updates and install if available"
complete -c claude -f -n "__fish_use_subcommand" -a "install" -d "Install Claude Code native build"

# Config subcommands
complete -c claude -f -n "__fish_seen_subcommand_from config" -a "get" -d "Get a config value"
complete -c claude -f -n "__fish_seen_subcommand_from config" -a "set" -d "Set a config value"
complete -c claude -f -n "__fish_seen_subcommand_from config" -a "remove rm" -d "Remove a config value or items from a config array"
complete -c claude -f -n "__fish_seen_subcommand_from config" -a "list ls" -d "List all config values"
complete -c claude -f -n "__fish_seen_subcommand_from config" -a "add" -d "Add items to a config array"
complete -c claude -f -n "__fish_seen_subcommand_from config" -a "help" -d "Display help for command"

# Config options
complete -c claude -s g -l global -n "__fish_seen_subcommand_from config" -d "Use global config"
complete -c claude -s h -l help -n "__fish_seen_subcommand_from config" -d "Display help for command"

# MCP subcommands
complete -c claude -f -n "__fish_seen_subcommand_from mcp" -a "serve" -d "Start the Claude Code MCP server"
complete -c claude -f -n "__fish_seen_subcommand_from mcp" -a "add" -d "Add a server"
complete -c claude -f -n "__fish_seen_subcommand_from mcp" -a "remove" -d "Remove an MCP server"
complete -c claude -f -n "__fish_seen_subcommand_from mcp" -a "list" -d "List configured MCP servers"
complete -c claude -f -n "__fish_seen_subcommand_from mcp" -a "get" -d "Get details about an MCP server"
complete -c claude -f -n "__fish_seen_subcommand_from mcp" -a "add-json" -d "Add an MCP server (stdio or SSE) with a JSON string"
complete -c claude -f -n "__fish_seen_subcommand_from mcp" -a "add-from-claude-desktop" -d "Import MCP servers from Claude Desktop (Mac and WSL only)"
complete -c claude -f -n "__fish_seen_subcommand_from mcp" -a "reset-project-choices" -d "Reset all approved and rejected project-scoped (.mcp.json) servers within this project"
complete -c claude -f -n "__fish_seen_subcommand_from mcp" -a "help" -d "Display help for command"

# MCP options
complete -c claude -s h -l help -n "__fish_seen_subcommand_from mcp" -d "Display help for command"

# MCP serve options
complete -c claude -s p -l port -n "__fish_seen_subcommand_from mcp; and __fish_seen_subcommand_from serve" -d "Port number for MCP server"
complete -c claude -s h -l help -n "__fish_seen_subcommand_from mcp; and __fish_seen_subcommand_from serve" -d "Display help for command"

# MCP add options
complete -c claude -s s -l scope -xa "local user project" -n "__fish_seen_subcommand_from mcp; and __fish_seen_subcommand_from add" -d "Configuration scope"
complete -c claude -s t -l transport -xa "stdio sse http" -n "__fish_seen_subcommand_from mcp; and __fish_seen_subcommand_from add" -d "Transport type"
complete -c claude -s e -l env -n "__fish_seen_subcommand_from mcp; and __fish_seen_subcommand_from add" -d "Set environment variables"
complete -c claude -s H -l header -n "__fish_seen_subcommand_from mcp; and __fish_seen_subcommand_from add" -d "Set HTTP headers for SSE and HTTP transports"
complete -c claude -s h -l help -n "__fish_seen_subcommand_from mcp; and __fish_seen_subcommand_from add" -d "Display help for command"

# MCP add-json options
complete -c claude -s s -l scope -xa "local user project" -n "__fish_seen_subcommand_from mcp; and __fish_seen_subcommand_from add-json" -d "Configuration scope"
complete -c claude -s h -l help -n "__fish_seen_subcommand_from mcp; and __fish_seen_subcommand_from add-json" -d "Display help for command"

# MCP add-from-claude-desktop options
complete -c claude -s s -l scope -xa "local user project" -n "__fish_seen_subcommand_from mcp; and __fish_seen_subcommand_from add-from-claude-desktop" -d "Configuration scope"
complete -c claude -s h -l help -n "__fish_seen_subcommand_from mcp; and __fish_seen_subcommand_from add-from-claude-desktop" -d "Display help for command"

# Install options
complete -c claude -l force -n "__fish_seen_subcommand_from install" -d "Force installation even if already installed"
complete -c claude -s h -l help -n "__fish_seen_subcommand_from install" -d "Display help for command"

# Install targets
complete -c claude -f -n "__fish_seen_subcommand_from install" -a "stable" -d "Install stable version"
complete -c claude -f -n "__fish_seen_subcommand_from install" -a "latest" -d "Install latest version"

# Help options for simple commands
complete -c claude -s h -l help -n "__fish_seen_subcommand_from migrate-installer setup-token doctor update" -d "Display help for command"