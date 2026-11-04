#!/usr/bin/env python3
"""
Claude Code Hook: German Umlaut Validator
==========================================
This hook runs as a PreToolUse hook for Write and Edit tools.
It validates German text content for common umlaut mistakes like
'fuer' instead of 'für', 'ueber' instead of 'über', etc.

Read more about hooks here: https://docs.anthropic.com/en/docs/claude-code/hooks

Configuration example for settings.json:

{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/claude-code/examples/hooks/german_umlaut_validator_example.py"
          }
        ]
      },
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/claude-code/examples/hooks/german_umlaut_validator_example.py"
          }
        ]
      }
    ]
  }
}

This helps prevent common mistakes when working with German language content,
which is especially important for:
- User-facing text in applications
- Documentation and README files
- Error messages and validation text
- Database content and exports
"""

import json
import re
import sys
from typing import List, Tuple

# Common German words that MUST have umlauts
# Format: (wrong_pattern, correct_form, description)
UMLAUT_RULES: List[Tuple[re.Pattern, str, str]] = [
    # für/über family
    (re.compile(r'\bfuer\b', re.IGNORECASE), 'für', 'fuer → für'),
    (re.compile(r'\bueber\b', re.IGNORECASE), 'über', 'ueber → über'),

    # können/müssen/würden family (modal verbs)
    (re.compile(r'\bkoennen\b', re.IGNORECASE), 'können', 'koennen → können'),
    (re.compile(r'\bkoennte\b', re.IGNORECASE), 'könnte', 'koennte → könnte'),
    (re.compile(r'\bmuessen\b', re.IGNORECASE), 'müssen', 'muessen → müssen'),
    (re.compile(r'\bmuesste\b', re.IGNORECASE), 'müsste', 'muesste → müsste'),
    (re.compile(r'\bwuerden\b', re.IGNORECASE), 'würden', 'wuerden → würden'),
    (re.compile(r'\bwuerde\b', re.IGNORECASE), 'würde', 'wuerde → würde'),

    # hätte/wäre family (subjunctive)
    (re.compile(r'\bhaette\b', re.IGNORECASE), 'hätte', 'haette → hätte'),
    (re.compile(r'\bwaere\b', re.IGNORECASE), 'wäre', 'waere → wäre'),

    # möchte/mögen family
    (re.compile(r'\bmoechte\b', re.IGNORECASE), 'möchte', 'moechte → möchte'),
    (re.compile(r'\bmoegen\b', re.IGNORECASE), 'mögen', 'moegen → mögen'),

    # Größe/große family
    (re.compile(r'\bgroesse\b', re.IGNORECASE), 'Größe', 'groesse → Größe'),
    (re.compile(r'\bgrosse\b', re.IGNORECASE), 'große', 'grosse → große'),
    (re.compile(r'\bgroesste\b', re.IGNORECASE), 'größte', 'groesste → größte'),

    # ß words
    (re.compile(r'\bstrasse\b', re.IGNORECASE), 'Straße', 'strasse → Straße'),
    (re.compile(r'\bschliessen\b', re.IGNORECASE), 'schließen', 'schliessen → schließen'),
    (re.compile(r'\bheissen\b', re.IGNORECASE), 'heißen', 'heissen → heißen'),
    (re.compile(r'\bweiss\b', re.IGNORECASE), 'weiß', 'weiss → weiß'),

    # ä words
    (re.compile(r'\baehnlich\b', re.IGNORECASE), 'ähnlich', 'aehnlich → ähnlich'),
    (re.compile(r'\baendern\b', re.IGNORECASE), 'ändern', 'aendern → ändern'),
    (re.compile(r'\baenderung\b', re.IGNORECASE), 'Änderung', 'aenderung → Änderung'),
    (re.compile(r'\bspaeter\b', re.IGNORECASE), 'später', 'spaeter → später'),
    (re.compile(r'\bnaechste\b', re.IGNORECASE), 'nächste', 'naechste → nächste'),
    (re.compile(r'\bwaehrend\b', re.IGNORECASE), 'während', 'waehrend → während'),
    (re.compile(r'\berklaeren\b', re.IGNORECASE), 'erklären', 'erklaeren → erklären'),
    (re.compile(r'\bbestaetigen\b', re.IGNORECASE), 'bestätigen', 'bestaetigen → bestätigen'),

    # ö words
    (re.compile(r'\boeffnen\b', re.IGNORECASE), 'öffnen', 'oeffnen → öffnen'),
    (re.compile(r'\boeffentlich\b', re.IGNORECASE), 'öffentlich', 'oeffentlich → öffentlich'),
    (re.compile(r'\bloesung\b', re.IGNORECASE), 'Lösung', 'loesung → Lösung'),
    (re.compile(r'\bloeschen\b', re.IGNORECASE), 'löschen', 'loeschen → löschen'),
    (re.compile(r'\bhoechste\b', re.IGNORECASE), 'höchste', 'hoechste → höchste'),
    (re.compile(r'\bmoeglichkeit\b', re.IGNORECASE), 'Möglichkeit', 'moeglichkeit → Möglichkeit'),
    (re.compile(r'\bveroeffentlichen\b', re.IGNORECASE), 'veröffentlichen', 'veroeffentlichen → veröffentlichen'),

    # ü words
    (re.compile(r'\bpruefung\b', re.IGNORECASE), 'Prüfung', 'pruefung → Prüfung'),
    (re.compile(r'\bpruefen\b', re.IGNORECASE), 'prüfen', 'pruefen → prüfen'),
    (re.compile(r'\bzurueck\b', re.IGNORECASE), 'zurück', 'zurueck → zurück'),
    (re.compile(r'\bnatuerlich\b', re.IGNORECASE), 'natürlich', 'natuerlich → natürlich'),
    (re.compile(r'\bverfuegbar\b', re.IGNORECASE), 'verfügbar', 'verfuegbar → verfügbar'),
    (re.compile(r'\bdurchfuehren\b', re.IGNORECASE), 'durchführen', 'durchfuehren → durchführen'),
    (re.compile(r'\bhinzufuegen\b', re.IGNORECASE), 'hinzufügen', 'hinzufuegen → hinzufügen'),
    (re.compile(r'\bgueltig\b', re.IGNORECASE), 'gültig', 'gueltig → gültig'),
    (re.compile(r'\bungueltig\b', re.IGNORECASE), 'ungültig', 'ungueltig → ungültig'),
    (re.compile(r'\bausfuehren\b', re.IGNORECASE), 'ausführen', 'ausfuehren → ausführen'),
    (re.compile(r'\bfuehren\b', re.IGNORECASE), 'führen', 'fuehren → führen'),
]

