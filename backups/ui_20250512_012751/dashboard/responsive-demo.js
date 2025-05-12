/**
 * Responsive Dashboard Demo
 * ========================
 *
 * Dieses Skript initialisiert das responsive Dashboard-Demo mit
 * optimierten Layouts für verschiedene Bildschirmgrößen.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Globale Einstellungen
  updateDeviceInfo();
  initializeThemeToggle();
  initializeSidebarToggle();

  // Komponenten initialisieren
  initializeMetrics();
  initializeBentoGrid();
  initializeCards();

  // Beim Ändern der Fenstergröße die Geräteinformationen aktualisieren
  window.addEventListener("resize", updateDeviceInfo);
});

/**
 * Aktualisiert die Anzeige der Geräteinformationen
 */
function updateDeviceInfo() {
  const deviceInfoElement = document.querySelector(".device-info");
  if (!deviceInfoElement) return;

  const width = window.innerWidth;
  let deviceType = "Extra Small";

  if (width >= 1400) {
    deviceType = "Extra Large (XXL)";
  } else if (width >= 1200) {
    deviceType = "Extra Large (XL)";
  } else if (width >= 992) {
    deviceType = "Large";
  } else if (width >= 768) {
    deviceType = "Medium";
  } else if (width >= 576) {
    deviceType = "Small";
  }

  deviceInfoElement.textContent = `${width}px - ${deviceType}`;
}

/**
 * Initialisiert den Theme-Toggle-Button
 */
function initializeThemeToggle() {
  const toggleButton = document.getElementById("global-theme-toggle");
  if (!toggleButton) return;

  toggleButton.addEventListener("click", function () {
    const body = document.body;
    const icon = this.querySelector("i");

    body.classList.toggle("dark-theme");

    if (body.classList.contains("dark-theme")) {
      icon.classList.remove("bi-sun");
      icon.classList.add("bi-moon");
    } else {
      icon.classList.remove("bi-moon");
      icon.classList.add("bi-sun");
    }
  });
}

/**
 * Initialisiert den Sidebar-Toggle für mobile Geräte
 */
function initializeSidebarToggle() {
  const toggleButton = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("sidebar");

  if (!toggleButton || !sidebar) return;

  toggleButton.addEventListener("click", function () {
    // Sidebar ein-/ausblenden auf mobilen Geräten
    if (window.innerWidth < 992) {
      const isVisible =
        sidebar.style.display !== "none" && sidebar.style.display !== "";

      if (isVisible) {
        sidebar.style.display = "none";
        this.innerHTML =
          '<i class="bi bi-layout-sidebar"></i> Seitenleiste einblenden';
      } else {
        sidebar.style.display = "block";
        this.innerHTML =
          '<i class="bi bi-layout-sidebar-inset"></i> Seitenleiste ausblenden';
      }
    }
  });

  // Bei Größenänderung des Fensters die Sidebar-Anzeige zurücksetzen
  window.addEventListener("resize", function () {
    if (window.innerWidth >= 992) {
      sidebar.style.display = "";
    }
  });
}

/**
 * Initialisiert die Metrik-Karten
 */
function initializeMetrics() {
  const metricsContainer = document.getElementById("metrics-container");
  if (!metricsContainer) return;

  // Container vorbereiten
  metricsContainer.innerHTML = `
    <div id="metric-active-recursions"></div>
    <div id="metric-max-recursion-depth"></div>
    <div id="metric-issues-detected"></div>
    <div id="metric-optimizations-applied"></div>
  `;

  // Metriken initialisieren
  new DynamicMetricTile({
    elementId: "metric-active-recursions",
    title: "Aktive Rekursionen",
    value: 32,
    previousValue: 28,
    format: "number",
    icon: "bi bi-repeat",
  });

  new DynamicMetricTile({
    elementId: "metric-max-recursion-depth",
    title: "Max. Rekursionstiefe",
    value: 120,
    previousValue: 150,
    format: "number",
    icon: "bi bi-layers",
    trends: {
      inverseColors: true,
    },
  });

  new DynamicMetricTile({
    elementId: "metric-issues-detected",
    title: "Erkannte Probleme",
    value: 8,
    previousValue: 12,
    format: "number",
    icon: "bi bi-exclamation-triangle",
    trends: {
      inverseColors: true,
    },
  });

  new DynamicMetricTile({
    elementId: "metric-optimizations-applied",
    title: "Angewendete Optimierungen",
    value: 15,
    previousValue: 10,
    format: "number",
    icon: "bi bi-lightning-charge",
  });
}

/**
 * Initialisiert das BentoGrid für aktive Rekursionen
 */
