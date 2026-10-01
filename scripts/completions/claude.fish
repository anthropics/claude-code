# Fish completion for Claude Code CLI
# https://github.com/anthropics/claude-code
#
# Installation:
#   claude completion fish > ~/.config/fish/completions/claude.fish

# Disable file completions by default
complete -c claude -f

# Helper: true when no subcommand has been given
function __claude_no_subcommand
    set -l tokens (commandline -opc)
    for t in $tokens[2..]
        switch $t
            case auth doctor install mcp plugin setup-token update
                return 1
        end
    end
    return 0
end

# Helper: true when the given subcommand is active
function __claude_using_subcommand
    set -l tokens (commandline -opc)
    for t in $tokens[2..]
        if test "$t" = "$argv[1]"
            return 0
        end
    end
    return 1
end

# Helper: true when a nested subcommand is active (e.g., mcp add)
function __claude_using_nested_subcommand
    set -l tokens (commandline -opc)
    set -l found_parent 0
    for t in $tokens[2..]
        if test $found_parent -eq 0
            if test "$t" = "$argv[1]"
                set found_parent 1
            end
        else
            if test "$t" = "$argv[2]"
                return 0
            end
        end
    end
    return 1
end

# Helper: true when a subcommand is active but no nested subcommand yet
function __claude_needs_nested_subcommand
    set -l tokens (commandline -opc)
    set -l found_parent 0
    for t in $tokens[2..]
        if test $found_parent -eq 0
            if test "$t" = "$argv[1]"
                set found_parent 1
            end
        else
            # Check if any of the possible nested subcommands have been entered
            for sub in $argv[2..]
                if test "$t" = "$sub"
                    return 1
                end
            end
        end
    end
    return $found_parent  # 0 if parent found (and no nested), 1 if parent not found
end

# --- Top-level subcommands ---
complete -c claude -n __claude_no_subcommand -a auth -d 'Manage authentication'
complete -c claude -n __claude_no_subcommand -a doctor -d 'Check the health of your Claude Code auto-updater'
complete -c claude -n __claude_no_subcommand -a install -d 'Install Claude Code native build'
complete -c claude -n __claude_no_subcommand -a mcp -d 'Configure and manage MCP servers'
complete -c claude -n __claude_no_subcommand -a plugin -d 'Manage Claude Code plugins'
complete -c claude -n __claude_no_subcommand -a setup-token -d 'Set up a long-lived authentication token'
complete -c claude -n __claude_no_subcommand -a update -d 'Check for updates and install if available'

