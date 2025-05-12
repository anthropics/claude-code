/**
 * AdvancedFilter
 * =========
 *
 * Eine erweiterte Filterkomponente für das BentoGrid, die folgende Funktionen bietet:
 * - Kategoriebasierte Filter mit Multi-Select-Unterstützung
 * - Live-Suche mit Hervorhebung der Ergebnisse
 * - Filter-History und gespeicherte Filter
 * - Schnellfilter für häufig genutzte Filter
 *
 * Diese Version ist eine optimierte Variante, die in ein Modul-basiertes System integriert wurde.
 */

import { unifiedAdapter } from "../adapters";

// Klasse für die AdvancedFilter-Komponente
export class AdvancedFilter {
  /**
   * Konstruktor für die AdvancedFilter-Komponente
   *
   * @param {Object} options - Konfigurationsoptionen
   * @param {string} options.elementId - ID des DOM-Elements, in das der Filter gerendert werden soll
   * @param {Object} options.filters - Filter-Konfiguration mit Kategorien und Optionen
   * @param {Function} options.onFilterChange - Callback für Änderungen an den Filtern
   * @param {string} options.storageName - Name für lokalen Speicher der Filter-History (optional)
   * @param {Object} options.adapter - Adapter für Framework-Integration (optional)
   */
  constructor(options) {
    this.options = {
      elementId: null,
      filters: {
        categories: [], // Array von Kategorien
      },
      onFilterChange: null,
      storageName: "advanced-filter-history",
      adapter: unifiedAdapter, // Standardmäßig den unifiedAdapter verwenden
      ...options,
    };

    this.element = document.getElementById(this.options.elementId);
    if (!this.element) {
      this.options.adapter.logger.error(
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

  // Der Rest der Methoden bleibt weitgehend unverändert, nur Adapter-Integrationen werden hinzugefügt
  // ...
}

// Exportieren für modulbasierte Verwendung
export default AdvancedFilter;
