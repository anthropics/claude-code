/**
 * Unified UI Adapter
 * ================
 * 
 * Dieser Adapter kombiniert die Funktionalitäten des Schema-UI-Adapters
 * und der bestehenden Framework-Adapter für eine einheitliche Integration.
 */

import { createFrameworkAdapter, standaloneAdapter } from '../schema_ui/adapters';
// Importieren der Kernfunktionalitäten
import logger from '../../core/logging/logger';
import * as errorHandler from '../../core/error/error_handler';
import * as configManager from '../../core/config/config_manager';
import { I18n } from '../../core/i18n/i18n';

/**
 * Der vereinheitlichte UI-Adapter, der alle Funktionalitäten kombiniert
 */
export const unifiedAdapter = createFrameworkAdapter({
  // Kernfunktionalitäten
  logger,
  errorHandler,
  config: configManager,
  i18n: new I18n(),
  
  // UI-spezifische Helfer
  ui: {
    theme: {
      getCurrentTheme: () => {
        return document.body.getAttribute('data-theme') || 'light';
      },
      setTheme: (theme) => {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
      }
    },
    
    // Formatierungsfunktionen
    format: {
      number: (value, options = {}) => {
        // Nummer-Formatierungsfunktionen
        return new Intl.NumberFormat(
          options.locale || 'de-DE', 
          options
        ).format(value);
      },
      date: (value, options = {}) => {
        // Datums-Formatierungsfunktionen
        return new Intl.DateTimeFormat(
          options.locale || 'de-DE',
          options
        ).format(value instanceof Date ? value : new Date(value));
      }
    }
  }
});

/**
 * Standalone-Adapter mit minimalen Abhängigkeiten für isolierte Komponenten
 */
export const lightweightAdapter = standaloneAdapter;

export default unifiedAdapter;
