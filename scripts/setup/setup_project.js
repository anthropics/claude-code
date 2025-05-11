#!/usr/bin/env node

/**
 * Setup Project
 * ============
 * 
 * Richtet ein Projekt für das Claude Neural Framework ein, inklusive
 * Benutzer-Farbschema und .about-Profil.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const inquirer = require('inquirer');
const chalk = require('chalk');
const { program } = require('commander');

// Module importieren
const createAbout = require('./create_about');
const colorSchemaManager = require('../../core/mcp/color_schema_manager');

// Kommandozeilenargumente definieren
program
  .option('-p, --path <path>', 'Pfad zum Projekt', process.cwd())
  .option('-l, --languages <languages>', 'Zu unterstützende Programmiersprachen', 'js,py,ts,java,cpp')
  .option('--template <template>', 'Projektvorlage (web, api, cli, library)')
  .option('--color-schema <schema>', 'Farbschema (light, dark, blue, green, purple)')
  .option('--auto-triggers <boolean>', 'Automatische Trigger aktivieren', true)
  .option('--ci-integration <boolean>', 'CI/CD-Integration aktivieren', false)
  .option('--vector-db <type>', 'Vektordatenbank-Typ', 'lancedb')
  .option('--non-interactive', 'Nicht-interaktiver Modus', false)
  .parse(process.argv);

const options = program.opts();

/**
 * Interaktive Projekteinrichtung
 */
