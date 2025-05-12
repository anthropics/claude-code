# Schnellstart-Anleitung für das Claude Neural Framework

Diese Anleitung führt Sie durch die ersten Schritte mit dem Claude Neural Framework. Sie lernen, wie Sie das Framework installieren, konfigurieren und in Ihren Projekten verwenden können.

## Voraussetzungen

Bevor Sie beginnen, stellen Sie sicher, dass Ihr System die folgenden Anforderungen erfüllt:

- **Betriebssystem**: Linux, macOS oder Windows mit WSL2
- **Node.js**: Version 18.x oder höher (empfohlen: 20.x LTS)
- **Python**: Version 3.8 oder höher (empfohlen: 3.10+)
- **Git**: Aktuelle Version
- **Speicher**: Mindestens 4 GB RAM und 1 GB freier Festplattenspeicher

Außerdem benötigen Sie:

- Einen Anthropic API-Schlüssel für den Zugriff auf Claude
- Optional: API-Schlüssel für zusätzliche Dienste (Voyage AI, Brave Search)

## Installation

### 1. Repository klonen

Klonen Sie das Claude Neural Framework Repository auf Ihr lokales System:

```bash
git clone https://github.com/username/claude-code.git
cd claude-code
```

### 2. Installationsskript ausführen

Führen Sie das Installationsskript aus, um alle Abhängigkeiten zu installieren und die Umgebung einzurichten:

```bash
./scripts/installation/install.sh
```

Das Skript führt folgende Aktionen aus:
- Prüfung der Systemvoraussetzungen
- Installation von Node.js-Abhängigkeiten
- Einrichtung einer Python-Umgebung
- Konfiguration der Claude-Integration
- Erstellung der Verzeichnisstruktur

### 3. API-Schlüssel konfigurieren

Setzen Sie Ihren Anthropic API-Schlüssel als Umgebungsvariable:

```bash
export CLAUDE_API_KEY="your_api_key_here"
```

Für eine permanente Konfiguration können Sie den Schlüssel in `~/.claude/config.json` speichern:

```json
{
  "api_keys": {
    "anthropic": "your_api_key_here"
  }
}
```

### 4. Optional: Vektordatenbank einrichten

Wenn Sie das RAG-System (Retrieval Augmented Generation) verwenden möchten, richten Sie die Vektordatenbank ein:

```bash
python core/rag/setup_database.py
```

## Grundlegende Verwendung

### MCP-Server starten

Starten Sie die MCP-Server, um Claude mit externen Tools zu verbinden:

```bash
node core/mcp/start_server.js
```

Sie können auch spezifische Server starten:

```bash
node core/mcp/start_server.js sequentialthinking
```

### Verwendung des RAG-Systems

Das RAG-System ermöglicht es Claude, auf Basis externer Dokumente zu antworten:

```python
from core.rag.claude_rag import ClaudeRagAPI

# API initialisieren
api = ClaudeRagAPI()

# Dokumente hinzufügen
api.add_document("/pfad/zu/dokument.md", namespace="projekt_docs")

# Frage an das System stellen
antwort, quellen = api.ask(
    "Was sind die Hauptfunktionen des Systems?", 
    namespace="projekt_docs"
)

print(antwort)
```

Alternativ können Sie das Kommandozeilentool verwenden:

```bash
python -m core.rag.claude_rag add /pfad/zu/dokument.md --namespace projekt_docs
python -m core.rag.claude_rag ask "Was sind die Hauptfunktionen des Systems?" --namespace projekt_docs
```

### Verwendung der MCP-Integration

Sie können direkt mit Claude über das MCP interagieren:

```javascript
const ClaudeMcpClient = require('./core/mcp/claude_mcp_client');

async function main() {
  // Client initialisieren
  const client = new ClaudeMcpClient();
  
  // Antwort generieren
  const antwort = await client.generateResponse({
    prompt: "Erkläre mir das Model Context Protocol",
    requiredTools: ["sequentialthinking", "brave-search"]
  });
  
  console.log(antwort);
  
  // Server beenden
  client.stopAllServers();
}

main().catch(console.error);
```

## Erweiterte Konfiguration

### MCP-Server konfigurieren

Die MCP-Server-Konfiguration finden Sie in `core/config/mcp_config.json`. Hier können Sie Server aktivieren/deaktivieren und deren Parameter anpassen:

```json
{
  "servers": {
    "brave-search": {
      "enabled": true,
      "command": "npx",
      "args": ["@modelcontextprotocol/server-brave-search"],
      "autostart": true,
      "api_key_env": "BRAVE_API_KEY"
    }
  }
}
```

### RAG-System konfigurieren

Die RAG-Konfiguration finden Sie in `core/config/rag_config.json`:

```json
{
  "database": {
    "type": "lancedb",
    "connection": {
      "path": "data/lancedb"
    }
  },
  "embedding": {
    "provider": "voyage",
    "model": "voyage-2",
    "dimensions": 1024
  }
}
```

## Nächste Schritte

- [MCP-Server Dokumentation](mcp_server_guide.md) - Mehr über verfügbare MCP-Server erfahren
- [RAG-System Dokumentation](rag_system_guide.md) - Detaillierte Dokumentation des RAG-Systems
- [Prompt-Engineering](../prompts/prompt_engineering_guide.md) - Anleitung zum Erstellen effektiver Prompts
- [Integration in Entwicklungsprozesse](development_integration.md) - Integration in CI/CD und IDEs

## Fehlerbehebung

### Häufige Probleme

**Problem**: MCP-Server starten nicht
**Lösung**: Prüfen Sie, ob die notwendigen NPM-Pakete installiert sind und die Server in der Konfiguration aktiviert sind.

**Problem**: Vektordatenbank kann nicht initialisiert werden
**Lösung**: Stellen Sie sicher, dass die erforderlichen Python-Pakete installiert sind und die Datenbankpfade existieren.

**Problem**: Authentifizierungsfehler bei Claude-API
**Lösung**: Überprüfen Sie Ihren API-Schlüssel und stellen Sie sicher, dass er korrekt konfiguriert ist.

### Support

Bei Problemen oder Fragen können Sie:
- Ein Issue im GitHub-Repository erstellen
- Die Dokumentation in `docs/` durchsuchen
- Das Debugging-Protokoll in `~/.claude/logs/` überprüfen