function initializeBentoGrid() {
  const bentoGridContainer = document.getElementById("bentogrid-container");
  if (!bentoGridContainer) return;

  // Demo-Daten
  const recursionData = [
    {
      id: "REC001",
      name: "calculateFactorial",
      module: "Math Utils",
      status: "Active",
      calls: 1250,
      maxDepth: 10,
      lastCall: "11.05.2025 10:15",
      description: "Berechnet die Fakultät einer Zahl rekursiv.",
    },
    {
      id: "REC002",
      name: "traverseTree",
      module: "Data Structures",
      status: "Active",
      calls: 845,
      maxDepth: 32,
      lastCall: "11.05.2025 10:12",
      description: "Durchläuft einen Binärbaum rekursiv.",
    },
    {
      id: "REC003",
      name: "fibonacci",
      module: "Math Utils",
      status: "Warning",
      calls: 2150,
      maxDepth: 25,
      lastCall: "11.05.2025 10:10",
      description: "Berechnet Fibonacci-Zahlen rekursiv (nicht memoized).",
    },
    {
      id: "REC004",
      name: "parseJSON",
      module: "Data Parser",
      status: "Error",
      calls: 412,
      maxDepth: 50,
      lastCall: "11.05.2025 10:05",
      description: "Parsiert JSON-Strings rekursiv.",
    },
    {
      id: "REC005",
      name: "processDirectory",
      module: "File System",
      status: "Active",
      calls: 324,
      maxDepth: 8,
      lastCall: "11.05.2025 10:01",
      description: "Verarbeitet Verzeichnisse rekursiv.",
    },
    {
      id: "REC006",
      name: "quickSort",
      module: "Sort Algorithms",
      status: "Active",
      calls: 1870,
      maxDepth: 15,
      lastCall: "11.05.2025 09:58",
      description: "Implementiert den Quicksort-Algorithmus rekursiv.",
    },
  ];

  // BentoGrid initialisieren
  new BentoGrid({
    elementId: "bentogrid-container",
    items: recursionData,
    columns: {
      id: { label: "ID", width: "80px" },
      name: { label: "Name", width: "150px" },
      module: { label: "Modul", width: "120px" },
      status: {
        label: "Status",
        width: "100px",
        renderer: (value) => {
          const statusClasses = {
            Active: "success",
            Warning: "warning",
            Error: "danger",
          };
          return `<span class="badge bg-${
            statusClasses[value] || "secondary"
          }">${value}</span>`;
        },
      },
      calls: { label: "Aufrufe", width: "100px", align: "right" },
      maxDepth: { label: "Max. Tiefe", width: "110px", align: "right" },
      lastCall: { label: "Letzter Aufruf", width: "150px" },
      description: { label: "Beschreibung", flex: 1 },
    },
    onItemClick: (item) => {
      alert(`Rekursion Details: ${item.name}`);
    },
  });
}

/**
 * Initialisiert die GradientCards für Issues und Suggestions
 */
function initializeCards() {
  initializeIssuesCard();
  initializeSuggestionsCard();
}

/**
 * Initialisiert die Issues-Karte
 */
function initializeIssuesCard() {
  const issuesContainer = document.getElementById("issues-container");
  if (!issuesContainer) return;

  // Demo-Daten für Issues
  const issuesData = [
    {
      id: "ISS001",
      title: "Stack-Overflow in recursive_sum.js",
      description:
        "Die Funktion löst einen Stack-Overflow bei mehr als 1000 Aufrufen aus.",
      timestamp: "2025-05-11T14:30:22",
      status: "Critical",
      icon: "bi bi-exclamation-triangle-fill",
    },
    {
      id: "ISS002",
      title: "Rekursiver Aufruf in tree_traversal.js ineffizient",
      description:
        "Die rekursive Implementierung ist langsamer als eine iterative Lösung wäre.",
      timestamp: "2025-05-11T11:15:40",
      status: "Warning",
      icon: "bi bi-exclamation-circle",
    },
    {
      id: "ISS003",
      title: "Fehlender Basisfall in fibonacci_recursive.js",
      description:
        "Die Rekursion könnte in eine Endlosschleife geraten, wenn negative Zahlen übergeben werden.",
      timestamp: "2025-05-11T09:22:15",
      status: "Error",
      icon: "bi bi-bug-fill",
    },
  ];

  // GradientCard initialisieren
  issuesContainer.innerHTML = `<div id="issues-gradient-card"></div>`;

  new GradientCard({
    elementId: "issues-gradient-card",
    items: issuesData,
    gradient: {
      type: "issue",
      animated: true,
      intensity: 0.6,
      blur: 20,
    },
    onItemClick: (item) => {
      alert(`Issue Details: ${item.id} - ${item.title}`);
    },
    layout: {
      maxItems: 3,
    },
  });
}

/**
 * Initialisiert die Suggestions-Karte
 */
function initializeSuggestionsCard() {
  const suggestionsContainer = document.getElementById("suggestions-container");
  if (!suggestionsContainer) return;

  // Demo-Daten für Suggestions
  const suggestionsData = [
    {
      id: "SUG001",
      title: "Memoization für Fibonacci-Funktion",
      description:
        "Implementiere Memoization, um redundante Berechnungen zu vermeiden und die Performanz zu verbessern.",
      timestamp: "2025-05-11T15:45:30",
      status: "High",
      icon: "bi bi-speedometer",
    },
    {
      id: "SUG002",
      title: "Tail-Recursion für factorial.js",
      description:
        "Konvertiere die Faktorial-Funktion zu einer Tail-rekursiven Implementierung für bessere Stack-Nutzung.",
      timestamp: "2025-05-11T12:30:45",
      status: "Medium",
      icon: "bi bi-arrow-repeat",
    },
    {
      id: "SUG003",
      title: "Iteration statt Rekursion für tree_search.js",
      description:
        "Ersetze die rekursive Implementierung durch eine iterative Lösung mit einem Stack für große Bäume.",
      timestamp: "2025-05-11T10:15:20",
      status: "Low",
      icon: "bi bi-diagram-3",
    },
  ];

  // GradientCard initialisieren
  suggestionsContainer.innerHTML = `<div id="suggestions-gradient-card"></div>`;

  new GradientCard({
    elementId: "suggestions-gradient-card",
    items: suggestionsData,
    gradient: {
      type: "suggestion",
      animated: true,
      intensity: 0.6,
      blur: 25,
    },
    onItemClick: (item) => {
      alert(`Suggestion Details: ${item.id} - ${item.title}`);
    },
    layout: {
      maxItems: 3,
    },
  });
}
