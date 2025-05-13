#!/usr/bin/env node

/**
 * Color Schema Manager
 * ===================
 * 
 * Manages color schemas for UI components of the Claude Neural Framework.
 * Enables creating, editing, and applying custom color schemas.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { execSync } = require('child_process');
const os = require('os');

// Set shell language to German (after strict mode)
process.env.LANG = 'de_DE.UTF-8';

// Import standardized config manager
const configManager = require('../config/config_manager');
const { CONFIG_TYPES } = configManager;

// Ensure user directory exists
if (!fs.existsSync(configManager.globalConfigPath)) {
  try {
    fs.mkdirSync(configManager.globalConfigPath, { recursive: true });
  } catch (err) {
    console.error(`Error creating user config directory: ${err.message}`);
  }
}

/**
 * Load color schema configuration using the standardized config manager
 * @returns {Object} The color schema configuration
 */
function loadConfig() {
  try {
    // Get the color schema configuration from the config manager
    const colorConfig = configManager.getConfig(CONFIG_TYPES.COLOR_SCHEMA);

    // Make sure the userPreferences property exists
    if (!colorConfig.userPreferences) {
      colorConfig.userPreferences = {
        activeTheme: 'dark',
        custom: null
      };
    }

    // Add a backward-compatible COLOR_SCHEMA property if needed
    if (!colorConfig.COLOR_SCHEMA) {
      colorConfig.COLOR_SCHEMA = {
        activeTheme: colorConfig.userPreferences?.activeTheme || 'dark'
      };
    }

    return colorConfig;
  } catch (err) {
    console.error(`Error loading color schema configuration: ${err.message}`);
    // Let's try to access DEFAULT_CONFIGS directly from the module exports
    try {
      const defaultConfigs = require('../config/config_manager').DEFAULT_CONFIGS;
      if (defaultConfigs && defaultConfigs[CONFIG_TYPES.COLOR_SCHEMA]) {
        return JSON.parse(JSON.stringify(defaultConfigs[CONFIG_TYPES.COLOR_SCHEMA]));
      }
      throw new Error('DEFAULT_CONFIGS not found or invalid');
    } catch (defaultErr) {
      console.error(`Failed to get default config: ${defaultErr.message}`);
      // Define a fallback default configuration
      return {
        version: "1.0.0",
        themes: {
          light: {
            name: "Light Theme",
            colors: {
              primary: "#3f51b5",
              secondary: "#7986cb",
              accent: "#ff4081",
              success: "#4caf50",
              warning: "#ff9800",
              danger: "#f44336",
              info: "#2196f3",
              background: "#f8f9fa",
              surface: "#ffffff",
              text: "#212121",
              textSecondary: "#757575",
              border: "#e0e0e0",
              shadow: "rgba(0, 0, 0, 0.1)"
            }
          },
          dark: {
            name: "Dark Theme",
            colors: {
              primary: "#bb86fc",
              secondary: "#03dac6",
              accent: "#cf6679",
              success: "#4caf50",
              warning: "#ff9800",
              danger: "#cf6679",
              info: "#2196f3",
              background: "#121212",
              surface: "#1e1e1e",
              text: "#ffffff",
              textSecondary: "#b0b0b0",
              border: "#333333",
              shadow: "rgba(0, 0, 0, 0.5)"
            }
          }
        },
        userPreferences: {
          activeTheme: "dark",
          custom: null
        },
        COLOR_SCHEMA: {
          activeTheme: "dark"
        }
      };
    }
  }
}

/**
 * Load user color schema configuration
 * @returns {Object|null} The user color schema or null if not found
 */
function loadUserConfig() {
  try {
    const userConfigPath = path.join(configManager.globalConfigPath, 'user.colorschema.json');
    if (fs.existsSync(userConfigPath)) {
      const configData = fs.readFileSync(userConfigPath, 'utf8');
      return JSON.parse(configData);
    }
    return null;
  } catch (err) {
    console.warn(`No user color schema found: ${err.message}`);
    return null;
  }
}

/**
 * Save user color schema configuration
 * @param {Object} userConfig - The user configuration to save
 * @returns {boolean} Success status
 */
