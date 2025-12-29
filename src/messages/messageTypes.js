/**
 * Message Types and Content Blocks
 *
 * Defines message structures for Claude API communication.
 */

/**
 * Message roles
 */
const MessageRole = {
    USER: 'user',
    ASSISTANT: 'assistant',
    SYSTEM: 'system'
};

/**
 * Content block types
 */
const ContentBlockType = {
    TEXT: 'text',
    IMAGE: 'image',
    TOOL_USE: 'tool_use',
    TOOL_RESULT: 'tool_result',
    THINKING: 'thinking',
    REDACTED_THINKING: 'redacted_thinking'
};

/**
 * Stop reasons for API responses
 */
const StopReason = {
    END_TURN: 'end_turn',
    MAX_TOKENS: 'max_tokens',
    STOP_SEQUENCE: 'stop_sequence',
    TOOL_USE: 'tool_use'
};

/**
 * Image media types supported
 */
const ImageMediaType = {
    JPEG: 'image/jpeg',
    PNG: 'image/png',
    GIF: 'image/gif',
    WEBP: 'image/webp'
};

/**
 * @typedef {Object} TextContent
 * @property {'text'} type
 * @property {string} text
 */

/**
 * @typedef {Object} ImageContent
 * @property {'image'} type
 * @property {Object} source
 * @property {'base64'} source.type
 * @property {string} source.media_type
 * @property {string} source.data
 */

/**
 * @typedef {Object} ToolUseContent
 * @property {'tool_use'} type
 * @property {string} id
 * @property {string} name
 * @property {Object} input
 */

/**
 * @typedef {Object} ToolResultContent
 * @property {'tool_result'} type
 * @property {string} tool_use_id
 * @property {string|Array} content
 * @property {boolean} [is_error]
 */

/**
 * @typedef {Object} ThinkingContent
 * @property {'thinking'} type
 * @property {string} thinking
 */

/**
 * @typedef {TextContent|ImageContent|ToolUseContent|ToolResultContent|ThinkingContent} ContentBlock
 */

/**
 * @typedef {Object} Message
 * @property {string} role
 * @property {ContentBlock[]} content
 */

/**
 * Create a text content block
 * @param {string} text - Text content
 * @returns {TextContent}
 */
function createTextContent(text) {
    return {
        type: ContentBlockType.TEXT,
        text
    };
}

/**
 * Create an image content block
 * @param {string} base64Data - Base64 encoded image data
 * @param {string} mediaType - Image media type
 * @returns {ImageContent}
 */
function createImageContent(base64Data, mediaType) {
    return {
        type: ContentBlockType.IMAGE,
        source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Data
        }
    };
}

/**
 * Create a tool use content block
 * @param {string} id - Tool use ID
 * @param {string} name - Tool name
 * @param {Object} input - Tool input parameters
 * @returns {ToolUseContent}
 */
function createToolUseContent(id, name, input) {
    return {
        type: ContentBlockType.TOOL_USE,
        id,
        name,
        input
    };
}

/**
 * Create a tool result content block
 * @param {string} toolUseId - The tool_use ID this is responding to
 * @param {string|Array} content - Result content
 * @param {boolean} [isError=false] - Whether this is an error result
 * @returns {ToolResultContent}
 */
function createToolResultContent(toolUseId, content, isError = false) {
    const result = {
        type: ContentBlockType.TOOL_RESULT,
        tool_use_id: toolUseId,
        content
    };

    if (isError) {
        result.is_error = true;
    }

    return result;
}

/**
 * Create a thinking content block
 * @param {string} thinking - Thinking text
 * @returns {ThinkingContent}
 */
function createThinkingContent(thinking) {
    return {
        type: ContentBlockType.THINKING,
        thinking
    };
}

/**
 * Create a message
 * @param {string} role - Message role
 * @param {ContentBlock|ContentBlock[]} content - Message content
 * @returns {Message}
 */
function createMessage(role, content) {
    return {
        role,
        content: Array.isArray(content) ? content : [content]
    };
}

/**
 * Create a user message
 * @param {string|ContentBlock[]} content - Text or content blocks
 * @returns {Message}
 */
function createUserMessage(content) {
    if (typeof content === 'string') {
        return createMessage(MessageRole.USER, createTextContent(content));
    }
    return createMessage(MessageRole.USER, content);
}

/**
 * Create an assistant message
 * @param {string|ContentBlock[]} content - Text or content blocks
 * @returns {Message}
 */
function createAssistantMessage(content) {
    if (typeof content === 'string') {
        return createMessage(MessageRole.ASSISTANT, createTextContent(content));
    }
    return createMessage(MessageRole.ASSISTANT, content);
}

/**
 * Extract text from content blocks
 * @param {ContentBlock[]} content - Content blocks
 * @returns {string} - Combined text
 */
function extractTextFromContent(content) {
    if (!Array.isArray(content)) return '';

    return content
        .filter(block => block.type === ContentBlockType.TEXT)
        .map(block => block.text)
        .join('\n');
}

/**
 * Extract tool uses from content blocks
 * @param {ContentBlock[]} content - Content blocks
 * @returns {ToolUseContent[]} - Tool use blocks
 */
function extractToolUses(content) {
    if (!Array.isArray(content)) return [];

    return content.filter(block => block.type === ContentBlockType.TOOL_USE);
}

/**
 * Check if content contains tool use
 * @param {ContentBlock[]} content - Content blocks
 * @returns {boolean}
 */
function hasToolUse(content) {
    return extractToolUses(content).length > 0;
}

/**
 * Check if message has thinking blocks
 * @param {ContentBlock[]} content - Content blocks
 * @returns {boolean}
 */
function hasThinkingContent(content) {
    if (!Array.isArray(content)) return false;
    return content.some(block =>
        block.type === ContentBlockType.THINKING ||
        block.type === ContentBlockType.REDACTED_THINKING
    );
}

export {
    MessageRole,
    ContentBlockType,
    StopReason,
    ImageMediaType,
    createTextContent,
    createImageContent,
    createToolUseContent,
    createToolResultContent,
    createThinkingContent,
    createMessage,
    createUserMessage,
    createAssistantMessage,
    extractTextFromContent,
    extractToolUses,
    hasToolUse,
    hasThinkingContent
};
