# Enhanced OS-REQUIREMENTS for Claude Code Neural Integration

Dieses Dokument definiert die vollständigen System- und Umgebungsanforderungen für die Enterprise-Ready-Integration von Claude Code mit neural-kognitiven Funktionen.

## 🧠 Basis-Betriebssystem

### Empfohlene Distributionen
- **Primär**: Debian 12 (Bookworm) - stabil und performant
- **Alternativ**: Ubuntu 22.04 LTS / 24.04 LTS - breite Kompatibilität

### Kernanforderungen
- **Kernel**: 5.15 oder neuer
- **Architektur**: x86_64 / ARM64 (Apple Silicon)
- **RAM**: Mindestens 8 GB, empfohlen 16 GB
- **Speicherplatz**: Mindestens 10 GB freier Speicherplatz
- **Netzwerk**: Stabile Internetverbindung

## 📦 Grundlegende System-Pakete

### Basispaketgruppe
```bash
sudo apt-get update && sudo apt-get install -y \
  build-essential \
  git \
  curl \
  wget \
  gnupg2 \
  apt-transport-https \
  ca-certificates \
  software-properties-common \
  lsb-release \
  jq \
  tmux \
  shellcheck
```

### Entwicklungstools
```bash
sudo apt-get install -y \
  zip \
  unzip \
  tree \
  htop \
  net-tools \
  iotop \
  rsync \
  ssh \
  vim \
  nano \
  git-lfs
```

## 🔄 Laufzeitumgebungen

### Node.js (erforderlich)
- **Version**: 20.x LTS (aktuell 20.11.x)
- **Installation via FNM (empfohlen)**:
  ```bash
  curl -fsSL https://fnm.vercel.app/install | bash
  export PATH="$HOME/.fnm:$PATH"
  eval "$(fnm env --use-on-cd)"
  fnm install 20
  fnm use 20
  ```
- **NPM**: 10.x oder höher
- **Globale NPM-Pakete**:
  ```bash
  npm install -g @smithery/cli @modelcontextprotocol/server-sequential-thinking
  ```

### Python (optional, aber empfohlen)
- **Version**: 3.10+ (bevorzugt 3.11)
- **Installation**:
  ```bash
  sudo apt-get install -y python3 python3-pip python3-venv
  ```
- **Virtuelle Umgebung**: Empfohlen für isolierte Entwicklung

## 🐳 Containerisierung und Virtualisierung

### Docker & Docker Compose
- **Docker Engine**: 24.x oder neuer
- **Installation**:
  ```bash
  # Docker GPG-Schlüssel und Repository hinzufügen
  curl -fsSL https://download.docker.com/linux/$(lsb_release -is | tr '[:upper:]' '[:lower:]')/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/$(lsb_release -is | tr '[:upper:]' '[:lower:]') $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  
  # Docker installieren
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  
  # Nicht-root Benutzer zur Docker-Gruppe hinzufügen
  sudo usermod -aG docker $USER
  ```

## 🔧 Entwicklungswerkzeuge und Integrationen

### Git & GitHub CLI
- **Git**: 2.40.0 oder neuer
- **GitHub CLI**: Neueste Version
- **Installation**:
  ```bash
  # GitHub CLI Repository hinzufügen
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
  
  # Installation
  sudo apt-get update
  sudo apt-get install -y gh
  ```

### Visual Studio Code
- **Version**: Neueste stabile Version
- **Installation**:
  ```bash
  # MS-Repositories hinzufügen
  wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
  sudo install -D -o root -g root -m 644 packages.microsoft.gpg /etc/apt/keyrings/packages.microsoft.gpg
  sudo sh -c 'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/keyrings/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'
  rm -f packages.microsoft.gpg
  
  # Installation
  sudo apt-get update
  sudo apt-get install -y code
  ```
- **Empfohlene Erweiterungen**:
  - ESLint (`dbaeumer.vscode-eslint`)
  - GitHub Copilot (`github.copilot`)
  - GitLens (`eamodio.gitlens`)
  - Anthropic Claude Extension (`anthropic.claude-vscode`)
  - Prettier (`esbenp.prettier-vscode`)
  - Docker (`ms-azuretools.vscode-docker`)

## 🌐 Netzwerk und API-Anforderungen

### Netzwerkkonnektivität
- **Ausgehende Verbindungen** zu folgenden Domains:
  - `api.anthropic.com` (Claude API)
  - `github.com` und `api.github.com` (GitHub-Integration)
  - `registry.npmjs.org` (NPM-Registry)
  - `cdn.smithery.dev` (MCP-Server-Integration)

