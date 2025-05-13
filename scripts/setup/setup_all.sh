#!/bin/bash

# ==========================================================
# Neural Rekursives Debugging - Komplette Setup-Skript
# ==========================================================
#
# Dieses Skript installiert und konfiguriert alle Komponenten
# des Neural Recursive Debugging Systems.
#
# Es umfasst:
# - Git-Feature-Branch-Management
# - CI/CD-Integration
# - Vector-DB für Codeanalyse
# - Dashboard-Installation
# - Benutzerprofile & .about-Konfiguration

set -e

# Farbdefinitionen
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Pfade definieren
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
CLAUDE_CODE_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Wenn im Git-Repository
if command -v git &> /dev/null && git rev-parse --is-inside-work-tree &> /dev/null; then
    PROJECT_ROOT=$(git rev-parse --show-toplevel)
    echo -e "${BLUE}Git-Repository gefunden: ${PROJECT_ROOT}${NC}"
else
    PROJECT_ROOT="${1:-.}"
    if [ ! -d "$PROJECT_ROOT" ]; then
        echo -e "${RED}Verzeichnis nicht gefunden: $PROJECT_ROOT${NC}"
        echo "Verwendung: $0 [Projektverzeichnis]"
        exit 1
    fi
    PROJECT_ROOT=$(cd "$PROJECT_ROOT" && pwd)
    echo -e "${YELLOW}Kein Git-Repository, verwende Verzeichnis: ${PROJECT_ROOT}${NC}"
fi

# Header anzeigen
function print_header() {
    echo -e "\n${BLUE}===========================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}===========================================================${NC}\n"
}

# Prüfen, ob Node.js und Python installiert sind
function check_requirements() {
    print_header "Systemanforderungen prüfen"
    
    # Node.js prüfen
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Node.js ist nicht installiert.${NC}"
        echo -e "${YELLOW}Bitte installieren Sie Node.js (mindestens v14) von https://nodejs.org/${NC}"
        exit 1
    else
        NODE_VERSION=$(node -v)
        echo -e "${GREEN}✓ Node.js ist installiert: $NODE_VERSION${NC}"
    fi
    
    # Python prüfen
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}Python 3 ist nicht installiert.${NC}"
        echo -e "${YELLOW}Bitte installieren Sie Python 3 (mindestens v3.6) von https://www.python.org/${NC}"
        exit 1
    else
        PYTHON_VERSION=$(python3 --version)
        echo -e "${GREEN}✓ Python ist installiert: $PYTHON_VERSION${NC}"
    fi
    
    # Git prüfen
    if ! command -v git &> /dev/null; then
        echo -e "${YELLOW}Git ist nicht installiert. Einige Funktionen werden möglicherweise nicht verfügbar sein.${NC}"
    else
        GIT_VERSION=$(git --version)
        echo -e "${GREEN}✓ Git ist installiert: $GIT_VERSION${NC}"
    fi
}

# Claude-Verzeichnisse im Projekt erstellen
function setup_directories() {
    print_header "Verzeichnisse einrichten"
    
    CLAUDE_DIR="$PROJECT_ROOT/.claude"
    CONFIG_DIR="$CLAUDE_DIR/config"
    TOOLS_DIR="$CLAUDE_DIR/tools"
    TEMPLATES_DIR="$CLAUDE_DIR/templates"
    VECTORDB_DIR="$CLAUDE_DIR/vectordb"
    HISTORY_DIR="$CLAUDE_DIR/history"
    DEBUG_DIR="$TOOLS_DIR/debug"
    DASHBOARD_DIR="$TOOLS_DIR/dashboard"
    
    # Alle Verzeichnisse erstellen
    mkdir -p "$CONFIG_DIR" "$TOOLS_DIR" "$TEMPLATES_DIR" "$VECTORDB_DIR" "$HISTORY_DIR" "$DEBUG_DIR" "$DASHBOARD_DIR"
    
    echo -e "${GREEN}Verzeichnisstruktur erstellt:${NC}"
    echo -e "  ${CYAN}$CLAUDE_DIR/${NC}"
    echo -e "  ├── ${CYAN}config/${NC}"
    echo -e "  ├── ${CYAN}tools/${NC}"
    echo -e "  │   ├── ${CYAN}debug/${NC}"
    echo -e "  │   └── ${CYAN}dashboard/${NC}"
    echo -e "  ├── ${CYAN}templates/${NC}"
    echo -e "  ├── ${CYAN}vectordb/${NC}"
    echo -e "  └── ${CYAN}history/${NC}"
}

