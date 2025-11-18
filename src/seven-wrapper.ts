/**
 * Seven Consciousness Wrapper
 *
 * Main integration point for Seven's multi-mode consciousness system.
 * Handles mode initialization, system prompt injection, and tool execution preferences.
 */

import {
  getCurrentMode,
  setMode,
  getModeFromEnvironment,
  initializeModeManager,
  detectModeFromTask,
  getModeManagerStatus,
} from './seven/modes/mode-manager.js';
import { Mode } from './seven/modes/mode-definitions.js';

/**
 * Tool execution context
 */
interface ToolContext {
  toolName: string;
  parameters: Record<string, any>;
  mode: Mode;
}

/**
 * Tool execution result
 */
interface ToolResult {
  success: boolean;
  output: any;
  metadata?: Record<string, any>;
}

/**
 * Initialize Seven consciousness system
 * Should be called at application startup
 * @param args - Command line arguments for mode detection
 */
export function initializeSeven(args?: string[]): void {
  console.log('[seven] Initializing consciousness system...');

  // Initialize mode manager
  initializeModeManager();

  // Determine mode from environment/CLI
  const requestedMode = getModeFromEnvironment(args);

  // Set the mode
  const mode = setMode(requestedMode, 'startup initialization');

  console.log('[seven] Consciousness initialized');
  console.log(`[seven] Mode: ${mode.displayName} - ${mode.description}`);
}

/**
 * Preplan phase: Inject mode-specific system prompt
 *
 * This function is called before the main planning phase to enhance
 * the system prompt with mode-specific instructions and personality.
 *
 * @param basePrompt - The base system prompt
 * @param taskDescription - Optional task description for mode detection
 * @returns Enhanced system prompt with mode-specific additions
 */
