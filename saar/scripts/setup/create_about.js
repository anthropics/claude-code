#!/usr/bin/env node

/**
 * Create .about Profile
 * ====================
 * 
 * Interactive script to create a .about profile for the user.
 * Includes color schema configuration.
 */

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');
const os = require('os');

// Farbschema-Manager importieren
const colorSchemaManager = require('../../../src/core/mcp/color_schema_manager');

// Konfigurationspfade
const CONFIG_DIR = path.join(os.homedir(), '.claude');
const ABOUT_FILE = path.join(CONFIG_DIR, 'user.about.json');

// Sicherstellen, dass das Benutzerverzeichnis existiert
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

/**
 * Interaktive About-Profil-Erstellung
 */
async function createAboutInteractive() {
  console.log(chalk.bold('\n=== Claude Neural Framework - .about Profil Erstellung ===\n'));
  
  // Aktuelles Profil laden, falls vorhanden
  let currentProfile = null;
  try {
    if (fs.existsSync(ABOUT_FILE)) {
      const profileData = fs.readFileSync(ABOUT_FILE, 'utf8');
      currentProfile = JSON.parse(profileData);
      console.log(chalk.green('Bestehendes .about Profil gefunden. Werte werden als Standardwerte verwendet.'));
    }
  } catch (err) {
    console.warn(`Konnte bestehendes Profil nicht laden: ${err.message}`);
  }

  // Benutzerinformationen
  const personalInfo = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Wie lautet Ihr Name?',
      default: currentProfile?.name || ''
    },
    {
      type: 'input',
      name: 'goals',
      message: 'Was sind Ihre Ziele? (Komma-getrennte Liste)',
      default: currentProfile?.goals?.join(', ') || '',
      filter: input => input.split(',').map(goal => goal.trim()).filter(Boolean)
    },
    {
      type: 'input',
      name: 'companies',
      message: 'Für welche Unternehmen arbeiten Sie? (Komma-getrennte Liste)',
      default: currentProfile?.companies?.join(', ') || '',
      filter: input => input.split(',').map(company => company.trim()).filter(Boolean)
    }
  ]);

  // Expertise
  const expertiseInfo = await inquirer.prompt([
    {
      type: 'input',
      name: 'expertise',
      message: 'In welchen Bereichen haben Sie Expertise? (Komma-getrennte Liste, z.B. javascript,python,algorithms)',
      default: currentProfile?.expertise?.join(', ') || '',
      filter: input => input.split(',').map(area => area.trim()).filter(Boolean)
    }
  ]);

  // Debugging-Präferenzen
  const debuggingInfo = await inquirer.prompt([
    {
      type: 'list',
      name: 'strategy',
      message: 'Welche Debugging-Strategie bevorzugen Sie?',
      choices: [
        { name: 'Bottom-Up (von Details zum Gesamtbild)', value: 'bottom-up' },
        { name: 'Top-Down (vom Gesamtbild zu Details)', value: 'top-down' }
      ],
      default: currentProfile?.debug_preferences?.strategy || 'bottom-up'
    },
    {
      type: 'list',
      name: 'detail_level',
      message: 'Welchen Detaillierungsgrad bevorzugen Sie bei Reports?',
      choices: [
        { name: 'Niedrig (nur wesentliche Informationen)', value: 'low' },
        { name: 'Mittel (ausgewogenes Verhältnis)', value: 'medium' },
        { name: 'Hoch (detaillierte Informationen)', value: 'high' }
      ],
      default: currentProfile?.debug_preferences?.detail_level || 'medium'
    },
    {
      type: 'confirm',
      name: 'auto_fix',
      message: 'Sollen Fehler automatisch behoben werden, wenn möglich?',
      default: currentProfile?.debug_preferences?.auto_fix !== undefined ? 
               currentProfile.debug_preferences.auto_fix : true
    }
  ]);

  // Präferenzen
  const prefInfo = await inquirer.prompt([
    {
      type: 'list',
      name: 'theme',
      message: 'Welches Thema bevorzugen Sie?',
      choices: [
        { name: 'Hell', value: 'light' },
        { name: 'Dunkel', value: 'dark' }
      ],
      default: currentProfile?.preferences?.theme || 'dark'
    },
    {
      type: 'list',
      name: 'lang',
      message: 'Welche Sprache bevorzugen Sie?',
      choices: [
        { name: 'Deutsch', value: 'de' },
        { name: 'Englisch', value: 'en' }
      ],
      default: currentProfile?.preferences?.lang || 'de'
    }
  ]);

  // Farbschema-Konfiguration
  console.log(chalk.cyan('\nFarbschema-Konfiguration:'));
  console.log(chalk.gray('Das Farbschema wird für alle UI-Komponenten und generierten Inhalte verwendet.'));
  
  const { useColorSchemaManager } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useColorSchemaManager',
      message: 'Möchten Sie den Farbschema-Manager für detaillierte Anpassungen öffnen?',
      default: true
    }
  ]);

  let colorScheme = null;
  
  if (useColorSchemaManager) {
    // Benutzer möchte detaillierte Farbschema-Anpassungen
    console.log(chalk.yellow('\nDer Farbschema-Manager wird geöffnet...\n'));
    
    // Farbschema-Manager ausführen als separater Prozess
    const { execSync } = require('child_process');
    try {
      execSync('node core/mcp/color_schema_manager.js', { stdio: 'inherit' });
      console.log(chalk.green('\nFarbschema erfolgreich konfiguriert!'));
      
      // Aktualisiertes Farbschema laden
      colorScheme = colorSchemaManager.getColorSchema().colors;
    } catch (err) {
      console.error(`Fehler beim Ausführen des Farbschema-Managers: ${err.message}`);
      
      // Standardfarbschema basierend auf Thema verwenden
      const themeName = prefInfo.theme;
      const themeConfig = require('../../../src/core/config/color_schema_config.json');
      colorScheme = themeConfig.themes[themeName].colors;
    }
  } else {
    // Standardfarbschema basierend auf Thema verwenden
    const themeName = prefInfo.theme;
    const themeConfig = require('../../../src/core/config/color_schema_config.json');
    colorScheme = themeConfig.themes[themeName].colors;
    
    console.log(chalk.cyan('\nStandardfarbschema für das Thema wird verwendet.'));
    console.log(chalk.cyan(`Primärfarbe: ${colorScheme.primary}`));
    console.log(chalk.cyan(`Sekundärfarbe: ${colorScheme.secondary}`));
    console.log(chalk.cyan(`Akzentfarbe: ${colorScheme.accent}`));
  }

  // Agentenrolle
  const agentInfo = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'is_agent',
      message: 'Soll dieses Profil für einen Agenten verwendet werden?',
      default: currentProfile?.is_agent !== undefined ? currentProfile.is_agent : true
    }
  ]);

  // Profil erstellen
  const profile = {
    user_id: currentProfile?.user_id || `user-${Date.now()}`,
    name: personalInfo.name,
    goals: personalInfo.goals,
    companies: personalInfo.companies,
    preferences: {
      theme: prefInfo.theme,
      lang: prefInfo.lang,
      colorScheme: colorScheme
    },
    expertise: expertiseInfo.expertise,
    debug_preferences: {
      strategy: debuggingInfo.strategy,
      detail_level: debuggingInfo.detail_level,
      auto_fix: debuggingInfo.auto_fix
    },
    is_agent: agentInfo.is_agent
  };

  // Profil speichern
  try {
    fs.writeFileSync(ABOUT_FILE, JSON.stringify(profile, null, 2));
    console.log(chalk.green(`\n.about Profil erfolgreich gespeichert: ${ABOUT_FILE}`));
    
    // Profil anzeigen
    console.log(chalk.yellow('\nProfil-Zusammenfassung:'));
    console.log(chalk.cyan(`Name: ${profile.name}`));
    console.log(chalk.cyan(`Ziele: ${profile.goals.join(', ')}`));
    console.log(chalk.cyan(`Unternehmen: ${profile.companies.join(', ')}`));
    console.log(chalk.cyan(`Expertise: ${profile.expertise.join(', ')}`));
    console.log(chalk.cyan(`Debugging-Strategie: ${profile.debug_preferences.strategy}`));
    console.log(chalk.cyan(`Thema: ${profile.preferences.theme}`));
    console.log(chalk.cyan(`Sprache: ${profile.preferences.lang}`));
    console.log(chalk.cyan(`Agentenrolle: ${profile.is_agent ? 'Ja' : 'Nein'}`));
    
    return profile;
  } catch (err) {
    console.error(`Fehler beim Speichern des Profils: ${err.message}`);
    return null;
  }
}

// Direkter Aufruf
if (require.main === module) {
  createAboutInteractive().catch(console.error);
}

// Für Import
module.exports = {
  createAboutInteractive
};