function saveUserConfig(userConfig) {
  try {
    const userConfigPath = path.join(configManager.globalConfigPath, 'user.colorschema.json');
    fs.writeFileSync(userConfigPath, JSON.stringify(userConfig, null, 2));
    console.log(`User configuration saved: ${userConfigPath}`);
    
    // Update the main color schema configuration
    const config = loadConfig();
    config.userPreferences = {
      activeTheme: userConfig.activeTheme,
      custom: userConfig.custom
    };
    
    try {
      configManager.saveConfig(CONFIG_TYPES.COLOR_SCHEMA, config);
    } catch (err) {
      console.warn(`Could not update main color schema config: ${err.message}`);
    }
    
    return true;
  } catch (err) {
    console.error(`Error saving user configuration: ${err.message}`);
    return false;
  }
}

/**
 * Apply color schema to existing UI components
 * @param {Object} schema - The color schema to apply
 * @returns {boolean} Success status
 */
function applyColorSchema(schema) {
  try {
    if (!schema) {
      console.error("Invalid schema provided to applyColorSchema");
      return false;
    }
    
    const cssOutput = generateCSS(schema);
    const cssPath = path.join(process.cwd(), 'ui/dashboard/color-schema.css');
    
    // Make sure the directory exists
    const cssDir = path.dirname(cssPath);
    if (!fs.existsSync(cssDir)) {
      fs.mkdirSync(cssDir, { recursive: true });
    }
    
    fs.writeFileSync(cssPath, cssOutput);
    console.log(`CSS file created: ${cssPath}`);
    
    // Link with existing HTML files
    updateHTMLFiles(schema);
    
    return true;
  } catch (err) {
    console.error(`Error applying color schema: ${err.message}`);
    return false;
  }
}

/**
 * Update HTML files to include the color schema CSS
 * @param {Object} schema - The color schema
 */
function updateHTMLFiles(schema) {
  const dashboardPath = path.join(process.cwd(), 'ui/dashboard/index.html');
  
  if (fs.existsSync(dashboardPath)) {
    try {
      let html = fs.readFileSync(dashboardPath, 'utf8');
      
      // Check if color-schema.css is already included
      if (!html.includes('color-schema.css')) {
        // Insert CSS link after the main stylesheet
        html = html.replace(
          /<link rel="stylesheet" href="styles.css">/,
          '<link rel="stylesheet" href="styles.css">\n    <link rel="stylesheet" href="color-schema.css">'
        );
        
        fs.writeFileSync(dashboardPath, html);
        console.log(`Dashboard HTML updated: ${dashboardPath}`);
      }
    } catch (err) {
      console.error(`Error updating HTML files: ${err.message}`);
    }
  }
}

/**
 * Generate CSS from color schema
 * @param {Object} schema - The color schema
 * @returns {string} Generated CSS
 */
function generateCSS(schema) {
  try {
    if (!schema || !schema.colors) {
      throw new Error("Invalid schema format");
    }
    
    const colors = schema.colors;
    
    return `:root {
  /* Primary colors */
  --primary-color: ${colors.primary};
  --secondary-color: ${colors.secondary};
  --accent-color: ${colors.accent};
  
  /* Status colors */
  --success-color: ${colors.success};
  --warning-color: ${colors.warning};
  --danger-color: ${colors.danger};
  --info-color: ${colors.info};
  
  /* Neutral colors */
  --background-color: ${colors.background};
  --surface-color: ${colors.surface};
  --text-color: ${colors.text};
  --text-secondary-color: ${colors.textSecondary};
  --border-color: ${colors.border};
  --shadow-color: ${colors.shadow};
  
  /* Legacy compatibility */
  --light-gray: ${colors.border};
  --medium-gray: ${colors.textSecondary};
  --dark-gray: ${colors.text};
}

/* Base element adjustments */
body {
  background-color: var(--background-color);
  color: var(--text-color);
}

.navbar-dark {
  background-color: var(--primary-color) !important;
}

.card {
  background-color: var(--surface-color);
  border-color: var(--border-color);
  box-shadow: 0 2px 10px var(--shadow-color);
}

.card-header {
  background-color: ${colors.primary}10;
  border-bottom: 1px solid ${colors.primary}20;
}

/* Additional component adjustments */
.table th {
  background-color: ${colors.primary}10;
  color: var(--text-color);
}

.table-hover tbody tr:hover {
  background-color: ${colors.primary}05;
}

.btn-primary {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
}

.btn-secondary {
  background-color: var(--secondary-color);
  border-color: var(--secondary-color);
}

.btn-success {
  background-color: var(--success-color);
  border-color: var(--success-color);
}

.btn-warning {
  background-color: var(--warning-color);
  border-color: var(--warning-color);
}

.btn-danger {
  background-color: var(--danger-color);
  border-color: var(--danger-color);
}

.text-primary {
  color: var(--primary-color) !important;
}

.badge-success {
  background-color: var(--success-color);
}

.badge-warning {
  background-color: var(--warning-color);
}

.badge-danger {
  background-color: var(--danger-color);
}

/* Additional custom components */
.issue-card {
  border-left-color: var(--danger-color);
  background-color: ${colors.danger}08;
}

.issue-card.warning {
  border-left-color: var(--warning-color);
  background-color: ${colors.warning}08;
}

.suggestion-card {
  border-left-color: var(--success-color);
  background-color: ${colors.success}08;
}

/* Darker theme for code blocks with dark background */
pre {
  background-color: ${schema.name.toLowerCase().includes('dark') ? '#1a1a1a' : '#282c34'};
  color: ${schema.name.toLowerCase().includes('dark') ? '#e0e0e0' : '#abb2bf'};
}
`;
  } catch (err) {
    console.error(`Error generating CSS: ${err.message}`);
    return "/* Error generating CSS */";
  }
}

