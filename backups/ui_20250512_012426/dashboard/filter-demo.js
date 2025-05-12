/**
 * Filter-Demo
 *
 * Demonstriert die erweiterten Filterfunktionen:
 * - Live-Filterung
 * - Kategorienbasierte Filter
 * - Schnellsuche mit Hervorhebung
 * - Filter-History und gespeicherte Filter
 */

document.addEventListener("DOMContentLoaded", function () {
  // Theme-Umschaltung
  const themeToggle = document.getElementById("global-theme-toggle");
  const themeIcon = themeToggle.querySelector("i");

  // Aktuelles Theme aus dem localStorage laden oder Standardwert setzen
  let currentTheme = localStorage.getItem("theme") || "light";
  document.body.setAttribute("data-theme", currentTheme);
  updateThemeIcon();

  themeToggle.addEventListener("click", function () {
    currentTheme = currentTheme === "light" ? "dark" : "light";
    document.body.setAttribute("data-theme", currentTheme);
    localStorage.setItem("theme", currentTheme);
    updateThemeIcon();
  });

  function updateThemeIcon() {
    themeIcon.className = currentTheme === "light" ? "bi bi-moon" : "bi bi-sun";
  }

  // Beispieldaten für das BentoGrid - Rekursive Funktionen
  const recursionFunctions = [
    {
      id: 1,
      name: "Fakultät berechnen",
      description: "Berechnet die Fakultät einer Zahl mittels Rekursion",
      code: "function factorial(n) {\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}",
      complexity: "O(n)",
      module: "Mathematik",
      status: "Stabil",
      recursionType: "Direkte Rekursion",
      popularity: 92,
    },
    {
      id: 2,
      name: "Fibonacci-Folge",
      description: "Berechnet die Fibonacci-Zahl an Position n",
      code: "function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}",
      complexity: "O(2^n)",
      module: "Mathematik",
      status: "Optimierungsbedarf",
      recursionType: "Baumrekursion",
      popularity: 88,
    },
    {
      id: 3,
      name: "Binary Search",
      description: "Binäre Suche in einem sortierten Array",
      code: "function binarySearch(arr, target, start = 0, end = arr.length - 1) {\n  if (start > end) return -1;\n  const mid = Math.floor((start + end) / 2);\n  if (arr[mid] === target) return mid;\n  if (arr[mid] > target) return binarySearch(arr, target, start, mid - 1);\n  return binarySearch(arr, target, mid + 1, end);\n}",
      complexity: "O(log n)",
      module: "Algorithmen",
      status: "Stabil",
      recursionType: "Direkte Rekursion",
      popularity: 95,
    },
    {
      id: 4,
      name: "Quicksort",
      description: "Sortieralgorithmus mit Teilen-und-Herrschen-Ansatz",
      code: "function quickSort(arr) {\n  if (arr.length <= 1) return arr;\n  const pivot = arr[0];\n  const left = arr.slice(1).filter(x => x < pivot);\n  const right = arr.slice(1).filter(x => x >= pivot);\n  return [...quickSort(left), pivot, ...quickSort(right)];\n}",
      complexity: "O(n log n)",
      module: "Algorithmen",
      status: "Stabil",
      recursionType: "Baumrekursion",
      popularity: 90,
    },
    {
      id: 5,
      name: "Hanoi Türme",
      description: "Löst das Türme von Hanoi Problem",
      code: "function hanoi(n, source, auxiliary, target) {\n  if (n === 1) {\n    console.log(`Bewege Scheibe 1 von ${source} nach ${target}`);\n    return;\n  }\n  hanoi(n - 1, source, target, auxiliary);\n  console.log(`Bewege Scheibe ${n} von ${source} nach ${target}`);\n  hanoi(n - 1, auxiliary, source, target);\n}",
      complexity: "O(2^n)",
      module: "Puzzle",
      status: "Stabil",
      recursionType: "Mehrfachrekursion",
      popularity: 82,
    },
    {
      id: 6,
      name: "Euklid-GGT",
      description: "Berechnet den größten gemeinsamen Teiler",
      code: "function gcd(a, b) {\n  if (b === 0) return a;\n  return gcd(b, a % b);\n}",
      complexity: "O(log min(a, b))",
      module: "Mathematik",
      status: "Stabil",
      recursionType: "Direkte Rekursion",
      popularity: 85,
    },
    {
      id: 7,
      name: "Floodfill",
      description: "Füllt zusammenhängende Bereiche in einer Matrix",
      code: "function floodFill(image, sr, sc, newColor, originalColor = image[sr][sc]) {\n  if (sr < 0 || sc < 0 || sr >= image.length || sc >= image[0].length || image[sr][sc] !== originalColor || image[sr][sc] === newColor) return;\n  \n  image[sr][sc] = newColor;\n  \n  floodFill(image, sr + 1, sc, newColor, originalColor);\n  floodFill(image, sr - 1, sc, newColor, originalColor);\n  floodFill(image, sr, sc + 1, newColor, originalColor);\n  floodFill(image, sr, sc - 1, newColor, originalColor);\n}",
      complexity: "O(n)",
      module: "Grafik",
      status: "Optimierungsbedarf",
      recursionType: "Mehrfachrekursion",
      popularity: 78,
    },
    {
      id: 8,
      name: "Kombinationen erzeugen",
      description: "Erzeugt alle möglichen Kombinationen aus einer Menge",
      code: "function generateCombinations(arr, k, start = 0, current = []) {\n  if (current.length === k) {\n    console.log(current);\n    return;\n  }\n  \n  for (let i = start; i < arr.length; i++) {\n    current.push(arr[i]);\n    generateCombinations(arr, k, i + 1, current);\n    current.pop();\n  }\n}",
      complexity: "O(n choose k)",
      module: "Kombinatorik",
      status: "Entwicklung",
      recursionType: "Backtracking",
      popularity: 75,
    },
    {
      id: 9,
      name: "Merge Sort",
      description:
        "Stabiler Sortieralgorithmus mit Teilen-und-Herrschen-Ansatz",
      code: "function mergeSort(arr) {\n  if (arr.length <= 1) return arr;\n  \n  const mid = Math.floor(arr.length / 2);\n  const left = mergeSort(arr.slice(0, mid));\n  const right = mergeSort(arr.slice(mid));\n  \n  return merge(left, right);\n}\n\nfunction merge(left, right) {\n  let result = [];\n  let i = 0, j = 0;\n  \n  while (i < left.length && j < right.length) {\n    if (left[i] <= right[j]) {\n      result.push(left[i]);\n      i++;\n    } else {\n      result.push(right[j]);\n      j++;\n    }\n  }\n  \n  return [...result, ...left.slice(i), ...right.slice(j)];\n}",
      complexity: "O(n log n)",
      module: "Algorithmen",
      status: "Stabil",
      recursionType: "Baumrekursion",
      popularity: 88,
    },
    {
      id: 10,
      name: "Tiefe Kopie",
      description: "Erstellt eine tiefe Kopie eines verschachtelten Objekts",
      code: "function deepClone(obj) {\n  if (obj === null || typeof obj !== 'object') return obj;\n  \n  if (Array.isArray(obj)) {\n    return obj.map(item => deepClone(item));\n  }\n  \n  const cloned = {};\n  for (const key in obj) {\n    if (obj.hasOwnProperty(key)) {\n      cloned[key] = deepClone(obj[key]);\n    }\n  }\n  \n  return cloned;\n}",
      complexity: "O(n)",
      module: "Datenstrukturen",
      status: "Stabil",
      recursionType: "Direkte Rekursion",
      popularity: 80,
    },
  ];

  // Filter-Konfiguration
  const filterConfig = {
    elementId: "recursion-functions-filters",
    filters: {
      categories: [
        {
          id: "module",
          label: "Modul",
          options: [
            { id: "mathematik", label: "Mathematik" },
            { id: "algorithmen", label: "Algorithmen" },
            { id: "puzzle", label: "Puzzle" },
            { id: "grafik", label: "Grafik" },
            { id: "kombinatorik", label: "Kombinatorik" },
            { id: "datenstrukturen", label: "Datenstrukturen" },
          ],
        },
        {
          id: "status",
          label: "Status",
          options: [
            { id: "stabil", label: "Stabil" },
            { id: "optimierungsbedarf", label: "Optimierungsbedarf" },
            { id: "entwicklung", label: "Entwicklung" },
          ],
        },
        {
          id: "recursionType",
          label: "Rekursionstyp",
          options: [
            { id: "direkte-rekursion", label: "Direkte Rekursion" },
            { id: "baumrekursion", label: "Baumrekursion" },
            { id: "mehrfachrekursion", label: "Mehrfachrekursion" },
            { id: "backtracking", label: "Backtracking" },
          ],
        },
        {
          id: "complexity",
          label: "Komplexität",
          options: [
            { id: "o-n", label: "O(n)" },
            { id: "o-n2", label: "O(n²)" },
            { id: "o-logn", label: "O(log n)" },
            { id: "o-nlogn", label: "O(n log n)" },
            { id: "o-2n", label: "O(2^n)" },
          ],
        },
      ],
    },
    onFilterChange: function (filters) {
      // Filtern der Daten basierend auf den ausgewählten Filtern
      updateGridData(filters);
    },
    storageName: "recursion-filter-history",
  };

  // AdvancedFilter initialisieren
  const advancedFilter = new AdvancedFilter(filterConfig);

  // BentoGrid-Konfiguration
  const gridConfig = {
    elementId: "recursion-functions-grid",
    title: "Rekursive Funktionen",
    data: recursionFunctions,
    columns: [
      { id: "name", label: "Funktion", sortable: true },
      { id: "module", label: "Modul", sortable: true },
      { id: "recursionType", label: "Rekursionstyp", sortable: true },
      { id: "complexity", label: "Komplexität", sortable: true },
      { id: "status", label: "Status", sortable: true },
    ],
    defaultSort: { column: "popularity", direction: "desc" },
    rowActions: [
      {
        id: "view",
        icon: "bi-eye",
        label: "Details anzeigen",
        onClick: function (item) {
          alert(
            `Details für: ${item.name}\n\nBeschreibung: ${item.description}\n\nCode:\n${item.code}`
          );
        },
      },
    ],
    expandedRowContent: function (item) {
      return `
        <div class="expanded-content">
          <div class="mb-3">
            <strong>Beschreibung:</strong> ${item.description}
          </div>
          <div class="code-block">
            <pre>${item.code}</pre>
          </div>
          <div class="mt-2">
            <span class="badge bg-secondary">Komplexität: ${item.complexity}</span>
            <span class="badge bg-info">Beliebtheit: ${item.popularity}%</span>
          </div>
        </div>
      `;
    },
    // Aktivierung der Hervorhebung für die Suche
    highlightSearch: true,
    searchFields: [
      "name",
      "description",
      "code",
      "module",
      "recursionType",
      "status",
    ],
    // Aktivierung der Markierung von Filtertreffern
    visualFilterFeedback: true,
  };

  // BentoGrid initialisieren
  const bentoGrid = new BentoGrid(gridConfig);

  // Funktion zum Aktualisieren der Grid-Daten basierend auf den Filtern
  function updateGridData(filters) {
    let filteredData = [...recursionFunctions];

    // Text-Suche anwenden
    if (filters.search && filters.search.length > 0) {
      const searchTerm = filters.search.toLowerCase();
      filteredData = filteredData.filter((item) => {
        return gridConfig.searchFields.some((field) => {
          return (
            item[field] &&
            item[field].toString().toLowerCase().includes(searchTerm)
          );
        });
      });
    }

    // Kategoriefilter anwenden
    Object.entries(filters.categories).forEach(
      ([category, selectedOptions]) => {
        if (selectedOptions && selectedOptions.length > 0) {
          filteredData = filteredData.filter((item) => {
            const itemValue = item[category];
            return selectedOptions.some((option) => {
              return (
                itemValue &&
                itemValue.toString().toLowerCase() === option.toLowerCase()
              );
            });
          });
        }
      }
    );

    // Grid mit gefilterten Daten aktualisieren
    bentoGrid.updateData(filteredData, filters.search);
  }
});
