# Migrations-Leitfaden: Integration von schema-ui-integration und src

Dieser Leitfaden hilft Entwicklern dabei, von den separaten Implementierungen in `schema-ui-integration` und `src` zur neuen integrierten Bibliothek zu wechseln.

## Übersicht

Die Integration kombiniert die besten Teile aus:

- `/schema-ui-integration/src`
- `/src`
- `/ui/dashboard/components`

in eine einheitliche, modulare Bibliothek unter:

- `/src/ui_components`
- `/src/schema_ui`

## Schritt-für-Schritt Migration

### 1. Importe aktualisieren

#### Vorher (schema-ui-integration):

```javascript
import { MemoryProfileForm, MemoryProvider } from "schema-ui-integration";
import { SchemaForm } from "schema-ui-integration/components/form";
import { createFrameworkAdapter } from "schema-ui-integration/adapters";
```

#### Nachher:

```javascript
import {
  EnhancedProfileForm,
  MemoryProvider,
  SchemaForm,
  unifiedAdapter,
  lightweightAdapter,
} from "./ui_components";

// Oder direkte Importe
import { EnhancedProfileForm } from "./schema_ui/components/profile/EnhancedProfileForm";
import { createFrameworkAdapter } from "./schema_ui/adapters";
```

### 2. UI-Dashboard-Komponenten

#### Vorher:

```html
<!-- Script-Tags -->
<script src="/ui/dashboard/components/BentoGrid.js"></script>
<script src="/ui/dashboard/components/AdvancedFilter.js"></script>

<script>
  // Globale Klassen verwenden
  const grid = new BentoGrid({
    elementId: "grid-container",
    // Optionen...
  });
</script>
```

#### Nachher:

```javascript
// Modularer Import
import { BentoGrid, AdvancedFilter } from "./ui_components";

// ESM-Modul oder mit Bundler
const grid = new BentoGrid({
  elementId: "grid-container",
  adapter: lightweightAdapter,
  // Optionen...
});
```

Für Legacy-Unterstützung: Es wird weiterhin ein Bundle bereitgestellt, das globale Klassen exportiert.

### 3. Adapter-Verwendung

#### Vorher:

```javascript
// Schema-UI-Integration Adapter
import { createFrameworkAdapter } from "schema-ui-integration/adapters";
const adapter = createFrameworkAdapter({
  logger: myLogger,
  // weitere Dienste...
});

// Oder direkte Core-Framework-Verwendung
import logger from "../../core/logging/logger";
import * as errorHandler from "../../core/error/error_handler";
```

#### Nachher:

```javascript
// Integrierter Adapter mit allen Funktionen
import { unifiedAdapter } from "./ui_components";

// Oder eigener Adapter
import { createFrameworkAdapter } from "./ui_components";
const customAdapter = createFrameworkAdapter({
  logger: myLogger,
  // weitere Dienste...
});
```

### 4. Design-System verwenden

#### Vorher:

```html
<!-- CSS-Imports -->
<link href="/ui/dashboard/design-system/colors.css" rel="stylesheet" />
<link href="/ui/dashboard/design-system/responsive.css" rel="stylesheet" />
```

#### Nachher:

```javascript
// CSS-Module import (wenn unterstützt)
import "./ui_components/design-system/colors.css";
import "./ui_components/design-system/responsive.css";

// Oder weiterhin als Link-Tags
<link href="/src/ui_components/design-system/colors.css" rel="stylesheet" />;
```

### 5. Memory-System Migration

#### Vorher:

```javascript
import { useMemory } from "schema-ui-integration/components/profile/MemoryProvider";
import { MemorySystem } from "schema-ui-integration/utils/memory";

const memorySystem = new MemorySystem({
  storage: localStorage,
  prefix: "my-app",
});
```

#### Nachher:

```javascript
import { useMemory } from "./ui_components";
import { EnhancedMemorySystem } from "./schema_ui/utils/enhanced-memory";

const memorySystem = new EnhancedMemorySystem({
  storage: localStorage,
  prefix: "my-app",
  adapter: unifiedAdapter, // Optionaler integrierter Adapter
});
```

## Test-Strategie

Beim Migrieren von Code empfehlen wir diesen Testansatz:

1. **Unit-Tests**: Führen Sie bestehende Unit-Tests gegen die neuen Komponenten aus
2. **Smoke-Tests**: Überprüfen Sie grundlegende Funktionalität in einer Testumgebung
3. **Integration-Tests**: Testen Sie das Zusammenspiel aller Komponenten
4. **UI-Tests**: Visuelle Regression-Tests, um sicherzustellen, dass sich nichts verändert hat

## Bekannte Probleme und Workarounds

### Problem: Abhängigkeiten zu älteren Frameworks

Wenn Ihre Anwendung von älteren Framework-Versionen abhängt:

```javascript
// Adapter für Legacy-Framework
import { createLegacyAdapter } from "./ui_components/adapters/legacy";
const legacyAdapter = createLegacyAdapter({
  // Legacy-Dienste...
});

// Komponenten mit Legacy-Adapter verwenden
const form = new EnhancedProfileForm({
  adapter: legacyAdapter,
  // weitere Optionen...
});
```

### Problem: CSS-Konflikte

Wenn es zu CSS-Konflikten kommt:

```css
/* In Ihrer CSS-Datei */
[data-namespace="new-ui"] .component-class {
  /* Ihre überschreibenden Stile */
}

/* HTML-Markup */
<div data-namespace="new-ui">
  <!-- Ihre Komponenten hier -->
</div>
```

## Zeitplan für die vollständige Migration

Wir empfehlen folgenden Zeitplan:

1. **Woche 1**: Core-Komponenten und Adapter migrieren
2. **Woche 2**: UI-Komponenten und Tests anpassen
3. **Woche 3**: Legacy-Unterstützung und Edge Cases behandeln
4. **Woche 4**: Vollständige Validierung und Clean-up

## Hilfe und Support

Bei Problemen mit der Migration wenden Sie sich an:

- Dokumentation: `/docs/INTEGRATED_UI_COMPONENTS.md`
- Support-Team: support@example.com
- Issue-Tracker: [GitHub Issues](https://github.com/example/project/issues)

Ein umfassender Workshop zur Migration wird am 19.05.2025 stattfinden.
