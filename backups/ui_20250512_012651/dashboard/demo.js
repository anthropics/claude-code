/**
 * Demo für die neuen UI-Komponenten
 * =================================
 *
 * Dieses Skript zeigt die Verwendung der neuen modernen UI-Komponenten:
 * - DynamicMetricTile: Ersatz für die statischen Metrikkarten
 * - BentoGrid: Modernes Grid-Layout als Ersatz für Tabellen
 */

document.addEventListener("DOMContentLoaded", () => {
  // Überprüfen, ob die benötigten Elemente im DOM vorhanden sind
  if (!document.getElementById("dashboard-demo-section")) {
    console.warn(
      "Dashboard-Demo-Bereich nicht gefunden. Die Demo wird nicht initialisiert."
    );
    return;
  }

  initializeDynamicMetricTiles();
  initializeBentoGrids();
  initializeGradientCards();
});

/**
 * Initialisiert die dynamischen Metrikkarten
 */
function initializeDynamicMetricTiles() {
  const metricsContainer = document.getElementById("metrics-demo-container");

  if (!metricsContainer) {
    console.warn(
      "Metriken-Container nicht gefunden. DynamicMetricTiles werden nicht initialisiert."
    );
    return;
  }

  // Demo-Container vorbereiten
  metricsContainer.innerHTML = `
    <h3 class="demo-section-title">DynamicMetricTiles</h3>
    <div class="row">
      <div class="col-md-3 col-sm-6 mb-4">
        <div id="totalFunctionsDemoTile"></div>
      </div>
      <div class="col-md-3 col-sm-6 mb-4">
        <div id="issuesDetectedDemoTile"></div>
      </div>
      <div class="col-md-3 col-sm-6 mb-4">
        <div id="issuesFixedDemoTile"></div>
      </div>
      <div class="col-md-3 col-sm-6 mb-4">
        <div id="maxRecursionDemoTile"></div>
      </div>
    </div>
    
    <div class="demo-controls mt-3 mb-5">
      <button id="updateMetricsDemo" class="btn btn-primary">Werte aktualisieren</button>
      <button id="toggleMetricsTheme" class="btn btn-outline-secondary">Theme wechseln</button>
    </div>
  `;

  // Metrikkarten initialisieren
  const totalFunctionsTile = new DynamicMetricTile({
    elementId: "totalFunctionsDemoTile",
    title: "Überwachte Funktionen",
    value: 523,
    previousValue: 485,
    format: "number",
    icon: "bi bi-lightning-charge",
    trends: {
      showIcon: true,
      showPercentage: true,
    },
  });

  const issuesDetectedTile = new DynamicMetricTile({
    elementId: "issuesDetectedDemoTile",
    title: "Erkannte Probleme",
    value: 48,
    previousValue: 52,
    format: "number",
    icon: "bi bi-exclamation-triangle",
    trends: {
      showIcon: true,
      showPercentage: true,
      inverseColors: true, // Weniger Probleme ist gut, also invertierte Farben
    },
  });

  const issuesFixedTile = new DynamicMetricTile({
    elementId: "issuesFixedDemoTile",
    title: "Behobene Probleme",
    value: 36,
    previousValue: 29,
    format: "number",
    icon: "bi bi-check-circle",
    trends: {
      showIcon: true,
      showPercentage: true,
    },
  });

  const maxRecursionTile = new DynamicMetricTile({
    elementId: "maxRecursionDemoTile",
    title: "Max. Rekursionstiefe",
    value: 872,
    previousValue: 640,
    format: "number",
    icon: "bi bi-arrow-repeat",
    thresholds: {
      warning: 500,
      danger: 1000,
    },
    trends: {
      showIcon: true,
      showPercentage: true,
      inverseColors: true, // Höhere Rekursionstiefe ist tendenziell problematisch
    },
  });

  // Event-Listener für Demo-Steuerelemente
  document.getElementById("updateMetricsDemo").addEventListener("click", () => {
    // Zufällige neue Werte generieren
    const getRandomChange = (baseValue) => {
      const change = Math.random() > 0.5 ? 1 : -1;
      return baseValue + change * Math.floor(Math.random() * (baseValue * 0.2));
    };

    totalFunctionsTile.update(
      getRandomChange(totalFunctionsTile.options.value),
      totalFunctionsTile.options.value
    );
    issuesDetectedTile.update(
      getRandomChange(issuesDetectedTile.options.value),
      issuesDetectedTile.options.value
    );
    issuesFixedTile.update(
      getRandomChange(issuesFixedTile.options.value),
      issuesFixedTile.options.value
    );
    maxRecursionTile.update(
      getRandomChange(maxRecursionTile.options.value),
      maxRecursionTile.options.value
    );
  });

  document
    .getElementById("toggleMetricsTheme")
    .addEventListener("click", () => {
      const body = document.body;
      body.classList.toggle("dark-theme");
    });
}

