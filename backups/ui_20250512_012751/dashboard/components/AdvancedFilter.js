/**
 * AdvancedFilter
 * =========
 *
 * Eine erweiterte Filterkomponente für das BentoGrid, die folgende Funktionen bietet:
 * - Kategoriebasierte Filter mit Multi-Select-Unterstützung
 * - Live-Suche mit Hervorhebung der Ergebnisse
 * - Filter-History und gespeicherte Filter
 * - Schnellfilter für häufig genutzte Filter
 */

(function () {
  // Klasse für die AdvancedFilter-Komponente
  class AdvancedFilter {
    /**
     * Konstruktor für die AdvancedFilter-Komponente
     *
     * @param {Object} options - Konfigurationsoptionen
     * @param {string} options.elementId - ID des DOM-Elements, in das der Filter gerendert werden soll
     * @param {Object} options.filters - Filter-Konfiguration mit Kategorien und Optionen
     * @param {Function} options.onFilterChange - Callback für Änderungen an den Filtern
     * @param {string} options.storageName - Name für lokalen Speicher der Filter-History (optional)
     */
    constructor(options) {
      this.options = {
        elementId: null,
        filters: {
          categories: [], // Array von Kategorien
        },
        onFilterChange: null,
        storageName: "advanced-filter-history",
        ...options,
      };

      this.element = document.getElementById(this.options.elementId);
      if (!this.element) {
        console.error(
          `Element mit ID ${this.options.elementId} nicht gefunden`
        );
        return;
      }

      // Aktuelle Filter-Zustände
      this.activeFilters = {
        search: "",
        categories: {},
      };

      // Gespeicherte Filter aus dem Local Storage laden
      this.savedFilters = this.loadSavedFilters();

      // Filter-History
      this.filterHistory = this.loadFilterHistory();

      this.render();
      this.setupEventListeners();
    }

    /**
     * Lädt die Filter-History aus dem Local Storage
     *
     * @returns {Array} Array mit vorherigen Suchbegriffen
     */
    loadFilterHistory() {
      try {
        const storedHistory = localStorage.getItem(
          `${this.options.storageName}-history`
        );
        return storedHistory ? JSON.parse(storedHistory) : [];
      } catch (e) {
        console.error("Fehler beim Laden der Filter-History:", e);
        return [];
      }
    }

    /**
     * Speichert die Filter-History im Local Storage
     */
    saveFilterHistory() {
      try {
        // Maximiere auf 10 Einträge, entferne Duplikate
        const uniqueHistory = [...new Set(this.filterHistory)].slice(0, 10);
        localStorage.setItem(
          `${this.options.storageName}-history`,
          JSON.stringify(uniqueHistory)
        );
      } catch (e) {
        console.error("Fehler beim Speichern der Filter-History:", e);
      }
    }

    /**
     * Lädt gespeicherte Filter aus dem Local Storage
     *
     * @returns {Array} Array mit gespeicherten Filtern
     */
    loadSavedFilters() {
      try {
        const storedFilters = localStorage.getItem(
          `${this.options.storageName}-saved`
        );
        return storedFilters ? JSON.parse(storedFilters) : [];
      } catch (e) {
        console.error("Fehler beim Laden der gespeicherten Filter:", e);
        return [];
      }
    }

    /**
     * Speichert einen Filter im Local Storage
     *
     * @param {string} name - Name des Filters
     */
    saveCurrentFilter(name) {
      try {
        const filterToSave = {
          name,
          timestamp: new Date().toISOString(),
          filter: { ...this.activeFilters },
        };

        // Prüfen auf Duplikate
        const existingIndex = this.savedFilters.findIndex(
          (f) => f.name === name
        );
        if (existingIndex >= 0) {
          this.savedFilters[existingIndex] = filterToSave;
        } else {
          this.savedFilters.push(filterToSave);
        }

        localStorage.setItem(
          `${this.options.storageName}-saved`,
          JSON.stringify(this.savedFilters)
        );
      } catch (e) {
        console.error("Fehler beim Speichern des Filters:", e);
      }
    }

    /**
     * Rendert die Filter-Komponente
     */
    render() {
      if (!this.element) return;

      // Suchfeld mit History-Dropdown
      const searchHistoryOptions = this.filterHistory
        .map(
          (term) =>
            `<li class="filter-history-item" data-value="${term}">${term}</li>`
        )
        .join("");

      // Kategorien-Filter
      const categoriesHtml = this.options.filters.categories
        .map((category) => {
          const options = category.options
            .map(
              (option) =>
                `<div class="filter-checkbox-item">
            <input type="checkbox" 
              id="${category.id}-${option.value}" 
              name="${category.id}" 
              value="${option.value}" 
              ${
                this.isFilterActive(category.id, option.value) ? "checked" : ""
              }>
            <label for="${category.id}-${option.value}">${option.label}</label>
          </div>`
            )
            .join("");

          return `
          <div class="filter-category">
            <h3 class="filter-category-title">${category.label}</h3>
            <div class="filter-category-options">
              ${options}
            </div>
          </div>
        `;
        })
        .join("");

      // Gespeicherte Filter
      const savedFiltersHtml =
        this.savedFilters.length > 0
          ? `
          <div class="saved-filters">
            <h3 class="saved-filters-title">Gespeicherte Filter</h3>
            <div class="saved-filters-list">
              ${this.savedFilters
                .map(
                  (filter) =>
                    `<button class="saved-filter-item" data-filter-name="${filter.name}">
                  ${filter.name}
                  <span class="saved-filter-remove" data-filter-name="${filter.name}">×</span>
                </button>`
                )
                .join("")}
            </div>
          </div>
        `
          : "";

      this.element.innerHTML = `
        <div class="advanced-filter">
          <div class="filter-main">
            <div class="filter-search-container">
              <div class="filter-search-wrapper">
                <input type="text" 
                  class="filter-search-input" 
                  placeholder="Suchen..." 
                  value="${this.activeFilters.search}">
                <button class="filter-search-button">
                  <i class="bi bi-search"></i>
                </button>
                ${
                  this.filterHistory.length > 0
                    ? `<button class="filter-history-toggle" title="Suchverlauf">
                      <i class="bi bi-clock-history"></i>
                    </button>
                    <ul class="filter-history-dropdown">
                      ${searchHistoryOptions}
                    </ul>`
                    : ""
                }
              </div>
              <button class="filter-save-button">
                <i class="bi bi-bookmark"></i>
                <span>Filter speichern</span>
              </button>
              <button class="filter-clear-button" title="Filter zurücksetzen">
                <i class="bi bi-x-circle"></i>
              </button>
            </div>
            
            <div class="filter-categories-container">
              ${categoriesHtml}
            </div>
          </div>
          
          ${savedFiltersHtml}
          
          <div class="filter-active-tags">
            <div class="filter-active-tags-label">Aktive Filter:</div>
            <div class="filter-active-tags-container"></div>
          </div>
        </div>
      `;

      // Aktive Filter-Tags rendern
      this.renderActiveFilterTags();
    }

    /**
     * Prüft, ob ein Filter aktiv ist
     *
     * @param {string} categoryId - ID der Kategorie
     * @param {string} value - Wert der Option
     * @returns {boolean} Ist der Filter aktiv?
     */
    isFilterActive(categoryId, value) {
      return (
        this.activeFilters.categories[categoryId] &&
        this.activeFilters.categories[categoryId].includes(value)
      );
    }

    /**
     * Rendert die aktiven Filter-Tags
     */
    renderActiveFilterTags() {
      const container = this.element.querySelector(
        ".filter-active-tags-container"
      );
      if (!container) return;

      const tags = [];

      // Suchtag hinzufügen, wenn eine Suche aktiv ist
      if (this.activeFilters.search) {
        tags.push(`
          <div class="filter-tag" data-type="search">
            <span class="filter-tag-label">Suche: ${this.activeFilters.search}</span>
            <button class="filter-tag-remove" data-type="search">×</button>
          </div>
        `);
      }

      // Kategorie-Filter-Tags hinzufügen
      for (const categoryId in this.activeFilters.categories) {
        if (
          !this.activeFilters.categories[categoryId] ||
          this.activeFilters.categories[categoryId].length === 0
        ) {
          continue;
        }

        // Kategorie-Name finden
        const category = this.options.filters.categories.find(
          (c) => c.id === categoryId
        );
        if (!category) continue;

        this.activeFilters.categories[categoryId].forEach((value) => {
          // Option-Label finden
          const option = category.options.find((o) => o.value === value);
          if (!option) return;

          tags.push(`
            <div class="filter-tag" data-type="category" data-category="${categoryId}" data-value="${value}">
              <span class="filter-tag-label">${category.label}: ${option.label}</span>
              <button class="filter-tag-remove" data-type="category" data-category="${categoryId}" data-value="${value}">×</button>
            </div>
          `);
        });
      }

      container.innerHTML = tags.length
        ? tags.join("")
        : '<div class="filter-no-active">Keine aktiven Filter</div>';
    }

    /**
     * Richtet Event-Listener für die Benutzerinteraktion ein
     */
    setupEventListeners() {
      if (!this.element) return;

      // Suchfeld
      const searchInput = this.element.querySelector(".filter-search-input");
      if (searchInput) {
        // Live-Suche bei Eingabe
        searchInput.addEventListener("input", () => {
          this.activeFilters.search = searchInput.value.trim();
          this.renderActiveFilterTags();
          this.notifyFilterChange();
        });

        // Enter-Taste speichert Suchbegriff in der History
        searchInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && searchInput.value.trim()) {
            // Zur History hinzufügen
            const term = searchInput.value.trim();
            if (!this.filterHistory.includes(term)) {
              this.filterHistory.unshift(term);
              this.saveFilterHistory();
            }
          }
        });
      }

      // History-Toggle-Button
      const historyToggle = this.element.querySelector(
        ".filter-history-toggle"
      );
      if (historyToggle) {
        historyToggle.addEventListener("click", () => {
          this.element
            .querySelector(".filter-history-dropdown")
            .classList.toggle("show");
        });

        // Klick außerhalb schließt Dropdown
        document.addEventListener("click", (e) => {
          if (
            !e.target.closest(".filter-history-toggle") &&
            !e.target.closest(".filter-history-dropdown")
          ) {
            const dropdown = this.element.querySelector(
              ".filter-history-dropdown"
            );
            if (dropdown && dropdown.classList.contains("show")) {
              dropdown.classList.remove("show");
            }
          }
        });
      }

      // History-Items
      this.element.querySelectorAll(".filter-history-item").forEach((item) => {
        item.addEventListener("click", () => {
          const value = item.dataset.value;
          searchInput.value = value;
          this.activeFilters.search = value;
          this.renderActiveFilterTags();
          this.notifyFilterChange();
          this.element
            .querySelector(".filter-history-dropdown")
            .classList.remove("show");
        });
      });

      // Kategorie-Checkboxen
      this.element
        .querySelectorAll('.filter-checkbox-item input[type="checkbox"]')
        .forEach((checkbox) => {
          checkbox.addEventListener("change", () => {
            const category = checkbox.name;
            const value = checkbox.value;

            // Kategorie initialisieren, falls noch nicht vorhanden
            if (!this.activeFilters.categories[category]) {
              this.activeFilters.categories[category] = [];
            }

            // Wert hinzufügen oder entfernen
            if (checkbox.checked) {
              if (!this.activeFilters.categories[category].includes(value)) {
                this.activeFilters.categories[category].push(value);
              }
            } else {
              this.activeFilters.categories[category] =
                this.activeFilters.categories[category].filter(
                  (v) => v !== value
                );

              // Leere Arrays aus dem Objekt entfernen
              if (this.activeFilters.categories[category].length === 0) {
                delete this.activeFilters.categories[category];
              }
            }

            this.renderActiveFilterTags();
            this.notifyFilterChange();
          });
        });

      // Filter-Tags zum Entfernen
      this.element.addEventListener("click", (e) => {
        const removeButton = e.target.closest(".filter-tag-remove");
        if (!removeButton) return;

        const type = removeButton.dataset.type;

        if (type === "search") {
          this.activeFilters.search = "";
          if (searchInput) searchInput.value = "";
        } else if (type === "category") {
          const category = removeButton.dataset.category;
          const value = removeButton.dataset.value;

          // Checkbox deselektieren
          const checkbox = this.element.querySelector(
            `input[name="${category}"][value="${value}"]`
          );
          if (checkbox) checkbox.checked = false;

          // Aus aktiven Filtern entfernen
          if (this.activeFilters.categories[category]) {
            this.activeFilters.categories[category] =
              this.activeFilters.categories[category].filter(
                (v) => v !== value
              );

            // Leere Arrays aus dem Objekt entfernen
            if (this.activeFilters.categories[category].length === 0) {
              delete this.activeFilters.categories[category];
            }
          }
        }

        this.renderActiveFilterTags();
        this.notifyFilterChange();
      });

      // Filter speichern
      const saveButton = this.element.querySelector(".filter-save-button");
      if (saveButton) {
        saveButton.addEventListener("click", () => {
          // Prüfen, ob es aktive Filter gibt
          const hasActiveFilters =
            this.activeFilters.search ||
            Object.keys(this.activeFilters.categories).length > 0;

          if (!hasActiveFilters) {
            alert("Es sind keine Filter aktiv zum Speichern.");
            return;
          }

          // Nach Namen fragen
          const filterName = prompt("Name für den gespeicherten Filter:", "");
          if (filterName) {
            this.saveCurrentFilter(filterName);
            this.render();
            this.setupEventListeners();
          }
        });
      }

      // Gespeicherte Filter anwenden
      this.element.querySelectorAll(".saved-filter-item").forEach((item) => {
        item.addEventListener("click", (e) => {
          // Verhindern, wenn auf den Entfernen-Button geklickt wurde
          if (e.target.closest(".saved-filter-remove")) return;

          const filterName = item.dataset.filterName;
          const savedFilter = this.savedFilters.find(
            (f) => f.name === filterName
          );

          if (savedFilter && savedFilter.filter) {
            // Filter anwenden
            this.activeFilters = JSON.parse(JSON.stringify(savedFilter.filter));

            // UI aktualisieren
            if (searchInput)
              searchInput.value = this.activeFilters.search || "";

            // Checkboxen aktualisieren
            this.element
              .querySelectorAll('.filter-checkbox-item input[type="checkbox"]')
              .forEach((checkbox) => {
                const category = checkbox.name;
                const value = checkbox.value;

                checkbox.checked = this.isFilterActive(category, value);
              });

            this.renderActiveFilterTags();
            this.notifyFilterChange();
          }
        });
      });

      // Gespeicherten Filter entfernen
      this.element
        .querySelectorAll(".saved-filter-remove")
        .forEach((button) => {
          button.addEventListener("click", (e) => {
            e.stopPropagation(); // Verhindern, dass der Filter angewendet wird

            const filterName = button.dataset.filterName;
            this.savedFilters = this.savedFilters.filter(
              (f) => f.name !== filterName
            );

            // Speichern und UI aktualisieren
            localStorage.setItem(
              `${this.options.storageName}-saved`,
              JSON.stringify(this.savedFilters)
            );
            this.render();
            this.setupEventListeners();
          });
        });

      // Filter zurücksetzen
      const clearButton = this.element.querySelector(".filter-clear-button");
      if (clearButton) {
        clearButton.addEventListener("click", () => {
          // Alle Filter zurücksetzen
          this.activeFilters = {
            search: "",
            categories: {},
          };

          // UI aktualisieren
          if (searchInput) searchInput.value = "";

          // Alle Checkboxen abwählen
          this.element
            .querySelectorAll('.filter-checkbox-item input[type="checkbox"]')
            .forEach((checkbox) => {
              checkbox.checked = false;
            });

          this.renderActiveFilterTags();
          this.notifyFilterChange();
        });
      }
    }

    /**
     * Benachrichtigt den Callback über Filteränderungen
     */
    notifyFilterChange() {
      if (this.options.onFilterChange) {
        this.options.onFilterChange(this.activeFilters);
      }
    }

    /**
     * Gibt die aktuellen Filter zurück
     *
     * @returns {Object} Aktive Filter
     */
    getActiveFilters() {
      return { ...this.activeFilters };
    }

    /**
     * Setzt die aktiven Filter
     *
     * @param {Object} filters - Neue Filter
     * @param {boolean} triggerChange - Callback auslösen
     */
    setActiveFilters(filters, triggerChange = true) {
      this.activeFilters = { ...filters };
      this.render();
      this.setupEventListeners();

      if (triggerChange) {
        this.notifyFilterChange();
      }
    }
  }

  // Exportieren für globale Verfügbarkeit
  window.AdvancedFilter = AdvancedFilter;
})();
