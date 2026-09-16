#compdef claude

# Zsh completion for claude command

_claude() {
  local context state state_descr line
  typeset -A opt_args

  _arguments -C \
    '(-d --debug)'{-d,--debug}'[Enable debug mode]' \
    '--verbose[Override verbose mode setting from config]' \
    '(-p --print)'{-p,--print}'[Print response and exit (useful for pipes)]' \
    '--output-format[Output format]:format:(text json stream-json)' \
    '--input-format[Input format]:format:(text stream-json)' \
    '--mcp-debug[DEPRECATED - Enable MCP debug mode]' \
    '--dangerously-skip-permissions[Bypass all permission checks]' \
    '--allowedTools[Comma or space-separated list of tool names to allow]:tools:' \
    '--disallowedTools[Comma or space-separated list of tool names to deny]:tools:' \
    '--mcp-config[Load MCP servers from a JSON file or string]:file:_files' \
    '--append-system-prompt[Append a system prompt to the default system prompt]:prompt:' \
    '--permission-mode[Permission mode to use for the session]:mode:(acceptEdits bypassPermissions default plan)' \
    '(-c --continue)'{-c,--continue}'[Continue the most recent conversation]' \
    '(-r --resume)'{-r,--resume}'[Resume a conversation]:session_id:' \
    '--model[Model for the current session]:model:(sonnet opus haiku claude-sonnet-4-20250514)' \
    '--fallback-model[Enable automatic fallback to specified model]:model:(sonnet opus haiku claude-sonnet-4-20250514)' \
    '--settings[Path to a settings JSON file]:file:_files' \
    '--add-dir[Additional directories to allow tool access to]:directory:_directories' \
    '--ide[Automatically connect to IDE on startup]' \
    '--strict-mcp-config[Only use MCP servers from --mcp-config]' \
    '--session-id[Use a specific session ID (must be a valid UUID)]:uuid:' \
    '(-v --version)'{-v,--version}'[Output the version number]' \
    '(-h --help)'{-h,--help}'[Display help for command]' \
    '1: :_claude_commands' \
    '*::arg:->args' \
    && return 0

  case $state in
    args)
      case $words[1] in
        config) _claude_config ;;
        mcp) _claude_mcp ;;
        install) _claude_install ;;
        migrate-installer|setup-token|doctor|update)
          _arguments \
            '(-h --help)'{-h,--help}'[Display help for command]'
          ;;
      esac
      ;;
  esac
}

_claude_commands() {
  local commands; commands=(
    'config:Manage configuration'
    'mcp:Configure and manage MCP servers'
    'migrate-installer:Migrate from global npm installation to local installation'
    'setup-token:Set up a long-lived authentication token'
    'doctor:Check the health of your Claude Code auto-updater'
    'update:Check for updates and install if available'
    'install:Install Claude Code native build'
  )
  _describe 'command' commands
}

_claude_config() {
  local context state state_descr line
  typeset -A opt_args

  _arguments -C \
    '(-g --global)'{-g,--global}'[Use global config]' \
    '(-h --help)'{-h,--help}'[Display help for command]' \
    '1: :_claude_config_commands' \
    '*::arg:->args' \
    && return 0

  case $state in
    args)
      case $words[1] in
        get)
          _arguments \
            '(-g --global)'{-g,--global}'[Use global config]' \
            '(-h --help)'{-h,--help}'[Display help for command]' \
            '1:key:'
          ;;
        set)
          _arguments \
            '(-g --global)'{-g,--global}'[Use global config]' \
            '(-h --help)'{-h,--help}'[Display help for command]' \
            '1:key:' \
            '2:value:'
          ;;
        remove|rm)
          _arguments \
            '(-g --global)'{-g,--global}'[Use global config]' \
            '(-h --help)'{-h,--help}'[Display help for command]' \
            '1:key:' \
            '*:values:'
          ;;
        list|ls)
          _arguments \
            '(-g --global)'{-g,--global}'[Use global config]' \
            '(-h --help)'{-h,--help}'[Display help for command]'
          ;;
        add)
          _arguments \
            '(-g --global)'{-g,--global}'[Use global config]' \
            '(-h --help)'{-h,--help}'[Display help for command]' \
            '1:key:' \
            '*:values:'
          ;;
        help)
          _claude_config_commands
          ;;
      esac
      ;;
  esac
}

_claude_config_commands() {
  local commands; commands=(
    'get:Get a config value'
    'set:Set a config value'
    'remove:Remove a config value or items from a config array'
    'rm:Remove a config value or items from a config array'
    'list:List all config values'
    'ls:List all config values'
    'add:Add items to a config array'
    'help:Display help for command'
  )
  _describe 'config command' commands
}

_claude_mcp() {
  local context state state_descr line
  typeset -A opt_args

  _arguments -C \
    '(-h --help)'{-h,--help}'[Display help for command]' \
    '1: :_claude_mcp_commands' \
    '*::arg:->args' \
    && return 0

  case $state in
    args)
      case $words[1] in
        serve)
          _arguments \
            '(-p --port)'{-p,--port}'[Port number for MCP server]:port:' \
            '(-h --help)'{-h,--help}'[Display help for command]'
          ;;
        add)
          _arguments \
            '(-s --scope)'{-s,--scope}'[Configuration scope]:scope:(local user project)' \
            '(-t --transport)'{-t,--transport}'[Transport type]:transport:(stdio sse http)' \
            '(-e --env)'{-e,--env}'[Set environment variables]:env:' \
            '(-H --header)'{-H,--header}'[Set HTTP headers]:header:' \
            '(-h --help)'{-h,--help}'[Display help for command]' \
            '1:name:' \
            '2:commandOrUrl:' \
            '*:args:'
          ;;
        remove|get)
          _arguments \
            '(-h --help)'{-h,--help}'[Display help for command]' \
            '1:name:'
          ;;
        add-json)
          _arguments \
            '(-s --scope)'{-s,--scope}'[Configuration scope]:scope:(local user project)' \
            '(-h --help)'{-h,--help}'[Display help for command]' \
            '1:name:' \
            '2:json:'
          ;;
        add-from-claude-desktop)
          _arguments \
            '(-s --scope)'{-s,--scope}'[Configuration scope]:scope:(local user project)' \
            '(-h --help)'{-h,--help}'[Display help for command]'
          ;;
        list|reset-project-choices)
          _arguments \
            '(-h --help)'{-h,--help}'[Display help for command]'
          ;;
        help)
          _claude_mcp_commands
          ;;
      esac
      ;;
  esac
}

_claude_mcp_commands() {
  local commands; commands=(
    'serve:Start the Claude Code MCP server'
    'add:Add a server'
    'remove:Remove an MCP server'
    'list:List configured MCP servers'
    'get:Get details about an MCP server'
    'add-json:Add an MCP server (stdio or SSE) with a JSON string'
    'add-from-claude-desktop:Import MCP servers from Claude Desktop (Mac and WSL only)'
    'reset-project-choices:Reset all approved and rejected project-scoped (.mcp.json) servers'
    'help:Display help for command'
  )
  _describe 'mcp command' commands
}

_claude_install() {
  _arguments \
    '--force[Force installation even if already installed]' \
    '(-h --help)'{-h,--help}'[Display help for command]' \
    '1:target:(stable latest)'
}

_claude "$@"