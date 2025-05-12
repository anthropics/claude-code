#!/usr/bin/env node

/**
 * Rekursives Debugging-Workflow-Engine
 * ====================================
 *
 * Dieses Skript verkettet verschiedene rekursive Debugging-Tools und
 * kann automatisch ausgelöst werden durch Events wie Git-Hooks,
 * Dateiänderungen oder Runtime-Exceptions.
 *
 * Enterprise Workflow Integration:
 * Fügt Unterstützung für Enterprise-Features wie Audit-Logging und
 * Policy-Überprüfungen hinzu.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { program } = require('commander');

// Load enterprise workflow if available
let EnterpriseWorkflow;
try {
  EnterpriseWorkflow = require('../enterprise/enterprise-workflow');
} catch (error) {
  // Enterprise workflow module not available, will run without enterprise features
}

// Enterprise workflow instance
let enterpriseWorkflow;

// Konfiguration laden
const CONFIG_PATH = path.resolve(__dirname, '../core/config/debug_workflow_config.json');
let config;

try {
  if (fs.existsSync(CONFIG_PATH)) {
    const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
    config = JSON.parse(configData);
  } else {
    // Standard-Konfiguration verwenden
    config = {
      workflows: {
        standard: [
          { command: "debug-recursive", options: { template: "recursive_bug_analysis" } },
          { command: "optimize-recursive", options: { strategy: "auto" } }
        ],
        deep: [
          { command: "debug-recursive", options: { template: "recursive_bug_analysis", depth: "deep" } },
          { command: "debug-recursive", options: { template: "stack_overflow_debugging" } },
          { command: "bug-hunt", options: { focus: "recursive", depth: "deep" } },
          { command: "optimize-recursive", options: { strategy: "auto" } }
        ],
        quick: [
          { command: "debug-recursive", options: { template: "recursive_bug_analysis", depth: "quick" } }
        ],
        performance: [
          { command: "optimize-recursive", options: { strategy: "auto", measure: "all" } }
        ]
      },
      triggers: {
        git_pre_commit: "quick",
        runtime_error: "standard",
        ci_failure: "deep",
        manual: "standard"
      },
      error_patterns: {
        stack_overflow: "RangeError: Maximum call stack size exceeded",
        infinite_recursion: "Timeout: Execution timed out",
        memory_leak: "FATAL ERROR: JavaScript heap out of memory"
      }
    };
    
    // Konfigurationsdatei erstellen
    const configDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`Standard-Konfiguration erstellt: ${CONFIG_PATH}`);
  }
} catch (err) {
  console.error(`Fehler beim Laden der Konfiguration: ${err.message}`);
  process.exit(1);
}

// Initialize enterprise workflow if available
if (EnterpriseWorkflow) {
  try {
    enterpriseWorkflow = new EnterpriseWorkflow();
    console.log('Enterprise integration aktiviert');
  } catch (error) {
    console.warn('Enterprise-Integration konnte nicht initialisiert werden:', error.message);
  }
}

// CLI Optionen
program
  .name('debug-workflow')
  .description('Führt automatisierte rekursive Debugging-Workflows aus')
  .version('1.0.0');

program
  .command('run')
  .description('Führt einen definierten Workflow aus')
  .argument('<workflow>', 'Name des Workflows (standard, deep, quick, performance)')
  .option('-f, --file <file>', 'Zu analysierende Datei')
  .option('-d, --directory <directory>', 'Zu analysierendes Verzeichnis')
  .option('-o, --output <format>', 'Ausgabeformat (console, json, html)', 'console')
  .option('-s, --save', 'Speichert korrigierte Versionen')
  .action((workflow, options) => {
    executeWorkflow(workflow, options);
  });

program
  .command('trigger')
  .description('Löst einen Workflow basierend auf dem Ereignistyp aus')
  .argument('<trigger>', 'Ereignistyp (git_pre_commit, runtime_error, ci_failure, manual)')
  .option('-f, --file <file>', 'Zu analysierende Datei')
  .option('-d, --directory <directory>', 'Zu analysierendes Verzeichnis')
  .option('-e, --error <error>', 'Fehlertext (für runtime_error)')
  .option('-o, --output <format>', 'Ausgabeformat (console, json, html)', 'console')
  .option('-s, --save', 'Speichert korrigierte Versionen')
  .action((trigger, options) => {
    // Workflow basierend auf Trigger bestimmen
    const workflowName = config.triggers[trigger] || 'standard';
    
    // Bei Runtime-Fehler den Fehlertyp erkennen und entsprechenden Workflow auswählen
    if (trigger === 'runtime_error' && options.error) {
      for (const [pattern, errorText] of Object.entries(config.error_patterns)) {
        if (options.error.includes(errorText)) {
          console.log(`Fehlertyp erkannt: ${pattern}`);
          if (pattern === 'stack_overflow') {
            workflowName = 'deep';
          }
          break;
        }
      }
    }
    
    console.log(`Löse Workflow "${workflowName}" aus basierend auf Trigger "${trigger}"`);
    executeWorkflow(workflowName, options);
  });

program
  .command('install-hooks')
  .description('Installiert Git-Hooks zur automatischen Auslösung')
  .action(() => {
    installGitHooks();
  });

program
  .command('watch')
  .description('Überwacht Dateien auf Änderungen')
  .argument('<directory>', 'Zu überwachendes Verzeichnis')
  .option('-p, --pattern <pattern>', 'Dateimuster (z.B. "**/*.js")', '**/*.{js,py}')
  .option('-w, --workflow <workflow>', 'Auszuführender Workflow', 'quick')
  .action((directory, options) => {
    watchFiles(directory, options.pattern, options.workflow);
  });