/**
 * Initialisiert die BentoGrid-Komponenten
 */
function initializeBentoGrids() {
  const gridContainer = document.getElementById("bentogrid-demo-container");

  if (!gridContainer) {
    console.warn(
      "BentoGrid-Container nicht gefunden. BentoGrids werden nicht initialisiert."
    );
    return;
  }

  // Demo-Container vorbereiten
  gridContainer.innerHTML = `
    <h3 class="demo-section-title">BentoGrid: Aktive Funktionen</h3>
    <div id="activeFunctionsDemoGrid" class="mb-5"></div>
    
    <h3 class="demo-section-title">BentoGrid: Funktionsverlauf</h3>
    <div id="functionHistoryDemoGrid" class="mb-4"></div>
  `;

  // Demo-Daten für aktive Funktionen
  const activeFunctionsData = [
    {
      functionName: "parseRecursiveStructure",
      filePath: "/src/parser/recursive.js",
      callCount: 256,
      lastCalled: "2025-05-10T14:35:22",
      currentDepth: 12,
      status: "Aktiv",
      memoryUsage: "4.2 MB",
      colSpan: 1,
      tags: ["Parser", "Kritisch"],
      icon: "bi bi-lightning-charge",
      actions: [
        {
          id: "terminate",
          label: "Beenden",
          icon: "bi bi-x-circle",
          handler: (item) => console.log("Beende", item.functionName),
        },
        {
          id: "debug",
          label: "Debuggen",
          icon: "bi bi-bug",
          handler: (item) => console.log("Debugge", item.functionName),
        },
      ],
    },
    {
      functionName: "traverseNestedObjects",
      filePath: "/src/utils/traversal.js",
      callCount: 128,
      lastCalled: "2025-05-10T14:36:05",
      currentDepth: 8,
      status: "Warnung",
      memoryUsage: "2.8 MB",
      colSpan: 1,
      tags: ["Utils", "Performance"],
      icon: "bi bi-lightning-charge",
      actions: [
        {
          id: "terminate",
          label: "Beenden",
          icon: "bi bi-x-circle",
          handler: (item) => console.log("Beende", item.functionName),
        },
        {
          id: "debug",
          label: "Debuggen",
          icon: "bi bi-bug",
          handler: (item) => console.log("Debugge", item.functionName),
        },
      ],
    },
    {
      functionName: "calculateDependencyTree",
      filePath: "/src/core/dependencies.js",
      callCount: 64,
      lastCalled: "2025-05-10T14:36:30",
      currentDepth: 4,
      status: "Aktiv",
      memoryUsage: "1.5 MB",
      colSpan: 1,
      tags: ["Core", "Dependencies"],
      icon: "bi bi-lightning-charge",
      actions: [
        {
          id: "terminate",
          label: "Beenden",
          icon: "bi bi-x-circle",
          handler: (item) => console.log("Beende", item.functionName),
        },
        {
          id: "debug",
          label: "Debuggen",
          icon: "bi bi-bug",
          handler: (item) => console.log("Debugge", item.functionName),
        },
      ],
    },
    {
      functionName: "analyzeCodeStructure",
      filePath: "/src/analyzer/codeStructure.js",
      callCount: 512,
      lastCalled: "2025-05-10T14:35:55",
      currentDepth: 16,
      status: "Fehler",
      memoryUsage: "8.7 MB",
      colSpan: 2,
      tags: ["Analyzer", "Kritisch", "Performance"],
      meta: "Potenzielle Endlosschleife",
      icon: "bi bi-lightning-charge",
      description:
        "Diese Funktion zeigt ein potenzielles Stabilitätsproblem durch zu tiefe Rekursion. Sie wird derzeit überwacht und sollte eventuell optimiert werden.",
      actions: [
        {
          id: "terminate",
          label: "Beenden",
          icon: "bi bi-x-circle",
          handler: (item) => console.log("Beende", item.functionName),
        },
        {
          id: "debug",
          label: "Debuggen",
          icon: "bi bi-bug",
          handler: (item) => console.log("Debugge", item.functionName),
        },
        {
          id: "optimize",
          label: "Optimieren",
          icon: "bi bi-lightning-charge",
          handler: (item) => console.log("Optimiere", item.functionName),
        },
      ],
    },
  ];

  // Demo-Daten für Funktionsverlauf
  const functionHistoryData = [
    {
      functionName: "calculateFibonacci",
      filePath: "/src/math/fibonacci.js",
      firstSeen: "2025-04-15",
      lastCalled: "2025-05-10T12:22:45",
      totalCalls: 1205,
      maxDepth: 24,
      avgExecTime: "3.2 ms",
      issuesCount: 3,
      status: "Optimiert",
      colSpan: 1,
      tags: ["Math", "Optimiert"],
      icon: "bi bi-check-circle",
      actions: [
        {
          id: "details",
          label: "Details",
          icon: "bi bi-info-circle",
          handler: (item) => console.log("Details für", item.functionName),
        },
      ],
    },
    {
      functionName: "parseAST",
      filePath: "/src/parser/ast.js",
      firstSeen: "2025-04-10",
      lastCalled: "2025-05-09T18:45:12",
      totalCalls: 892,
      maxDepth: 18,
      avgExecTime: "5.8 ms",
      issuesCount: 0,
      status: "Stabil",
      colSpan: 1,
      tags: ["Parser", "AST"],
      icon: "bi bi-check-circle",
      actions: [
        {
          id: "details",
          label: "Details",
          icon: "bi bi-info-circle",
          handler: (item) => console.log("Details für", item.functionName),
        },
      ],
    },
    {
      functionName: "traverseDOM",
      filePath: "/src/dom/traversal.js",
      firstSeen: "2025-04-20",
      lastCalled: "2025-05-10T10:11:33",
      totalCalls: 3456,
      maxDepth: 32,
      avgExecTime: "2.4 ms",
      issuesCount: 5,
      status: "Warnung",
      colSpan: 1,
      tags: ["DOM", "Traversal", "Performance"],
      icon: "bi bi-exclamation-triangle",
      actions: [
        {
          id: "details",
          label: "Details",
          icon: "bi bi-info-circle",
          handler: (item) => console.log("Details für", item.functionName),
        },
        {
          id: "optimize",
          label: "Optimieren",
          icon: "bi bi-lightning-charge",
          handler: (item) => console.log("Optimiere", item.functionName),
        },
      ],
    },
    {
      functionName: "generateTreeFromData",
      filePath: "/src/utils/treeGeneration.js",
      firstSeen: "2025-04-18",
      lastCalled: "2025-05-10T09:34:56",
      totalCalls: 567,
      maxDepth: 12,
      avgExecTime: "8.5 ms",
      issuesCount: 1,
      status: "Info",
      colSpan: 1,
      tags: ["Utils", "Daten"],
      icon: "bi bi-info-circle",
      actions: [
        {
          id: "details",
          label: "Details",
          icon: "bi bi-info-circle",
          handler: (item) => console.log("Details für", item.functionName),
        },
      ],
    },
  ];

  // Spalten-Konfiguration für aktive Funktionen
  const activeFunctionsColumns = {
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
    currentDepth: {
      label: "Akt. Tiefe",
    },
    memoryUsage: {
      label: "Speichernutzung",
    },
  };

  // Spalten-Konfiguration für Funktionsverlauf
  const functionHistoryColumns = {
    functionName: {
      label: "Funktion",
      primary: true,
    },
    filePath: {
      label: "Dateipfad",
    },
    totalCalls: {
      label: "Aufrufe gesamt",
      formatter: (value) => value.toLocaleString(),
    },
    maxDepth: {
      label: "Max. Tiefe",
    },
    avgExecTime: {
      label: "Ø Ausführungszeit",
    },
    issuesCount: {
      label: "Probleme",
      formatter: (value, item) =>
        value > 0
          ? `<span class="text-danger">${value}</span>`
          : '<span class="text-success">0</span>',
    },
    lastCalled: {
      label: "Zuletzt aufgerufen",
      formatter: (value) => {
        const date = new Date(value);
        return date.toLocaleString();
      },
    },
  };

  // BentoGrid für aktive Funktionen initialisieren
  const activeFunctionsGrid = new BentoGrid({
    elementId: "activeFunctionsDemoGrid",
    items: activeFunctionsData,
    columns: activeFunctionsColumns,
    layout: {
      gap: 16,
      minWidth: 280,
      maxColumns: 4,
      aspectRatio: 1.3,
    },
    onItemClick: (item) => {
      console.log("Funktion angeklickt:", item.functionName);
      showFunctionDetails(item);
    },
    filters: {
      searchable: true,
      filterable: true,
      filterKey: "tags",
      options: [
        { value: "Kritisch", label: "Kritisch" },
        { value: "Performance", label: "Performance" },
        { value: "Core", label: "Core" },
        { value: "Parser", label: "Parser" },
      ],
    },
  });

  // BentoGrid für Funktionsverlauf initialisieren
  const functionHistoryGrid = new BentoGrid({
    elementId: "functionHistoryDemoGrid",
    items: functionHistoryData,
    columns: functionHistoryColumns,
    layout: {
      gap: 16,
      minWidth: 280,
      maxColumns: 4,
      aspectRatio: 1.3,
    },
    onItemClick: (item) => {
      console.log("Funktion angeklickt:", item.functionName);
      showFunctionDetails(item);
    },
    filters: {
      searchable: true,
      filterable: true,
      filterKey: "tags",
      options: [
        { value: "Performance", label: "Performance" },
        { value: "Optimiert", label: "Optimiert" },
        { value: "Math", label: "Mathematik" },
        { value: "DOM", label: "DOM" },
      ],
    },
  });

  // Funktion zum Anzeigen von Details (Simulation)
  function showFunctionDetails(item) {
    alert(
      `Details für Funktion: ${item.functionName}\nDateipfad: ${item.filePath}`
    );
  }
}

