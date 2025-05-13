/**
 * Sequential Execution Manager exports
 * 
 * This is the main export file for the Sequential Execution Manager feature.
 * It exports all components needed for sequential planning and execution.
 */

// Main manager
export * from './sequential-execution-manager';

// Integration manager
export * from './integration/sequential-execution-manager';

// Domain-specific planners
export * from './planners';

// Domain-specific executors
export * from './executors';

// Services
export * from './services/sequential-planner';

// Documentation generator
export * from './documentation/sequential-doc-generator';

// Types
export * from './types';

// Re-export SequentialExecutionManager for convenience
import { SequentialExecutionManager } from './sequential-execution-manager';
export default SequentialExecutionManager;