// Add enterprise-specific commands if enterprise workflow is available
if (enterpriseWorkflow) {
  program
    .command('enterprise-policy-check')
    .description('Führt eine Enterprise-Policy-Überprüfung für rekursive Funktionen durch')
    .option('-f, --file <file>', 'Zu analysierende Datei')
    .option('-d, --directory <directory>', 'Zu analysierendes Verzeichnis')
    .action((options) => {
      console.log('Führe Enterprise-Policy-Überprüfung durch...');

      if (!options.file && !options.directory) {
        console.error('Keine Datei oder Verzeichnis angegeben');
        process.exit(1);
      }

      const branch = getCurrentBranch();
      if (!branch) {
        console.error('Konnte aktuellen Branch nicht ermitteln');
        process.exit(1);
      }

      // Check policy compliance
      const policyResult = enterpriseWorkflow.checkPolicyCompliance(branch);

      console.log('\nErgebnis der Policy-Überprüfung:');
      if (policyResult.compliant) {
        console.log('✅ Alle Policies erfüllt');
      } else {
        console.log('❌ Policy-Verletzungen gefunden:');
        policyResult.violations.forEach(violation => {
          console.log(`\n- Policy: ${violation.policy}`);
          console.log(`  Beschreibung: ${violation.description}`);
          console.log(`  Betroffene Dateien: ${violation.files.join(', ')}`);
          console.log(`  Fehlende Genehmiger: ${violation.missingApprovers.join(', ')}`);
        });
      }
    });
}

program.parse();

/**
 * Hilfsfunktion: Aktuellen Branch ermitteln
 */
function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    return null;
  }
}

/**
 * Führt einen definierten Workflow aus
 */
