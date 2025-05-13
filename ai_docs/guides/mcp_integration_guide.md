# MCP Integration Guide

Dieses Handbuch erklärt die Integration des Model Context Protocol (MCP) in das Claude Neural Framework und bietet eine Schritt-für-Schritt-Anleitung zur Verwendung und Erweiterung.

## Was ist das Model Context Protocol?

Das Model Context Protocol (MCP) ist ein offener Standard, der von Anthropic entwickelt wurde, um eine standardisierte Kommunikation zwischen KI-Modellen und externen Tools, Datenquellen und Diensten zu ermöglichen. Es folgt einer Client-Server-Architektur:

- **MCP-Server**: Stellen externe Funktionalitäten oder Datenquellen bereit
- **MCP-Client**: Verbindet KI-Modelle mit den Servern
- **Host-Anwendung**: Integriert den Client in eine Benutzeroberfläche

MCP ermöglicht es Claude, auf externe Ressourcen zuzugreifen und mit ihnen zu interagieren, ohne dass spezifische Integrationen für jedes Tool implementiert werden müssen.

## MCP-Komponenten im Framework

Das Claude Neural Framework integriert MCP mit folgenden Hauptkomponenten:

1. **Server-Konfiguration**: `core/config/mcp_config.json`
2. **Server-Starter**: `core/mcp/start_server.js`
3. **MCP-Client**: `core/mcp/claude_mcp_client.js`
4. **Konfigurationsmanager**: `core/config/config_manager.js`

## Unterstützte MCP-Server

Das Framework unterstützt folgende MCP-Server:

| Server | Beschreibung | Verwendung |
|--------|--------------|------------|
| `sequentialthinking` | Rekursive Gedankengenerierung | Komplexe Probleme lösen |
| `context7` | Dokumentationszugriff | API-Dokumentation durchsuchen |
| `desktop-commander` | Dateisystem und Shell | Dateien verwalten, Befehle ausführen |
| `brave-search` | Websuchintegration | Aktuelle Informationen abrufen |
| `think-mcp` | Meta-kognitive Reflexion | Gedankenprozesse analysieren |
| `memory-bank` | Langzeitpersistenz | Informationen zwischen Sitzungen speichern |
| `code-mcp` | Code-Analyse | Code verstehen und bearbeiten |

## Einrichtung und Verwendung

### MCP-Server installieren

Die meisten MCP-Server werden als NPM-Pakete bereitgestellt und können mit folgendem Befehl installiert werden:

```bash
npm install @modelcontextprotocol/server-sequential-thinking
npm install @modelcontextprotocol/server-context7
# usw.
```

### Server konfigurieren

Die Server-Konfiguration erfolgt in `core/config/mcp_config.json`:

```json
{
  "servers": {
    "sequentialthinking": {
      "enabled": true,
      "command": "npx",
      "args": ["@modelcontextprotocol/server-sequential-thinking"],
      "autostart": true,
      "description": "Rekursive Gedankengenerierung für komplexe Probleme"
    },
    "brave-search": {
      "enabled": true,
      "command": "npx",
      "args": ["@modelcontextprotocol/server-brave-search"],
      "autostart": false,
      "api_key_env": "BRAVE_API_KEY",
      "description": "Externe Wissensakquisition"
    }
  }
}
```

Für jeden Server können Sie folgende Eigenschaften konfigurieren:

- `enabled`: Aktiviert/deaktiviert den Server
- `command`: Ausführungsbefehl
- `args`: Befehlsargumente
- `autostart`: Ob der Server automatisch gestartet werden soll
- `api_key_env`: Name der Umgebungsvariable für den API-Schlüssel (falls erforderlich)
- `description`: Beschreibung des Servers

### Server starten

Die Server können mit dem Server-Starter gestartet werden:

```bash
node core/mcp/start_server.js
```

Um einen spezifischen Server zu starten:

```bash
node core/mcp/start_server.js brave-search
```

### MCP-Client verwenden

Die MCP-Client-API bietet eine einfache Schnittstelle zur Interaktion mit Claude über MCP:

```javascript
const ClaudeMcpClient = require('./core/mcp/claude_mcp_client');

async function main() {
  // Client initialisieren
  const client = new ClaudeMcpClient();
  
  // Verfügbare Server ausgeben
  console.log('Verfügbare MCP-Server:');
  const servers = client.getAvailableServers();
  console.table(servers);
  
  // Antwort generieren
  const response = await client.generateResponse({
    prompt: "Erkläre mir das Model Context Protocol",
    requiredTools: ["sequentialthinking", "brave-search"]
  });
  
  console.log('Claude-Antwort:');
  console.log(response);
  
  // Server beenden
  client.stopAllServers();
}

main().catch(console.error);
```

## Integration mit Claude Desktop

Das Framework unterstützt die Integration mit Claude Desktop, Anthropic's offizieller Desktop-Anwendung für Claude:

