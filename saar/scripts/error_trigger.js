#!/usr/bin/env node

/**
 * Error Trigger für rekursives Debugging
 * ======================================
 * 
 * Führt eine JavaScript-Datei aus und überwacht auf rekursionsbedingte Fehler.
 * Bei Erkennung eines solchen Fehlers wird automatisch der passende 
 * Debugging-Workflow ausgelöst.
 * 
 * Verwendung:
 *   node error_trigger.js [datei] [argumente...]
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Argumente verarbeiten
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Fehler: Keine Datei angegeben');
  console.error('Verwendung: node error_trigger.js [datei] [argumente...]');
  process.exit(1);
}

const filePath = args[0];
const fileArgs = args.slice(1);

// Prüfen, ob die Datei existiert
if (!fs.existsSync(filePath)) {
  console.error(`Fehler: Datei nicht gefunden: ${filePath}`);
  process.exit(1);
}

// Konfiguration laden
const CONFIG_PATH = path.resolve(__dirname, '../core/config/debug_workflow_config.json');
let config;

try {
  const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
  config = JSON.parse(configData);
} catch (err) {
  console.error(`Warnung: Konnte Konfiguration nicht laden: ${err.message}`);
  config = {
    auto_triggers: {
      error_patterns: {
        "RangeError: Maximum call stack size exceeded": "stack_overflow",
        "JavaScript heap out of memory": "performance"
      }
    }
  };
}

console.log(`Führe aus: ${filePath} ${fileArgs.join(' ')}`);

// Ausführung mit angepasstem Stack-Limit
const env = { ...process.env };

// Wenn es eine Node.js-Datei ist, Stack-Limit anpassen
const ext = path.extname(filePath).toLowerCase();
let command, cmdArgs;

if (ext === '.js') {
  command = 'node';
  cmdArgs = ['--stack-trace-limit=50', filePath, ...fileArgs];
} else if (ext === '.py') {
  command = 'python';
  cmdArgs = ['-u', filePath, ...fileArgs];
} else {
  // Direktes Ausführen für andere Dateitypen
  command = filePath;
  cmdArgs = fileArgs;
}

// Befehl ausführen
const child = spawn(command, cmdArgs, {
  env,
  stdio: ['pipe', 'pipe', 'pipe']
});

let stdout = '';
let stderr = '';

// Ausgabe sammeln
child.stdout.on('data', (data) => {
  const output = data.toString();
  stdout += output;
  process.stdout.write(output);
});

child.stderr.on('data', (data) => {
  const output = data.toString();
  stderr += output;
  process.stderr.write(output);
});

// Nach Beendigung den Fehler analysieren und ggf. Workflow auslösen
child.on('close', (code) => {
  console.log(`\nProzess beendet mit Code ${code}`);
  
  if (code !== 0) {
    console.log('\nFehler erkannt, analysiere...');
    
    let workflowToTrigger = 'standard';
    let errorPattern = null;
    
    // Fehlertext auf bekannte Muster prüfen
    for (const [pattern, workflow] of Object.entries(config.auto_triggers.error_patterns)) {
      if (stderr.includes(pattern)) {
        workflowToTrigger = workflow;
        errorPattern = pattern;
        break;
      }
    }
    
    if (errorPattern) {
      console.log(`Fehlertyp erkannt: ${errorPattern}`);
      console.log(`Löse Workflow "${workflowToTrigger}" aus`);
      
      // Debug-Workflow auslösen
      const workflowEngine = path.resolve(__dirname, 'debug_workflow_engine.js');
      
      const workflow = spawn('node', [
        workflowEngine,
        'trigger',
        'runtime_error',
        '--file', filePath,
        '--error', errorPattern
      ], {
        stdio: 'inherit'
      });
      
      workflow.on('close', (wfCode) => {
        console.log(`\nDebugging-Workflow beendet mit Code ${wfCode}`);
      });
    } else {
      console.log('Kein bekanntes Fehlermuster erkannt');
    }
  }
});

// Signal-Handling
process.on('SIGINT', () => {
  console.log('\nProzess abgebrochen');
  child.kill('SIGINT');
});
