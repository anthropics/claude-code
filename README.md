# Claude Neural Framework

> Eine fortschrittliche Integrationsplattform für Claude's KI-Fähigkeiten mit MCP und RAG

## Übersicht

Das Claude Neural Framework bietet eine umfassende Lösung für die Integration von Claude's kognitiven Fähigkeiten in Entwicklungs-Workflows. Es kombiniert agentenbasierte Architektur, MCP-Integration (Model Context Protocol) und fortschrittliches Prompt-Engineering in einer konsistenten Arbeitsumgebung.

## Installation

```bash
# Repository klonen
git clone https://github.com/username/claude-code.git
cd claude-code

# Installation ausführen
./simple_install.sh

# API-Schlüssel konfigurieren
export CLAUDE_API_KEY="YOUR_CLAUDE_API_KEY"
```

## Hauptfunktionen

- **MCP-Integration**: Nahtlose Verbindung mit Model Context Protocol-Servern
- **RAG-Framework**: Retrieval Augmented Generation für kontextbasierte KI-Antworten
- **Agentenarchitektur**: Strukturiertes Agent-zu-Agent-Kommunikationsprotokoll
- **Codeanalyse**: Tiefgreifendes Verständnis von Codestrukturen und -mustern
- **Enterprise-Funktionen**: Erweiterte Sicherheit, Compliance, SSO und Unternehmensintegrationen für Organisationen (siehe [Enterprise-Dokumentation](/docs/enterprise/README.md))

## Verzeichnisstruktur

```
claude-code/
├── core/                # Kernfunktionalität
│   ├── config/          # Konfigurationsdateien
│   ├── mcp/             # MCP-Integration
│   └── rag/             # RAG-Framework
├── agents/              # Agentenbasierte Architektur
│   └── commands/        # Agentenbefehle
├── cognitive/           # Kognitive Komponenten
│   ├── prompts/         # Prompt-Bibliothek
│   └── templates/       # Wiederverwendbare Templates
├── docs/                # Dokumentation
│   ├── architecture/    # Architekturdetails
│   ├── enterprise/      # Enterprise-Funktionen
│   ├── guides/          # Anleitungen
│   └── examples/        # Beispiele
└── saar.sh              # Setup, Activate, Apply, Run Script
```

## Enterprise-Funktionen

Das Claude Neural Framework bietet umfassende Funktionen für Unternehmensumgebungen:

- **Verbesserte Sicherheit**: SAML/OAuth-Unterstützung, Rollenbasierte Zugriffskontrolle, IP-Beschränkungen
- **Compliance**: Unterstützung für GDPR, HIPAA, SOC2 und andere Frameworks
- **Unternehmensintegrationen**: Active Directory, JIRA, CRM-Systeme, CI/CD-Pipelines
- **Benutzerverwaltung**: Zentrale Benutzerverwaltung und Provisioning
- **Enterprise-Workflows**: Angepasste Git-Workflows mit Genehmigungsprozessen

Weitere Informationen finden Sie in der [Enterprise-Dokumentation](/docs/enterprise/README.md) und im [Enterprise Quick Start Guide](/docs/enterprise/quick_start.md).