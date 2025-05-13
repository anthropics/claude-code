#!/bin/bash
# SAAR - Modern Dashboard UI Module
# 
# This module implements a modern web-based dashboard for
# monitoring the SAAR system and MCP tools.

# Function to setup dashboard components
setup_dashboard() {
  log "INFO" "Setting up Dashboard UI..."

  # Create the necessary directories
  mkdir -p "$CONFIG_DIR/dashboard" "$TOOLS_DIR/dashboard" "$DASHBOARD_DIR"
  mkdir -p "$DASHBOARD_DIR/assets" "$DASHBOARD_DIR/components"
  
  # Setup the dashboard configuration
  setup_dashboard_config
  
  # Setup the server
  setup_dashboard_server
  
  # Setup the frontend
  setup_dashboard_frontend
  
  # Setup the API routes
  setup_dashboard_api

  # Setup enhanced visualizations
  setup_dashboard_visualizations

  log "SUCCESS" "Dashboard UI setup completed"
}

# Function to setup dashboard visualizations
setup_dashboard_visualizations() {
  log "INFO" "Setting up Dashboard Visualizations..."

  # Create visualizations directory
  mkdir -p "$DASHBOARD_DIR/visualizations"

  # Copy visualization script
  cp "$TOOLS_DIR/mcp/dashboard_visualization.js" "$DASHBOARD_DIR/visualizations/"
  chmod +x "$DASHBOARD_DIR/visualizations/dashboard_visualization.js"

  # Create visualization routes in server.js
  cat >> "$TOOLS_DIR/dashboard/server.js" << 'EOF'

// Visualization routes
app.get(`${config.server.api_prefix}/visualizations`, (req, res) => {
  const visualizationDir = path.join(dashboardDir, 'visualizations');

  if (!fs.existsSync(visualizationDir)) {
    return res.json({ visualizations: [] });
  }

  try {
    const files = fs.readdirSync(visualizationDir)
      .filter(file => file.endsWith('.html'))
      .sort()
      .reverse();

    const visualizations = files.map(file => ({
      name: file,
      url: `/visualizations/${file}`,
      type: file.split('-')[0],
      date: fs.statSync(path.join(visualizationDir, file)).mtime
    }));

    res.json({ visualizations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve visualization files
app.use('/visualizations', express.static(path.join(dashboardDir, 'visualizations')));

// Generate visualizations
app.post(`${config.server.api_prefix}/visualizations/generate`, (req, res) => {
  const { type, name } = req.body;

  const visualizationScript = path.join(dashboardDir, 'visualizations', 'dashboard_visualization.js');

  if (!fs.existsSync(visualizationScript)) {
    return res.status(500).json({ error: 'Visualization script not found' });
  }

  const args = type === 'workflow' ? [type, name] : [type];

  const process = spawn('node', [visualizationScript, ...args]);

  let stdout = '';
  let stderr = '';

  process.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  process.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  process.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: `Visualization failed: ${stderr}` });
    }

    const match = stdout.match(/saved to: ([^\n]+)/);
    const outputFile = match ? match[1] : null;

    if (!outputFile) {
      return res.status(500).json({ error: 'Could not determine output file' });
    }

    res.json({
      success: true,
      file: path.basename(outputFile),
      url: `/visualizations/${path.basename(outputFile)}`
    });
  });
});
EOF

  # Create visualization UI component
  mkdir -p "$DASHBOARD_DIR/public/js"

  cat > "$DASHBOARD_DIR/public/js/visualizations.js" << 'EOF'
// Dashboard Visualizations
function initVisualizations() {
  const visualizationsContainer = document.getElementById('visualizations-container');
  if (!visualizationsContainer) return;

  // Load visualizations
  fetch('/api/visualizations')
    .then(response => response.json())
    .then(data => {
      const visualizations = data.visualizations || [];

      if (visualizations.length === 0) {
        visualizationsContainer.innerHTML = '<p>No visualizations found. Generate some visualizations to see them here.</p>';
        return;
      }

      // Group visualizations by type
      const groupedViz = visualizations.reduce((groups, viz) => {
        const type = viz.type || 'other';
        if (!groups[type]) groups[type] = [];
        groups[type].push(viz);
        return groups;
      }, {});

      // Generate HTML for each type
      let html = '';

      for (const [type, items] of Object.entries(groupedViz)) {
        html += `<h3>${type.charAt(0).toUpperCase() + type.slice(1)} Visualizations</h3>`;
        html += '<div class="viz-grid">';

        for (const viz of items) {
          html += `
            <div class="viz-card">
              <div class="viz-header">
                <div class="viz-title">${viz.name}</div>
                <div class="viz-date">${new Date(viz.date).toLocaleString()}</div>
              </div>
              <div class="viz-actions">
                <a href="${viz.url}" target="_blank" class="viz-btn">View</a>
              </div>
            </div>
          `;
        }

        html += '</div>';
      }

      visualizationsContainer.innerHTML = html;
    })
    .catch(err => {
      visualizationsContainer.innerHTML = `<p>Error loading visualizations: ${err.message}</p>`;
    });

  // Setup generation form
  const generateForm = document.getElementById('generate-visualization-form');
  if (generateForm) {
    generateForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const type = document.getElementById('viz-type').value;
      const name = document.getElementById('viz-name').value;

      // Validate
      if (type === 'workflow' && !name) {
        alert('Please enter a workflow name');
        return;
      }

      // Disable form
      const submitBtn = generateForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Generating...';

      // Generate visualization
      fetch('/api/visualizations/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type, name })
      })
        .then(response => response.json())
        .then(data => {
          if (data.error) {
            alert(`Error: ${data.error}`);
          } else {
            alert(`Visualization generated successfully!`);

            // Reload visualizations
            initVisualizations();

            // Open the visualization
            if (data.url) {
              window.open(data.url, '_blank');
            }
          }
        })
        .catch(err => {
          alert(`Error: ${err.message}`);
        })
        .finally(() => {
          // Re-enable form
          submitBtn.disabled = false;
          submitBtn.textContent = 'Generate';
        });
    });
  }
}

