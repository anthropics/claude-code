# SAAR-MCP Benutzerhandbuch

## Einführung

Das SAAR-MCP System kombiniert das SAAR Framework (Setup, Activate, Apply, Run) mit dem Model Context Protocol (MCP), um eine nahtlose Integration zwischen verschiedenen KI-Tools und dem Claude Neural Framework zu ermöglichen. Dieses Benutzerhandbuch erklärt die Installation, Konfiguration und Verwendung des Systems für Entwickler und Endbenutzer.

## Inhaltsverzeichnis

- [Installation](#installation)
- [Erste Schritte](#erste-schritte)
- [Grundfunktionen](#grundfunktionen)
- [DeepThink System](#deepthink-system)
- [Gedächtnissystem](#gedächtnissystem)
- [Workflows](#workflows)
- [Dashboard](#dashboard)
- [Fehlerbehebung](#fehlerbehebung)
- [Fortgeschrittene Funktionen](#fortgeschrittene-funktionen)

## Installation

### Voraussetzungen

- Linux, macOS oder Windows mit WSL2
- Node.js 14+ (empfohlen: 20 LTS)
- Python 3.8+ (empfohlen: 3.10+)
- Git

### Installations-Schritte

1. Klonen Sie das Repository:

```bash
git clone https://github.com/username/claude-code.git
cd claude-code
```

2. Führen Sie das Installationsskript aus:

```bash
./installation/install.sh
```

3. Konfigurieren Sie die API-Schlüssel:

```bash
# Setzen Sie Ihre API-Schlüssel
export CLAUDE_API_KEY="Ihr_Claude_API_Key"
export MCP_API_KEY="Ihr_MCP_API_Key"
```

4. Verifizieren Sie die Installation:

```bash
./saar-mcp.sh validate
```

## Erste Schritte

Nach der Installation können Sie das SAAR-MCP System mit dem `saar-mcp.sh` Skript steuern. Hier sind die grundlegenden Befehle:

### Hilfe anzeigen

```bash
./saar-mcp.sh help
```

### Systemstatus prüfen

```bash
./saar-mcp.sh status
```

### MCP-Tools validieren

```bash
./saar-mcp.sh validate
```

## Grundfunktionen

### MCP-Tool-Operationen

```bash
# MCP-Tool-Status anzeigen
./saar-mcp.sh mcp status

# Verfügbare Fallbacks auflisten
./saar-mcp.sh mcp fallback list

# Fallbacks aktivieren
./saar-mcp.sh mcp fallback enable

# Fallbacks deaktivieren
./saar-mcp.sh mcp fallback disable

# MCP-Konfiguration bearbeiten
./saar-mcp.sh mcp config
```

### Neurales Framework

```bash
# Neurales Framework verwenden
./saar-mcp.sh neural <command>

# Neurales Framework installieren
./saar-mcp.sh neural install

# KI-Dokumentationsvorlagen erstellen
./saar-mcp.sh neural templates
```

### Autonomie-System

```bash
# Autonomie-System verwenden
./saar-mcp.sh autonomy <command>

# Autonomie-Status anzeigen
./saar-mcp.sh autonomy status

# Autonomie-System installieren
./saar-mcp.sh autonomy install
```

## DeepThink System

Das DeepThink System kombiniert das DeepThink-Modul von SAAR mit dem sequentialthinking MCP-Tool, um verbesserte rekursive Denkfähigkeiten zu bieten.

### DeepThink verwenden

```bash
# DeepThink mit einem Prompt ausführen
./saar-mcp.sh deepthink "Erstelle einen Testplan für die Anwendung"

# DeepThink ohne Gedächtnisfunktion ausführen
./saar-mcp.sh deepthink "Analysiere diesen Code" --no-memory
```

### DeepThink Parameter

- `--no-memory`: DeepThink ohne Gedächtnisfunktion ausführen
- `--depth=N`: Rekursionstiefe festlegen (Standard: 5)

### Beispiel: Komplexe Problemanalyse

```bash
./saar-mcp.sh deepthink "Analysiere die Vor- und Nachteile einer Microservice-Architektur 
im Vergleich zu einer Monolith-Architektur für eine E-Commerce-Anwendung mit hohen 
Verfügbarkeitsanforderungen und variablem Traffic-Volumen."
```

## Gedächtnissystem

Das Gedächtnissystem speichert, kategorisiert und organisiert Gedanken aus dem DeepThink-System für spätere Verwendung.

### Gedächtnisoperationen

```bash
# Gedächtnisstatus anzeigen
./saar-mcp.sh memory status

# Gedächtnis durchsuchen
./saar-mcp.sh memory search "architektur"

# Einen bestimmten Gedanken abrufen
./saar-mcp.sh memory get <gedanken-id>

# Einen neuen Gedanken speichern
./saar-mcp.sh memory store "Dies ist ein neuer Gedanke über Systemarchitektur"

# Zwei Gedanken miteinander verknüpfen
./saar-mcp.sh memory relate <quell-id> <ziel-id> "builds_on"
```

### Gedächtniskategorien

Das System kategorisiert Gedanken automatisch in:

- `problem_analysis`: Analyse von Problemstellungen und Anforderungen
- `solution_design`: Design und Architektur von Lösungen
- `implementation`: Implementierungsdetails und Code
- `testing`: Teststrategien und -ansätze
- `learning`: Lernen und Erkenntnisse aus Erfahrungen

## Workflows

Das System unterstützt Cross-Tool-Workflows, die mehrere MCP-Tools kombinieren, um komplexe Aufgaben zu automatisieren.

### Workflow-Operationen

```bash
# Verfügbare Workflows auflisten
./saar-mcp.sh workflow list

# Workflow-Details anzeigen
./saar-mcp.sh workflow show <workflow-name>

# Einen Workflow ausführen
./saar-mcp.sh cross-tool <workflow-name> [parameter1=wert1 parameter2=wert2 ...]
```

### Vordefinierte Workflows

1. **Code-Analyse-Workflow**:
   ```bash
   ./saar-mcp.sh cross-tool code_analysis codeDir=/pfad/zum/code library=react
   ```

2. **Test-Generierungs-Workflow**:
   ```bash
   ./saar-mcp.sh cross-tool test_generation codeDir=/pfad/zum/code language=javascript fileExt=js
   ```

3. **Dokumentations-Update-Workflow**:
   ```bash
   ./saar-mcp.sh cross-tool documentation_update codeDir=/pfad/zum/code language=javascript fileExt=js
   ```

## Dashboard

Das SAAR-MCP System bietet ein modernes Web-Dashboard zur Überwachung und Steuerung.

### Dashboard starten

```bash
./saar-mcp.sh ui-dashboard
```

Nach dem Start ist das Dashboard unter `http://localhost:3500` verfügbar.

### Dashboard-Funktionen

- Systemstatus-Überwachung
- MCP-Tool-Status
- Workflow-Ausführung und -Überwachung
- Log-Viewer
- Erweiterte Visualisierungen

### Visualisierungen generieren

Über das Dashboard können Sie verschiedene Visualisierungen generieren:

1. **MCP-Tools-Visualisierung**: Zeigt den Status aller MCP-Tools an
2. **Gedächtnis-Visualisierung**: Visualisiert das Gedächtnissystem und Kategorien
3. **Workflow-Visualisierung**: Zeigt die Ausführung und Ergebnisse von Workflows

## Fehlerbehebung

### Häufige Probleme

1. **MCP-Tool nicht verfügbar**:
   ```bash
   # Prüfen Sie den MCP-Tool-Status
   ./saar-mcp.sh mcp status
   
   # Stellen Sie sicher, dass Fallbacks aktiviert sind
   ./saar-mcp.sh mcp fallback enable
   
   # Validieren Sie die MCP-Tools
   ./saar-mcp.sh validate
   ```

2. **DeepThink-Fehler**:
   ```bash
   # Führen Sie DeepThink mit weniger Tiefe aus
   ./saar-mcp.sh deepthink "Ihr Prompt" --depth=3
   
   # Führen Sie DeepThink ohne Gedächtnis aus
   ./saar-mcp.sh deepthink "Ihr Prompt" --no-memory
   ```

3. **Dashboard startet nicht**:
   ```bash
   # Prüfen Sie, ob die Ports verfügbar sind
   netstat -tulpn | grep 3500
   
   # Starten Sie das Dashboard mit Debug-Informationen
   ./saar-mcp.sh ui-dashboard --debug
   ```

### Log-Dateien

Die wichtigsten Log-Dateien finden Sie hier:

- SAAR-Log: `$HOME/.claude/saar.log`
- MCP-Logs: `$HOME/.claude/mcp/logs/`
- Dashboard-Log: `$HOME/.claude/tools/dashboard/dashboard.log`

## Fortgeschrittene Funktionen

### Benutzerdefinierte Workflows erstellen

Sie können benutzerdefinierte Workflows erstellen, indem Sie JSON-Workflow-Definitionen im Verzeichnis `$HOME/.claude/mcp/workflows/` erstellen.

Beispiel für eine einfache Workflow-Definition:

```json
{
  "name": "mein_workflow",
  "description": "Mein benutzerdefinierter Workflow",
  "version": "1.0.0",
  "steps": [
    {
      "name": "erster_schritt",
      "type": "command",
      "command": "echo 'Erster Schritt'",
      "output": "ersterOutput",
      "continueOnError": false
    },
    {
      "name": "zweiter_schritt",
      "type": "deepthink",
      "input": "Analysiere {ersterOutput}",
      "output": "analyse",
      "continueOnError": false
    }
  ],
  "inputs": [
    {
      "name": "parameter1",
      "description": "Ein Parameter",
      "type": "string",
      "required": true
    }
  ]
}
```

### Eigene Fallbacks implementieren

Sie können eigene Fallbacks für MCP-Tools implementieren, indem Sie JavaScript-Dateien im Verzeichnis `$HOME/.claude/mcp/fallbacks/` erstellen.

### Systemoptimierung

Für optimale Leistung können Sie die folgenden Einstellungen anpassen:

1. **RAM-Nutzung optimieren**:
   - Reduzieren Sie die Anzahl der parallelen MCP-Tools
   - Setzen Sie `max_commands_per_plan` in der Autonomie-Konfiguration niedriger

2. **Dateisystem-Leistung**:
   - Speichern Sie Gedächtnisse und Logs auf einer SSD
   - Bereinigen Sie regelmäßig alte Logs und Gedächtniseinträge

3. **Netzwerkoptimierung**:
   - Verwenden Sie lokale Fallbacks für netzwerkintensive MCP-Tools
   - Aktivieren Sie Caching für häufig verwendete Anfragen

## Ressourcen

- [SAAR-MCP GitHub Repository](https://github.com/username/claude-code)
- [Fehler melden](https://github.com/username/claude-code/issues)
- [API-Dokumentation](https://username.github.io/claude-code/api)
- [Community-Forum](https://forum.example.com/claude-code)