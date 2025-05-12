# Claude Neural Framework

> Eine umfassende Entwicklungsumgebung für KI-gestützte Anwendungen und Agent-Systeme

## Übersicht

Das Claude Neural Framework ist eine leistungsstarke Plattform für die Integration von Claude's neurokognitiven Fähigkeiten in Entwicklungs-Workflows. Es bietet eine standardisierte Struktur für KI-Dokumentation, Prompt-Engineering, Agent-Kommunikation und Entwicklungsumgebungen.

## Funktionen

- **Kognitives Framework**: Fortschrittliche KI-Integration mit Entwickler-Workflow
- **MCP-Server-Integration**: Unterstützung für Model Context Protocol Server
- **MCP React Hooks**: Direkte MCP-Integration in React-Komponenten
- **Agentenarchitektur**: Strukturierte Agent-zu-Agent-Kommunikation
- **Cognitive Prompting**: Umfangreiche Prompt-Bibliothek für verschiedene Anwendungsfälle
- **Entwicklungsumgebung**: Optimierte Tools für KI-gestützte Entwicklung

## Installation

```bash
# Repository klonen
git clone https://github.com/username/claude-code.git
cd claude-code

# Installation ausführen
./installation/install.sh
```

## Dokumentation

Die vollständige Dokumentation finden Sie im `docs`-Verzeichnis:

- [Einführung](docs/guides/introduction.md)
- [Architektur](docs/guides/architecture.md)
- [MCP-Integration](docs/guides/mcp-integration.md)
- [MCP Frontend Integration](docs/guides/mcp_frontend_integration.md)
- [MCP Hooks Usage](docs/guides/mcp_hooks_usage.md)
- [Cognitive Prompting](docs/guides/cognitive-prompting.md)
- [Agent-Kommunikation](docs/guides/agent-communication.md)

## Erste Schritte

Nach der Installation können Sie sofort mit der Nutzung des Frameworks beginnen:

```bash
# MCP-Server starten (inklusive Memory Persistence Server)
npx claude mcp start

# SAAR-Workflow verwenden
./saar.sh setup --quick

# Frontend mit MCP Hooks testen
node tests/hooks/test_mcp_hooks.js

# Claude Code CLI starten
npx claude
```

## Mitwirkung

Beiträge zum Projekt sind willkommen! Weitere Informationen finden Sie in [CONTRIBUTING.md](CONTRIBUTING.md).

## Lizenz

Dieses Projekt steht unter der MIT-Lizenz - siehe [LICENSE.md](LICENSE.md) für Details.