# Debugging-Tools kopieren
function copy_debug_tools() {
    print_header "Debugging-Tools kopieren"
    
    DEBUG_DIR="$PROJECT_ROOT/.claude/tools/debug"
    
    # Haupt-Debugging-Tools kopieren
    cp "$CLAUDE_CODE_DIR/scripts/debug_workflow_engine.js" "$DEBUG_DIR/"
    cp "$CLAUDE_CODE_DIR/scripts/error_trigger.js" "$DEBUG_DIR/"
    cp "$CLAUDE_CODE_DIR/scripts/auto_debug.py" "$DEBUG_DIR/"
    cp "$CLAUDE_CODE_DIR/core/rag/recursive_watcher.py" "$DEBUG_DIR/"
    
    # Konfiguration kopieren
    cp "$CLAUDE_CODE_DIR/core/config/debug_workflow_config.json" "$PROJECT_ROOT/.claude/config/"
    
    # Feature-Branch-Manager kopieren
    cp "$CLAUDE_CODE_DIR/scripts/setup/git_feature_manager.sh" "$DEBUG_DIR/"
    chmod +x "$DEBUG_DIR/git_feature_manager.sh"
    
    echo -e "${GREEN}✓ Debugging-Tools kopiert${NC}"
}

# Prompt-Templates kopieren
function copy_templates() {
    print_header "Prompt-Templates kopieren"
    
    TEMPLATES_DIR="$PROJECT_ROOT/.claude/templates"
    
    # Templates kopieren
    cp "$CLAUDE_CODE_DIR/docs/prompts/recursive_bug_analysis.md" "$TEMPLATES_DIR/"
    cp "$CLAUDE_CODE_DIR/docs/prompts/stack_overflow_debugging.md" "$TEMPLATES_DIR/"
    cp "$CLAUDE_CODE_DIR/docs/prompts/recursive_optimization.md" "$TEMPLATES_DIR/"
    cp "$CLAUDE_CODE_DIR/docs/prompts/complex_bug_hunt.md" "$TEMPLATES_DIR/"
    cp "$CLAUDE_CODE_DIR/docs/prompts/systematic_debugging_workflow.md" "$TEMPLATES_DIR/"
    
    echo -e "${GREEN}✓ Prompt-Templates kopiert${NC}"
}

# Dashboard installieren
function install_dashboard() {
    print_header "Dashboard installieren"
    
    DASHBOARD_DIR="$PROJECT_ROOT/.claude/tools/dashboard"
    
    # Dashboard-Dateien kopieren
    cp "$CLAUDE_CODE_DIR/scripts/dashboard/dashboard.html" "$DASHBOARD_DIR/"
    cp "$CLAUDE_CODE_DIR/scripts/dashboard/server.js" "$DASHBOARD_DIR/"
    cp "$CLAUDE_CODE_DIR/scripts/dashboard/start-dashboard.sh" "$DASHBOARD_DIR/"
    chmod +x "$DASHBOARD_DIR/start-dashboard.sh"
    
    # Symlink im Hauptverzeichnis erstellen
    ln -sf "$DASHBOARD_DIR/start-dashboard.sh" "$PROJECT_ROOT/.claude/start-dashboard.sh"
    
    echo -e "${GREEN}✓ Dashboard installiert${NC}"
    echo -e "${YELLOW}Starten Sie das Dashboard mit: ${PROJECT_ROOT}/.claude/start-dashboard.sh${NC}"
}

# Vector-DB-Updater kopieren
function setup_vector_db() {
    print_header "Vector-DB für Codeanalyse einrichten"
    
    TOOLS_DIR="$PROJECT_ROOT/.claude/tools"
    
    # Vector-DB-Updater kopieren
    cp "$CLAUDE_CODE_DIR/scripts/update_vector_db.js" "$TOOLS_DIR/"
    
    # Sicherstellen, dass nötige npm-Pakete vorhanden sind
    if command -v npm &> /dev/null; then
        cd "$PROJECT_ROOT/.claude"
        echo -e "${YELLOW}Installiere benötigte npm-Pakete...${NC}"
        npm init -y > /dev/null
        npm install --no-fund --silent sqlite3 commander
        echo -e "${GREEN}✓ Abhängigkeiten installiert${NC}"
    else
        echo -e "${YELLOW}npm nicht gefunden, Abhängigkeiten werden nicht installiert${NC}"
        echo -e "${YELLOW}Sie müssen sqlite3 und commander manuell installieren${NC}"
    fi
    
    # Erste Code-Indexierung starten
    echo -e "${YELLOW}Starte initiale Code-Indexierung...${NC}"
    
    # Im Hintergrund starten
    node "$TOOLS_DIR/update_vector_db.js" index --path "$PROJECT_ROOT" &
    INDEXING_PID=$!
    
    # PID merken
    echo $INDEXING_PID > "$PROJECT_ROOT/.claude/.indexing_pid"
    
    echo -e "${GREEN}✓ Indexierung gestartet (PID: $INDEXING_PID)${NC}"
    echo -e "${YELLOW}Die Indexierung läuft im Hintergrund und kann einige Zeit dauern${NC}"
}

