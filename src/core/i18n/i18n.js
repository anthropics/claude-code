/**
 * Internationalization (i18n) for Claude Neural Framework
 * =====================================================
 * 
 * Provides a standardized way to handle multilingual text and localization
 * across the framework.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Import standardized config manager
const configManager = require('../config/config_manager');
const { CONFIG_TYPES } = configManager;

// Import standardized logger
const logger = require('../logging/logger').createLogger('i18n');

// Import standardized error handling
const { 
  ValidationError, 
  NotFoundError,
  ConfigurationError
} = require('../error/error_handler');

/**
 * Default locale
 */
const DEFAULT_LOCALE = 'en';

/**
 * Built-in locales
 */
const BUILTIN_LOCALES = ['en', 'de', 'fr', 'es', 'zh', 'ja'];

/**
 * Locale files directory
 */
const LOCALE_DIR = path.join(__dirname, 'locales');

/**
 * Internationalization class
 */
class I18n {
  /**
   * Create a new i18n instance
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.locale - Default locale
   * @param {string} options.fallbackLocale - Fallback locale
   * @param {boolean} options.debug - Enable debug mode
   * @param {Object} options.messages - Custom messages
   */
  constructor(options = {}) {
    this.locale = options.locale || this.getConfigLocale() || DEFAULT_LOCALE;
    this.fallbackLocale = options.fallbackLocale || DEFAULT_LOCALE;
    this.debug = options.debug || false;
    this.messages = {};
    this.pluralRules = new Intl.PluralRules();
    
    // Set plural rules for current locale
    this.setPluralRules(this.locale);
    
    // Load messages
    this.loadAllMessages();
    
    // Add custom messages
    if (options.messages) {
      this.addMessages(options.messages);
    }
    
    logger.debug('I18n initialized', { 
      locale: this.locale, 
      fallbackLocale: this.fallbackLocale,
      availableLocales: Object.keys(this.messages)
    });
  }
  
  /**
   * Get locale from configuration
   * 
   * @returns {string} Locale from configuration
   * @private
   */
  getConfigLocale() {
    try {
      return configManager.getConfigValue(CONFIG_TYPES.GLOBAL, 'language');
    } catch (err) {
      logger.warn('Failed to get locale from configuration', { error: err });
      return null;
    }
  }
  
  /**
   * Set plural rules for locale
   * 
   * @param {string} locale - Locale to use
   * @private
   */
  setPluralRules(locale) {
    try {
      this.pluralRules = new Intl.PluralRules(locale);
    } catch (err) {
      logger.warn(`Failed to set plural rules for locale ${locale}`, { error: err });
      this.pluralRules = new Intl.PluralRules(DEFAULT_LOCALE);
    }
  }
  
  /**
   * Load all messages
   * 
   * @private
   */
  loadAllMessages() {
    // Load built-in messages
    for (const locale of BUILTIN_LOCALES) {
      this.loadLocaleMessages(locale);
    }
    
    // Load custom messages
    this.loadCustomMessages();
  }
  
  /**
   * Load locale messages
   * 
   * @param {string} locale - Locale to load
   * @private
   */
  loadLocaleMessages(locale) {
    const localePath = path.join(LOCALE_DIR, `${locale}.json`);
    
    try {
      if (fs.existsSync(localePath)) {
        const messages = JSON.parse(fs.readFileSync(localePath, 'utf8'));
        this.messages[locale] = messages;
        logger.debug(`Loaded locale messages for ${locale}`, { count: Object.keys(messages).length });
      } else {
        logger.warn(`Locale file not found for ${locale}`, { path: localePath });
      }
    } catch (err) {
      logger.error(`Failed to load locale messages for ${locale}`, { error: err });
    }
  }
  
