/**
 * Configuration Manager für das Claude Neural Framework
 * 
 * Diese Datei stellt eine zentrale Konfigurationsschnittstelle für 
 * alle Komponenten des Claude Neural Framework zur Verfügung.
 * 
 * @module core/config/config_manager
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Standardpfad für globale Claude-Konfigurationen
 */
const DEFAULT_GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.claude');

/**
 * Lokale Konfigurationspfade
 */
const LOCAL_CONFIG_PATHS = {
  rag: path.resolve(__dirname, 'rag_config.json'),
  mcp: path.resolve(__dirname, 'mcp_config.json'),
  security: path.resolve(__dirname, 'security_constraints.json')
};

/**
 * Hilfsfunktion zum Laden einer JSON-Konfigurationsdatei
 * 
 * @param {string} configPath - Pfad zur Konfigurationsdatei
 * @param {Object} defaultConfig - Standardkonfiguration, falls die Datei nicht existiert
 * @returns {Object} Die geladene Konfiguration
 */
function loadJsonConfig(configPath, defaultConfig = {}) {
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    }
  } catch (err) {
    console.warn(`Warnung: Fehler beim Laden der Konfiguration aus ${configPath}: ${err.message}`);
  }
  
  return defaultConfig;
}

/**
 * Hilfsfunktion zum Speichern einer JSON-Konfigurationsdatei
 * 
 * @param {string} configPath - Pfad zur Konfigurationsdatei
 * @param {Object} config - Zu speichernde Konfiguration
 * @returns {boolean} true bei Erfolg, false bei Fehler
 */
function saveJsonConfig(configPath, config) {
  try {
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Fehler beim Speichern der Konfiguration in ${configPath}: ${err.message}`);
    return false;
  }
}

/**
 * Klasse zur Verwaltung aller Konfigurationen des Claude Neural Framework
 */
class ConfigManager {
  /**
   * Erstellt eine neue Instanz des ConfigManager
   * 
   * @param {Object} options - Konfigurationsoptionen
   * @param {string} options.globalConfigPath - Pfad zur globalen Konfiguration
   */
  constructor(options = {}) {
    this.globalConfigPath = options.globalConfigPath || DEFAULT_GLOBAL_CONFIG_PATH;
    this.configs = {
      rag: null,
      mcp: null,
      security: null,
      global: null
    };
    
    // Stelle sicher, dass der globale Konfigurationspfad existiert
    if (!fs.existsSync(this.globalConfigPath)) {
      fs.mkdirSync(this.globalConfigPath, { recursive: true });
    }
  }
  
  /**
   * Lädt alle Konfigurationen
   */
  loadAllConfigs() {
    // Lokale Konfigurationen laden
    Object.entries(LOCAL_CONFIG_PATHS).forEach(([configType, configPath]) => {
      this.configs[configType] = loadJsonConfig(configPath);
    });
    
    // Globale Konfiguration laden
    const globalConfigPath = path.join(this.globalConfigPath, 'config.json');
    this.configs.global = loadJsonConfig(globalConfigPath);
  }
  
  /**
   * Lädt eine spezifische Konfiguration
   * 
   * @param {string} configType - Konfigurationstyp ('rag', 'mcp', 'security', 'global')
   * @returns {Object} Die geladene Konfiguration
   */
  getConfig(configType) {
    if (!this.configs[configType]) {
      if (configType === 'global') {
        const globalConfigPath = path.join(this.globalConfigPath, 'config.json');
        this.configs[configType] = loadJsonConfig(globalConfigPath);
      } else if (LOCAL_CONFIG_PATHS[configType]) {
        this.configs[configType] = loadJsonConfig(LOCAL_CONFIG_PATHS[configType]);
      } else {
        throw new Error(`Unbekannter Konfigurationstyp: ${configType}`);
      }
    }
    
    return this.configs[configType];
  }
  
  /**
   * Speichert eine Konfiguration
   * 
   * @param {string} configType - Konfigurationstyp ('rag', 'mcp', 'security', 'global')
   * @param {Object} config - Zu speichernde Konfiguration
   * @returns {boolean} true bei Erfolg, false bei Fehler
   */
  saveConfig(configType, config) {
    this.configs[configType] = config;
    
    if (configType === 'global') {
      const globalConfigPath = path.join(this.globalConfigPath, 'config.json');
      return saveJsonConfig(globalConfigPath, config);
    } else if (LOCAL_CONFIG_PATHS[configType]) {
      return saveJsonConfig(LOCAL_CONFIG_PATHS[configType], config);
    } else {
      throw new Error(`Unbekannter Konfigurationstyp: ${configType}`);
    }
  }
  
  /**
   * Aktualisiert einen Konfigurationswert
   * 
   * @param {string} configType - Konfigurationstyp ('rag', 'mcp', 'security', 'global')
   * @param {string} keyPath - Schlüsselpfad (z.B. 'database.type' oder 'servers.brave-search.enabled')
   * @param {any} value - Neuer Wert
   * @returns {boolean} true bei Erfolg, false bei Fehler
   */
  updateConfigValue(configType, keyPath, value) {
    const config = this.getConfig(configType);
    
    // Pfad in Teile aufteilen
    const keyParts = keyPath.split('.');
    
    // Referenz zum Zielobjekt finden
    let target = config;
    for (let i = 0; i < keyParts.length - 1; i++) {
      const part = keyParts[i];
      
      if (!(part in target)) {
        target[part] = {};
      }
      
      target = target[part];
    }
    
    // Wert setzen
    target[keyParts[keyParts.length - 1]] = value;
    
    // Konfiguration speichern
    return this.saveConfig(configType, config);
  }
  
  /**
   * Liest einen Konfigurationswert
   * 
   * @param {string} configType - Konfigurationstyp ('rag', 'mcp', 'security', 'global')
   * @param {string} keyPath - Schlüsselpfad (z.B. 'database.type' oder 'servers.brave-search.enabled')
   * @param {any} defaultValue - Standardwert, falls der Schlüssel nicht existiert
   * @returns {any} Der Konfigurationswert oder der Standardwert
   */
  getConfigValue(configType, keyPath, defaultValue = undefined) {
    const config = this.getConfig(configType);
    
    // Pfad in Teile aufteilen
    const keyParts = keyPath.split('.');
    
    // Durch das Objekt navigieren
    let target = config;
    for (const part of keyParts) {
      if (target === undefined || target === null || typeof target !== 'object') {
        return defaultValue;
      }
      
      target = target[part];
      
      if (target === undefined) {
        return defaultValue;
      }
    }
    
    return target;
  }
  
  /**
   * Prüft, ob ein API-Schlüssel für einen bestimmten Dienst verfügbar ist
   * 
   * @param {string} service - Dienstname ('claude', 'voyage', 'brave')
   * @returns {boolean} true, wenn der API-Schlüssel verfügbar ist, sonst false
   */
  hasApiKey(service) {
    let apiKeyEnv;
    
    switch (service) {
      case 'claude':
        apiKeyEnv = this.getConfigValue('rag', 'claude.api_key_env', 'CLAUDE_API_KEY');
        break;
      case 'voyage':
        apiKeyEnv = this.getConfigValue('rag', 'embedding.api_key_env', 'VOYAGE_API_KEY');
        break;
      case 'brave':
        apiKeyEnv = this.getConfigValue('mcp', 'servers.brave-search.api_key_env', 'BRAVE_API_KEY');
        break;
      default:
        return false;
    }
    
    return Boolean(process.env[apiKeyEnv]);
  }
}

// Export als Singleton
const configManager = new ConfigManager();
module.exports = configManager;
