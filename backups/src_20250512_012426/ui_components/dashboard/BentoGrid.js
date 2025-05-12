/**
 * BentoGrid
 * =========
 *
 * Eine moderne, flexible Grid-Komponente für die Anzeige von Datenkarten
 * in einem responsiven Layout. Ersetzt traditionelle Tabellen für eine
 * visuell ansprechendere Darstellung. Unterstützt erweiterte Filteroptionen.
 *
 * Diese Version ist eine optimierte Variante, die in ein Modul-basiertes System integriert wurde.
 */

import { unifiedAdapter } from "../adapters";
import { AdvancedFilter } from "./AdvancedFilter";

// Klasse für die BentoGrid-Komponente
export class BentoGrid {
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
   * @param {Object} options.adapter - Adapter für Framework-Integration (optional)
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

  // Der Rest der Methoden bleibt weitgehend unverändert, nur Adapter-Integrationen werden hinzugefügt
  // ...
}

// Exportieren für modulbasierte Verwendung
export default BentoGrid;