/**
 * Interactive color schema creation
 * @returns {Promise<void>}
 */
async function createColorSchemaInteractive() {
  try {
    const config = loadConfig();
    const userConfig = loadUserConfig() || {
      activeTheme: config.userPreferences ? config.userPreferences.activeTheme : 'dark',
      custom: null
    };
    
    console.log(chalk.bold('\n=== Claude Neural Framework - Color Schema Configuration ===\n'));
    
    // Choose base theme
    const { baseTheme } = await inquirer.prompt([
      {
        type: 'list',
        name: 'baseTheme',
        message: 'Choose a base theme to start with:',
        choices: Object.keys(config.themes).map(theme => ({
          name: `${config.themes[theme].name}`,
          value: theme
        })),
        default: userConfig.activeTheme
      }
    ]);
    
    let selectedTheme = JSON.parse(JSON.stringify(config.themes[baseTheme]));
    
    // Customize colors?
    const { customizeColors } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'customizeColors',
        message: 'Do you want to customize individual colors?',
        default: false
      }
    ]);
    
    if (customizeColors) {
      const { customizeType } = await inquirer.prompt([
        {
          type: 'list',
          name: 'customizeType',
          message: 'Which colors do you want to customize?',
          choices: [
            { name: 'Primary colors (main application colors)', value: 'primary' },
            { name: 'Status colors (success, warning, error)', value: 'status' },
            { name: 'Background and text', value: 'background' },
            { name: 'All colors individually', value: 'all' }
          ]
        }
      ]);
      
      if (customizeType === 'primary' || customizeType === 'all') {
        const primaryColors = await inquirer.prompt([
          {
            type: 'input',
            name: 'primary',
            message: 'Primary color (hex code, e.g. #3f51b5):',
            default: selectedTheme.colors.primary,
            validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Please enter a valid hexadecimal value'
          },
          {
            type: 'input',
            name: 'secondary',
            message: 'Secondary color (hex code):',
            default: selectedTheme.colors.secondary,
            validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Please enter a valid hexadecimal value'
          },
          {
            type: 'input',
            name: 'accent',
            message: 'Accent color (hex code):',
            default: selectedTheme.colors.accent,
            validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Please enter a valid hexadecimal value'
          }
        ]);
        
        selectedTheme.colors.primary = primaryColors.primary;
        selectedTheme.colors.secondary = primaryColors.secondary;
        selectedTheme.colors.accent = primaryColors.accent;
      }
      
      if (customizeType === 'status' || customizeType === 'all') {
        const statusColors = await inquirer.prompt([
          {
            type: 'input',
            name: 'success',
            message: 'Success color (hex code):',
            default: selectedTheme.colors.success,
            validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Please enter a valid hexadecimal value'
          },
          {
            type: 'input',
            name: 'warning',
            message: 'Warning color (hex code):',
            default: selectedTheme.colors.warning,
            validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Please enter a valid hexadecimal value'
          },
          {
            type: 'input',
            name: 'danger',
            message: 'Error color (hex code):',
            default: selectedTheme.colors.danger,
            validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Please enter a valid hexadecimal value'
          },
          {
            type: 'input',
            name: 'info',
            message: 'Information color (hex code):',
            default: selectedTheme.colors.info,
            validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Please enter a valid hexadecimal value'
          }
        ]);
        
        selectedTheme.colors.success = statusColors.success;
        selectedTheme.colors.warning = statusColors.warning;
        selectedTheme.colors.danger = statusColors.danger;
        selectedTheme.colors.info = statusColors.info;
      }
      
      if (customizeType === 'background' || customizeType === 'all') {
        const backgroundColors = await inquirer.prompt([
          {
            type: 'input',
            name: 'background',
            message: 'Background color (hex code):',
            default: selectedTheme.colors.background,
            validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Please enter a valid hexadecimal value'
          },
          {
            type: 'input',
            name: 'surface',
            message: 'Card color (hex code):',
            default: selectedTheme.colors.surface,
            validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Please enter a valid hexadecimal value'
          },
          {
            type: 'input',
            name: 'text',
            message: 'Text color (hex code):',
            default: selectedTheme.colors.text,
            validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Please enter a valid hexadecimal value'
          },
          {
            type: 'input',
            name: 'border',
            message: 'Border color (hex code):',
            default: selectedTheme.colors.border,
            validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Please enter a valid hexadecimal value'
          }
        ]);
        
        selectedTheme.colors.background = backgroundColors.background;
        selectedTheme.colors.surface = backgroundColors.surface;
        selectedTheme.colors.text = backgroundColors.text;
        selectedTheme.colors.border = backgroundColors.border;
      }
      
      // Save custom theme as a custom entry
      userConfig.custom = selectedTheme;
      userConfig.activeTheme = 'custom';
    } else {
      // Use standard theme
      userConfig.activeTheme = baseTheme;
      userConfig.custom = null;
    }
    
    // Show preview
    console.log(chalk.bold('\nPreview of selected color schema:\n'));
    
    console.log(chalk.hex(selectedTheme.colors.primary)('■') + ' Primary');
    console.log(chalk.hex(selectedTheme.colors.secondary)('■') + ' Secondary');
    console.log(chalk.hex(selectedTheme.colors.accent)('■') + ' Accent');
    console.log('');
    console.log(chalk.hex(selectedTheme.colors.success)('■') + ' Success');
    console.log(chalk.hex(selectedTheme.colors.warning)('■') + ' Warning');
    console.log(chalk.hex(selectedTheme.colors.danger)('■') + ' Error');
    console.log(chalk.hex(selectedTheme.colors.info)('■') + ' Information');
    console.log('');
    console.log(`Background: ${selectedTheme.colors.background}`);
    console.log(`Text: ${selectedTheme.colors.text}`);
    console.log(`Surface: ${selectedTheme.colors.surface}`);
    console.log(`Border: ${selectedTheme.colors.border}`);
    
    // Save and apply
    const { saveTheme } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveTheme',
        message: 'Do you want to save this color schema?',
        default: true
      }
    ]);
    
    if (saveTheme) {
      saveUserConfig(userConfig);
      
      const { applyTheme } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'applyTheme',
          message: 'Do you want to apply this color schema to existing UI components now?',
          default: true
        }
      ]);
      
      if (applyTheme) {
        const themeToApply = userConfig.activeTheme === 'custom' ? userConfig.custom : config.themes[userConfig.activeTheme];
        applyColorSchema(themeToApply);
      }
      
      console.log(chalk.green('\nColor schema configuration completed!\n'));
    } else {
      console.log(chalk.yellow('\nColor schema was not saved.\n'));
    }
  } catch (err) {
    console.error(`Error in interactive color schema creation: ${err.message}`);
  }
}

