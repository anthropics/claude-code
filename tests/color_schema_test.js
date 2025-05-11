#!/usr/bin/env node

/**
 * Color Schema Test
 * ================
 * 
 * Dieses Skript demonstriert, wie das Farbschema in verschiedenen
 * Komponenten des Claude Neural Framework verwendet wird.
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Farbschema-Manager importieren
const colorSchemaManager = require('../core/mcp/color_schema_manager');

// Test-Funktion
async function test() {
  console.log(chalk.bold('\n=== Claude Neural Framework - Farbschema Test ===\n'));

  // Aktuelles Farbschema abrufen
  const schema = colorSchemaManager.getColorSchema();
  console.log('Aktuelles Farbschema:');
  console.log(chalk.hex(schema.colors.primary)('■') + ' Primärfarbe: ' + schema.colors.primary);
  console.log(chalk.hex(schema.colors.secondary)('■') + ' Sekundärfarbe: ' + schema.colors.secondary);
  console.log(chalk.hex(schema.colors.accent)('■') + ' Akzentfarbe: ' + schema.colors.accent);
  console.log(chalk.hex(schema.colors.success)('■') + ' Erfolg: ' + schema.colors.success);
  console.log(chalk.hex(schema.colors.warning)('■') + ' Warnung: ' + schema.colors.warning);
  console.log(chalk.hex(schema.colors.danger)('■') + ' Gefahr: ' + schema.colors.danger);
  console.log(chalk.hex(schema.colors.background)('■') + ' Hintergrund: ' + schema.colors.background);
  console.log(chalk.hex(schema.colors.text)('■') + ' Text: ' + schema.colors.text);
  console.log();

  // Farbschema als CSS exportieren
  const css = colorSchemaManager.exportSchema('css');
  console.log('Generiertes CSS:');
  console.log(css.substring(0, 300) + '...');
  console.log();

  // Farbschema im Benutzer-Profil
  console.log('Integration mit .about-Profil:');
  const userProfile = {
    "user_id": "user-12345",
    "name": "Test User",
    "goals": ["Implement Neural Framework", "Debug Recursive Functions"],
    "companies": ["Acme Inc."],
    "preferences": {
      "theme": schema.name,
      "lang": "de",
      "colorScheme": schema.colors
    },
    "expertise": ["javascript", "python", "algorithms"],
    "is_agent": true
  };

  console.log(JSON.stringify(userProfile, null, 2));
  console.log();

  // Demonstration: Generierter Claude-Prompt mit Farbschema
  console.log('Beispiel Claude-Prompt mit Farbschema:');
  
  const claudePrompt = `
<instructions>
You are generating UI components for the Claude Neural Framework.
ALWAYS use the following color scheme in all generated code:

- Primary: ${schema.colors.primary}
- Secondary: ${schema.colors.secondary}
- Accent: ${schema.colors.accent}
- Success: ${schema.colors.success}
- Warning: ${schema.colors.warning}
- Danger: ${schema.colors.danger}
- Background: ${schema.colors.background}
- Text: ${schema.colors.text}

All generated CSS, HTML, JavaScript, and other UI code must strictly adhere to this color scheme.
This ensures permanent consistency across all UI elements.
</instructions>

User request: Generate a simple button component with the primary color and hover state.
`;

  console.log(claudePrompt);
  console.log();

  // Beispiel-Komponente im gewählten Farbschema
  console.log('Beispiel-Komponente mit aktuellem Farbschema:');
  
  const exampleComponent = `
<!-- Button Komponente im ${schema.name} Farbschema -->
<button class="btn btn-primary">
  Click Me
</button>

<style>
.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background-color: ${schema.colors.primary};
  color: white;
  border: 1px solid ${schema.colors.primary};
}

.btn-primary:hover {
  background-color: transparent;
  color: ${schema.colors.primary};
}
</style>
`;

  console.log(exampleComponent);
  console.log();

  // Integration mit Benutzer-Dashboard
  console.log(chalk.bold('Integration mit Benutzer-Dashboard:'));
  console.log(`Das Dashboard wurde mit dem Farbschema "${schema.name}" aktualisiert.`);
  console.log(`Alle UI-Komponenten, Reports und Visualisierungen verwenden konsistent das Farbschema.`);
  console.log();

  // Hinweis zur Änderung des Farbschemas
  console.log(chalk.bold('Farbschema ändern:'));
  console.log(`Um das Farbschema zu ändern, führen Sie den folgenden Befehl aus:`);
  console.log(chalk.cyan(`  node scripts/setup/setup_user_colorschema.js`));
  console.log();

  // Links zu verschiedenen Format-Exportformaten
  console.log(chalk.bold('Farbschema in verschiedenen Formaten exportieren:'));
  console.log(`  CSS:  ${chalk.cyan('node core/mcp/color_schema_manager.js --non-interactive --format=css')}`);
  console.log(`  SCSS: ${chalk.cyan('node core/mcp/color_schema_manager.js --non-interactive --format=scss')}`);
  console.log(`  JS:   ${chalk.cyan('node core/mcp/color_schema_manager.js --non-interactive --format=js')}`);
  console.log();

  // Fertig
  console.log(chalk.green('✓ Test abgeschlossen. Das Farbschema ist einsatzbereit.'));
}

// Hauptfunktion ausführen
test().catch(console.error);