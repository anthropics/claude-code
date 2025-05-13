#!/bin/bash

# ==============================================
# Recursive Debugging - Installation Script
# ==============================================
# 
# Dieses Skript installiert die rekursiven Debugging-Tools
# in einem beliebigen Projekt.
#
# Verwendung:
#   ./install_recursive_debugging.sh [Zielverzeichnis]
#
# Wenn kein Zielverzeichnis angegeben ist, wird das aktuelle
# Verzeichnis verwendet.

set -e

# Farbdefinitionen
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funktionen
print_header() {
  echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
  echo -e "${RED}✖ $1${NC}"
}

# Bestimme Quell- und Zielverzeichnisse
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
SOURCE_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
TARGET_DIR="${1:-.}"

if [ ! -d "$TARGET_DIR" ]; then
  print_error "Zielverzeichnis existiert nicht: $TARGET_DIR"
  exit 1
fi

# Absolute Pfade
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

print_header "Claude Rekursives Debugging - Installation"
echo "Quelle: $SOURCE_DIR"
echo "Ziel: $TARGET_DIR"
echo

# Prüfe, ob es sich um ein Git-Repository handelt
IS_GIT_REPO=false
if [ -d "$TARGET_DIR/.git" ]; then
  IS_GIT_REPO=true
  print_success "Git-Repository erkannt"
else
  print_warning "Kein Git-Repository erkannt. Git-Hooks werden nicht installiert."
fi

# Erstelle Verzeichnisstruktur
print_header "Erstelle Verzeichnisstruktur"
mkdir -p "$TARGET_DIR/.claude/tools/debug"
mkdir -p "$TARGET_DIR/.vscode"
print_success "Verzeichnisstruktur erstellt"

# Kopiere Debugging-Tools
print_header "Kopiere Debugging-Tools"

# Core-Tools
cp "$SOURCE_DIR/scripts/debug_workflow_engine.js" "$TARGET_DIR/.claude/tools/debug/"
cp "$SOURCE_DIR/scripts/error_trigger.js" "$TARGET_DIR/.claude/tools/debug/"
cp "$SOURCE_DIR/scripts/auto_debug.py" "$TARGET_DIR/.claude/tools/debug/"
cp "$SOURCE_DIR/core/rag/recursive_watcher.py" "$TARGET_DIR/.claude/tools/debug/"
print_success "Core-Tools kopiert"

# Konfiguration
mkdir -p "$TARGET_DIR/.claude/config"
cp "$SOURCE_DIR/core/config/debug_workflow_config.json" "$TARGET_DIR/.claude/config/"
print_success "Konfiguration kopiert"

# Templates
mkdir -p "$TARGET_DIR/.claude/templates"
cp "$SOURCE_DIR/docs/prompts/recursive_bug_analysis.md" "$TARGET_DIR/.claude/templates/"
cp "$SOURCE_DIR/docs/prompts/stack_overflow_debugging.md" "$TARGET_DIR/.claude/templates/"
cp "$SOURCE_DIR/docs/prompts/recursive_optimization.md" "$TARGET_DIR/.claude/templates/"
cp "$SOURCE_DIR/docs/prompts/complex_bug_hunt.md" "$TARGET_DIR/.claude/templates/"
cp "$SOURCE_DIR/docs/prompts/systematic_debugging_workflow.md" "$TARGET_DIR/.claude/templates/"
print_success "Templates kopiert"

# Installiere VSCode-Tasks
print_header "Konfiguriere VSCode-Integration"
if [ -f "$TARGET_DIR/.vscode/tasks.json" ]; then
  cp "$TARGET_DIR/.vscode/tasks.json" "$TARGET_DIR/.vscode/tasks.json.bak"
  print_warning "Existierende tasks.json gesichert als tasks.json.bak"
fi

cat > "$TARGET_DIR/.vscode/tasks.json" << EOF
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Run mit Rekursions-Debugging (JS)",
      "type": "shell",
      "command": "node",
      "args": [
        "\${workspaceFolder}/.claude/tools/debug/error_trigger.js",
        "\${file}"
      ],
      "group": {
        "kind": "build",
        "isDefault": true
      },
      "presentation": {
        "reveal": "always",
        "panel": "new"
      },
      "problemMatcher": []
    },
    {
      "label": "Run mit Rekursions-Debugging (Python)",
      "type": "shell",
      "command": "python",
      "args": [
        "\${workspaceFolder}/.claude/tools/debug/auto_debug.py",
        "\${file}"
      ],
      "group": "build",
      "presentation": {
        "reveal": "always",
        "panel": "new"
      },
      "problemMatcher": []
    },
    {
      "label": "Debug-Workflow: Rekursionsfehler beheben",
      "type": "shell",
      "command": "node",
      "args": [
        "\${workspaceFolder}/.claude/tools/debug/debug_workflow_engine.js",
        "run",
        "standard",
        "--file",
        "\${file}",
        "--save"
      ],
      "group": "build",
      "presentation": {
        "reveal": "always",
        "panel": "new"
      },
      "problemMatcher": []
    },
    {
      "label": "Git-Hooks installieren",
      "type": "shell",
      "command": "node",
      "args": [
        "\${workspaceFolder}/.claude/tools/debug/debug_workflow_engine.js",
        "install-hooks"
      ],
      "group": "none",
      "presentation": {
        "reveal": "always",
        "panel": "new"
      },
      "problemMatcher": []
    }
  ]
}
EOF
print_success "VSCode-Tasks konfiguriert"

