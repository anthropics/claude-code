/**
 * Model configuration and context utilities
 *
 * Handles Claude model identification, context windows, and token limits.
 */

import { getMaxContextWindow } from '../config/validators.js';

/**
 * Known Claude model identifiers
 */
const CLAUDE_MODELS = {
    // Claude 4.5 models
    OPUS_4_5: 'claude-opus-4-5-20251101',
    SONNET_4_5: 'claude-sonnet-4-5-20250116',

    // Claude 4 models
    OPUS_4: 'claude-opus-4-20250514',
    SONNET_4: 'claude-sonnet-4-20250514',

    // Claude 3.7 models
    SONNET_3_7: 'claude-3-7-sonnet-20250219',
    SONNET_3_7_LATEST: 'claude-3-7-sonnet-latest',

    // Claude 3.5 models
    SONNET_3_5: 'claude-3-5-sonnet-20241022',
    SONNET_3_5_V2: 'claude-3-5-sonnet-v2-20241022',
    HAIKU_3_5: 'claude-3-5-haiku-20241022',
    HAIKU_3_5_LATEST: 'claude-3-5-haiku-latest'
};

/**
 * Model families for grouping
 */
const MODEL_FAMILIES = {
    OPUS: ['claude-opus-4-5', 'claude-opus-4'],
    SONNET: ['claude-sonnet-4-5', 'claude-sonnet-4', 'claude-3-7-sonnet', 'claude-3-5-sonnet'],
    HAIKU: ['claude-haiku-4-5', 'claude-3-5-haiku']
};

/**
 * Check if a model ID is an Opus model
 * @param {string} modelId - Model identifier
 * @returns {boolean}
 */
function isOpusModel(modelId) {
    if (!modelId) return false;
    return MODEL_FAMILIES.OPUS.some((prefix) => modelId.startsWith(prefix));
}

/**
 * Check if a model ID is a Sonnet model
 * @param {string} modelId - Model identifier
 * @returns {boolean}
 */
function isSonnetModel(modelId) {
    if (!modelId) return false;
    return MODEL_FAMILIES.SONNET.some((prefix) => modelId.startsWith(prefix));
}

/**
 * Check if a model ID is a Haiku model
 * @param {string} modelId - Model identifier
 * @returns {boolean}
 */
function isHaikuModel(modelId) {
    if (!modelId) return false;
    return MODEL_FAMILIES.HAIKU.some((prefix) => modelId.startsWith(prefix));
}

/**
 * Get the model family (opus, sonnet, haiku)
 * @param {string} modelId - Model identifier
 * @returns {'opus'|'sonnet'|'haiku'|'unknown'}
 */
function getModelFamily(modelId) {
    if (isOpusModel(modelId)) return 'opus';
    if (isSonnetModel(modelId)) return 'sonnet';
    if (isHaikuModel(modelId)) return 'haiku';
    return 'unknown';
}

/**
 * Check if a model supports extended thinking
 * @param {string} modelId - Model identifier
 * @returns {boolean}
 */
function supportsExtendedThinking(modelId) {
    if (!modelId) return false;

    // Models with extended thinking support
    return (
        modelId.includes('claude-3-7-sonnet') ||
        modelId.includes('claude-sonnet-4') ||
        modelId.includes('claude-opus-4')
    );
}

/**
 * Check if a model has vision capabilities
 * @param {string} modelId - Model identifier
 * @returns {boolean}
 */
function hasVisionCapability(modelId) {
    // All Claude 3+ models have vision
    return modelId?.startsWith('claude-3') || modelId?.startsWith('claude-sonnet-4') || modelId?.startsWith('claude-opus-4');
}

/**
 * Get the default max tokens for a model
 * @param {string} modelId - Model identifier
 * @returns {number}
 */
function getDefaultMaxTokens(modelId) {
    // Newer models support higher output limits
    if (modelId?.includes('claude-opus-4') || modelId?.includes('claude-sonnet-4')) {
        return 16384;
    }
    if (modelId?.includes('claude-3-7-sonnet')) {
        return 16384;
    }
    return 8192;
}

/**
 * Estimate token count for text (rough approximation)
 * @param {string} text - Text to estimate
 * @returns {number} - Estimated token count
 */
function estimateTokenCount(text) {
    if (!text) return 0;

    // Rough estimation: ~4 characters per token for English
    // This is a simplification; actual tokenization is more complex
    return Math.ceil(text.length / 4);
}

/**
 * Calculate remaining context budget
 * @param {string} modelId - Model identifier
 * @param {number} usedTokens - Tokens already used
 * @returns {number} - Remaining tokens
 */
function getRemainingContextBudget(modelId, usedTokens) {
    const maxContext = getMaxContextWindow(modelId);
    return Math.max(0, maxContext - usedTokens);
}

/**
 * Check if context is near capacity
 * @param {string} modelId - Model identifier
 * @param {number} usedTokens - Tokens already used
 * @param {number} threshold - Warning threshold (0-1)
 * @returns {boolean}
 */
function isContextNearCapacity(modelId, usedTokens, threshold = 0.9) {
    const maxContext = getMaxContextWindow(modelId);
    return usedTokens >= maxContext * threshold;
}

/**
 * Model usage statistics
 * @typedef {Object} ModelUsage
 * @property {number} inputTokens - Input tokens used
 * @property {number} outputTokens - Output tokens used
 * @property {number} cacheReadInputTokens - Cache read input tokens
 * @property {number} cacheCreationInputTokens - Cache creation input tokens
 * @property {number} webSearchRequests - Web search requests
 * @property {number} costUSD - Cost in USD
 * @property {number} contextWindow - Context window size
 */

/**
 * Create empty model usage stats
 * @returns {ModelUsage}
 */
function createEmptyModelUsage() {
    return {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        webSearchRequests: 0,
        costUSD: 0,
        contextWindow: 0
    };
}

/**
 * Merge model usage stats
 * @param {ModelUsage} base - Base usage
 * @param {ModelUsage} addition - Usage to add
 * @returns {ModelUsage}
 */
function mergeModelUsage(base, addition) {
    return {
        inputTokens: base.inputTokens + addition.inputTokens,
        outputTokens: base.outputTokens + addition.outputTokens,
        cacheReadInputTokens: base.cacheReadInputTokens + addition.cacheReadInputTokens,
        cacheCreationInputTokens: base.cacheCreationInputTokens + addition.cacheCreationInputTokens,
        webSearchRequests: base.webSearchRequests + addition.webSearchRequests,
        costUSD: base.costUSD + addition.costUSD,
        contextWindow: Math.max(base.contextWindow, addition.contextWindow)
    };
}

export {
    CLAUDE_MODELS,
    MODEL_FAMILIES,
    isOpusModel,
    isSonnetModel,
    isHaikuModel,
    getModelFamily,
    supportsExtendedThinking,
    hasVisionCapability,
    getDefaultMaxTokens,
    estimateTokenCount,
    getRemainingContextBudget,
    isContextNearCapacity,
    createEmptyModelUsage,
    mergeModelUsage
};
