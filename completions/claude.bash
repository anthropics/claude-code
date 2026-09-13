# Bash completion for claude (Claude Code CLI)
#
# Instead of hard-coding the flag and subcommand lists (which would go stale
# on every release), this script parses `claude --help` output at completion
# time and caches the result per installed CLI version, so completions always
# match the version of Claude Code you are running.
#
# Install: source this file from your ~/.bashrc, or copy it into your
# bash-completion directory (see completions/README.md).

__claude_cache_dir() {
    printf '%s/claude-code-completions' "${XDG_CACHE_HOME:-$HOME/.cache}"
}

# Print (cached) `claude <args...> --help` output.
__claude_help() {
    local ver dir cache key
    if [[ -z ${__CLAUDE_COMPLETION_VERSION-} ]]; then
        __CLAUDE_COMPLETION_VERSION=$(claude -v 2>/dev/null | { read -r v _ && printf '%s' "$v"; })
    fi
    ver=$__CLAUDE_COMPLETION_VERSION
    [[ -n $ver ]] || return 1
    key="root${*:+ $*}"
    key=${key// /_}
    dir="$(__claude_cache_dir)/$ver"
    cache="$dir/$key"
    if [[ ! -s $cache ]]; then
        mkdir -p "$dir" 2>/dev/null || return 1
        claude "$@" --help >"$cache" 2>/dev/null || { rm -f "$cache"; return 1; }
    fi
    cat "$cache"
}

# Parse the "Commands:" section of help output into "name<TAB>description"
# lines (aliases like update|upgrade are split into separate entries).
__claude_parse_commands() {
    awk '
        /^Commands:/ { sec = 1; next }
        /^[A-Za-z]/  { sec = 0 }
        sec && /^  [a-z]/ {
            line = $0
            sub(/^  /, "", line)
            name = line
            sub(/ .*$/, "", name)
            desc = ""
            if (match(line, /  +/)) {
                desc = substr(line, RSTART + RLENGTH)
            }
            n = split(name, aliases, "[|]")
            for (i = 1; i <= n; i++) {
                if (aliases[i] != "" && aliases[i] != "help") {
                    print aliases[i] "\t" desc
                }
            }
        }
    '
}

# Parse the "Options:" section of help output into "flag<TAB>description"
# lines.
__claude_parse_flags() {
    awk '
        /^Options:/ { sec = 1; next }
        /^[A-Za-z]/ { sec = 0 }
        sec && /^  -/ {
            line = $0
            sub(/^ +/, "", line)
            desc = ""
            idx = index(line, "  ")
            if (idx) {
                desc = substr(line, idx)
                sub(/^ +/, "", desc)
                line = substr(line, 1, idx - 1)
            }
            n = split(line, parts, /,? +/)
            for (i = 1; i <= n; i++) {
                p = parts[i]
                if (p ~ /^--?[A-Za-z]/) {
                    sub(/[^A-Za-z0-9-].*$/, "", p)
                    print p "\t" desc
                }
            }
        }
    '
}

__claude_subcommands() { __claude_help "$@" | __claude_parse_commands | cut -f1; }
__claude_flags()       { __claude_help "$@" | __claude_parse_flags | cut -f1; }

_claude() {
    local cur prev words cword
    if type _init_completion >/dev/null 2>&1; then
        _init_completion || return
    else
        COMPREPLY=()
        cur=${COMP_WORDS[COMP_CWORD]}
        prev=${COMP_WORDS[COMP_CWORD - 1]}
        words=("${COMP_WORDS[@]}")
        cword=$COMP_CWORD
    fi

    # Value completion for flags with a known set of values.
    case $prev in
        --model | --fallback-model)
            COMPREPLY=($(compgen -W "fable opus sonnet haiku" -- "$cur"))
            return
            ;;
        --permission-mode)
            COMPREPLY=($(compgen -W "acceptEdits auto bypassPermissions manual dontAsk plan" -- "$cur"))
            return
            ;;
        --output-format)
            COMPREPLY=($(compgen -W "text json stream-json" -- "$cur"))
            return
            ;;
        --input-format)
            COMPREPLY=($(compgen -W "text stream-json" -- "$cur"))
            return
            ;;
        --effort)
            COMPREPLY=($(compgen -W "low medium high xhigh max" -- "$cur"))
            return
            ;;
        --setting-sources)
            COMPREPLY=($(compgen -W "user project local" -- "$cur"))
            return
            ;;
        -t | --transport)
            COMPREPLY=($(compgen -W "stdio sse http" -- "$cur"))
            return
            ;;
        -s | --scope)
            COMPREPLY=($(compgen -W "local user project" -- "$cur"))
            return
            ;;
        --add-dir | --plugin-dir | --cwd)
            COMPREPLY=($(compgen -d -- "$cur"))
            [[ ${#COMPREPLY[@]} -gt 0 ]] && type compopt >/dev/null 2>&1 && compopt -o filenames
            return
            ;;
        --settings | --mcp-config | --debug-file | --config | --system-prompt-file | --append-system-prompt-file)
            COMPREPLY=($(compgen -f -- "$cur"))
            [[ ${#COMPREPLY[@]} -gt 0 ]] && type compopt >/dev/null 2>&1 && compopt -o filenames
            return
            ;;
    esac

    # Build the subcommand path from words typed so far, descending only into
    # words that the CLI's own help output lists as subcommands (this also
    # keeps us from ever executing `claude <arbitrary-word> --help`).
    local path=() i w s
    for ((i = 1; i < cword; i++)); do
        w=${words[i]}
        [[ $w == -* || -z $w ]] && continue
        for s in $(__claude_subcommands "${path[@]}"); do
            if [[ $s == "$w" ]]; then
                path[${#path[@]}]=$w
                break
            fi
        done
    done

    if [[ $cur == -* ]]; then
        COMPREPLY=($(compgen -W "$(__claude_flags "${path[@]}")" -- "$cur"))
        return
    fi

    # Positional arguments with a known set of values.
    case "${path[*]-}" in
        install)
            COMPREPLY=($(compgen -W "stable latest" -- "$cur"))
            return
            ;;
        import)
            COMPREPLY=($(compgen -W "codex gemini" -- "$cur"))
            return
            ;;
    esac

    COMPREPLY=($(compgen -W "$(__claude_subcommands "${path[@]}")" -- "$cur"))
}

complete -F _claude claude
