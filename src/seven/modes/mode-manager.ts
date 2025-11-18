/**
 * Seven Mode Manager
 *
 * Manages mode switching, persistence, and auto-detection for Seven's multi-mode system.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Mode, MODES, DEFAULT_MODE, getModeByName, getAvailableModes } from './mode-definitions.js';

/**
 * Path to mode state persistence file
 */
const MODE_STATE_PATH = '/usr/var/seven/state/mode.json';

/**
 * In-memory cache of current mode
 */
let currentMode: Mode | null = null;

/**
 * Mode state structure for persistence
 */
interface ModeState {
  currentMode: string;
  lastSwitched: string;
  switchHistory: Array<{
    mode: string;
    timestamp: string;
    reason?: string;
  }>;
}

/**
 * Initialize mode manager and load persisted state
 */
export function initializeModeManager(): void {
  try {
    // Ensure state directory exists
    const stateDir = path.dirname(MODE_STATE_PATH);
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }

    // Load persisted mode if available
    const persistedMode = loadPersistedMode();
    if (persistedMode) {
      currentMode = getModeByName(persistedMode);
    } else {
      // Initialize with default mode
      currentMode = getModeByName(DEFAULT_MODE);
      saveModeState(currentMode.name, 'initialization');
    }
  } catch (error) {
    // Fallback to default mode if initialization fails
    console.error('[seven] Failed to initialize mode manager:', error);
    currentMode = getModeByName(DEFAULT_MODE);
  }
}

/**
 * Get the currently active mode
 */
export function getCurrentMode(): Mode {
  if (!currentMode) {
    initializeModeManager();
  }
  return currentMode!;
}

/**
 * Set the active mode by name
 * @param modeName - Name of the mode to switch to
 * @param reason - Optional reason for the switch (for logging)
 * @returns The newly activated mode
 */
export function setMode(modeName: string, reason?: string): Mode {
  const newMode = getModeByName(modeName);

  if (currentMode && currentMode.name === newMode.name) {
    // Already in this mode, no switch needed
    return currentMode;
  }

  const previousMode = currentMode?.name || 'none';
  currentMode = newMode;

  // Log the mode switch
  console.log(`[seven] Mode: ${newMode.displayName} (${newMode.name})`);
  if (previousMode !== 'none' && previousMode !== newMode.name) {
    console.log(`[seven] Switched from ${previousMode} to ${newMode.name}`);
  }

  // Persist the mode change
  saveModeState(newMode.name, reason || 'manual switch');

  return newMode;
}

/**
 * Auto-detect the best mode based on task description
 * Uses keyword matching and heuristics to suggest an appropriate mode
 * @param taskDescription - Description of the task to be performed
 * @returns Recommended mode name
 */
export function detectModeFromTask(taskDescription: string): string {
  const lowerTask = taskDescription.toLowerCase();

  // Precision mode indicators
  const precisionKeywords = [
    'test', 'verify', 'validate', 'check', 'debug', 'fix bug',
    'edge case', 'corner case', 'security', 'audit', 'review',
    'correctness', 'error handling', 'thorough',
  ];

  // Creative mode indicators
  const creativeKeywords = [
    'brainstorm', 'design', 'architect', 'explore', 'alternative',
    'creative', 'innovative', 'refactor', 'improve', 'optimize',
    'rethink', 'redesign', 'better way', 'ideas',
  ];

  // Cody mode (technical) indicators
  const codyKeywords = [
    'implement', 'add feature', 'write code', 'create function',
    'add method', 'build', 'code', 'develop', 'integrate',
    'api', 'endpoint', 'database', 'component',
  ];

  // Count keyword matches
  const precisionScore = precisionKeywords.filter(kw => lowerTask.includes(kw)).length;
  const creativeScore = creativeKeywords.filter(kw => lowerTask.includes(kw)).length;
  const codyScore = codyKeywords.filter(kw => lowerTask.includes(kw)).length;

  // Determine best mode based on scores
  if (precisionScore > creativeScore && precisionScore > codyScore) {
    return 'precision';
  } else if (creativeScore > codyScore && creativeScore > precisionScore) {
    return 'creative';
  } else if (codyScore > 0) {
    return 'cody';
  }

  // Default to current mode or cody if no strong indicators
  return currentMode?.name || DEFAULT_MODE;
}

