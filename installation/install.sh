#!/bin/bash

# ================================================
# Claude Neural Framework - Installation Script
# Version: 2.0.0
# Date: 2025-05-11
# ================================================

# Strikte Error-Handling-Modi aktivieren
set -e  # Exit bei Fehlern
set -u  # Fehler bei Verwendung undefinierter Variablen
set -o pipefail  # Fehler in Pipes propagieren

# Konfigurationsvariablen
FRAMEWORK_NAME="Claude Neural Framework"
CONFIG_DIR="$HOME/.claude"
ANTHROPIC_API_URL="https://api.anthropic.com"
DEFAULT_NODE_VERSION="20"
DEFAULT_PYTHON_VERSION="3.10"
LOG_FILE="$(pwd)/installation_log_$(date +%Y%m%d_%H%M%S).log"
DEFAULT_MCP_KEY="YOUR_MCP_API_KEY_HERE"

# Farbcodes für Ausgabeformatierung
RESET='\033[0m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[0;37m'
BOLD='\033[1m'

# Gemeinsame Funktionen
log() {
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "[${timestamp}] $1" | tee -a "$LOG_FILE"
}

header() {
  echo -e "\n${BLUE}${BOLD}=== $1 ===${RESET}"
  log "HEADER: $1"
}

success() {
  echo -e "${GREEN}✓ $1${RESET}"
  log "SUCCESS: $1"
}

info() {
  echo -e "${CYAN}ℹ $1${RESET}"
  log "INFO: $1"
}

warning() {
  echo -e "${YELLOW}⚠ $1${RESET}"
  log "WARNING: $1"
}

error() {
  echo -e "${RED}✗ $1${RESET}" >&2
  log "ERROR: $1"
  return 1
}

fatal() {
  echo -e "${RED}${BOLD}✗ FATAL: $1${RESET}" >&2
  log "FATAL: $1"
  exit 1
}

prompt_yes_no() {
  local prompt="$1"
  local default="${2:-n}"
  
  local options="y/N"
  if [[ "$default" == "y" ]]; then
    options="Y/n"
  fi
  
  read -p "$prompt [$options]: " response
  response="${response:-$default}"
  
  if [[ "$response" =~ ^[Yy] ]]; then
    return 0
  else
    return 1
  fi
}

command_exists() {
  command -v "$1" &> /dev/null
}

create_backup() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local backup="${file}.backup.$(date +%Y%m%d%H%M%S)"
    cp "$file" "$backup"
    success "Backup erstellt: $backup"
  fi
}

# Überprüfe Systemanforderungen
check_system_requirements() {
  header "Systemanforderungen werden überprüft"
  
  # Überprüfe nicht als Root
  if [[ $EUID -eq 0 ]]; then
    fatal "Dieses Skript sollte nicht als Root ausgeführt werden. Bitte als normaler Benutzer ausführen."
  fi
  
  # Überprüfe Linux/macOS
  case "$(uname -s)" in
    Linux*)  
      info "Linux-System erkannt: $(lsb_release -ds 2>/dev/null || cat /etc/*release 2>/dev/null | head -n1 || uname -om)"
      ;;
    Darwin*) 
      info "macOS-System erkannt: $(sw_vers -productVersion)"
      ;;
    *)
      warning "Nicht unterstütztes Betriebssystem: $(uname -s). Die Installation wird fortgesetzt, aber es könnten Probleme auftreten."
      ;;
  esac
  
  # Benötigter Speicherplatz
  local free_space=$(df -h . | awk 'NR==2 {print $4}')
  info "Verfügbarer Speicherplatz: $free_space"
  
  # CPU Info
  local cpu_info=$(grep -m 1 "model name" /proc/cpuinfo 2>/dev/null || sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Unbekannt")
  info "CPU: $cpu_info"
  
  # RAM Info
  local ram_info
  if [[ "$(uname -s)" == "Linux" ]]; then
    ram_info="$(free -h | awk '/^Mem:/ {print $2}')"
  else
    ram_info="$(sysctl -n hw.memsize 2>/dev/null | awk '{print $0/1024/1024/1024 " GB"}')" 
  fi
  info "RAM: $ram_info"
  
  success "Systemanforderungen überprüft"
}

