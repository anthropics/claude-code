/**
 * BentoGrid
 * =========
 *
 * A modern, flexible grid component for displaying data cards
 * in a responsive layout. Replaces traditional tables for a
 * visually appealing presentation. Supports advanced filtering options.
 */

import { unifiedAdapter } from "../adapters";
import { AdvancedFilter } from "./AdvancedFilter";

export class BentoGrid {
  /**
   * Constructor for the BentoGrid component
   *
   * @param {Object} options - Configuration options
   * @param {string} options.elementId - DOM element ID to render the grid
   * @param {Array} options.items - Data items to display
   * @param {Object} options.columns - Column configuration
   * @param {Object} options.layout - Layout configuration (optional)
   * @param {Function} options.onItemClick - Callback for item clicks (optional)
   * @param {Object} options.filters - Filter configuration (optional)
   * @param {boolean} options.useAdvancedFilter - Enable advanced filter options (optional)
   * @param {string} options.advancedFilterId - Element ID for advanced filter (optional)
   * @param {Object} options.advancedFilterConfig - Advanced filter configuration (optional)
   * @param {Object} options.adapter - Adapter for framework integration (optional)
   */
  constructor(options) {
    this.options = {
      elementId: null,
      items: [],
      columns: {},
      layout: {
        gap: 16,
        minWidth: 280,
        maxColumns: 4,
        aspectRatio: 1.3,
      },
      onItemClick: null,
      filters: null,
      useAdvancedFilter: false,
      advancedFilterId: null,
      advancedFilterConfig: null,
      adapter: unifiedAdapter,
      ...options,
    };

    this.element = document.getElementById(this.options.elementId);
    if (!this.element) {
      this.options.adapter.logger.error(
        `Element with ID ${this.options.elementId} not found`
      );
      return;
    }

    this.filteredItems = [...this.options.items];
    this.sortColumn = null;
    this.sortDirection = "asc";
    this.advancedFilter = null;
    this.lastSearchTerm = "";
    this.highlightMatches = true;

    if (this.options.useAdvancedFilter) {
      this.initializeAdvancedFilter();
    }

    this.render();
    this.setupEventListeners();
  }

  /**
   * Initialize the advanced filter
   */
  initializeAdvancedFilter() {
    if (!this.options.advancedFilterId) {
      this.options.adapter.logger.warn("Advanced filter ID not provided");
      return;
    }

    const filterElement = document.getElementById(this.options.advancedFilterId);
    if (!filterElement) {
      this.options.adapter.logger.error(
        `Advanced filter element with ID ${this.options.advancedFilterId} not found`
      );
      return;
    }

    this.advancedFilter = new AdvancedFilter({
      elementId: this.options.advancedFilterId,
      filters: this.options.advancedFilterConfig || this.generateFilterConfig(),
      onFilterChange: (filters) => this.applyAdvancedFilters(filters),
      adapter: this.options.adapter,
    });
  }

  /**
   * Generate filter configuration from data items
   * 
   * @returns {Object} Filter configuration
   */
  generateFilterConfig() {
    const categories = [];
    const seenValues = new Map();

    // Generate categories and options from columns
    Object.entries(this.options.columns).forEach(([key, column]) => {
      if (column.filterable === false) return;

      // Get unique values for this column
      const values = new Set();
      this.options.items.forEach(item => {
        const value = item[key];
        if (value !== undefined && value !== null) {
          values.add(String(value));
        }
      });

      // Only add if we have values
      if (values.size > 0) {
        categories.push({
          id: key,
          name: column.label || key,
          options: Array.from(values).map(value => ({
            id: value,
            name: value,
          })),
        });
      }
    });

    return { categories };
  }

  /**
   * Apply advanced filters
   * 
   * @param {Object} filters - Filter criteria
   */
  applyAdvancedFilters(filters) {
    this.filteredItems = this.options.items.filter(item => {
      // Apply search filter
      if (filters.search && filters.search.trim() !== "") {
        const searchTerm = filters.search.toLowerCase();
        // Check if any column value contains the search term
        const matchesSearch = Object.entries(this.options.columns).some(([key, column]) => {
          if (!column.searchable) return false;
          const value = item[key];
          return value !== undefined && 
                 value !== null && 
                 String(value).toLowerCase().includes(searchTerm);
        });
        
        if (!matchesSearch) return false;
      }

      // Apply category filters
      if (filters.categories && Object.keys(filters.categories).length > 0) {
        for (const [category, selectedOptions] of Object.entries(filters.categories)) {
          if (selectedOptions.length === 0) continue;
          
          const itemValue = String(item[category] || "");
          if (!selectedOptions.includes(itemValue)) {
            return false;
          }
        }
      }

      return true;
    });

    this.lastSearchTerm = filters.search || "";
    this.render();
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    this.element.addEventListener("click", (event) => {
      const cardElement = event.target.closest(".bento-grid-card");
      if (cardElement && this.options.onItemClick) {
        const itemId = cardElement.dataset.itemId;
        const item = this.filteredItems.find(i => String(i.id) === itemId);
        if (item) {
          this.options.onItemClick(item, event);
        }
      }
    });

    // Add sort event listeners
    const headerElements = this.element.querySelectorAll(".bento-grid-header-cell");
    headerElements.forEach(header => {
      const columnKey = header.dataset.column;
      if (columnKey && this.options.columns[columnKey].sortable !== false) {
        header.addEventListener("click", () => this.sortBy(columnKey));
      }
    });
  }