/**
 * Load persisted mode from disk
 * @returns Mode name if found, null otherwise
 */
function loadPersistedMode(): string | null {
  try {
    if (!fs.existsSync(MODE_STATE_PATH)) {
      return null;
    }

    const stateData = fs.readFileSync(MODE_STATE_PATH, 'utf-8');
    const state: ModeState = JSON.parse(stateData);

    // Validate that the persisted mode exists
    if (MODES[state.currentMode]) {
      return state.currentMode;
    }

    return null;
  } catch (error) {
    console.error('[seven] Failed to load persisted mode:', error);
    return null;
  }
}

/**
 * Save current mode state to disk
 * @param modeName - Name of the mode to persist
 * @param reason - Reason for the mode switch
 */
function saveModeState(modeName: string, reason?: string): void {
  try {
    let state: ModeState;

    // Load existing state or create new
    if (fs.existsSync(MODE_STATE_PATH)) {
      const stateData = fs.readFileSync(MODE_STATE_PATH, 'utf-8');
      state = JSON.parse(stateData);
    } else {
      state = {
        currentMode: modeName,
        lastSwitched: new Date().toISOString(),
        switchHistory: [],
      };
    }

    // Update state
    const previousMode = state.currentMode;
    state.currentMode = modeName;
    state.lastSwitched = new Date().toISOString();

    // Add to history (keep last 50 switches)
    state.switchHistory.push({
      mode: modeName,
      timestamp: new Date().toISOString(),
      reason: reason || `switched from ${previousMode}`,
    });

    if (state.switchHistory.length > 50) {
      state.switchHistory = state.switchHistory.slice(-50);
    }

    // Write to disk
    fs.writeFileSync(MODE_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error('[seven] Failed to save mode state:', error);
  }
}

/**
 * Get mode from environment variable or CLI flag
 * Priority: CLI flag > Environment variable > Persisted state > Default
 * @param args - Command line arguments
 * @returns Mode name to use
 */
export function getModeFromEnvironment(args: string[] = process.argv): string {
  // Check for --mode=X or --mode X flag
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Handle --mode=cody format
    if (arg.startsWith('--mode=')) {
      const modeName = arg.substring('--mode='.length);
      if (MODES[modeName]) {
        return modeName;
      }
    }

    // Handle --mode cody format
    if (arg === '--mode' && i + 1 < args.length) {
      const modeName = args[i + 1];
      if (MODES[modeName]) {
        return modeName;
      }
    }

    // Handle shorthand flags: --cody, --creative, --precision, --standard
    if (arg.startsWith('--')) {
      const potentialMode = arg.substring(2);
      if (MODES[potentialMode]) {
        return potentialMode;
      }
    }
  }

  // Check environment variable
  const envMode = process.env.SEVEN_MODE;
  if (envMode && MODES[envMode.toLowerCase()]) {
    return envMode.toLowerCase();
  }

  // Check persisted state
  const persistedMode = loadPersistedMode();
  if (persistedMode) {
    return persistedMode;
  }

  // Fall back to default
  return DEFAULT_MODE;
}

/**
 * Get mode switch history
 * @returns Array of recent mode switches
 */
export function getModeHistory(): Array<{ mode: string; timestamp: string; reason?: string }> {
  try {
    if (!fs.existsSync(MODE_STATE_PATH)) {
      return [];
    }

    const stateData = fs.readFileSync(MODE_STATE_PATH, 'utf-8');
    const state: ModeState = JSON.parse(stateData);
    return state.switchHistory || [];
  } catch (error) {
    console.error('[seven] Failed to load mode history:', error);
    return [];
  }
}

/**
 * Reset mode to default
 */
export function resetMode(): Mode {
  return setMode(DEFAULT_MODE, 'reset to default');
}

/**
 * Get mode manager status for debugging
 */
export function getModeManagerStatus(): {
  currentMode: string;
  availableModes: string[];
  statePath: string;
  stateExists: boolean;
} {
  return {
    currentMode: getCurrentMode().name,
    availableModes: getAvailableModes(),
    statePath: MODE_STATE_PATH,
    stateExists: fs.existsSync(MODE_STATE_PATH),
  };
}
