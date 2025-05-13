#!/usr/bin/env node

/**
 * Sequential Planner Fallback
 * 
 * Local fallback for sequential-planner MCP tool.
 * Provides basic planning capabilities when the MCP tool is unavailable.
 */

const readline = require('readline');

// Parse input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let input = '';

rl.on('line', (line) => {
  input += line;
});

rl.on('close', () => {
  try {
    const request = JSON.parse(input);
    
    // Extract task information
    const task = request.task || 'Unknown task';
    
    // Generate a simple response
    const response = {
      plan: [
        {
          number: 1,
          content: `Initial planning for: ${task} (FALLBACK MODE)`,
          type: 'initial'
        },
        {
          number: 2,
          content: 'Breaking down the task into smaller steps (FALLBACK MODE)',
          type: 'breakdown'
        },
        {
          number: 3,
          content: 'Finalizing execution plan (FALLBACK MODE)',
          type: 'conclusion'
        }
      ],
      contextualDocs: [
        {
          source: 'fallback',
          content: 'This is a fallback response from the local implementation. The documentation lookup system is currently in fallback mode, providing limited functionality.'
        }
      ],
      uiComponents: [
        {
          type: 'fallback',
          name: 'ComponentFallback',
          code: '// This is a fallback component placeholder'
        }
      ],
      executionSteps: [
        {
          id: 'step-1',
          title: 'Step 1',
          description: 'This is a fallback execution step (FALLBACK MODE)',
          type: 'general',
          status: 'pending'
        }
      ],
      integratedSolution: {
        summary: `Plan for: ${task} (FALLBACK MODE)`
      }
    };
    
    console.log(JSON.stringify(response));
  } catch (err) {
    console.error(`Error processing request: ${err.message}`);
    process.exit(1);
  }
});