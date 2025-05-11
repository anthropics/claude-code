#!/usr/bin/env node

/**
 * Color Schema Manager
 * ===================
 * 
 * Verwaltet das Farbschema für UI-Komponenten des Claude Neural Framework.
 * Ermöglicht das Erstellen, Bearbeiten und Anwenden von benutzerdefinierten Farbschemata.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { execSync } = require('child_process');
const os = require('os');

// Konfigurationspfade
const CONFIG_DIR = path.resolve(__dirname, '../config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'color_schema_config.json');
const USER_CONFIG_DIR = path.join(os.homedir(), '.claude');
const USER_CONFIG_FILE = path.join(USER_CONFIG_DIR, 'user.colorschema.json');

// Sicherstellen, dass Benutzerverzeichnis existiert
if (!fs.existsSync(USER_CONFIG_DIR)) {
  fs.mkdirSync(USER_CONFIG_DIR, { recursive: true });
}

// Konfiguration laden
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(configData);
    }
    console.error('Keine Farbschema-Konfigurationsdatei gefunden.');
    process.exit(1);
  } catch (err) {
    console.error(`Fehler beim Laden der Konfiguration: ${err.message}`);
    process.exit(1);
  }
}

// Benutzerkonfiguration laden
function loadUserConfig() {
  try {
    if (fs.existsSync(USER_CONFIG_FILE)) {
      const configData = fs.readFileSync(USER_CONFIG_FILE, 'utf8');
      return JSON.parse(configData);
    }
    return null;
  } catch (err) {
    console.warn(`Keine Benutzer-Farbschema gefunden: ${err.message}`);
    return null;
  }
}

// Benutzerkonfiguration speichern
function saveUserConfig(userConfig) {
  try {
    fs.writeFileSync(USER_CONFIG_FILE, JSON.stringify(userConfig, null, 2));
    console.log(`Benutzerkonfiguration gespeichert: ${USER_CONFIG_FILE}`);
    return true;
  } catch (err) {
    console.error(`Fehler beim Speichern der Benutzerkonfiguration: ${err.message}`);
    return false;
  }
}

// Farbschema auf bestehende UI-Komponenten anwenden
function applyColorSchema(schema) {
  const cssOutput = generateCSS(schema);
  const cssPath = path.join(process.cwd(), 'ui/dashboard/color-schema.css');
  
  try {
    fs.writeFileSync(cssPath, cssOutput);
    console.log(`CSS-Datei erstellt: ${cssPath}`);
    
    // Verknüpfung mit bestehenden HTML-Dateien
    updateHTMLFiles(schema);
    
    return true;
  } catch (err) {
    console.error(`Fehler beim Anwenden des Farbschemas: ${err.message}`);
    return false;
  }
}

// HTML-Dateien aktualisieren
function updateHTMLFiles(schema) {
  const dashboardPath = path.join(process.cwd(), 'ui/dashboard/index.html');
  
  if (fs.existsSync(dashboardPath)) {
    try {
      let html = fs.readFileSync(dashboardPath, 'utf8');
      
      // Prüfen ob color-schema.css bereits eingebunden ist
      if (!html.includes('color-schema.css')) {
        // CSS-Link nach dem Haupt-Stylesheet einfügen
        html = html.replace(
          /<link rel="stylesheet" href="styles.css">/,
          '<link rel="stylesheet" href="styles.css">\n    <link rel="stylesheet" href="color-schema.css">'
        );
        
        fs.writeFileSync(dashboardPath, html);
        console.log(`Dashboard HTML aktualisiert: ${dashboardPath}`);
      }
    } catch (err) {
      console.error(`Fehler beim Aktualisieren der HTML-Dateien: ${err.message}`);
    }
  }
}

// CSS aus Farbschema generieren
function generateCSS(schema) {
  const colors = schema.colors;
  
  return `:root {
  /* Primärfarben */
  --primary-color: ${colors.primary};
  --secondary-color: ${colors.secondary};
  --accent-color: ${colors.accent};
  
  /* Statusfarben */
  --success-color: ${colors.success};
  --warning-color: ${colors.warning};
  --danger-color: ${colors.danger};
  --info-color: ${colors.info};
  
  /* Neutralfarben */
  --background-color: ${colors.background};
  --surface-color: ${colors.surface};
  --text-color: ${colors.text};
  --text-secondary-color: ${colors.textSecondary};
  --border-color: ${colors.border};
  --shadow-color: ${colors.shadow};
  
  /* Legacy-Kompatibilität */
  --light-gray: ${colors.border};
  --medium-gray: ${colors.textSecondary};
  --dark-gray: ${colors.text};
}

