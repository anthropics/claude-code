#!/bin/bash
# i18n-spinner-tips installer
# Usage: bash install.sh [lang]
# Supported: zh ja ko fr es de pt ru (default: zh)

set -e

LANG_CODE="${1:-zh}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TIPS_FILE="$SCRIPT_DIR/tips/$LANG_CODE.json"
SETTINGS_FILE="$HOME/.claude/settings.json"

if [ ! -f "$TIPS_FILE" ]; then
  echo "Error: Language '$LANG_CODE' not supported."
  echo "Available: zh ja ko fr es de pt ru"
  exit 1
fi

# Ensure settings file exists
mkdir -p "$HOME/.claude"
if [ ! -f "$SETTINGS_FILE" ]; then
  echo '{}' > "$SETTINGS_FILE"
fi

# Extract tips and merge into settings
python3 -c "
import json, sys

lang = '$LANG_CODE'
tips_file = '$TIPS_FILE'
settings_file = '$SETTINGS_FILE'

with open(tips_file) as f:
    tips_data = json.load(f)

with open(settings_file) as f:
    settings = json.load(f)

# Merge tips
existing = settings.get('spinnerTipsOverride', {})
existing_tips = set(existing.get('tips', []))
new_tips = [t for t in tips_data['tips'] if t not in existing_tips]

settings['spinnerTipsOverride'] = {
    'excludeDefault': False,
    'tips': list(existing_tips) + new_tips
}

with open(settings_file, 'w') as f:
    json.dump(settings, f, indent=2, ensure_ascii=False)

print(f'Installed {len(new_tips)} new tips ({tips_data[\"label\"]})')
print(f'Total tips: {len(settings[\"spinnerTipsOverride\"][\"tips\"])}')
" && echo "Done! Tips will show next time Claude thinks."
