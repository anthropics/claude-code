/**
 * Claude MCP Client API
 * 
 * Eine benutzerfreundliche API für die Interaktion mit MCP-Servern.
 * Diese Datei stellt Funktionen bereit, um mit Claude über das Model Context Protocol
 * zu kommunizieren.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { Anthropic } = require('@anthropic/sdk');

// Konfigurationsmanager importieren
const configManager = require('../config/config_manager');

/**
 * Klasse für die Kommunikation mit Claude über das Model Context Protocol
 */
class ClaudeMcpClient {
  /**
   * Erstellt eine neue Instanz des ClaudeMcpClient
   * 
   * @param {Object} options - Konfigurationsoptionen
   * @param {string} options.apiKey - Anthropic API-Schlüssel (optional, wird sonst aus Umgebungsvariable geladen)
   * @param {string} options.model - Claude-Modell (default: 'claude-3-7-sonnet')
   * @param {boolean} options.autoStartServers - Server automatisch starten (default: true)
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    
    if (!this.apiKey) {
      throw new Error('Kein API-Schlüssel für Claude gefunden. Bitte setzen Sie CLAUDE_API_KEY oder übergeben Sie ihn als Option.');
    }
    
    // MCP-Konfiguration laden
    this.config = configManager.getConfig('mcp');
    
    // Claude-Client initialisieren
    this.anthropic = new Anthropic({
      apiKey: this.apiKey
    });
    
    // Standardmodell
    this.model = options.model || this.config.client?.default_model || 'claude-3-7-sonnet';
    
    // Server-Prozesse
    this.serverProcesses = new Map();
    
    // Automatisch Server starten, wenn gewünscht
    if (options.autoStartServers !== false && this.config.mcp?.allow_server_autostart !== false) {
      this.startServers();
    }
  }
  
  /**
   * Startet die konfigurierten MCP-Server
   * 
   * @param {string[]} serverNames - Liste von Servernamen zum Starten (optional, sonst alle aktivierten Server)
   * @returns {Map<string, ChildProcess>} - Map mit gestarteten Server-Prozessen
   */
  startServers(serverNames = null) {
    // Zu startende Server ermitteln
    const servers = serverNames 
      ? serverNames.map(name => ({ name, ...this.config.servers[name] }))
      : Object.entries(this.config.servers)
        .filter(([_, server]) => server.enabled && server.autostart)
        .map(([name, server]) => ({ name, ...server }));
    
    console.log(`Starte ${servers.length} MCP-Server...`);
    
    // Server starten
    servers.forEach(server => {
      this._startServer(server);
    });
    
    return this.serverProcesses;
  }
  
