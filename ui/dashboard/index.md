# Dashboard UI-Komponenten

Diese Dokumentation bietet einen Überblick über die modernisierten Dashboard-UI-Komponenten, die im Rahmen des UI-Verbesserungsprojekts entwickelt wurden.

## Implementierte Komponenten

- [Design-System: Farben](/workspace/ui/dashboard/design-system/colors.css) - Einheitliches Farbsystem mit Theme-Unterstützung
- [Design-System: Responsive](/workspace/ui/dashboard/design-system/responsive.css) - Einheitliches System für responsives Design
- [DynamicMetricTile](/workspace/ui/dashboard/components/DynamicMetricTile.js) - Moderne, dynamische Metrikkarten
- [BentoGrid](/workspace/ui/dashboard/components/BentoGrid.js) - Modernes Grid-Layout für Datenkarten
- [GradientCard](/workspace/ui/dashboard/components/GradientCard.js) - Moderne Kartendarstellung mit animierten Farbverläufen für Issues und Suggestions

## Dokumentation

- [Komponenten-Dokumentation](/workspace/ui/dashboard/components/README.md) - Detaillierte Dokumentation zur Verwendung der Komponenten
- [Tasks-Status](/workspace/ui/dashboard/TASKS.md) - Implementierungsstatus der UI-Verbesserungen

## Demo

- [Komponenten-Demo](/workspace/ui/dashboard/demo.html) - Interaktive Demo-Seite zum Testen der neuen Komponenten
- [Responsives Dashboard-Demo](/workspace/ui/dashboard/responsive-demo.html) - Demo für responsives Dashboard-Layout
- [Demo-Skript](/workspace/ui/dashboard/demo.js) - JavaScript für die Komponenten-Demo
- [Responsives Demo-Skript](/workspace/ui/dashboard/responsive-demo.js) - JavaScript für das responsive Dashboard

## Integration

Die Komponenten können direkt in bestehende HTML-Seiten integriert werden. Fügen Sie dazu die folgenden Zeilen in Ihre HTML-Datei ein:

```html
<!-- Design-System einbinden -->
<link href="/ui/dashboard/design-system/colors.css" rel="stylesheet" />
<link href="/ui/dashboard/design-system/responsive.css" rel="stylesheet" />

<!-- Komponenten-CSS einbinden -->
<link href="/ui/dashboard/components/DynamicMetricTile.css" rel="stylesheet" />
<link href="/ui/dashboard/components/BentoGrid.css" rel="stylesheet" />
<link href="/ui/dashboard/components/GradientCard.css" rel="stylesheet" />

<!-- Bootstrap Icons für Icons -->
<link
  href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css"
  rel="stylesheet"
/>

<!-- Komponenten-JavaScript -->
<script src="/ui/dashboard/components/DynamicMetricTile.js"></script>
<script src="/ui/dashboard/components/BentoGrid.js"></script>
<script src="/ui/dashboard/components/GradientCard.js"></script>
```

## Verwendung

### DynamicMetricTile

```javascript
const metricTile = new DynamicMetricTile({
  elementId: "metricContainer",
  title: "Aktive Benutzer",
  value: 1250,
  previousValue: 1100,
  format: "number",
  icon: "bi bi-people",
  trends: {
    showIcon: true,
    showPercentage: true,
  },
});
```

### BentoGrid

```javascript
const grid = new BentoGrid({
  elementId: "gridContainer",
  items: [
    {
      functionName: "parseData",
      filePath: "/src/parser.js",
      callCount: 256,
      status: "Aktiv",
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
    },
  },
});
```

Weitere Details finden Sie in der [Komponenten-Dokumentation](/workspace/ui/dashboard/components/README.md).