# Installiere Abhängigkeiten
install_dependencies() {
  header "Abhängigkeiten werden installiert"
  
  local missing_deps=()
  local essential_deps=("curl" "git" "node" "npm" "python3" "pip3")
  
  info "Überprüfe essentielle Abhängigkeiten..."
  
  for cmd in "${essential_deps[@]}"; do
    if ! command_exists "$cmd"; then
      missing_deps+=("$cmd")
    fi
  done
  
  if [[ ${#missing_deps[@]} -gt 0 ]]; then
    warning "Folgende Abhängigkeiten fehlen: ${missing_deps[*]}"
    
    if prompt_yes_no "Möchten Sie die fehlenden Abhängigkeiten automatisch installieren?" "y"; then
      if command_exists apt-get; then
        info "Verwende apt-get für die Installation..."
        sudo apt-get update
        sudo apt-get install -y curl git python3 python3-pip
        if ! command_exists node || ! command_exists npm; then
          curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
          sudo apt-get install -y nodejs
        fi
      elif command_exists dnf; then
        info "Verwende dnf für die Installation..."
        sudo dnf install -y curl git python3 python3-pip
        if ! command_exists node || ! command_exists npm; then
          sudo dnf install -y nodejs npm
        fi
      elif command_exists brew; then
        info "Verwende Homebrew für die Installation..."
        brew install curl git python3 node npm
      else
        error "Konnte keinen unterstützten Paketmanager finden. Bitte installieren Sie die fehlenden Abhängigkeiten manuell."
        if prompt_yes_no "Möchten Sie die Installation trotzdem fortsetzen?" "n"; then
          warning "Installation wird fortgesetzt, könnte aber fehlschlagen."
        else
          fatal "Installation abgebrochen."
        fi
      fi
    else
      fatal "Bitte installieren Sie die fehlenden Abhängigkeiten manuell und starten Sie die Installation erneut."
    fi
  else
    success "Alle essentiellen Abhängigkeiten sind installiert."
  fi
  
  # Überprüfe Versionen
  local node_version=$(node -v | cut -d 'v' -f 2)
  local npm_version=$(npm -v)
  local python_version=$(python3 --version 2>&1 | cut -d ' ' -f 2)
  local git_version=$(git --version | cut -d ' ' -f 3)
  
  info "Node.js Version: $node_version"
  info "NPM Version: $npm_version"
  info "Python Version: $python_version"
  info "Git Version: $git_version"
  
  # Node.js Version überprüfen
  if [[ $(echo "$node_version" | cut -d '.' -f 1) -lt 18 ]]; then
    warning "Node.js Version ist älter als 18. Empfohlen ist Version 18 oder höher."
    if prompt_yes_no "Möchten Sie Node.js auf Version $DEFAULT_NODE_VERSION aktualisieren?" "y"; then
      install_nodejs
    else
      warning "Die Installation wird mit einer älteren Node.js-Version fortgesetzt. Es könnten Kompatibilitätsprobleme auftreten."
    fi
  fi
  
  # Python Version überprüfen
  local python_major=$(echo "$python_version" | cut -d '.' -f 1)
  local python_minor=$(echo "$python_version" | cut -d '.' -f 2)
  if [[ $python_major -lt 3 || ($python_major -eq 3 && $python_minor -lt 8) ]]; then
    warning "Python Version ist älter als 3.8. Empfohlen ist Version 3.8 oder höher."
    warning "Die Installation wird mit der vorhandenen Python-Version fortgesetzt. Es könnten Kompatibilitätsprobleme auftreten."
  fi
  
  # Installiere globale NPM-Pakete
  info "Installiere benötigte globale NPM-Pakete..."
  npm install -g @smithery/cli @modelcontextprotocol/server-sequential-thinking typescript ts-node
  
  success "Abhängigkeiten erfolgreich installiert und konfiguriert"
}

# Installiere Node.js über NVM
install_nodejs() {
  info "Node.js wird über NVM installiert..."
  
  # Installiere NVM, wenn nicht vorhanden
  if ! command_exists nvm; then
    if [[ ! -d "$HOME/.nvm" ]]; then
      info "Installiere NVM..."
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
      
      export NVM_DIR="$HOME/.nvm"
      [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
      [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
    else
      export NVM_DIR="$HOME/.nvm"
      [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi
  fi
  
  # Überprüfe erneut, ob NVM verfügbar ist
  if ! command_exists nvm; then
    error "NVM konnte nicht installiert werden. Bitte installieren Sie es manuell: https://github.com/nvm-sh/nvm"
    return 1
  fi
  
  # Installiere und verwende Node.js LTS
  info "Installiere Node.js $DEFAULT_NODE_VERSION..."
  nvm install "$DEFAULT_NODE_VERSION"
  nvm use "$DEFAULT_NODE_VERSION"
  nvm alias default "$DEFAULT_NODE_VERSION"
  
  # Überprüfe die Installation
  if command_exists node && command_exists npm; then
    success "Node.js $(node -v) und NPM $(npm -v) erfolgreich installiert"
  else
    error "Fehler bei der Node.js-Installation"
    return 1
  fi
}

# Konfiguriere Python-Umgebung
setup_python_environment() {
  header "Python-Umgebung wird konfiguriert"
  
  # Erstelle virtuelle Umgebung
  if [[ ! -d "venv" ]]; then
    info "Erstelle virtuelle Python-Umgebung..."
    python3 -m venv venv
  else
    info "Virtuelle Umgebung existiert bereits."
  fi
  
  # Aktiviere virtuelle Umgebung
  info "Aktiviere virtuelle Umgebung..."
  source venv/bin/activate
  
  # Aktualisiere pip
  info "Aktualisiere pip..."
  pip install --upgrade pip
  
  # Installiere Abhängigkeiten
  info "Installiere Python-Abhängigkeiten..."
  if [[ -f "requirements.txt" ]]; then
    pip install -r requirements.txt
  else
    info "Keine requirements.txt gefunden, installiere Standardabhängigkeiten..."
    pip install requests numpy pandas matplotlib
    
    # Erstelle requirements.txt
    pip freeze > requirements.txt
    success "requirements.txt erstellt"
  fi
  
  # Deaktiviere virtuelle Umgebung
  deactivate
  
  success "Python-Umgebung erfolgreich konfiguriert"
}

# Erstelle Framework-Verzeichnisstruktur
create_framework_structure() {
  header "Framework-Struktur wird erstellt"
  
  local dirs=(
    "core"
    "core/config"
    "core/mcp"
    "cognitive"
    "cognitive/prompts"
    "cognitive/prompts/classification"
    "cognitive/prompts/generation"
    "cognitive/prompts/coding"
    "cognitive/templates"
    "docs"
    "docs/guides"
    "docs/api"
    "docs/examples"
    "agents"
    "agents/commands"
    "tools"
    "installation"
  )
  
  for dir in "${dirs[@]}"; do
    if [[ ! -d "$dir" ]]; then
      mkdir -p "$dir"
      info "Verzeichnis erstellt: $dir"
    fi
  done
  
  # Sichere alte Strukturen, falls vorhanden
  local legacy_dirs=("ai_docs" "specs" ".claude")
  for dir in "${legacy_dirs[@]}"; do
    if [[ -d "$dir" ]]; then
      if prompt_yes_no "Legacy-Verzeichnis '$dir' gefunden. Möchten Sie eine Kopie der Inhalte in die neue Struktur migrieren?" "y"; then
        case "$dir" in
          "ai_docs")
            # ai_docs → cognitive
            if [[ -d "$dir/prompts" ]]; then
              cp -r "$dir/prompts/"* "cognitive/prompts/" 2>/dev/null || true
            fi
            if [[ -d "$dir/templates" ]]; then
              cp -r "$dir/templates/"* "cognitive/templates/" 2>/dev/null || true
            fi
            if [[ -d "$dir/examples" ]]; then
              cp -r "$dir/examples/"* "docs/examples/" 2>/dev/null || true
            fi
            ;;
          "specs")
            # specs → docs/api
            if [[ -d "$dir/openapi" ]]; then
              cp -r "$dir/openapi/"* "docs/api/" 2>/dev/null || true
            fi
            if [[ -d "$dir/schemas" ]]; then
              cp -r "$dir/schemas/"* "core/config/" 2>/dev/null || true
            fi
            ;;
          ".claude")
            # .claude → agents/commands
            if [[ -d "$dir/commands" ]]; then
              cp -r "$dir/commands/"* "agents/commands/" 2>/dev/null || true
            fi
            # .claude/CLAUDE.md → cognitive/core_framework.md
            if [[ -f "$dir/CLAUDE.md" ]]; then
              cp "$dir/CLAUDE.md" "cognitive/core_framework.md" 2>/dev/null || true
            fi
            ;;
        esac
        success "Inhalte von '$dir' migriert"
      fi
    fi
  done
  
  success "Framework-Struktur erfolgreich erstellt"
}

# Konfiguriere Claude-Integration
configure_claude_integration() {
  header "Claude-Integration wird konfiguriert"
  
  # Erstelle .claude-Verzeichnis im Home-Verzeichnis
  if [[ ! -d "$CONFIG_DIR" ]]; then
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$CONFIG_DIR/logs"
    info "Verzeichnisse erstellt: $CONFIG_DIR und $CONFIG_DIR/logs"
  fi
  
  # Erstelle Konfigurationsdatei
  if [[ ! -f "$CONFIG_DIR/config.json" ]]; then
    cat > "$CONFIG_DIR/config.json" << EOF
{
  "version": "1.0.0",
  "api": {
    "provider": "anthropic",
    "model": "claude-3-7-sonnet-20250219",
    "temperature": 0.7,
    "max_tokens": 4096
  },
  "defaults": {
    "system_prompt_path": "~/claude-code/cognitive/core_framework.md",
    "working_directory": "~/claude-code"
  },
  "paths": {
    "projects": "~/claude-code",
    "templates": "~/claude-code/cognitive/templates",
    "prompts": "~/claude-code/cognitive/prompts",
    "output": "~/output"
  },
  "commands": {
    "directory": "~/claude-code/agents/commands"
  },
  "extensions": {
    "enabled": true,
    "allowed": ["*.md", "*.txt", "*.json", "*.yaml", "*.js", "*.ts", "*.py"]
  },
  "mcp": {
    "config_path": "~/claude-code/core/mcp/server_config.json",
    "auto_start": true,
    "default_servers": [
      "sequentialthinking",
      "context7-mcp",
      "desktop-commander",
      "brave-search",
      "think-mcp-server"
    ]
  },
  "security": {
    "execution_confirmation": true,
    "file_write_confirmation": true,
    "allowed_directories": ["~/claude-code", "~/.claude"],
    "blocked_commands": ["rm -rf /", "sudo", "chmod 777"]
  },
  "ui": {
    "theme": "dark",
    "code_highlighting": true,
    "xml_tag_highlighting": true,
    "show_token_count": true
  },
  "logging": {
    "enabled": true,
    "level": "info",
    "path": "~/.claude/logs"
  }
}
EOF
    success "Konfigurationsdatei erstellt: $CONFIG_DIR/config.json"
  else
    info "Konfigurationsdatei existiert bereits."

    if prompt_yes_no "Möchten Sie die bestehende Konfigurationsdatei aktualisieren?" "n"; then
      create_backup "$CONFIG_DIR/config.json"
      # Hier könnten Sie die Datei aktualisieren, z.B. mit jq
      warning "Funktion zur Aktualisierung der Konfigurationsdatei noch nicht implementiert."
    fi
  fi
  
  # Erstelle Link zu core_framework.md
  if [[ -f "cognitive/core_framework.md" ]]; then
    if [[ ! -f "$CONFIG_DIR/CLAUDE.md" ]]; then
      ln -sf "$(pwd)/cognitive/core_framework.md" "$CONFIG_DIR/CLAUDE.md"
      success "Link zu core_framework.md erstellt"
    else
      if ! cmp -s "$(pwd)/cognitive/core_framework.md" "$CONFIG_DIR/CLAUDE.md"; then
        warning "CLAUDE.md existiert bereits im Home-Verzeichnis und unterscheidet sich vom aktuellen Framework."
        if prompt_yes_no "Möchten Sie die Datei ersetzen?" "n"; then
          create_backup "$CONFIG_DIR/CLAUDE.md"
          ln -sf "$(pwd)/cognitive/core_framework.md" "$CONFIG_DIR/CLAUDE.md"
          success "CLAUDE.md im Home-Verzeichnis ersetzt"
        fi
      else
        info "CLAUDE.md ist bereits mit dem aktuellen Framework synchronisiert."
      fi
    fi
  else
    warning "cognitive/core_framework.md nicht gefunden. Link konnte nicht erstellt werden."
  fi
  
  success "Claude-Integration erfolgreich konfiguriert"
}

# Konfiguriere MCP-Server
configure_mcp_servers() {
  header "MCP-Server werden konfiguriert"
  
  if [[ -f "core/mcp/server_config.json" ]]; then
    info "MCP-Server-Konfiguration existiert bereits."
  else
    warning "MCP-Server-Konfiguration nicht gefunden."
    
    # Erstelle Server-Konfiguration
    info "Erstelle neue MCP-Server-Konfiguration..."
    cat > "core/mcp/server_config.json" << EOF
{
  "version": "1.1.0",
  "last_updated": "$(date +%Y-%m-%d)",
  "environment": "development",
  "api_key_notice": "API-Schlüssel sollten in einer .env-Datei oder in Umgebungsvariablen gespeichert werden",
  "mcpServers": {
    "core": {
      "desktop-commander": {
        "description": "Dateisystem und Shell-Integration",
        "command": "npx",
        "args": [
          "-y",
          "@smithery/cli@latest",
          "run",
          "@wonderwhy-er/desktop-commander",
          "--key",
          "${MCP_API_KEY}"
        ],
        "autostart": true
      },
      "sequentialthinking": {
        "description": "Rekursive Gedankengenerierung",
        "command": "npx",
        "args": [
          "-y",
          "@modelcontextprotocol/server-sequential-thinking"
        ],
        "autostart": true
      },
      "context7-mcp": {
        "description": "Kontextuelles Bewusstseinsframework",
        "command": "npx",
        "args": [
          "-y",
          "@smithery/cli@latest",
          "run",
          "@upstash/context7-mcp",
          "--key",
          "${MCP_API_KEY}"
        ],
        "autostart": true
      }
    }
  },
  "environmentVariables": {
    "MCP_API_KEY": "$DEFAULT_MCP_KEY"
  }
}
EOF
    success "MCP-Server-Konfiguration erstellt: core/mcp/server_config.json"
  fi
  
  # Installiere MCP-Server-Abhängigkeiten
  info "Installiere MCP-Server-Abhängigkeiten..."
  npm install -g @modelcontextprotocol/server-sequential-thinking
  
  # Erstelle MCP-Setup-Skript ausführbar
  if [[ -f "core/mcp/setup_mcp.js" ]]; then
    chmod +x "core/mcp/setup_mcp.js"
    success "MCP-Setup-Skript ausführbar gemacht"
  fi
  
  # Anbindung der MCP-Konfiguration
  if ! grep -q "MCP_API_KEY" "$HOME/.bashrc" && ! grep -q "MCP_API_KEY" "$HOME/.zshrc"; then
    if prompt_yes_no "Möchten Sie die MCP-API-Key-Umgebungsvariable zu Ihrer Shell-Konfiguration hinzufügen?" "y"; then
      local shell_config
      if [[ -f "$HOME/.zshrc" ]]; then
        shell_config="$HOME/.zshrc"
      else
        shell_config="$HOME/.bashrc"
      fi
      
      echo -e "\n# Claude Neural Framework MCP API Key" >> "$shell_config"
      echo 'export MCP_API_KEY="YOUR_API_KEY_HERE"' >> "$shell_config"
      success "MCP-API-Key-Variable zu $shell_config hinzugefügt. Bitte setzen Sie Ihren API-Key."
    fi
  else
    info "MCP-API-Key-Variable scheint bereits in Ihrer Shell-Konfiguration zu existieren."
  fi
  
  success "MCP-Server erfolgreich konfiguriert"
}

# Dokumentation und README erstellen
create_documentation() {
  header "Projektdokumentation wird erstellt"
  
  # Erstelle README.md
  cat > "README.md" << EOF
# Claude Neural Framework

> Eine umfassende Entwicklungsumgebung für KI-gestützte Anwendungen und Agent-Systeme

## Übersicht

Das Claude Neural Framework ist eine leistungsstarke Plattform für die Integration von Claude's neurokognitiven Fähigkeiten in Entwicklungs-Workflows. Es bietet eine standardisierte Struktur für KI-Dokumentation, Prompt-Engineering, Agent-Kommunikation und Entwicklungsumgebungen.

## Funktionen

- **Kognitives Framework**: Fortschrittliche KI-Integration mit Entwickler-Workflow
- **MCP-Server-Integration**: Unterstützung für Model Context Protocol Server
- **Agentenarchitektur**: Strukturierte Agent-zu-Agent-Kommunikation
- **Cognitive Prompting**: Umfangreiche Prompt-Bibliothek für verschiedene Anwendungsfälle
- **Entwicklungsumgebung**: Optimierte Tools für KI-gestützte Entwicklung

## Installation

\`\`\`bash
# Repository klonen
git clone https://github.com/username/claude-code.git
cd claude-code

# Installation ausführen
./installation/install.sh
\`\`\`

## Dokumentation

Die vollständige Dokumentation finden Sie im \`docs\`-Verzeichnis:

- [Einführung](docs/guides/introduction.md)
- [Architektur](docs/guides/architecture.md)
- [MCP-Integration](docs/guides/mcp-integration.md)
- [Cognitive Prompting](docs/guides/cognitive-prompting.md)
- [Agent-Kommunikation](docs/guides/agent-communication.md)

## Erste Schritte

Nach der Installation können Sie sofort mit der Nutzung des Frameworks beginnen:

\`\`\`bash
# MCP-Server starten
npx claude mcp start

# Claude Code CLI starten
npx claude
\`\`\`

## Mitwirkung

Beiträge zum Projekt sind willkommen! Weitere Informationen finden Sie in [CONTRIBUTING.md](CONTRIBUTING.md).

## Lizenz

Dieses Projekt steht unter der MIT-Lizenz - siehe [LICENSE.md](LICENSE.md) für Details.
EOF
  
  success "README.md erstellt"
  
  # Erstelle weitere Dokumentation
  mkdir -p "docs/guides"
  
  cat > "docs/guides/introduction.md" << EOF
# Einführung in das Claude Neural Framework

Das Claude Neural Framework ist eine fortschrittliche Plattform für die Integration von Claude's KI-Fähigkeiten in Entwicklungs-Workflows. Es wurde entwickelt, um die Entwicklung von KI-gestützten Anwendungen zu beschleunigen und zu standardisieren.

## Was ist das Claude Neural Framework?

Das Framework bietet eine umfassende Infrastruktur für:

- KI-gestützte Softwareentwicklung
- Prompt-Engineering und -Management
- Agent-zu-Agent-Kommunikation
- Integration mit Model Context Protocol (MCP)
- Kognitive Analyse von Code und Daten

## Architektur

Das Framework folgt einem verteilten Kognitionsmodell mit fünf Hauptkomponenten:

1. **Claude Neural Core**: Primäre semantische Verarbeitung und Mustererkennung
2. **MCP Server Konstellation**: Spezialisierte kognitive Module für erweiterte Funktionen
3. **Entwickler-Interface**: Bidirektionale menschliche Interaktion
4. **System-Substrate**: Technische Ausführungsumgebung
5. **Code-Repository**: Versionierter Persistenzspeicher

Diese Komponenten arbeiten zusammen, um eine leistungsfähige Entwicklungsumgebung für KI-Anwendungen zu schaffen.

## Verzeichnisstruktur

Das Framework ist in folgende Hauptverzeichnisse unterteilt:

- \`/core\`: Kernfunktionalität und Konfiguration
- \`/cognitive\`: Prompts, Templates und kognitive Modelle
- \`/agents\`: Agent-zu-Agent-Kommunikationsframework
- \`/docs\`: Dokumentation und Beispiele
- \`/tools\`: Hilfsprogramme und Werkzeuge
- \`/installation\`: Installationsskripte und -anleitungen

## Nächste Schritte

- [Architektur](architecture.md) - Detaillierte Beschreibung der Framework-Architektur
- [MCP-Integration](mcp-integration.md) - Integration mit Model Context Protocol
- [Cognitive Prompting](cognitive-prompting.md) - Grundlagen des Prompt-Engineerings
- [Agent-Kommunikation](agent-communication.md) - Agent-zu-Agent-Kommunikationsframework
EOF
  
  success "Einführungsdokumentation erstellt"
  
  cat > "docs/guides/architecture.md" << EOF
# Architektur des Claude Neural Framework

Das Claude Neural Framework basiert auf einem verteilten Kognitionsmodell, das verschiedene Komponenten zu einem leistungsfähigen Ganzen verbindet. Dieses Dokument beschreibt die Architektur und das Zusammenspiel der Komponenten.

## Kognitive Architektur

Die kognitive Architektur des Frameworks besteht aus fünf Hauptkomponenten:

1. **Claude Neural Core**: Der zentrale Verarbeitungskern, der für die semantische Analyse und Mustererkennung zuständig ist. Er integriert die Anthropic Claude API und stellt die primäre KI-Funktionalität bereit.

2. **MCP Server Konstellation**: Ein Netzwerk spezialisierter Server, die über das Model Context Protocol verbunden sind und erweiterte Funktionen bereitstellen, wie:
   - Sequentielles Denken
   - Kontextbewusstsein
   - Externe Wissensakquisition
   - Meta-kognitiver Reflexion

3. **Entwickler-Interface**: Die Schnittstelle zwischen dem menschlichen Entwickler und dem Framework, bestehend aus:
   - Command Line Interface (CLI)
   - Visuelle Werkzeuge und Dashboards
   - Integration mit IDEs wie VS Code

4. **System-Substrate**: Die technische Infrastruktur, auf der das Framework läuft:
   - Betriebssystem (Linux, macOS)
   - Laufzeitumgebungen (Node.js, Python)
   - Containerisierung (Docker)
   - Versionskontrolle (Git)

5. **Code-Repository**: Der persistente Speicher für Code und Konfiguration:
   - Versionierte Codebasis
   - Prompt-Bibliothek
   - Agent-Definitionen
   - Framework-Konfiguration

## Datenfluss und Interaktion

Der Datenfluss im Framework folgt einem zyklischen Muster:

1. Der Entwickler interagiert mit dem Framework über das Entwickler-Interface
2. Die Anfragen werden an den Claude Neural Core weitergeleitet
3. Der Core aktiviert bei Bedarf spezialisierte MCP-Server
4. Die Ergebnisse werden verarbeitet und zurück an das Interface gesendet
5. Der Entwickler erhält die Antwort und kann den Zyklus fortsetzen

## Verzeichnisstruktur und Komponenten

Die Verzeichnisstruktur des Frameworks spiegelt die kognitive Architektur wider:

- \`/core\`: Claude Neural Core und grundlegende Konfiguration
  - \`/config\`: Konfigurationsdateien
  - \`/mcp\`: MCP-Server-Integration

- \`/cognitive\`: Kognitive Komponenten
  - \`/prompts\`: Prompt-Bibliothek nach Kategorien
  - \`/templates\`: Wiederverwendbare Vorlagen

- \`/agents\`: Agent-zu-Agent-Kommunikationsframework
  - \`/commands\`: Benutzerdefinierte Befehle für Agenten

- \`/docs\`: Dokumentation und Beispiele
  - \`/guides\`: Anleitungen und Tutorials
  - \`/api\`: API-Spezifikationen
  - \`/examples\`: Beispielanwendungen

- \`/tools\`: Hilfsprogramme und Werkzeuge

- \`/installation\`: Installationsskripte und -anleitungen

## Integration mit externen Systemen

Das Framework integriert sich nahtlos mit externen Systemen:

- **Anthropic Claude API**: Primäre KI-Funktionalität
- **GitHub/GitLab**: Versionskontrolle und Zusammenarbeit
- **VS Code Extensions**: IDE-Integration
- **Docker**: Containerisierung und Deployment
- **CI/CD-Systeme**: Automatisierte Tests und Deployment

## Erweiterbarkeit

Das Framework ist auf Erweiterbarkeit ausgelegt:

- Neue MCP-Server können einfach hinzugefügt werden
- Die Prompt-Bibliothek kann um neue Kategorien erweitert werden
- Spezialisierte Agenten können für bestimmte Domänen entwickelt werden
- Benutzerdefinierte Befehle können für spezifische Anwendungsfälle erstellt werden
EOF
  
  success "Architektur-Dokumentation erstellt"
  
  # TODO: Weitere Dokumentationen erstellen
  
  success "Projektdokumentation erfolgreich erstellt"
}

# Abschließende Schritte
finalize_installation() {
  header "Installation wird abgeschlossen"
  
  # Erstelle Symlinks
  if prompt_yes_no "Möchten Sie Symlinks für Claude-Tools im PATH erstellen?" "y"; then
    # Erstelle Skript für claude-cli
    mkdir -p "$HOME/bin" 2>/dev/null
    
    cat > "$HOME/bin/claude" << 'EOF'
#!/bin/bash
npx @smithery/cli "$@"
EOF
    chmod +x "$HOME/bin/claude"
    
    # Erstelle Skript für claude-mcp
    cat > "$HOME/bin/claude-mcp" << 'EOF'
#!/bin/bash
cd ~/claude-code && node core/mcp/setup_mcp.js "$@"
EOF
    chmod +x "$HOME/bin/claude-mcp"
    
    # Füge ~/bin zum PATH hinzu, wenn noch nicht vorhanden
    if ! echo $PATH | grep -q "$HOME/bin"; then
      if prompt_yes_no "$HOME/bin ist nicht im PATH. Möchten Sie es hinzufügen?" "y"; then
        local shell_config
        if [[ -f "$HOME/.zshrc" ]]; then
          shell_config="$HOME/.zshrc"
        else
          shell_config="$HOME/.bashrc"
        fi
        
        echo -e "\n# Claude Neural Framework CLI" >> "$shell_config"
        echo 'export PATH="$HOME/bin:$PATH"' >> "$shell_config"
        success "$HOME/bin zum PATH hinzugefügt in $shell_config"
      fi
    fi
    
    success "Symlinks für Claude-Tools erstellt"
  fi
  
  # Erstelle Log-Zusammenfassung
  info "Zusammenfassung der Installation wird erstellt..."
  
  # Generiere abschließende Informationen
  local finish_time=$(date '+%Y-%m-%d %H:%M:%S')
  local duration=$SECONDS
  local duration_formatted=$(printf '%dh:%dm:%ds' $(($duration/3600)) $(($duration%3600/60)) $(($duration%60)))
  
  cat >> "$LOG_FILE" << EOF

=====================================
INSTALLATION ZUSAMMENFASSUNG
=====================================
Start-Zeit: $install_start_time
End-Zeit: $finish_time
Dauer: $duration_formatted
Installationsverzeichnis: $(pwd)
System: $(uname -srm)
Node.js: $(node -v)
NPM: $(npm -v)
Python: $(python3 --version)
Git: $(git --version)
=====================================
EOF
  
  # Benutzer-Farbschema einrichten
  echo "=== Benutzer-Farbschema wird eingerichtet ==="
  # Farbschema-Verzeichnis erstellen
  mkdir -p ~/.claude

  # Symbolischen Link zum Farbschema-Manager erstellen
  ln -sf $(pwd)/core/mcp/color_schema_manager.js ~/.claude/

  success "Installation des Claude Neural Framework abgeschlossen!"

  cat << EOF

${GREEN}${BOLD}====================================================${RESET}
${GREEN}${BOLD}   Claude Neural Framework Installation Komplett   ${RESET}
${GREEN}${BOLD}====================================================${RESET}

${CYAN}NÄCHSTE SCHRITTE:${RESET}

1. Setzen Sie Ihren Anthropic API-Key in ${BOLD}~/.claude/config.json${RESET}
2. Setzen Sie Ihren MCP API-Key:
   ${BOLD}export MCP_API_KEY="Ihr_API_Key"${RESET}
3. Starten Sie die Framework-Komponenten:
   ${BOLD}cd $(pwd)
   node core/mcp/setup_mcp.js autostart${RESET}
4. Richten Sie Ihr Farbschema ein:
   ${BOLD}node scripts/setup/setup_user_colorschema.js${RESET}
5. Starten Sie die Claude Code CLI:
   ${BOLD}npx claude${RESET}

${BLUE}DOKUMENTATION:${RESET}
- Vollständige Dokumentation finden Sie im ${BOLD}docs/${RESET} Verzeichnis
- Erste Schritte: ${BOLD}docs/guides/introduction.md${RESET}

${YELLOW}HINWEIS:${RESET}
- Installationsprotokoll wurde gespeichert in: ${BOLD}$LOG_FILE${RESET}
- Wenn Sie Probleme haben, besuchen Sie die Support-Seite oder erstellen Sie ein Issue im Repository.

${GREEN}${BOLD}====================================================${RESET}

EOF
}

# Hauptfunktion
main() {
  # Installationsstart erfassen
  install_start_time=$(date '+%Y-%m-%d %H:%M:%S')
  SECONDS=0
  
  # Log-Datei initialisieren
  echo "=== Claude Neural Framework Installation Log ===" > "$LOG_FILE"
  echo "Start: $install_start_time" >> "$LOG_FILE"
  echo "Installationsverzeichnis: $(pwd)" >> "$LOG_FILE"
  echo "=======================================" >> "$LOG_FILE"
  
  # Willkommensnachricht
  echo -e "${BLUE}${BOLD}=============================================${RESET}"
  echo -e "${BLUE}${BOLD}    Claude Neural Framework Installation     ${RESET}"
  echo -e "${BLUE}${BOLD}=============================================${RESET}"
  echo -e "${CYAN}Version: 2.0.0${RESET}"
  echo -e "${CYAN}Datum: $(date +%Y-%m-%d)${RESET}"
  echo -e "${CYAN}Framework-Verzeichnis: $(pwd)${RESET}"
  echo -e "${BLUE}${BOLD}=============================================${RESET}\n"
  
  # Führe Installationsschritte aus
  check_system_requirements
  install_dependencies
  setup_python_environment
  create_framework_structure
  configure_claude_integration
  configure_mcp_servers
  create_documentation
  finalize_installation
  
  return 0
}

# Führe Hauptfunktion aus
main "$@"
