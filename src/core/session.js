/**
 * Session state management
 *
 * Manages global session state for Claude Code.
 */

import { cwd } from 'process';
import { realpathSync } from 'fs';
import { randomUUID } from 'crypto';
import { bashMaxOutputLengthValidator, maxOutputTokensValidator } from '../config/validators.js';

/**
 * Create initial session state
 * @returns {object} - Initial session state
 */
function createInitialSessionState() {
    let originalCwd = '';

    if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
        originalCwd = realpathSync(cwd());
    }

    return {
        // Directory tracking
        originalCwd,
        cwd: originalCwd,

        // Cost and timing metrics
        totalCostUSD: 0,
        totalAPIDuration: 0,
        totalAPIDurationWithoutRetries: 0,
        totalToolDuration: 0,
        startTime: Date.now(),
        lastInteractionTime: Date.now(),

        // Code change metrics
        totalLinesAdded: 0,
        totalLinesRemoved: 0,

        // Model state
        hasUnknownModelCost: false,
        modelUsage: {},
        mainLoopModelOverride: undefined,
        initialMainLoopModel: null,
        modelStrings: null,

        // Session configuration
        isInteractive: false,
        clientType: 'cli',
        sessionIngressToken: undefined,
        oauthTokenFromFd: undefined,
        apiKeyFromFd: undefined,
        flagSettingsPath: undefined,
        allowedSettingSources: [
            'userSettings',
            'projectSettings',
            'localSettings',
            'flagSettings',
            'policySettings'
        ],

        // Telemetry
        meter: null,
        sessionCounter: null,
        locCounter: null,
        prCounter: null,
        commitCounter: null,
        costCounter: null,
        tokenCounter: null,
        codeEditToolDecisionCounter: null,
        activeTimeCounter: null,

        // Session identification
        sessionId: randomUUID(),

        // Logging
        loggerProvider: null,
        eventLogger: null,
        meterProvider: null,
        tracerProvider: null,

        // Agent display
        agentColorMap: new Map(),
        agentColorIndex: 0,

        // Validators
        envVarValidators: [bashMaxOutputLengthValidator, maxOutputTokensValidator],

        // Error tracking
        lastAPIRequest: null,
        inMemoryErrorLog: [],

        // Plugin state
        inlinePlugins: [],

        // Permission state
        sessionBypassPermissionsMode: false,
        sessionPersistenceDisabled: false,

        // Plan mode state
        hasExitedPlanMode: false,
        needsPlanModeExitAttachment: false,

        // Delegate mode state
        hasExitedDelegateMode: false,
        needsDelegateModeExitAttachment: false,

        // UI state
        lspRecommendationShownThisSession: false,

        // Schema
        initJsonSchema: null,

        // Hooks
        registeredHooks: null,

        // Plan caching
        planSlugCache: new Map(),

        // Remote session info
        teleportedSessionInfo: null
    };
}

// Global session state singleton
let sessionState = null;

/**
 * Get or create the session state
 * @returns {object} - Session state
 */
function getSessionState() {
    if (!sessionState) {
        sessionState = createInitialSessionState();
    }
    return sessionState;
}

/**
 * Reset session state (mainly for testing)
 */
function resetSessionState() {
    sessionState = createInitialSessionState();
}

/**
 * Update session state
 * @param {object} updates - Partial state updates
 */
function updateSessionState(updates) {
    const state = getSessionState();
    Object.assign(state, updates);
}

export {
    createInitialSessionState,
    getSessionState,
    resetSessionState,
    updateSessionState
};
