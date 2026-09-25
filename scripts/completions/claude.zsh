#compdef claude

# Zsh completion script for Claude Code CLI
# https://github.com/anthropics/claude-code
#
# Installation — add to ~/.zshrc:
#   eval "$(claude completion zsh)"

local curcontext="$curcontext" state line
typeset -A opt_args

local -a commands
commands=(
  'auth:Manage authentication'
  'doctor:Check the health of your Claude Code auto-updater'
  'install:Install Claude Code native build'
  'mcp:Configure and manage MCP servers'
  'plugin:Manage Claude Code plugins'
  'setup-token:Set up a long-lived authentication token'
  'update:Check for updates and install if available'
)

local -a auth_commands
auth_commands=(
  'login:Sign in to your Anthropic account'
  'logout:Log out from your Anthropic account'
  'status:Show authentication status'
)

local -a mcp_commands
mcp_commands=(
  'add:Add an MCP server to Claude Code'
  'add-from-claude-desktop:Import MCP servers from Claude Desktop'
  'add-json:Add an MCP server with a JSON string'
  'get:Get details about an MCP server'
  'list:List configured MCP servers'
  'remove:Remove an MCP server'
  'reset-project-choices:Reset approved/rejected project-scoped servers'
  'serve:Start the Claude Code MCP server'
)

local -a plugin_commands
plugin_commands=(
  'disable:Disable an enabled plugin'
  'enable:Enable a disabled plugin'
  'install:Install a plugin from available marketplaces'
  'list:List installed plugins'
  'marketplace:Manage Claude Code marketplaces'
  'uninstall:Uninstall an installed plugin'
  'update:Update a plugin to the latest version'
  'validate:Validate a plugin or marketplace manifest'
)

local -a marketplace_commands
marketplace_commands=(
  'add:Add a marketplace from a URL, path, or GitHub repo'
  'list:List all configured marketplaces'
  'remove:Remove a configured marketplace'
  'update:Update marketplace(s) from their source'
)

case $words[2] in
  auth)
    if (( CURRENT == 3 )); then
      _describe 'auth command' auth_commands
    else
      case $words[3] in
        login)
          _arguments \
            '--email[Pre-populate email address on the login page]:email:' \
            '(-h --help)'{-h,--help}'[Display help]' \
            '--sso[Force SSO login flow]'
          ;;
        logout)
          _arguments \
            '(-h --help)'{-h,--help}'[Display help]'
          ;;
        status)
          _arguments \
            '(-h --help)'{-h,--help}'[Display help]' \
            '--json[Output as JSON]' \
            '--text[Output as human-readable text]'
          ;;
        *)
          _message 'no more arguments'
          ;;
      esac
    fi
    return
    ;;
  mcp)
    if (( CURRENT == 3 )); then
      _describe 'mcp command' mcp_commands
    else
      case $words[3] in
        serve)
          _arguments \
            '(-d --debug)'{-d,--debug}'[Enable debug mode]' \
            '(-h --help)'{-h,--help}'[Display help]' \
            '--verbose[Override verbose mode setting from config]'
          ;;
        add)
          _arguments \
            '--callback-port[Fixed port for OAuth callback]:port:' \
            '--client-id[OAuth client ID for HTTP/SSE servers]:clientId:' \
            '--client-secret[Prompt for OAuth client secret]' \
            '(-e --env)*'{-e,--env}'[Set environment variables (e.g. -e KEY=value)]:env:' \
            '(-H --header)*'{-H,--header}'[Set WebSocket headers]:header:' \
            '(-h --help)'{-h,--help}'[Display help]' \
            '(-s --scope)'{-s,--scope}'[Configuration scope]:scope:(local user project)' \
            '(-t --transport)'{-t,--transport}'[Transport type]:transport:(stdio sse http)' \
            ':name:' \
            ':commandOrUrl:_files' \
            '*:args:_files'
          ;;
        remove)
          _arguments \
            '(-h --help)'{-h,--help}'[Display help]' \
            '(-s --scope)'{-s,--scope}'[Configuration scope]:scope:(local user project)' \
            ':name:'
          ;;
        add-json)
          _arguments \
            '--client-secret[Prompt for OAuth client secret]' \
            '(-h --help)'{-h,--help}'[Display help]' \
            '(-s --scope)'{-s,--scope}'[Configuration scope]:scope:(local user project)' \
            ':name:' \
            ':json:'
          ;;
        add-from-claude-desktop)
          _arguments \
            '(-h --help)'{-h,--help}'[Display help]' \
            '(-s --scope)'{-s,--scope}'[Configuration scope]:scope:(local user project)'
          ;;
        get)
          _arguments \
            '(-h --help)'{-h,--help}'[Display help]' \
            ':name:'
          ;;
        list|reset-project-choices)
          _arguments \
            '(-h --help)'{-h,--help}'[Display help]'
          ;;
        *)
          _message 'no more arguments'
          ;;
      esac
    fi
    return
    ;;
  plugin)
    if (( CURRENT == 3 )); then
      _describe 'plugin command' plugin_commands
    else
      case $words[3] in
        validate)
          _arguments \
            '(-h --help)'{-h,--help}'[Display help]' \
            ':path:_files'
          ;;
        marketplace)
          if (( CURRENT == 4 )); then
            _describe 'marketplace command' marketplace_commands
          else
            case $words[4] in
              add)
                _arguments \
                  '(-h --help)'{-h,--help}'[Display help]' \
                  ':source:_files'
                ;;
              remove)
                _arguments \
                  '(-h --help)'{-h,--help}'[Display help]' \
                  ':name:'
                ;;
              update)
                _arguments \
                  '(-h --help)'{-h,--help}'[Display help]' \
                  '::name:'
                ;;
              list)
                _arguments \
                  '(-h --help)'{-h,--help}'[Display help]' \
                  '--json[Output as JSON]'
                ;;
              *)
                _message 'no more arguments'
                ;;
            esac
          fi
          ;;
        install)
          _arguments \
            '(-h --help)'{-h,--help}'[Display help]' \
            '(-s --scope)'{-s,--scope}'[Installation scope]:scope:(user project local)' \
            ':plugin:'
          ;;
        uninstall)
          _arguments \
            '(-h --help)'{-h,--help}'[Display help]' \
            '(-s --scope)'{-s,--scope}'[Uninstall from scope]:scope:(user project local)' \
            ':plugin:'
          ;;
        enable)
          _arguments \
            '(-h --help)'{-h,--help}'[Display help]' \
            '(-s --scope)'{-s,--scope}'[Installation scope]:scope:(user project local)' \
            ':plugin:'
          ;;
        disable)
          _arguments \
            '(-a --all)'{-a,--all}'[Disable all enabled plugins]' \
            '(-h --help)'{-h,--help}'[Display help]' \
            '(-s --scope)'{-s,--scope}'[Installation scope]:scope:(user project local)' \
            '::plugin:'
          ;;
        update)
          _arguments \
            '(-h --help)'{-h,--help}'[Display help]' \
            '(-s --scope)'{-s,--scope}'[Installation scope]:scope:(user project local managed)' \
            ':plugin:'
          ;;
        list)
          _arguments \
            '--available[Include available plugins from marketplaces]' \
            '(-h --help)'{-h,--help}'[Display help]' \
            '--json[Output as JSON]'
          ;;
        *)
          _message 'no more arguments'
          ;;
      esac
    fi
    return
    ;;
  install)
    _arguments \
      '--force[Force installation even if already installed]' \
      '(-h --help)'{-h,--help}'[Display help]' \
      ':target:(stable latest)'
    return
    ;;
  setup-token|doctor|update)
    _arguments \
      '(-h --help)'{-h,--help}'[Display help]'
    return
    ;;