function executeWorkflow(workflowName, options) {
  const workflow = config.workflows[workflowName];

  if (!workflow) {
    console.error(`Workflow "${workflowName}" nicht gefunden`);
    process.exit(1);
  }

  if (!options.file && !options.directory) {
    console.error('Keine Datei oder Verzeichnis angegeben');
    process.exit(1);
  }

  console.log(`Starte Workflow "${workflowName}" mit ${workflow.length} Schritten`);

  // Log workflow execution to enterprise audit log if available
  if (enterpriseWorkflow) {
    enterpriseWorkflow.logAudit('execute-debug-workflow', {
      workflowName,
      file: options.file,
      directory: options.directory,
      steps: workflow.length
    });
  }
  
  // Temporäre Datei für Zwischenergebnisse
  const tempDir = path.resolve(os.tmpdir(), 'claude-code-debug');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const tempFile = path.join(tempDir, `debug-result-${Date.now()}.json`);
  let previousResult = null;
  
  // Workflow-Schritte ausführen
  for (let i = 0; i < workflow.length; i++) {
    const step = workflow[i];
    const command = step.command;
    const cmdOptions = { ...step.options };
    
    // Dateipfad hinzufügen
    if (options.file) {
      cmdOptions.file = options.file;
    }
    if (options.directory) {
      cmdOptions.path = options.directory;
    }
    
    // Zwischenergebnisse verarbeiten, falls vorhanden
    if (previousResult) {
      // Relevante Informationen aus vorherigem Schritt extrahieren
      if (previousResult.bugs && command === 'optimize-recursive') {
        // Bugs aus vorherigem Debugging-Schritt berücksichtigen
        cmdOptions.focus = previousResult.bugs.map(bug => bug.type).join(',');
      }
      
      if (previousResult.stackTrace && command === 'debug-recursive') {
        // Stack-Trace aus vorherigem Schritt verwenden
        cmdOptions.trace = previousResult.stackTrace;
      }
    }
    
    console.log(`\nSchritt ${i+1}/${workflow.length}: ${command}`);
    console.log('Optionen:', cmdOptions);
    
    // Befehl ausführen
    try {
      const result = executeCliCommand(command, cmdOptions);
      
      // Ergebnis speichern
      previousResult = result;
      
      // Ergebnis anzeigen
      if (options.output === 'console') {
        console.log('\nErgebnis:');
        console.log(JSON.stringify(result, null, 2));
      }
      
      // Korrigierte Datei speichern, wenn gewünscht
      if (options.save && result.fixedCode) {
        const originalFile = options.file;
        const backupFile = `${originalFile}.bak`;
        
        // Backup erstellen
        fs.copyFileSync(originalFile, backupFile);
        
        // Korrigierte Version speichern
        fs.writeFileSync(originalFile, result.fixedCode);
        
        console.log(`\nKorrigierte Version gespeichert. Original-Backup: ${backupFile}`);
      }
    } catch (err) {
      console.error(`Fehler beim Ausführen von ${command}:`, err.message);
      if (i < workflow.length - 1) {
        console.log('Fahre mit nächstem Schritt fort...');
      }
    }
  }
  
  console.log('\nWorkflow abgeschlossen');
}

/**
 * Führt einen Claude Code CLI Befehl aus
 */
function executeCliCommand(command, options) {
  // In realen Implementierungen würde hier die Claude Code CLI API verwendet werden
  // Hier als Simulation mit einer Dummy-Implementierung
  
  console.log(`Ausführung von '${command}' mit Optionen:`, options);
  
  // Simuliertes Ausführen des Befehls (in realer Implementierung würde hier die tatsächliche CLI aufgerufen werden)
  const results = {
    command: command,
    options: options,
    timestamp: new Date().toISOString(),
  };
  
  // Simulierte Ergebnisse je nach Befehl
  switch (command) {
    case 'debug-recursive':
      results.bugs = [
        { 
          type: 'missing_base_case', 
          location: { file: options.file, line: 5 },
          description: 'Fehlende Basisfall-Überprüfung für n=1',
          severity: 'critical',
          fix: 'if (n <= 1) return n;'
        },
        {
          type: 'redundant_computation',
          location: { file: options.file, line: 9 },
          description: 'Redundante Berechnungen ohne Memoization',
          severity: 'performance',
          fix: 'Memoization-Pattern implementieren'
        }
      ];
      results.stackTrace = 'Simulated stack trace for debugging';
      break;
      
    case 'optimize-recursive':
      results.optimizations = [
        {
          type: 'memoization',
          description: 'Cache für bereits berechnete Werte hinzugefügt',
          performanceGain: '~75% schneller'
        },
        {
          type: 'base_case',
          description: 'Verbesserte Basisfallprüfung für effizientere Rekursion',
          performanceGain: '15% weniger Aufrufe'
        }
      ];
      results.fixedCode = `// Optimierte Version
function fibonacci(n, memo = {}) {
  // Validierung
  if (n < 0) throw new Error('Input must be non-negative');
  
  // Basis-Fälle
  if (n <= 1) return n;
  
  // Memoization
  if (memo[n] !== undefined) return memo[n];
  
  // Rekursive Berechnung mit Caching
  memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);
  return memo[n];
}`;
      break;
      
    case 'bug-hunt':
      results.bugs = [
        { 
          type: 'infinite_recursion', 
          location: { file: options.file || options.path, line: 12 },
          description: 'Keine Zyklus-Erkennung in rekursiver Struktur',
          severity: 'critical',
          fix: 'Set zur Verfolgung besuchter Knoten hinzufügen'
        },
        {
          type: 'memory_leak',
          location: { file: options.file || options.path, line: 28 },
          description: 'Pfad wird bei Rückkehr nicht bereinigt',
          severity: 'high',
          fix: 'path.pop() vor dem Zurückgeben von null'
        }
      ];
      break;
  }
  
  return results;
}

