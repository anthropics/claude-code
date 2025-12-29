/**
 * User Settings Management
 *
 * Handles user preferences, settings persistence, and configuration.
 */

import { getConfigDirectory } from '../config/environment.js';
import { join } from 'path';

/**
 * Settings file names
 */
const SETTINGS_FILES = {
    USER: 'settings.json',
    PROJECT: '.claude/settings.json',
    LOCAL: '.claude/settings.local.json'
};

/**
 * Setting sources in order of precedence (highest first)
 */
const SETTING_SOURCES = [
    'localSettings',      // .claude/settings.local.json (not committed)
    'projectSettings',    // .claude/settings.json (committed)
    'userSettings',       // ~/.claude/settings.json
    'flagSettings',       // From CLI flags
    'policySettings'      // Organization policies
];

/**
 * Default settings values
 */
const DEFAULT_SETTINGS = {
    // Model settings
    model: null,
    maxTokens: null,

    // UI settings
    theme: 'auto',
    verbose: false,

    // Tool settings
    allowedTools: [],
    disallowedTools: [],

    // Permission settings
    autoApproveReadOnly: true,
    autoApproveBashCommands: [],

    // Editor settings
    preferredEditor: null,

    // Notification settings
    notifyOnComplete: false,

    // History settings
    saveHistory: true,
    maxHistorySize: 100
};

/**
 * @typedef {Object} UserSettings
 * @property {string|null} model - Preferred model
 * @property {number|null} maxTokens - Max output tokens
 * @property {'auto'|'light'|'dark'} theme - UI theme
 * @property {boolean} verbose - Verbose output
 * @property {string[]} allowedTools - Always allowed tools
 * @property {string[]} disallowedTools - Never allowed tools
 * @property {boolean} autoApproveReadOnly - Auto-approve read-only tools
 * @property {string[]} autoApproveBashCommands - Auto-approved bash patterns
 * @property {string|null} preferredEditor - Preferred editor command
 * @property {boolean} notifyOnComplete - Show notification on completion
 * @property {boolean} saveHistory - Save conversation history
 * @property {number} maxHistorySize - Max history entries
 */

/**
 * Get the user settings file path
 * @returns {string}
 */
function getUserSettingsPath() {
    return join(getConfigDirectory(), SETTINGS_FILES.USER);
}

/**
 * Get the project settings file path
 * @param {string} projectRoot - Project root directory
 * @returns {string}
 */
function getProjectSettingsPath(projectRoot) {
    return join(projectRoot, SETTINGS_FILES.PROJECT);
}

/**
 * Get the local settings file path
 * @param {string} projectRoot - Project root directory
 * @returns {string}
 */
function getLocalSettingsPath(projectRoot) {
    return join(projectRoot, SETTINGS_FILES.LOCAL);
}

/**
 * Merge settings with defaults
 * @param {Partial<UserSettings>} settings - Partial settings
 * @returns {UserSettings}
 */
function mergeWithDefaults(settings) {
    return {
        ...DEFAULT_SETTINGS,
        ...settings,
        allowedTools: [
            ...DEFAULT_SETTINGS.allowedTools,
            ...(settings.allowedTools || [])
        ],
        disallowedTools: [
            ...DEFAULT_SETTINGS.disallowedTools,
            ...(settings.disallowedTools || [])
        ],
        autoApproveBashCommands: [
            ...DEFAULT_SETTINGS.autoApproveBashCommands,
            ...(settings.autoApproveBashCommands || [])
        ]
    };
}

/**
 * Merge multiple settings objects (later sources override earlier)
 * @param {...Partial<UserSettings>} settingsArray - Settings to merge
 * @returns {UserSettings}
 */
