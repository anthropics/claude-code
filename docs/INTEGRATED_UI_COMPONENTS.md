# Integrierte UI-Komponenten Dokumentation

Dieses Dokument beschreibt die integrierte UI-Komponenten-Bibliothek, die Funktionen aus mehreren Quellen zusammenführt und optimiert.

## Übersicht

Die neue integrierte Bibliothek kombiniert:

1. **Schema-UI-Integration**: Formular- und Profilkomponenten mit Schema-basierter Validierung
2. **Dashboard-UI-Komponenten**: Moderne, interaktive Komponenten wie BentoGrid, AdvancedFilter, DynamicMetricTile und GradientCard
3. **Vereinheitlichte Adapter**: Einheitliche Schnittstelle für Framework-Integrationen

## Verzeichnisstruktur

```
/src/
  /ui_components/             # Hauptverzeichnis für alle UI-Komponenten
    index.js                  # Exportiert alle Komponenten
    adapters.js               # Vereinheitlichte Adapter
    /dashboard/               # Dashboard-Komponenten (BentoGrid, etc.)
    /design-system/           # Farben, responsive Layouts

  /schema_ui/                 # Schema-basierte UI-Komponenten
    /adapters/                # Adapter für verschiedene Backends
    /components/              # Schema-Formular-Komponenten
    /schemas/                 # JSON-Schemas für Formulare
    /utils/                   # Hilfsfunktionen (Memory-System, etc.)
```

## Verwendung der Komponenten

### Import der Komponenten

```javascript
// Importieren aller Komponenten
import {
  BentoGrid,
  AdvancedFilter,
  DynamicMetricTile,
  EnhancedProfileForm,
  unifiedAdapter,
} from "./ui_components";

// Oder einzelne Komponenten importieren
import { BentoGrid } from "./ui_components/dashboard/BentoGrid";
```

### Adapter verwenden

Die Bibliothek bietet zwei Hauptadapter:

- `unifiedAdapter`: Vollständige Integration mit allen Framework-Funktionen
- `lightweightAdapter`: Minimale Abhängigkeiten für isolierte UI-Komponenten

```javascript
import { unifiedAdapter, lightweightAdapter } from "./ui_components";

// Komponente mit Adapter initialisieren
const bentoGrid = new BentoGrid({
  adapter: unifiedAdapter,
  // weitere Optionen...
});
```

### Beispiele

#### BentoGrid mit AdvancedFilter

```javascript
const bentoGrid = new BentoGrid({
  elementId: "data-grid",
  items: myData,
  columns: {
    name: { label: "Name", sortable: true },
    status: { label: "Status", sortable: true },
  },
  useAdvancedFilter: true,
  advancedFilterId: "data-filter",
});
```

#### DynamicMetricTile

```javascript
new DynamicMetricTile({
  elementId: "metric-tile",
  title: "Aktive Benutzer",
  value: 1234,
  previousValue: 1100,
  format: "number",
  icon: "bi-person",
});
```

#### EnhancedProfileForm

```javascript
import { EnhancedProfileForm } from "./ui_components";

new EnhancedProfileForm({
  elementId: "profile-form",
  adapter: unifiedAdapter,
  onSave: (data) => {
    console.log("Profil gespeichert:", data);
  },
});
```

## Migration von alten Implementierungen

### Von schema-ui-integration

Wenn Sie zuvor direkt aus `schema-ui-integration` importiert haben:

```javascript
// Alte Implementierung
import { MemoryProfileForm } from "schema-ui-integration";

// Neue Implementierung
import { EnhancedProfileForm, lightweightAdapter } from "./ui_components";

const form = new EnhancedProfileForm({
  adapter: lightweightAdapter,
  // weitere Optionen...
});
```

### Von ui/dashboard-Komponenten

Wenn Sie zuvor die Dashboard-Komponenten verwendet haben:

```javascript
// Alte Implementierung - global verfügbare Klassen
const grid = new BentoGrid({
  elementId: "grid",
});

// Neue Implementierung - modulbasierter Import
import { BentoGrid } from "./ui_components";

const grid = new BentoGrid({
  elementId: "grid",
  adapter: lightweightAdapter,
});
```

## Vorteile der Integration

1. **Einheitliche API**: Konsistente Schnittstellen für alle Komponenten
2. **Adapter-Muster**: Flexible Integration mit verschiedenen Backend-Systemen
3. **Modularer Aufbau**: Komponenten können einzeln oder als Paket verwendet werden
4. **Optimierte Abhängigkeiten**: Leichtgewichtige Implementierungen wo möglich
5. **Framework-Agnostik**: Kann in verschiedenen Umgebungen verwendet werden

## Bekannte Probleme und Einschränkungen

- Einige ältere Browser unterstützen möglicherweise nicht alle Funktionen
- Die Integration mit bestehenden Anwendungen kann angepasst werden müssen

## Nächste Schritte

- Weitere UI-Komponenten in die Bibliothek integrieren
- Vollständige TypeScript-Typendefinitionen hinzufügen
- Unit-Tests für alle Komponenten erweitern
- Beispiel-Anwendungen erstellen