# --- Global flags ---
complete -c claude -n __claude_no_subcommand -l add-dir -d 'Additional directories to allow tool access to' -r -F
complete -c claude -n __claude_no_subcommand -l agent -d 'Agent for the current session' -r
complete -c claude -n __claude_no_subcommand -l agents -d 'JSON object defining custom agents' -r
complete -c claude -n __claude_no_subcommand -l allow-dangerously-skip-permissions -d 'Enable bypassing permission checks as an option'
complete -c claude -n __claude_no_subcommand -l allowed-tools -d 'Tool names to allow' -r
complete -c claude -n __claude_no_subcommand -l append-system-prompt -d 'Append a system prompt' -r
complete -c claude -n __claude_no_subcommand -l betas -d 'Beta headers for API requests' -r
complete -c claude -n __claude_no_subcommand -l chrome -d 'Enable Claude in Chrome integration'
complete -c claude -n __claude_no_subcommand -s c -l continue -d 'Continue the most recent conversation'
complete -c claude -n __claude_no_subcommand -l dangerously-skip-permissions -d 'Bypass all permission checks'
complete -c claude -n __claude_no_subcommand -s d -l debug -d 'Enable debug mode with optional category filtering' -r
complete -c claude -n __claude_no_subcommand -l debug-file -d 'Write debug logs to a file' -r -F
complete -c claude -n __claude_no_subcommand -l disable-slash-commands -d 'Disable all skills'
complete -c claude -n __claude_no_subcommand -l disallowed-tools -d 'Tool names to deny' -r
complete -c claude -n __claude_no_subcommand -l effort -d 'Effort level for the session' -r -a 'low medium high'
complete -c claude -n __claude_no_subcommand -l fallback-model -d 'Fallback model when default is overloaded' -r
complete -c claude -n __claude_no_subcommand -l file -d 'File resources to download at startup' -r
complete -c claude -n __claude_no_subcommand -l fork-session -d 'Create a new session ID when resuming'
complete -c claude -n __claude_no_subcommand -l from-pr -d 'Resume a session linked to a PR' -r
complete -c claude -n __claude_no_subcommand -s h -l help -d 'Display help for command'
complete -c claude -n __claude_no_subcommand -l ide -d 'Automatically connect to IDE on startup'
complete -c claude -n __claude_no_subcommand -l include-partial-messages -d 'Include partial message chunks'
complete -c claude -n __claude_no_subcommand -l input-format -d 'Input format' -r -a 'text stream-json'
complete -c claude -n __claude_no_subcommand -l json-schema -d 'JSON Schema for structured output' -r
complete -c claude -n __claude_no_subcommand -l max-budget-usd -d 'Maximum dollar amount for API calls' -r
complete -c claude -n __claude_no_subcommand -l mcp-config -d 'Load MCP servers from JSON files' -r -F
complete -c claude -n __claude_no_subcommand -l mcp-debug -d 'Enable MCP debug mode (deprecated)'
complete -c claude -n __claude_no_subcommand -l model -d 'Model for the current session' -r
complete -c claude -n __claude_no_subcommand -l no-chrome -d 'Disable Claude in Chrome integration'
complete -c claude -n __claude_no_subcommand -l no-session-persistence -d 'Disable session persistence'
complete -c claude -n __claude_no_subcommand -l output-format -d 'Output format' -r -a 'text json stream-json'
complete -c claude -n __claude_no_subcommand -l permission-mode -d 'Permission mode' -r -a 'acceptEdits bypassPermissions default delegate dontAsk plan'
complete -c claude -n __claude_no_subcommand -l plugin-dir -d 'Load plugins from directories' -r -F
complete -c claude -n __claude_no_subcommand -s p -l print -d 'Print response and exit'
complete -c claude -n __claude_no_subcommand -l replay-user-messages -d 'Re-emit user messages on stdout'
complete -c claude -n __claude_no_subcommand -s r -l resume -d 'Resume a conversation by session ID' -r
complete -c claude -n __claude_no_subcommand -l session-id -d 'Use a specific session ID' -r
complete -c claude -n __claude_no_subcommand -l setting-sources -d 'Setting sources to load' -r
complete -c claude -n __claude_no_subcommand -l settings -d 'Path to settings JSON file' -r -F
complete -c claude -n __claude_no_subcommand -l strict-mcp-config -d 'Only use MCP servers from --mcp-config'
complete -c claude -n __claude_no_subcommand -l system-prompt -d 'System prompt for the session' -r
complete -c claude -n __claude_no_subcommand -l tools -d 'Available tools from the built-in set' -r
complete -c claude -n __claude_no_subcommand -l verbose -d 'Override verbose mode setting'
complete -c claude -n __claude_no_subcommand -s v -l version -d 'Output the version number'

# --- auth subcommands ---
complete -c claude -n '__claude_needs_nested_subcommand auth login logout status' -a login -d 'Sign in to your Anthropic account'
complete -c claude -n '__claude_needs_nested_subcommand auth login logout status' -a logout -d 'Log out from your Anthropic account'
complete -c claude -n '__claude_needs_nested_subcommand auth login logout status' -a status -d 'Show authentication status'
complete -c claude -n '__claude_using_nested_subcommand auth login' -l email -d 'Pre-populate email address' -r
complete -c claude -n '__claude_using_nested_subcommand auth login' -l sso -d 'Force SSO login flow'
complete -c claude -n '__claude_using_nested_subcommand auth status' -l json -d 'Output as JSON'
complete -c claude -n '__claude_using_nested_subcommand auth status' -l text -d 'Output as human-readable text'

# --- mcp subcommands ---
complete -c claude -n '__claude_needs_nested_subcommand mcp add add-from-claude-desktop add-json get list remove reset-project-choices serve' -a add -d 'Add an MCP server'
complete -c claude -n '__claude_needs_nested_subcommand mcp add add-from-claude-desktop add-json get list remove reset-project-choices serve' -a add-from-claude-desktop -d 'Import MCP servers from Claude Desktop'
complete -c claude -n '__claude_needs_nested_subcommand mcp add add-from-claude-desktop add-json get list remove reset-project-choices serve' -a add-json -d 'Add an MCP server with a JSON string'
complete -c claude -n '__claude_needs_nested_subcommand mcp add add-from-claude-desktop add-json get list remove reset-project-choices serve' -a get -d 'Get details about an MCP server'
complete -c claude -n '__claude_needs_nested_subcommand mcp add add-from-claude-desktop add-json get list remove reset-project-choices serve' -a list -d 'List configured MCP servers'
complete -c claude -n '__claude_needs_nested_subcommand mcp add add-from-claude-desktop add-json get list remove reset-project-choices serve' -a remove -d 'Remove an MCP server'
complete -c claude -n '__claude_needs_nested_subcommand mcp add add-from-claude-desktop add-json get list remove reset-project-choices serve' -a reset-project-choices -d 'Reset approved/rejected project-scoped servers'
complete -c claude -n '__claude_needs_nested_subcommand mcp add add-from-claude-desktop add-json get list remove reset-project-choices serve' -a serve -d 'Start the Claude Code MCP server'

