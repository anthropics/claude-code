#!/usr/bin/env node

/**
 * MCP-Server-Konfigurationstool
 * 
 * Dieses Skript hilft beim Einrichten und Starten der MCP-Server für das Claude Neural Framework.
 * Es lädt die Konfiguration aus server_config.json, überprüft die Umgebungsvariablen und startet
 * die konfigurierten Server.
 * 
 * Version: 1.0.0
 * Letztes Update: 2025-05-11
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');

// Pfad zur Konfigurationsdatei
const CONFIG_PATH = path.join(__dirname, 'server_config.json');

// Terminal-Farben für bessere Lesbarkeit
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Aktive MCP-Serverprozesse
const activeServers = new Map();

/**
 * Lädt die MCP-Server-Konfiguration
 * @returns {Object} Die geladene Konfiguration
 */
function loadConfig() {
  try {
    const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error(`${COLORS.red}Fehler beim Laden der Konfiguration:${COLORS.reset}`, error.message);
    process.exit(1);
  }
}

/**
 * Ersetzt Umgebungsvariablen-Platzhalter in den Argumenten
 * @param {Array} args Array von Argumenten mit Platzhaltern wie ${VAR_NAME}
 * @returns {Array} Array mit ersetzten Platzhaltern
 */
function replaceEnvVars(args) {
  return args.map(arg => {
    if (typeof arg !== 'string') return arg;
    
    return arg.replace(/\${([A-Z_]+)}/g, (match, varName) => {
      const value = process.env[varName];
      if (!value) {
        console.warn(`${COLORS.yellow}Warnung: Umgebungsvariable ${varName} ist nicht gesetzt${COLORS.reset}`);
        return match; // Behalte den Platzhalter bei
      }
      return value;
    });
  });
}

/**
 * Prüft, ob NPX installiert ist
 * @returns {boolean} True, wenn NPX verfügbar ist
 */
