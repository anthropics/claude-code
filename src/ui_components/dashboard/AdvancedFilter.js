/**
 * AdvancedFilter
 * =========
 *
 * An advanced filter component for the BentoGrid that provides:
 * - Category-based filters with multi-select support
 * - Live search with result highlighting
 * - Filter history and saved filters
 * - Quick filters for frequently used filters
 */

import { unifiedAdapter } from "../adapters";

export class AdvancedFilter {
  /**
   * Constructor for the AdvancedFilter component
   *
   * @param {Object} options - Configuration options
   * @param {string} options.elementId - DOM element ID to render the filter
   * @param {Object} options.filters - Filter configuration with categories and options
   * @param {Function} options.onFilterChange - Callback for filter changes
   * @param {string} options.storageName - Name for local storage of filter history (optional)
   * @param {Object} options.adapter - Adapter for framework integration (optional)
   */
  constructor(options) {
    this.options = {
      elementId: null,
      filters: {
        categories: [],
      },
      onFilterChange: null,
      storageName: "advanced-filter-history",
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

    // Current filter states
    this.activeFilters = {
      search: "",
      categories: {},
    };

    // Saved filters from local storage
    this.savedFilters = this.loadSavedFilters();

    // Filter history
    this.filterHistory = this.loadFilterHistory();

    this.render();
    this.setupEventListeners();
  }

  /**
   * Load saved filters from local storage
   * 
   * @returns {Array} Saved filters
   */
  loadSavedFilters() {
    try {
      const savedFilters = localStorage.getItem(`${this.options.storageName}-saved`);
      return savedFilters ? JSON.parse(savedFilters) : [];
    } catch (error) {
      this.options.adapter.logger.error("Failed to load saved filters", { error });
      return [];
    }
  }

  /**
   * Load filter history from local storage
   * 
   * @returns {Array} Filter history
   */
  loadFilterHistory() {
    try {
      const filterHistory = localStorage.getItem(`${this.options.storageName}-history`);
      return filterHistory ? JSON.parse(filterHistory) : [];
    } catch (error) {
      this.options.adapter.logger.error("Failed to load filter history", { error });
      return [];
    }
  }

  /**
   * Save the current filter to history
   */
  saveFilterToHistory() {
    if (this.isEmptyFilter(this.activeFilters)) return;
    
    const historyEntry = {
      id: `history-${Date.now()}`,
      timestamp: new Date().toISOString(),
      filters: JSON.parse(JSON.stringify(this.activeFilters)),
    };
    
    // Add to history, keep max 10 entries
    this.filterHistory.unshift(historyEntry);
    if (this.filterHistory.length > 10) {
      this.filterHistory = this.filterHistory.slice(0, 10);
    }
    
    // Save to local storage
    try {
      localStorage.setItem(
        `${this.options.storageName}-history`,
        JSON.stringify(this.filterHistory)
      );
    } catch (error) {
      this.options.adapter.logger.error("Failed to save filter history", { error });
    }
  }

  /**
   * Save current filter as a named filter
   * 
   * @param {string} name - Filter name
   */
  saveFilter(name) {
    if (!name || this.isEmptyFilter(this.activeFilters)) return;
    
    const savedFilter = {
      id: `saved-${Date.now()}`,
      name,
      timestamp: new Date().toISOString(),
      filters: JSON.parse(JSON.stringify(this.activeFilters)),
    };
    
    // Add to saved filters
    this.savedFilters.push(savedFilter);
    
    // Save to local storage
    try {
      localStorage.setItem(
        `${this.options.storageName}-saved`,
        JSON.stringify(this.savedFilters)
      );
    } catch (error) {
      this.options.adapter.logger.error("Failed to save filter", { error });
    }
    
    // Update UI
    this.renderSavedFilters();
  }

  /**
   * Check if a filter is empty (no active filters)
   * 
   * @param {Object} filter - Filter object
   * @returns {boolean} True if the filter is empty
   */
  isEmptyFilter(filter) {
    if (filter.search && filter.search.trim() !== "") {
      return false;
    }
    
    if (filter.categories) {
      for (const categoryOptions of Object.values(filter.categories)) {
        if (categoryOptions.length > 0) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Apply a filter
   * 
   * @param {Object} filter - Filter to apply
   */
  applyFilter(filter) {
    this.activeFilters = JSON.parse(JSON.stringify(filter));
    
    // Update UI to reflect selected filters
    this.updateFilterUI();
    
    // Notify of filter change
    if (this.options.onFilterChange) {
      this.options.onFilterChange(this.activeFilters);
    }
    
    // Save to history
    this.saveFilterToHistory();
  }

  /**
   * Update the search filter
   * 
   * @param {string} searchTerm - Search term
   */
  updateSearchFilter(searchTerm) {
    this.activeFilters.search = searchTerm;
    
    // Update UI
    const searchInput = this.element.querySelector(".advanced-filter-search input");
    if (searchInput) {
      searchInput.value = searchTerm;
    }
    
    // Notify of filter change
    if (this.options.onFilterChange) {
      this.options.onFilterChange(this.activeFilters);
    }
  }

  /**
   * Toggle a category filter option
   * 
   * @param {string} categoryId - Category ID
   * @param {string} optionId - Option ID
   * @param {boolean} selected - Whether the option is selected
   */
  toggleCategoryOption(categoryId, optionId, selected) {
    // Initialize category array if not exists
    if (!this.activeFilters.categories[categoryId]) {
      this.activeFilters.categories[categoryId] = [];
    }
    
    const optionIndex = this.activeFilters.categories[categoryId].indexOf(optionId);
    
    if (selected && optionIndex === -1) {
      // Add option
      this.activeFilters.categories[categoryId].push(optionId);
    } else if (!selected && optionIndex !== -1) {
      // Remove option
      this.activeFilters.categories[categoryId].splice(optionIndex, 1);
      
      // Remove empty categories
      if (this.activeFilters.categories[categoryId].length === 0) {
        delete this.activeFilters.categories[categoryId];
      }
    }
    
    // Notify of filter change
    if (this.options.onFilterChange) {
      this.options.onFilterChange(this.activeFilters);
    }
    
    // Save to history if significant change
    if (selected) {
      this.saveFilterToHistory();
    }
  }

  /**
   * Reset all filters
   */
  resetFilters() {
    this.activeFilters = {
      search: "",
      categories: {},
    };
    
    // Update UI
    this.updateFilterUI();
    
    // Notify of filter change
    if (this.options.onFilterChange) {
      this.options.onFilterChange(this.activeFilters);
    }
  }

  /**
   * Update the filter UI to match current filter state
   */
  updateFilterUI() {
    // Update search input
    const searchInput = this.element.querySelector(".advanced-filter-search input");
    if (searchInput) {
      searchInput.value = this.activeFilters.search || "";
    }
    
    // Update category options
    this.options.filters.categories.forEach(category => {
      const selectedOptions = this.activeFilters.categories[category.id] || [];
      
      category.options.forEach(option => {
        const checkbox = this.element.querySelector(
          `#filter-option-${category.id}-${option.id.replace(/\s+/g, '_')}`
        );
        
        if (checkbox) {
          checkbox.checked = selectedOptions.includes(option.id);
        }
      });
    });
    
    // Update active filter tags
    this.renderActiveFilterTags();
  }

  /**
   * Render the filter component
   */
  render() {
    if (!this.element) return;
    
    let html = '<div class="advanced-filter">';
    
    // Search box
    html += `
      <div class="advanced-filter-search">
        <input type="text" placeholder="Search..." value="${this.activeFilters.search || ''}">
        <button class="advanced-filter-search-button">🔍</button>
      </div>
    `;
    
    // Quick actions
    html += `
      <div class="advanced-filter-actions">
        <button class="advanced-filter-reset">Reset</button>
        <button class="advanced-filter-save">Save Filter</button>
      </div>
    `;
    
    // Active filter tags
    html += '<div class="advanced-filter-tags"></div>';
    
    // Filter categories
    if (this.options.filters.categories.length > 0) {
      html += '<div class="advanced-filter-categories">';
      
      this.options.filters.categories.forEach(category => {
        const selectedOptions = this.activeFilters.categories[category.id] || [];
        
        html += `
          <div class="advanced-filter-category">
            <div class="advanced-filter-category-header">${category.name}</div>
            <div class="advanced-filter-category-options">
        `;
        
        category.options.forEach(option => {
          const optionId = option.id.replace(/\s+/g, '_');
          const isChecked = selectedOptions.includes(option.id) ? 'checked' : '';
          
          html += `
            <label class="advanced-filter-option">
              <input type="checkbox" id="filter-option-${category.id}-${optionId}" 
                data-category="${category.id}" data-option="${option.id}" ${isChecked}>
              <span>${option.name}</span>
            </label>
          `;
        });
        
        html += '</div></div>';
      });
      
      html += '</div>';
    }
    
    // Saved filters
    html += '<div class="advanced-filter-saved-filters"></div>';
    
    // Filter history
    html += '<div class="advanced-filter-history"></div>';
    
    html += '</div>';
    
    // Set filter HTML
    this.element.innerHTML = html;
    
    // Add CSS if not already present
    this.ensureStylesAreApplied();
    
    // Render saved filters and history
    this.renderSavedFilters();
    this.renderFilterHistory();
    this.renderActiveFilterTags();
  }

  /**
   * Render active filter tags
   */
  renderActiveFilterTags() {
    const tagsContainer = this.element.querySelector(".advanced-filter-tags");
    if (!tagsContainer) return;
    
    let html = '';
    
    // Add search tag
    if (this.activeFilters.search && this.activeFilters.search.trim() !== "") {
      html += `
        <div class="advanced-filter-tag">
          <span>Search: ${this.activeFilters.search}</span>
          <button class="advanced-filter-tag-remove" data-tag-type="search">×</button>
        </div>
      `;
    }
    
    // Add category tags
    if (this.activeFilters.categories) {
      for (const [categoryId, options] of Object.entries(this.activeFilters.categories)) {
        if (options.length === 0) continue;
        
        // Find category name
        const category = this.options.filters.categories.find(c => c.id === categoryId);
        if (!category) continue;
        
        options.forEach(optionId => {
          // Find option name
          const option = category.options.find(o => o.id === optionId);
          if (!option) return;
          
          html += `
            <div class="advanced-filter-tag">
              <span>${category.name}: ${option.name}</span>
              <button class="advanced-filter-tag-remove" 
                data-tag-type="category" 
                data-category="${categoryId}" 
                data-option="${optionId}">×</button>
            </div>
          `;
        });
      }
    }
    
    tagsContainer.innerHTML = html;
  }

  /**
   * Render saved filters
   */
  renderSavedFilters() {
    const container = this.element.querySelector(".advanced-filter-saved-filters");
    if (!container || this.savedFilters.length === 0) return;
    
    let html = '<div class="advanced-filter-section-header">Saved Filters</div>';
    html += '<div class="advanced-filter-saved-filters-list">';
    
    this.savedFilters.forEach(filter => {
      html += `
        <div class="advanced-filter-saved-filter" data-filter-id="${filter.id}">
          <span>${filter.name}</span>
          <div class="advanced-filter-saved-filter-actions">
            <button class="advanced-filter-apply-saved" data-filter-id="${filter.id}">Apply</button>
            <button class="advanced-filter-delete-saved" data-filter-id="${filter.id}">×</button>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
  }

  /**
   * Render filter history
   */
  renderFilterHistory() {
    const container = this.element.querySelector(".advanced-filter-history");
    if (!container || this.filterHistory.length === 0) return;
    
    let html = '<div class="advanced-filter-section-header">Recent Filters</div>';
    html += '<div class="advanced-filter-history-list">';
    
    this.filterHistory.slice(0, 5).forEach(historyEntry => {
      const filterSummary = this.getFilterSummary(historyEntry.filters);
      const timestamp = new Date(historyEntry.timestamp).toLocaleString();
      
      html += `
        <div class="advanced-filter-history-entry" data-filter-id="${historyEntry.id}">
          <div class="advanced-filter-history-summary">${filterSummary}</div>
          <div class="advanced-filter-history-meta">
            <span class="advanced-filter-history-time">${timestamp}</span>
            <button class="advanced-filter-apply-history" data-filter-id="${historyEntry.id}">Apply</button>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
  }

  /**
   * Get a summary of a filter for display
   * 
   * @param {Object} filter - Filter object
   * @returns {string} Filter summary
   */
  getFilterSummary(filter) {
    const parts = [];
    
    if (filter.search && filter.search.trim() !== "") {
      parts.push(`Search: "${filter.search}"`);
    }
    
    let categoryCount = 0;
    let optionCount = 0;
    
    if (filter.categories) {
      for (const [categoryId, options] of Object.entries(filter.categories)) {
        if (options.length === 0) continue;
        
        categoryCount++;
        optionCount += options.length;
      }
    }
    
    if (categoryCount > 0) {
      parts.push(`${optionCount} option${optionCount !== 1 ? 's' : ''} in ${categoryCount} categor${categoryCount !== 1 ? 'ies' : 'y'}`);
    }
    
    return parts.length > 0 ? parts.join(', ') : 'Empty filter';
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Search input
    const searchInput = this.element.querySelector(".advanced-filter-search input");
    const searchButton = this.element.querySelector(".advanced-filter-search-button");
    
    if (searchInput) {
      searchInput.addEventListener("input", event => {
        this.activeFilters.search = event.target.value;
      });
      
      searchInput.addEventListener("keyup", event => {
        if (event.key === "Enter") {
          if (this.options.onFilterChange) {
            this.options.onFilterChange(this.activeFilters);
          }
          this.saveFilterToHistory();
        }
      });
    }
    
    if (searchButton) {
      searchButton.addEventListener("click", () => {
        if (this.options.onFilterChange) {
          this.options.onFilterChange(this.activeFilters);
        }
        this.saveFilterToHistory();
      });
    }
    
    // Reset button
    const resetButton = this.element.querySelector(".advanced-filter-reset");
    if (resetButton) {
      resetButton.addEventListener("click", () => this.resetFilters());
    }
    
    // Save filter button
    const saveButton = this.element.querySelector(".advanced-filter-save");
    if (saveButton) {
      saveButton.addEventListener("click", () => {
        const name = prompt("Enter a name for this filter:");
        if (name) {
          this.saveFilter(name);
        }
      });
    }
    
    // Category option checkboxes
    const optionCheckboxes = this.element.querySelectorAll(".advanced-filter-option input");
    optionCheckboxes.forEach(checkbox => {
      checkbox.addEventListener("change", event => {
        const categoryId = checkbox.dataset.category;
        const optionId = checkbox.dataset.option;
        this.toggleCategoryOption(categoryId, optionId, checkbox.checked);
      });
    });
    
    // Tag remove buttons
    this.element.addEventListener("click", event => {
      if (event.target.classList.contains("advanced-filter-tag-remove")) {
        const tagType = event.target.dataset.tagType;
        
        if (tagType === "search") {
          this.updateSearchFilter("");
        } else if (tagType === "category") {
          const categoryId = event.target.dataset.category;
          const optionId = event.target.dataset.option;
          this.toggleCategoryOption(categoryId, optionId, false);
        }
      }
    });
    
    // Apply saved filter
    this.element.addEventListener("click", event => {
      if (event.target.classList.contains("advanced-filter-apply-saved")) {
        const filterId = event.target.dataset.filterId;
        const savedFilter = this.savedFilters.find(f => f.id === filterId);
        
        if (savedFilter) {
          this.applyFilter(savedFilter.filters);
        }
      }
    });
    
    // Delete saved filter
    this.element.addEventListener("click", event => {
      if (event.target.classList.contains("advanced-filter-delete-saved")) {
        const filterId = event.target.dataset.filterId;
        this.savedFilters = this.savedFilters.filter(f => f.id !== filterId);
        
        // Save to local storage
        try {
          localStorage.setItem(
            `${this.options.storageName}-saved`,
            JSON.stringify(this.savedFilters)
          );
        } catch (error) {
          this.options.adapter.logger.error("Failed to save filters", { error });
        }
        
        // Update UI
        this.renderSavedFilters();
      }
    });
    
    // Apply history filter
    this.element.addEventListener("click", event => {
      if (event.target.classList.contains("advanced-filter-apply-history")) {
        const filterId = event.target.dataset.filterId;
        const historyEntry = this.filterHistory.find(f => f.id === filterId);
        
        if (historyEntry) {
          this.applyFilter(historyEntry.filters);
        }
      }
    });
  }

  /**
   * Ensure CSS styles are applied
   */
  ensureStylesAreApplied() {
    const styleId = 'advanced-filter-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .advanced-filter {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          margin-bottom: 20px;
        }
        
        .advanced-filter-search {
          display: flex;
          margin-bottom: 16px;
        }
        
        .advanced-filter-search input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px 0 0 4px;
          font-size: 14px;
        }
        
        .advanced-filter-search-button {
          padding: 8px 12px;
          background: #f0f0f0;
          border: 1px solid #ddd;
          border-left: none;
          border-radius: 0 4px 4px 0;
          cursor: pointer;
        }
        
        .advanced-filter-search-button:hover {
          background: #e5e5e5;
        }
        
        .advanced-filter-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        
        .advanced-filter-actions button {
          padding: 6px 12px;
          background: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
        }
        
        .advanced-filter-actions button:hover {
          background: #e5e5e5;
        }
        
        .advanced-filter-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
        }
        
        .advanced-filter-tag {
          display: flex;
          align-items: center;
          background: #f0f7ff;
          border: 1px solid #d0e0f7;
          border-radius: 16px;
          padding: 4px 12px;
          font-size: 13px;
        }
        
        .advanced-filter-tag-remove {
          margin-left: 6px;
          color: #666;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
        }
        
        .advanced-filter-tag-remove:hover {
          color: #ff4444;
        }
        
        .advanced-filter-categories {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }
        
        .advanced-filter-category {
          border: 1px solid #eee;
          border-radius: 4px;
          overflow: hidden;
        }
        
        .advanced-filter-category-header {
          background: #f5f5f5;
          padding: 8px 12px;
          font-weight: 600;
          font-size: 14px;
          border-bottom: 1px solid #eee;
        }
        
        .advanced-filter-category-options {
          padding: 8px 12px;
          max-height: 200px;
          overflow-y: auto;
        }
        
        .advanced-filter-option {
          display: flex;
          align-items: center;
          margin-bottom: 6px;
          font-size: 13px;
          cursor: pointer;
        }
        
        .advanced-filter-option:last-child {
          margin-bottom: 0;
        }
        
        .advanced-filter-option input {
          margin-right: 6px;
        }
        
        .advanced-filter-section-header {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 8px;
          color: #555;
        }
        
        .advanced-filter-saved-filters {
          margin-bottom: 20px;
        }
        
        .advanced-filter-saved-filters-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .advanced-filter-saved-filter {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #f9f9f9;
          border: 1px solid #eee;
          border-radius: 4px;
          font-size: 13px;
        }
        
        .advanced-filter-saved-filter-actions {
          display: flex;
          gap: 8px;
        }
        
        .advanced-filter-saved-filter-actions button {
          background: none;
          border: none;
          cursor: pointer;
          color: #666;
        }
        
        .advanced-filter-apply-saved:hover {
          color: #4285f4;
        }
        
        .advanced-filter-delete-saved:hover {
          color: #ff4444;
        }
        
        .advanced-filter-history {
          margin-bottom: 20px;
        }
        
        .advanced-filter-history-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .advanced-filter-history-entry {
          padding: 8px 12px;
          background: #f9f9f9;
          border: 1px solid #eee;
          border-radius: 4px;
          font-size: 13px;
        }
        
        .advanced-filter-history-summary {
          margin-bottom: 4px;
        }
        
        .advanced-filter-history-meta {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #888;
        }
        
        .advanced-filter-apply-history {
          background: none;
          border: none;
          cursor: pointer;
          color: #4285f4;
          font-size: 12px;
        }
        
        .advanced-filter-apply-history:hover {
          text-decoration: underline;
        }
        
        @media (prefers-color-scheme: dark) {
          .advanced-filter-search input {
            background-color: #333;
            border-color: #555;
            color: #eee;
          }
          
          .advanced-filter-search-button,
          .advanced-filter-actions button {
            background-color: #444;
            border-color: #555;
            color: #eee;
          }
          
          .advanced-filter-search-button:hover,
          .advanced-filter-actions button:hover {
            background-color: #555;
          }
          
          .advanced-filter-tag {
            background-color: #2d4865;
            border-color: #3a5475;
            color: #eee;
          }
          
          .advanced-filter-category {
            border-color: #444;
          }
          
          .advanced-filter-category-header {
            background-color: #333;
            border-color: #444;
            color: #eee;
          }
          
          .advanced-filter-saved-filter,
          .advanced-filter-history-entry {
            background-color: #333;
            border-color: #444;
            color: #eee;
          }
          
          .advanced-filter-section-header {
            color: #bbb;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Get current active filters
   * 
   * @returns {Object} Active filters
   */
  getActiveFilters() {
    return JSON.parse(JSON.stringify(this.activeFilters));
  }

  /**
   * Destroy the filter and cleanup
   */
  destroy() {
    if (this.element) {
      this.element.innerHTML = '';
    }
  }
}

export default AdvancedFilter;