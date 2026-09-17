#!/bin/bash

_claude_completions() {
    local cur prev words cword
    _init_completion || return

    local commands="config mcp migrate-installer setup-token doctor update install"
    local global_opts="-d --debug --verbose -p --print --output-format --input-format 
                      --mcp-debug --dangerously-skip-permissions --allowedTools --disallowedTools 
                      --mcp-config --append-system-prompt --permission-mode -c --continue 
                      -r --resume --model --fallback-model --settings --add-dir --ide 
                      --strict-mcp-config --session-id -v --version -h --help"

    # Handle subcommands
    local i=1
    local subcommand=""
    while [[ $i -lt $cword ]]; do
        if [[ "${words[i]}" =~ ^(config|mcp|migrate-installer|setup-token|doctor|update|install)$ ]]; then
            subcommand="${words[i]}"
            break
        fi
        ((i++))
    done

    case "$subcommand" in
        config)
            _claude_config_completions
            return
            ;;
        mcp)
            _claude_mcp_completions
            return
            ;;
        install)
            _claude_install_completions
            return
            ;;
        migrate-installer|setup-token|doctor|update)
            # These commands have no additional options beyond --help
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "-h --help" -- "$cur"))
            fi
            return
            ;;
    esac

    # Handle global options that take values
    case "$prev" in
        --output-format)
            COMPREPLY=($(compgen -W "text json stream-json" -- "$cur"))
            return
            ;;
        --input-format)
            COMPREPLY=($(compgen -W "text stream-json" -- "$cur"))
            return
            ;;
        --permission-mode)
            COMPREPLY=($(compgen -W "acceptEdits bypassPermissions default plan" -- "$cur"))
            return
            ;;
        --model|--fallback-model)
            COMPREPLY=($(compgen -W "sonnet opus haiku claude-sonnet-4-20250514" -- "$cur"))
            return
            ;;
        --settings|--mcp-config)
            _filedir
            return
            ;;
        --add-dir)
            _filedir -d
            return
            ;;
        --session-id)
            # No completion for UUID
            return
            ;;
        --allowedTools|--disallowedTools|--append-system-prompt)
            # No specific completion
            return
            ;;
        -r|--resume)
            # Session ID or interactive selection - no specific completion
            return
            ;;
    esac

    # If current word starts with -, complete options
    if [[ "$cur" == -* ]]; then
        if [[ -z "$subcommand" ]]; then
            COMPREPLY=($(compgen -W "$global_opts" -- "$cur"))
        fi
        return
    fi

    # If no subcommand yet, complete subcommands
    if [[ -z "$subcommand" ]]; then
        COMPREPLY=($(compgen -W "$commands" -- "$cur"))
        return
    fi
}

_claude_config_completions() {
    local cur prev words cword
    _init_completion || return

    local config_commands="get set remove rm list ls add help"
    local config_opts="-g --global -h --help"

    # Find config subcommand
    local i=2  # Skip 'claude' and 'config'
    local config_subcommand=""
    while [[ $i -lt $cword ]]; do
        if [[ "${words[i]}" =~ ^(get|set|remove|rm|list|ls|add|help)$ ]]; then
            config_subcommand="${words[i]}"
            break
        fi
        ((i++))
    done

    case "$config_subcommand" in
        get|set|remove|rm|add)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "$config_opts" -- "$cur"))
            elif [[ "$config_subcommand" == "help" ]]; then
                COMPREPLY=($(compgen -W "$config_commands" -- "$cur"))
            fi
            return
            ;;
        list|ls)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "$config_opts" -- "$cur"))
            fi
            return
            ;;
        help)
            COMPREPLY=($(compgen -W "$config_commands" -- "$cur"))
            return
            ;;
    esac

    # If no config subcommand yet
    if [[ -z "$config_subcommand" ]]; then
        if [[ "$cur" == -* ]]; then
            COMPREPLY=($(compgen -W "$config_opts" -- "$cur"))
        else
            COMPREPLY=($(compgen -W "$config_commands" -- "$cur"))
        fi
    fi
}

_claude_mcp_completions() {
    local cur prev words cword
    _init_completion || return

    local mcp_commands="serve add remove list get add-json add-from-claude-desktop reset-project-choices help"
    local mcp_opts="-h --help"

    # Find mcp subcommand
    local i=2  # Skip 'claude' and 'mcp'
    local mcp_subcommand=""
    while [[ $i -lt $cword ]]; do
        if [[ "${words[i]}" =~ ^(serve|add|remove|list|get|add-json|add-from-claude-desktop|reset-project-choices|help)$ ]]; then
            mcp_subcommand="${words[i]}"
            break
        fi
        ((i++))
    done

    case "$prev" in
        -s|--scope)
            COMPREPLY=($(compgen -W "local user project" -- "$cur"))
            return
            ;;
        -t|--transport)
            COMPREPLY=($(compgen -W "stdio sse http" -- "$cur"))
            return
            ;;
        -e|--env|-H|--header)
            # No specific completion for environment variables or headers
            return
            ;;
    esac

    case "$mcp_subcommand" in
        serve)
            local serve_opts="-p --port -h --help"
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "$serve_opts" -- "$cur"))
            fi
            return
            ;;
        add)
            local add_opts="-s --scope -t --transport -e --env -H --header -h --help"
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "$add_opts" -- "$cur"))
            fi
            return
            ;;
        add-json)
            local add_json_opts="-s --scope -h --help"
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "$add_json_opts" -- "$cur"))
            fi
            return
            ;;
        add-from-claude-desktop)
            local add_desktop_opts="-s --scope -h --help"
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "$add_desktop_opts" -- "$cur"))
            fi
            return
            ;;
        remove|get)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "$mcp_opts" -- "$cur"))
            fi
            return
            ;;
        list|reset-project-choices)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "$mcp_opts" -- "$cur"))
            fi
            return
            ;;
        help)
            COMPREPLY=($(compgen -W "$mcp_commands" -- "$cur"))
            return
            ;;
    esac

    # If no mcp subcommand yet
    if [[ -z "$mcp_subcommand" ]]; then
        if [[ "$cur" == -* ]]; then
            COMPREPLY=($(compgen -W "$mcp_opts" -- "$cur"))
        else
            COMPREPLY=($(compgen -W "$mcp_commands" -- "$cur"))
        fi
    fi
}

_claude_install_completions() {
    local cur prev words cword
    _init_completion || return

    local install_opts="--force -h --help"

    if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "$install_opts" -- "$cur"))
    else
        # Complete version targets
        COMPREPLY=($(compgen -W "stable latest" -- "$cur"))
    fi
}

# Register the completion function
complete -F _claude_completions claude