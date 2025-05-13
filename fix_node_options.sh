#!/bin/bash
# Script to fix the NODE_OPTIONS environment variable

# Get the current NODE_OPTIONS value
CURRENT_NODE_OPTIONS="$NODE_OPTIONS"
echo "Current NODE_OPTIONS: $CURRENT_NODE_OPTIONS"

# Remove any duplicate --max-old-space-size flags
FIXED_NODE_OPTIONS=$(echo "$CURRENT_NODE_OPTIONS" | sed 's/--max-old-space-size=[0-9]*--max-old-space-size=[0-9]*/--max-old-space-size=4096/g')
echo "Fixed NODE_OPTIONS: $FIXED_NODE_OPTIONS"

# Export the fixed NODE_OPTIONS
export NODE_OPTIONS="$FIXED_NODE_OPTIONS"
echo "NODE_OPTIONS has been fixed."

# Print instructions for the user
echo ""
echo "To make this change permanent, add the following line to your ~/.zshrc or ~/.bashrc file:"
echo "export NODE_OPTIONS=\"$FIXED_NODE_OPTIONS\""
echo ""
echo "You can also restart your devcontainer to apply the changes from the devcontainer.json file."
