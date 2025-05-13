#!/bin/bash

# SAAR Modular - Wrapper for the modular implementation
# Version: 2.1.0
# 
# This script is a simple wrapper around the modular SAAR chain script.
# It forwards all commands and arguments to the chain script.

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Path to the chain script
CHAIN_SCRIPT="$SCRIPT_DIR/saar/saar_chain.sh"

# Check if the chain script exists
if [ ! -f "$CHAIN_SCRIPT" ]; then
  echo "Error: Could not find the SAAR chain script at $CHAIN_SCRIPT"
  echo "Please make sure the modular implementation is properly installed."
  exit 1
fi

# Forward all arguments to the chain script
"$CHAIN_SCRIPT" "$@"

# Exit with the same status as the chain script
exit $?