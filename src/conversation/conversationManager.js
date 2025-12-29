/**
 * Conversation Manager
 *
 * Manages conversation state, history, and turn management.
 */

import { createUserMessage, createAssistantMessage } from '../messages/messageTypes.js';

/**
 * Maximum turns before warning
 */
const DEFAULT_MAX_TURNS = 100;

/**
 * @typedef {Object} ConversationTurn
 * @property {string} role - 'user' or 'assistant'
 * @property {Array} content - Content blocks
 * @property {number} timestamp - Unix timestamp
 * @property {Object} [usage] - Token usage for this turn
 */

/**
 * @typedef {Object} ConversationState
 * @property {string} id - Conversation ID
 * @property {ConversationTurn[]} turns - Conversation history
 * @property {number} turnCount - Number of turns
 * @property {string|null} systemPrompt - System prompt
 * @property {Object} metadata - Additional metadata
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last update timestamp
 */

/**
 * Create a new conversation state
 * @param {string} [id] - Optional conversation ID
 * @param {string} [systemPrompt] - Optional system prompt
 * @returns {ConversationState}
 */
function createConversation(id, systemPrompt = null) {
    const now = Date.now();
    return {
        id: id || generateConversationId(),
        turns: [],
        turnCount: 0,
        systemPrompt,
        metadata: {},
        createdAt: now,
        updatedAt: now
    };
}

/**
 * Generate a unique conversation ID
 * @returns {string}
 */
function generateConversationId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `conv_${timestamp}_${random}`;
}

/**
 * Add a user message to the conversation
 * @param {ConversationState} state - Current state
 * @param {string|Array} content - Message content
 * @returns {ConversationState} - Updated state
 */
function addUserMessage(state, content) {
    const message = typeof content === 'string'
        ? createUserMessage(content)
        : { role: 'user', content };

    const turn = {
        ...message,
        timestamp: Date.now()
    };

    return {
        ...state,
        turns: [...state.turns, turn],
        turnCount: state.turnCount + 1,
        updatedAt: Date.now()
    };
}

/**
 * Add an assistant message to the conversation
 * @param {ConversationState} state - Current state
 * @param {string|Array} content - Message content
 * @param {Object} [usage] - Token usage
 * @returns {ConversationState} - Updated state
 */
function addAssistantMessage(state, content, usage) {
    const message = typeof content === 'string'
        ? createAssistantMessage(content)
        : { role: 'assistant', content };

    const turn = {
        ...message,
        timestamp: Date.now(),
        usage
    };

    return {
        ...state,
        turns: [...state.turns, turn],
        turnCount: state.turnCount + 1,
        updatedAt: Date.now()
    };
}

/**
 * Get messages formatted for API request
 * @param {ConversationState} state - Conversation state
 * @returns {Array} - Messages array for API
 */
function getMessagesForAPI(state) {
    return state.turns.map(turn => ({
        role: turn.role,
        content: turn.content
    }));
}

/**
 * Get the last message in the conversation
 * @param {ConversationState} state - Conversation state
 * @returns {ConversationTurn|null}
 */
function getLastMessage(state) {
    if (state.turns.length === 0) return null;
    return state.turns[state.turns.length - 1];
}

/**
 * Get the last user message
 * @param {ConversationState} state - Conversation state
 * @returns {ConversationTurn|null}
 */
function getLastUserMessage(state) {
    for (let i = state.turns.length - 1; i >= 0; i--) {
        if (state.turns[i].role === 'user') {
            return state.turns[i];
        }
    }
    return null;
}

/**
 * Get the last assistant message
 * @param {ConversationState} state - Conversation state
 * @returns {ConversationTurn|null}
 */
function getLastAssistantMessage(state) {
    for (let i = state.turns.length - 1; i >= 0; i--) {
        if (state.turns[i].role === 'assistant') {
            return state.turns[i];
        }
    }
    return null;
}

/**
 * Check if conversation has reached max turns
 * @param {ConversationState} state - Conversation state
 * @param {number} [maxTurns] - Maximum turns
 * @returns {boolean}
 */
function hasReachedMaxTurns(state, maxTurns = DEFAULT_MAX_TURNS) {
    return state.turnCount >= maxTurns;
}

/**
 * Calculate total tokens used in conversation
 * @param {ConversationState} state - Conversation state
 * @returns {{input: number, output: number}}
 */
function getTotalTokenUsage(state) {
    let input = 0;
    let output = 0;

    for (const turn of state.turns) {
        if (turn.usage) {
            input += turn.usage.inputTokens || 0;
            output += turn.usage.outputTokens || 0;
        }
    }

    return { input, output };
}

/**
 * Truncate conversation to last N turns
 * @param {ConversationState} state - Conversation state
 * @param {number} keepLast - Number of turns to keep
 * @returns {ConversationState}
 */
function truncateConversation(state, keepLast) {
    if (state.turns.length <= keepLast) return state;

    return {
        ...state,
        turns: state.turns.slice(-keepLast),
        updatedAt: Date.now()
    };
}

/**
 * Clear conversation history
 * @param {ConversationState} state - Conversation state
 * @returns {ConversationState}
 */
function clearConversation(state) {
    return {
        ...state,
        turns: [],
        turnCount: 0,
        updatedAt: Date.now()
    };
}

/**
 * Update conversation metadata
 * @param {ConversationState} state - Conversation state
 * @param {Object} metadata - Metadata to merge
 * @returns {ConversationState}
 */
function updateMetadata(state, metadata) {
    return {
        ...state,
        metadata: { ...state.metadata, ...metadata },
        updatedAt: Date.now()
    };
}

/**
 * Serialize conversation to JSON
 * @param {ConversationState} state - Conversation state
 * @returns {string}
 */
function serializeConversation(state) {
    return JSON.stringify(state, null, 2);
}

/**
 * Deserialize conversation from JSON
 * @param {string} json - JSON string
 * @returns {ConversationState}
 */
function deserializeConversation(json) {
    return JSON.parse(json);
}

/**
 * Check if conversation is empty
 * @param {ConversationState} state - Conversation state
 * @returns {boolean}
 */
function isConversationEmpty(state) {
    return state.turns.length === 0;
}

/**
 * Get conversation duration in milliseconds
 * @param {ConversationState} state - Conversation state
 * @returns {number}
 */
function getConversationDuration(state) {
    return state.updatedAt - state.createdAt;
}

export {
    DEFAULT_MAX_TURNS,
    createConversation,
    generateConversationId,
    addUserMessage,
    addAssistantMessage,
    getMessagesForAPI,
    getLastMessage,
    getLastUserMessage,
    getLastAssistantMessage,
    hasReachedMaxTurns,
    getTotalTokenUsage,
    truncateConversation,
    clearConversation,
    updateMetadata,
    serializeConversation,
    deserializeConversation,
    isConversationEmpty,
    getConversationDuration
};
