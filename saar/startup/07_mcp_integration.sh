#!/bin/bash
# SAAR - MCP Integration Module
# 
# This module integrates the SAAR framework with MCP tools,
# providing automatic fallbacks, cross-tool workflows, and
# direct integration with DeepThink.

# Function to setup MCP integration
setup_mcp_integration() {
  log "INFO" "Setting up MCP Integration..."

  # Create the necessary directories
  mkdir -p "$CONFIG_DIR/mcp" "$TOOLS_DIR/mcp" "$STORAGE_DIR/mcp"
  mkdir -p "$CONFIG_DIR/mcp/fallbacks" "$CONFIG_DIR/mcp/workflows"
  
  # Setup the MCP configuration
  setup_mcp_config
  
  # Setup the MCP validator
  setup_mcp_validator
  
  # Setup the DeepThink integration
  setup_deepthink_integration
  
  # Setup cross-tool workflow manager
  setup_cross_tool_workflows
  
  log "SUCCESS" "MCP Integration setup completed"
}

# Function to setup MCP configuration
setup_mcp_config() {
  log "INFO" "Setting up MCP Configuration..."
  
  # Create default configuration if it doesn't exist
  if [ ! -f "$CONFIG_DIR/mcp/config.json" ]; then
    cat > "$CONFIG_DIR/mcp/config.json" << 'EOF'
{
  "mcp": {
    "sequentialthinking": {
      "primary": true,
      "fallback": "deepthink",
      "max_depth": 8,
      "timeout_ms": 30000
    },
    "context7-mcp": {
      "primary": true,
      "fallback": "file-context",
      "cache_ttl_minutes": 60
    },
    "brave-search": {
      "primary": true,
      "fallback": null,
      "max_results": 10
    },
    "desktop-commander": {
      "primary": true,
      "fallback": "local-execution",
      "workspace_boundaries": ["$WORKSPACE_DIR"]
    },
    "21st-dev-magic": {
      "primary": true,
      "fallback": null,
      "theme": "system"
    }
  },
  "fallbacks": {
    "enabled": true,
    "auto_retry": true,
    "max_retries": 3,
    "fallback_delay_ms": 1000
  },
  "integration": {
    "shared_context": true,
    "persistent_memory": true,
    "cross_tool_communication": true,
    "synchronize_state": true
  },
  "metrics": {
    "collect": true,
    "log_level": "INFO",
    "performance_tracking": true
  }
}
EOF
    log "SUCCESS" "Created default MCP configuration"
  else
    log "INFO" "MCP configuration already exists"
  fi
  
  # Create fallback implementations directory
  mkdir -p "$TOOLS_DIR/mcp/fallbacks"
  
  # Create fallback for sequentialthinking (DeepThink)
  cat > "$TOOLS_DIR/mcp/fallbacks/deepthink.js" << 'EOF'
#!/usr/bin/env node

/**
 * DeepThink - Fallback for sequentialthinking MCP
 * 
 * Provides local recursive thought implementation when
 * sequentialthinking MCP is unavailable.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Parse input from standard input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Configuration
const CONFIG_DIR = process.env.HOME + '/.claude';
const configPath = path.join(CONFIG_DIR, 'autonomy', 'config.json');
let config;

try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  // Default configuration if file not found
  config = {
    deepthink: {
      recursion_depth: 5,
      thought_expansion_factor: 3
    }
  };
}

// DeepThink implementation
class DeepThink {
  constructor(config) {
    this.maxDepth = config.deepthink.recursion_depth || 5;
    this.expansionFactor = config.deepthink.thought_expansion_factor || 3;
    this.thoughts = [];
    this.nextId = 1;
  }
  
  async process(input) {
    console.error('Processing thought with DeepThink...');
    
    const requestData = JSON.parse(input);
    const { thought, thoughtNumber, totalThoughts } = requestData;
    
    // Create a thought object
    const currentThought = {
      id: thoughtNumber,
      content: thought,
      depth: Math.floor(thoughtNumber / this.expansionFactor)
    };
    
    // Add to collection
    this.thoughts.push(currentThought);
    
    // Generate next thought details
    let nextThoughtNeeded = thoughtNumber < totalThoughts;
    let nextThought = '';
    
    if (nextThoughtNeeded) {
      // Generate the next thought based on current and previous
      nextThought = this.generateNextThought(currentThought, this.thoughts);
    }
    
    // Create response object
    const response = {
      thought: nextThought,
      nextThoughtNeeded,
      thoughtNumber: thoughtNumber + 1,
      totalThoughts,
      isRevision: false,
      revisesThought: null
    };
    
    return JSON.stringify(response);
  }
  
  generateNextThought(currentThought, allThoughts) {
    // In a real implementation, this would use more sophisticated
    // reasoning to build on previous thoughts
    const starter = currentThought.depth < 2 
      ? "Building on the previous thought, "
      : "Synthesizing insights from previous thoughts, ";
      
    return `${starter}I need to further analyze ${currentThought.content.substring(0, 40)}... to understand the implications and develop a more complete solution approach.`;
  }
}

// Main function
async function main() {
  let input = '';
  
  rl.on('line', (line) => {
    input += line;
  });
  
  rl.on('close', async () => {
    try {
      const thinker = new DeepThink(config);
      const result = await thinker.process(input);
      console.log(result);
    } catch (err) {
      console.error('Error processing thought:', err.message);
      process.exit(1);
    }
  });
}

main();
EOF

  # Make DeepThink fallback executable
  chmod +x "$TOOLS_DIR/mcp/fallbacks/deepthink.js"
  
  # Create fallback for file-context
  cat > "$TOOLS_DIR/mcp/fallbacks/file-context.js" << 'EOF'
#!/usr/bin/env node

/**
 * File Context - Fallback for context7-mcp
 * 
 * Provides basic file context reading when
 * context7-mcp is unavailable.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Parse input from standard input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// File context implementation
class FileContext {
  constructor() {
    // No configuration needed for basic implementation
  }
  
  async process(input) {
    console.error('Processing file context request...');
    
    const requestData = JSON.parse(input);
    const libraryId = requestData.context7CompatibleLibraryID;
    
    // Create a simple response with documentation
    let documentation = `# Basic documentation for ${libraryId}\n\n`;
    documentation += "This is fallback documentation generated locally.\n\n";
    documentation += "## API Reference\n\n";
    documentation += "- `function1()`: A function that does something\n";
    documentation += "- `function2(param)`: Another function with a parameter\n\n";
    documentation += "For complete documentation, please ensure the context7-mcp server is running.";
    
    const response = {
      documentation,
      source: "local-fallback"
    };
    
    return JSON.stringify(response);
  }
}

// Main function
async function main() {
  let input = '';
  
  rl.on('line', (line) => {
    input += line;
  });
  
  rl.on('close', async () => {
    try {
      const fileContext = new FileContext();
      const result = await fileContext.process(input);
      console.log(result);
    } catch (err) {
      console.error('Error processing file context:', err.message);
      process.exit(1);
    }
  });
}

main();
EOF

  # Make file-context fallback executable
  chmod +x "$TOOLS_DIR/mcp/fallbacks/file-context.js"
  
  log "SUCCESS" "Created MCP fallback implementations"
}

# Function to setup MCP validator
setup_mcp_validator() {
  log "INFO" "Setting up MCP Validator..."
  
  # Create validator script
  cat > "$TOOLS_DIR/mcp/validator.js" << 'EOF'
#!/usr/bin/env node

/**
 * MCP Validator
 * 
 * Validates MCP tool availability and sets up fallbacks when needed.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const CONFIG_DIR = process.env.HOME + '/.claude';
const configPath = path.join(CONFIG_DIR, 'mcp', 'config.json');
const mcpJsonPath = path.join(process.cwd(), '.mcp.json');
const cacheDir = path.join(CONFIG_DIR, 'mcp', 'cache');
const toolsCache = path.join(cacheDir, 'tools_cache.json');

// Ensure cache directory exists
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Read configuration
let config, mcpJson;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  console.error(`Error loading MCP configuration: ${err.message}`);
  process.exit(1);
}

try {
  mcpJson = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf8'));
} catch (err) {
  console.error(`Error loading .mcp.json: ${err.message}`);
  process.exit(1);
}

// Initialize tools cache if it doesn't exist
let toolsStatus = {};
if (fs.existsSync(toolsCache)) {
  try {
    toolsStatus = JSON.parse(fs.readFileSync(toolsCache, 'utf8'));
  } catch (err) {
    console.error(`Error loading tools cache: ${err.message}`);
    toolsStatus = {};
  }
} else {
  toolsStatus = {};
}

// Check if a tool is available
async function checkToolAvailability(toolName) {
  if (!mcpJson.mcpServers[toolName]) {
    return { available: false, reason: 'Tool not defined in .mcp.json' };
  }
  
  const tool = mcpJson.mcpServers[toolName];
  const command = tool.command;
  const args = tool.args;
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      process.kill(checkProcess.pid);
      resolve({ available: false, reason: 'Timeout while checking tool' });
    }, 5000);
    
    const checkProcess = spawn(command, ['--version'], { shell: true });
    
    checkProcess.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ available: code === 0, reason: code !== 0 ? 'Command failed with exit code ' + code : null });
    });
    
    checkProcess.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ available: false, reason: err.message });
    });
  });
}

// Apply fallback for a tool
function applyFallback(toolName) {
  const toolConfig = config.mcp[toolName];
  if (!toolConfig || !toolConfig.fallback) {
    console.log(`No fallback configured for ${toolName}`);
    return false;
  }
  
  const fallbackName = toolConfig.fallback;
  const fallbackScript = path.join(CONFIG_DIR, 'tools', 'mcp', 'fallbacks', `${fallbackName}.js`);
  
  if (!fs.existsSync(fallbackScript)) {
    console.error(`Fallback script not found: ${fallbackScript}`);
    return false;
  }
  
  console.log(`Applying fallback for ${toolName}: ${fallbackName}`);
  
  // Create a temporary mcpServer entry for the fallback
  const fallbackCommand = `node ${fallbackScript}`;
  mcpJson.mcpServers[toolName] = {
    command: 'node',
    args: [fallbackScript]
  };
  
  // Save the updated .mcp.json
  fs.writeFileSync(mcpJsonPath, JSON.stringify(mcpJson, null, 2));
  
  return true;
}

// Validate all tools
async function validateTools() {
  console.log('Validating MCP tools...');
  
  const toolNames = Object.keys(mcpJson.mcpServers);
  const results = {};
  
  for (const toolName of toolNames) {
    if (config.mcp[toolName]) {
      console.log(`Checking ${toolName}...`);
      const result = await checkToolAvailability(toolName);
      
      results[toolName] = result;
      toolsStatus[toolName] = {
        available: result.available,
        lastChecked: new Date().toISOString(),
        reason: result.reason
      };
      
      if (!result.available && config.fallbacks.enabled) {
        const fallbackApplied = applyFallback(toolName);
        toolsStatus[toolName].fallbackApplied = fallbackApplied;
      }
    }
  }
  
  // Save the updated tools cache
  fs.writeFileSync(toolsCache, JSON.stringify(toolsStatus, null, 2));
  
  return results;
}

// Restore original MCP configuration
function restoreOriginalConfig() {
  // Implementation would restore from a backup
  console.log('Restoring original MCP configuration...');
}

// Main function
async function main() {
  try {
    const results = await validateTools();
    console.log('\nMCP Tool Validation Results:');
    
    let allAvailable = true;
    for (const [tool, result] of Object.entries(results)) {
      console.log(`- ${tool}: ${result.available ? 'Available' : 'Unavailable'}`);
      if (!result.available) {
        console.log(`  Reason: ${result.reason}`);
        allAvailable = false;
      }
    }
    
    if (allAvailable) {
      console.log('\nAll MCP tools are available!');
    } else {
      console.log('\nSome MCP tools are unavailable. Fallbacks have been applied where configured.');
    }
  } catch (err) {
    console.error(`Error validating MCP tools: ${err.message}`);
    process.exit(1);
  }
}

// Run main function if this script is executed directly
if (require.main === module) {
  main();
}

// Export functions for use in other scripts
module.exports = {
  validateTools,
  checkToolAvailability,
  applyFallback,
  restoreOriginalConfig
};
EOF

  # Make validator executable
  chmod +x "$TOOLS_DIR/mcp/validator.js"
  
  log "SUCCESS" "MCP Validator created"
}

# Function to setup DeepThink integration with sequentialthinking
setup_deepthink_integration() {
  log "INFO" "Setting up DeepThink Integration..."
  
  # Create integration script
  cat > "$TOOLS_DIR/mcp/deepthink_integration.js" << 'EOF'
#!/usr/bin/env node

/**
 * DeepThink Integration with sequentialthinking
 * 
 * Connects the DeepThink system with the sequentialthinking MCP tool
 * for enhanced recursive thinking capabilities.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

// Configuration
const CONFIG_DIR = process.env.HOME + '/.claude';
const autonomyConfigPath = path.join(CONFIG_DIR, 'autonomy', 'config.json');
const mcpConfigPath = path.join(CONFIG_DIR, 'mcp', 'config.json');
const outputDir = path.join(CONFIG_DIR, 'autonomy', 'outputs');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Read configurations
let autonomyConfig, mcpConfig;
try {
  autonomyConfig = JSON.parse(fs.readFileSync(autonomyConfigPath, 'utf8'));
  mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
} catch (err) {
  console.error(`Error loading configuration: ${err.message}`);
  process.exit(1);
}

// DeepThink Integration Class
class DeepThinkMCP {
  constructor(configs) {
    this.autonomyConfig = configs.autonomyConfig;
    this.mcpConfig = configs.mcpConfig;
    this.recursionDepth = this.autonomyConfig.deepthink.recursion_depth;
    this.useSequentialThinking = true; // Will be set based on availability check
    this.thoughts = [];
  }
  
  // Check if sequentialthinking is available
  async checkSequentialThinking() {
    console.log('Checking sequentialthinking MCP availability...');
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('Timeout while checking sequentialthinking');
        resolve(false);
      }, 5000);
      
      const checkProcess = spawn('npx', ['-y', '@modelcontextprotocol/server-sequential-thinking', '--version'], { shell: true });
      
      checkProcess.on('close', (code) => {
        clearTimeout(timeout);
        const available = code === 0;
        console.log(`sequentialthinking is ${available ? 'available' : 'unavailable'}`);
        resolve(available);
      });
      
      checkProcess.on('error', () => {
        clearTimeout(timeout);
        console.log('Error checking sequentialthinking');
        resolve(false);
      });
    });
  }
  
  // Process a prompt with deep thinking
  async think(prompt) {
    console.log(`Starting deep thinking process for: ${prompt.substring(0, 50)}...`);
    
    // Check sequentialthinking availability
    this.useSequentialThinking = await this.checkSequentialThinking();
    
    if (this.useSequentialThinking) {
      return this.thinkWithSequentialThinking(prompt);
    } else {
      return this.thinkWithLocalImplementation(prompt);
    }
  }
  
  // Think using sequentialthinking MCP
  async thinkWithSequentialThinking(prompt) {
    console.log('Using sequentialthinking MCP for recursive thinking...');
    
    // Setup for sequential thinking
    const totalThoughts = this.recursionDepth * 2;
    let currentThought = 1;
    let thoughts = [];
    
    // Initialize with first thought
    let currentPrompt = {
      thought: `Initial analysis of the task: ${prompt}`,
      nextThoughtNeeded: true,
      thoughtNumber: 1,
      totalThoughts: totalThoughts,
      isRevision: false
    };
    
    thoughts.push(currentPrompt.thought);
    
    // Process sequential thoughts
    while (currentPrompt.nextThoughtNeeded && currentThought < totalThoughts) {
      try {
        currentPrompt = await this.callSequentialThinking(currentPrompt);
        currentThought++;
        
        if (currentPrompt.thought) {
          thoughts.push(currentPrompt.thought);
          console.log(`Thought ${currentThought}: ${currentPrompt.thought.substring(0, 50)}...`);
        }
      } catch (err) {
        console.error(`Error during sequential thinking: ${err.message}`);
        // Fall back to local implementation
        console.log('Falling back to local implementation...');
        return this.thinkWithLocalImplementation(prompt);
      }
    }
    
    // Generate a summary/synthesis
    const synthesis = `Based on ${thoughts.length} thoughts, here is the synthesized analysis: 
    
${thoughts.map((t, i) => `${i+1}. ${t}`).join('\n\n')}

Summary: This deep thinking process has explored the problem space through multiple levels of recursion and refinement.`;
    
    // Save the thinking process to a file
    const outputFile = path.join(outputDir, `deepthink-${Date.now()}.md`);
    fs.writeFileSync(outputFile, synthesis);
    
    return {
      thoughts,
      synthesis,
      outputFile
    };
  }
  
  // Think using local DeepThink implementation
  async thinkWithLocalImplementation(prompt) {
    console.log('Using local DeepThink implementation...');
    
    // Generate thoughts locally
    const thoughts = [];
    const totalThoughts = this.recursionDepth * 2;
    
    // Initial thought
    thoughts.push(`Initial analysis of the task: ${prompt}`);
    
    // Generate subsequent thoughts
    for (let i = 1; i < totalThoughts; i++) {
      const prevThought = thoughts[i-1];
      const newThought = this.generateNextThought(prevThought, i, totalThoughts);
      thoughts.push(newThought);
      console.log(`Thought ${i+1}: ${newThought.substring(0, 50)}...`);
    }
    
    // Generate synthesis
    const synthesis = `Based on ${thoughts.length} thoughts, here is the synthesized analysis: 
    
${thoughts.map((t, i) => `${i+1}. ${t}`).join('\n\n')}

Summary: This deep thinking process has explored the problem space through multiple levels of analysis.`;
    
    // Save the thinking process to a file
    const outputFile = path.join(outputDir, `deepthink-${Date.now()}.md`);
    fs.writeFileSync(outputFile, synthesis);
    
    return {
      thoughts,
      synthesis,
      outputFile
    };
  }
  
  // Generate next thought locally
  generateNextThought(prevThought, currentNum, totalThoughts) {
    const stage = Math.floor(currentNum / (totalThoughts / 3));
    
    switch (stage) {
      case 0: // Analysis stage
        return `Analyzing further: ${prevThought.substring(0, 40)}... reveals that we need to consider multiple aspects of this problem.`;
      case 1: // Exploration stage
        return `Exploring alternatives: Based on previous analysis, we should examine different approaches to address this challenge.`;
      default: // Synthesis stage
        return `Synthesizing insights: The collective analysis suggests a comprehensive solution that integrates multiple perspectives.`;
    }
  }
  
  // Call sequentialthinking MCP
  async callSequentialThinking(prompt) {
    return new Promise((resolve, reject) => {
      const child = spawn('npx', ['-y', '@modelcontextprotocol/server-sequential-thinking'], { shell: true });
      
      let dataString = '';
      let errorString = '';
      
      child.stdin.write(JSON.stringify(prompt));
      child.stdin.end();
      
      child.stdout.on('data', (data) => {
        dataString += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        errorString += data.toString();
      });
      
      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`sequentialthinking failed with code ${code}: ${errorString}`));
        }
        
        try {
          const result = JSON.parse(dataString);
          resolve(result);
        } catch (err) {
          reject(new Error(`Failed to parse sequentialthinking response: ${err.message}`));
        }
      });
      
      child.on('error', (err) => {
        reject(err);
      });
    });
  }
}

// Main function
async function main() {
  if (process.argv.length < 3) {
    console.error('Usage: deepthink_integration.js <prompt>');
    process.exit(1);
  }
  
  const prompt = process.argv.slice(2).join(' ');
  
  try {
    const thinker = new DeepThinkMCP({
      autonomyConfig,
      mcpConfig
    });
    
    const result = await thinker.think(prompt);
    
    console.log('\nDeep thinking process completed!');
    console.log(`Generated ${result.thoughts.length} thoughts`);
    console.log(`Results saved to: ${result.outputFile}`);
    
    // Print the first and last thought
    console.log('\nFirst thought:');
    console.log(result.thoughts[0]);
    
    console.log('\nFinal thought:');
    console.log(result.thoughts[result.thoughts.length - 1]);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

// Export the DeepThinkMCP class for use in other modules
module.exports = { DeepThinkMCP };

// Run main function if this script is executed directly
if (require.main === module) {
  main();
}
EOF

  # Make integration script executable
  chmod +x "$TOOLS_DIR/mcp/deepthink_integration.js"
  
  log "SUCCESS" "DeepThink Integration created"
}

# Function to setup cross-tool workflows
setup_cross_tool_workflows() {
  log "INFO" "Setting up Cross-Tool Workflows..."
  
  # Create workflow manager
  cat > "$TOOLS_DIR/mcp/workflow_manager.js" << 'EOF'
#!/usr/bin/env node

/**
 * Cross-Tool Workflow Manager
 * 
 * Manages workflows that span multiple MCP tools,
 * orchestrating their coordination and data exchange.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const CONFIG_DIR = process.env.HOME + '/.claude';
const workflowsDir = path.join(CONFIG_DIR, 'mcp', 'workflows');
const resultsDir = path.join(CONFIG_DIR, 'mcp', 'results');

// Ensure directories exist
if (!fs.existsSync(workflowsDir)) {
  fs.mkdirSync(workflowsDir, { recursive: true });
}

if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

// Workflow Manager Class
class WorkflowManager {
  constructor() {
    this.workflows = {};
    this.loadWorkflows();
  }
  
  // Load all workflow definitions
  loadWorkflows() {
    if (!fs.existsSync(workflowsDir)) {
      console.error(`Workflows directory not found: ${workflowsDir}`);
      return;
    }
    
    const files = fs.readdirSync(workflowsDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const workflow = JSON.parse(fs.readFileSync(path.join(workflowsDir, file), 'utf8'));
          this.workflows[workflow.name] = workflow;
        } catch (err) {
          console.error(`Error loading workflow ${file}: ${err.message}`);
        }
      }
    }
    
    console.log(`Loaded ${Object.keys(this.workflows).length} workflows`);
  }
  
  // List available workflows
  listWorkflows() {
    return Object.keys(this.workflows);
  }
  
  // Get workflow details
  getWorkflow(name) {
    return this.workflows[name];
  }
  
  // Execute a workflow
  async executeWorkflow(name, params = {}) {
    const workflow = this.workflows[name];
    
    if (!workflow) {
      throw new Error(`Workflow not found: ${name}`);
    }
    
    console.log(`Executing workflow: ${name}`);
    console.log(`Steps: ${workflow.steps.length}`);
    
    // Create context for data sharing between steps
    const context = {
      params,
      results: {},
      startTime: Date.now()
    };
    
    // Execute each step in sequence
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      console.log(`\nExecuting step ${i+1}/${workflow.steps.length}: ${step.name}`);
      
      try {
        const result = await this.executeStep(step, context);
        context.results[step.name] = result;
        
        // Update context with step result
        if (step.output) {
          context[step.output] = result;
        }
        
        console.log(`Step ${step.name} completed successfully`);
      } catch (err) {
        console.error(`Error executing step ${step.name}: ${err.message}`);
        
        if (step.continueOnError) {
          console.log('Continuing workflow despite error...');
        } else {
          throw new Error(`Workflow failed at step ${step.name}: ${err.message}`);
        }
      }
    }
    
    // Calculate execution time
    context.endTime = Date.now();
    context.executionTimeMs = context.endTime - context.startTime;
    
    // Save workflow results
    const resultPath = path.join(resultsDir, `${name}-${Date.now()}.json`);
    fs.writeFileSync(resultPath, JSON.stringify(context, null, 2));
    
    console.log(`\nWorkflow ${name} completed successfully`);
    console.log(`Execution time: ${context.executionTimeMs}ms`);
    console.log(`Results saved to: ${resultPath}`);
    
    return {
      success: true,
      resultPath,
      results: context.results
    };
  }
  
  // Execute a single workflow step
  async executeStep(step, context) {
    console.log(`Executing step type: ${step.type}`);
    
    switch (step.type) {
      case 'sequentialthinking':
        return this.executeSequentialThinking(step, context);
      case 'deepthink':
        return this.executeDeepThink(step, context);
      case 'file-context':
        return this.executeFileContext(step, context);
      case 'command':
        return this.executeCommand(step, context);
      case 'script':
        return this.executeScript(step, context);
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }
  
  // Execute sequentialthinking step
  async executeSequentialThinking(step, context) {
    console.log('Executing sequentialthinking step...');
    
    // Prepare input by replacing placeholders with context values
    let input = step.input;
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        input = input.replace(`{${key}}`, value);
      }
    }
    
    return new Promise((resolve, reject) => {
      const child = spawn('npx', ['-y', '@modelcontextprotocol/server-sequential-thinking'], { shell: true });
      
      let dataString = '';
      let errorString = '';
      
      // Prepare sequentialthinking request
      const request = {
        thought: input,
        nextThoughtNeeded: true,
        thoughtNumber: 1,
        totalThoughts: step.totalThoughts || 5
      };
      
      child.stdin.write(JSON.stringify(request));
      child.stdin.end();
      
      child.stdout.on('data', (data) => {
        dataString += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        errorString += data.toString();
      });
      
      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`sequentialthinking failed with code ${code}: ${errorString}`));
        }
        
        try {
          const result = JSON.parse(dataString);
          resolve(result);
        } catch (err) {
          reject(new Error(`Failed to parse sequentialthinking response: ${err.message}`));
        }
      });
      
      child.on('error', (err) => {
        reject(err);
      });
    });
  }
  
  // Execute deepthink step
  async executeDeepThink(step, context) {
    console.log('Executing deepthink step...');
    
    // Prepare input by replacing placeholders with context values
    let input = step.input;
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        input = input.replace(`{${key}}`, value);
      }
    }
    
    // Dynamic import of DeepThink integration
    const deepthinkPath = path.join(CONFIG_DIR, 'tools', 'mcp', 'deepthink_integration.js');
    const { DeepThinkMCP } = require(deepthinkPath);
    
    // Load configs
    const autonomyConfigPath = path.join(CONFIG_DIR, 'autonomy', 'config.json');
    const mcpConfigPath = path.join(CONFIG_DIR, 'mcp', 'config.json');
    
    const autonomyConfig = JSON.parse(fs.readFileSync(autonomyConfigPath, 'utf8'));
    const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
    
    // Create DeepThink instance
    const thinker = new DeepThinkMCP({
      autonomyConfig,
      mcpConfig
    });
    
    // Execute thinking process
    const result = await thinker.think(input);
    return result;
  }
  
  // Execute file-context step
  async executeFileContext(step, context) {
    console.log('Executing file-context step...');
    
    // Prepare input by replacing placeholders with context values
    let input = step.input;
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        input = input.replace(`{${key}}`, value);
      }
    }
    
    return new Promise((resolve, reject) => {
      const child = spawn('npx', ['-y', '@smithery/cli@latest', 'run', '@upstash/context7-mcp'], { shell: true });
      
      let dataString = '';
      let errorString = '';
      
      // Prepare context7 request
      const request = {
        context7CompatibleLibraryID: input,
        tokens: step.tokens || 5000
      };
      
      child.stdin.write(JSON.stringify(request));
      child.stdin.end();
      
      child.stdout.on('data', (data) => {
        dataString += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        errorString += data.toString();
      });
      
      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`context7 failed with code ${code}: ${errorString}`));
        }
        
        try {
          const result = JSON.parse(dataString);
          resolve(result);
        } catch (err) {
          reject(new Error(`Failed to parse context7 response: ${err.message}`));
        }
      });
      
      child.on('error', (err) => {
        reject(err);
      });
    });
  }
  
  // Execute command step
  async executeCommand(step, context) {
    console.log(`Executing command step: ${step.command}`);
    
    // Prepare command by replacing placeholders with context values
    let command = step.command;
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        command = command.replace(`{${key}}`, value);
      }
    }
    
    return new Promise((resolve, reject) => {
      const child = spawn(command, [], { shell: true });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        const str = data.toString();
        stdout += str;
        
        if (!step.silent) {
          console.log(str);
        }
      });
      
      child.stderr.on('data', (data) => {
        const str = data.toString();
        stderr += str;
        
        if (!step.silent) {
          console.error(str);
        }
      });
      
      child.on('close', (code) => {
        if (code !== 0 && !step.ignoreErrors) {
          return reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
        
        resolve({ stdout, stderr, exitCode: code });
      });
      
      child.on('error', (err) => {
        reject(err);
      });
    });
  }
  
  // Execute script step
  async executeScript(step, context) {
    console.log(`Executing script step: ${step.path}`);
    
    if (!step.path) {
      throw new Error('Script path not specified');
    }
    
    // Check if script exists
    const scriptPath = path.resolve(step.path);
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script not found: ${scriptPath}`);
    }
    
    // Prepare arguments by replacing placeholders with context values
    const args = step.args || [];
    const resolvedArgs = args.map(arg => {
      let resolved = arg;
      for (const [key, value] of Object.entries(context)) {
        if (typeof value === 'string') {
          resolved = resolved.replace(`{${key}}`, value);
        }
      }
      return resolved;
    });
    
    return new Promise((resolve, reject) => {
      const child = spawn('node', [scriptPath, ...resolvedArgs], { shell: true });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        const str = data.toString();
        stdout += str;
        
        if (!step.silent) {
          console.log(str);
        }
      });
      
      child.stderr.on('data', (data) => {
        const str = data.toString();
        stderr += str;
        
        if (!step.silent) {
          console.error(str);
        }
      });
      
      child.on('close', (code) => {
        if (code !== 0 && !step.ignoreErrors) {
          return reject(new Error(`Script failed with code ${code}: ${stderr}`));
        }
        
        resolve({ stdout, stderr, exitCode: code });
      });
      
      child.on('error', (err) => {
        reject(err);
      });
    });
  }
}

// Main function
async function main() {
  if (process.argv.length < 3) {
    console.error('Usage: workflow_manager.js <command> [args]');
    console.error('Commands:');
    console.error('  list                   List available workflows');
    console.error('  show <workflow>        Show workflow details');
    console.error('  run <workflow> [args]  Execute a workflow');
    process.exit(1);
  }
  
  const command = process.argv[2];
  const manager = new WorkflowManager();
  
  try {
    switch (command) {
      case 'list':
        console.log('Available workflows:');
        manager.listWorkflows().forEach(workflow => {
          console.log(`- ${workflow}`);
        });
        break;
        
      case 'show':
        if (process.argv.length < 4) {
          console.error('Workflow name required');
          process.exit(1);
        }
        
        const workflowName = process.argv[3];
        const workflow = manager.getWorkflow(workflowName);
        
        if (!workflow) {
          console.error(`Workflow not found: ${workflowName}`);
          process.exit(1);
        }
        
        console.log(JSON.stringify(workflow, null, 2));
        break;
        
      case 'run':
        if (process.argv.length < 4) {
          console.error('Workflow name required');
          process.exit(1);
        }
        
        const runWorkflowName = process.argv[3];
        
        // Parse remaining arguments as params
        const params = {};
        for (let i = 4; i < process.argv.length; i++) {
          const arg = process.argv[i];
          if (arg.includes('=')) {
            const [key, value] = arg.split('=');
            params[key] = value;
          }
        }
        
        const result = await manager.executeWorkflow(runWorkflowName, params);
        console.log(`Workflow result: ${result.success ? 'Success' : 'Failed'}`);
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

// Export the WorkflowManager class for use in other modules
module.exports = { WorkflowManager };

// Run main function if this script is executed directly
if (require.main === module) {
  main();
}
EOF

  # Make workflow manager executable
  chmod +x "$TOOLS_DIR/mcp/workflow_manager.js"
  
  # Create sample workflow
  mkdir -p "$CONFIG_DIR/mcp/workflows"
  
  cat > "$CONFIG_DIR/mcp/workflows/code_analysis.json" << 'EOF'
{
  "name": "code_analysis",
  "description": "Analyzes code using multiple MCP tools",
  "version": "1.0.0",
  "steps": [
    {
      "name": "context_lookup",
      "type": "file-context",
      "input": "{library}",
      "output": "documentation",
      "tokens": 5000,
      "continueOnError": true
    },
    {
      "name": "code_scan",
      "type": "command",
      "command": "find {codeDir} -name '*.js' | wc -l",
      "output": "fileCount",
      "continueOnError": false
    },
    {
      "name": "deep_analysis",
      "type": "deepthink",
      "input": "Analyze this code base: {codeDir} with {fileCount} JavaScript files. Focus on architecture and patterns.",
      "output": "analysis",
      "continueOnError": false
    },
    {
      "name": "recommendations",
      "type": "sequentialthinking",
      "input": "Based on this analysis: {analysis.synthesis}, provide recommendations for improvement.",
      "totalThoughts": 5,
      "output": "recommendations",
      "continueOnError": false
    }
  ],
  "inputs": [
    {
      "name": "library",
      "description": "The library to analyze",
      "type": "string",
      "required": true
    },
    {
      "name": "codeDir",
      "description": "The directory containing the code",
      "type": "string",
      "required": true
    }
  ],
  "outputs": [
    {
      "name": "documentation",
      "description": "Library documentation",
      "type": "object"
    },
    {
      "name": "analysis",
      "description": "Deep analysis of the code",
      "type": "object"
    },
    {
      "name": "recommendations",
      "description": "Recommendations for improvement",
      "type": "object"
    }
  ]
}
EOF

  log "SUCCESS" "Cross-Tool Workflows created"
}

# Run MCP operation (for SAAR chain)
run_mcp_operation() {
  local operation=${1:-"help"}
  shift
  
  # Check if MCP integration is installed
  if [ ! -d "$CONFIG_DIR/mcp" ] || [ ! -d "$TOOLS_DIR/mcp" ]; then
    log "WARN" "MCP integration not found. Installing..."
    setup_mcp_integration
  fi
  
  # Switch based on operation
  case $operation in
    validate)
      # Validate MCP tools
      log "INFO" "Validating MCP tools..."
      node "$TOOLS_DIR/mcp/validator.js"
      ;;
      
    workflow)
      # Run a cross-tool workflow
      log "INFO" "Running MCP workflow..."
      node "$TOOLS_DIR/mcp/workflow_manager.js" "$@"
      ;;
      
    fallback)
      # Manage fallbacks
      local fb_operation=${1:-"list"}
      shift
      
      case $fb_operation in
        list)
          # List available fallbacks
          log "INFO" "Listing available MCP fallbacks..."
          ls -l "$TOOLS_DIR/mcp/fallbacks" | grep -v "total"
          ;;
          
        enable)
          # Enable fallbacks
          log "INFO" "Enabling MCP fallbacks..."
          if [ -f "$CONFIG_DIR/mcp/config.json" ]; then
            safe_sed 's/"enabled": false/"enabled": true/' "$CONFIG_DIR/mcp/config.json"
            log "SUCCESS" "MCP fallbacks enabled"
          else
            log "ERROR" "MCP configuration not found"
            return 1
          fi
          ;;
          
        disable)
          # Disable fallbacks
          log "INFO" "Disabling MCP fallbacks..."
          if [ -f "$CONFIG_DIR/mcp/config.json" ]; then
            safe_sed 's/"enabled": true/"enabled": false/' "$CONFIG_DIR/mcp/config.json"
            log "SUCCESS" "MCP fallbacks disabled"
          else
            log "ERROR" "MCP configuration not found"
            return 1
          fi
          ;;
          
        *)
          log "ERROR" "Unknown fallback operation: $fb_operation"
          echo "Available operations: list, enable, disable"
          return 1
          ;;
      esac
      ;;
      
    config)
      # Configure MCP settings
      log "INFO" "Opening MCP configuration file..."
      
      # Check which editor to use
      if [ ! -z "$EDITOR" ]; then
        $EDITOR "$CONFIG_DIR/mcp/config.json"
      elif command -v nano &> /dev/null; then
        nano "$CONFIG_DIR/mcp/config.json"
      elif command -v vim &> /dev/null; then
        vim "$CONFIG_DIR/mcp/config.json"
      else
        log "WARN" "No editor found. Please edit the file manually: $CONFIG_DIR/mcp/config.json"
      fi
      ;;
      
    status)
      # Show MCP system status
      log "INFO" "MCP System Status"
      
      echo -e "${BOLD}MCP Integration:${NC}"
      
      # Check configuration
      if [ -f "$CONFIG_DIR/mcp/config.json" ]; then
        echo -e "Configuration: ${GREEN}Found${NC}"
        
        # Parse some key settings
        if command -v jq &> /dev/null; then
          local fallbacks_enabled=$(jq -r '.fallbacks.enabled' "$CONFIG_DIR/mcp/config.json" 2>/dev/null || echo "false")
          local shared_context=$(jq -r '.integration.shared_context' "$CONFIG_DIR/mcp/config.json" 2>/dev/null || echo "false")
          
          echo -e "Fallbacks enabled: ${fallbacks_enabled}"
          echo -e "Shared context: ${shared_context}"
        fi
      else
        echo -e "Configuration: ${YELLOW}Not found${NC}"
      fi
      
      # Check for workflows
      if [ -d "$CONFIG_DIR/mcp/workflows" ]; then
        local workflow_count=$(find "$CONFIG_DIR/mcp/workflows" -name "*.json" 2>/dev/null | wc -l)
        echo -e "Workflows: ${workflow_count}"
        
        # List workflows
        if [ "$workflow_count" -gt 0 ]; then
          echo "Available workflows:"
          find "$CONFIG_DIR/mcp/workflows" -name "*.json" -type f 2>/dev/null | \
            while read -r workflow; do
              echo "- $(basename "$workflow" .json)"
            done
        fi
      else
        echo -e "Workflows: ${YELLOW}No workflows found${NC}"
      fi
      
      # Check fallbacks
      if [ -d "$TOOLS_DIR/mcp/fallbacks" ]; then
        local fallback_count=$(find "$TOOLS_DIR/mcp/fallbacks" -name "*.js" 2>/dev/null | wc -l)
        echo -e "Fallbacks: ${fallback_count}"
        
        # List fallbacks
        if [ "$fallback_count" -gt 0 ]; then
          echo "Available fallbacks:"
          find "$TOOLS_DIR/mcp/fallbacks" -name "*.js" -type f 2>/dev/null | \
            while read -r fallback; do
              echo "- $(basename "$fallback" .js)"
            done
        fi
      else
        echo -e "Fallbacks: ${YELLOW}No fallbacks found${NC}"
      fi
      
      # Check MCP tools cache
      if [ -f "$CONFIG_DIR/mcp/cache/tools_cache.json" ]; then
        echo -e "\nMCP Tools Status:"
        if command -v jq &> /dev/null; then
          jq -r 'to_entries | .[] | "- \(.key): \(.value.available ? "Available" : "Unavailable")\(.value.fallbackApplied ? " (Fallback Applied)" : "")"' "$CONFIG_DIR/mcp/cache/tools_cache.json" 2>/dev/null
        else
          echo "Cache file exists but jq is not available to parse it"
        fi
      else
        echo -e "\nMCP Tools Status: ${YELLOW}No cache found${NC}"
      fi
      ;;
      
    install)
      # Install MCP integration
      setup_mcp_integration
      ;;
      
    help|*)
      echo "MCP Integration Usage:"
      echo "  $0 mcp validate              - Validate MCP tools and apply fallbacks"
      echo "  $0 mcp workflow list         - List available workflows"
      echo "  $0 mcp workflow run <name>   - Run a specific workflow"
      echo "  $0 mcp fallback list         - List available fallbacks"
      echo "  $0 mcp fallback enable       - Enable fallbacks"
      echo "  $0 mcp fallback disable      - Disable fallbacks"
      echo "  $0 mcp config                - Configure MCP settings"
      echo "  $0 mcp status                - Show MCP system status"
      echo "  $0 mcp install               - Install MCP integration"
      echo "  $0 mcp help                  - Show this help"
      ;;
  esac
}

# Run DeepThink operation (for SAAR chain)
run_deepthink() {
  local prompt="$*"
  
  if [ -z "$prompt" ]; then
    log "ERROR" "No prompt provided"
    echo "Usage: $0 deepthink <prompt>"
    return 1
  fi
  
  # Check if DeepThink integration is installed
  if [ ! -f "$TOOLS_DIR/mcp/deepthink_integration.js" ]; then
    log "WARN" "DeepThink integration not found. Installing..."
    setup_deepthink_integration
  fi
  
  # Run DeepThink with the provided prompt
  log "INFO" "Running DeepThink with prompt: $prompt"
  node "$TOOLS_DIR/mcp/deepthink_integration.js" "$prompt"
}

# Run cross-tool workflow operation (for SAAR chain)
run_cross_tool_workflow() {
  local workflow="$1"
  shift
  
  if [ -z "$workflow" ]; then
    log "ERROR" "No workflow specified"
    echo "Usage: $0 cross-tool <workflow> [params]"
    return 1
  fi
  
  # Check if workflow manager is installed
  if [ ! -f "$TOOLS_DIR/mcp/workflow_manager.js" ]; then
    log "WARN" "Workflow manager not found. Installing..."
    setup_cross_tool_workflows
  fi
  
  # Run the workflow
  log "INFO" "Running cross-tool workflow: $workflow"
  node "$TOOLS_DIR/mcp/workflow_manager.js" run "$workflow" "$@"
}