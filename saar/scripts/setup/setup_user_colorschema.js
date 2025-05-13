#!/usr/bin/env node

/**
 * Benutzer-Farbschema Setup
 * ========================
 * 
 * Hilfsskript zum Einrichten des Benutzer-Farbschemas
 * für das Claude Neural Framework.
 */

'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

// Set shell language to German (after strict mode)
process.env.LANG = 'de_DE.UTF-8';

// Pfad zum color_schema_manager.js
const managerPath = path.resolve(__dirname, '../../core/mcp/color_schema_manager.js');

// Sicherstellen, dass die Datei ausführbar ist
spawnSync('chmod', ['+x', managerPath]);

// Benutzer-Farbschema-Manager ausführen
console.log('Starte interaktive Farbschema-Konfiguration...');

// Use our wrapper script instead to avoid COLOR_SCHEMA errors
const wrapperPath = path.resolve(__dirname, './color_schema_wrapper.js');
const result = spawnSync('node', [wrapperPath, '--template=dark'], {
  stdio: 'inherit',
  shell: true
});

if (result.status !== 0) {
  console.error('Fehler beim Ausführen des Farbschema-Managers.');
  process.exit(1);
}

console.log('\nFarbschema-Setup abgeschlossen!');
console.log('Das Farbschema wird automatisch auf alle neu generierten UI-Komponenten angewendet.');
console.log('\nWeitere Optionen:');
console.log('- Um das Farbschema zu ändern: node scripts/setup/setup_user_colorschema.js');
console.log('- Um ein bestimmtes Farbschema festzulegen: node core/mcp/color_schema_manager.js --template=dark');
console.log('- Um das Farbschema auf vorhandene UI-Komponenten anzuwenden: node core/mcp/color_schema_manager.js --template=light --apply=true');
console.log('- Um das Farbschema als CSS zu exportieren: node core/mcp/color_schema_manager.js --non-interactive --format=css');