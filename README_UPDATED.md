# Claude Neural Framework

> Eine fortschrittliche Integrationsplattform für Claude's KI-Fähigkeiten mit MCP, RAG und integrierten UI-Komponenten

## Übersicht

Das Claude Neural Framework bietet eine umfassende Lösung für die Integration von Claude's kognitiven Fähigkeiten in Entwicklungs-Workflows. Es kombiniert agentenbasierte Architektur, MCP-Integration (Model Context Protocol), fortschrittliches Prompt-Engineering und moderne UI-Komponenten in einer konsistenten Arbeitsumgebung.

## Neues Feature: Integrierte UI-Komponenten

Ab Version 2.0 bietet das Framework eine vollständig integrierte UI-Komponenten-Bibliothek, die das Beste aus der schema-ui-integration und den Dashboard-Komponenten vereint. Diese neue integrierte Bibliothek bietet:

- **Schema-basierte Formulare**: Automatisch generierte Formulare aus JSON-Schemas
- **Profilmanagement**: Komponenten zur Benutzerprofilverwaltung mit lokalem Speicher
- **Moderne Dashboard-Komponenten**: BentoGrid, AdvancedFilter, DynamicMetricTile und GradientCard
- **Einheitliches Design-System**: Konsistentes Theming und responsives Layout
- **Adaptives Framework**: Flexible Integration mit verschiedenen Backends

Weitere Informationen finden Sie in der [Dokumentation zu den integrierten UI-Komponenten](/docs/INTEGRATED_UI_COMPONENTS.md).

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

## Verwendung der UI-Komponenten

```javascript
// Importieren der Komponenten
import {
  BentoGrid,
  AdvancedFilter,
  EnhancedProfileForm,
  unifiedAdapter,
} from "./src/ui_components";

// Verwendung der Komponenten
const grid = new BentoGrid({
  elementId: "data-grid",
  items: myData,
  adapter: unifiedAdapter,
});

const profileForm = new EnhancedProfileForm({
  elementId: "profile-form",
  adapter: unifiedAdapter,
  onSave: (data) => {
    console.log("Profil gespeichert:", data);
  },
});
```

## Bestandteile

- **Core Framework**: Kernfunktionalitäten und Dienste
- **Model Context Protocol (MCP)**: Standardisierte Kommunikation mit Claude
- **Dashboard-UI**: Moderne, interaktive UI-Komponenten
- **Schema-UI**: Schema-basierte Formular- und Profilkomponenten
- **Agents**: Agentenbasierte Architektur für komplexe Workflows
- **RAG**: Retrieval Augmented Generation für Wissenserweiterung

## Migration

Wenn Sie von einer älteren Version des Frameworks migrieren, lesen Sie den [Migrations-Leitfaden](/docs/MIGRATION_GUIDE.md), der detaillierte Anweisungen zur Umstellung auf die integrierte Komponenten-Bibliothek enthält.

## Dokumentation

Die vollständige Dokumentation finden Sie im [Docs-Verzeichnis](/docs):

- [Integrierte UI-Komponenten](/docs/INTEGRATED_UI_COMPONENTS.md)
- [Migrations-Leitfaden](/docs/MIGRATION_GUIDE.md)
- [A2A-Protokoll-Guide](/docs/a2a_protocol_guide.md)
- [Git-Agent-Dokumentation](/docs/git_agent_documentation.md)

## Enterprise-Funktionen

Für Enterprise-Nutzer sind erweiterte Funktionen verfügbar. Siehe [Enterprise-README](/ENTERPRISE_README.md) für Details.

## Lizenz

Dieses Projekt steht unter der [MIT-Lizenz](/LICENSE.md).
