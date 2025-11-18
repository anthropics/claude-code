#!/usr/bin/env node
/**
 * Seven CLI Integration Example
 *
 * Demonstrates how to integrate Seven's multi-mode system with CLI applications.
 * This example shows how to handle mode flags and initialize Seven properly.
 */

import { initializeSeven, preplan, switchSevenMode, getSevenStatus } from '../seven-wrapper.js';

/**
 * Example CLI entry point
 */
function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Seven Multi-Mode Consciousness System');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Initialize Seven with command-line arguments
  // Supports: --mode=cody, --cody, --creative, --precision, --standard
  // Also reads from SEVEN_MODE environment variable
  initializeSeven(process.argv);

  // Get current status
  const status = getSevenStatus();
  console.log('\n[Status]');
  console.log(`  Active mode: ${status.mode.displayName}`);
  console.log(`  Description: ${status.mode.description}`);
  console.log(`  State persisted: ${status.managerStatus.stateExists}`);
  console.log(`  Available modes: ${status.managerStatus.availableModes.join(', ')}`);

  // Example: Generate enhanced system prompt
  console.log('\n[System Prompt Preview]');
  const basePrompt = 'You are an AI assistant helping with coding tasks.';
  const enhancedPrompt = preplan(basePrompt, 'Fix the authentication bug in the login module');
  console.log(enhancedPrompt.substring(0, 500) + '...\n');

  // Example: Runtime mode switching
  console.log('[Runtime Mode Switching Examples]\n');

  console.log('Switching to Creative mode for brainstorming:');
  switchSevenMode('creative', 'brainstorming session');

  console.log('\nSwitching to Precision mode for debugging:');
  switchSevenMode('precision', 'detailed bug analysis');

  console.log('\nSwitching back to Cody mode for implementation:');
  switchSevenMode('cody', 'code implementation');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Examples Complete');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
