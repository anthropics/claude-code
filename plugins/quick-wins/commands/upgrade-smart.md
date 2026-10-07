---
description: Smart upgrade that detects your package manager (npm/pnpm/yarn)
---

## Detect Package Manager

!`if command -v pnpm &> /dev/null; then echo "pnpm"; elif command -v yarn &> /dev/null; then echo "yarn"; else echo "npm"; fi`

## Upgrade Command

Based on the detected package manager above, run the appropriate upgrade command:

- If **pnpm**: `pnpm install -g @anthropic-ai/claude-code@latest`
- If **yarn**: `yarn global add @anthropic-ai/claude-code@latest`
- If **npm**: `npm install -g @anthropic-ai/claude-code@latest`

Execute the correct command now.
