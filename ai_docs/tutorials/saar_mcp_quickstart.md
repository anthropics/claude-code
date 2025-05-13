# SAAR-MCP Schnellstart-Anleitung

Diese Anleitung führt Sie durch den schnellen Einstieg in das SAAR-MCP Integrationssystem und zeigt Ihnen die wichtigsten Funktionen.

## Installation

### Voraussetzungen

- Linux, macOS oder Windows mit WSL2
- Node.js 14+ (empfohlen: 20 LTS)
- Git

### Installation in 3 Schritten

1. **Repository klonen**:
   ```bash
   git clone https://github.com/username/claude-code.git
   cd claude-code
   ```

2. **Schnellinstallation ausführen**:
   ```bash
   ./simple_install.sh
   ```

3. **Validierung starten**:
   ```bash
   ./saar-mcp.sh validate
   ```

## Die 5 wichtigsten Funktionen

### 1. DeepThink: KI-gestützte Gedankenanalyse

DeepThink kombiniert lokale Verarbeitung mit dem sequentialthinking MCP-Tool für erweiterte Analysen:

```bash
# Einfache Gedankenanalyse
./saar-mcp.sh deepthink "Wie kann ich die Performance meiner React-Anwendung verbessern?"

# Mit Gedächtnisspeicherung für spätere Verwendung
./saar-mcp.sh deepthink "Analysiere Vor- und Nachteile von GraphQL vs. REST für Microservices"
```

**Tipp**: DeepThink lernt mit jeder Nutzung und speichert Gedanken für spätere Verwendung, wenn Sie ähnliche Probleme analysieren.

### 2. Workflows: Automatisierte Aufgabenketten

Vorgefertigte Workflows für häufige Entwicklungsaufgaben:

```bash
# Code-Analyse durchführen
./saar-mcp.sh cross-tool code_analysis codeDir=/pfad/zum/projekt library=react

# Tests generieren
./saar-mcp.sh cross-tool test_generation codeDir=/pfad/zum/code language=javascript fileExt=js

# Dokumentation aktualisieren
./saar-mcp.sh cross-tool documentation_update codeDir=/pfad/zum/code language=javascript fileExt=js
```

**Tipp**: Sehen Sie sich die verfügbaren Workflows an mit `./saar-mcp.sh workflow list`

### 3. Gedächtnissystem: Wissensmanagement

Speichern, kategorisieren und abrufen von Wissen:

```bash
# Gedanken speichern
./saar-mcp.sh memory store "Für React-Performance-Optimierung: React.memo für funktionale Komponenten verwenden, useMemo für berechnungsintensive Funktionen, und useCallback für Callback-Funktionen."

# Wissen suchen
./saar-mcp.sh memory search "performance"

# Status anzeigen
./saar-mcp.sh memory status
```

**Tipp**: Das Gedächtnissystem kategorisiert automatisch, aber Sie können auch explizite Kategorien angeben: `./saar-mcp.sh memory store "Text" implementation`

### 4. Dashboard: Visualisierung und Kontrolle

Starten Sie das Dashboard für eine grafische Oberfläche:

```bash
./saar-mcp.sh ui-dashboard
```

Im Dashboard können Sie:
- System- und MCP-Tool-Status überwachen
- Workflows ausführen und überwachen
- Visualisierungen generieren
- Logs einsehen

**Tipp**: Verwenden Sie die "Visualisierungen generieren" Funktion, um tiefere Einblicke in Workflows und das Gedächtnissystem zu erhalten.

### 5. MCP-Tools mit Fallbacks

Verbinden Sie nahtlos mit MCP-Tools oder verwenden Sie lokale Fallbacks, wenn die Tools nicht verfügbar sind:

```bash
# MCP-Tool-Status prüfen
./saar-mcp.sh mcp status

# Fallbacks aktivieren
./saar-mcp.sh mcp fallback enable

# Verfügbare Fallbacks anzeigen
./saar-mcp.sh mcp fallback list
```

**Tipp**: Mit aktivierten Fallbacks läuft das System auch dann, wenn externe MCP-Tools nicht verfügbar sind.

## Einfaches Beispiel-Szenario

Hier ist ein vollständiges Beispiel für einen typischen Workflow:

### Neue Funktionsanalyse

1. **Anforderungsanalyse mit DeepThink**:
   ```bash
   ./saar-mcp.sh deepthink "Analysiere die Anforderungen für ein User Authentication System mit folgenden Anforderungen: Login, Registrierung, Passwort-Reset, OAuth-Integration, JWT-Token-basierte Sessions"
   ```

2. **Code-Struktur analysieren**:
   ```bash
   ./saar-mcp.sh cross-tool code_analysis codeDir=/pfad/zum/projekt library=express
   ```

3. **Testplan erstellen**:
   ```bash
   ./saar-mcp.sh cross-tool test_generation codeDir=/pfad/zum/projekt language=javascript fileExt=js
   ```

4. **Dashboard starten und Ergebnisse visualisieren**:
   ```bash
   ./saar-mcp.sh ui-dashboard
   ```
   
   Im Dashboard:
   1. Gehen Sie zum Visualisierungs-Tab
   2. Wählen Sie "Workflow" als Visualisierungstyp
   3. Geben Sie "test_generation" als Workflow-Namen ein
   4. Klicken Sie auf "Generieren"

5. **Ergebnisse im Gedächtnis speichern**:
   ```bash
   ./saar-mcp.sh memory store "Die Testgenerierung für das Authentifizierungssystem zeigt, dass wir Unit-Tests für die Auth-Controller, Integrationstests für die Authentifizierungs-Middleware und E2E-Tests für den vollständigen Login-Flow benötigen."
   ```

## Nächste Schritte

- Lesen Sie das vollständige [Benutzerhandbuch](/docs/guides/saar_mcp_user_manual.md)
- Erkunden Sie die [fortgeschrittenen Funktionen](/docs/guides/saar_mcp_advanced.md)
- Sehen Sie sich die [API-Dokumentation](/docs/api/saar_mcp_api.md) an

## Häufige Probleme und Lösungen

### Problem: MCP-Tool nicht verfügbar
```bash
./saar-mcp.sh mcp fallback enable
./saar-mcp.sh validate
```

### Problem: DeepThink-Fehler
```bash
./saar-mcp.sh deepthink "Prompt" --depth=3 --no-memory
```

### Problem: Dashboard startet nicht
```bash
./saar-mcp.sh ui-dashboard --debug
```

## Support und Hilfe

- [GitHub Issues](https://github.com/username/claude-code/issues)
- [Community-Forum](https://forum.example.com/claude-code)
- E-Mail: support@example.com