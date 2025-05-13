#!/usr/bin/env node

/**
 * Dashboard Visualization Extension
 * 
 * Provides enhanced visualizations for SAAR dashboard including:
 * - Workflow execution visualization
 * - DeepThink thought connections
 * - MCP tool status monitoring
 * - Memory statistics and categorization
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const CONFIG_DIR = process.env.HOME + '/.claude';
const DASHBOARD_DIR = path.join(CONFIG_DIR, 'tools', 'dashboard');
const VISUALIZATION_DIR = path.join(DASHBOARD_DIR, 'visualizations');
const MEMORY_DIR = path.join(CONFIG_DIR, 'memory');
const MCP_CONFIG_DIR = path.join(CONFIG_DIR, 'mcp');

// Ensure visualization directory exists
if (!fs.existsSync(VISUALIZATION_DIR)) {
  fs.mkdirSync(VISUALIZATION_DIR, { recursive: true });
}

// Load memory module if available
let memory;
try {
  const memoryPath = path.join(CONFIG_DIR, 'saar', 'startup', 'memory_persistence.js');
  memory = require(memoryPath);
  console.log('Memory module loaded successfully');
} catch (err) {
  console.warn(`Memory module not found: ${err.message}`);
  memory = null;
}

// Dashboard Visualization Class
class DashboardVisualization {
  constructor(options = {}) {
    this.options = {
      useMemory: true,
      outputDir: VISUALIZATION_DIR,
      ...options
    };
    
    // Create timestamp
    this.timestamp = new Date().toISOString().replace(/:/g, '-');
  }
  
  // Generate workflow execution visualization
  async generateWorkflowVisualization(workflowName) {
    console.log(`Generating visualization for workflow: ${workflowName}`);
    
    // Find the most recent workflow result
    const resultsDir = path.join(MCP_CONFIG_DIR, 'results');
    
    if (!fs.existsSync(resultsDir)) {
      console.error(`Results directory not found: ${resultsDir}`);
      return null;
    }
    
    const files = fs.readdirSync(resultsDir)
      .filter(file => file.startsWith(`${workflowName}-`) && file.endsWith('.json'))
      .sort()
      .reverse();
      
    if (files.length === 0) {
      console.error(`No results found for workflow: ${workflowName}`);
      return null;
    }
    
    const resultFile = path.join(resultsDir, files[0]);
    let workflowResult;
    
    try {
      workflowResult = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
    } catch (err) {
      console.error(`Error reading workflow result: ${err.message}`);
      return null;
    }
    
    // Generate HTML visualization
    const outputFile = path.join(this.options.outputDir, `workflow-${workflowName}-${this.timestamp}.html`);
    
    // Create HTML content
    let htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Workflow Visualization: ${workflowName}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
      color: #333;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background-color: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    h1, h2, h3 {
      color: #4f46e5;
    }
    
    .workflow-summary {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    }
    
    .workflow-summary > div {
      flex: 1;
      padding: 10px;
    }
    
    .step-card {
      border: 1px solid #ddd;
      border-radius: 6px;
      margin-bottom: 15px;
      padding: 15px;
      background-color: #f9f9f9;
      transition: all 0.2s ease;
    }
    
    .step-card:hover {
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    
    .step-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .step-name {
      font-weight: bold;
      color: #4f46e5;
    }
    
    .step-type {
      background-color: #e5e7eb;
      color: #4b5563;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.8em;
    }
    
    .chart-container {
      height: 300px;
      margin: 20px 0;
    }
    
    .execution-time {
      font-weight: bold;
    }
    
    .output-preview {
      background-color: #f3f4f6;
      padding: 10px;
      border-radius: 4px;
      font-family: monospace;
      max-height: 200px;
      overflow-y: auto;
      margin-top: 10px;
    }
    
    .timeline {
      margin: 30px 0;
      position: relative;
      height: 80px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Workflow Visualization: ${workflowName}</h1>
    
    <div class="workflow-summary">
      <div>
        <h3>Summary</h3>
        <p><strong>Execution Time:</strong> ${workflowResult.executionTimeMs / 1000} seconds</p>
        <p><strong>Steps:</strong> ${Object.keys(workflowResult.results || {}).length}</p>
        <p><strong>Started:</strong> ${new Date(workflowResult.startTime).toLocaleString()}</p>
      </div>
      <div>
        <h3>Parameters</h3>
        <ul>
          ${Object.entries(workflowResult.params || {}).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('')}
        </ul>
      </div>
    </div>
    
    <h2>Timeline</h2>
    <div class="timeline">
      <canvas id="timelineChart"></canvas>
    </div>
    
    <h2>Step Details</h2>
    ${Object.entries(workflowResult.results || {}).map(([stepName, result]) => `
      <div class="step-card">
        <div class="step-header">
          <div class="step-name">${stepName}</div>
          <div class="step-type">${result.type || 'unknown'}</div>
        </div>
        <div class="step-content">
          <div class="output-preview">${this.formatStepOutput(result)}</div>
        </div>
      </div>
    `).join('')}
  </div>
  
  <script>
    // Timeline chart
    const timelineCtx = document.getElementById('timelineChart').getContext('2d');
    const stepNames = ${JSON.stringify(Object.keys(workflowResult.results || {}))};
    const executionTimes = ${JSON.stringify(Object.values(workflowResult.results || {}).map(r => r.executionTimeMs || 0))};
    
    new Chart(timelineCtx, {
      type: 'bar',
      data: {
        labels: stepNames,
        datasets: [{
          label: 'Execution Time (ms)',
          data: executionTimes,
          backgroundColor: '#8b5cf6',
          borderColor: '#7c3aed',
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Execution Time (ms)'
            }
          }
        }
      }
    });
  </script>
</body>
</html>
    `;
    
    // Save the HTML file
    fs.writeFileSync(outputFile, htmlContent);
    
    console.log(`Workflow visualization saved to: ${outputFile}`);
    
    return {
      outputFile,
      workflowName,
      executionTimeMs: workflowResult.executionTimeMs
    };
  }
  
  // Format step output for display
  formatStepOutput(result) {
    if (!result) return 'No result';
    
    try {
      if (typeof result === 'string') {
        return result.substring(0, 500) + (result.length > 500 ? '...' : '');
      }
      
      if (result.stdout) {
        return result.stdout.substring(0, 500) + (result.stdout.length > 500 ? '...' : '');
      }
      
      if (result.thought) {
        return result.thought.substring(0, 500) + (result.thought.length > 500 ? '...' : '');
      }
      
      return JSON.stringify(result, null, 2).substring(0, 500) + '...';
    } catch (err) {
      return `Error formatting output: ${err.message}`;
    }
  }
  
  // Generate memory visualization
  async generateMemoryVisualization() {
    if (!memory) {
      console.error('Memory module not available');
      return null;
    }
    
    console.log('Generating memory visualization');
    
    // Get memory statistics
    const stats = memory.getMemoryStats();
    
    // Generate HTML visualization
    const outputFile = path.join(this.options.outputDir, `memory-${this.timestamp}.html`);
    
    // Create HTML content
    let htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Memory System Visualization</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
      color: #333;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background-color: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    h1, h2, h3 {
      color: #4f46e5;
    }
    
    .memory-summary {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    }
    
    .memory-summary > div {
      flex: 1;
      padding: 10px;
    }
    
    .chart-container {
      height: 300px;
      margin: 20px 0;
    }
    
    .category-card {
      border: 1px solid #ddd;
      border-radius: 6px;
      margin-bottom: 15px;
      padding: 15px;
      background-color: #f9f9f9;
      transition: all 0.2s ease;
    }
    
    .category-card:hover {
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Memory System Visualization</h1>
    
    <div class="memory-summary">
      <div>
        <h3>Summary</h3>
        <p><strong>Total Thoughts:</strong> ${stats.total_thoughts}</p>
        <p><strong>Last Updated:</strong> ${new Date(stats.last_updated).toLocaleString()}</p>
        <p><strong>Oldest Thought:</strong> ${stats.oldest_thought ? new Date(stats.oldest_thought).toLocaleString() : 'None'}</p>
        <p><strong>Newest Thought:</strong> ${stats.newest_thought ? new Date(stats.newest_thought).toLocaleString() : 'None'}</p>
      </div>
    </div>
    
    <h2>Categories</h2>
    <div class="chart-container">
      <canvas id="categoriesChart"></canvas>
    </div>
    
    <h2>Category Details</h2>
    ${stats.categories ? stats.categories.map(category => `
      <div class="category-card">
        <h3>${category.name}</h3>
        <p>${category.description}</p>
        <p><strong>Thoughts:</strong> ${category.count}</p>
      </div>
    `).join('') : '<p>No categories found</p>'}
  </div>
  
  <script>
    // Categories chart
    const categoriesCtx = document.getElementById('categoriesChart').getContext('2d');
    const categoryNames = ${JSON.stringify(stats.categories ? stats.categories.map(c => c.name) : [])};
    const categoryCounts = ${JSON.stringify(stats.categories ? stats.categories.map(c => c.count) : [])};
    
    new Chart(categoriesCtx, {
      type: 'pie',
      data: {
        labels: categoryNames,
        datasets: [{
          data: categoryCounts,
          backgroundColor: [
            '#a78bfa',
            '#60a5fa',
            '#34d399',
            '#fbbf24',
            '#f87171'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
          }
        }
      }
    });
  </script>
</body>
</html>
    `;
    
    // Save the HTML file
    fs.writeFileSync(outputFile, htmlContent);
    
    console.log(`Memory visualization saved to: ${outputFile}`);
    
    return {
      outputFile,
      stats
    };
  }
  
  // Generate MCP tools status visualization
  async generateToolsVisualization() {
    console.log('Generating MCP tools visualization');
    
    // Get tools status from cache
    const toolsCache = path.join(MCP_CONFIG_DIR, 'cache', 'tools_cache.json');
    let toolsStatus = {};
    
    if (fs.existsSync(toolsCache)) {
      try {
        toolsStatus = JSON.parse(fs.readFileSync(toolsCache, 'utf8'));
      } catch (err) {
        console.error(`Error reading tools cache: ${err.message}`);
      }
    }
    
    // Generate HTML visualization
    const outputFile = path.join(this.options.outputDir, `mcp-tools-${this.timestamp}.html`);
    
    // Create HTML content
    let htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Tools Visualization</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
      color: #333;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background-color: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    h1, h2, h3 {
      color: #4f46e5;
    }
    
    .tools-summary {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    }
    
    .tools-summary > div {
      flex: 1;
      padding: 10px;
    }
    
    .chart-container {
      height: 300px;
      margin: 20px 0;
    }
    
    .tool-card {
      border: 1px solid #ddd;
      border-radius: 6px;
      margin-bottom: 15px;
      padding: 15px;
      background-color: #f9f9f9;
      transition: all 0.2s ease;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .tool-card:hover {
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    
    .tool-name {
      font-weight: bold;
    }
    
    .tool-status {
      padding: 5px 10px;
      border-radius: 20px;
      font-size: 0.8em;
      font-weight: bold;
    }
    
    .status-available {
      background-color: #d1fae5;
      color: #065f46;
    }
    
    .status-unavailable {
      background-color: #fee2e2;
      color: #b91c1c;
    }
    
    .status-fallback {
      background-color: #fef3c7;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>MCP Tools Visualization</h1>
    
    <div class="tools-summary">
      <div>
        <h3>Summary</h3>
        <p><strong>Total Tools:</strong> ${Object.keys(toolsStatus).length}</p>
        <p><strong>Available Tools:</strong> ${Object.values(toolsStatus).filter(t => t.available).length}</p>
        <p><strong>Using Fallbacks:</strong> ${Object.values(toolsStatus).filter(t => t.fallbackApplied).length}</p>
      </div>
      <div class="chart-container">
        <canvas id="toolsChart"></canvas>
      </div>
    </div>
    
    <h2>Tool Details</h2>
    ${Object.entries(toolsStatus).map(([name, status]) => `
      <div class="tool-card">
        <div class="tool-info">
          <div class="tool-name">${name}</div>
          <div class="tool-last-check">Last checked: ${new Date(status.lastChecked).toLocaleString()}</div>
          ${status.reason ? `<div class="tool-reason">Reason: ${status.reason}</div>` : ''}
        </div>
        <div class="tool-status ${status.available ? 'status-available' : 'status-unavailable'} ${status.fallbackApplied ? 'status-fallback' : ''}">
          ${status.available ? 'Available' : 'Unavailable'}${status.fallbackApplied ? ' (Fallback)' : ''}
        </div>
      </div>
    `).join('')}
  </div>
  
  <script>
    // Tools chart
    const toolsCtx = document.getElementById('toolsChart').getContext('2d');
    
    // Count tools by status
    const availableNoFallback = ${Object.values(toolsStatus).filter(t => t.available && !t.fallbackApplied).length};
    const availableWithFallback = ${Object.values(toolsStatus).filter(t => t.available && t.fallbackApplied).length};
    const unavailable = ${Object.values(toolsStatus).filter(t => !t.available).length};
    
    new Chart(toolsCtx, {
      type: 'doughnut',
      data: {
        labels: ['Available', 'Using Fallback', 'Unavailable'],
        datasets: [{
          data: [availableNoFallback, availableWithFallback, unavailable],
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  </script>
</body>
</html>
    `;
    
    // Save the HTML file
    fs.writeFileSync(outputFile, htmlContent);
    
    console.log(`MCP tools visualization saved to: ${outputFile}`);
    
    return {
      outputFile,
      toolsCount: Object.keys(toolsStatus).length,
      availableTools: Object.values(toolsStatus).filter(t => t.available).length,
      fallbackTools: Object.values(toolsStatus).filter(t => t.fallbackApplied).length
    };
  }
  
  // Generate all visualizations
  async generateAllVisualizations() {
    const results = {
      tools: await this.generateToolsVisualization(),
      memory: await this.generateMemoryVisualization()
    };
    
    // Get available workflows
    const workflowsDir = path.join(MCP_CONFIG_DIR, 'workflows');
    if (fs.existsSync(workflowsDir)) {
      const workflowFiles = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.json'));
      
      for (const file of workflowFiles) {
        const workflowName = path.basename(file, '.json');
        results[workflowName] = await this.generateWorkflowVisualization(workflowName);
      }
    }
    
    // Create index file
    const indexFile = path.join(this.options.outputDir, 'index.html');
    
    let indexContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SAAR Dashboard Visualizations</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
      color: #333;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background-color: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    h1, h2, h3 {
      color: #4f46e5;
    }
    
    .visualization-card {
      border: 1px solid #ddd;
      border-radius: 6px;
      margin-bottom: 15px;
      padding: 15px;
      background-color: #f9f9f9;
      transition: all 0.2s ease;
    }
    
    .visualization-card:hover {
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .card-title {
      font-weight: bold;
      color: #4f46e5;
    }
    
    .card-actions a {
      display: inline-block;
      padding: 5px 10px;
      background-color: #4f46e5;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 0.9em;
    }
    
    .card-actions a:hover {
      background-color: #4338ca;
    }
    
    .card-content {
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>SAAR Dashboard Visualizations</h1>
    <p>Generated on: ${new Date().toLocaleString()}</p>
    
    <h2>System Visualizations</h2>
    
    ${results.tools ? `
    <div class="visualization-card">
      <div class="card-header">
        <div class="card-title">MCP Tools Status</div>
        <div class="card-actions">
          <a href="${path.basename(results.tools.outputFile)}">View</a>
        </div>
      </div>
      <div class="card-content">
        <p>Tools: ${results.tools.toolsCount}, Available: ${results.tools.availableTools}, Using Fallbacks: ${results.tools.fallbackTools}</p>
      </div>
    </div>
    ` : ''}
    
    ${results.memory ? `
    <div class="visualization-card">
      <div class="card-header">
        <div class="card-title">Memory System</div>
        <div class="card-actions">
          <a href="${path.basename(results.memory.outputFile)}">View</a>
        </div>
      </div>
      <div class="card-content">
        <p>Total Thoughts: ${results.memory.stats.total_thoughts}, Categories: ${results.memory.stats.categories ? results.memory.stats.categories.length : 0}</p>
      </div>
    </div>
    ` : ''}
    
    <h2>Workflow Visualizations</h2>
    
    ${Object.entries(results)
      .filter(([key, value]) => key !== 'tools' && key !== 'memory' && value)
      .map(([key, value]) => `
      <div class="visualization-card">
        <div class="card-header">
          <div class="card-title">Workflow: ${key}</div>
          <div class="card-actions">
            <a href="${path.basename(value.outputFile)}">View</a>
          </div>
        </div>
        <div class="card-content">
          <p>Execution Time: ${value.executionTimeMs ? `${value.executionTimeMs / 1000} seconds` : 'Unknown'}</p>
        </div>
      </div>
    `).join('')}
  </div>
</body>
</html>
    `;
    
    fs.writeFileSync(indexFile, indexContent);
    
    console.log(`Generated all visualizations. Index available at: ${indexFile}`);
    
    return {
      indexFile,
      visualizations: results
    };
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  
  const visualization = new DashboardVisualization();
  
  try {
    switch (command) {
      case 'workflow':
        if (args.length < 2) {
          console.error('Workflow name required');
          console.error('Usage: dashboard_visualization.js workflow <workflow_name>');
          process.exit(1);
        }
        
        await visualization.generateWorkflowVisualization(args[1]);
        break;
        
      case 'memory':
        await visualization.generateMemoryVisualization();
        break;
        
      case 'tools':
        await visualization.generateToolsVisualization();
        break;
        
      case 'all':
        await visualization.generateAllVisualizations();
        break;
        
      default:
        console.error('Unknown command:', command);
        console.error('Usage: dashboard_visualization.js [all|workflow|memory|tools]');
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

// Export the DashboardVisualization class for use in other modules
module.exports = { DashboardVisualization };

// Run main function if this script is executed directly
if (require.main === module) {
  main();
}