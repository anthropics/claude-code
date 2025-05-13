# SAAR - Setup, Activate, Apply, Run

SAAR ist ein all-in-one-Script für die einfache Installation, Konfiguration und Verwendung des Claude Neural Framework. Es bietet eine vereinfachte Schnittstelle für alle wichtigen Funktionen des Frameworks.

## Übersicht

SAAR kombiniert die vier Hauptfunktionen des Claude Neural Framework:

- **Setup**: Installation und Konfiguration des Frameworks
- **Activate**: Aktivierung von Benutzerprofilen und Farbschemata
- **Apply**: Anwendung von Konfigurationen auf Projekte
- **Run**: Ausführung von MCP-Servern und dem Claude-Agenten

## Installation

Das SAAR-Script ist im Hauptverzeichnis des Frameworks als `saar.sh` verfügbar. Sie können es direkt ausführen:

```bash
./saar.sh
```

Stellen Sie sicher, dass das Script ausführbar ist. Bei Bedarf können Sie die Berechtigungen anpassen:

```bash
chmod +x saar.sh
```

## Verwendung

SAAR bietet verschiedene Befehle für unterschiedliche Funktionen des Frameworks:

### Vollständige Einrichtung

```bash
./saar.sh setup
```

Dieser Befehl führt eine vollständige, interaktive Einrichtung des Frameworks durch, inklusive:
- Installation der Abhängigkeiten
- Konfiguration der API-Schlüssel
- Einrichtung des Farbschemas
- Erstellung des `.about`-Profils
- Konfiguration der MCP-Server

### Schnelle Einrichtung

```bash
./saar.sh setup --quick
```

Die schnelle Einrichtung verwendet Standardwerte und minimiert Benutzerinteraktionen.

### Farbschema-Konfiguration

```bash
./saar.sh colors
```

Konfigurieren Sie das Farbschema interaktiv.

```bash
./saar.sh colors --theme=dark
```

Wenden Sie ein spezifisches Thema direkt an (verfügbare Themen: light, dark, blue, green, purple).

### .about-Profil konfigurieren

```bash
./saar.sh about
```

Erstellen oder aktualisieren Sie Ihr `.about`-Profil interaktiv.

### Projekteinrichtung

```bash
./saar.sh project
```

Richten Sie ein neues Projekt interaktiv ein.

```bash
./saar.sh project --template=web
```

Erstellen Sie ein Projekt mit einer spezifischen Vorlage (verfügbare Vorlagen: web, api, cli, library).

### MCP-Server starten

```bash
./saar.sh start
```

Starten Sie die MCP-Server des Frameworks.

### Claude-Agenten starten

```bash
./saar.sh agent
```

Starten Sie den Claude-Agenten in der Kommandozeile.

## Optionen

SAAR unterstützt verschiedene Optionen für die Befehle:

- `--quick`: Schnelle Einrichtung mit Standardwerten
- `--force`: Erzwinge das Überschreiben bestehender Konfigurationen
- `--theme=X`: Wähle ein spezifisches Thema (light, dark, blue, green, purple)
- `--template=X`: Wähle eine spezifische Projektvorlage (web, api, cli, library)

## Konfiguration

SAAR verwendet die folgenden Konfigurationsdateien:

- `~/.claude/user.about.json`: Benutzer-Profil
- `~/.claude/user.colorschema.json`: Farbschema-Einstellungen
- `~/.claude/api_keys.json`: API-Schlüssel für verschiedene Dienste

Diese Dateien werden während der Einrichtung erstellt und können jederzeit mit den entsprechenden SAAR-Befehlen aktualisiert werden.

## Einrichtungsworkflow

Der empfohlene Workflow für die Arbeit mit dem Claude Neural Framework über SAAR ist:

1. **Vollständige Einrichtung**: `./saar.sh setup`
2. **Projekt einrichten**: `./saar.sh project --template=web`
3. **MCP-Server starten**: `./saar.sh start`
4. **Claude-Agenten starten**: `./saar.sh agent`

Für erfahrene Benutzer kann der schnelle Workflow verwendet werden:

```bash
# Schnelle Einrichtung mit dunklem Thema
./saar.sh setup --quick --theme=dark

# Web-Projekt erstellen
./saar.sh project --template=web

# Server und Agent starten
./saar.sh start
```

## Fehlerbehebung

Wenn Probleme mit SAAR auftreten:

1. Stellen Sie sicher, dass alle Abhängigkeiten installiert sind (Node.js 18+, npm, Python 3.8+, Git)
2. Überprüfen Sie, ob das Script ausführbar ist (`chmod +x saar.sh`)
3. Stellen Sie sicher, dass die Konfigurationsdateien in `~/.claude/` vorhanden und gültig sind
4. Prüfen Sie die Log-Dateien in `~/.claude/logs/` auf Fehler