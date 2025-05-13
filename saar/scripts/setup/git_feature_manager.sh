#!/bin/bash

# ============================================================
# Neural Git Feature Manager mit Claude-Integration
# ============================================================
# 
# Dieses Skript erstellt und verwaltet Feature-Branches mit 
# automatischer Claude-Integration für rekursives Debugging.
#
# Verwendung:
#   ./git_feature_manager.sh create <feature-name> [basis-branch]
#   ./git_feature_manager.sh commit <nachricht>
#   ./git_feature_manager.sh analyze
#   ./git_feature_manager.sh complete [zielbranch]

set -e

# Farbdefinitionen
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Pfade
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
CLAUDE_DIR="$PROJECT_ROOT/.claude"
CONFIG_DIR="$CLAUDE_DIR/config"
VECTOR_DB_DIR="$CLAUDE_DIR/vectordb"
HISTORY_DIR="$CLAUDE_DIR/history"

# Debug-Workflow-Engine
DEBUG_WORKFLOW="$SCRIPT_DIR/../debug_workflow_engine.js"

# Funktionen
print_header() {
  echo -e "${BLUE}============================================================${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}============================================================${NC}"
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

print_info() {
  echo -e "${CYAN}ℹ $1${NC}"
}

# Verzeichnisse erstellen
setup_directories() {
  mkdir -p "$CLAUDE_DIR" "$CONFIG_DIR" "$VECTOR_DB_DIR" "$HISTORY_DIR"
  print_success "Claude-Verzeichnisse eingerichtet"
}

# Benutzer .about erstellen/aktualisieren
update_about_profile() {
  ABOUT_FILE="$CLAUDE_DIR/user.about.json"
  
  # Prüfen, ob .about-Datei bereits existiert
  if [ -f "$ABOUT_FILE" ]; then
    print_info "Existierendes Benutzerprofil gefunden"
    EXISTING_DATA=$(cat "$ABOUT_FILE")
  else
    print_info "Erstelle neues Benutzerprofil"
    EXISTING_DATA="{}"
  fi
  
  # Benutzerinformationen sammeln
  USERNAME=$(git config user.name || echo "")
  EMAIL=$(git config user.email || echo "")
  
  # Letzte Projekte aktualisieren
  CURRENT_PROJECT=$(basename "$PROJECT_ROOT")
  CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
  TIMESTAMP=$(date +%Y-%m-%d-%H:%M:%S)
  
  # .about-Datei aktualisieren (mit jq, falls vorhanden, sonst manuell)
  if command -v jq &> /dev/null; then
    # Mit jq aktualisieren
    echo "$EXISTING_DATA" | jq --arg username "$USERNAME" \
                               --arg email "$EMAIL" \
                               --arg project "$CURRENT_PROJECT" \
                               --arg branch "$CURRENT_BRANCH" \
                               --arg timestamp "$TIMESTAMP" \
                               '.username = $username | 
                                .email = $email | 
                                .current_project = $project |
                                .current_branch = $branch |
                                .last_updated = $timestamp |
                                .projects = ((.projects // []) + [$project] | unique)' > "$ABOUT_FILE"
  else
    # Einfache manuelle JSON-Erzeugung
    cat > "$ABOUT_FILE" << EOF
{
  "username": "$USERNAME",
  "email": "$EMAIL",
  "current_project": "$CURRENT_PROJECT",
  "current_branch": "$CURRENT_BRANCH",
  "last_updated": "$TIMESTAMP",
  "projects": ["$CURRENT_PROJECT"]
}
EOF
  fi
  
  print_success "Benutzerprofil aktualisiert"
}

# Feature-Branch erstellen
create_feature() {
  if [ -z "$2" ]; then
    print_error "Feature-Name fehlt"
    echo "Verwendung: $0 create <feature-name> [basis-branch]"
    exit 1
  fi
  
  FEATURE_NAME="$2"
  BASE_BRANCH="${3:-main}"
  
  # Prüfen, ob Git-Repository
  if ! git rev-parse --is-inside-work-tree &> /dev/null; then
    print_error "Kein Git-Repository gefunden"
    exit 1
  fi
  
  # Aktuelle Änderungen prüfen
  if ! git diff --quiet || ! git diff --staged --quiet; then
    print_warning "Es gibt ungespeicherte Änderungen. Möchten Sie fortfahren? (y/n)"
    read -r CONTINUE
    if [ "$CONTINUE" != "y" ]; then
      print_info "Abgebrochen"
      exit 0
    fi
  fi
  
  # Branch-Name formatieren
  BRANCH_NAME="feature/${FEATURE_NAME// /-}"
  
  print_header "Erstelle Feature-Branch: $BRANCH_NAME"
  
  # Zum Basis-Branch wechseln
  git fetch origin "$BASE_BRANCH" || true
  git checkout "$BASE_BRANCH" || git checkout -b "$BASE_BRANCH"
  git pull origin "$BASE_BRANCH" || true
  
  # Neuen Feature-Branch erstellen
  git checkout -b "$BRANCH_NAME"
  
  # Branch-Info in Konfiguration speichern
  mkdir -p "$CONFIG_DIR/branches"
  cat > "$CONFIG_DIR/branches/$BRANCH_NAME.json" << EOF
{
  "name": "$BRANCH_NAME",
  "base": "$BASE_BRANCH",
  "created": "$(date +%Y-%m-%d-%H:%M:%S)",
  "creator": "$(git config user.name)",
  "status": "active",
  "commits": [],
  "analyzed_files": []
}
EOF

  # Claude-Verzeichnisse und Konfiguration aktualisieren
  setup_directories
  update_about_profile
  
  # Hook-Integration für diesen Branch
  setup_branch_hooks
  
  print_success "Feature-Branch $BRANCH_NAME erstellt"
  print_info "Claude-Integration aktiviert für automatisches Debugging"
  print_info "Verwende '$0 commit \"Nachricht\"' für automatisch analysierte Commits"
}

# Branch-spezifische Hooks einrichten
setup_branch_hooks() {
  print_info "Richte Branch-Hooks ein..."
  
  # Sicherstellen, dass Pre-Commit existiert
  PRE_COMMIT_HOOK="$PROJECT_ROOT/.git/hooks/pre-commit"
  if [ ! -f "$PRE_COMMIT_HOOK" ]; then
    cat > "$PRE_COMMIT_HOOK" << 'EOF'
#!/bin/bash

# Neural rekursives Debugging - Pre-Commit-Hook
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)/../.."
CLAUDE_SCRIPT="$SCRIPT_DIR/.claude/tools/debug/debug_workflow_engine.js"

# Falls nicht in Claude-Verzeichnis, Standard-Skript verwenden
if [ ! -f "$CLAUDE_SCRIPT" ]; then
  CLAUDE_SCRIPT="$(dirname "$0")/../../scripts/debug_workflow_engine.js"
fi

if [ -f "$CLAUDE_SCRIPT" ]; then
  echo "Neural Pre-Commit-Check läuft..."
  
  # Geänderte Code-Dateien prüfen
  git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(js|py|ts|java|cpp|c)$' | while read -r file; do
    echo "Analysiere $file"
    node "$CLAUDE_SCRIPT" run quick --file "$file" --output json
  done
fi

exit 0
EOF
    chmod +x "$PRE_COMMIT_HOOK"
    print_success "Pre-Commit-Hook installiert"
  fi
  
  # Post-Checkout-Hook für automatische RAG-Aktualisierung
  POST_CHECKOUT_HOOK="$PROJECT_ROOT/.git/hooks/post-checkout"
  if [ ! -f "$POST_CHECKOUT_HOOK" ]; then
    cat > "$POST_CHECKOUT_HOOK" << 'EOF'
#!/bin/bash

# Neural RAG-Aktualisierung - Post-Checkout-Hook
BRANCH=$(git branch --show-current)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)/../.."
VECTOR_UPDATER="$SCRIPT_DIR/.claude/tools/debug/update_vector_db.js"

# Falls nicht in Claude-Verzeichnis, Standard-Skript verwenden
if [ ! -f "$VECTOR_UPDATER" ]; then
  VECTOR_UPDATER="$(dirname "$0")/../../scripts/update_vector_db.js"
fi

if [ -f "$VECTOR_UPDATER" ] && [[ "$BRANCH" == feature/* ]]; then
  echo "Neural RAG-Vektordatenbank wird aktualisiert für Branch $BRANCH..."
  node "$VECTOR_UPDATER" branch "$BRANCH"
fi

exit 0
EOF
    chmod +x "$POST_CHECKOUT_HOOK"
    print_success "Post-Checkout-Hook installiert"
  fi
}

# Commit mit automatischer Analyse
create_commit() {
  if [ -z "$2" ]; then
    print_error "Commit-Nachricht fehlt"
    echo "Verwendung: $0 commit \"<nachricht>\""
    exit 1
  fi
  
  COMMIT_MSG="$2"
  CURRENT_BRANCH=$(git branch --show-current)
  
  # Prüfen, ob auf Feature-Branch
  if [[ ! "$CURRENT_BRANCH" == feature/* ]]; then
    print_warning "Sie befinden sich nicht auf einem Feature-Branch. Möchten Sie fortfahren? (y/n)"
    read -r CONTINUE
    if [ "$CONTINUE" != "y" ]; then
      print_info "Abgebrochen"
      exit 0
    fi
  fi
  
  print_header "Erstelle Commit mit automatischer Analyse"
  
  # Geänderte Dateien abrufen
  CHANGED_FILES=$(git diff --name-only --diff-filter=ACMR)
  CODE_FILES=$(echo "$CHANGED_FILES" | grep -E '\.(js|py|ts|java|cpp|c)$' || true)
  
  # Voranalyse der geänderten Dateien
  if [ -n "$CODE_FILES" ]; then
    print_info "Analysiere geänderte Code-Dateien:"
    
    echo "$CODE_FILES" | while read -r file; do
      if [ -f "$file" ]; then
        print_info "Voranalyse: $file"
        
        # Quick-Check auf rekursive Probleme
        if [ -f "$DEBUG_WORKFLOW" ]; then
          node "$DEBUG_WORKFLOW" run quick --file "$file" --output json || true
        fi
      fi
    done
  fi
  
  # Commit durchführen
  git add .
  git commit -m "$COMMIT_MSG"
  
  BRANCH_CONFIG="$CONFIG_DIR/branches/$CURRENT_BRANCH.json"
  
  # Branch-Konfiguration aktualisieren
  if [ -f "$BRANCH_CONFIG" ]; then
    # Commit zur Branch-Historie hinzufügen
    COMMIT_ID=$(git rev-parse HEAD)
    COMMIT_INFO="{\"id\":\"$COMMIT_ID\",\"message\":\"$COMMIT_MSG\",\"timestamp\":\"$(date +%Y-%m-%d-%H:%M:%S)\"}"
    
    # Mit jq aktualisieren, falls vorhanden
    if command -v jq &> /dev/null; then
      TEMP_FILE=$(mktemp)
      jq --argjson commit "$COMMIT_INFO" '.commits += [$commit]' "$BRANCH_CONFIG" > "$TEMP_FILE"
      mv "$TEMP_FILE" "$BRANCH_CONFIG"
    else
      # Einfache Textersetzung
      sed -i -e "s/\"commits\": \[/\"commits\": \[$COMMIT_INFO,/g" "$BRANCH_CONFIG"
    fi
  fi
  
  # Nachanalyse für tiefergehende Probleme
  if [ -n "$CODE_FILES" ] && [ -f "$DEBUG_WORKFLOW" ]; then
    print_info "Möchten Sie eine tiefergehende Analyse durchführen? (y/n)"
    read -r DEEP_ANALYSIS
    
    if [ "$DEEP_ANALYSIS" = "y" ]; then
      print_header "Führe tiefergehende Analyse durch"
      
      echo "$CODE_FILES" | while read -r file; do
        if [ -f "$file" ]; then
          print_info "Tiefe Analyse: $file"
          node "$DEBUG_WORKFLOW" run deep --file "$file"
        fi
      done
    fi
  fi
  
  update_about_profile
  print_success "Commit erstellt und analysiert"
}

# Komplette Branch-Analyse
analyze_branch() {
  CURRENT_BRANCH=$(git branch --show-current)
  
  print_header "Führe vollständige Branch-Analyse durch"
  
  # Code-Dateien im Branch abrufen
  if [ -n "$CURRENT_BRANCH" ]; then
    # Für alle Code-Dateien im Branch
    CODE_FILES=$(git ls-tree -r HEAD --name-only | grep -E '\.(js|py|ts|java|cpp|c)$' || true)
    
    if [ -n "$CODE_FILES" ]; then
      print_info "Analysiere alle Code-Dateien im Branch $CURRENT_BRANCH:"
      
      echo "$CODE_FILES" | while read -r file; do
        if [ -f "$file" ]; then
          print_info "Analysiere: $file"
          
          # Rekursive Muster suchen
          RECURSIVE_PATTERN=$(grep -l -E '(function\s+\w+\s*\([^)]*\)\s*\{.*\1\s*\()|(def\s+\w+\s*\([^)]*\).*\1\s*\()' "$file" || true)
          
          if [ -n "$RECURSIVE_PATTERN" ]; then
            print_warning "Rekursive Funktion in $file gefunden"
            
            # Tiefe Analyse für rekursive Funktionen
            if [ -f "$DEBUG_WORKFLOW" ]; then
              node "$DEBUG_WORKFLOW" run deep --file "$file"
            fi
          else
            # Standard-Analyse für nicht-rekursive Funktionen
            if [ -f "$DEBUG_WORKFLOW" ]; then
              node "$DEBUG_WORKFLOW" run quick --file "$file" --output json || true
            fi
          fi
          
          # Datei zu analysierten Dateien hinzufügen
          BRANCH_CONFIG="$CONFIG_DIR/branches/$CURRENT_BRANCH.json"
          if [ -f "$BRANCH_CONFIG" ]; then
            if command -v jq &> /dev/null; then
              TEMP_FILE=$(mktemp)
              jq --arg file "$file" '.analyzed_files += [$file] | .analyzed_files = (.analyzed_files | unique)' "$BRANCH_CONFIG" > "$TEMP_FILE"
              mv "$TEMP_FILE" "$BRANCH_CONFIG"
            fi
          fi
        fi
      done
      
      print_success "Branch-Analyse abgeschlossen"
    else
      print_warning "Keine Code-Dateien im Branch gefunden"
    fi
  else
    print_error "Kein Branch ausgewählt"
    exit 1
  fi
}

# Feature-Branch abschließen
complete_feature() {
  CURRENT_BRANCH=$(git branch --show-current)
  TARGET_BRANCH="${2:-main}"
  
  # Prüfen, ob auf Feature-Branch
  if [[ ! "$CURRENT_BRANCH" == feature/* ]]; then
    print_error "Sie befinden sich nicht auf einem Feature-Branch"
    exit 1
  fi
  
  print_header "Schließe Feature $CURRENT_BRANCH ab"
  
  # Finale Analyse durchführen
  print_info "Führe finale Analyse durch..."
  analyze_branch
  
  # Abschließen-Status setzen
  BRANCH_CONFIG="$CONFIG_DIR/branches/$CURRENT_BRANCH.json"
  if [ -f "$BRANCH_CONFIG" ]; then
    if command -v jq &> /dev/null; then
      TEMP_FILE=$(mktemp)
      jq '.status = "completed" | .completed = "'$(date +%Y-%m-%d-%H:%M:%S)'"' "$BRANCH_CONFIG" > "$TEMP_FILE"
      mv "$TEMP_FILE" "$BRANCH_CONFIG"
    else
      sed -i -e 's/"status": "active"/"status": "completed"/g' "$BRANCH_CONFIG"
    fi
    print_success "Branch als abgeschlossen markiert"
  fi
  
  # Pull Request erstellen (hier nur Anweisung)
  print_info "Führen Sie die folgenden Befehle aus, um Änderungen zu pushen und einen Pull Request zu erstellen:"
  echo -e "${PURPLE}git push -u origin $CURRENT_BRANCH${NC}"
  echo -e "${PURPLE}# Dann erstellen Sie einen Pull Request auf GitHub/GitLab/etc.${NC}"
  
  # Merge lokal (optional)
  print_info "Möchten Sie lokal in $TARGET_BRANCH mergen? (y/n)"
  read -r DO_MERGE
  
  if [ "$DO_MERGE" = "y" ]; then
    git checkout "$TARGET_BRANCH"
    git pull origin "$TARGET_BRANCH" || true
    git merge --no-ff "$CURRENT_BRANCH" -m "Merge feature: $CURRENT_BRANCH"
    print_success "Feature in $TARGET_BRANCH gemerged"
    
    print_info "Möchten Sie den Feature-Branch löschen? (y/n)"
    read -r DELETE_BRANCH
    
    if [ "$DELETE_BRANCH" = "y" ]; then
      git branch -d "$CURRENT_BRANCH"
      print_success "Feature-Branch gelöscht"
    fi
  fi
  
  update_about_profile
  print_success "Feature abgeschlossen"
}

# Hauptlogik
case "$1" in
  create)
    create_feature "$@"
    ;;
  commit)
    create_commit "$@"
    ;;
  analyze)
    analyze_branch
    ;;
  complete)
    complete_feature "$@"
    ;;
  *)
    print_header "Neural Git Feature Manager"
    echo "Verwendung:"
    echo "  $0 create <feature-name> [basis-branch]  - Erstellt neuen Feature-Branch"
    echo "  $0 commit \"<nachricht>\"                  - Commit mit automatischer Analyse"
    echo "  $0 analyze                               - Führt vollständige Branch-Analyse durch"
    echo "  $0 complete [zielbranch]                 - Schließt Feature ab und merged optional"
    ;;
esac
