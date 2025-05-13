#!/usr/bin/env node

/**
 * Color Schema Wrapper
 * ====================
 * 
 * This is a wrapper around the color schema manager that handles
 * the COLOR_SCHEMA property issue and simply applies the specified theme
 * without going through the interactive configuration.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Set shell language to German (after strict mode)
process.env.LANG = 'de_DE.UTF-8';

// Get command-line arguments
const args = process.argv.slice(2);
const templateArg = args.find(arg => arg.startsWith('--template='));
const template = templateArg ? templateArg.split('=')[1] : 'dark';
const applyArg = args.find(arg => arg.startsWith('--apply='));
const apply = applyArg ? applyArg.split('=')[1] : 'true';

// Path to color schema configuration
const configPath = path.resolve(__dirname, '../../core/config/color_schema_config.json');

// Fix the COLOR_SCHEMA property directly in the config file
try {
  console.log(`Setting theme to ${template}`);
  
  // Read the current config
  const configData = fs.readFileSync(configPath, 'utf8');
  let config = JSON.parse(configData);
  
  // Update userPreferences
  if (!config.userPreferences) {
    config.userPreferences = {
      activeTheme: template,
      custom: null
    };
  } else {
    config.userPreferences.activeTheme = template;
  }
  
  // Add COLOR_SCHEMA property if it doesn't exist
  if (!config.COLOR_SCHEMA) {
    config.COLOR_SCHEMA = {
      activeTheme: template
    };
  } else {
    config.COLOR_SCHEMA.activeTheme = template;
  }
  
  // Write the updated config back to the file
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  console.log(`Color schema configuration updated`);
  
  // Generate CSS file if apply is true
  if (apply === 'true') {
    console.log('Applying color schema to UI components...');
    
    // Get the theme
    const theme = config.themes[template];
    
    if (theme) {
      // Path for the CSS file
      const cssPath = path.resolve(__dirname, '../../ui/dashboard/color-schema.css');
      const cssDir = path.dirname(cssPath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(cssDir)) {
        fs.mkdirSync(cssDir, { recursive: true });
      }
      
      // Generate basic CSS
      const colors = theme.colors;
      const css = `:root {
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
  --shadow-color: ${colors.shadow || 'rgba(0, 0, 0, 0.1)'};
}`;
      
      // Write CSS file
      fs.writeFileSync(cssPath, css, 'utf8');
      console.log(`CSS file created: ${cssPath}`);
      
      // Update HTML files if they exist
      const dashboardPath = path.resolve(__dirname, '../../ui/dashboard/index.html');
      if (fs.existsSync(dashboardPath)) {
        let html = fs.readFileSync(dashboardPath, 'utf8');
        
        // Check if color-schema.css is already included
        if (!html.includes('color-schema.css')) {
          // Insert CSS link after the main stylesheet
          html = html.replace(
            /<link rel="stylesheet" href="styles.css">/,
            '<link rel="stylesheet" href="styles.css">\n    <link rel="stylesheet" href="color-schema.css">'
          );
          
          fs.writeFileSync(dashboardPath, html, 'utf8');
          console.log(`Dashboard HTML updated: ${dashboardPath}`);
        }
      }
    } else {
      console.error(`Theme "${template}" not found in configuration`);
    }
  }
  
  console.log('Color schema configuration complete!');
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}