# VS Code-Erweiterungen: Best Practices für DevContainer

## Allgemeine Empfehlungen

- **Nur notwendige Erweiterungen einbinden**: Zu viele Erweiterungen können die Leistung beeinträchtigen
- **Nach Kategorien organisieren**: Verwende Kommentare zur Gruppierung, um die Übersicht zu behalten
- **Konfliktfreiheit sicherstellen**: Vermeide Erweiterungen, die die gleiche Funktionalität bieten
- **Regelmäßig prüfen und aktualisieren**: Entferne nicht mehr genutzte Erweiterungen

## Essentielle Erweiterungen

### Programmiersprachen und Tools

- **ms-python.python**: Python-Sprachunterstützung
- **ms-python.vscode-pylance**: Python-Intelligenz
- **dbaeumer.vscode-eslint**: JavaScript/TypeScript Linting
- **esbenp.prettier-vscode**: Code-Formatierung

### Remote-Entwicklung (KRITISCH)

- **ms-vscode-remote.remote-containers**: DevContainer-Unterstützung
- **ms-vscode-remote.remote-ssh**: SSH-Verbindung
- **ms-vscode-remote.remote-wsl**: Windows-Subsystem für Linux
- **ms-vscode.remote-explorer**: Explorer für Remote-Verbindungen

### Hilfreiche Zusatzfeatures (nach Bedarf)

- **aaron-bond.better-comments**: Verbesserte Kommentare
- **eamodio.gitlens**: Git-Integration
- **streetsidesoftware.code-spell-checker**: Rechtschreibprüfung
- **ms-ceintl.vscode-language-pack-de**: Deutsche Sprachunterstützung

## Spezifische Funktions-Erweiterungen

### KI-Assistenten

- **github.copilot**: KI-Code-Vorschläge
- **github.copilot-chat**: Chat-Interface für Copilot
- **block.vscode-mcp-extension**: MCP-Protokoll-Unterstützung

### Datenbank und Tools

Für Qdrant und ähnliche Tools:

- Stelle sicher, dass eindeutige Pfade verwendet werden
- Vermeide Zugriffskonflikte bei gleichzeitiger Nutzung
- Verwende externe Konfigurationsdateien für komplexe Setups

## Einrichtung für neue Entwickler

Neue Teammitglieder sollten:

1. DevContainer neu erstellen, nicht neu konfigurieren
2. Die `.devcontainer.json`-Datei nicht bearbeiten, ohne das Team zu informieren
3. Bei Problemen die bereitgestellten Scripts verwenden

## Troubleshooting

Bei Problemen mit Erweiterungen:

1. Container neu aufbauen (`Remote-Containers: Rebuild Container`)
2. Cache leeren (`Developer: Reload Window`)
3. Spezifische Protokoll-Ausgaben überprüfen (`Developer: Show Logs...`)