// Initialize visualizations when DOM is loaded
document.addEventListener('DOMContentLoaded', initVisualizations);
EOF

  # Add visualizations tab to dashboard
  sed -i "s|<div id=\"logs-container\">|<div id=\"visualizations-container\">\n      </div>\n      \n      <div class=\"visualization-controls\">\n        <h3>Generate Visualization</h3>\n        <form id=\"generate-visualization-form\">\n          <div class=\"form-group\">\n            <label for=\"viz-type\">Type:</label>\n            <select id=\"viz-type\" name=\"type\">\n              <option value=\"all\">All</option>\n              <option value=\"memory\">Memory System</option>\n              <option value=\"tools\">MCP Tools</option>\n              <option value=\"workflow\">Workflow</option>\n            </select>\n          </div>\n          \n          <div class=\"form-group\" id=\"workflow-name-group\">\n            <label for=\"viz-name\">Workflow Name:</label>\n            <input type=\"text\" id=\"viz-name\" name=\"name\" placeholder=\"e.g. code_analysis\">\n          </div>\n          \n          <button type=\"submit\">Generate</button>\n        </form>\n      </div>\n      \n      <div id=\"logs-container\">|" "$DASHBOARD_DIR/public/index.html"

  # Add visualizations script to HTML
  sed -i "s|</body>|<script src=\"js/visualizations.js\"></script>\n</body>|" "$DASHBOARD_DIR/public/index.html"

  # Add visualization styles
  cat >> "$DASHBOARD_DIR/public/styles.css" << 'EOF'
/* Visualization styles */
.viz-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
  margin-bottom: 30px;
}