### API-Zugriff
- **Anthropic API-Key**: Erforderlich für Claude Code
- **GitHub-Token**: Empfohlen für Repository-Integration

## 🔐 Sicherheitsanforderungen

### Benutzerberechtigungen
- Nicht-root-Benutzer mit sudo-Berechtigungen für Installation
- Docker-Gruppe-Mitgliedschaft für containerisierte Ausführung
- Standardmäßig eingeschränkte Dateisystemberechtigungen

### Sicherheitsrichtlinien
- API-Keys sicher im Betriebssystem-Keychain oder in `.env`-Dateien speichern
- Sensible Informationen nie in Code oder Repositories einchecken
- Regelmäßige Sicherheitsupdates für das Betriebssystem und Pakete

## 📂 Verzeichnisstruktur

### Projektstruktur
```
/home/user/claude-code/         # Hauptprojektverzeichnis
├── .claude/                    # Claude-spezifische Konfigurationen
│   ├── CLAUDE.md               # Meta-kognitive Hauptdirektive
│   ├── commands/               # Benutzerdefinierte Befehle
│   ├── config/                 # Konfigurationsdateien
│   └── scripts/                # Hilfsskripte
├── .clauderules                # Sicherheits- und Zugriffsregeln
├── .mcp.json                   # MCP-Server-Konfiguration
├── ai_docs/                    # KI-Dokumentation und Templates
│   ├── examples/               # Beispiele für Claude Code
│   ├── prompts/                # Benutzerdefinierte Prompts
│   └── templates/              # Prompt-Templates
└── specs/                      # Technische Spezifikationen
    ├── migrations/             # Datenbankmigrationen
    ├── openapi/                # API-Spezifikationen
    └── schemas/                # Datenschemas
```

### Globale Konfiguration
```
~/.claude/                     # Globale Claude-Konfiguration
├── CLAUDE.md                  # Symlink zur Projektdatei
├── config/                    # Globale Einstellungen
│   └── global.json            # Projektübergreifende Konfiguration
├── logs/                      # Log-Dateien
└── cache/                     # Cache-Daten
```

## 🛠 Installation und Einrichtung

### Automatisierte Installation
```bash
curl -sSL https://raw.githubusercontent.com/yourusername/claude-code-enterprise/main/install.sh | bash
```

### Manuelle Schritte
1. **Repository klonen**:
   ```bash
   git clone https://github.com/anthropics/claude-code.git
   cd claude-code
   ```

2. **Abhängigkeiten installieren**:
   ```bash
   npm install
   ```

3. **Claude Code global installieren** (optional):
   ```bash
   npm link
   ```

4. **Globales Claude-Verzeichnis einrichten**:
   ```bash
   mkdir -p ~/.claude/{config,logs,cache}
   ln -sf "$(pwd)/.claude/CLAUDE.md" ~/.claude/CLAUDE.md
   ```

5. **API-Key konfigurieren**:
   ```bash
   # Mit System-Keychain (empfohlen)
   claude auth login
   
   # Oder manuell in Konfigurationsdatei
   echo '{"apiKey":"YOUR_ANTHROPIC_API_KEY"}' > ~/.claude/config/auth.json
   chmod 600 ~/.claude/config/auth.json
   ```

## 🚀 Validierung der Installation

### Systemprüfung
```bash
# Nodejs-Version prüfen
node -v  # Sollte v20.x.x anzeigen

# NPM-Version prüfen
npm -v   # Sollte 10.x.x oder höher anzeigen

# Docker-Funktionalität testen
docker run --rm hello-world

# Claude Code testen
claude --version
```

### MCP-Server-Test
```bash
# MCP-Server auflisten
claude mcp ls

# Sequentielles Denken starten
claude mcp start sequentialthinking
```

## 🌐 Wartung und Updates

### System-Updates
```bash
# Betriebssystem aktualisieren
sudo apt-get update && sudo apt-get upgrade -y

# Node.js aktualisieren
fnm install 20 --latest
fnm use 20
```

### Claude Code-Updates
```bash
# Auf die neueste Version aktualisieren
cd /path/to/claude-code
git pull
npm install
npm link  # Falls global installiert
```

---

Diese Enterprise-Ready-Anforderungen stellen sicher, dass die Claude Code Neural Integration optimal auf Ihrem System funktioniert und alle erforderlichen Komponenten für eine leistungsstarke Entwicklungsumgebung vorhanden sind.
