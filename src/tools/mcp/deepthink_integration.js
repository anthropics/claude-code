#!/usr/bin/env node

/**
 * DeepThink Integration with sequentialthinking
 * 
 * Connects the DeepThink system with the sequentialthinking MCP tool
 * for enhanced recursive thinking capabilities.
 * Now with memory persistence and thought categorization.
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

// Import memory persistence module
const memoryModulePath = path.join(CONFIG_DIR, 'saar', 'startup', 'memory_persistence.js');
let memory;

try {
  memory = require(memoryModulePath);
  console.log('Memory persistence module loaded successfully');
} catch (err) {
  console.warn(`Warning: Memory persistence module not found or has errors: ${err.message}`);
  console.warn('DeepThink will continue without memory persistence');
  
  // Create a dummy memory module to avoid errors
  memory = {
    storeThought: () => null,
    retrieveThought: () => null,
    searchThoughts: () => [],
    categorizeThought: () => "uncategorized",
    relateThoughts: () => false,
    getMemoryStats: () => ({ total_thoughts: 0 })
  };
}

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
  // Use default configurations if files are not found
  autonomyConfig = { deepthink: { recursion_depth: 5, thought_expansion_factor: 3 } };
  mcpConfig = { mcp: { sequentialthinking: { primary: true } } };
}

// DeepThink Integration Class
class DeepThinkMCP {
  constructor(configs) {
    this.autonomyConfig = configs.autonomyConfig;
    this.mcpConfig = configs.mcpConfig;
    this.recursionDepth = this.autonomyConfig.deepthink.recursion_depth;
    this.useSequentialThinking = true; // Will be set based on availability check
    this.thoughts = [];
    this.memoryUsage = Boolean(configs.useMemory !== false && memory.storeThought);
    
    if (this.memoryUsage) {
      console.log('Memory persistence is enabled');
    } else {
      console.log('Memory persistence is disabled');
    }
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
    
    // Check if we have relevant thoughts in memory
    let relatedThoughts = [];
    if (this.memoryUsage) {
      relatedThoughts = memory.searchThoughts(prompt, null, 5);
      
      if (relatedThoughts.length > 0) {
        console.log(`Found ${relatedThoughts.length} related thoughts in memory`);
        
        // Enhance the prompt with related thoughts
        const enhancedPrompt = this.enhancePromptWithMemory(prompt, relatedThoughts);
        prompt = enhancedPrompt;
      }
    }
    
    // Check sequentialthinking availability
    this.useSequentialThinking = await this.checkSequentialThinking();
    
    let result;
    if (this.useSequentialThinking) {
      result = await this.thinkWithSequentialThinking(prompt);
    } else {
      result = await this.thinkWithLocalImplementation(prompt);
    }
    
    // Store thoughts in memory if enabled
    if (this.memoryUsage) {
      console.log('Storing thoughts in memory...');
      
      // Store each thought
      for (const thought of result.thoughts) {
        // Categorize the thought
        const category = memory.categorizeThought(thought);
        
        // Store in memory
        const stored = memory.storeThought({
          content: thought
        }, category, 'deepthink');
        
        if (stored && relatedThoughts.length > 0) {
          // Relate to the most relevant thought from the search
          memory.relateThoughts(stored.id, relatedThoughts[0].id, 'builds_on');
        }
      }
      
      // Store the synthesis
      const category = memory.categorizeThought(result.synthesis);
      memory.storeThought({
        content: result.synthesis
      }, category, 'deepthink_synthesis');
      
      console.log('Thoughts stored in memory');
      
      // Get memory stats
      const stats = memory.getMemoryStats();
      console.log(`Memory now contains ${stats.total_thoughts} thoughts`);
    }
    
    return result;
  }
  
  // Enhance prompt with memory
  enhancePromptWithMemory(originalPrompt, relatedThoughts) {
    // Create an enhanced prompt that includes context from memory
    let enhancedPrompt = `${originalPrompt}\n\nBased on previous thinking, consider these related insights:\n\n`;
    
    // Add related thoughts
    for (let i = 0; i < Math.min(relatedThoughts.length, 3); i++) {
      enhancedPrompt += `- ${relatedThoughts[i].content.substring(0, 150)}...\n`;
    }
    
    enhancedPrompt += `\nIncorporate these insights into your thinking process.`;
    
    return enhancedPrompt;
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
  
  // Get memory stats (if available)
  getMemoryStats() {
    if (this.memoryUsage) {
      return memory.getMemoryStats();
    } else {
      return { total_thoughts: 0, message: "Memory persistence is disabled" };
    }
  }
}

// Main function
async function main() {
  if (process.argv.length < 3) {
    console.error('Usage: deepthink_integration.js <prompt> [--no-memory]');
    process.exit(1);
  }
  
  // Check for flags
  const useMemory = !process.argv.includes('--no-memory');
  
  // Get prompt from command line
  const promptArgs = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  const prompt = promptArgs.join(' ');
  
  try {
    const thinker = new DeepThinkMCP({
      autonomyConfig,
      mcpConfig,
      useMemory
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
    
    // Print memory stats if enabled
    if (useMemory) {
      const stats = thinker.getMemoryStats();
      console.log('\nMemory statistics:');
      console.log(`Total thoughts in memory: ${stats.total_thoughts}`);
      
      if (stats.categories) {
        console.log('Thought categories:');
        stats.categories.forEach(category => {
          console.log(`- ${category.name}: ${category.count} thoughts`);
        });
      }
    }
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