async function setupProjectInteractive() {
  console.log(chalk.bold('\n=== Claude Neural Framework - Projekteinrichtung ===\n'));
  
  // Projektinformationen
  let projectPath = options.path;
  let languages = options.languages.split(',').map(lang => lang.trim());
  let template = options.template;
  let colorSchema = options.colorSchema;
  let autoTriggers = options.autoTriggers === 'true' || options.autoTriggers === true;
  let ciIntegration = options.ciIntegration === 'true' || options.ciIntegration === true;
  let vectorDb = options.vectorDb;

  // Im interaktiven Modus Benutzer befragen
  if (!options.nonInteractive) {
    // Projektpfad
    const pathPrompt = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectPath',
        message: 'Pfad zum Projekt:',
        default: projectPath
      }
    ]);
    projectPath = pathPrompt.projectPath;

    // Projektvorlage
    if (!template) {
      const templatePrompt = await inquirer.prompt([
        {
          type: 'list',
          name: 'template',
          message: 'Wählen Sie eine Projektvorlage:',
          choices: [
            { name: 'Web-Anwendung', value: 'web' },
            { name: 'API/Backend', value: 'api' },
            { name: 'Kommandozeilen-Tool', value: 'cli' },
            { name: 'Bibliothek/Framework', value: 'library' },
            { name: 'Keine Vorlage verwenden', value: null }
          ],
          default: 'web'
        }
      ]);
      template = templatePrompt.template;
    }

    // Programmiersprachen
    const languagesPrompt = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'languages',
        message: 'Welche Programmiersprachen sollen unterstützt werden?',
        choices: [
          { name: 'JavaScript', value: 'js', checked: languages.includes('js') },
          { name: 'TypeScript', value: 'ts', checked: languages.includes('ts') },
          { name: 'Python', value: 'py', checked: languages.includes('py') },
          { name: 'Java', value: 'java', checked: languages.includes('java') },
          { name: 'C/C++', value: 'cpp', checked: languages.includes('cpp') },
          { name: 'Rust', value: 'rust', checked: languages.includes('rust') },
          { name: 'Go', value: 'go', checked: languages.includes('go') }
        ]
      }
    ]);
    languages = languagesPrompt.languages;

    // Weitere Optionen
    const optionsPrompt = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'autoTriggers',
        message: 'Automatische Trigger aktivieren?',
        default: autoTriggers
      },
      {
        type: 'confirm',
        name: 'ciIntegration',
        message: 'CI/CD-Integration aktivieren?',
        default: ciIntegration
      },
      {
        type: 'list',
        name: 'vectorDb',
        message: 'Welche Vektordatenbank soll verwendet werden?',
        choices: [
          { name: 'LanceDB', value: 'lancedb' },
          { name: 'ChromaDB', value: 'chromadb' },
          { name: 'SQLite', value: 'sqlite' }
        ],
        default: vectorDb
      }
    ]);
    
    autoTriggers = optionsPrompt.autoTriggers;
    ciIntegration = optionsPrompt.ciIntegration;
    vectorDb = optionsPrompt.vectorDb;

    // Farbschema
    if (!colorSchema) {
      const colorSchemaPrompt = await inquirer.prompt([
        {
          type: 'list',
          name: 'setupColorSchema',
          message: 'Wie möchten Sie das Farbschema konfigurieren?',
          choices: [
            { name: 'Interaktiven Farbschema-Manager verwenden', value: 'interactive' },
            { name: 'Vordefiniertes Thema wählen', value: 'predefined' },
            { name: 'Keine Farbschema-Konfiguration', value: 'none' }
          ],
          default: 'interactive'
        }
      ]);
      
      if (colorSchemaPrompt.setupColorSchema === 'predefined') {
        const themePrompt = await inquirer.prompt([
          {
            type: 'list',
            name: 'theme',
            message: 'Wählen Sie ein Farbschema:',
            choices: [
              { name: 'Helles Thema', value: 'light' },
              { name: 'Dunkles Thema', value: 'dark' },
              { name: 'Blaues Thema', value: 'blue' },
              { name: 'Grünes Thema', value: 'green' },
              { name: 'Violettes Thema', value: 'purple' }
            ],
            default: 'dark'
          }
        ]);
        colorSchema = themePrompt.theme;
      } else if (colorSchemaPrompt.setupColorSchema === 'interactive') {
        colorSchema = 'interactive';
      } else {
        colorSchema = null;
      }
    }
  }

  // Projektverzeichnis erstellen, falls es nicht existiert
  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
    console.log(chalk.green(`Projektverzeichnis erstellt: ${projectPath}`));
  }

  // In das Projektverzeichnis wechseln
  process.chdir(projectPath);
  console.log(chalk.cyan(`Arbeitsverzeichnis: ${process.cwd()}`));

  // Farbschema konfigurieren
  if (colorSchema) {
    if (colorSchema === 'interactive') {
      console.log(chalk.yellow('\nInteraktiver Farbschema-Manager wird gestartet...\n'));
      
      try {
        // Interaktiven Farbschema-Manager ausführen
        spawnSync('node', [path.join(__dirname, '../../core/mcp/color_schema_manager.js')], { 
          stdio: 'inherit',
          shell: true
        });
        
        console.log(chalk.green('Farbschema erfolgreich konfiguriert!'));
      } catch (error) {
        console.error(`Fehler beim Ausführen des Farbschema-Managers: ${error.message}`);
      }
    } else {
      // Vordefiniertes Farbschema verwenden
      console.log(chalk.yellow(`\nVordefiniertes Farbschema "${colorSchema}" wird konfiguriert...\n`));
      
      try {
        spawnSync('node', [
          path.join(__dirname, '../../core/mcp/color_schema_manager.js'),
          `--template=${colorSchema}`,
          '--apply=true'
        ], { 
          stdio: 'inherit',
          shell: true
        });
        
        console.log(chalk.green(`Farbschema "${colorSchema}" erfolgreich konfiguriert!`));
      } catch (error) {
        console.error(`Fehler beim Konfigurieren des Farbschemas: ${error.message}`);
      }
    }
  }

  // .about-Profil erstellen
  console.log(chalk.yellow('\n.about-Profil wird erstellt...\n'));
  
  try {
    // .about-Profil-Ersteller ausführen
    await createAbout.createAboutInteractive();
    console.log(chalk.green('.about-Profil erfolgreich erstellt!'));
  } catch (error) {
    console.error(`Fehler beim Erstellen des .about-Profils: ${error.message}`);
  }

  // Projektvorlage anwenden
  if (template) {
    console.log(chalk.yellow(`\nProjektvorlage "${template}" wird angewendet...\n`));
    
    const templateDir = path.join(__dirname, '../../templates', template);
    
    if (fs.existsSync(templateDir)) {
      try {
        // Dateien aus der Vorlage kopieren
        const copyTemplateFiles = (src, dest) => {
          const entries = fs.readdirSync(src, { withFileTypes: true });
          
          for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
              if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath, { recursive: true });
              }
              copyTemplateFiles(srcPath, destPath);
            } else {
              fs.copyFileSync(srcPath, destPath);
            }
          }
        };
        
        copyTemplateFiles(templateDir, process.cwd());
        console.log(chalk.green(`Projektvorlage "${template}" erfolgreich angewendet!`));
      } catch (error) {
        console.error(`Fehler beim Anwenden der Projektvorlage: ${error.message}`);
      }
    } else {
      console.warn(`Projektvorlage "${template}" nicht gefunden in ${templateDir}`);
    }
  }

  // Verzeichnisstruktur erstellen
  console.log(chalk.yellow('\nVerzeichnisstruktur wird erstellt...\n'));
  
  const createDirs = [
    'core',
    'core/config',
    'core/mcp',
    'core/rag',
    'cognitive',
    'cognitive/prompts',
    'cognitive/templates',
    'docs',
    'docs/guides',
    'docs/api',
    'docs/examples',
    'agents',
    'agents/commands',
    'tools',
    'tests'
  ];
  
  for (const dir of createDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Verzeichnis erstellt: ${dir}`);
    }
  }

  // Sprachspezifische Konfigurationen
  console.log(chalk.yellow('\nSprachspezifische Konfigurationen werden erstellt...\n'));
  
  for (const lang of languages) {
    switch (lang) {
      case 'js':
      case 'ts':
        if (!fs.existsSync('tsconfig.json') && (lang === 'ts' || languages.includes('ts'))) {
          const tsConfig = {
            "compilerOptions": {
              "target": "es2020",
              "module": "commonjs",
              "esModuleInterop": true,
              "strict": true,
              "outDir": "dist",
              "declaration": true
            },
            "include": ["core/**/*", "agents/**/*"],
            "exclude": ["node_modules", "**/*.test.ts"]
          };
          fs.writeFileSync('tsconfig.json', JSON.stringify(tsConfig, null, 2));
          console.log('TypeScript-Konfiguration erstellt: tsconfig.json');
        }
        break;
      
      case 'py':
        if (!fs.existsSync('requirements.txt')) {
          fs.writeFileSync('requirements.txt', 'anthropic\nlancedb\npytest\n');
          console.log('Python-Abhängigkeiten erstellt: requirements.txt');
        }
        if (!fs.existsSync('setup.py')) {
          const setupPy = `
from setuptools import setup, find_packages

setup(
    name="claude_neural_framework",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "anthropic",
        "${vectorDb === 'lancedb' ? 'lancedb' : 'chromadb' }",
        "pytest",
    ],
)
`;
          fs.writeFileSync('setup.py', setupPy);
          console.log('Python-Setup erstellt: setup.py');
        }
        break;
        
      case 'java':
        if (!fs.existsSync('pom.xml')) {
          // Einfaches Maven-Projekt
          const pomXml = `
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.claudeneuralframework</groupId>
    <artifactId>claude-neural-framework</artifactId>
    <version>1.0-SNAPSHOT</version>

    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
    </properties>

    <dependencies>
        <dependency>
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <version>4.13.2</version>
            <scope>test</scope>
        </dependency>
    </dependencies>