# File extensions that should be checked (files likely to contain German text)
GERMAN_FILE_EXTENSIONS = {
    '.md', '.txt', '.html', '.htm', '.tsx', '.ts', '.jsx', '.js',
    '.json', '.py', '.yml', '.yaml', '.xml', '.vue', '.svelte'
}


def should_check_file(file_path: str) -> bool:
    """Check if file should be validated for German umlauts."""
    if not file_path:
        return False

    # Get file extension
    dot_index = file_path.rfind('.')
    if dot_index == -1:
        return False

    ext = file_path[dot_index:].lower()
    return ext in GERMAN_FILE_EXTENSIONS


def find_umlaut_errors(content: str) -> List[str]:
    """Find all umlaut errors in content."""
    errors = []

    for pattern, correct, description in UMLAUT_RULES:
        matches = pattern.findall(content)
        if matches:
            count = len(matches)
            errors.append(f"{description} ({count}x found)")

    return errors


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    tool_name = input_data.get("tool_name", "")

    # Only check Write and Edit tools
    if tool_name not in ("Write", "Edit"):
        sys.exit(0)

    tool_input = input_data.get("tool_input", {})
    file_path = tool_input.get("file_path", "")

    # Get content based on tool type
    content = tool_input.get("content", "") or tool_input.get("new_string", "")

    if not content:
        sys.exit(0)

    # Only check files that might contain German text
    if not should_check_file(file_path):
        sys.exit(0)

    # Find umlaut errors
    errors = find_umlaut_errors(content)

    if errors:
        print(f"\n⚠️  GERMAN UMLAUT WARNING in {file_path}:", file=sys.stderr)
        for error in errors:
            print(f"  • {error}", file=sys.stderr)
        print("\nPlease use correct German umlauts (ä, ö, ü, ß)!", file=sys.stderr)
        print("", file=sys.stderr)

        # Exit code 2 blocks the tool call and shows stderr to Claude
        # Change to sys.exit(0) if you only want warnings without blocking
        sys.exit(2)


if __name__ == "__main__":
    main()
