#!/usr/bin/env bash

# Verified Code Answers plugin - SessionStart hook
# Addresses: https://github.com/anthropics/claude-code/issues/29753
#
# This hook injects instructions that require Claude to verify code behavior
# by reading actual source files before making factual assertions.

cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "## Verified Code Answers Policy\n\nWhen answering any factual question about how code behaves, you MUST follow this policy:\n\n### Rule 1: Read Before You Assert\nIf a user asks a question about what a specific piece of code does, how a function behaves, what a variable contains, or whether a code path executes - you MUST use your file reading tools (Read, Glob, Grep) to inspect the actual source code BEFORE giving your answer. Do NOT rely on training data or pattern-matching to answer code-behavior questions.\n\n### Rule 2: Caveat Unverified Answers\nIf you are unable to read the relevant source file (e.g., the file doesn't exist, you lack access, or the scope is too broad), you MUST explicitly caveat your answer. Use language like:\n- 'I haven't read the source file, but based on common patterns...'\n- 'Without checking the actual code, I believe...'\n- 'This is an unverified assumption - please check [filename] to confirm.'\n\n### Rule 3: Never Present Unverified Information as Verified\nNever answer a code-behavior question with the same confidence as a verified answer unless you have actually read the code. The existing instruction 'Do not say things you haven't verified' applies especially to code behavior questions.\n\n### Example of Correct Behavior\nUser: 'Will spells with empty roleAffinity ever get assigned to actors?'\nCorrect: Read the selector/filter code first, then answer based on what the code actually does.\nIncorrect: Answer based on what 'usually' happens in game systems without checking.\n\nThis policy exists to prevent users from acting on incorrect information about their own codebase."
  }
}
EOF

exit 0
