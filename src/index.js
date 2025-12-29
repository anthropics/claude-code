#!/usr/bin/env node
/**
 * Claude Code - Main entry point
 *
 * This is the modular, maintainable version of Claude Code.
 */

// Core modules
export * from './core/session.js';

// Configuration
export * from './config/environment.js';
export * from './config/validators.js';

// Utilities
export * from './utils/fileSystem.js';
export * from './utils/memoize.js';
export * from './utils/logging.js';
export * from './utils/formatting.js';
export { writeToStdout, writeToStderr } from './utils/output.js';

// API
export * from './api/models.js';
export * from './api/client.js';

// Tools
export * from './tools/toolInterface.js';

// Permissions
export * from './permissions/permissionTypes.js';

// Messages
export * from './messages/messageTypes.js';

// Streaming
export * from './streaming/streamEvents.js';

// Errors
export * from './errors/errorTypes.js';

// CLI
export * from './cli/commandParser.js';

// Git
export * from './git/gitUtils.js';

// Conversation
export * from './conversation/conversationManager.js';

// Settings
export * from './settings/userSettings.js';

/**
 * Application version
 */
export const VERSION = '2.0.76';

/**
 * Build information
 */
export const BUILD_INFO = {
    ISSUES_EXPLAINER: 'report the issue at https://github.com/anthropics/claude-code/issues',
    PACKAGE_URL: '@anthropic-ai/claude-code',
    README_URL: 'https://docs.anthropic.com/en/docs/claude-code',
    VERSION: '2.0.76',
    FEEDBACK_CHANNEL: 'https://github.com/anthropics/claude-code/issues',
    BUILD_TIME: new Date().toISOString()
};

/**
 * Main entry point
 */
async function main() {
    console.log('Claude Code v' + VERSION);
    console.log('This is the modular source code version.');
    console.log('See src/ directory for organized modules.');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