function mergeSettings(...settingsArray) {
    let merged = { ...DEFAULT_SETTINGS };

    for (const settings of settingsArray) {
        if (!settings) continue;

        merged = {
            ...merged,
            ...settings,
            // Arrays should be merged, not replaced
            allowedTools: [
                ...(merged.allowedTools || []),
                ...(settings.allowedTools || [])
            ],
            disallowedTools: [
                ...(merged.disallowedTools || []),
                ...(settings.disallowedTools || [])
            ],
            autoApproveBashCommands: [
                ...(merged.autoApproveBashCommands || []),
                ...(settings.autoApproveBashCommands || [])
            ]
        };
    }

    // Deduplicate arrays
    merged.allowedTools = [...new Set(merged.allowedTools)];
    merged.disallowedTools = [...new Set(merged.disallowedTools)];
    merged.autoApproveBashCommands = [...new Set(merged.autoApproveBashCommands)];

    return merged;
}

/**
 * Validate settings object
 * @param {Object} settings - Settings to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateSettings(settings) {
    const errors = [];

    if (settings.maxTokens !== undefined && settings.maxTokens !== null) {
        if (typeof settings.maxTokens !== 'number' || settings.maxTokens <= 0) {
            errors.push('maxTokens must be a positive number');
        }
    }

    if (settings.theme !== undefined) {
        if (!['auto', 'light', 'dark'].includes(settings.theme)) {
            errors.push('theme must be "auto", "light", or "dark"');
        }
    }

    if (settings.maxHistorySize !== undefined) {
        if (typeof settings.maxHistorySize !== 'number' || settings.maxHistorySize < 0) {
            errors.push('maxHistorySize must be a non-negative number');
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Check if a tool is allowed by settings
 * @param {UserSettings} settings - Settings object
 * @param {string} toolName - Tool name
 * @returns {boolean}
 */
function isToolAllowed(settings, toolName) {
    // Check disallowed first (takes precedence)
    if (settings.disallowedTools.includes(toolName)) {
        return false;
    }

    // If allowedTools is specified and non-empty, tool must be in it
    if (settings.allowedTools.length > 0) {
        return settings.allowedTools.includes(toolName);
    }

    // Default to allowed
    return true;
}

/**
 * Check if a bash command is auto-approved
 * @param {UserSettings} settings - Settings object
 * @param {string} command - Command to check
 * @returns {boolean}
 */
function isBashCommandAutoApproved(settings, command) {
    if (!settings.autoApproveBashCommands.length) {
        return false;
    }

    const normalizedCommand = command.trim();

    return settings.autoApproveBashCommands.some(pattern => {
        // Simple glob matching
        if (pattern.includes('*')) {
            const regex = new RegExp(
                '^' + pattern.replace(/\*/g, '.*') + '$'
            );
            return regex.test(normalizedCommand);
        }
        return normalizedCommand.startsWith(pattern);
    });
}

/**
 * Create settings object from CLI flags
 * @param {Object} flags - CLI flags
 * @returns {Partial<UserSettings>}
 */
function settingsFromFlags(flags) {
    const settings = {};

    if (flags.model) settings.model = flags.model;
    if (flags.maxTokens) settings.maxTokens = flags.maxTokens;
    if (flags.verbose) settings.verbose = flags.verbose;
    if (flags.allowedTools?.length) settings.allowedTools = flags.allowedTools;
    if (flags.disallowedTools?.length) settings.disallowedTools = flags.disallowedTools;

    return settings;
}

/**
 * Serialize settings to JSON
 * @param {UserSettings} settings - Settings to serialize
 * @returns {string}
 */
function serializeSettings(settings) {
    return JSON.stringify(settings, null, 2);
}

/**
 * Parse settings from JSON
 * @param {string} json - JSON string
 * @returns {Partial<UserSettings>}
 */
function parseSettings(json) {
    try {
        return JSON.parse(json);
    } catch {
        return {};
    }
}

export {
    SETTINGS_FILES,
    SETTING_SOURCES,
    DEFAULT_SETTINGS,
    getUserSettingsPath,
    getProjectSettingsPath,
    getLocalSettingsPath,
    mergeWithDefaults,
    mergeSettings,
    validateSettings,
    isToolAllowed,
    isBashCommandAutoApproved,
    settingsFromFlags,
    serializeSettings,
    parseSettings
};
