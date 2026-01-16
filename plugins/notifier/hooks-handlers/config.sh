#!/bin/bash
# claude-code-notifier configuration
# Edit these values to customize notification behavior
# shellcheck disable=SC2034  # Variables are used by sourcing scripts

# Language setting: "en" (English) or "ko" (한국어)
NOTIFIER_LANG="en"

# Minimum task duration (seconds) to trigger notification
# Tasks shorter than this will not show notifications
MIN_DURATION_SECONDS=20

# Number of characters to show from the original prompt
PROMPT_PREVIEW_LENGTH=45

# =============================================================================
# Messages (auto-set based on NOTIFIER_LANG, or customize below)
# =============================================================================
if [ "$NOTIFIER_LANG" = "ko" ]; then
    MSG_COMPLETED="작업 완료!"
    MSG_PERMISSION="권한 필요!"
    MSG_IDLE="입력 대기 중..."
else
    MSG_COMPLETED="Task completed!"
    MSG_PERMISSION="Permission required!"
    MSG_IDLE="Waiting for input..."
fi
