#!/usr/bin/env node

/**
 * MCP Server Starter
 * =================
 * 
 * Startet die konfigurierten MCP-Server für das Claude Neural Framework.
 * 
 * Verwendung:
 *   node start_server.js [server_name]
 *   
 * Optionen:
 *   server_name - Optional. Wenn angegeben, wird nur der angegebene Server gestartet.
 *                 Sonst werden alle aktivierten Server gestartet.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// Konfigurationsdatei laden
const CONFIG_PATH = path.resolve(__dirname, '../config/mcp_config.json');
let config;

try {
  const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
  config = JSON.parse(configData);
} catch (err) {
  console.error(`Fehler beim Laden der Konfiguration: ${err.message}`);
  process.exit(1);
}

// Argumente verarbeiten
const args = process.argv.slice(2);
const specificServer = args[0];

// Liste der zu startenden Server erstellen
const serversToStart = [];

if (specificServer) {
  // Nur einen spezifischen Server starten
  if (config.servers[specificServer]) {
    if (config.servers[specificServer].enabled) {
      serversToStart.push({
        name: specificServer,
        ...config.servers[specificServer]
      });
    } else {
      console.warn(`Server "${specificServer}" ist deaktiviert. Starten Sie ihn mit --force, um ihn trotzdem zu starten.`);
      if (args.includes('--force')) {
        serversToStart.push({
          name: specificServer,
          ...config.servers[specificServer]
        });
      }
    }
  } else {
    console.error(`Server "${specificServer}" nicht gefunden in der Konfiguration.`);
    process.exit(1);
  }
} else {
  // Alle aktivierten Server starten
  Object.entries(config.servers).forEach(([name, serverConfig]) => {
    if (serverConfig.enabled && serverConfig.autostart) {
      serversToStart.push({
        name,
        ...serverConfig
      });
    }
  });
}

if (serversToStart.length === 0) {
  console.warn('Keine Server zum Starten gefunden.');
  process.exit(0);
}

// Server-Prozesse
const serverProcesses = new Map();

// Funktion zum Starten eines Servers
function startServer(server) {
  console.log(`Starte MCP-Server: ${server.name}`);
  
  // Umgebungsvariablen einrichten
  const env = { ...process.env };
  
  // API-Key aus Umgebungsvariable holen, wenn konfiguriert
  if (server.api_key_env && env[server.api_key_env]) {
    console.log(`API-Key für ${server.name} gefunden in ${server.api_key_env}`);
  } else if (server.api_key_env) {
    console.warn(`Kein API-Key für ${server.name} in ${server.api_key_env} gefunden`);
  }
  
  // Server starten
  const serverProcess = spawn(server.command, server.args, {
    env,
    stdio: 'pipe'
  });
  
  // Server zur Map hinzufügen
  serverProcesses.set(server.name, serverProcess);
  
  // Server-Ausgabe und -Fehler loggen
  serverProcess.stdout.on('data', (data) => {
    console.log(`[${server.name}] ${data.toString().trim()}`);
  });
  
  serverProcess.stderr.on('data', (data) => {
    console.error(`[${server.name}] FEHLER: ${data.toString().trim()}`);
  });
  
  // Server-Beendigung behandeln
  serverProcess.on('close', (code) => {
    console.log(`Server ${server.name} beendet mit Code ${code}`);
    serverProcesses.delete(server.name);
    
    // Automatischer Neustart, wenn nicht mit 0 beendet
    if (code !== 0 && server.autorestart) {
      console.log(`Automatischer Neustart von ${server.name} in 5 Sekunden...`);
      setTimeout(() => startServer(server), 5000);
    }
  });
  
  // Fehlerbehandlung
  serverProcess.on('error', (err) => {
    console.error(`Fehler beim Starten von ${server.name}: ${err.message}`);
  });
  
  return serverProcess;
}

// Alle Server starten
serversToStart.forEach(startServer);

console.log(`${serversToStart.length} MCP-Server gestartet.`);

// Host-Konfiguration aktualisieren
try {
  if (config.host && config.host.type === 'desktop') {
    const hostConfigPath = config.host.config_path.replace('~', os.homedir());
    
    // Stellen Sie sicher, dass das Verzeichnis existiert
    const hostConfigDir = path.dirname(hostConfigPath);
    if (!fs.existsSync(hostConfigDir)) {
      fs.mkdirSync(hostConfigDir, { recursive: true });
    }
    
    // Vorhandene Konfiguration laden oder neue erstellen
    let hostConfig = {};
    if (fs.existsSync(hostConfigPath)) {
      try {
        const hostConfigData = fs.readFileSync(hostConfigPath, 'utf8');
        hostConfig = JSON.parse(hostConfigData);
      } catch (err) {
        console.warn(`Konnte Host-Konfiguration nicht laden: ${err.message}`);
      }
    }
    
    // MCP-Server-Konfiguration aktualisieren
    hostConfig.mcpServers = hostConfig.mcpServers || {};
    
    serversToStart.forEach(server => {
      hostConfig.mcpServers[server.name] = {
        command: server.command,
        args: server.args
      };
    });
    
    // Konfiguration speichern
    fs.writeFileSync(hostConfigPath, JSON.stringify(hostConfig, null, 2));
    console.log(`Host-Konfiguration aktualisiert: ${hostConfigPath}`);
  }
} catch (err) {
  console.error(`Fehler beim Aktualisieren der Host-Konfiguration: ${err.message}`);
}

// Prozessbeendigung behandeln
process.on('SIGINT', () => {
  console.log('Beende alle MCP-Server...');
  
  serverProcesses.forEach((process, name) => {
    console.log(`Beende ${name}...`);
    process.kill();
  });
  
  console.log('Alle MCP-Server beendet.');
  process.exit(0);
});

console.log('MCP-Server-Starter läuft. Drücken Sie Ctrl+C zum Beenden.');