.viz-card {
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 15px;
  background-color: #f9f9f9;
  transition: all 0.2s ease;
}

.viz-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.viz-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.viz-title {
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 70%;
}

.viz-date {
  font-size: 0.8em;
  color: #666;
}

.viz-actions {
  margin-top: 10px;
  text-align: right;
}

.viz-btn {
  display: inline-block;
  padding: 5px 15px;
  background-color: #6366f1;
  color: white;
  border-radius: 4px;
  text-decoration: none;
  font-size: 0.9em;
}

.viz-btn:hover {
  background-color: #4f46e5;
}

.visualization-controls {
  margin-bottom: 30px;
  padding: 20px;
  background-color: #f3f4f6;
  border-radius: 8px;
}

.visualization-controls h3 {
  margin-top: 0;
  margin-bottom: 15px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-group select,
.form-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.visualization-controls button {
  padding: 8px 20px;
  background-color: #6366f1;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.visualization-controls button:hover {
  background-color: #4f46e5;
}

.visualization-controls button:disabled {
  background-color: #a5a6f6;
  cursor: not-allowed;
}
EOF

  log "SUCCESS" "Dashboard Visualizations created"
}

# Function to setup dashboard configuration
setup_dashboard_config() {
  log "INFO" "Setting up Dashboard Configuration..."
  
  # Create default configuration if it doesn't exist
  if [ ! -f "$CONFIG_DIR/dashboard/config.json" ]; then
    cat > "$CONFIG_DIR/dashboard/config.json" << 'EOF'
{
  "server": {
    "port": 3500,
    "host": "localhost",
    "api_prefix": "/api"
  },
  "theme": {
    "primary_color": "#6366f1",
    "secondary_color": "#8b5cf6",
    "background_color": "#f9fafb",
    "dark_mode": true,
    "accent_color": "#10b981"
  },
  "panels": {
    "system_status": true,
    "mcp_tools": true,
    "deepthink": true,
    "cross_tool_workflows": true,
    "memory_viewer": true,
    "log_viewer": true
  },
  "refresh_interval_ms": 5000,
  "logs": {
    "max_lines": 1000,
    "show_timestamps": true,
    "auto_scroll": true
  },
  "security": {
    "require_login": false,
    "session_timeout_minutes": 60
  }
}
EOF
    log "SUCCESS" "Created default dashboard configuration"
  else
    log "INFO" "Dashboard configuration already exists"
  fi
}

# Function to setup dashboard server
setup_dashboard_server() {
  log "INFO" "Setting up Dashboard Server..."
  
  # Create server script
  cat > "$TOOLS_DIR/dashboard/server.js" << 'EOF'
/**
 * SAAR Dashboard Server
 * 
 * Provides a modern web-based dashboard for monitoring
 * the SAAR system and MCP tools.
 */

const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const CONFIG_DIR = process.env.HOME + '/.claude';
const configPath = path.join(CONFIG_DIR, 'dashboard', 'config.json');
const dashboardDir = path.join(CONFIG_DIR, 'tools', 'dashboard');

// Load configuration
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  console.error(`Error loading dashboard configuration: ${err.message}`);
  config = {
    server: {
      port: 3500,
      host: 'localhost',
      api_prefix: '/api'
    }
  };
}

// Create Express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.static(path.join(dashboardDir, 'public')));