# CI/CD-Integration einrichten
function setup_cicd() {
    print_header "CI/CD-Integration einrichten"
    
    TOOLS_DIR="$PROJECT_ROOT/.claude/tools"
    
    # CI/CD-Integration kopieren
    cp "$CLAUDE_CODE_DIR/scripts/setup/cicd_integration.js" "$TOOLS_DIR/"
    
    # CI-System erkennen
    CI_SYSTEM="github"
    if [ -d "$PROJECT_ROOT/.github" ]; then
        CI_SYSTEM="github"
    elif [ -f "$PROJECT_ROOT/.gitlab-ci.yml" ]; then
        CI_SYSTEM="gitlab"
    elif [ -f "$PROJECT_ROOT/Jenkinsfile" ]; then
        CI_SYSTEM="jenkins"
    elif [ -f "$PROJECT_ROOT/azure-pipelines.yml" ]; then
        CI_SYSTEM="azure"
    elif [ -d "$PROJECT_ROOT/.circleci" ]; then
        CI_SYSTEM="circle"
    elif [ -f "$PROJECT_ROOT/.travis.yml" ]; then
        CI_SYSTEM="travis"
    fi
    
    echo -e "${YELLOW}Erkanntes CI-System: $CI_SYSTEM${NC}"
    
    # Unterstützte Sprachen erkennen
    LANGUAGES=""
    if ls "$PROJECT_ROOT"/**/*.js >/dev/null 2>&1 || ls "$PROJECT_ROOT"/*.js >/dev/null 2>&1; then
        LANGUAGES="$LANGUAGES,js"
    fi
    if ls "$PROJECT_ROOT"/**/*.ts >/dev/null 2>&1 || ls "$PROJECT_ROOT"/*.ts >/dev/null 2>&1; then
        LANGUAGES="$LANGUAGES,ts"
    fi
    if ls "$PROJECT_ROOT"/**/*.py >/dev/null 2>&1 || ls "$PROJECT_ROOT"/*.py >/dev/null 2>&1; then
        LANGUAGES="$LANGUAGES,py"
    fi
    if ls "$PROJECT_ROOT"/**/*.java >/dev/null 2>&1 || ls "$PROJECT_ROOT"/*.java >/dev/null 2>&1; then
        LANGUAGES="$LANGUAGES,java"
    fi
    if ls "$PROJECT_ROOT"/**/*.cpp >/dev/null 2>&1 || ls "$PROJECT_ROOT"/*.cpp >/dev/null 2>&1 || \
       ls "$PROJECT_ROOT"/**/*.cc >/dev/null 2>&1 || ls "$PROJECT_ROOT"/*.cc >/dev/null 2>&1 || \
       ls "$PROJECT_ROOT"/**/*.h >/dev/null 2>&1 || ls "$PROJECT_ROOT"/*.h >/dev/null 2>&1; then
        LANGUAGES="$LANGUAGES,cpp"
    fi
    if ls "$PROJECT_ROOT"/**/*.go >/dev/null 2>&1 || ls "$PROJECT_ROOT"/*.go >/dev/null 2>&1; then
        LANGUAGES="$LANGUAGES,go"
    fi
    if ls "$PROJECT_ROOT"/**/*.rs >/dev/null 2>&1 || ls "$PROJECT_ROOT"/*.rs >/dev/null 2>&1; then
        LANGUAGES="$LANGUAGES,rust"
    fi
    
    # Komma am Anfang entfernen, falls vorhanden
    LANGUAGES=${LANGUAGES#,}
    
    # Wenn keine Sprachen erkannt wurden, Standard verwenden
    if [ -z "$LANGUAGES" ]; then
        LANGUAGES="js,py"
    fi
    
    echo -e "${YELLOW}Erkannte Sprachen: $LANGUAGES${NC}"
    
    # CI/CD-Integration ausführen
    echo -e "${YELLOW}Richte CI/CD-Integration ein...${NC}"
    node "$TOOLS_DIR/cicd_integration.js" setup --path "$PROJECT_ROOT" --ci "$CI_SYSTEM" --languages "$LANGUAGES" --workflow "recursive-debug"
    
    echo -e "${GREEN}✓ CI/CD-Integration eingerichtet${NC}"
}

# Benutzerprofil erstellen
function create_user_profile() {
    print_header "Benutzerprofil erstellen"
    
    ABOUT_FILE="$PROJECT_ROOT/.claude/user.about.json"
    
    # Git-Benutzerinformationen abrufen
    USERNAME=""
    EMAIL=""
    
    if command -v git &> /dev/null; then
        USERNAME=$(git config user.name 2>/dev/null || echo "")
        EMAIL=$(git config user.email 2>/dev/null || echo "")
    fi
    
    # Wenn keine Git-Informationen verfügbar, Systembenutzernamen verwenden
    if [ -z "$USERNAME" ]; then
        USERNAME=$(whoami 2>/dev/null || echo "User")
    fi
    
    # Projekt- und Branchinformationen
    PROJECT_NAME=$(basename "$PROJECT_ROOT")
    BRANCH_NAME=""
    
    if command -v git &> /dev/null && git rev-parse --is-inside-work-tree &> /dev/null; then
        BRANCH_NAME=$(git branch --show-current 2>/dev/null || echo "")
    fi
    
    # Aktuelle Zeit
    TIMESTAMP=$(date +%Y-%m-%d-%H:%M:%S)
    
    # Benutzerinformationen abfragen
    echo -e "${YELLOW}Bitte geben Sie Ihre bevorzugten Programmiersprachen ein (durch Komma getrennt, leer lassen für auto):${NC}"
    read -r PREFERRED_LANGUAGES
    
    if [ -z "$PREFERRED_LANGUAGES" ]; then
        PREFERRED_LANGUAGES="$LANGUAGES"
    fi
    
    echo -e "${YELLOW}Debugging-Präferenz (performance, safety, auto):${NC}"
    read -r DEBUGGING_PREFERENCE
    
    if [ -z "$DEBUGGING_PREFERENCE" ]; then
        DEBUGGING_PREFERENCE="auto"
    fi
    
    # JSON erstellen
    cat > "$ABOUT_FILE" << EOF
{
  "username": "$USERNAME",
  "email": "$EMAIL",
  "current_project": "$PROJECT_NAME",
  "current_branch": "$BRANCH_NAME",
  "preferences": {
    "languages": "$PREFERRED_LANGUAGES",
    "debugging_focus": "$DEBUGGING_PREFERENCE",
    "ui": {
      "dashboard_theme": "dark",
      "notification_level": "important"
    }
  },
  "projects": ["$PROJECT_NAME"],
  "last_updated": "$TIMESTAMP"
}
EOF
    
    echo -e "${GREEN}✓ Benutzerprofil erstellt: $ABOUT_FILE${NC}"
}

# Installationszusammenfassung anzeigen
function show_summary() {
    print_header "Installation abgeschlossen"
    
    echo -e "${GREEN}Das Neural Recursive Debugging System wurde erfolgreich installiert!${NC}"
    echo -e "${YELLOW}Installationsverzeichnis: ${PROJECT_ROOT}/.claude/${NC}\n"
    
    echo -e "${BLUE}Verfügbare Befehle:${NC}"
    echo -e "  ${CYAN}${PROJECT_ROOT}/.claude/tools/debug/git_feature_manager.sh${NC} - Feature-Branch-Management"
    echo -e "  ${CYAN}${PROJECT_ROOT}/.claude/start-dashboard.sh${NC} - Dashboard starten"
    echo -e "  ${CYAN}${PROJECT_ROOT}/.claude/tools/update_vector_db.js${NC} - Codeanalyse aktualisieren\n"
    
    echo -e "${BLUE}Nächste Schritte:${NC}"
    echo -e "  1. ${CYAN}Starten Sie das Dashboard:${NC} ${PROJECT_ROOT}/.claude/start-dashboard.sh"
    echo -e "  2. ${CYAN}Erstellen Sie einen Feature-Branch:${NC} ${PROJECT_ROOT}/.claude/tools/debug/git_feature_manager.sh create my-feature"
    echo -e "  3. ${CYAN}Nutzen Sie automatisches Debugging:${NC} node ${PROJECT_ROOT}/.claude/tools/debug/debug_workflow_engine.js\n"
    
    echo -e "${YELLOW}Weitere Informationen finden Sie in der Dokumentation.${NC}"
}

# Git-Hooks installieren
function install_git_hooks() {
    print_header "Git-Hooks installieren"
    
    # Prüfen, ob es sich um ein Git-Repository handelt
    if ! command -v git &> /dev/null || ! git rev-parse --is-inside-work-tree &> /dev/null; then
        echo -e "${YELLOW}Kein Git-Repository gefunden, Git-Hooks werden übersprungen${NC}"
        return
    fi
    
    HOOKS_DIR="$PROJECT_ROOT/.git/hooks"
    
    if [ ! -d "$HOOKS_DIR" ]; then
        echo -e "${RED}Git-Hooks-Verzeichnis nicht gefunden: $HOOKS_DIR${NC}"
        return
    fi
    
    # Pre-Commit-Hook
    PRE_COMMIT_HOOK="$HOOKS_DIR/pre-commit"
    
    if [ -f "$PRE_COMMIT_HOOK" ]; then
        echo -e "${YELLOW}Existierender pre-commit Hook gefunden, wird gesichert als pre-commit.bak${NC}"
        cp "$PRE_COMMIT_HOOK" "$PRE_COMMIT_HOOK.bak"
    fi
    
    cat > "$PRE_COMMIT_HOOK" << 'EOF'
#!/bin/bash

# Neural Recursive Debugging - Pre-Commit-Hook
echo "Führe rekursive Debug-Prüfung durch..."

# Pfad zu Debugging-Tools
CLAUDE_DIR=".claude"
DEBUG_DIR="$CLAUDE_DIR/tools/debug"
DEBUG_ENGINE="$DEBUG_DIR/debug_workflow_engine.js"

# Prüfen, ob Debug-Engine existiert
if [ ! -f "$DEBUG_ENGINE" ]; then
    echo "Debug-Engine nicht gefunden: $DEBUG_ENGINE"
    exit 0  # Nicht fehlschlagen lassen
fi

# Liste geänderter Dateien abrufen
changed_files=$(git diff --cached --name-only --diff-filter=ACMR)

# Nach Code-Dateien filtern
code_files=$(echo "$changed_files" | grep -E '\.(js|py|ts|java|cpp|c|go|rs)$' || true)

if [ -z "$code_files" ]; then
    echo "Keine relevanten Code-Dateien geändert."
    exit 0
fi

# Prüfen auf rekursive Funktionen
for file in $code_files; do
    echo "Prüfe $file..."
    
    # Schneller Check auf rekursive Muster
    if grep -q -E '(function\s+\w+\s*\([^)]*\)\s*\{.*\1\s*\()|(def\s+\w+\s*\([^)]*\).*\1\s*\()' "$file"; then
        echo "Potenzielle rekursive Funktion in $file gefunden."
        
        # Quick-Analyse durchführen
        if ! node "$DEBUG_ENGINE" run quick --file "$file" --output json; then
            echo "Warnung: Rekursionsproblem in $file gefunden."
            echo "Commit wird trotzdem fortgesetzt, aber prüfe die Datei auf Stack Overflow-Risiken."
        fi
    fi
done

# Immer erfolgreich beenden (nicht blockieren)
exit 0
EOF
    
    chmod +x "$PRE_COMMIT_HOOK"
    echo -e "${GREEN}✓ Pre-Commit-Hook installiert${NC}"
    
    # Post-Checkout-Hook
    POST_CHECKOUT_HOOK="$HOOKS_DIR/post-checkout"
    
    if [ -f "$POST_CHECKOUT_HOOK" ]; then
        echo -e "${YELLOW}Existierender post-checkout Hook gefunden, wird gesichert als post-checkout.bak${NC}"
        cp "$POST_CHECKOUT_HOOK" "$POST_CHECKOUT_HOOK.bak"
    fi
    
    cat > "$POST_CHECKOUT_HOOK" << 'EOF'
#!/bin/bash

# Neural Recursive Debugging - Post-Checkout-Hook
BRANCH=$(git branch --show-current)

# Nur für Feature-Branches
if [[ "$BRANCH" == feature/* ]]; then
    echo "Feature-Branch erkannt: $BRANCH"
    
    # Vector-DB aktualisieren
    CLAUDE_DIR=".claude"
    VECTOR_UPDATER="$CLAUDE_DIR/tools/update_vector_db.js"
    
    if [ -f "$VECTOR_UPDATER" ]; then
        echo "Aktualisiere Vector-DB für Branch $BRANCH..."
        node "$VECTOR_UPDATER" branch "$BRANCH" &
    fi
fi

exit 0
EOF
    
    chmod +x "$POST_CHECKOUT_HOOK"
    echo -e "${GREEN}✓ Post-Checkout-Hook installiert${NC}"
}

# Haupt-Ausführung
check_requirements
setup_directories
copy_debug_tools
copy_templates
setup_vector_db
install_dashboard
setup_cicd
install_git_hooks
create_user_profile
show_summary