  /**
   * Sort items by column
   * 
   * @param {string} columnKey - Column key to sort by
   */
  sortBy(columnKey) {
    if (this.sortColumn === columnKey) {
      // Toggle direction if already sorting by this column
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortColumn = columnKey;
      this.sortDirection = "asc";
    }

    const column = this.options.columns[columnKey];
    const sortType = column.sortType || typeof this.filteredItems[0]?.[columnKey];

    this.filteredItems.sort((a, b) => {
      let valueA = a[columnKey];
      let valueB = b[columnKey];

      // Handle undefined or null values
      if (valueA === undefined || valueA === null) valueA = "";
      if (valueB === undefined || valueB === null) valueB = "";

      // Sort based on data type
      let result;
      if (sortType === "number") {
        result = Number(valueA) - Number(valueB);
      } else if (sortType === "date") {
        result = new Date(valueA) - new Date(valueB);
      } else {
        result = String(valueA).localeCompare(String(valueB));
      }

      return this.sortDirection === "asc" ? result : -result;
    });

    this.render();
  }

  /**
   * Render the grid
   */
  render() {
    if (!this.element) return;

    // Calculate grid layout
    const containerWidth = this.element.clientWidth;
    const { gap, minWidth, maxColumns, aspectRatio } = this.options.layout;
    
    // Calculate number of columns based on container width and minimum width
    let columns = Math.floor((containerWidth + gap) / (minWidth + gap));
    columns = Math.min(columns, maxColumns);
    columns = Math.max(columns, 1);
    
    // Calculate card width based on number of columns
    const cardWidth = (containerWidth - (columns - 1) * gap) / columns;
    const cardHeight = cardWidth / aspectRatio;

    // Generate grid HTML
    let html = '<div class="bento-grid">';
    
    // Header row if columns are defined
    if (Object.keys(this.options.columns).length > 0) {
      html += '<div class="bento-grid-header">';
      Object.entries(this.options.columns).forEach(([key, column]) => {
        const isSorted = this.sortColumn === key;
        const sortClass = isSorted ? ` bento-grid-header-cell-sorted-${this.sortDirection}` : "";
        const sortableClass = column.sortable !== false ? " bento-grid-header-cell-sortable" : "";
        
        html += `<div class="bento-grid-header-cell${sortableClass}${sortClass}" data-column="${key}">
          ${column.label || key}
          ${isSorted ? `<span class="bento-grid-sort-icon">${this.sortDirection === 'asc' ? '↑' : '↓'}</span>` : ''}
        </div>`;
      });
      html += '</div>';
    }
    
    // Grid items
    html += `<div class="bento-grid-items" style="grid-template-columns: repeat(${columns}, 1fr); gap: ${gap}px;">`;
    
    if (this.filteredItems.length === 0) {
      html += `<div class="bento-grid-no-results">No results found</div>`;
    } else {
      this.filteredItems.forEach(item => {
        html += this.renderCard(item);
      });
    }
    
    html += '</div></div>';
    
    // Set grid HTML
    this.element.innerHTML = html;
    
    // Add CSS if not already present
    this.ensureStylesAreApplied();
  }

  /**
   * Render a single card
   * 
   * @param {Object} item - Item data
   * @returns {string} Card HTML
   */
  renderCard(item) {
    let html = `<div class="bento-grid-card" data-item-id="${item.id || ''}">`;
    
    // If there are columns defined, use them to structure the card
    if (Object.keys(this.options.columns).length > 0) {
      Object.entries(this.options.columns).forEach(([key, column]) => {
        const value = item[key];
        const displayValue = this.formatValue(value, column.type, column.format);
        
        const highlightedValue = this.lastSearchTerm && this.highlightMatches && column.searchable !== false
          ? this.highlightSearchMatch(displayValue, this.lastSearchTerm)
          : displayValue;
        
        html += `<div class="bento-grid-card-field">
          <div class="bento-grid-card-field-label">${column.label || key}</div>
          <div class="bento-grid-card-field-value">${highlightedValue}</div>
        </div>`;
      });
    } else {
      // Simple display of all item properties
      Object.entries(item).forEach(([key, value]) => {
        if (key === 'id') return;
        
        const displayValue = this.formatValue(value);
        html += `<div class="bento-grid-card-field">
          <div class="bento-grid-card-field-label">${key}</div>
          <div class="bento-grid-card-field-value">${displayValue}</div>
        </div>`;
      });
    }
    
    html += '</div>';
    return html;
  }