esac

# Global flags and commands when no subcommand matched
_arguments -s \
  '*--add-dir[Additional directories to allow tool access to]:directory:_files -/' \
  '--agent[Agent for the current session]:agent:' \
  '--agents[JSON object defining custom agents]:json:' \
  '--allow-dangerously-skip-permissions[Enable bypassing all permission checks as an option]' \
  '*--allowedTools[Tool names to allow]:tools:' \
  '*--allowed-tools[Tool names to allow]:tools:' \
  '--append-system-prompt[Append a system prompt]:prompt:' \
  '*--betas[Beta headers for API requests]:betas:' \
  '--chrome[Enable Claude in Chrome integration]' \
  '(-c --continue)'{-c,--continue}'[Continue the most recent conversation]' \
  '--dangerously-skip-permissions[Bypass all permission checks]' \
  '(-d --debug)'{-d,--debug}'[Enable debug mode]:filter:' \
  '--debug-file[Write debug logs to a file]:path:_files' \
  '--disable-slash-commands[Disable all skills]' \
  '*--disallowedTools[Tool names to deny]:tools:' \
  '*--disallowed-tools[Tool names to deny]:tools:' \
  '--effort[Effort level for the session]:level:(low medium high)' \
  '--fallback-model[Fallback model when default is overloaded]:model:' \
  '*--file[File resources to download at startup]:file:' \
  '--fork-session[Create a new session ID when resuming]' \
  '--from-pr[Resume a session linked to a PR]:value:' \
  '(-h --help)'{-h,--help}'[Display help for command]' \
  '--ide[Automatically connect to IDE on startup]' \
  '--include-partial-messages[Include partial message chunks]' \
  '--input-format[Input format]:format:(text stream-json)' \
  '--json-schema[JSON Schema for structured output]:schema:' \
  '--max-budget-usd[Maximum dollar amount for API calls]:amount:' \
  '*--mcp-config[Load MCP servers from JSON files]:config:_files' \
  '--mcp-debug[Enable MCP debug mode (deprecated)]' \
  '--model[Model for the current session]:model:' \
  '--no-chrome[Disable Claude in Chrome integration]' \
  '--no-session-persistence[Disable session persistence]' \
  '--output-format[Output format]:format:(text json stream-json)' \
  '--permission-mode[Permission mode]:mode:(acceptEdits bypassPermissions default delegate dontAsk plan)' \
  '*--plugin-dir[Load plugins from directories]:directory:_files -/' \
  '(-p --print)'{-p,--print}'[Print response and exit]' \
  '--replay-user-messages[Re-emit user messages on stdout]' \
  '(-r --resume)'{-r,--resume}'[Resume a conversation by session ID]:value:' \
  '--session-id[Use a specific session ID]:uuid:' \
  '--setting-sources[Setting sources to load]:sources:' \
  '--settings[Path to settings JSON file]:file:_files' \
  '--strict-mcp-config[Only use MCP servers from --mcp-config]' \
  '--system-prompt[System prompt for the session]:prompt:' \
  '*--tools[Available tools from the built-in set]:tools:' \
  '--verbose[Override verbose mode setting]' \
  '(-v --version)'{-v,--version}'[Output the version number]' \
  '1:command:(auth doctor install mcp plugin setup-token update)' \
  '*:prompt:'
