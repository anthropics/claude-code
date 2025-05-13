#!/bin/bash
# Script to set up an alias for the claude command

# Create a backup of the original claude command
if [ -f /usr/local/bin/claude.orig ]; then
  echo "Backup of claude command already exists at /usr/local/bin/claude.orig"
else
  echo "Creating backup of claude command at /usr/local/bin/claude.orig"
  sudo cp /usr/local/bin/claude /usr/local/bin/claude.orig
fi

# Create a new claude command that uses our fixed script
echo "Creating new claude command at /usr/local/bin/claude"
sudo tee /usr/local/bin/claude > /dev/null << 'EOF'
#!/bin/bash
# Wrapper script for the claude command with fixed NODE_OPTIONS

# Unset NODE_OPTIONS to avoid any issues
unset NODE_OPTIONS

# Set a clean NODE_OPTIONS value
export NODE_OPTIONS="--max-old-space-size=4096"

# Run the claude command
/usr/local/share/npm-global/lib/node_modules/@anthropic-ai/claude-code/cli.js "$@"
EOF

# Make the new claude command executable
sudo chmod +x /usr/local/bin/claude

echo "Claude command has been fixed. You can now use the 'claude' command without errors."
