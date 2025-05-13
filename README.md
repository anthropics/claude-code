# Claude Neural Framework

Ein umfassendes Framework für die Integration von Claude-KI-Fähigkeiten in Entwicklungsworkflows, mit Agentenarchitektur, MCP-Integration und RAG-Framework.

## Überblick

Das Claude Neural Framework ist eine Plattform zur Integration von KI-Fähigkeiten in Entwicklungsprozesse. Es bietet:

- Ein System spezialisierter KI-Agenten für verschiedene Aufgaben
- MCP-Integration (Model Context Protocol) für erweiterte KI-Funktionen
- RAG-Framework (Retrieval Augmented Generation) für kontextbewusste Informationsbereitstellung
- Rekursive Debugging-Werkzeuge
- Automatisierte Dokumentationsgenerierung
- Umfassendes Sicherheitsframework mit TypeScript-Typisierung
- SAAR-Workflow für vereinfachte Konfiguration und Nutzung

## Architektur

Das Framework folgt einer Monorepo-Struktur mit klarer Modularisierung:

- **apps**: Anwendungskomponenten (CLI, API, Web)
- **libs**: Kernbibliotheken (Agents, Core, MCP, RAG, Workflows)
- **tools**: Entwicklungswerkzeuge
- **configs**: Konfigurationen
- **docs**: Dokumentation
  - **security**: [Sicherheitskonfiguration und -richtlinien](docs/security/security_config.example.json)

## Installation

```bash
# Repository klonen
git clone https://github.com/username/claude-framework.git
cd claude-framework

# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten
npm run dev
```

## Entwicklung

```bash
# Neue Bibliothek erstellen
npx nx g @nx/js:lib my-lib

# Neue App erstellen
npx nx g @nx/node:app my-app

# Tests ausführen
npm test

# Build durchführen
npm run build
```

## Lizenz

[MIT](LICENSE.md)