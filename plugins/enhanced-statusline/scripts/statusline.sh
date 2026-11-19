#!/bin/bash
# Claude Code Status Line - Useful Info Only (No Redundant Model Name)

input=$(cat)

# Parse JSON data
CURRENT_DIR=$(echo "$input" | jq -r '.workspace.current_dir // ""')
DIR_NAME=$(basename "$CURRENT_DIR")
PROJECT_DIR=$(echo "$input" | jq -r '.workspace.project_dir // ""')
TOTAL_COST=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
LINES_ADDED=$(echo "$input" | jq -r '.cost.lines_added // 0')
LINES_REMOVED=$(echo "$input" | jq -r '.cost.lines_removed // 0')
TOTAL_DURATION=$(echo "$input" | jq -r '.cost.total_duration_ms // 0')

# Context window usage
CONTEXT_SIZE=$(echo "$input" | jq -r '.context_window.context_window_size // 0')
USAGE=$(echo "$input" | jq -r '.context_window.current_usage // null')

if [ "$USAGE" != "null" ]; then
    INPUT_TOKENS=$(echo "$USAGE" | jq -r '.input_tokens // 0')
    CACHE_CREATE=$(echo "$USAGE" | jq -r '.cache_creation_input_tokens // 0')
    CACHE_READ=$(echo "$USAGE" | jq -r '.cache_read_input_tokens // 0')
    OUTPUT_TOKENS=$(echo "$USAGE" | jq -r '.output_tokens // 0')
    CURRENT_TOKENS=$((INPUT_TOKENS + CACHE_CREATE + CACHE_READ))

    if [ "$CONTEXT_SIZE" -gt 0 ]; then
        PERCENT_USED=$((CURRENT_TOKENS * 100 / CONTEXT_SIZE))
    else
        PERCENT_USED=0
    fi

    # Format tokens in K (thousands) or M (millions)
    if [ "$CURRENT_TOKENS" -ge 1000000 ]; then
        TOKENS_DISPLAY="$((CURRENT_TOKENS / 1000000)).$((CURRENT_TOKENS % 1000000 / 100000))M"
    elif [ "$CURRENT_TOKENS" -ge 1000 ]; then
        TOKENS_DISPLAY="$((CURRENT_TOKENS / 1000))K"
    else
        TOKENS_DISPLAY="${CURRENT_TOKENS}"
    fi
else
    PERCENT_USED=0
    TOKENS_DISPLAY="0"
fi

# Calculate session duration in minutes
if [ "$TOTAL_DURATION" -gt 0 ]; then
    DURATION_SEC=$((TOTAL_DURATION / 1000))
    DURATION_MIN=$((DURATION_SEC / 60))
    if [ "$DURATION_MIN" -ge 60 ]; then
        DURATION_HR=$((DURATION_MIN / 60))
        DURATION_MIN=$((DURATION_MIN % 60))
        DURATION_DISPLAY="${DURATION_HR}h${DURATION_MIN}m"
    else
        DURATION_DISPLAY="${DURATION_MIN}m"
    fi
else
    DURATION_DISPLAY="0m"
fi

# Git branch detection with status
GIT_BRANCH=""
GIT_STATUS=""
if [ -d .git ]; then
    BRANCH=$(git branch --show-current 2>/dev/null)
    if [ -n "$BRANCH" ]; then
        # Check for uncommitted changes
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            GIT_STATUS="*"
        fi
        # Check for unpushed commits
        UNPUSHED=$(git log @{u}.. --oneline 2>/dev/null | wc -l | tr -d ' ')
        if [ "$UNPUSHED" -gt 0 ]; then
            GIT_STATUS="${GIT_STATUS}↑${UNPUSHED}"
        fi
        GIT_BRANCH=" \033[38;5;109m⎇ ${BRANCH}${GIT_STATUS}\033[0m"
    fi
fi

# File change summary
FILE_CHANGES=""
if [ "$LINES_ADDED" -gt 0 ] || [ "$LINES_REMOVED" -gt 0 ]; then
    TOTAL_CHANGES=$((LINES_ADDED + LINES_REMOVED))
    FILE_CHANGES=" \033[38;5;46m+${LINES_ADDED}\033[0m\033[2m/\033[0m\033[38;5;214m-${LINES_REMOVED}\033[0m"
fi

# ANSI Color codes
CYAN="\033[38;5;87m"
GREEN="\033[38;5;46m"
YELLOW="\033[38;5;228m"
ORANGE="\033[38;5;214m"
PURPLE="\033[38;5;141m"
BLUE="\033[38;5;117m"
GRAY="\033[38;5;245m"
RESET="\033[0m"
BOLD="\033[1m"
DIM="\033[2m"

# Build status line
STATUS_LINE=""

# 1. Directory indicator
STATUS_LINE="${CYAN}📁 ${DIR_NAME}${RESET}"

# 2. Git branch
if [ -n "$GIT_BRANCH" ]; then
    STATUS_LINE="${STATUS_LINE} ${DIM}│${RESET}${GIT_BRANCH}"
fi

# 3. Context usage with color coding and token count
if [ "$PERCENT_USED" -gt 0 ]; then
    if [ "$PERCENT_USED" -gt 80 ]; then
        CTX_COLOR="$ORANGE"
        CTX_ICON="⚠"
    elif [ "$PERCENT_USED" -gt 60 ]; then
        CTX_COLOR="$YELLOW"
        CTX_ICON="◉"
    else
        CTX_COLOR="$GREEN"
        CTX_ICON="◉"
    fi
    STATUS_LINE="${STATUS_LINE} ${DIM}│${RESET} ${CTX_COLOR}${CTX_ICON} ${PERCENT_USED}% (${TOKENS_DISPLAY})${RESET}"
fi

# 4. Session duration
if [ "$DURATION_DISPLAY" != "0m" ]; then
    STATUS_LINE="${STATUS_LINE} ${DIM}│${RESET} ${GRAY}⏱ ${DURATION_DISPLAY}${RESET}"
fi

# 5. Code changes
if [ -n "$FILE_CHANGES" ]; then
    STATUS_LINE="${STATUS_LINE} ${DIM}│${RESET}${FILE_CHANGES}"
fi

# 6. Cost (if greater than $0.01)
if [ "$(echo "$TOTAL_COST > 0.01" | bc 2>/dev/null || echo 0)" -eq 1 ]; then
    COST_DISPLAY=$(printf "%.3f" "$TOTAL_COST")
    STATUS_LINE="${STATUS_LINE} ${DIM}│${RESET} ${PURPLE}\$${COST_DISPLAY}${RESET}"
fi

# Output the status line
echo -e "$STATUS_LINE"