complete -c claude -n '__claude_using_nested_subcommand mcp serve' -s d -l debug -d 'Enable debug mode'
complete -c claude -n '__claude_using_nested_subcommand mcp serve' -l verbose -d 'Override verbose mode'
complete -c claude -n '__claude_using_nested_subcommand mcp add' -s s -l scope -d 'Configuration scope' -r -a 'local user project'
complete -c claude -n '__claude_using_nested_subcommand mcp add' -s t -l transport -d 'Transport type' -r -a 'stdio sse http'
complete -c claude -n '__claude_using_nested_subcommand mcp add' -s e -l env -d 'Set environment variables' -r
complete -c claude -n '__claude_using_nested_subcommand mcp add' -s H -l header -d 'Set WebSocket headers' -r
complete -c claude -n '__claude_using_nested_subcommand mcp add' -l callback-port -d 'Fixed port for OAuth callback' -r
complete -c claude -n '__claude_using_nested_subcommand mcp add' -l client-id -d 'OAuth client ID' -r
complete -c claude -n '__claude_using_nested_subcommand mcp add' -l client-secret -d 'Prompt for OAuth client secret'
complete -c claude -n '__claude_using_nested_subcommand mcp add-json' -s s -l scope -d 'Configuration scope' -r -a 'local user project'
complete -c claude -n '__claude_using_nested_subcommand mcp add-json' -l client-secret -d 'Prompt for OAuth client secret'
complete -c claude -n '__claude_using_nested_subcommand mcp remove' -s s -l scope -d 'Configuration scope' -r -a 'local user project'
complete -c claude -n '__claude_using_nested_subcommand mcp add-from-claude-desktop' -s s -l scope -d 'Configuration scope' -r -a 'local user project'

# --- plugin subcommands ---
complete -c claude -n '__claude_needs_nested_subcommand plugin disable enable install list marketplace uninstall update validate' -a disable -d 'Disable an enabled plugin'
complete -c claude -n '__claude_needs_nested_subcommand plugin disable enable install list marketplace uninstall update validate' -a enable -d 'Enable a disabled plugin'
complete -c claude -n '__claude_needs_nested_subcommand plugin disable enable install list marketplace uninstall update validate' -a install -d 'Install a plugin from marketplaces'
complete -c claude -n '__claude_needs_nested_subcommand plugin disable enable install list marketplace uninstall update validate' -a list -d 'List installed plugins'
complete -c claude -n '__claude_needs_nested_subcommand plugin disable enable install list marketplace uninstall update validate' -a marketplace -d 'Manage marketplaces'
complete -c claude -n '__claude_needs_nested_subcommand plugin disable enable install list marketplace uninstall update validate' -a uninstall -d 'Uninstall an installed plugin'
complete -c claude -n '__claude_needs_nested_subcommand plugin disable enable install list marketplace uninstall update validate' -a update -d 'Update a plugin'
complete -c claude -n '__claude_needs_nested_subcommand plugin disable enable install list marketplace uninstall update validate' -a validate -d 'Validate a plugin manifest'

complete -c claude -n '__claude_using_nested_subcommand plugin install' -s s -l scope -d 'Installation scope' -r -a 'user project local'
complete -c claude -n '__claude_using_nested_subcommand plugin uninstall' -s s -l scope -d 'Uninstall from scope' -r -a 'user project local'
complete -c claude -n '__claude_using_nested_subcommand plugin enable' -s s -l scope -d 'Installation scope' -r -a 'user project local'
complete -c claude -n '__claude_using_nested_subcommand plugin disable' -s s -l scope -d 'Installation scope' -r -a 'user project local'
complete -c claude -n '__claude_using_nested_subcommand plugin disable' -s a -l all -d 'Disable all enabled plugins'
complete -c claude -n '__claude_using_nested_subcommand plugin update' -s s -l scope -d 'Installation scope' -r -a 'user project local managed'
complete -c claude -n '__claude_using_nested_subcommand plugin list' -l json -d 'Output as JSON'
complete -c claude -n '__claude_using_nested_subcommand plugin list' -l available -d 'Include available plugins from marketplaces'

# --- install subcommand ---
complete -c claude -n '__claude_using_subcommand install' -l force -d 'Force installation even if already installed'
complete -c claude -n '__claude_using_subcommand install' -a 'stable latest' -d 'Version target'