/**
 * Get color schema from template or user settings
 * @returns {Object} The active color schema
 */
function getColorSchema() {
  try {
    // Use the standardized config manager
    const colorSchemaConfig = configManager.getConfig(CONFIG_TYPES.COLOR_SCHEMA);

    // Use the userPreferences to determine the active theme
    if (colorSchemaConfig.userPreferences && colorSchemaConfig.userPreferences.activeTheme === 'custom' && colorSchemaConfig.userPreferences.custom) {
      return colorSchemaConfig.userPreferences.custom;
    } else if (colorSchemaConfig.userPreferences && colorSchemaConfig.userPreferences.activeTheme) {
      const themeKey = colorSchemaConfig.userPreferences.activeTheme;
      return colorSchemaConfig.themes[themeKey] || colorSchemaConfig.themes.dark; // Fallback to dark if theme not found
    }

    // Fallback to dark theme if no theme preference specified
    return colorSchemaConfig.themes.dark;
  } catch (err) {
    console.error(`Error getting color schema: ${err.message}`);
    // Return default dark theme if anything fails
    return {
      name: "Default Dark",
      colors: {
        primary: "#bb86fc",
        secondary: "#03dac6",
        accent: "#cf6679",
        success: "#4caf50",
        warning: "#ff9800",
        danger: "#cf6679",
        info: "#2196f3",
        background: "#121212",
        surface: "#1e1e1e",
        text: "#ffffff",
        textSecondary: "#b0b0b0",
        border: "#333333",
        shadow: "rgba(0, 0, 0, 0.5)"
      }
    };
  }
}

