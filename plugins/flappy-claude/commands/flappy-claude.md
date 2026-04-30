Launch the Flappy Claude terminal game in a new terminal window. Execute the following shell script:

```bash
#!/bin/bash
# Resolve game path relative to this plugin's location
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PLUGIN_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
GAME_PATH="$PLUGIN_DIR/flappy_claude.py"

if [ ! -f "$GAME_PATH" ]; then
  echo "Error: flappy_claude.py not found at $GAME_PATH"
  exit 1
fi

# Detect OS via uname and launch in appropriate terminal
OS="$(uname)"
if [[ "$OS" == "Darwin" ]]; then
  osascript -e "tell application \"Terminal\" to do script \"python3 '$GAME_PATH'\""
elif [[ "$OS" == "Linux" ]]; then
  if command -v x-terminal-emulator &>/dev/null; then
    x-terminal-emulator -e python3 "$GAME_PATH"
  elif command -v gnome-terminal &>/dev/null; then
    gnome-terminal -- python3 "$GAME_PATH"
  else
    echo "No supported terminal emulator found. Run manually: python3 $GAME_PATH"
    exit 1
  fi
else
  echo "Unsupported OS: $OS. Run manually: python3 $GAME_PATH"
  exit 1
fi
```