/* Anpassungen an Basis-Elementen */
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

/* Anpassungen für zusätzliche Komponenten */
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

/* Weitere angepasste Komponenten */
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

/* Dunkleres Thema für Codeblöcke bei dunklem Hintergrund */
pre {
  background-color: ${schema.name.toLowerCase().includes('dark') ? '#1a1a1a' : '#282c34'};
  color: ${schema.name.toLowerCase().includes('dark') ? '#e0e0e0' : '#abb2bf'};
}
`;
}

// Interaktive Farbschema-Erstellung
async function createColorSchemaInteractive() {
  const config = loadConfig();
  const userConfig = loadUserConfig() || { 
    activeTheme: config.userPreferences.activeTheme,
    custom: null
  };
  
  console.log(chalk.bold('\n=== Claude Neural Framework - Farbschema-Konfiguration ===\n'));
  
  // Grundlegendes Thema wählen
  const { baseTheme } = await inquirer.prompt([
    {
      type: 'list',
      name: 'baseTheme',
      message: 'Wählen Sie ein Basis-Thema als Ausgangspunkt:',
      choices: Object.keys(config.themes).map(theme => ({
        name: `${config.themes[theme].name}`,
        value: theme
      })),
      default: userConfig.activeTheme
    }
  ]);
  
  let selectedTheme = JSON.parse(JSON.stringify(config.themes[baseTheme]));
  
  // Farben anpassen?
  const { customizeColors } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'customizeColors',
      message: 'Möchten Sie individuelle Farben anpassen?',
      default: false
    }
  ]);
  
  if (customizeColors) {
    const { customizeType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'customizeType',
        message: 'Welche Farben möchten Sie anpassen?',
        choices: [
          { name: 'Primärfarben (Hauptfarben der Anwendung)', value: 'primary' },
          { name: 'Statusfarben (Erfolg, Warnung, Fehler)', value: 'status' },
          { name: 'Hintergrund und Text', value: 'background' },
          { name: 'Alle Farben individuell', value: 'all' }
        ]
      }
    ]);
    
    if (customizeType === 'primary' || customizeType === 'all') {
      const primaryColors = await inquirer.prompt([
        {
          type: 'input',
          name: 'primary',
          message: 'Primärfarbe (Hexcode, z.B. #3f51b5):',
          default: selectedTheme.colors.primary,
          validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Bitte geben Sie einen gültigen Hexadezimalwert ein'
        },
        {
          type: 'input',
          name: 'secondary',
          message: 'Sekundärfarbe (Hexcode):',
          default: selectedTheme.colors.secondary,
          validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Bitte geben Sie einen gültigen Hexadezimalwert ein'
        },
        {
          type: 'input',
          name: 'accent',
          message: 'Akzentfarbe (Hexcode):',
          default: selectedTheme.colors.accent,
          validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Bitte geben Sie einen gültigen Hexadezimalwert ein'
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
          message: 'Erfolgsfarbe (Hexcode):',
          default: selectedTheme.colors.success,
          validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Bitte geben Sie einen gültigen Hexadezimalwert ein'
        },
        {
          type: 'input',
          name: 'warning',
          message: 'Warnfarbe (Hexcode):',
          default: selectedTheme.colors.warning,
          validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Bitte geben Sie einen gültigen Hexadezimalwert ein'
        },
        {
          type: 'input',
          name: 'danger',
          message: 'Fehlerfarbe (Hexcode):',
          default: selectedTheme.colors.danger,
          validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Bitte geben Sie einen gültigen Hexadezimalwert ein'
        },
        {
          type: 'input',
          name: 'info',
          message: 'Informationsfarbe (Hexcode):',
          default: selectedTheme.colors.info,
          validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Bitte geben Sie einen gültigen Hexadezimalwert ein'
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
          message: 'Hintergrundfarbe (Hexcode):',
          default: selectedTheme.colors.background,
          validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Bitte geben Sie einen gültigen Hexadezimalwert ein'
        },
        {
          type: 'input',
          name: 'surface',
          message: 'Kartenfarbe (Hexcode):',
          default: selectedTheme.colors.surface,
          validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Bitte geben Sie einen gültigen Hexadezimalwert ein'
        },
        {
          type: 'input',
          name: 'text',
          message: 'Textfarbe (Hexcode):',
          default: selectedTheme.colors.text,
          validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Bitte geben Sie einen gültigen Hexadezimalwert ein'
        },
        {
          type: 'input',
          name: 'border',
          message: 'Rahmenfarbe (Hexcode):',
          default: selectedTheme.colors.border,
          validate: value => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) ? true : 'Bitte geben Sie einen gültigen Hexadezimalwert ein'
        }
      ]);
      
      selectedTheme.colors.background = backgroundColors.background;
      selectedTheme.colors.surface = backgroundColors.surface;
      selectedTheme.colors.text = backgroundColors.text;
      selectedTheme.colors.border = backgroundColors.border;
    }
    
    // Benutzerdefiniertes Thema als benutzerdefinierten Eintrag speichern
    userConfig.custom = selectedTheme;
    userConfig.activeTheme = 'custom';
  } else {
    // Standardthema verwenden
    userConfig.activeTheme = baseTheme;
    userConfig.custom = null;
  }
  
  // Vorschau anzeigen
  console.log(chalk.bold('\nVorschau des ausgewählten Farbschemas:\n'));
  
  console.log(chalk.hex(selectedTheme.colors.primary)('■') + ' Primärfarbe');
  console.log(chalk.hex(selectedTheme.colors.secondary)('■') + ' Sekundärfarbe');
  console.log(chalk.hex(selectedTheme.colors.accent)('■') + ' Akzentfarbe');
  console.log('');
  console.log(chalk.hex(selectedTheme.colors.success)('■') + ' Erfolg');
  console.log(chalk.hex(selectedTheme.colors.warning)('■') + ' Warnung');
  console.log(chalk.hex(selectedTheme.colors.danger)('■') + ' Fehler');
  console.log(chalk.hex(selectedTheme.colors.info)('■') + ' Information');
  console.log('');
  console.log(`Hintergrund: ${selectedTheme.colors.background}`);
  console.log(`Text: ${selectedTheme.colors.text}`);
  console.log(`Oberfläche: ${selectedTheme.colors.surface}`);
  console.log(`Rand: ${selectedTheme.colors.border}`);
  
  // Speichern und anwenden
  const { saveTheme } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'saveTheme',
      message: 'Möchten Sie dieses Farbschema speichern?',
      default: true
    }
  ]);
  
  if (saveTheme) {
    saveUserConfig(userConfig);
    
    const { applyTheme } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'applyTheme',
        message: 'Möchten Sie dieses Farbschema jetzt auf bestehende UI-Komponenten anwenden?',
        default: true
      }
    ]);
    
    if (applyTheme) {
      const themeToApply = userConfig.activeTheme === 'custom' ? userConfig.custom : config.themes[userConfig.activeTheme];
      applyColorSchema(themeToApply);
    }
    
    console.log(chalk.green('\nFarbschema-Konfiguration abgeschlossen!\n'));
  } else {
    console.log(chalk.yellow('\nFarbschema wurde nicht gespeichert.\n'));
  }
}

// Farbschema aus Vorlage oder Benutzereinstellungen bekommen
function getColorSchema() {
  const config = loadConfig();
  const userConfig = loadUserConfig();
  
  if (userConfig && userConfig.activeTheme === 'custom' && userConfig.custom) {
    return userConfig.custom;
  } else {
    const themeKey = userConfig ? userConfig.activeTheme : config.userPreferences.activeTheme;
    return config.themes[themeKey];
  }
}

// Farbschema-Objekt als JSON exportieren
function exportSchema(format = 'json') {
  const schema = getColorSchema();
  
  if (format === 'json') {
    return JSON.stringify(schema, null, 2);
  } else if (format === 'css') {
    return generateCSS(schema);
  } else if (format === 'scss') {
    // SCSS-Variablen generieren
    const colors = schema.colors;
    return `// ${schema.name} Farbschema
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
    // JavaScript-Konstanten generieren
    const colors = schema.colors;
    return `// ${schema.name} Farbschema
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
}

// Hauptfunktion
async function main() {
  const args = process.argv.slice(2);
  
  // Befehlszeilenargumente verarbeiten
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
      console.log(`Farbschema "${config.themes[template].name}" wurde ausgewählt.`);
      
      if (apply) {
        applyColorSchema(config.themes[template]);
      }
    } else {
      console.error(`Vorlage "${template}" nicht gefunden.`);
      process.exit(1);
    }
  } else {
    // Farbschema exportieren
    const output = exportSchema(format);
    console.log(output);
  }
}

// Modul-Exporte für API-Nutzung
module.exports = {
  getColorSchema,
  applyColorSchema,
  generateCSS,
  exportSchema
};

// Nur ausführen, wenn direkt aufgerufen
if (require.main === module) {
  main().catch(console.error);
}