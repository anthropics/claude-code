# Bash completion for Claude Code CLI
# https://github.com/anthropics/claude-code
#
# Installation — add to ~/.bashrc:
#   eval "$(claude completion bash)"

_claude_completion() {
  local cur prev words cword
  _init_completion || return

  local commands="auth doctor install mcp plugin setup-token update"

  local global_flags="
    --add-dir
    --agent
    --agents
    --allow-dangerously-skip-permissions
    --allowedTools --allowed-tools
    --append-system-prompt
    --betas
    --chrome
    --continue -c
    --dangerously-skip-permissions
    --debug -d
    --debug-file
    --disable-slash-commands
    --disallowedTools --disallowed-tools
    --effort
    --fallback-model
    --file
    --fork-session
    --from-pr
    --help -h
    --ide
    --include-partial-messages
    --input-format
    --json-schema
    --max-budget-usd
    --mcp-config
    --mcp-debug
    --model
    --no-chrome
    --no-session-persistence
    --output-format
    --permission-mode
    --plugin-dir
    --print -p
    --replay-user-messages
    --resume -r
    --session-id
    --setting-sources
    --settings
    --strict-mcp-config
    --system-prompt
    --tools
    --verbose
    --version -v
  "

  # Determine the subcommand
  local subcmd=""
  local subcmd_idx=0
  for ((i = 1; i < cword; i++)); do
    case "${words[i]}" in
      auth|doctor|install|mcp|plugin|setup-token|update)
        subcmd="${words[i]}"
        subcmd_idx=$i
        break
        ;;
    esac
  done

  # Complete option values
  case "$prev" in
    --effort)
      COMPREPLY=($(compgen -W "low medium high" -- "$cur"))
      return
      ;;
    --input-format)
      COMPREPLY=($(compgen -W "text stream-json" -- "$cur"))
      return
      ;;
    --output-format)
      COMPREPLY=($(compgen -W "text json stream-json" -- "$cur"))
      return
      ;;
    --permission-mode)
      COMPREPLY=($(compgen -W "acceptEdits bypassPermissions default delegate dontAsk plan" -- "$cur"))
      return
      ;;
    --debug-file|--settings|--mcp-config)
      _filedir
      return
      ;;
    --add-dir|--plugin-dir)
      _filedir -d
      return
      ;;
  esac

  case "$subcmd" in
    "")
      # No subcommand yet — complete commands or global flags
      if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "$global_flags" -- "$cur"))
      else
        COMPREPLY=($(compgen -W "$commands" -- "$cur"))
      fi
      ;;
    auth)
      local auth_cmds="login logout status"
      local auth_subcmd=""
      for ((i = subcmd_idx + 1; i < cword; i++)); do
        case "${words[i]}" in
          login|logout|status) auth_subcmd="${words[i]}" ;;
        esac
      done
      if [[ -z "$auth_subcmd" ]]; then
        COMPREPLY=($(compgen -W "$auth_cmds" -- "$cur"))
      else
        case "$auth_subcmd" in
          login)
            COMPREPLY=($(compgen -W "--email --sso --help -h" -- "$cur"))
            ;;
          status)
            COMPREPLY=($(compgen -W "--json --text --help -h" -- "$cur"))
            ;;
          *)
            COMPREPLY=($(compgen -W "--help -h" -- "$cur"))
            ;;
        esac
      fi
      ;;
    mcp)
      local mcp_cmds="add add-from-claude-desktop add-json get list remove reset-project-choices serve"
      local mcp_subcmd=""
      for ((i = subcmd_idx + 1; i < cword; i++)); do
        case "${words[i]}" in
          add|add-from-claude-desktop|add-json|get|list|remove|reset-project-choices|serve)
            mcp_subcmd="${words[i]}"
            ;;
        esac
      done
      if [[ -z "$mcp_subcmd" ]]; then
        COMPREPLY=($(compgen -W "$mcp_cmds" -- "$cur"))
      else
        case "$mcp_subcmd" in
          serve)
            COMPREPLY=($(compgen -W "--debug -d --verbose --help -h" -- "$cur"))
            ;;
          add)
            COMPREPLY=($(compgen -W "--callback-port --client-id --client-secret --env -e --header -H --scope -s --transport -t --help -h" -- "$cur"))
            ;;
          add-json)
            COMPREPLY=($(compgen -W "--client-secret --scope -s --help -h" -- "$cur"))
            ;;
          remove)
            COMPREPLY=($(compgen -W "--scope -s --help -h" -- "$cur"))
            ;;
          add-from-claude-desktop)
            COMPREPLY=($(compgen -W "--scope -s --help -h" -- "$cur"))
            ;;
          *)
            COMPREPLY=($(compgen -W "--help -h" -- "$cur"))
            ;;
        esac

        # Complete --scope values
        if [[ "$prev" == "--scope" || "$prev" == "-s" ]]; then
          COMPREPLY=($(compgen -W "local user project" -- "$cur"))
          return
        fi
        # Complete --transport values
        if [[ "$prev" == "--transport" || "$prev" == "-t" ]]; then
          COMPREPLY=($(compgen -W "stdio sse http" -- "$cur"))
          return
        fi
      fi
      ;;
    plugin)
      local plugin_cmds="disable enable install list marketplace uninstall update validate"
      local plugin_subcmd=""
      for ((i = subcmd_idx + 1; i < cword; i++)); do
        case "${words[i]}" in
          disable|enable|install|list|marketplace|uninstall|update|validate)
            plugin_subcmd="${words[i]}"
            ;;
        esac
      done
      if [[ -z "$plugin_subcmd" ]]; then
        COMPREPLY=($(compgen -W "$plugin_cmds" -- "$cur"))
      else
        case "$plugin_subcmd" in
          install)
            COMPREPLY=($(compgen -W "--scope -s --help -h" -- "$cur"))
            ;;
          uninstall)
            COMPREPLY=($(compgen -W "--scope -s --help -h" -- "$cur"))
            ;;
          enable)
            COMPREPLY=($(compgen -W "--scope -s --help -h" -- "$cur"))
            ;;
          disable)
            COMPREPLY=($(compgen -W "--all -a --scope -s --help -h" -- "$cur"))
            ;;
          update)
            COMPREPLY=($(compgen -W "--scope -s --help -h" -- "$cur"))
            ;;
          list)
            COMPREPLY=($(compgen -W "--available --json --help -h" -- "$cur"))
            ;;
          validate)
            COMPREPLY=($(compgen -W "--help -h" -- "$cur"))
            _filedir
            ;;
          marketplace)
            local mp_subcmd=""
            for ((j = i + 1; j < cword; j++)); do
              case "${words[j]}" in
                add|list|remove|update) mp_subcmd="${words[j]}" ;;
              esac
            done
            if [[ -z "$mp_subcmd" ]]; then
              COMPREPLY=($(compgen -W "add list remove update" -- "$cur"))
            else
              case "$mp_subcmd" in
                list)
                  COMPREPLY=($(compgen -W "--json --help -h" -- "$cur"))
                  ;;
                *)
                  COMPREPLY=($(compgen -W "--help -h" -- "$cur"))
                  ;;
              esac
            fi
            ;;
          *)
            COMPREPLY=($(compgen -W "--help -h" -- "$cur"))
            ;;
        esac

        if [[ "$prev" == "--scope" || "$prev" == "-s" ]]; then
          COMPREPLY=($(compgen -W "user project local" -- "$cur"))
          return
        fi
      fi
      ;;
    install)
      if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "--force --help -h" -- "$cur"))
      else
        COMPREPLY=($(compgen -W "stable latest" -- "$cur"))
      fi
      ;;
    doctor|setup-token|update)
      COMPREPLY=($(compgen -W "--help -h" -- "$cur"))
      ;;
  esac
}

complete -F _claude_completion claude