/**
 * Export color schema as JSON
 * @param {string} format - Output format ('json', 'css', 'scss', 'js')
 * @returns {string} Formatted schema
 */
function exportSchema(format = 'json') {
  try {
    const schema = getColorSchema();
    
    if (format === 'json') {
      return JSON.stringify(schema, null, 2);
    } else if (format === 'css') {
      return generateCSS(schema);
    } else if (format === 'scss') {
      // Generate SCSS variables
      const colors = schema.colors;
      return `// ${schema.name} Color Schema
$primary: ${colors.primary};
$secondary: ${colors.secondary};
$accent: ${colors.accent};
$success: ${colors.success};
$warning: ${colors.warning};
$danger: ${colors.danger};
$info: ${colors.info};
$background: ${colors.background};
$surface: ${colors.surface};
$text: ${colors.text};
$text-secondary: ${colors.textSecondary};
$border: ${colors.border};
$shadow: ${colors.shadow};
`;
    } else if (format === 'js') {
      // Generate JavaScript constants
      const colors = schema.colors;
      return `// ${schema.name} Color Schema
export const COLORS = {
  primary: '${colors.primary}',
  secondary: '${colors.secondary}',
  accent: '${colors.accent}',
  success: '${colors.success}',
  warning: '${colors.warning}',
  danger: '${colors.danger}',
  info: '${colors.info}',
  background: '${colors.background}',
  surface: '${colors.surface}',
  text: '${colors.text}',
  textSecondary: '${colors.textSecondary}',
  border: '${colors.border}',
  shadow: '${colors.shadow}'
};
`;
    }
    
    return null;
  } catch (err) {
    console.error(`Error exporting schema: ${err.message}`);
    return null;
  }
}

/**
 * Main function
 * @returns {Promise<void>}
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    
    // Process command line arguments
    const interactive = !args.includes('--non-interactive');
    const templateArg = args.find(arg => arg.startsWith('--template='));
    const template = templateArg ? templateArg.split('=')[1] : null;
    const applyArg = args.find(arg => arg.startsWith('--apply='));
    const apply = applyArg ? applyArg.split('=')[1] === 'true' : false;
    const formatArg = args.find(arg => arg.startsWith('--format='));
    const format = formatArg ? formatArg.split('=')[1] : 'json';
    
    if (interactive) {
      await createColorSchemaInteractive();
    } else if (template) {
      const config = loadConfig();
      
      if (config.themes[template]) {
        const userConfig = {
          activeTheme: template,
          custom: null
        };
        
        saveUserConfig(userConfig);
        console.log(`Color schema "${config.themes[template].name}" has been selected.`);
        
        if (apply) {
          applyColorSchema(config.themes[template]);
        }
      } else {
        console.error(`Template "${template}" not found.`);
      }
    } else {
      // Export color schema
      const output = exportSchema(format);
      console.log(output);
    }
  } catch (err) {
    console.error(`Error in main function: ${err.message}`);
  }
}

// Module exports for API usage
module.exports = {
  getColorSchema,
  applyColorSchema,
  generateCSS,
  exportSchema
};

// Only execute when directly invoked
if (require.main === module) {
  main().catch(err => {
    console.error(`Unhandled error: ${err.message}`);
    process.exit(1);
  });
}