# Erstelle README
print_header "Erstelle Dokumentation"
cat > "$TARGET_DIR/.claude/tools/debug/README.md" << EOF
# Rekursives Debugging Tools

Dieses Verzeichnis enthält Tools zur automatischen Erkennung und Behebung von Fehlern
in rekursiven Algorithmen.

## Verwendung

### JavaScript-Dateien ausführen mit Debugging:

\`\`\`bash
node .claude/tools/debug/error_trigger.js pfad/zur/datei.js
\`\`\`

### Python-Dateien ausführen mit Debugging:

\`\`\`bash
python .claude/tools/debug/auto_debug.py pfad/zur/datei.py
\`\`\`

### Python-Module mit Rekursionsüberwachung importieren:

\`\`\`python
# Zu Beginn Ihres Skripts einfügen
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '.claude/tools/debug'))
import recursive_watcher
\`\`\`

### Debug-Workflow manuell ausführen:

\`\`\`bash
node .claude/tools/debug/debug_workflow_engine.js run standard --file pfad/zur/datei.js
\`\`\`

## VSCode-Integration

Mehrere vorkonfigurierte Tasks sind verfügbar:

1. **Run mit Rekursions-Debugging (JS/Python)**: Führt die aktuelle Datei mit Überwachung aus
2. **Debug-Workflow: Rekursionsfehler beheben**: Analysiert und behebt Probleme in der aktuellen Datei
3. **Git-Hooks installieren**: Richtet automatische Prüfungen bei Git-Operationen ein

Zugriff über: Terminal > Aufgabe ausführen...

## Automatisches Debugging

Die Tools können Fehler automatisch erkennen und entsprechende Debugging-Workflows auslösen:

- Stack Overflows werden erkannt
- Unendliche Rekursionen werden aufgedeckt
- Leistungsprobleme werden identifiziert

## Weitere Informationen

Vollständige Dokumentation im Claude Neural Framework:
https://github.com/username/claude-code

EOF
print_success "README erstellt"

# Git-Hooks installieren (optional)
if [ "$IS_GIT_REPO" = true ]; then
  print_header "Konfiguriere Git-Hooks"
  
  # Erstelle oder aktualisiere pre-commit Hook
  PRE_COMMIT_HOOK="$TARGET_DIR/.git/hooks/pre-commit"
  
  if [ -f "$PRE_COMMIT_HOOK" ]; then
    cp "$PRE_COMMIT_HOOK" "$PRE_COMMIT_HOOK.bak"
    print_warning "Existierender pre-commit Hook gesichert als pre-commit.bak"
  fi
  
  cat > "$PRE_COMMIT_HOOK" << 'EOF'
#!/bin/sh

# Automatischer Pre-Commit-Hook für rekursives Debugging
echo "Führe rekursive Debug-Prüfung durch..."

# Liste geänderter Dateien abrufen
changed_files=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(js|py|ts)$')

if [ -z "$changed_files" ]; then
  echo "Keine relevanten Dateien geändert."
  exit 0
fi

# Schnelle Prüfung für bekannte rekursive Problemmuster
for file in $changed_files; do
  echo "Prüfe $file..."
  if grep -q -E '(function\s+\w+\s*\([^)]*\)\s*\{.*\1\s*\()|(def\s+\w+\s*\([^)]*\).*\1\s*\()' "$file"; then
    echo "Potenziell rekursive Funktion in $file gefunden."
    
    # Optional: Auf Stack Overflow-Muster prüfen
    if ! node .claude/tools/debug/debug_workflow_engine.js run quick --file "$file"; then
      echo "Warnung: Potenzielles Rekursionsproblem in $file gefunden."
      echo "Commit wird trotzdem fortgesetzt, aber prüfen Sie die Datei auf Stack Overflow-Risiken."
    fi
  fi
done

exit 0
EOF
  
  chmod +x "$PRE_COMMIT_HOOK"
  print_success "Pre-commit Hook installiert"
fi

print_header "Installation abgeschlossen"
echo
echo -e "Die rekursiven Debugging-Tools wurden erfolgreich in ${GREEN}$TARGET_DIR${NC} installiert."
echo -e "Verwenden Sie ${YELLOW}VSCode Tasks${NC} oder die Befehlszeilen-Skripte, um die Tools zu nutzen."
echo -e "Lesen Sie ${BLUE}.claude/tools/debug/README.md${NC} für Details zur Verwendung."
echo

if [ "$IS_GIT_REPO" = true ]; then
  echo -e "Git-Hooks wurden konfiguriert. Bei jedem Commit werden rekursive Funktionen automatisch überprüft."
fi

echo -e "\nViel Erfolg beim rekursiven Debugging! 🚀"
