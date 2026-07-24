#!/usr/bin/env python3
"""
German Umlaut Validator Hook
Validates German text for correct umlaut usage (ä, ö, ü, ß)
"""

import json
import re
import sys
from typing import List, Tuple

# Common German words that MUST have umlauts
UMLAUT_RULES: List[Tuple[re.Pattern, str, str]] = [
    # für/über family
    (re.compile(r'\bfuer\b', re.IGNORECASE), 'für', 'fuer → für'),
    (re.compile(r'\bueber\b', re.IGNORECASE), 'über', 'ueber → über'),

    # Modal verbs
    (re.compile(r'\bkoennen\b', re.IGNORECASE), 'können', 'koennen → können'),
    (re.compile(r'\bkoennte\b', re.IGNORECASE), 'könnte', 'koennte → könnte'),
    (re.compile(r'\bmuessen\b', re.IGNORECASE), 'müssen', 'muessen → müssen'),
    (re.compile(r'\bwuerden\b', re.IGNORECASE), 'würden', 'wuerden → würden'),
    (re.compile(r'\bwuerde\b', re.IGNORECASE), 'würde', 'wuerde → würde'),

    # Subjunctive
    (re.compile(r'\bhaette\b', re.IGNORECASE), 'hätte', 'haette → hätte'),
    (re.compile(r'\bwaere\b', re.IGNORECASE), 'wäre', 'waere → wäre'),

    # möchte family
    (re.compile(r'\bmoechte\b', re.IGNORECASE), 'möchte', 'moechte → möchte'),
    (re.compile(r'\bmoegen\b', re.IGNORECASE), 'mögen', 'moegen → mögen'),

    # Größe family
    (re.compile(r'\bgroesse\b', re.IGNORECASE), 'Größe', 'groesse → Größe'),
    (re.compile(r'\bgrosse\b', re.IGNORECASE), 'große', 'grosse → große'),

    # ß words
    (re.compile(r'\bstrasse\b', re.IGNORECASE), 'Straße', 'strasse → Straße'),
    (re.compile(r'\bschliessen\b', re.IGNORECASE), 'schließen', 'schliessen → schließen'),
    (re.compile(r'\bheissen\b', re.IGNORECASE), 'heißen', 'heissen → heißen'),

    # ä words
    (re.compile(r'\baehnlich\b', re.IGNORECASE), 'ähnlich', 'aehnlich → ähnlich'),
    (re.compile(r'\baendern\b', re.IGNORECASE), 'ändern', 'aendern → ändern'),
    (re.compile(r'\baenderung\b', re.IGNORECASE), 'Änderung', 'aenderung → Änderung'),
    (re.compile(r'\bspaeter\b', re.IGNORECASE), 'später', 'spaeter → später'),
    (re.compile(r'\bnaechste\b', re.IGNORECASE), 'nächste', 'naechste → nächste'),

    # ö words
    (re.compile(r'\boeffnen\b', re.IGNORECASE), 'öffnen', 'oeffnen → öffnen'),
    (re.compile(r'\boeffentlich\b', re.IGNORECASE), 'öffentlich', 'oeffentlich → öffentlich'),
    (re.compile(r'\bloesung\b', re.IGNORECASE), 'Lösung', 'loesung → Lösung'),
    (re.compile(r'\bloeschen\b', re.IGNORECASE), 'löschen', 'loeschen → löschen'),

    # ü words
    (re.compile(r'\bpruefung\b', re.IGNORECASE), 'Prüfung', 'pruefung → Prüfung'),
    (re.compile(r'\bpruefen\b', re.IGNORECASE), 'prüfen', 'pruefen → prüfen'),
    (re.compile(r'\bzurueck\b', re.IGNORECASE), 'zurück', 'zurueck → zurück'),
    (re.compile(r'\bnatuerlich\b', re.IGNORECASE), 'natürlich', 'natuerlich → natürlich'),
    (re.compile(r'\bverfuegbar\b', re.IGNORECASE), 'verfügbar', 'verfuegbar → verfügbar'),
    (re.compile(r'\bgueltig\b', re.IGNORECASE), 'gültig', 'gueltig → gültig'),
    (re.compile(r'\bungueltig\b', re.IGNORECASE), 'ungültig', 'ungueltig → ungültig'),
]

GERMAN_FILE_EXTENSIONS = {
    '.md', '.txt', '.html', '.tsx', '.ts', '.jsx', '.js',
    '.json', '.py', '.yml', '.yaml', '.xml', '.vue'
}


def should_check_file(file_path: str) -> bool:
    if not file_path:
        return False
    dot_index = file_path.rfind('.')
    if dot_index == -1:
        return False
    ext = file_path[dot_index:].lower()
    return ext in GERMAN_FILE_EXTENSIONS


def find_umlaut_errors(content: str) -> List[str]:
    errors = []
    for pattern, correct, description in UMLAUT_RULES:
        matches = pattern.findall(content)
        if matches:
            errors.append(f"{description} ({len(matches)}x)")
    return errors


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")
    if tool_name not in ("Write", "Edit"):
        sys.exit(0)

    tool_input = input_data.get("tool_input", {})
    file_path = tool_input.get("file_path", "")
    content = tool_input.get("content", "") or tool_input.get("new_string", "")

    if not content or not should_check_file(file_path):
        sys.exit(0)

    errors = find_umlaut_errors(content)

    if errors:
        print(f"\n⚠️  UMLAUT WARNING in {file_path}:", file=sys.stderr)
        for error in errors:
            print(f"  • {error}", file=sys.stderr)
        print("\nUse correct German umlauts: ä, ö, ü, ß", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
