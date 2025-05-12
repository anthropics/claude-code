/**
 * BentoGrid
 * =========
 *
 * Eine moderne, flexible Grid-Komponente für die Anzeige von Datenkarten
 * in einem responsiven Layout. Ersetzt traditionelle Tabellen für eine
 * visuell ansprechendere Darstellung. Unterstützt erweiterte Filteroptionen.
 */

(function () {
  // Klasse für die BentoGrid-Komponente
  class BentoGrid {
    /**
     * Konstruktor für die BentoGrid-Komponente
     *
     * @param {Object} options - Konfigurationsoptionen
     * @param {string} options.elementId - ID des DOM-Elements, in das das Grid gerendert werden soll
     * @param {Array} options.items - Daten-Items, die angezeigt werden sollen
     * @param {Object} options.columns - Spaltenkonfiguration
     * @param {Object} options.layout - Layout-Konfiguration (optional)
     * @param {Function} options.onItemClick - Callback für Klicks auf Items (optional)
     * @param {Object} options.filters - Filter-Konfiguration (optional)
     * @param {boolean} options.useAdvancedFilter - Erweiterte Filteroptionen aktivieren (optional)
     * @param {string} options.advancedFilterId - ID für das Element des erweiterten Filters (optional)
     * @param {Object} options.advancedFilterConfig - Konfiguration für den erweiterten Filter (optional)
     */
    constructor(options) {
      this.options = {
        elementId: null,
        items: [],
        columns: {},
        layout: {
          gap: 16, // Abstand zwischen den Karten in Pixel
          minWidth: 280, // Minimale Breite einer Karte in Pixel
          maxColumns: 4, // Maximale Anzahl von Spalten
          aspectRatio: 1.3, // Seitenverhältnis (width / height)
        },
        onItemClick: null,
        filters: null,
        useAdvancedFilter: false,
        advancedFilterId: null,
        advancedFilterConfig: null,
        ...options,
      };

      this.element = document.getElementById(this.options.elementId);
      if (!this.element) {
        console.error(
          `Element mit ID ${this.options.elementId} nicht gefunden`
        );
        return;
      }

      this.filteredItems = [...this.options.items];
      this.sortColumn = null;
      this.sortDirection = "asc";
      this.advancedFilter = null;
      this.lastSearchTerm = "";
      this.highlightMatches = true;

      // Den erweiterten Filter initialisieren, falls aktiviert
      if (this.options.useAdvancedFilter) {
        this.initializeAdvancedFilter();
      }

      this.render();
      this.setupEventListeners();
    }

    /**
     * Initialisiert den erweiterten Filter
     */
    initializeAdvancedFilter() {
      // Prüfen, ob der erweiterte Filter verfügbar ist
      if (typeof AdvancedFilter === "undefined") {
        console.error(
          "AdvancedFilter-Komponente nicht verfügbar. Bitte AdvancedFilter.js einbinden."
        );
        return;
      }

      // Prüfen, ob eine Filter-ID angegeben wurde
      const filterId =
        this.options.advancedFilterId ||
        `${this.options.elementId}-advanced-filter`;

      // Filterelement im DOM erstellen, falls nicht vorhanden
      if (!document.getElementById(filterId)) {
        const filterContainer = document.createElement("div");
        filterContainer.id = filterId;
        this.element.parentNode.insertBefore(filterContainer, this.element);
      }

      // Standardkonfiguration für den erweiterten Filter
      const defaultFilterConfig = {
        elementId: filterId,
        filters: {
          categories: this.generateFilterCategories(),
        },
        onFilterChange: (filters) => this.handleAdvancedFilterChange(filters),
        storageName: `bento-grid-${this.options.elementId}`,
      };

      // Filter mit benutzerdefinierten Optionen initialisieren
      this.advancedFilter = new AdvancedFilter({
        ...defaultFilterConfig,
        ...this.options.advancedFilterConfig,
      });
    }

    /**
     * Generiert Filterkategorien aus den Spaltendaten
     *
     * @returns {Array} Array von Filterkategorien
     */
    generateFilterCategories() {
      const categories = [];
      const columns = this.prepareColumns();

      // Nur filterbare Spalten verwenden
      columns.forEach((column) => {
        if (column.filterable === false) return;

        // Werte für diese Spalte aus allen Items sammeln
        const uniqueValues = new Map();
        this.options.items.forEach((item) => {
          const value = item[column.key];

          // Arrays von Werten (z.B. Tags) separat behandeln
          if (Array.isArray(value)) {
            value.forEach((v) => {
              if (v !== null && v !== undefined) {
                uniqueValues.set(v, true);
              }
            });
          } else if (value !== null && value !== undefined) {
            uniqueValues.set(value, true);
          }
        });

        // Wenn wir mindestens zwei unterschiedliche Werte haben, erstellen wir eine Filterkategorie
        if (uniqueValues.size > 1) {
          const options = Array.from(uniqueValues.keys()).map((value) => ({
            value: value.toString(),
            label: value.toString(),
          }));

          categories.push({
            id: column.key,
            label: column.label || column.key,
            options: options,
          });
        }
      });

      return categories;
    }

    /**
     * Behandelt Änderungen des erweiterten Filters
     *
     * @param {Object} filters - Aktive Filter
     */
    handleAdvancedFilterChange(filters) {
      this.lastSearchTerm = filters.search || "";
      this.updateGrid();
    }

    /**
     * Bereitet die Spalteninformationen vor
     *
     * @returns {Array} Aufbereitete Spalteninformationen
     */
    prepareColumns() {
      const columns = this.options.columns;
      const result = [];

      // Wir konvertieren das Spaltenobjekt in ein Array
      for (const key in columns) {
        if (columns.hasOwnProperty(key)) {
          result.push({
            key,
            ...columns[key],
          });
        }
      }

      return result;
    }

    /**
     * Erstellt die Header-Zeile mit Filter- und Sortiermöglichkeiten
     *
     * @returns {string} HTML für die Header-Zeile
     */
    renderHeader() {
      if (!this.options.filters) {
        return "";
      }

      const columns = this.prepareColumns();

      let filterHtml = "";
      if (this.options.filters.searchable) {
        filterHtml += `
          <div class="bento-grid-filter">
            <input type="text" class="bento-grid-search" placeholder="Suchen...">
            <button class="bento-grid-search-button">
              <i class="bi bi-search"></i>
            </button>
          </div>
        `;
      }

      if (this.options.filters.filterable) {
        filterHtml += `
          <div class="bento-grid-filter">
            <select class="bento-grid-filter-select">
              <option value="">Alle anzeigen</option>
              ${this.options.filters.options
                .map(
                  (option) =>
                    `<option value="${option.value}">${option.label}</option>`
                )
                .join("")}
            </select>
          </div>
        `;
      }

      return `
        <div class="bento-grid-header">
          <div class="bento-grid-filter-group">
            ${filterHtml}
          </div>
          <div class="bento-grid-sort-group">
            <label>Sortieren nach:</label>
            <select class="bento-grid-sort-select">
              ${columns
                .filter((col) => col.sortable !== false)
                .map(
                  (col) =>
                    `<option value="${col.key}">${
                      col.label || col.key
                    }</option>`
                )
                .join("")}
            </select>
            <button class="bento-grid-sort-direction" data-direction="${
              this.sortDirection
            }">
              <i class="bi bi-sort-${
                this.sortDirection === "asc" ? "down" : "up"
              }"></i>
            </button>
          </div>
        </div>
      `;
    }

    /**
     * Rendert ein einzelnes Item als Karte
     *
     * @param {Object} item - Das zu rendernde Datenobjekt
     * @param {number} index - Index im Array
     * @returns {string} HTML für die Item-Karte
     */
    renderItem(item, index) {
      const columns = this.prepareColumns();

      // Bestimmen der Span-Klasse basierend auf dem colSpan-Wert des Items
      const colSpanClass =
        item.colSpan > 1
          ? `bento-grid-item-span-${Math.min(
              item.colSpan,
              this.options.layout.maxColumns
            )}`
          : "";

      // Status-Badge, falls vorhanden
      const statusBadge = item.status
        ? `<div class="bento-grid-status-badge ${this.getStatusClass(
            item.status
          )}">${item.status}</div>`
        : "";

      // Tags, falls vorhanden
      const tags =
        item.tags && item.tags.length
          ? `
          <div class="bento-grid-tags">
            ${item.tags
              .map((tag) => `<span class="bento-grid-tag">${tag}</span>`)
              .join("")}
          </div>
        `
          : "";

      // Metainformationen, falls vorhanden
      const meta = item.meta
        ? `<div class="bento-grid-meta">${item.meta}</div>`
        : "";

      // Icon, falls vorhanden
      const icon = item.icon
        ? `<div class="bento-grid-icon">${
            typeof item.icon === "string"
              ? `<i class="${item.icon}"></i>`
              : item.icon
          }</div>`
        : "";

      // Zusätzliche Aktionen, falls vorhanden
      const actions =
        item.actions && item.actions.length
          ? `
          <div class="bento-grid-actions">
            ${item.actions
              .map(
                (action) =>
                  `<button class="bento-grid-action-btn" data-action="${action.id}" title="${action.label}">
                <i class="${action.icon}"></i>
              </button>`
              )
              .join("")}
          </div>
        `
          : "";

      // Haupt-Spalten für die Karte aufbauen
      let contentHtml = "";

      columns.forEach((column) => {
        if (column.visible === false) return;

        // Wert für diese Spalte formatieren
        let value = item[column.key];

        if (column.formatter) {
          try {
            value = column.formatter(value, item);
          } catch (e) {
            console.error(
              `Fehler beim Formatieren der Spalte ${column.key}:`,
              e
            );
          }
        }

        // Nur sichtbare Spalten hinzufügen
        if (column.primary) {
          // Die Hauptspalte wird als Titel verwendet
        } else if (column.key === "description") {
          contentHtml += `<p class="bento-grid-description">${value}</p>`;
        } else if (value !== undefined && value !== null) {
          contentHtml += `
            <div class="bento-grid-data-row">
              <span class="bento-grid-data-label">${
                column.label || column.key
              }:</span>
              <span class="bento-grid-data-value">${value}</span>
            </div>
          `;
        }
      });

      // Karte zusammensetzen
      return `
        <div class="bento-grid-item ${colSpanClass}" data-index="${index}">
          <div class="bento-grid-item-content">
            ${statusBadge}
            <div class="bento-grid-header-section">
              ${icon}
              <div class="bento-grid-title-group">
                <h3 class="bento-grid-title">${
                  item[this.getPrimaryColumn()]
                }</h3>
                ${meta}
              </div>
              ${actions}
            </div>
            <div class="bento-grid-body">
              ${contentHtml}
            </div>
            ${tags}
          </div>
        </div>
      `;
    }

    /**
     * Bestimmt die primäre Spalte für den Titel
     *
     * @returns {string} Schlüssel der primären Spalte
     */
    getPrimaryColumn() {
      const columns = this.prepareColumns();
      const primaryColumn = columns.find((col) => col.primary);

      return primaryColumn ? primaryColumn.key : columns[0].key;
    }

    /**
     * Ermittelt die CSS-Klasse für einen Status
     *
     * @param {string} status - Statuswert
     * @returns {string} CSS-Klassenname
     */
    getStatusClass(status) {
      status = status.toLowerCase();

      if (
        status === "aktiv" ||
        status === "online" ||
        status === "erfolg" ||
        status === "success"
      ) {
        return "status-success";
      } else if (status === "warnung" || status === "warning") {
        return "status-warning";
      } else if (
        status === "fehler" ||
        status === "error" ||
        status === "danger"
      ) {
        return "status-danger";
      } else if (status === "info" || status === "neu" || status === "new") {
        return "status-info";
      } else if (status === "warten" || status === "pending") {
        return "status-pending";
      } else {
        return "status-default";
      }
    }

    /**
     * Filtert und sortiert die Items
     *
     * @param {string} searchTerm - Suchbegriff (optional)
     * @param {string} filterValue - Filterwert (optional)
     * @returns {Array} Gefilterte und sortierte Items
     */
    filterAndSortItems(searchTerm = "", filterValue = "") {
      let items = [...this.options.items];

      // Filtern basierend auf Suchbegriff
      if (searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        items = items.filter((item) => {
          // Durchsuche alle Eigenschaften des Items
          return Object.values(item).some((value) => {
            if (value === null || value === undefined) return false;

            if (typeof value === "string") {
              return value.toLowerCase().includes(lowerSearchTerm);
            } else if (typeof value === "number") {
              return value.toString().includes(lowerSearchTerm);
            }

            return false;
          });
        });
      }

      // Filtern basierend auf ausgewähltem Filter
      if (filterValue) {
        const filterKey = this.options.filters.filterKey || "category";
        items = items.filter((item) => {
          const itemValue = item[filterKey];

          if (Array.isArray(itemValue)) {
            return itemValue.includes(filterValue);
          }

          return itemValue === filterValue;
        });
      }

      // Sortieren basierend auf der ausgewählten Spalte
      if (this.sortColumn) {
        items.sort((a, b) => {
          let valA = a[this.sortColumn];
          let valB = b[this.sortColumn];

          // Handle different value types
          if (typeof valA === "string" && typeof valB === "string") {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
            return this.sortDirection === "asc"
              ? valA.localeCompare(valB)
              : valB.localeCompare(valA);
          } else {
            if (valA === undefined || valA === null)
              valA =
                this.sortDirection === "asc"
                  ? Number.MIN_SAFE_INTEGER
                  : Number.MAX_SAFE_INTEGER;
            if (valB === undefined || valB === null)
              valB =
                this.sortDirection === "asc"
                  ? Number.MIN_SAFE_INTEGER
                  : Number.MAX_SAFE_INTEGER;

            return this.sortDirection === "asc" ? valA - valB : valB - valA;
          }
        });
      }

      return items;
    }

    /**
     * Rendert das gesamte Grid
     */
    render() {
      if (!this.element) return;

      // CSS-Variablen für das Layout setzen
      this.element.style.setProperty(
        "--grid-gap",
        `${this.options.layout.gap}px`
      );
      this.element.style.setProperty(
        "--grid-min-width",
        `${this.options.layout.minWidth}px`
      );
      this.element.style.setProperty(
        "--grid-aspect-ratio",
        this.options.layout.aspectRatio
      );
      this.element.style.setProperty(
        "--grid-max-columns",
        this.options.layout.maxColumns
      );

      // Grid-Container mit Header und Items befüllen
      this.element.innerHTML = `
        <div class="bento-grid-container">
          ${this.renderHeader()}
          <div class="bento-grid">
            ${this.filteredItems
              .map((item, index) => this.renderItem(item, index))
              .join("")}
          </div>
          <div class="bento-grid-empty" style="display: ${
            this.filteredItems.length > 0 ? "none" : "flex"
          }">
            <p>Keine Einträge gefunden</p>
          </div>
        </div>
      `;
    }

    /**
     * Richtet Event-Listener für die Benutzerinteraktion ein
     */
    setupEventListeners() {
      if (!this.element) return;

      // Event-Delegation für Klicks auf Items
      this.element.addEventListener("click", (event) => {
        // Klick auf ein Item
        const itemElement = event.target.closest(".bento-grid-item");
        if (itemElement && this.options.onItemClick) {
          const index = parseInt(itemElement.dataset.index, 10);
          if (
            !isNaN(index) &&
            index >= 0 &&
            index < this.filteredItems.length
          ) {
            this.options.onItemClick(this.filteredItems[index], index);
          }
        }

        // Klick auf einen Aktions-Button
        const actionButton = event.target.closest(".bento-grid-action-btn");
        if (actionButton) {
          const itemElement = actionButton.closest(".bento-grid-item");
          const index = parseInt(itemElement.dataset.index, 10);
          const actionId = actionButton.dataset.action;

          if (
            !isNaN(index) &&
            index >= 0 &&
            index < this.filteredItems.length
          ) {
            const item = this.filteredItems[index];
            const action = item.actions.find((a) => a.id === actionId);

            if (action && action.handler) {
              action.handler(item, index);
            }
          }

          // Verhindern, dass der Klick auch als Item-Klick registriert wird
          event.stopPropagation();
        }
      });

      // Suche
      const searchInput = this.element.querySelector(".bento-grid-search");
      if (searchInput) {
        searchInput.addEventListener("input", () => {
          this.updateGrid();
        });
      }

      // Filter
      const filterSelect = this.element.querySelector(
        ".bento-grid-filter-select"
      );
      if (filterSelect) {
        filterSelect.addEventListener("change", () => {
          this.updateGrid();
        });
      }

      // Sortierung
      const sortSelect = this.element.querySelector(".bento-grid-sort-select");
      if (sortSelect) {
        sortSelect.addEventListener("change", () => {
          this.sortColumn = sortSelect.value;
          this.updateGrid();
        });

        // Initiale Sortierung setzen
        if (sortSelect.options.length > 0) {
          this.sortColumn = sortSelect.value;
        }
      }

      // Sortierrichtung
      const sortDirectionButton = this.element.querySelector(
        ".bento-grid-sort-direction"
      );
      if (sortDirectionButton) {
        sortDirectionButton.addEventListener("click", () => {
          this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
          sortDirectionButton.dataset.direction = this.sortDirection;
          sortDirectionButton.innerHTML = `<i class="bi bi-sort-${
            this.sortDirection === "asc" ? "down" : "up"
          }"></i>`;
          this.updateGrid();
        });
      }
    }

    /**
     * Aktualisiert das Grid mit aktuellen Filter- und Sortiereinstellungen
     */
    updateGrid() {
      const searchInput = this.element.querySelector(".bento-grid-search");
      const filterSelect = this.element.querySelector(
        ".bento-grid-filter-select"
      );

      const searchTerm = searchInput ? searchInput.value : "";
      const filterValue = filterSelect ? filterSelect.value : "";

      this.filteredItems = this.filterAndSortItems(searchTerm, filterValue);
      this.render();
      this.setupEventListeners();
    }

    /**
     * Fügt ein neues Item hinzu
     *
     * @param {Object} item - Das hinzuzufügende Item
     * @param {boolean} render - Grid neu rendern (default: true)
     */
    addItem(item, render = true) {
      this.options.items.push(item);
      if (render) {
        this.updateGrid();
      }
    }

    /**
     * Entfernt ein Item anhand seines Index
     *
     * @param {number} index - Index des zu entfernenden Items
     * @param {boolean} render - Grid neu rendern (default: true)
     */
    removeItem(index, render = true) {
      if (index >= 0 && index < this.options.items.length) {
        this.options.items.splice(index, 1);
        if (render) {
          this.updateGrid();
        }
      }
    }

    /**
     * Aktualisiert ein existierendes Item
     *
     * @param {number} index - Index des zu aktualisierenden Items
     * @param {Object} updates - Neue Eigenschaften
     * @param {boolean} render - Grid neu rendern (default: true)
     */
    updateItem(index, updates, render = true) {
      if (index >= 0 && index < this.options.items.length) {
        this.options.items[index] = {
          ...this.options.items[index],
          ...updates,
        };
        if (render) {
          this.updateGrid();
        }
      }
    }

    /**
     * Aktualisiert die Items-Liste vollständig
     *
     * @param {Array} items - Neue Items-Liste
     * @param {boolean} render - Grid neu rendern (default: true)
     */
    setItems(items, render = true) {
      this.options.items = items;
      if (render) {
        this.updateGrid();
      }
    }
  }

  // Exportieren für globale Verfügbarkeit
  window.BentoGrid = BentoGrid;
})();
