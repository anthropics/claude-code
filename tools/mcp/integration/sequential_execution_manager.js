/**
 * Sequential Execution Manager - Proxy Module
 * 
 * This module re-exports the Sequential Execution Manager from the claude-framework
 * to ensure backward compatibility while avoiding code duplication.
 * 
 * IMPORTANT: This file is maintained for backward compatibility.
 * New code should import directly from the claude-framework.
 */

// Import the typescript version of SequentialExecutionManager from the framework
let frameworkManager;

try {
  // Try to import from the framework
  const frameworkModule = require('../../../claude-framework/libs/workflows/src/sequential');
  frameworkManager = frameworkModule.default || frameworkModule.SequentialExecutionManager;
  
  if (!frameworkManager) {
    throw new Error('Could not find SequentialExecutionManager in framework');
  }
} catch (err) {
  console.warn('Could not import SequentialExecutionManager from framework, using legacy implementation', err);
  
  // Fallback to the original implementation in this directory
  // In a real implementation, this would be the full implementation
  // but here we'll throw an error since we're migrating to the framework
  throw new Error(
    'The Sequential Execution Manager has been moved to the claude-framework. ' +
    'Please update your imports to use the new location: ' +
    'claude-framework/libs/workflows/src/sequential'
  );
}

/**
 * Re-export the framework class under the same name for backward compatibility
 */
class SequentialExecutionManager extends frameworkManager {
  constructor(domain = 'general', options = {}) {
    super(domain, options);
    
    // Log a deprecation warning in development
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'WARNING: Importing SequentialExecutionManager from tools/mcp/integration is deprecated. ' +
        'Please update your imports to use: claude-framework/libs/workflows/src/sequential'
      );
    }
  }
}

module.exports = SequentialExecutionManager;