export function preplan(basePrompt: string, taskDescription?: string): string {
  const mode = getCurrentMode();

  // Optionally auto-detect mode based on task
  if (taskDescription && process.env.SEVEN_AUTO_MODE === 'true') {
    const suggestedMode = detectModeFromTask(taskDescription);
    if (suggestedMode !== mode.name) {
      console.log(`[seven] Auto-detected mode: ${suggestedMode} for task`);
      setMode(suggestedMode, 'auto-detected from task');
    }
  }

  // Build enhanced prompt with mode context
  const enhancedPrompt = `${basePrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEVEN CONSCIOUSNESS MODE: ${mode.displayName.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${mode.systemPrompt}

RESPONSE STYLE CONFIGURATION:
- Verbosity: ${mode.responseStyle.verbosity}
- Code-focused: ${mode.responseStyle.codeFocused ? 'Yes' : 'No'}
- Include reasoning: ${mode.responseStyle.includeReasoning ? 'Yes' : 'No'}
- Offer alternatives: ${mode.responseStyle.offerAlternatives ? 'Yes' : 'No'}
- Explain edge cases: ${mode.responseStyle.explainEdgeCases ? 'Yes' : 'No'}

TOOL PREFERENCES:
- Prefer Edit over Write: ${mode.toolPreferences.preferEditOverWrite ? 'Yes' : 'No'}
- Prefer Grep over Glob: ${mode.toolPreferences.preferGrepOverGlob ? 'Yes' : 'No'}
- Enable web search: ${mode.toolPreferences.enableWebSearch ? 'Yes' : 'No'}
- Favor verification: ${mode.toolPreferences.favorVerification ? 'Yes' : 'No'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  return enhancedPrompt;
}

/**
 * Seven Enhanced Tool Executor
 *
 * Wraps tool execution with mode-specific preferences and behavior.
 * Influences tool selection and parameter optimization based on current mode.
 *
 * @param toolName - Name of the tool to execute
 * @param parameters - Tool parameters
 * @returns Tool execution result with mode-aware enhancements
 */
export function sevenEnhancedToolExecutor(
  toolName: string,
  parameters: Record<string, any>
): ToolContext {
  const mode = getCurrentMode();

  // Create execution context
  const context: ToolContext = {
    toolName,
    parameters: { ...parameters },
    mode,
  };

  // Apply mode-specific tool preferences
  applyToolPreferences(context);

  return context;
}

/**
 * Apply mode-specific tool preferences to execution context
 * @param context - Tool execution context to modify
 */
function applyToolPreferences(context: ToolContext): void {
  const { mode, toolName, parameters } = context;
  const prefs = mode.toolPreferences;

  // Edit vs Write preference
  if (prefs.preferEditOverWrite && toolName === 'Write') {
    console.log('[seven] Mode preference: Consider using Edit instead of Write');
  }

  // Grep vs Glob preference
  if (prefs.preferGrepOverGlob && toolName === 'Glob') {
    console.log('[seven] Mode preference: Consider using Grep for more precise search');
  }

  // Web search enablement
  if (!prefs.enableWebSearch && toolName === 'WebSearch') {
    console.log(`[seven] Mode '${mode.name}' prefers avoiding web search - consider using local resources`);
  }

  // Verification tooling
  if (prefs.favorVerification && ['Bash', 'Read', 'Edit'].includes(toolName)) {
    // Add verification hints
    if (toolName === 'Bash' && parameters.command?.includes('test')) {
      console.log('[seven] Mode preference: Running verification tests');
    }
  }

  // Broad vs precise search
  if (prefs.preferBroadSearch && toolName === 'Grep') {
    // Suggest broader patterns
    console.log('[seven] Mode preference: Consider broader search patterns for exploration');
  }
}

/**
 * Get current Seven status for debugging and monitoring
 */
export function getSevenStatus(): {
  mode: Mode;
  managerStatus: ReturnType<typeof getModeManagerStatus>;
  initialized: boolean;
} {
  return {
    mode: getCurrentMode(),
    managerStatus: getModeManagerStatus(),
    initialized: true,
  };
}

/**
 * Switch Seven to a different mode at runtime
 * @param modeName - Name of mode to switch to
 * @param reason - Optional reason for logging
 */
export function switchSevenMode(modeName: string, reason?: string): Mode {
  const mode = setMode(modeName, reason);
  console.log(`[seven] Switched to ${mode.displayName} mode`);
  console.log(`[seven] ${mode.description}`);
  return mode;
}

/**
 * Format output based on mode's response style preferences
 * @param content - Content to format
 * @param contentType - Type of content (code, explanation, etc.)
 * @returns Formatted content according to mode preferences
 */
export function formatResponse(content: string, contentType: 'code' | 'explanation' | 'analysis'): string {
  const mode = getCurrentMode();
  const style = mode.responseStyle;

  // Apply verbosity settings
  if (style.verbosity === 'concise' && contentType === 'explanation') {
    // In concise mode, strip unnecessary prose
    return content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .join('\n');
  }

  if (style.verbosity === 'verbose' && contentType === 'code') {
    // In verbose mode, add more context
    return `${content}\n\n// Mode: ${mode.displayName} - Detailed implementation`;
  }

  return content;
}

/**
 * Memory recall strategy based on mode preferences
 * @param contextType - Type of context being recalled
 * @returns Priority weight for this context type
 */
export function getMemoryPriority(contextType: 'code' | 'interaction' | 'bug' | 'solution'): number {
  const mode = getCurrentMode();
  const strategy = mode.memoryStrategy;

  switch (contextType) {
    case 'code':
      return strategy.prioritizeCodePatterns ? 1.0 : 0.5;
    case 'interaction':
      return strategy.prioritizeRecentInteractions ? 1.0 : 0.5;
    case 'bug':
      return strategy.prioritizePastBugs ? 1.0 : 0.3;
    case 'solution':
      return strategy.prioritizeDiverseSolutions ? 1.0 : 0.5;
    default:
      return 0.5;
  }
}

/**
 * Check if context is within memory retention window
 * @param timestamp - Timestamp of the context
 * @returns True if context should be retained
 */
export function isWithinMemoryWindow(timestamp: Date): boolean {
  const mode = getCurrentMode();
  const retentionMinutes = mode.memoryStrategy.retentionWindow;
  const now = new Date();
  const diffMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60);

  return diffMinutes <= retentionMinutes;
}

/**
 * Export all Seven functions for use in the application
 */
export default {
  initializeSeven,
  preplan,
  sevenEnhancedToolExecutor,
  getSevenStatus,
  switchSevenMode,
  formatResponse,
  getMemoryPriority,
  isWithinMemoryWindow,
};
