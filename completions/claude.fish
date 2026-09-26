# Fish completion for claude (Claude Code CLI)
#
# Instead of hard-coding the flag and subcommand lists (which would go stale
# on every release), this script parses `claude --help` output at completion
# time and caches the result per installed CLI version, so completions always
# match the version of Claude Code you are running.
#
# Install: copy this file to ~/.config/fish/completions/claude.fish
# (see completions/README.md).

function __claude_cache_dir
    if set -q XDG_CACHE_HOME[1]
        echo $XDG_CACHE_HOME/claude-code-completions
    else
        echo $HOME/.cache/claude-code-completions
    end
end

# Print (cached) `claude <args...> --help` output.
function __claude_help
    if not set -q __claude_completion_version
        set -g __claude_completion_version (claude -v 2>/dev/null | string split ' ')[1]
    end
    test -n "$__claude_completion_version"; or return 1
    set -l key (string join _ root $argv)
    set -l dir (__claude_cache_dir)/$__claude_completion_version
    set -l cache $dir/$key
    if not test -s $cache
        mkdir -p $dir 2>/dev/null; or return 1
        if not claude $argv --help >$cache 2>/dev/null
            rm -f $cache
            return 1
        end
    end
    cat $cache
end

# Parse the "Commands:" section of help output into "name<TAB>description"
# lines (aliases like update|upgrade are split into separate entries).
function __claude_parse_commands
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
end

# Parse the "Options:" section of help output into "flag<TAB>description"
# lines.
function __claude_parse_flags
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
end

# The subcommand path typed so far, descending only into words that the CLI's
# own help output lists as subcommands (this also keeps us from ever executing
# `claude <arbitrary-word> --help`).
function __claude_cmd_path
    set -l tokens (commandline -opc)
    set -e tokens[1]
    set -l path
    for t in $tokens
        string match -q -- '-*' $t; and continue
        test -n "$t"; or continue
        if contains -- $t (__claude_help $path | __claude_parse_commands | cut -f1)
            set -a path $t
        end
    end
    for t in $path
        echo $t
    end
end

function __claude_complete_subcommands
    __claude_help (__claude_cmd_path) | __claude_parse_commands
end

function __claude_complete_flags
    __claude_help (__claude_cmd_path) | __claude_parse_flags
end

# True when the previous token is any of the given flags.
function __claude_prev_in
    set -l tokens (commandline -opc)
    contains -- $tokens[-1] $argv
end

# True when the current token position expects a subcommand or flag (i.e. the
# previous token is not a flag that takes a value we complete separately).
set -g __claude_value_flags --model --fallback-model --permission-mode \
    --output-format --input-format --effort --setting-sources \
    -t --transport -s --scope --add-dir --plugin-dir --cwd \
    --settings --mcp-config --debug-file --config \
    --system-prompt-file --append-system-prompt-file
function __claude_wants_command
    not __claude_prev_in $__claude_value_flags
end

complete -c claude -f

# Subcommands and flags, parsed from the CLI's own help output.
complete -c claude -n __claude_wants_command -a '(__claude_complete_subcommands)'
complete -c claude -n __claude_wants_command -a '(__claude_complete_flags)'

# Value completion for flags with a known set of values.
complete -c claude -x -n '__claude_prev_in --model --fallback-model' -a 'fable opus sonnet haiku'
complete -c claude -x -n '__claude_prev_in --permission-mode' -a 'acceptEdits auto bypassPermissions manual dontAsk plan'
complete -c claude -x -n '__claude_prev_in --output-format' -a 'text json stream-json'
complete -c claude -x -n '__claude_prev_in --input-format' -a 'text stream-json'
complete -c claude -x -n '__claude_prev_in --effort' -a 'low medium high xhigh max'
complete -c claude -x -n '__claude_prev_in --setting-sources' -a 'user project local'
complete -c claude -x -n '__claude_prev_in -t --transport' -a 'stdio sse http'
complete -c claude -x -n '__claude_prev_in -s --scope' -a 'local user project'
complete -c claude -x -n '__claude_prev_in --add-dir --plugin-dir --cwd' -a '(__fish_complete_directories)'
complete -c claude -F -n '__claude_prev_in --settings --mcp-config --debug-file --config --system-prompt-file --append-system-prompt-file'

# Positional arguments with a known set of values.
complete -c claude -n '__claude_wants_command; and test "$(__claude_cmd_path)" = install' -a 'stable\t"Latest stable version" latest\t"Latest version"'
complete -c claude -n '__claude_wants_command; and test "$(__claude_cmd_path)" = import' -a 'codex\t"Import from Codex" gemini\t"Import from Gemini"'
