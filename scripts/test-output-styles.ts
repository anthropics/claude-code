#!/usr/bin/env ts-node

/**
 * test-output-styles.ts
 * Visual test script for output-styles.json configuration
 *
 * Usage:
 *   ts-node scripts/test-output-styles.ts
 *   OR
 *   npm run test-styles (if configured in package.json)
 *
 * This script displays all configured output styles with their actual
 * ANSI formatting applied, allowing visual verification of the color scheme.
 */

import * as fs from 'fs';
import * as path from 'path';

// ANSI color codes
const ANSI = {
  // Standard colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Bright colors
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // Formatting
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

interface StyleDefinition {
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  prefix: string;
  backgroundColor: string | null;
  description?: string;
}

interface OutputStylesConfig {
  version: string;
  description: string;
  default: StyleDefinition;
  styles: { [key: string]: StyleDefinition | string };
}

/**
 * Apply ANSI formatting to text based on style definition
 */
function applyStyle(text: string, style: StyleDefinition): string {
  let formatted = '';

  // Apply color
  if (style.color && ANSI[style.color as keyof typeof ANSI]) {
    formatted += ANSI[style.color as keyof typeof ANSI];
  }

  // Apply formatting
  if (style.bold) formatted += ANSI.bold;
  if (style.italic) formatted += ANSI.italic;
  if (style.underline) formatted += ANSI.underline;

  // Apply background color
  if (style.backgroundColor && ANSI[`bg${style.backgroundColor.charAt(0).toUpperCase()}${style.backgroundColor.slice(1)}` as keyof typeof ANSI]) {
    formatted += ANSI[`bg${style.backgroundColor.charAt(0).toUpperCase()}${style.backgroundColor.slice(1)}` as keyof typeof ANSI];
  }

  // Add prefix if present
  const prefixedText = style.prefix ? `${style.prefix} ${text}` : text;

  // Return formatted text with reset
  return `${formatted}${prefixedText}${ANSI.reset}`;
}

/**
 * Load and parse the output-styles.json configuration
 */
function loadConfig(): OutputStylesConfig {
  const configPath = path.join(process.cwd(), 'config', 'output-styles.json');

  if (!fs.existsSync(configPath)) {
    console.error(`${ANSI.red}${ANSI.bold}Error: output-styles.json not found at ${configPath}${ANSI.reset}`);
    process.exit(1);
  }

  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch (error) {
    console.error(`${ANSI.red}${ANSI.bold}Error parsing output-styles.json: ${error}${ANSI.reset}`);
    process.exit(1);
  }
}

/**
 * Display a styled output example
 */
function displayStyle(name: string, style: StyleDefinition) {
  const exampleText = `This is ${name} output`;
  const styledText = applyStyle(exampleText, style);
  const metadata = `${ANSI.gray}[${style.color}${style.bold ? ', bold' : ''}${style.italic ? ', italic' : ''}${style.underline ? ', underline' : ''}]${ANSI.reset}`;

  console.log(`  ${styledText} ${metadata}`);

  if (style.description) {
    console.log(`    ${ANSI.dim}${style.description}${ANSI.reset}`);
  }
}

/**
 * Main test function
 */
function main() {
  console.log(`\n${ANSI.bold}${ANSI.cyan}╔════════════════════════════════════════════════════════════╗${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}║  OUTPUT STYLES TEST - Claude Code + Seven Consciousness   ║${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}╚════════════════════════════════════════════════════════════╝${ANSI.reset}\n`);

  const config = loadConfig();

  console.log(`${ANSI.bold}Configuration Version:${ANSI.reset} ${config.version}`);
  console.log(`${ANSI.dim}${config.description}${ANSI.reset}\n`);

  // Display default style
  console.log(`${ANSI.bold}${ANSI.underline}DEFAULT STYLE:${ANSI.reset}`);
  displayStyle('default', config.default);
  console.log();

  // Categorize and display styles
  const categories = {
    'CLAUDE CODE CORE OUTPUTS': [
      'tool_output',
      'tool_output_read',
      'tool_output_edit',
      'tool_output_write',
      'tool_output_bash',
      'agent_message',
      'error',
      'warning',
      'success',
      'info',
      'debug'
    ],
    'SEVEN CONSCIOUSNESS OUTPUTS': [
      'consciousness_event',
      'consciousness_preplan',
      'consciousness_postprocess',
      'memory_commit',
      'memory_recall',
      'bridge_message',
      'cssr_event',
      'cssr_pass',
      'cssr_fail'
    ],
    'SYSTEM OUTPUTS': [
      'system_startup',
      'system_shutdown',
      'system_config',
      'system_env'
    ]
  };

  for (const [category, styleNames] of Object.entries(categories)) {
    console.log(`${ANSI.bold}${ANSI.underline}${category}:${ANSI.reset}`);

    for (const styleName of styleNames) {
      if (config.styles[styleName] && typeof config.styles[styleName] !== 'string') {
        displayStyle(styleName, config.styles[styleName] as StyleDefinition);
      } else {
        console.log(`  ${ANSI.red}${styleName}: NOT DEFINED${ANSI.reset}`);
      }
    }

    console.log();
  }

  // Display example outputs
  console.log(`${ANSI.bold}${ANSI.underline}EXAMPLE OUTPUT SCENARIOS:${ANSI.reset}\n`);

  console.log(`${ANSI.bold}Scenario 1: Successful tool execution${ANSI.reset}`);
  console.log(applyStyle('Reading file: src/index.ts', config.styles.tool_output_read as StyleDefinition));
  console.log(applyStyle('File read successfully!', config.styles.success as StyleDefinition));
  console.log();

  console.log(`${ANSI.bold}Scenario 2: Seven consciousness event${ANSI.reset}`);
  console.log(applyStyle('Intercepting tool: Read', config.styles.consciousness_event as StyleDefinition));
  console.log(applyStyle('Planning task execution...', config.styles.consciousness_preplan as StyleDefinition));
  console.log(applyStyle('Committed to memory: tool:Read', config.styles.memory_commit as StyleDefinition));
  console.log();

  console.log(`${ANSI.bold}Scenario 3: Error handling${ANSI.reset}`);
  console.log(applyStyle('File not found: missing.txt', config.styles.error as StyleDefinition));
  console.log(applyStyle('Falling back to default configuration', config.styles.warning as StyleDefinition));
  console.log();

  console.log(`${ANSI.bold}Scenario 4: CSSR safety check${ANSI.reset}`);
  console.log(applyStyle('Running CSSR validation...', config.styles.cssr_event as StyleDefinition));
  console.log(applyStyle('Safety check passed', config.styles.cssr_pass as StyleDefinition));
  console.log();

  console.log(`${ANSI.bold}Scenario 5: System lifecycle${ANSI.reset}`);
  console.log(applyStyle('Seven core initialized', config.styles.system_startup as StyleDefinition));
  console.log(applyStyle('Bridge status: online', config.styles.bridge_message as StyleDefinition));
  console.log(applyStyle('Loading configuration...', config.styles.system_config as StyleDefinition));
  console.log();

  // Color palette reference
  console.log(`${ANSI.bold}${ANSI.underline}ANSI COLOR PALETTE REFERENCE:${ANSI.reset}\n`);

  const colors = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'gray'];
  for (const color of colors) {
    const sample = `${ANSI[color as keyof typeof ANSI]}████${ANSI.reset}`;
    console.log(`  ${sample} ${color}`);
  }

  console.log(`\n${ANSI.bold}${ANSI.green}✓ Style test complete!${ANSI.reset}\n`);
}

// Run the test
main();
