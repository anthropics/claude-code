# UI-Komponenten Dokumentation

Diese Dokumentation beschreibt die modernisierten UI-Komponenten für das Dashboard, die im Rahmen des Verbesserungs-Backlogs implementiert wurden.

## Überblick

Die neuen UI-Komponenten sind Teil eines umfassenden Ansatzes zur Verbesserung des Dashboards mit modernen Design-Prinzipien, besserer visueller Hierarchie, verbesserter Responsivität und interaktiven Elementen.

## Inhaltsverzeichnis

1. [Design-System](#design-system)
2. [DynamicMetricTile](#dynamicmetrictile)
3. [BentoGrid](#bentogrid)
4. [Integration](#integration)
5. [Best Practices](#best-practices)

## Design-System

Das Design-System bildet die Grundlage für alle UI-Komponenten und stellt sicher, dass ein konsistentes Erscheinungsbild über die gesamte Anwendung hinweg gewährleistet ist.

### Farben

Die Datei `design-system/colors.css` definiert ein umfassendes Farbsystem mit:

- Basis-Farbpalette als Referenz
- Funktionelle Farben für verschiedene Themes (hell, dunkel, blau, grün, violett)
- Status- und Feedback-Farben (Erfolg, Warnung, Gefahr, Info)
- Hilfsklassen für direkte Anwendung

Beispiel für die Verwendung:

```css
/* Farbvariablen verwenden */
.my-element {
  background-color: var(--primary-color);
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

/* Hilfsklassen verwenden */
<div class="bg-primary text-white">Primärfarbe mit weißem Text</div>
<span class="badge-success-soft">Erfolg</span>
```

### Theme-Unterstützung

Alle Komponenten unterstützen automatisch helle und dunkle Themes sowie Farbvarianten. Um das Theme zu wechseln, fügen Sie eine der folgenden Klassen zum `<body>`-Element oder ein entsprechendes Attribut zum `<html>`-Element hinzu:

- `dark-theme` oder `data-theme="dark"` für das dunkle Theme
- `blue-theme` oder `data-theme="blue"` für das blaue Theme
- `green-theme` oder `data-theme="green"` für das grüne Theme
- `purple-theme` oder `data-theme="purple"` für das violette Theme

## DynamicMetricTile

Die `DynamicMetricTile`-Komponente ersetzt die statischen Metrikkarten mit dynamischen, interaktiven Karten, die Trends, Statusfarben und Animationen unterstützen.

### Features

- Trend-Indikatoren mit Aufwärts-/Abwärtspfeilen
- Farbkodierung nach Statuswert (positiv/negativ)
- Prozentuale Änderungen
- Animierte Übergänge bei Wertänderungen
- Responsives Design
- Vollständige Theme-Unterstützung

### Verwendung

```javascript
// HTML-Struktur
<div id="metricTileContainer"></div>;

// Javascript
const metricTile = new DynamicMetricTile({
  elementId: "metricTileContainer",
  title: "Aktive Benutzer",
  value: 1250,
  previousValue: 1100, // Für Trend-Berechnung
  format: "number", // 'number', 'percentage', 'currency', 'decimal'
  icon: "bi bi-people",
  trends: {
    showIcon: true,
    showPercentage: true,
    inverseColors: false, // True für Metriken, bei denen niedriger besser ist
  },
});

// Wert aktualisieren
metricTile.update(1300, 1250);
```

### Optionen

| Option          | Typ    | Standard   | Beschreibung                                                        |
| --------------- | ------ | ---------- | ------------------------------------------------------------------- |
| `elementId`     | String | -          | ID des DOM-Elements, in dem die Karte gerendert werden soll         |
| `title`         | String | `''`       | Titel der Metrik                                                    |
| `value`         | Number | `0`        | Aktueller Wert                                                      |
| `previousValue` | Number | `null`     | Vorheriger Wert für die Trend-Berechnung                            |
| `format`        | String | `'number'` | Formatierung: `'number'`, `'percentage'`, `'currency'`, `'decimal'` |
| `icon`          | String | `null`     | CSS-Klasse für das Icon (Bootstrap Icons oder Font Awesome)         |
| `thresholds`    | Object | `{}`       | Schwellenwerte für Farbkodierung                                    |
| `trends`        | Object | `{}`       | Konfiguration für Trend-Anzeige                                     |

## BentoGrid

Die `BentoGrid`-Komponente ersetzt traditionelle Tabellen durch ein modernes, responsives Grid-Layout mit Karten, das eine visuell ansprechendere Darstellung von Daten ermöglicht.

### Features

- Responsives Grid-Layout mit konfigurierbaren Spalten
- Erweiterbare Karten (colSpan)
- Status-Badges und Tags
- Integrierte Such- und Filterfunktionen
- Sortieroptionen
- Interaktive Elemente und Aktionsbuttons
- Animierte Übergänge
- Vollständige Theme-Unterstützung

### Verwendung

```javascript
// HTML-Struktur
<div id="bentogridContainer"></div>;

// Javascript
const grid = new BentoGrid({
  elementId: "bentogridContainer",
  items: [
    {
      functionName: "parseData",
      filePath: "/src/parser.js",
      callCount: 256,
      status: "Aktiv",
      tags: ["Parser", "Kritisch"],
      icon: "bi bi-code-slash",
      colSpan: 1,
    },
    // Weitere Items...
  ],
  columns: {
    functionName: {
      label: "Funktion",
      primary: true,
    },
    filePath: {
      label: "Dateipfad",
    },
    callCount: {
      label: "Aufrufe",
      formatter: (value) => value.toLocaleString(),
    },
  },
  onItemClick: (item) => {
    console.log("Item geklickt:", item);
  },
  filters: {
    searchable: true,
    filterable: true,
    filterKey: "tags",
    options: [
      { value: "Kritisch", label: "Kritisch" },
      { value: "Parser", label: "Parser" },
    ],
  },
});

// Items aktualisieren
grid.setItems(newItems);

// Item hinzufügen
grid.addItem({
  functionName: "newFunction",
  filePath: "/src/new.js",
  callCount: 10,
});

// Item aktualisieren
grid.updateItem(0, { callCount: 300 });

// Item entfernen
grid.removeItem(1);
```

### Optionen

| Option        | Typ      | Standard | Beschreibung                                                  |
| ------------- | -------- | -------- | ------------------------------------------------------------- |
| `elementId`   | String   | -        | ID des DOM-Elements, in dem das Grid gerendert werden soll    |
| `items`       | Array    | `[]`     | Daten-Items, die angezeigt werden sollen                      |
| `columns`     | Object   | `{}`     | Spalten-Konfiguration mit Formatierern                        |
| `layout`      | Object   | `{}`     | Layout-Konfiguration (gap, minWidth, maxColumns, aspectRatio) |
| `onItemClick` | Function | `null`   | Callback für Klicks auf Items                                 |
| `filters`     | Object   | `null`   | Filter-Konfiguration                                          |

## GradientCard

Die `GradientCard`-Komponente bietet eine moderne Kartendarstellung mit animierten Farbverläufen, interaktiven Elementen und visueller Hierarchie. Sie wird für Recent Issues und Optimization Suggestions verwendet und ersetzt die einfachen issue-card- und suggestion-card-Komponenten.

### Features

- Animierte Farbverläufe für visuelle Hierarchie und Aufmerksamkeit
- Konfigurierbare Blureffekte für Tiefe und visuelle Differenzierung
- Status-basierte visuelle Unterscheidung durch Farben
- Hover-Effekte mit kontextbezogenen Aktionen
- Interaktive Elemente für detailliertere Informationen
- Responsives Design für alle Bildschirmgrößen

### Verwendung

```javascript
// HTML-Struktur
<div id="issuesCardContainer"></div>;

// Javascript
const issuesCard = new GradientCard({
  elementId: "issuesCardContainer",
  items: issuesData, // Array von Issue-Objekten
  gradient: {
    type: "issue", // 'default', 'issue', 'suggestion', 'info', 'warning', 'success', 'error'
    animated: true, // Animation aktivieren/deaktivieren
    intensity: 0.7, // Intensität des Farbverlaufs (0.0 bis 1.0)
    blur: 20, // Blur-Stärke in Pixel
  },
  onItemClick: (item) => {
    // Callback für Klick auf ein Item
    console.log("Item angeklickt:", item);
  },
  onShowMore: (items) => {
    // Callback für Klick auf "Mehr anzeigen"
    console.log("Alle Items anzeigen:", items);
  },
});

// Items aktualisieren
issuesCard.updateItems(newIssuesData);

// Gradient-Konfiguration aktualisieren
issuesCard.updateGradient({
  animated: false,
  intensity: 0.5,
});
```

### Item-Datenstruktur

Ein Item kann folgende Eigenschaften haben:

```javascript
{
  id: "ISS001", // Eindeutige ID
  title: "Stack-Overflow in recursive_sum.js", // Titel
  description: "Beschreibung des Issues oder der Suggestion", // Beschreibung
  timestamp: "2025-05-10T14:30:22", // Zeitstempel (ISO-String oder Date-Objekt)
  status: "Critical", // Status (z.B. Critical, Error, Warning, Info, Success)
  icon: "bi bi-exclamation-triangle-fill", // Icon-Klasse
  actions: [ // Optionale Aktionen/Buttons
    {
      title: "Als gelöst markieren", // Tooltip
      icon: "bi bi-check-circle", // Icon-Klasse
      handler: (item) => { // Click-Handler
        console.log("Issue als gelöst markiert:", item);
      }
    }
  ]
}
```

### Optionen

| Option               | Typ      | Standard    | Beschreibung                                                |
| -------------------- | -------- | ----------- | ----------------------------------------------------------- |
| `elementId`          | String   | -           | ID des DOM-Elements, in dem die Karte gerendert werden soll |
| `items`              | Array    | `[]`        | Array von Datenobjekten, die angezeigt werden sollen        |
| `gradient.type`      | String   | `'default'` | Typ des Farbverlaufs                                        |
| `gradient.animated`  | Boolean  | `true`      | Animation des Farbverlaufs aktivieren/deaktivieren          |
| `gradient.intensity` | Number   | `0.7`       | Intensität des Farbverlaufs (0.0 bis 1.0)                   |
| `gradient.blur`      | Number   | `20`        | Stärke des Blur-Effekts in Pixel                            |
| `layout.maxItems`    | Number   | `5`         | Maximale Anzahl an Items pro Karte                          |
| `onItemClick`        | Function | `null`      | Callback-Funktion bei Klick auf ein Item                    |
| `onShowMore`         | Function | `null`      | Callback-Funktion bei Klick auf "Mehr anzeigen"             |

### Gradient-Typen

Die Komponente unterstützt verschiedene vordefinierte Gradient-Typen:

- `default`: Standard-Farbverlauf (blau/violett)
- `issue`: Farbverlauf für Issues (orange/rot)
- `suggestion`: Farbverlauf für Optimierungsvorschläge (blau/grün)
- `success`: Grüner Farbverlauf
- `warning`: Oranger Farbverlauf
- `danger`: Roter Farbverlauf
- `info`: Blauer Farbverlauf

## AdvancedFilter

Die `AdvancedFilter`-Komponente ermöglicht erweiterte Such- und Filteroptionen für Daten mit mehreren Kategorien und Schnellsuche. Sie bietet Live-Filterung, kategorienbasierte Multiselect-Filter und speichert die Filter-History.

### Hauptfeatures

- **Live-Filterung**: Filtert Daten während der Eingabe ohne Neuladen
- **Kategorienbasierte Filter**: Ermöglicht das Filtern nach verschiedenen Kategorien mit Multiselect-Optionen
- **Schnellsuche mit Hervorhebung**: Hebt Suchbegriffe in den Ergebnissen hervor
- **Filter-History**: Speichert frühere Suchen für schnellen Zugriff
- **Gespeicherte Filter**: Erlaubt das Speichern komplexer Filtereinstellungen
- **Responsives Design**: Passt sich verschiedenen Bildschirmgrößen an

### Verwendung

```javascript
// HTML-Struktur
<div id="myFilter"></div>;

// Javascript
const advancedFilter = new AdvancedFilter({
  elementId: "myFilter",
  filters: {
    categories: [
      {
        id: "status",
        label: "Status",
        options: [
          { id: "active", label: "Aktiv" },
          { id: "inactive", label: "Inaktiv" },
          { id: "pending", label: "Ausstehend" },
        ],
      },
      {
        id: "category",
        label: "Kategorie",
        options: [
          { id: "a", label: "Kategorie A" },
          { id: "b", label: "Kategorie B" },
          { id: "c", label: "Kategorie C" },
        ],
      },
    ],
  },
  onFilterChange: function (filters) {
    console.log("Filter geändert:", filters);
    // Hier die gefilterten Daten verarbeiten
  },
  storageName: "my-filter-history", // Name für den localStorage
});

// Aktive Filter abrufen
const currentFilters = advancedFilter.getActiveFilters();

// Filter programmatisch setzen
advancedFilter.setActiveFilters({
  search: "Suchbegriff",
  categories: {
    status: ["active", "pending"],
    category: ["a"],
  },
});
```

### Integration mit BentoGrid

Die `AdvancedFilter`-Komponente kann einfach mit der `BentoGrid`-Komponente kombiniert werden:

```javascript
// BentoGrid mit AdvancedFilter-Integration
const gridConfig = {
  elementId: "myGrid",
  title: "Datenübersicht",
  data: myData,
  columns: [
    { id: "name", label: "Name", sortable: true },
    { id: "category", label: "Kategorie", sortable: true },
    { id: "status", label: "Status", sortable: true },
  ],
  useAdvancedFilter: true, // AdvancedFilter aktivieren
  advancedFilterId: "myGridFilter", // ID des Filter-Elements
  advancedFilterConfig: {
    // Optionale zusätzliche Filter-Konfiguration
    storageName: "my-grid-filter",
  },
  // Aktivierung der Hervorhebung für die Suche
  highlightSearch: true,
  searchFields: ["name", "description", "category", "status"],
  // Aktivierung der Markierung von Filtertreffern
  visualFilterFeedback: true,
};

const bentoGrid = new BentoGrid(gridConfig);
```

### Demo

Eine vollständige Demo der Such- und Filterfunktionen finden Sie in `filter-demo.html`, die folgende Funktionen demonstriert:

- Live-Filterung von Daten
- Kategoriebasierte Filter-Optionen
- Suche mit Hervorhebung von Treffern
- Speichern von Filtern und Filter-History
- Dark/Light-Theme-Unterstützung