function checkNpx() {
  try {
    execSync('npx --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Startet einen MCP-Server
 * @param {string} name Name des Servers
 * @param {Object} config Serverkonfiguration
 */
function startServer(name, config) {
  console.log(`${COLORS.cyan}Starte MCP-Server:${COLORS.reset} ${name} (${config.description || 'Kein Beschreibung'})`);
  
  const args = replaceEnvVars(config.args);
  const serverProcess = spawn(config.command, args, {
    stdio: 'pipe',
    shell: true
  });
  
  activeServers.set(name, serverProcess);
  
  serverProcess.stdout.on('data', (data) => {
    console.log(`${COLORS.green}[${name}]${COLORS.reset} ${data.toString().trim()}`);
  });
  
  serverProcess.stderr.on('data', (data) => {
    console.error(`${COLORS.red}[${name}]${COLORS.reset} ${data.toString().trim()}`);
  });
  
  serverProcess.on('close', (code) => {
    console.log(`${COLORS.yellow}MCP-Server ${name} beendet mit Code ${code}${COLORS.reset}`);
    activeServers.delete(name);
  });
  
  console.log(`${COLORS.green}MCP-Server ${name} gestartet mit PID ${serverProcess.pid}${COLORS.reset}`);
}

/**
 * Stoppt alle aktiven MCP-Server
 */
function stopAllServers() {
  console.log(`${COLORS.yellow}Stoppe alle MCP-Server...${COLORS.reset}`);
  
  activeServers.forEach((process, name) => {
    process.kill();
    console.log(`${COLORS.yellow}MCP-Server ${name} gestoppt${COLORS.reset}`);
  });
  
  activeServers.clear();
}

/**
 * Zeigt eine Auflistung aller verfügbaren MCP-Server
 * @param {Object} config Die geladene Konfiguration
 */
function listServers(config) {
  console.log(`${COLORS.blue}=== Verfügbare MCP-Server ===${COLORS.reset}`);
  
  for (const category in config.mcpServers) {
    console.log(`\n${COLORS.magenta}${category.toUpperCase()}:${COLORS.reset}`);
    
    for (const [name, serverConfig] of Object.entries(config.mcpServers[category])) {
      const autostart = serverConfig.autostart ? '(Autostart)' : '';
      console.log(`  ${COLORS.cyan}${name}${COLORS.reset} - ${serverConfig.description || 'Keine Beschreibung'} ${COLORS.green}${autostart}${COLORS.reset}`);
    }
  }
  
  console.log(`\n${COLORS.blue}===========================${COLORS.reset}`);
}

/**
 * Zeigt die Umgebungsvariablen-Anforderungen
 * @param {Object} config Die geladene Konfiguration
 */
function showEnvironmentRequirements(config) {
  console.log(`${COLORS.blue}=== Benötigte Umgebungsvariablen ===${COLORS.reset}`);
  
  for (const [varName, description] of Object.entries(config.environmentVariables || {})) {
    const status = process.env[varName] ? `${COLORS.green}✓ Gesetzt${COLORS.reset}` : `${COLORS.red}✗ Nicht gesetzt${COLORS.reset}`;
    console.log(`  ${COLORS.cyan}${varName}${COLORS.reset} - ${description} ${status}`);
  }
  
  console.log(`${COLORS.blue}=====================================${COLORS.reset}`);
}

/**
 * Hauptfunktion des Skripts
 */
async function main() {
  // ASCII-Art-Banner für das Tool
  console.log(`${COLORS.cyan}
  ╔═══════════════════════════════════════════════╗
  ║         CLAUDE NEURAL FRAMEWORK              ║
  ║         MCP-SERVER-MANAGER v1.0.0            ║
  ╚═══════════════════════════════════════════════╝${COLORS.reset}`);
  
  // Prüfe, ob NPX installiert ist
  if (!checkNpx()) {
    console.error(`${COLORS.red}Fehler: NPX ist nicht installiert. Bitte installiere Node.js mit NPM.${COLORS.reset}`);
    process.exit(1);
  }
  
  // Lade die Konfiguration
  const config = loadConfig();
  console.log(`${COLORS.green}Konfiguration geladen: ${CONFIG_PATH}${COLORS.reset}`);
  
  // Zeige Optionen
  console.log(`${COLORS.blue}Verfügbare Befehle:${COLORS.reset}`);
  console.log(`  ${COLORS.cyan}list${COLORS.reset} - Zeigt alle verfügbaren MCP-Server`);
  console.log(`  ${COLORS.cyan}start [name]${COLORS.reset} - Startet einen spezifischen MCP-Server`);
  console.log(`  ${COLORS.cyan}autostart${COLORS.reset} - Startet alle Server mit Autostart-Konfiguration`);
  console.log(`  ${COLORS.cyan}stop${COLORS.reset} - Stoppt alle laufenden MCP-Server`);
  console.log(`  ${COLORS.cyan}env${COLORS.reset} - Zeigt Umgebungsvariablen-Anforderungen`);
  console.log(`  ${COLORS.cyan}exit${COLORS.reset} - Beendet das Programm`);
  
  // Erstelle Interface für Benutzereingabe
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${COLORS.green}mcp>${COLORS.reset} `
  });
  
  // Handler für Programmbeendigung
  process.on('SIGINT', () => {
    stopAllServers();
    rl.close();
    process.exit(0);
  });
  
  // Eingabeschleife
  rl.prompt();
  rl.on('line', (line) => {
    const [command, ...args] = line.trim().split(' ');
    
    switch (command.toLowerCase()) {
      case 'list':
        listServers(config);
        break;
        
      case 'start':
        if (args.length === 0) {
          console.log(`${COLORS.yellow}Bitte gib den Namen des zu startenden Servers an${COLORS.reset}`);
          listServers(config);
        } else {
          const serverName = args[0];
          let serverFound = false;
          
          // Suche den Server in allen Kategorien
          for (const category in config.mcpServers) {
            if (serverName in config.mcpServers[category]) {
              startServer(serverName, config.mcpServers[category][serverName]);
              serverFound = true;
              break;
            }
          }
          
          if (!serverFound) {
            console.error(`${COLORS.red}MCP-Server "${serverName}" nicht gefunden${COLORS.reset}`);
          }
        }
        break;
        
      case 'autostart':
        console.log(`${COLORS.cyan}Starte alle Autostart-Server...${COLORS.reset}`);
        
        // Starte alle Server mit Autostart-Konfiguration
        for (const category in config.mcpServers) {
          for (const [name, serverConfig] of Object.entries(config.mcpServers[category])) {
            if (serverConfig.autostart) {
              startServer(name, serverConfig);
            }
          }
        }
        break;
        
      case 'stop':
        stopAllServers();
        break;
        
      case 'env':
        showEnvironmentRequirements(config);
        break;
        
      case 'exit':
        stopAllServers();
        rl.close();
        process.exit(0);
        break;
        
      default:
        console.log(`${COLORS.yellow}Unbekannter Befehl: ${command}${COLORS.reset}`);
    }
    
    rl.prompt();
  });
}

// Starte das Programm
main().catch(error => {
  console.error(`${COLORS.red}Unerwarteter Fehler:${COLORS.reset}`, error);
  process.exit(1);
});
