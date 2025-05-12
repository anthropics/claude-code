/**
 * Beispiel für die Verwendung der integrierten UI-Komponenten
 *
 * Dieses Beispiel zeigt, wie man die verschiedenen UI-Komponenten
 * aus dem integrierten Paket in einer Anwendung verwenden kann.
 */

import {
  BentoGrid,
  AdvancedFilter,
  DynamicMetricTile,
  GradientCard,
  unifiedAdapter,
  lightweightAdapter,
} from "./ui_components";

import { EnhancedProfileForm, MemoryProvider } from "./schema_ui";

// Beispiel für eine Anwendung, die alle Komponenten integriert
function App() {
  // Profile-Komponente mit dem unifiedAdapter
  const profileElement = document.getElementById("profile-form-container");
  if (profileElement) {
    // Rendering der ProfileForm mit dem vereinheitlichten Adapter
    const profileForm = new EnhancedProfileForm({
      containerId: "profile-form-container",
      adapter: unifiedAdapter,
      onSave: (data) => {
        unifiedAdapter.logger.info("Profil gespeichert:", data);
      },
    });
    profileForm.render();
  }

  // Dashboard-Komponenten mit dem lightweightAdapter für einfachere UI-Widgets

  // BentoGrid mit AdvancedFilter
  const gridData = [
    { id: 1, name: "Beispieldaten 1", status: "Aktiv", category: "A" },
    { id: 2, name: "Beispieldaten 2", status: "Inaktiv", category: "B" },
    // weitere Daten...
  ];

  const bentoGrid = new BentoGrid({
    elementId: "data-grid-container",
    items: gridData,
    columns: {
      name: { label: "Name", sortable: true },
      status: { label: "Status", sortable: true },
      category: { label: "Kategorie", sortable: true },
    },
    useAdvancedFilter: true,
    advancedFilterId: "data-grid-filter",
    adapter: lightweightAdapter,
  });

  // DynamicMetricTile für Statistiken
  new DynamicMetricTile({
    elementId: "metric-1",
    title: "Aktive Nutzer",
    value: 1234,
    previousValue: 1100,
    format: "number",
    icon: "bi-person",
    adapter: lightweightAdapter,
  });

  // GradientCard für Recent Issues
  new GradientCard({
    elementId: "recent-issues",
    items: [
      {
        title: "Fehler im Login-System",
        severity: "high",
        timestamp: new Date(),
      },
      {
        title: "Performance-Problem in der Suche",
        severity: "medium",
        timestamp: new Date(),
      },
    ],
    gradient: {
      type: "issue",
      animated: true,
    },
    adapter: lightweightAdapter,
  });
}

// App initialisieren
document.addEventListener("DOMContentLoaded", App);