  /**
   * Format a value based on its type
   * 
   * @param {any} value - Value to format
   * @param {string} type - Value type
   * @param {Object} format - Format options
   * @returns {string} Formatted value
   */
  formatValue(value, type = 'string', format = {}) {
    if (value === undefined || value === null) {
      return '';
    }

    switch (type) {
      case 'number':
        return this.options.adapter.ui.format.number(value, format);
      case 'date':
        return this.options.adapter.ui.format.date(value, format);
      case 'currency':
        return this.options.adapter.ui.format.number(value, { 
          style: 'currency', 
          currency: format.currency || 'USD', 
          ...format 
        });
      case 'boolean':
        return value ? (format.trueLabel || 'Yes') : (format.falseLabel || 'No');
      case 'url':
        return `<a href="${value}" target="_blank">${format.label || value}</a>`;
      case 'image':
        return `<img src="${value}" alt="${format.alt || ''}" class="bento-grid-card-image" />`;
      default:
        return String(value);
    }
  }

  /**
   * Highlight search matches in text
   * 
   * @param {string} text - Text to highlight
   * @param {string} searchTerm - Search term to highlight
   * @returns {string} Highlighted text
   */
  highlightSearchMatch(text, searchTerm) {
    if (!searchTerm || !text) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return String(text).replace(regex, '<mark>$1</mark>');
  }

  /**
   * Ensure CSS styles are applied
   */
  ensureStylesAreApplied() {
    const styleId = 'bento-grid-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .bento-grid {
          width: 100%;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        
        .bento-grid-header {
          display: flex;
          margin-bottom: 16px;
          border-bottom: 1px solid #e0e0e0;
          padding-bottom: 8px;
          font-weight: 600;
        }
        
        .bento-grid-header-cell {
          flex: 1;
          padding: 8px;
        }
        
        .bento-grid-header-cell-sortable {
          cursor: pointer;
          user-select: none;
        }
        
        .bento-grid-header-cell-sortable:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }
        
        .bento-grid-header-cell-sorted-asc,
        .bento-grid-header-cell-sorted-desc {
          position: relative;
          font-weight: 700;
        }
        
        .bento-grid-sort-icon {
          margin-left: 4px;
          font-size: 0.75em;
        }
        
        .bento-grid-items {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        
        .bento-grid-card {
          background-color: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          padding: 16px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow: hidden;
        }
        
        .bento-grid-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }
        
        .bento-grid-card-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .bento-grid-card-field-label {
          font-size: 0.75rem;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .bento-grid-card-field-value {
          font-size: 0.9375rem;
        }
        
        .bento-grid-card-image {
          width: 100%;
          height: auto;
          border-radius: 4px;
          object-fit: cover;
        }
        
        .bento-grid-no-results {
          grid-column: 1 / -1;
          text-align: center;
          padding: 32px;
          color: #666;
          font-style: italic;
        }
        
        mark {
          background-color: rgba(255, 230, 0, 0.4);
          padding: 0 2px;
          border-radius: 2px;
        }
        
        @media (prefers-color-scheme: dark) {
          .bento-grid-card {
            background-color: #222;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          }
          
          .bento-grid-card:hover {
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
          }
          
          .bento-grid-header {
            border-bottom-color: #444;
          }
          
          .bento-grid-card-field-label {
            color: #aaa;
          }
          
          .bento-grid-card-field-value {
            color: #eee;
          }
          
          .bento-grid-no-results {
            color: #aaa;
          }
          
          mark {
            background-color: rgba(255, 200, 0, 0.3);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Update the items in the grid
   * 
   * @param {Array} items - New items to display
   */
  updateItems(items) {
    this.options.items = items;
    this.filteredItems = [...items];
    
    // Re-apply sorting if needed
    if (this.sortColumn) {
      this.sortBy(this.sortColumn);
    } else {
      this.render();
    }
    
    // Re-apply advanced filter if active
    if (this.advancedFilter) {
      this.applyAdvancedFilters(this.advancedFilter.activeFilters);
    }
  }

  /**
   * Refresh the grid
   */
  refresh() {
    this.render();
  }

  /**
   * Destroy the grid and cleanup
   */
  destroy() {
    // Remove event listeners
    if (this.element) {
      this.element.innerHTML = '';
    }
    
    // Cleanup advanced filter if present
    if (this.advancedFilter) {
      this.advancedFilter.destroy();
    }
  }
}

export default BentoGrid;