/**
 * Initialisiert die GradientCard-Komponenten für Issues und Suggestions
 */
function initializeGradientCards() {
  initializeIssuesCard();
  initializeSuggestionsCard();
}

/**
 * Initialisiert die Issues-Karte mit Gradient-Hintergrund
 */
function initializeIssuesCard() {
  const issuesContainer = document.getElementById("issues-card-container");

  if (!issuesContainer) {
    console.warn(
      "Issues-Container nicht gefunden. GradientCard wird nicht initialisiert."
    );
    return;
  }

  // Demo-Container vorbereiten
  issuesContainer.innerHTML = `
    <h3 class="demo-section-title">Recent Issues (GradientCard)</h3>
    <div class="mb-3">
      <div class="demo-controls mb-4">
        <button class="btn btn-sm btn-outline-primary" id="issues-gradient-toggle">
          Animation umschalten
        </button>
        <button class="btn btn-sm btn-outline-primary" id="issues-add-demo">
          Issue hinzufügen
        </button>
        <button class="btn btn-sm btn-outline-primary" id="issues-update-demo">
          Status ändern
        </button>
      </div>
      <div id="issues-gradient-card-demo"></div>
    </div>
  `;

  // Demo-Daten für Issues
  const issuesData = [
    {
      id: "ISS001",
      title: "Stack-Overflow in recursive_sum.js",
      description:
        "Die Funktion löst einen Stack-Overflow bei mehr als 1000 Aufrufen aus.",
      timestamp: "2025-05-10T14:30:22",
      status: "Critical",
      icon: "bi bi-exclamation-triangle-fill",
      actions: [
        {
          title: "Als gelöst markieren",
          icon: "bi bi-check-circle",
          handler: (item) => {
            alert(`Issue ${item.id} als gelöst markiert!`);
          },
        },
      ],
    },
    {
      id: "ISS002",
      title: "Rekursiver Aufruf in tree_traversal.js ineffizient",
      description:
        "Die rekursive Implementierung ist langsamer als eine iterative Lösung wäre.",
      timestamp: "2025-05-09T11:15:40",
      status: "Warning",
      icon: "bi bi-exclamation-circle",
      actions: [
        {
          title: "Ignorieren",
          icon: "bi bi-eye-slash",
          handler: (item) => {
            alert(`Issue ${item.id} ignoriert!`);
          },
        },
      ],
    },
    {
      id: "ISS003",
      title: "Fehlender Basisfall in fibonacci_recursive.js",
      description:
        "Die Rekursion könnte in eine Endlosschleife geraten, wenn negative Zahlen übergeben werden.",
      timestamp: "2025-05-09T09:22:15",
      status: "Error",
      icon: "bi bi-bug-fill",
      actions: [
        {
          title: "Als gelöst markieren",
          icon: "bi bi-check-circle",
          handler: (item) => {
            alert(`Issue ${item.id} als gelöst markiert!`);
          },
        },
      ],
    },
    {
      id: "ISS004",
      title: "Rekursive Funktion factorial.js nicht memoized",
      description:
        "Wiederholte Berechnungen könnten durch Zwischenspeicherung vermieden werden.",
      timestamp: "2025-05-08T16:45:10",
      status: "Info",
      icon: "bi bi-info-circle",
      actions: [
        {
          title: "Optimierungsvorschlag generieren",
          icon: "bi bi-lightning",
          handler: (item) => {
            alert(`Optimierungsvorschlag für ${item.id} wird generiert...`);
          },
        },
      ],
    },
  ];

  // GradientCard initialisieren
  const issuesCard = new GradientCard({
    elementId: "issues-gradient-card-demo",
    items: issuesData,
    gradient: {
      type: "issue",
      animated: true,
      intensity: 0.6,
      blur: 20,
    },
    onItemClick: (item) => {
      alert(`Issue Details anzeigen: ${item.id} - ${item.title}`);
    },
    onShowMore: (items) => {
      alert(`Alle ${items.length} Issues anzeigen`);
    },
    layout: {
      maxItems: 4,
    },
    itemTemplate: {
      showIcon: true,
      showDescription: true,
      showTimestamp: true,
      showStatus: true,
      showActions: true,
    },
  });

  // Event-Listener für Demo-Buttons
  document
    .getElementById("issues-gradient-toggle")
    .addEventListener("click", () => {
      const currentConfig = issuesCard.options.gradient;
      issuesCard.updateGradient({
        animated: !currentConfig.animated,
      });
    });

  document.getElementById("issues-add-demo").addEventListener("click", () => {
    const newIssue = {
      id: `ISS00${issuesData.length + 1}`,
      title: `Neues Issue #${issuesData.length + 1}`,
      description: "Dieses Issue wurde gerade zur Demonstration hinzugefügt.",
      timestamp: new Date().toISOString(),
      status: ["Critical", "Error", "Warning", "Info"][
        Math.floor(Math.random() * 4)
      ],
      icon: "bi bi-lightning-fill",
    };

    issuesData.unshift(newIssue);
    issuesCard.updateItems(issuesData);
  });

  document
    .getElementById("issues-update-demo")
    .addEventListener("click", () => {
      if (issuesData.length > 0) {
        const randomIndex = Math.floor(Math.random() * issuesData.length);
        const statuses = ["Critical", "Error", "Warning", "Info", "Success"];
        const randomStatus =
          statuses[Math.floor(Math.random() * statuses.length)];

        issuesData[randomIndex].status = randomStatus;
        issuesCard.updateItems(issuesData);
      }
    });
}

