/**
 * Internationalization (i18n) for Claude Neural Framework
 * =====================================================
 * 
 * Provides a standardized way to handle multilingual text and localization
 * across the framework.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// Import standardized config manager
import configManager, { ConfigType } from '../config/config-manager';

// Import standardized logger
import { Logger } from '../logging/logger';

// Import standardized error handling
import { 
  ValidationError, 
  NotFoundError
} from '../error/error-handler';

// Create logger instance
const logger = new Logger('i18n');

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
 * Type for i18n options
 */
export interface I18nOptions {
  locale?: string;
  fallbackLocale?: string;
  debug?: boolean;
  messages?: Record<string, Record<string, any>>;
}

/**
 * Type for messages
 */
export type Messages = Record<string, Record<string, any>>;

/**
 * Type for translation parameters
 */
export interface TranslationParams {
  count?: number;
  [key: string]: any;
}

/**
 * Type for scoped i18n instance
 */
export interface ScopedI18n {
  translate(key: string, params?: TranslationParams, locale?: string | null): string;
  t(key: string, params?: TranslationParams, locale?: string | null): string;
  formatDate(date: Date | number, options?: Intl.DateTimeFormatOptions, locale?: string | null): string;
  formatNumber(number: number, options?: Intl.NumberFormatOptions, locale?: string | null): string;
  formatCurrency(number: number, currency?: string, options?: Intl.NumberFormatOptions, locale?: string | null): string;
  formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit, options?: Intl.RelativeTimeFormatOptions, locale?: string | null): string;
}

/**
 * Internationalization class
 */
export class I18n {
  private locale: string;
  private fallbackLocale: string;
  private debug: boolean;
  private messages: Messages;
  private pluralRules: Intl.PluralRules;
  
  /**
   * Create a new i18n instance
   * 
   * @param options - Configuration options
   */
  constructor(options: I18nOptions = {}) {
    const configLocale = this.getConfigLocale();
    this.locale = options.locale || configLocale || DEFAULT_LOCALE;
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
   * @returns Locale from configuration
   * @private
   */
  private getConfigLocale(): string | null {
    try {
      return configManager.getConfigValue<string>(ConfigType.GLOBAL, 'language');
    } catch (err) {
      logger.warn('Failed to get locale from configuration', { error: err });
      return null;
    }
  }
  
  /**
   * Set plural rules for locale
   * 
   * @param locale - Locale to use
   * @private
   */
  private setPluralRules(locale: string): void {
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
  private loadAllMessages(): void {
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
   * @param locale - Locale to load
   * @private
   */
  private loadLocaleMessages(locale: string): void {
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
  private loadCustomMessages(): void {
    const globalConfigPath = configManager.globalConfigPath || path.join(os.homedir(), '.claude');
    const customLocaleDir = path.join(globalConfigPath, 'locales');
    
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
   * @param locale - Locale to set
   * @returns Success
   */
  public setLocale(locale: string): boolean {
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
   * @returns Available locales
   */
  public getAvailableLocales(): string[] {
    return Object.keys(this.messages);
  }
  
  /**
   * Add messages
   * 
   * @param messages - Messages to add
   * @param locale - Locale to add messages to (optional)
   */
  public addMessages(messages: Record<string, any>, locale: string | null = null): void {
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
   * @param key - Message key
   * @param params - Parameters to interpolate
   * @param locale - Locale to use (defaults to current locale)
   * @returns Translated message
   */
  public translate(key: string, params: TranslationParams = {}, locale: string | null = null): string {
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
  public t(key: string, params: TranslationParams = {}, locale: string | null = null): string {
    return this.translate(key, params, locale);
  }
  
  /**
   * Interpolate parameters into message
   * 
   * @param message - Message to interpolate
   * @param params - Parameters to interpolate
   * @returns Interpolated message
   * @private
   */
  private interpolate(message: string, params: TranslationParams): string {
    return message.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }
  
  /**
   * Format date
   * 
   * @param date - Date to format
   * @param options - Intl.DateTimeFormat options
   * @param locale - Locale to use (defaults to current locale)
   * @returns Formatted date
   */
  public formatDate(date: Date | number, options: Intl.DateTimeFormatOptions = {}, locale: string | null = null): string {
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
   * @param number - Number to format
   * @param options - Intl.NumberFormat options
   * @param locale - Locale to use (defaults to current locale)
   * @returns Formatted number
   */
  public formatNumber(number: number, options: Intl.NumberFormatOptions = {}, locale: string | null = null): string {
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
   * @param number - Number to format
   * @param currency - Currency code
   * @param options - Intl.NumberFormat options
   * @param locale - Locale to use (defaults to current locale)
   * @returns Formatted currency
   */
  public formatCurrency(number: number, currency = 'USD', options: Intl.NumberFormatOptions = {}, locale: string | null = null): string {
    return this.formatNumber(number, {
      style: 'currency',
      currency,
      ...options
    }, locale);
  }
  
  /**
   * Format relative time
   * 
   * @param value - Value to format
   * @param unit - Unit to format (year, quarter, month, week, day, hour, minute, second)
   * @param options - Intl.RelativeTimeFormat options
   * @param locale - Locale to use (defaults to current locale)
   * @returns Formatted relative time
   */
  public formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit, options: Intl.RelativeTimeFormatOptions = {}, locale: string | null = null): string {
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
   * @param scope - Scope prefix
   * @returns Scoped i18n instance
   */
  public scope(scope: string): ScopedI18n {
    const i18n = this;
    
    return {
      translate(key: string, params: TranslationParams = {}, locale: string | null = null): string {
        return i18n.translate(`${scope}.${key}`, params, locale);
      },
      t(key: string, params: TranslationParams = {}, locale: string | null = null): string {
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

// Export singleton instance and class
export default i18n;