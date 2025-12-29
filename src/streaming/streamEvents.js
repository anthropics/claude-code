/**
 * Streaming Event Types and Handlers
 *
 * Defines event types for streaming API responses and utilities for processing them.
 */

/**
 * Server-Sent Event types from the Anthropic API
 */
const StreamEventType = {
    // Message lifecycle events
    MESSAGE_START: 'message_start',
    MESSAGE_DELTA: 'message_delta',
    MESSAGE_STOP: 'message_stop',

    // Content block events
    CONTENT_BLOCK_START: 'content_block_start',
    CONTENT_BLOCK_DELTA: 'content_block_delta',
    CONTENT_BLOCK_STOP: 'content_block_stop',

    // Ping/keep-alive
    PING: 'ping',

    // Error events
    ERROR: 'error'
};

/**
 * Content block delta types
 */
const DeltaType = {
    TEXT_DELTA: 'text_delta',
    INPUT_JSON_DELTA: 'input_json_delta',
    THINKING_DELTA: 'thinking_delta'
};

/**
 * @typedef {Object} StreamEvent
 * @property {string} type - Event type
 * @property {Object} [message] - Message data (for message events)
 * @property {number} [index] - Content block index
 * @property {Object} [content_block] - Content block data
 * @property {Object} [delta] - Delta data
 * @property {Object} [usage] - Token usage data
 * @property {Object} [error] - Error data
 */

/**
 * @typedef {Object} StreamState
 * @property {string|null} messageId - Current message ID
 * @property {string} model - Model being used
 * @property {Array} contentBlocks - Accumulated content blocks
 * @property {Object} usage - Token usage statistics
 * @property {string|null} stopReason - Reason for stopping
 * @property {boolean} isComplete - Whether stream is complete
 */

/**
 * Create initial stream state
 * @returns {StreamState}
 */
function createStreamState() {
    return {
        messageId: null,
        model: '',
        contentBlocks: [],
        usage: {
            inputTokens: 0,
            outputTokens: 0
        },
        stopReason: null,
        isComplete: false
    };
}

/**
 * Process a message_start event
 * @param {StreamState} state - Current state
 * @param {Object} event - The event data
 * @returns {StreamState} - Updated state
 */
function processMessageStart(state, event) {
    const message = event.message || {};
    return {
        ...state,
        messageId: message.id || null,
        model: message.model || state.model,
        usage: {
            inputTokens: message.usage?.input_tokens || 0,
            outputTokens: message.usage?.output_tokens || 0
        }
    };
}

/**
 * Process a content_block_start event
 * @param {StreamState} state - Current state
 * @param {Object} event - The event data
 * @returns {StreamState} - Updated state
 */
function processContentBlockStart(state, event) {
    const index = event.index ?? state.contentBlocks.length;
    const contentBlock = event.content_block || { type: 'text', text: '' };

    const newBlocks = [...state.contentBlocks];
    newBlocks[index] = { ...contentBlock };

    return {
        ...state,
        contentBlocks: newBlocks
    };
}

/**
 * Process a content_block_delta event
 * @param {StreamState} state - Current state
 * @param {Object} event - The event data
 * @returns {StreamState} - Updated state
 */
function processContentBlockDelta(state, event) {
    const index = event.index ?? 0;
    const delta = event.delta || {};

    const newBlocks = [...state.contentBlocks];
    if (!newBlocks[index]) {
        newBlocks[index] = { type: 'text', text: '' };
    }

    const block = { ...newBlocks[index] };

    // Handle different delta types
    if (delta.type === DeltaType.TEXT_DELTA && delta.text) {
        block.text = (block.text || '') + delta.text;
    } else if (delta.type === DeltaType.INPUT_JSON_DELTA && delta.partial_json) {
        block.partial_json = (block.partial_json || '') + delta.partial_json;
    } else if (delta.type === DeltaType.THINKING_DELTA && delta.thinking) {
        block.thinking = (block.thinking || '') + delta.thinking;
    }

    newBlocks[index] = block;

    return {
        ...state,
        contentBlocks: newBlocks
    };
}

/**
 * Process a message_delta event
 * @param {StreamState} state - Current state
 * @param {Object} event - The event data
 * @returns {StreamState} - Updated state
 */
function processMessageDelta(state, event) {
    const delta = event.delta || {};
    const usage = event.usage || {};

    return {
        ...state,
        stopReason: delta.stop_reason || state.stopReason,
        usage: {
            inputTokens: state.usage.inputTokens,
            outputTokens: usage.output_tokens || state.usage.outputTokens
        }
    };
}

/**
 * Process a message_stop event
 * @param {StreamState} state - Current state
 * @returns {StreamState} - Updated state
 */
function processMessageStop(state) {
    return {
        ...state,
        isComplete: true
    };
}

/**
 * Process any stream event
 * @param {StreamState} state - Current state
 * @param {StreamEvent} event - The event to process
 * @returns {StreamState} - Updated state
 */
function processStreamEvent(state, event) {
    switch (event.type) {
        case StreamEventType.MESSAGE_START:
            return processMessageStart(state, event);
        case StreamEventType.CONTENT_BLOCK_START:
            return processContentBlockStart(state, event);
        case StreamEventType.CONTENT_BLOCK_DELTA:
            return processContentBlockDelta(state, event);
        case StreamEventType.CONTENT_BLOCK_STOP:
            // No state change needed
            return state;
        case StreamEventType.MESSAGE_DELTA:
            return processMessageDelta(state, event);
        case StreamEventType.MESSAGE_STOP:
            return processMessageStop(state);
        case StreamEventType.PING:
            // No state change needed
            return state;
        case StreamEventType.ERROR:
            return {
                ...state,
                error: event.error,
                isComplete: true
            };
        default:
            return state;
    }
}

/**
 * Extract accumulated text from stream state
 * @param {StreamState} state - Stream state
 * @returns {string} - Accumulated text
 */
function getAccumulatedText(state) {
    return state.contentBlocks
        .filter(block => block.type === 'text')
        .map(block => block.text || '')
        .join('');
}

/**
 * Extract tool uses from stream state
 * @param {StreamState} state - Stream state
 * @returns {Array} - Tool use blocks
 */
function getToolUses(state) {
    return state.contentBlocks.filter(block => block.type === 'tool_use');
}

/**
 * Check if stream has error
 * @param {StreamState} state - Stream state
 * @returns {boolean}
 */
function hasStreamError(state) {
    return !!state.error;
}

/**
 * Parse a Server-Sent Event line
 * @param {string} line - SSE line
 * @returns {{field: string, value: string}|null}
 */
function parseSSELine(line) {
    if (!line || line.startsWith(':')) {
        return null; // Comment or empty
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
        return { field: line, value: '' };
    }

    const field = line.substring(0, colonIndex);
    let value = line.substring(colonIndex + 1);

    // Remove leading space if present
    if (value.startsWith(' ')) {
        value = value.substring(1);
    }

    return { field, value };
}

/**
 * Parse SSE data as JSON event
 * @param {string} data - SSE data field value
 * @returns {StreamEvent|null}
 */
function parseEventData(data) {
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

export {
    StreamEventType,
    DeltaType,
    createStreamState,
    processMessageStart,
    processContentBlockStart,
    processContentBlockDelta,
    processMessageDelta,
    processMessageStop,
    processStreamEvent,
    getAccumulatedText,
    getToolUses,
    hasStreamError,
    parseSSELine,
    parseEventData
};