/**
 * Initialisiert die Suggestions-Karte mit Gradient-Hintergrund
 */
function initializeSuggestionsCard() {
  const suggestionsContainer = document.getElementById(
    "suggestions-card-container"
  );

  if (!suggestionsContainer) {
    console.warn(
      "Suggestions-Container nicht gefunden. GradientCard wird nicht initialisiert."
    );
    return;
  }

  // Demo-Container vorbereiten
  suggestionsContainer.innerHTML = `
    <h3 class="demo-section-title">Optimization Suggestions (GradientCard)</h3>
    <div class="mb-3">
      <div class="demo-controls mb-4">
        <button class="btn btn-sm btn-outline-primary" id="suggestions-intensity-decrease">
          Intensität -
        </button>
        <button class="btn btn-sm btn-outline-primary" id="suggestions-intensity-increase">
          Intensität +
        </button>
        <button class="btn btn-sm btn-outline-primary" id="suggestions-blur-decrease">
          Blur -
        </button>
        <button class="btn btn-sm btn-outline-primary" id="suggestions-blur-increase">
          Blur +
        </button>
      </div>
      <div id="suggestions-gradient-card-demo"></div>
    </div>
  `;

  // Demo-Daten für Suggestions
  const suggestionsData = [
    {
      id: "SUG001",
      title: "Memoization für Fibonacci-Funktion",
      description:
        "Implementiere Memoization, um redundante Berechnungen zu vermeiden und die Performanz zu verbessern.",
      timestamp: "2025-05-10T15:45:30",
      status: "High",
      icon: "bi bi-speedometer",
      actions: [
        {
          title: "Implementieren",
          icon: "bi bi-code-slash",
          handler: (item) => {
            alert(`Optimierung ${item.id} implementieren!`);
          },
        },
      ],
    },
    {
      id: "SUG002",
      title: "Tail-Recursion für factorial.js",
      description:
        "Konvertiere die Faktorial-Funktion zu einer Tail-rekursiven Implementierung für bessere Stack-Nutzung.",
      timestamp: "2025-05-09T12:30:45",
      status: "Medium",
      icon: "bi bi-arrow-repeat",
      actions: [
        {
          title: "Implementieren",
          icon: "bi bi-code-slash",
          handler: (item) => {
            alert(`Optimierung ${item.id} implementieren!`);
          },
        },
      ],
    },
    {
      id: "SUG003",
      title: "Iteration statt Rekursion für tree_search.js",
      description:
        "Ersetze die rekursive Implementierung durch eine iterative Lösung mit einem Stack für große Bäume.",
      timestamp: "2025-05-08T10:15:20",
      status: "Low",
      icon: "bi bi-diagram-3",
      actions: [
        {
          title: "Implementieren",
          icon: "bi bi-code-slash",
          handler: (item) => {
            alert(`Optimierung ${item.id} implementieren!`);
          },
        },
      ],
    },
    {
      id: "SUG004",
      title: "Rekursionstiefe begrenzen in dfs.js",
      description:
        "Füge einen Parameter hinzu, um die maximale Rekursionstiefe zu begrenzen und Stack-Overflows zu vermeiden.",
      timestamp: "2025-05-07T14:20:35",
      status: "Medium",
      icon: "bi bi-layers",
      actions: [
        {
          title: "Implementieren",
          icon: "bi bi-code-slash",
          handler: (item) => {
            alert(`Optimierung ${item.id} implementieren!`);
          },
        },
      ],
    },
    {
      id: "SUG005",
      title: "Parallele Berechnung für map_recursive.js",
      description:
        "Nutze Web Workers für parallele Verarbeitung großer Arrays in der rekursiven Map-Funktion.",
      timestamp: "2025-05-06T09:10:15",
      status: "High",
      icon: "bi bi-cpu",
      actions: [
        {
          title: "Implementieren",
          icon: "bi bi-code-slash",
          handler: (item) => {
            alert(`Optimierung ${item.id} implementieren!`);
          },
        },
      ],
    },
  ];

  // Gradient-Konfiguration
  let gradientConfig = {
    type: "suggestion",
    animated: true,
    intensity: 0.6,
    blur: 25,
  };

  // GradientCard initialisieren
  const suggestionsCard = new GradientCard({
    elementId: "suggestions-gradient-card-demo",
    items: suggestionsData,
    gradient: gradientConfig,
    onItemClick: (item) => {
      alert(`Optimization Details anzeigen: ${item.id} - ${item.title}`);
    },
    onShowMore: (items) => {
      alert(`Alle ${items.length} Optimierungsvorschläge anzeigen`);
    },
    layout: {
      maxItems: 4,
    },
    itemTemplate: {
      showIcon: true,
      showDescription: true,
      showTimestamp: true,
      showStatus: true,
      showActions: true,
    },
  });

  // Event-Listener für Demo-Buttons
  document
    .getElementById("suggestions-intensity-decrease")
    .addEventListener("click", () => {
      gradientConfig.intensity = Math.max(0.1, gradientConfig.intensity - 0.1);
      suggestionsCard.updateGradient(gradientConfig);
    });

  document
    .getElementById("suggestions-intensity-increase")
    .addEventListener("click", () => {
      gradientConfig.intensity = Math.min(1.0, gradientConfig.intensity + 0.1);
      suggestionsCard.updateGradient(gradientConfig);
    });

  document
    .getElementById("suggestions-blur-decrease")
    .addEventListener("click", () => {
      gradientConfig.blur = Math.max(0, gradientConfig.blur - 5);
      suggestionsCard.updateGradient(gradientConfig);
    });

  document
    .getElementById("suggestions-blur-increase")
    .addEventListener("click", () => {
      gradientConfig.blur = Math.min(50, gradientConfig.blur + 5);
      suggestionsCard.updateGradient(gradientConfig);
    });
}

// Globaler Zugriff für Debug-Zwecke in der Konsole
window.demoFunctions = {
  initializeDynamicMetricTiles,
  initializeBentoGrids,
  initializeGradientCards,
};
