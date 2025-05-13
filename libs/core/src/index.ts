/**
 * Core Module for Claude Neural Framework
 * 
 * Exports all core components and utilities
 */

// Export configuration
export * from './config/config-manager';
export { default as configManager } from './config/config-manager';

// Export error handling
export * from './error/error-handler';

// Export logging
export * from './logging/logger';

// Export i18n
export * from './i18n';
export { default as i18n } from './i18n';