/**
 * Installiert Git-Hooks zur automatischen Auslösung
 */
function installGitHooks() {
  const gitRoot = findGitRoot();
  
  if (!gitRoot) {
    console.error('Kein Git-Repository gefunden');
    return;
  }
  
  const hooksDir = path.join(gitRoot, '.git', 'hooks');
  
  if (!fs.existsSync(hooksDir)) {
    console.error(`Hooks-Verzeichnis nicht gefunden: ${hooksDir}`);
    return;
  }
  
  // Pre-commit-Hook
  const preCommitHookPath = path.join(hooksDir, 'pre-commit');
  const preCommitScript = `#!/bin/sh
# Automatischer Pre-Commit-Hook für rekursives Debugging
echo "Führe rekursives Debugging für geänderte Dateien durch..."

# Liste geänderter Dateien abrufen
changed_files=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\\.(js|py)$')

if [ -z "$changed_files" ]; then
  echo "Keine relevanten Dateien geändert."
  exit 0
fi

# Debug-Workflow für jede geänderte Datei ausführen
for file in $changed_files; do
  echo "Analysiere $file..."
  node ${path.resolve(__dirname, 'debug_workflow_engine.js')} trigger git_pre_commit --file "$file"
done

exit 0
`;
  
  fs.writeFileSync(preCommitHookPath, preCommitScript);
  fs.chmodSync(preCommitHookPath, '755');
  
  console.log(`Git-Hook installiert: ${preCommitHookPath}`);
  
  // Post-merge-Hook für CI-Fehler
  const postMergeHookPath = path.join(hooksDir, 'post-merge');
  const postMergeScript = `#!/bin/sh
# Automatischer Post-Merge-Hook für rekursives Debugging
echo "Prüfe auf CI-Fehler nach Merge..."

# Beispielhafte Prüfung auf CI-Fehler (in echten Projekten anpassen)
if [ -f ".ci_failed" ]; then
  echo "CI-Fehler gefunden, starte tiefes Debugging..."
  node ${path.resolve(__dirname, 'debug_workflow_engine.js')} trigger ci_failure --directory "src"
  rm .ci_failed
fi

exit 0
`;
  
  fs.writeFileSync(postMergeHookPath, postMergeScript);
  fs.chmodSync(postMergeHookPath, '755');
  
  console.log(`Git-Hook installiert: ${postMergeHookPath}`);
}

/**
 * Sucht nach dem Git-Repository-Root
 */
function findGitRoot() {
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
    return gitRoot;
  } catch (error) {
    return null;
  }
}

/**
 * Überwacht Dateien auf Änderungen
 */
function watchFiles(directory, pattern, workflowName) {
  console.log(`Überwache Dateien in ${directory} mit Muster ${pattern}`);
  console.log('Drücken Sie Ctrl+C zum Beenden');
  
  // In echten Implementierungen würde hier ein Datei-Watcher wie chokidar verwendet werden
  // Hier als einfache Simulation mit Timer
  
  let countdown = 5;
  const interval = setInterval(() => {
    console.log(`Simulation: Noch ${countdown} Sekunden bis zur Dateiänderungserkennung...`);
    countdown--;
    
    if (countdown === 0) {
      clearInterval(interval);
      
      console.log('\nDateiänderung erkannt (simuliert)');
      const changedFile = path.join(directory, 'example_changed_file.js');
      
      console.log(`Löse Workflow "${workflowName}" für ${changedFile} aus`);
      executeWorkflow(workflowName, { file: changedFile });
      
      console.log('\nÜberwachung beendet (Simulation)');
    }
  }, 1000);
}

// Fehlende Module für die Simulation
const os = require('os');

console.log('Rekursives Debugging-Workflow-Engine gestartet');
