/**
 * Unified UI Adapter
 * ================
 *
 * This adapter combines functionality from the Schema-UI adapter
 * and existing framework adapters for a unified integration approach.
 */

import {
  createFrameworkAdapter,
  standaloneAdapter,
} from "../schema_ui/adapters";
import logger from "../../core/logging/logger";
import * as errorHandler from "../../core/error/error_handler";
import * as configManager from "../../core/config/config_manager";
import { I18n } from "../../core/i18n/i18n";

/**
 * The unified UI adapter that combines all functionality
 */
export const unifiedAdapter = createFrameworkAdapter({
  // Core functionality
  logger,
  errorHandler,
  config: configManager,
  i18n: new I18n(),

  // UI-specific helpers
  ui: {
    theme: {
      /**
       * Get the current theme
       * @returns {string} Current theme name
       */
      getCurrentTheme: () => {
        return document.body.getAttribute("data-theme") || "light";
      },
      
      /**
       * Set the current theme
       * @param {string} theme - Theme name to set
       */
      setTheme: (theme) => {
        document.body.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
      },
    },

    // Formatting functions
    format: {
      /**
       * Format a number according to locale and options
       * @param {number} value - Number to format
       * @param {Object} options - Intl.NumberFormat options
       * @returns {string} Formatted number
       */
      number: (value, options = {}) => {
        return new Intl.NumberFormat(
          options.locale || "de-DE", 
          options
        ).format(value);
      },
      
      /**
       * Format a date according to locale and options
       * @param {Date|string|number} value - Date to format
       * @param {Object} options - Intl.DateTimeFormat options
       * @returns {string} Formatted date
       */
      date: (value, options = {}) => {
        return new Intl.DateTimeFormat(
          options.locale || "de-DE", 
          options
        ).format(value instanceof Date ? value : new Date(value));
      },
      
      /**
       * Format a currency value
       * @param {number} value - Value to format
       * @param {string} currency - Currency code
       * @param {Object} options - Additional formatting options
       * @returns {string} Formatted currency value
       */
      currency: (value, currency = "EUR", options = {}) => {
        return new Intl.NumberFormat(
          options.locale || "de-DE", 
          {
            style: "currency",
            currency,
            ...options
          }
        ).format(value);
      },
      
      /**
       * Format a percentage value
       * @param {number} value - Value to format (0-1)
       * @param {Object} options - Additional formatting options
       * @returns {string} Formatted percentage
       */
      percent: (value, options = {}) => {
        return new Intl.NumberFormat(
          options.locale || "de-DE", 
          {
            style: "percent",
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
            ...options
          }
        ).format(value);
      }
    },
    
    // Data utilities
    data: {
      /**
       * Deep clone an object
       * @param {Object} obj - Object to clone
       * @returns {Object} Cloned object
       */
      deepClone: (obj) => {
        return JSON.parse(JSON.stringify(obj));
      },
      
      /**
       * Safely access a nested property in an object
       * @param {Object} obj - Object to access
       * @param {string} path - Path to property (e.g. "user.profile.name")
       * @param {*} defaultValue - Default value if property doesn't exist
       * @returns {*} Property value or default
       */
      getNestedValue: (obj, path, defaultValue = undefined) => {
        if (!obj || !path) return defaultValue;
        
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
          if (current === undefined || current === null || typeof current !== 'object') {
            return defaultValue;
          }
          
          current = current[key];
        }
        
        return current !== undefined ? current : defaultValue;
      }
    }
  },
});

/**
 * Lightweight adapter with minimal dependencies for isolated components
 */
export const lightweightAdapter = standaloneAdapter;

export default unifiedAdapter;