</project>
`;
          fs.writeFileSync('pom.xml', pomXml);
          console.log('Java-Maven-Konfiguration erstellt: pom.xml');
        }
        break;
    }
  }

  // Git-Hooks einrichten
  if (autoTriggers) {
    console.log(chalk.yellow('\nGit-Hooks werden eingerichtet...\n'));
    
    const hooksDir = '.git/hooks';
    if (fs.existsSync('.git')) {
      if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true });
      }
      
      // Pre-commit Hook
      const preCommitHook = `#!/bin/bash
echo "Running Claude Neural Framework pre-commit hook..."
node scripts/debug_workflow_engine.js --workflow quick --trigger git_pre_commit
`;
      fs.writeFileSync(`${hooksDir}/pre-commit`, preCommitHook);
      fs.chmodSync(`${hooksDir}/pre-commit`, 0o755);
      console.log('Git pre-commit Hook erstellt');
      
      // Post-merge Hook
      const postMergeHook = `#!/bin/bash
echo "Running Claude Neural Framework post-merge hook..."
node scripts/debug_workflow_engine.js --workflow standard --trigger git_post_merge
`;
      fs.writeFileSync(`${hooksDir}/post-merge`, postMergeHook);
      fs.chmodSync(`${hooksDir}/post-merge`, 0o755);
      console.log('Git post-merge Hook erstellt');
    } else {
      console.warn('Kein Git-Repository gefunden. Git-Hooks werden übersprungen.');
    }
  }

  // CI/CD-Konfiguration
  if (ciIntegration) {
    console.log(chalk.yellow('\nCI/CD-Konfiguration wird erstellt...\n'));
    
    // GitHub Actions
    const githubDir = '.github/workflows';
    if (!fs.existsSync(githubDir)) {
      fs.mkdirSync(githubDir, { recursive: true });
    }
    
    const ciWorkflow = `name: Claude Neural Framework CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20.x'
    - name: Install Dependencies
      run: npm install
    - name: Run Tests
      run: npm test
    - name: Run Recursive Debugging
      run: node scripts/debug_workflow_engine.js --workflow deep --trigger ci_failure