  /**
   * Load custom messages
   * 
   * @private
   */
  loadCustomMessages() {
    const customLocaleDir = path.join(configManager.globalConfigPath, 'locales');
    
    try {
      if (fs.existsSync(customLocaleDir)) {
        const files = fs.readdirSync(customLocaleDir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const locale = file.replace('.json', '');
            const filePath = path.join(customLocaleDir, file);
            
            try {
              const messages = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              
              if (!this.messages[locale]) {
                this.messages[locale] = {};
              }
              
              // Merge with existing messages
              this.messages[locale] = {
                ...this.messages[locale],
                ...messages
              };
              
              logger.debug(`Loaded custom locale messages for ${locale}`, { count: Object.keys(messages).length });
            } catch (err) {
              logger.error(`Failed to load custom locale messages for ${locale}`, { error: err });
            }
          }
        }
      } else {
        logger.debug('No custom locale directory found', { path: customLocaleDir });
      }
    } catch (err) {
      logger.error('Failed to load custom messages', { error: err });
    }
  }
  
  /**
   * Set locale
   * 
   * @param {string} locale - Locale to set
   * @returns {boolean} Success
   */
  setLocale(locale) {
    if (!this.messages[locale]) {
      logger.warn(`Locale ${locale} not available, falling back to ${this.fallbackLocale}`);
      return false;
    }
    
    this.locale = locale;
    this.setPluralRules(locale);
    
    logger.debug(`Locale set to ${locale}`);
    return true;
  }
  
  /**
   * Get available locales
   * 
   * @returns {Array} Available locales
   */
  getAvailableLocales() {
    return Object.keys(this.messages);
  }
  
  /**
   * Add messages
   * 
   * @param {Object} messages - Messages to add
   * @param {string} locale - Locale to add messages to (optional)
   */
  addMessages(messages, locale = null) {
    if (locale) {
      // Add messages for specific locale
      if (!this.messages[locale]) {
        this.messages[locale] = {};
      }
      
      this.messages[locale] = {
        ...this.messages[locale],
        ...messages
      };
      
      logger.debug(`Added messages for ${locale}`, { count: Object.keys(messages).length });
    } else {
      // Add messages for all locales
      for (const [loc, msgs] of Object.entries(messages)) {
        if (!this.messages[loc]) {
          this.messages[loc] = {};
        }
        
        this.messages[loc] = {
          ...this.messages[loc],
          ...msgs
        };
        
        logger.debug(`Added messages for ${loc}`, { count: Object.keys(msgs).length });
      }
    }
  }
  
  /**
   * Translate a message
   * 
   * @param {string} key - Message key
   * @param {Object} params - Parameters to interpolate
   * @param {string} locale - Locale to use (defaults to current locale)
   * @returns {string} Translated message
   */
  translate(key, params = {}, locale = null) {
    const usedLocale = locale || this.locale;
    
    // Get messages for locale
    let messages = this.messages[usedLocale];
    
    // Fall back to default locale if message not found
    if (!messages || !messages[key]) {
      if (usedLocale !== this.fallbackLocale) {
        logger.debug(`Message ${key} not found in ${usedLocale}, falling back to ${this.fallbackLocale}`);
        messages = this.messages[this.fallbackLocale];
      }
    }
    
    // Get message
    let message = messages?.[key];
    
    // Return key if message not found
    if (!message) {
      if (this.debug) {
        logger.warn(`Message ${key} not found in ${usedLocale} or ${this.fallbackLocale}`);
        return `[${key}]`;
      }
      return key;
    }
    
    // Handle pluralization
    if (typeof message === 'object' && params.count !== undefined) {
      const rule = this.pluralRules.select(params.count);
      message = message[rule] || message.other || Object.values(message)[0];
    }
    
    // Interpolate parameters
    if (params && typeof message === 'string') {
      message = this.interpolate(message, params);
    }
    
    return message;
  }
  
  /**
   * Alias for translate
   */
  t(key, params = {}, locale = null) {
    return this.translate(key, params, locale);
  }
  
  /**
   * Interpolate parameters into message
   * 
   * @param {string} message - Message to interpolate
   * @param {Object} params - Parameters to interpolate
   * @returns {string} Interpolated message
   * @private
   */
  interpolate(message, params) {
    return message.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }
  
  /**
   * Format date
   * 
   * @param {Date|number} date - Date to format
   * @param {Object} options - Intl.DateTimeFormat options
   * @param {string} locale - Locale to use (defaults to current locale)
   * @returns {string} Formatted date
   */
  formatDate(date, options = {}, locale = null) {
    const usedLocale = locale || this.locale;
    
    try {
      const formatter = new Intl.DateTimeFormat(usedLocale, options);
      return formatter.format(date);
    } catch (err) {
      logger.error(`Failed to format date`, { error: err });
      return String(date);
    }
  }
  
  /**
   * Format number
   * 
   * @param {number} number - Number to format
   * @param {Object} options - Intl.NumberFormat options
   * @param {string} locale - Locale to use (defaults to current locale)
   * @returns {string} Formatted number
   */
  formatNumber(number, options = {}, locale = null) {
    const usedLocale = locale || this.locale;
    
    try {
      const formatter = new Intl.NumberFormat(usedLocale, options);
      return formatter.format(number);
    } catch (err) {
      logger.error(`Failed to format number`, { error: err });
      return String(number);
    }
  }
  
  /**
   * Format currency
   * 
   * @param {number} number - Number to format
   * @param {string} currency - Currency code
   * @param {Object} options - Intl.NumberFormat options
   * @param {string} locale - Locale to use (defaults to current locale)
   * @returns {string} Formatted currency
   */
  formatCurrency(number, currency = 'USD', options = {}, locale = null) {
    return this.formatNumber(number, {
      style: 'currency',
      currency,
      ...options
    }, locale);
  }
  
  /**
   * Format relative time
   * 
   * @param {number} value - Value to format
   * @param {string} unit - Unit to format (year, quarter, month, week, day, hour, minute, second)
   * @param {Object} options - Intl.RelativeTimeFormat options
   * @param {string} locale - Locale to use (defaults to current locale)
   * @returns {string} Formatted relative time
   */
  formatRelativeTime(value, unit, options = {}, locale = null) {
    const usedLocale = locale || this.locale;
    
    try {
      const formatter = new Intl.RelativeTimeFormat(usedLocale, {
        numeric: 'auto',
        ...options
      });
      return formatter.format(value, unit);
    } catch (err) {
      logger.error(`Failed to format relative time`, { error: err });
      return String(value);
    }
  }
  
  /**
   * Create a scoped i18n instance
   * 
   * @param {string} scope - Scope prefix
   * @returns {Object} Scoped i18n instance
   */
  scope(scope) {
    const i18n = this;
    
    return {
      translate(key, params = {}, locale = null) {
        return i18n.translate(`${scope}.${key}`, params, locale);
      },
      t(key, params = {}, locale = null) {
        return i18n.translate(`${scope}.${key}`, params, locale);
      },
      formatDate: i18n.formatDate.bind(i18n),
      formatNumber: i18n.formatNumber.bind(i18n),
      formatCurrency: i18n.formatCurrency.bind(i18n),
      formatRelativeTime: i18n.formatRelativeTime.bind(i18n)
    };
  }
}

// Create singleton i18n instance
const i18n = new I18n();

// Export singleton instance
module.exports = i18n;

// Export class
module.exports.I18n = I18n;