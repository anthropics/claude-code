#!/bin/bash

# Dependency Security Hook
# Warns about risky package installation operations

# Read the tool input from stdin
INPUT=$(cat)

# Extract the command being executed
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# If no command, pass through
if [ -z "$COMMAND" ]; then
    echo '{"result": "approve"}'
    exit 0
fi

# Convert to lowercase for matching
COMMAND_LOWER=$(echo "$COMMAND" | tr '[:upper:]' '[:lower:]')

WARNINGS=""
BLOCKS=""

# Check for npm/yarn/pnpm install operations
if echo "$COMMAND_LOWER" | grep -qE "(npm|yarn|pnpm)\s+(install|add|i)\s+"; then
    # Extract package name (basic extraction)
    PACKAGE=$(echo "$COMMAND" | grep -oE "(npm|yarn|pnpm)\s+(install|add|i)\s+[^-][^ ]+" | awk '{print $NF}')

    if [ -n "$PACKAGE" ]; then
        # Check for wildcard versions
        if echo "$COMMAND" | grep -qE "@\*|@latest"; then
            WARNINGS="$WARNINGS\n- Installing with wildcard/latest version: Pin to specific version for security"
        fi

        # Check for common typosquatting patterns
        COMMON_PACKAGES="lodash express react axios moment webpack babel eslint jest mocha"
        for pkg in $COMMON_PACKAGES; do
            if [ "$PACKAGE" != "$pkg" ]; then
                # Check for similar names (basic Levenshtein-like check)
                if echo "$PACKAGE" | grep -qiE "^${pkg:0:3}" && [ ${#PACKAGE} -eq ${#pkg} ]; then
                    WARNINGS="$WARNINGS\n- Package '$PACKAGE' looks similar to '$pkg' - verify it's the correct package"
                fi
            fi
        done

        # Check for unscoped packages that might be internal
        if echo "$PACKAGE" | grep -qE "^(internal|private|company|corp)-"; then
            WARNINGS="$WARNINGS\n- Package '$PACKAGE' has internal-looking name - check for dependency confusion"
        fi
    fi
fi

# Check for pip install
if echo "$COMMAND_LOWER" | grep -qE "pip\s+install\s+"; then
    if echo "$COMMAND" | grep -qE "\-\-trusted-host"; then
        WARNINGS="$WARNINGS\n- Using --trusted-host bypasses SSL verification"
    fi

    if ! echo "$COMMAND" | grep -qE "\-r\s+requirements|Pipfile"; then
        WARNINGS="$WARNINGS\n- Installing package directly - consider adding to requirements.txt"
    fi
fi

# Check for cargo install
if echo "$COMMAND_LOWER" | grep -qE "cargo\s+(install|add)\s+"; then
    if echo "$COMMAND" | grep -qE "\-\-git\s+http://"; then
        WARNINGS="$WARNINGS\n- Installing from HTTP git URL - use HTTPS for security"
    fi
fi

# Check for --force or similar dangerous flags
if echo "$COMMAND_LOWER" | grep -qE "\-\-force|\-f\s|--legacy-peer-deps"; then
    WARNINGS="$WARNINGS\n- Using force flag may bypass security checks"
fi

# Check for running arbitrary scripts
if echo "$COMMAND_LOWER" | grep -qE "npm\s+run\s+|yarn\s+run\s+|npx\s+"; then
    # Check if running from unknown packages
    if echo "$COMMAND" | grep -qE "npx\s+[a-z]+-[a-z]+"; then
        WARNINGS="$WARNINGS\n- Running npx with external package - verify package authenticity first"
    fi
fi

# Check for global installs
if echo "$COMMAND_LOWER" | grep -qE "(npm|yarn|pip|cargo)\s+(install|add)\s+.*(-g|--global)"; then
    WARNINGS="$WARNINGS\n- Global installation detected - consider local installation instead"
fi

# Check for skipping audit
if echo "$COMMAND_LOWER" | grep -qE "\-\-no-audit|\-\-ignore-scripts"; then
    WARNINGS="$WARNINGS\n- Skipping security checks - ensure this is intentional"
fi

# Output result
if [ -n "$BLOCKS" ]; then
    echo "{\"result\": \"block\", \"reason\": \"Security risk detected:$BLOCKS\"}"
elif [ -n "$WARNINGS" ]; then
    echo "{\"result\": \"approve\", \"message\": \"Dependency Security Warning:$WARNINGS\"}"
else
    echo '{"result": "approve"}'
fi