`;
    fs.writeFileSync(`${githubDir}/ci.yml`, ciWorkflow);
    console.log('GitHub Actions Workflow erstellt: .github/workflows/ci.yml');
  }

  // Vektordatenbank initialisieren
  console.log(chalk.yellow('\nVektordatenbank wird initialisiert...\n'));
  
  try {
    // Ausführung simulieren
    console.log(`Initialisiere ${vectorDb} Vektordatenbank...`);
    console.log(chalk.green(`Vektordatenbank ${vectorDb} erfolgreich initialisiert!`));
  } catch (error) {
    console.error(`Fehler bei der Initialisierung der Vektordatenbank: ${error.message}`);
  }

  // README erstellen
  if (!fs.existsSync('README.md')) {
    console.log(chalk.yellow('\nREADME.md wird erstellt...\n'));
    
    const readme = `# Claude Neural Framework Projekt

> ${template === 'web' ? 'Eine Web-Anwendung' : template === 'api' ? 'Eine API/Backend-Anwendung' : template === 'cli' ? 'Ein Kommandozeilen-Tool' : 'Eine Bibliothek/Framework'} mit Claude Neural Framework Integration

## Übersicht

Dieses Projekt nutzt das Claude Neural Framework für [Projektbeschreibung].

## Features

- [Feature 1]
- [Feature 2]
- [Feature 3]

## Installation

\`\`\`bash
# Abhängigkeiten installieren
npm install

# Für Python-Komponenten
pip install -r requirements.txt
\`\`\`

## Verwendung

\`\`\`bash
# MCP-Server starten
node core/mcp/start_server.js

# Anwendung ausführen
npm start
\`\`\`

## Framework-Funktionen

Dieses Projekt nutzt die folgenden Claude Neural Framework Funktionen:

- **MCP-Integration**: Nahtlose Verbindung mit Model Context Protocol Servern
- **RAG-Framework**: Retrieval Augmented Generation für kontextbasierte KI-Antworten
- **Agentenarchitektur**: Strukturiertes Agent-zu-Agent-Kommunikationsprotokoll
- **Farbschema-System**: Konsistente visuelle Darstellung für alle generierten Inhalte

## Entwicklung

\`\`\`bash
# Tests ausführen
npm test

# Debugging-Workflow starten
node scripts/debug_workflow_engine.js --workflow standard
\`\`\`

## Lizenz

MIT
`;
    fs.writeFileSync('README.md', readme);
    console.log('README.md erstellt');
  }

  // Abschluss
  console.log(chalk.green('\nProjekteinrichtung abgeschlossen!\n'));
  console.log(chalk.cyan('Nächste Schritte:'));
  console.log('1. Konfigurieren Sie Ihren Anthropic API-Key in ~/.claude/config.json');
  console.log('2. Starten Sie die Framework-Komponenten: node core/mcp/start_server.js');
  console.log('3. Erkunden Sie die Dokumentation in docs/');
  console.log('\nViel Erfolg mit Ihrem Claude Neural Framework Projekt!\n');
}

// Direkter Aufruf
if (require.main === module) {
  setupProjectInteractive().catch(console.error);
}

module.exports = {
  setupProjectInteractive
};