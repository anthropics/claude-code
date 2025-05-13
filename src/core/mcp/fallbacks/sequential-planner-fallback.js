#!/usr/bin/env node

/**
 * Sequential Planner Fallback - Proxy Module
 * 
 * This module re-exports the Sequential Planner from the claude-framework
 * or provides a fallback CLI implementation.
 * 
 * IMPORTANT: This file is maintained for backward compatibility.
 * New code should import directly from the claude-framework.
 */

// Check if this is being run directly from command line
const isRunAsScript = require.main === module;

if (isRunAsScript) {
  // Original CLI fallback functionality
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
} else {
  // When imported as a module, re-export from the framework or use fallback
  const originalPlanner = require('./sequential-planner');
  
  // Log a deprecation warning
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      'WARNING: Importing from src/core/mcp/fallbacks/sequential-planner-fallback.js is deprecated. ' +
      'Please update your imports to use: claude-framework/libs/workflows/src/sequential/services/sequential-planner'
    );
  }
  
  // Re-export the original planner for backward compatibility
  module.exports = originalPlanner;
}