#!/bin/bash

# Install Git workflow aliases for Claude Neural Framework
# This script adds convenient shortcuts for git workflow commands

echo "Installing Git workflow aliases..."

# Base path to the git workflow script
SCRIPT_PATH=$(realpath $(dirname $0)/..)
GIT_WORKFLOW="node $SCRIPT_PATH/git-workflow.js"

# Create alias definitions
aliases=(
  "git-feature-start=\"$GIT_WORKFLOW feature-start\""
  "git-feature-finish=\"$GIT_WORKFLOW feature-finish\""
  "git-release-start=\"$GIT_WORKFLOW release-start\""
  "git-release-finish=\"$GIT_WORKFLOW release-finish\""
  "git-hotfix-start=\"$GIT_WORKFLOW hotfix-start\""
  "git-hotfix-finish=\"$GIT_WORKFLOW hotfix-finish\""
  "git-staged-split=\"$GIT_WORKFLOW staged-split\""
  "git-cherry-pick-issue=\"$GIT_WORKFLOW issue-cherry-pick\""
  "git-lint=\"$GIT_WORKFLOW commit-lint\""
  "git-stats=\"$GIT_WORKFLOW project-stats\""
  "git-pr=\"$GIT_WORKFLOW pr\""
)

# Determine where to install aliases
if [ -f ~/.bashrc ]; then
  SHELL_RC=~/.bashrc
elif [ -f ~/.zshrc ]; then
  SHELL_RC=~/.zshrc
else
  echo "Could not find ~/.bashrc or ~/.zshrc"
  exit 1
fi

# Check if aliases section already exists
if grep -q "# Claude Neural Framework Git Aliases" $SHELL_RC; then
  # Update existing aliases
  echo "Updating existing Git workflow aliases..."
  
  # Remove old aliases section
  sed -i '/# Claude Neural Framework Git Aliases/,/# End Claude Neural Framework Git Aliases/d' $SHELL_RC
fi

# Add aliases to shell rc file
echo "" >> $SHELL_RC
echo "# Claude Neural Framework Git Aliases" >> $SHELL_RC
echo "# These aliases were added by the Claude Neural Framework install-aliases.sh script" >> $SHELL_RC

for alias in "${aliases[@]}"; do
  echo "alias $alias" >> $SHELL_RC
done

echo "# End Claude Neural Framework Git Aliases" >> $SHELL_RC
echo "" >> $SHELL_RC

echo "Git workflow aliases have been installed."
echo "To use them, either restart your terminal or run:"
echo "source $SHELL_RC"
echo ""
echo "Available commands:"
echo "- git-feature-start \"Feature description\" [issue-number]"
echo "- git-feature-finish"
echo "- git-release-start <version>"
echo "- git-release-finish"
echo "- git-hotfix-start <version> \"Hotfix description\""
echo "- git-hotfix-finish"
echo "- git-staged-split [options]"
echo "- git-cherry-pick-issue <issue-number> [options]"
echo "- git-lint [options]"
echo "- git-stats [options]"
echo "- git-pr <subcommand> [options]"
echo ""
echo "For more information, run: $GIT_WORKFLOW help"