// API routes
app.get(`${config.server.api_prefix}/status`, (req, res) => {
  getSystemStatus()
    .then(status => res.json(status))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.get(`${config.server.api_prefix}/mcp/tools`, (req, res) => {
  getMcpTools()
    .then(tools => res.json(tools))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.get(`${config.server.api_prefix}/logs`, (req, res) => {
  getLogEntries(config.logs.max_lines)
    .then(logs => res.json(logs))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.get(`${config.server.api_prefix}/workflows`, (req, res) => {
  getWorkflows()
    .then(workflows => res.json(workflows))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.post(`${config.server.api_prefix}/workflows/run`, (req, res) => {
  const { name, params } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Workflow name is required' });
  }
  
  runWorkflow(name, params)
    .then(result => res.json(result))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.get(`${config.server.api_prefix}/memory`, (req, res) => {
  getMemoryContents()
    .then(memory => res.json(memory))
    .catch(err => res.status(500).json({ error: err.message }));
});

// Main route - serve the dashboard
app.get('*', (req, res) => {
  res.sendFile(path.join(dashboardDir, 'public', 'index.html'));
});

// Get system status
async function getSystemStatus() {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-c', 'source $HOME/.claude/startup/00_common.sh && do_status_check']);
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Status check failed with code ${code}: ${stderr}`));
      }
      
      // Parse the status output
      const result = {
        workspace: {},
        mcp_servers: {},
        memory_system: {},
        schema_ui: {},
        api_keys: {},
        user_profiles: {},
        neural_framework: {},
        debugging_components: {},
        autonomy_system: {}
      };
      
      // Very basic parsing - in a real implementation this would be more robust
      if (stdout.includes('Workspace:')) {
        result.workspace.initialized = !stdout.includes('Not initialized');
      }
      
      if (stdout.includes('MCP Servers:')) {
        result.mcp_servers.configured = !stdout.includes('Not configured');
        
        // Extract running servers count
        const match = stdout.match(/Running servers: (\d+)/);
        if (match) {
          result.mcp_servers.running_count = parseInt(match[1], 10);
        }
      }
      
      resolve(result);
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

// Get MCP tools
async function getMcpTools() {
  const toolsCachePath = path.join(CONFIG_DIR, 'mcp', 'cache', 'tools_cache.json');
  
  if (!fs.existsSync(toolsCachePath)) {
    return [];
  }
  
  try {
    const toolsCache = JSON.parse(fs.readFileSync(toolsCachePath, 'utf8'));
    return Object.entries(toolsCache).map(([name, status]) => ({
      name,
      available: status.available,
      fallback_applied: status.fallbackApplied || false,
      last_checked: status.lastChecked,
      reason: status.reason
    }));
  } catch (err) {
    throw new Error(`Error reading MCP tools cache: ${err.message}`);
  }
}

// Get log entries
async function getLogEntries(maxLines) {
  const logPath = path.join(CONFIG_DIR, 'saar.log');
  
  if (!fs.existsSync(logPath)) {
    return [];
  }
  
  return new Promise((resolve, reject) => {
    const child = spawn('tail', ['-n', maxLines.toString(), logPath]);
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`tail command failed with code ${code}: ${stderr}`));
      }
      
      // Parse log entries
      const entries = stdout.split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => {
          const match = line.match(/\[([^\]]+)\] \[([^\]]+)\] (.+)/);
          if (match) {
            return {
              timestamp: match[1],
              level: match[2],
              message: match[3]
            };
          }
          return null;
        })
        .filter(entry => entry !== null);
      
      resolve(entries);
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

// Get workflows
async function getWorkflows() {
  const workflowsDir = path.join(CONFIG_DIR, 'mcp', 'workflows');
  
  if (!fs.existsSync(workflowsDir)) {
    return [];
  }
  
  try {
    const files = fs.readdirSync(workflowsDir);
    const workflows = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(workflowsDir, file);
        const workflow = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        workflows.push({
          name: workflow.name,
          description: workflow.description,
          steps: workflow.steps.length,
          inputs: workflow.inputs
        });
      }
    }
    
    return workflows;
  } catch (err) {
    throw new Error(`Error reading workflows: ${err.message}`);
  }
}

// Run a workflow
async function runWorkflow(name, params) {
  return new Promise((resolve, reject) => {
    const workflowManagerPath = path.join(CONFIG_DIR, 'tools', 'mcp', 'workflow_manager.js');
    
    if (!fs.existsSync(workflowManagerPath)) {
      return reject(new Error('Workflow manager not found'));
    }
    
    // Convert params to command line arguments
    const args = ['run', name];
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        args.push(`${key}=${value}`);
      }
    }
    
    const child = spawn('node', [workflowManagerPath, ...args], { shell: true });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Workflow failed with code ${code}: ${stderr}`));
      }
      
      resolve({
        success: true,
        output: stdout
      });
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

// Get memory contents
async function getMemoryContents() {
  const memoryPath = path.join(CONFIG_DIR, 'storage', 'agentic-os-memory.json');
  
  if (!fs.existsSync(memoryPath)) {
    return { entries: [] };
  }
  
  try {
    const memory = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
    return memory;
  } catch (err) {
    throw new Error(`Error reading memory file: ${err.message}`);
  }
}

// Start the server
const PORT = config.server.port;
const HOST = config.server.host;

server.listen(PORT, HOST, () => {
  console.log(`SAAR Dashboard running at http://${HOST}:${PORT}/`);
});
EOF

  # Make server executable
  chmod +x "$TOOLS_DIR/dashboard/server.js"
  
  # Create a dashboard start script
  cat > "$TOOLS_DIR/dashboard/start-dashboard.sh" << 'EOF'
#!/bin/bash

# SAAR Dashboard Starter
# Starts the SAAR dashboard server

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
CONFIG_DIR="$HOME/.claude"
SERVER_SCRIPT="$SCRIPT_DIR/server.js"

# Check if the server script exists
if [ ! -f "$SERVER_SCRIPT" ]; then
  echo "ERROR: Dashboard server script not found: $SERVER_SCRIPT"
  exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js is required but not found"
  exit 1
fi

# Start the dashboard server
echo "Starting SAAR Dashboard..."
node "$SERVER_SCRIPT"
EOF

  # Make start script executable
  chmod +x "$TOOLS_DIR/dashboard/start-dashboard.sh"
  
  # Create a dashboard start script in the bin directory
  mkdir -p "$CONFIG_DIR/bin"
  cp "$TOOLS_DIR/dashboard/start-dashboard.sh" "$CONFIG_DIR/bin/"
  
  log "SUCCESS" "Dashboard Server created"
}

# Function to setup dashboard frontend
setup_dashboard_frontend() {
  log "INFO" "Setting up Dashboard Frontend..."
  
  # Create public directory
  mkdir -p "$TOOLS_DIR/dashboard/public"
  
  # Create index.html
  cat > "$TOOLS_DIR/dashboard/public/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SAAR Dashboard</title>
  
  <!-- Tailwind CSS via CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- Custom Styles -->
  <link rel="stylesheet" href="styles.css">
  
  <!-- Alpine.js -->
  <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
  
  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 min-h-screen">
  <div x-data="dashboard()" x-init="init()">
    <!-- Header -->
    <header class="bg-indigo-600 text-white shadow-lg">
      <div class="container mx-auto px-4 py-4 flex justify-between items-center">
        <div class="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" />
          </svg>
          <h1 class="text-2xl font-bold">SAAR Dashboard</h1>
        </div>
        
        <div class="flex items-center space-x-4">
          <button @click="toggleDarkMode" class="p-2 rounded-full hover:bg-indigo-700 transition-colors">
            <svg x-show="!darkMode" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            <svg x-show="darkMode" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>
          
          <button @click="refreshData" class="p-2 rounded-full hover:bg-indigo-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    </header>
    
    <!-- Main Content -->
    <main class="container mx-auto px-4 py-8">
      <!-- Status Overview -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">System Status</h3>
              <p class="text-3xl font-bold mt-2" :class="systemStatus ? 'text-green-500' : 'text-red-500'">
                <span x-text="systemStatus ? 'Running' : 'Offline'"></span>
              </p>
            </div>
            <div class="rounded-full p-3" :class="systemStatus ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" :class="systemStatus ? 'text-green-500' : 'text-red-500'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
        
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">MCP Servers</h3>
              <p class="text-3xl font-bold mt-2 text-blue-500">
                <span x-text="mcpServersRunning"></span>
              </p>
            </div>
            <div class="rounded-full p-3 bg-blue-100 dark:bg-blue-900">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
        
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">Workflows</h3>
              <p class="text-3xl font-bold mt-2 text-purple-500">
                <span x-text="workflows.length"></span>
              </p>
            </div>
            <div class="rounded-full p-3 bg-purple-100 dark:bg-purple-900">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
        
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">Memory Entries</h3>
              <p class="text-3xl font-bold mt-2 text-yellow-500">
                <span x-text="memoryEntries"></span>
              </p>
            </div>
            <div class="rounded-full p-3 bg-yellow-100 dark:bg-yellow-900">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      
      <!-- MCP Tools Section -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
        <h2 class="text-xl font-bold mb-4">MCP Tools</h2>
        
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tool Name</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fallback</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Last Check</th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              <template x-for="tool in mcpTools" :key="tool.name">
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white" x-text="tool.name"></td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                          :class="tool.available ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'"
                          x-text="tool.available ? 'Available' : 'Unavailable'"></span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <span x-text="tool.fallback_applied ? 'Applied' : 'None'"></span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400" x-text="formatDate(tool.last_checked)"></td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- Log Viewer -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
        <h2 class="text-xl font-bold mb-4">System Logs</h2>
        
        <div class="bg-gray-100 dark:bg-gray-900 rounded p-4 h-64 overflow-y-auto font-mono text-sm">
          <template x-for="(log, index) in logs" :key="index">
            <div :class="{
              'text-red-600 dark:text-red-400': log.level === 'ERROR',
              'text-yellow-600 dark:text-yellow-400': log.level === 'WARN',
              'text-green-600 dark:text-green-400': log.level === 'SUCCESS',
              'text-blue-600 dark:text-blue-400': log.level === 'INFO'
            }">
              <span class="text-gray-500 dark:text-gray-400" x-text="log.timestamp"></span>
              <span class="mx-2 font-bold" x-text="log.level"></span>
              <span x-text="log.message"></span>
            </div>
          </template>
        </div>
      </div>
      
      <!-- Workflows -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 class="text-xl font-bold mb-4">Cross-Tool Workflows</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <template x-for="workflow in workflows" :key="workflow.name">
            <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow">
              <h3 class="text-lg font-semibold mb-2" x-text="workflow.name"></h3>
              <p class="text-sm text-gray-600 dark:text-gray-300 mb-4" x-text="workflow.description"></p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">Steps: <span x-text="workflow.steps"></span></p>
              
              <button @click="runWorkflow(workflow.name)" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md transition-colors">
                Run Workflow
              </button>
            </div>
          </template>
        </div>
      </div>
    </main>
    
    <!-- Footer -->
    <footer class="bg-indigo-700 text-white py-4 mt-auto">
      <div class="container mx-auto px-4 text-center">
        <p>SAAR Dashboard v1.0.0 | Claude Neural Framework</p>
      </div>
    </footer>
  </div>
  
  <script>
    function dashboard() {
      return {
        // State
        darkMode: true,
        systemStatus: false,
        mcpServersRunning: 0,
        mcpTools: [],
        logs: [],
        workflows: [],
        memoryEntries: 0,
        
        // Initialization
        init() {
          // Set up dark mode
          this.darkMode = localStorage.getItem('darkMode') === 'true';
          this.applyDarkMode();
          
          // Load initial data
          this.refreshData();
          
          // Set up auto-refresh
          setInterval(() => this.refreshData(), 5000);
        },
        
        // Toggle dark mode
        toggleDarkMode() {
          this.darkMode = !this.darkMode;
          localStorage.setItem('darkMode', this.darkMode);
          this.applyDarkMode();
        },
        
        // Apply dark mode
        applyDarkMode() {
          if (this.darkMode) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        },
        
        // Refresh all data
        refreshData() {
          this.fetchSystemStatus();
          this.fetchMcpTools();
          this.fetchLogs();
          this.fetchWorkflows();
          this.fetchMemory();
        },
        
        // Fetch system status
        fetchSystemStatus() {
          fetch('/api/status')
            .then(response => response.json())
            .then(data => {
              this.systemStatus = data.workspace?.initialized || false;
              this.mcpServersRunning = data.mcp_servers?.running_count || 0;
            })
            .catch(err => console.error('Error fetching system status:', err));
        },
        
        // Fetch MCP tools
        fetchMcpTools() {
          fetch('/api/mcp/tools')
            .then(response => response.json())
            .then(data => {
              this.mcpTools = data;
            })
            .catch(err => console.error('Error fetching MCP tools:', err));
        },
        
        // Fetch logs
        fetchLogs() {
          fetch('/api/logs')
            .then(response => response.json())
            .then(data => {
              this.logs = data;
            })
            .catch(err => console.error('Error fetching logs:', err));
        },
        
        // Fetch workflows
        fetchWorkflows() {
          fetch('/api/workflows')
            .then(response => response.json())
            .then(data => {
              this.workflows = data;
            })
            .catch(err => console.error('Error fetching workflows:', err));
        },
        
        // Fetch memory
        fetchMemory() {
          fetch('/api/memory')
            .then(response => response.json())
            .then(data => {
              this.memoryEntries = data.entries?.length || 0;
            })
            .catch(err => console.error('Error fetching memory:', err));
        },
        
        // Run a workflow
        runWorkflow(name) {
          fetch('/api/workflows/run', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
          })
            .then(response => response.json())
            .then(data => {
              alert(data.success 
                ? `Workflow ${name} executed successfully!` 
                : `Error running workflow: ${data.error}`);
            })
            .catch(err => {
              console.error('Error running workflow:', err);
              alert(`Error running workflow: ${err.message}`);
            });
        },
        
        // Format date
        formatDate(dateString) {
          if (!dateString) return 'Never';
          
          const date = new Date(dateString);
          return date.toLocaleString();
        }
      };
    }
  </script>
</body>
</html>
EOF

  # Create styles.css
  cat > "$TOOLS_DIR/dashboard/public/styles.css" << 'EOF'
/* Dashboard custom styles */

/* Scrollbar styles */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.dark ::-webkit-scrollbar-track {
  background: #374151;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e0;
  border-radius: 4px;
}

.dark ::-webkit-scrollbar-thumb {
  background: #4b5563;
}

::-webkit-scrollbar-thumb:hover {
  background: #a0aec0;
}

.dark ::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}

/* Log viewer styles */
.log-viewer {
  font-family: 'Courier New', Courier, monospace;
}

/* Custom animations */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Custom transitions */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}
EOF

  log "SUCCESS" "Dashboard Frontend created"
}

# Function to setup dashboard API
setup_dashboard_api() {
  log "INFO" "Setting up Dashboard API..."
  
  # Create API directory
  mkdir -p "$TOOLS_DIR/dashboard/api"
  
  # We'll use the server.js file created earlier for the API implementation
  
  log "SUCCESS" "Dashboard API created"
}

# Run dashboard (for SAAR chain)
run_dashboard() {
  # Check if dashboard components are installed
  if [ ! -d "$TOOLS_DIR/dashboard" ]; then
    log "WARN" "Dashboard components not found. Installing..."
    setup_dashboard
  fi
  
  # Start the dashboard
  log "INFO" "Starting Dashboard..."
  
  if [ -f "$TOOLS_DIR/dashboard/start-dashboard.sh" ]; then
    "$TOOLS_DIR/dashboard/start-dashboard.sh"
  else
    log "ERROR" "Dashboard start script not found"
    return 1
  fi
}