  /**
   * Startet einen einzelnen MCP-Server
   * 
   * @param {Object} server - Server-Konfiguration
   * @returns {ChildProcess} - Der gestartete Server-Prozess
   * @private
   */
  _startServer(server) {
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
    this.serverProcesses.set(server.name, serverProcess);
    
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
      this.serverProcesses.delete(server.name);
      
      // Automatischer Neustart, wenn nicht mit 0 beendet
      if (code !== 0 && server.autorestart) {
        console.log(`Automatischer Neustart von ${server.name} in 5 Sekunden...`);
        setTimeout(() => this._startServer(server), 5000);
      }
    });
    
    return serverProcess;
  }
  
  /**
   * Generiert eine Claude-Antwort mit MCP-Integration
   * 
   * @param {Object} options - Optionen für die Anfrage
   * @param {string} options.prompt - Die Anfrage an Claude
   * @param {string} options.system - Optionale Systemanweisung
   * @param {string} options.model - Optionales Modell (überschreibt das Standardmodell)
   * @param {number} options.maxTokens - Maximale Anzahl von Tokens in der Antwort (default: 1024)
   * @param {number} options.temperature - Temperatur für die Antwortgenerierung (default: 0.7)
   * @param {string[]} options.requiredTools - Liste von benötigten MCP-Tools
   * @returns {Promise<string>} - Die generierte Antwort
   */
  async generateResponse(options) {
    const { 
      prompt, 
      system = '', 
      model = this.model, 
      maxTokens = 1024, 
      temperature = 0.7,
      requiredTools = []
    } = options;
    
    // Prüfen, ob alle benötigten Tools verfügbar sind
    if (requiredTools.length > 0) {
      const missingTools = requiredTools.filter(tool => {
        return !this.config.servers[tool] || !this.config.servers[tool].enabled;
      });
      
      if (missingTools.length > 0) {
        throw new Error(`Fehlende benötigte MCP-Tools: ${missingTools.join(', ')}`);
      }
      
      // Tools starten, falls noch nicht geschehen
      const toolsToStart = requiredTools.filter(tool => !this.serverProcesses.has(tool));
      if (toolsToStart.length > 0) {
        this.startServers(toolsToStart);
      }
    }
    
    // MCP-Konfiguration für Claude Desktop prüfen
    await this._ensureDesktopConfig();
    
    try {
      // Claude API-Anfrage erstellen
      const response = await this.anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [
          { role: 'user', content: prompt }
        ]
      });
      
      return response.content[0].text;
    } catch (error) {
      console.error(`Fehler bei der Claude-Anfrage: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Stellt sicher, dass die Claude Desktop-Konfiguration korrekt eingerichtet ist
   * 
   * @returns {Promise<boolean>} - true, wenn die Konfiguration erfolgreich eingerichtet wurde
   * @private
   */
  async _ensureDesktopConfig() {
    // Nur für Desktop-Konfiguration relevant
    if (this.config.host?.type !== 'desktop') {
      return true;
    }
    
    try {
      const hostConfigPath = this.config.host.config_path.replace('~', os.homedir());
      
      // Stellen Sie sicher, dass das Verzeichnis existiert
      const hostConfigDir = path.dirname(hostConfigPath);
      if (!fs.existsSync(hostConfigDir)) {
        fs.mkdirSync(hostConfigDir, { recursive: true });
      }
      
      // Vorhandene Konfiguration laden oder neue erstellen
      let hostConfig = {};
      if (fs.existsSync(hostConfigPath)) {
        const hostConfigData = fs.readFileSync(hostConfigPath, 'utf8');
        hostConfig = JSON.parse(hostConfigData);
      }
      
      // MCP-Server-Konfiguration aktualisieren
      hostConfig.mcpServers = hostConfig.mcpServers || {};
      
      // Aktive Server zur Konfiguration hinzufügen
      Object.entries(this.config.servers)
        .filter(([_, server]) => server.enabled)
        .forEach(([name, server]) => {
          hostConfig.mcpServers[name] = {
            command: server.command,
            args: server.args
          };
        });
      
      // Konfiguration speichern
      fs.writeFileSync(hostConfigPath, JSON.stringify(hostConfig, null, 2));
      console.log(`Host-Konfiguration aktualisiert: ${hostConfigPath}`);
      
      return true;
    } catch (error) {
      console.error(`Fehler beim Aktualisieren der Host-Konfiguration: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Beendet alle laufenden MCP-Server
   */
  stopAllServers() {
    console.log('Beende alle MCP-Server...');
    
    this.serverProcesses.forEach((process, name) => {
      console.log(`Beende ${name}...`);
      process.kill();
    });
    
    this.serverProcesses.clear();
    console.log('Alle MCP-Server beendet.');
  }
  
  /**
   * Gibt die verfügbaren MCP-Server zurück
   * 
   * @param {boolean} activeOnly - Nur aktive Server zurückgeben
   * @returns {Object} - Verfügbare Server mit Name, Status und Beschreibung
   */
  getAvailableServers(activeOnly = false) {
    const servers = {};
    
    Object.entries(this.config.servers).forEach(([name, config]) => {
      // Überspringen, wenn nur aktive Server gewünscht sind und dieser inaktiv ist
      if (activeOnly && !config.enabled) {
        return;
      }
      
      servers[name] = {
        name,
        enabled: config.enabled,
        running: this.serverProcesses.has(name),
        autostart: config.autostart,
        description: config.description
      };
    });
    
    return servers;
  }
}

// Export als Klassentyp
module.exports = ClaudeMcpClient;

// Wenn direkt ausgeführt, starten wir ein einfaches Beispiel
if (require.main === module) {
  const client = new ClaudeMcpClient();
  
  // Verfügbare Server ausgeben
  console.log('Verfügbare MCP-Server:');
  const servers = client.getAvailableServers();
  console.table(servers);
  
  // Prompt für Claude
  const prompt = process.argv[2] || 'Erkläre mir die Funktionsweise des Model Context Protocol (MCP) in einfachen Worten.';
  
  // Claude-Antwort generieren
  client.generateResponse({ prompt })
    .then(response => {
      console.log('\nClaude-Antwort:');
      console.log(response);
      
      // Server beenden
      client.stopAllServers();
    })
    .catch(error => {
      console.error(`Fehler: ${error.message}`);
      client.stopAllServers();
    });
}