1. Installieren Sie [Claude Desktop](https://claude.ai/desktop)
2. Starten Sie die MCP-Server mit `node core/mcp/start_server.js`
3. Der Server-Starter aktualisiert automatisch die Claude Desktop-Konfiguration

Die Konfiguration wird in `~/.claude/claude_desktop_config.json` gespeichert:

```json
{
  "mcpServers": {
    "sequentialthinking": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-sequential-thinking"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-brave-search"]
    }
  }
}
```

## Verwendungsbeispiele

### Beispiel 1: Sequentielles Denken

```javascript
const response = await client.generateResponse({
  prompt: "Entwickle eine Strategie zur Lösung des Klimawandels. Berücksichtige technologische, politische und soziale Aspekte.",
  requiredTools: ["sequentialthinking"]
});
```

### Beispiel 2: Websuchintegration

```javascript
const response = await client.generateResponse({
  prompt: "Was sind die aktuellen Entwicklungen in der Quantencomputertechnologie?",
  requiredTools: ["brave-search"]
});
```

### Beispiel 3: Dokumentationssuche

```javascript
const response = await client.generateResponse({
  prompt: "Erkläre mir, wie ich die useState Hook in React verwende.",
  requiredTools: ["context7"]
});
```

### Beispiel 4: Kombination mehrerer Tools

```javascript
const response = await client.generateResponse({
  prompt: "Analysiere den aktuellen Stand der KI-Forschung und entwickle eine Roadmap für die nächsten 5 Jahre.",
  requiredTools: ["sequentialthinking", "brave-search", "think-mcp"]
});
```

## Eigene MCP-Server entwickeln

Sie können eigene MCP-Server entwickeln, um spezifische Funktionalitäten bereitzustellen:

1. **Projektstruktur erstellen**:

```
my-mcp-server/
├── package.json
├── index.js
└── lib/
    ├── server.js
    └── tools.js
```

2. **package.json definieren**:

```json
{
  "name": "my-mcp-server",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "@modelcontextprotocol/server": "^0.1.0"
  }
}
```

3. **Server implementieren**:

```javascript
// index.js
const { startServer } = require('./lib/server');

startServer();
```

```javascript
// lib/server.js
const { createServer } = require('@modelcontextprotocol/server');
const { myTool } = require('./tools');

function startServer() {
  const server = createServer({
    name: 'my-mcp-server',
    version: '1.0.0',
    description: 'Mein benutzerdefinierter MCP-Server'
  });

  // Tool registrieren
  server.registerTool(myTool);

  // Server starten
  server.start();
}

module.exports = { startServer };
```

```javascript
// lib/tools.js
const myTool = {
  name: 'my-tool',
  description: 'Mein benutzerdefiniertes Tool',
  parameters: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Ein Parameter'
      }
    },
    required: ['param1']
  },
  execute: async (params) => {
    const { param1 } = params;
    
    // Tool-Logik implementieren
    const result = `Ergebnis für ${param1}`;
    
    return {
      result
    };
  }
};

module.exports = { myTool };
```

4. **Server konfigurieren**:

Fügen Sie den Server zur MCP-Konfiguration hinzu:

```json
{
  "servers": {
    "my-mcp-server": {
      "enabled": true,
      "command": "node",
      "args": ["/pfad/zu/my-mcp-server/index.js"],
      "autostart": true,
      "description": "Mein benutzerdefinierter MCP-Server"
    }
  }
}
```

## Sicherheitsüberlegungen

Bei der Verwendung von MCP-Servern sind folgende Sicherheitsaspekte zu beachten:

1. **API-Schlüsselverwaltung**: Speichern Sie API-Schlüssel sicher und verwenden Sie Umgebungsvariablen
2. **Berechtigungen**: Begrenzen Sie die Berechtigungen von MCP-Servern (z.B. Dateisystem, Netzwerkzugriff)
3. **Eingabevalidierung**: Validieren Sie alle Eingaben, bevor Sie sie an externe Dienste weitergeben
4. **Audit-Logging**: Protokollieren Sie sicherheitsrelevante Operationen

Die Sicherheitseinstellungen sind in `core/config/security_constraints.json` konfiguriert:

```json
{
  "mcp": {
    "allowed_servers": [
      "sequentialthinking",
      "context7",
      "desktop-commander",
      "brave-search",
      "think-mcp",
      "memory-bank",
      "code-mcp"
    ],
    "allow_server_autostart": true,
    "allow_remote_servers": false
  }
}
```

## Fehlerbehebung

### Häufige Probleme

**Problem**: MCP-Server startet nicht  
**Lösung**: Prüfen Sie, ob die notwendigen NPM-Pakete installiert sind und die Konfiguration korrekt ist

**Problem**: Claude nutzt MCP-Tool nicht  
**Lösung**: Stellen Sie sicher, dass der Server läuft und in der Claude Desktop-Konfiguration registriert ist

**Problem**: Authentifizierungsfehler  
**Lösung**: Überprüfen Sie API-Schlüssel und Umgebungsvariablen

**Problem**: Claude Desktop findet Server nicht  
**Lösung**: Prüfen Sie die Claude Desktop-Konfiguration in `~/.claude/claude_desktop_config.json`

## Weitere Ressourcen

- [Offizielle MCP-Dokumentation](https://modelcontextprotocol.io/docs/)
- [Anthropic Claude Dokumentation](https://docs.anthropic.com/)
- [MCP Server Development Guide](https://modelcontextprotocol.io/docs/server-development/)
- [Claude Desktop Dokumentation](https://docs.anthropic.com/claude/docs/claude-desktop)

## Glossar

- **MCP**: Model Context Protocol
- **Host**: Anwendung, die den MCP-Client integriert (z.B. Claude Desktop)
- **Client**: Komponente, die mit MCP-Servern kommuniziert
- **Server**: Anwendung, die Tools über MCP bereitstellt
- **Tool**: Funktionalität, die von einem MCP-Server angeboten wird
- **Resource**: Datenquelle, auf die ein MCP-Server zugreifen kann
- **Prompt**: Vorlage für die Interaktion mit Claude
