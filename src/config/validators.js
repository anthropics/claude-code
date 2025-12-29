/**
 * Environment variable validators
 *
 * Validates and normalizes environment variable values with defaults and caps.
 */

/**
 * @typedef {Object} ValidationResult
 * @property {number} effective - The effective value to use
 * @property {'valid'|'invalid'|'capped'} status - Validation status
 * @property {string} [message] - Optional message for invalid/capped values
 */

/**
 * Validator for BASH_MAX_OUTPUT_LENGTH environment variable
 */
const bashMaxOutputLengthValidator = {
    name: 'BASH_MAX_OUTPUT_LENGTH',
    default: 30000,

    /**
     * Validate the environment variable value
     * @param {string|undefined} value - The value to validate
     * @returns {ValidationResult}
     */
    validate(value) {
        if (!value) {
            return { effective: 30000, status: 'valid' };
        }

        const parsed = parseInt(value, 10);

        if (isNaN(parsed) || parsed <= 0) {
            return {
                effective: 30000,
                status: 'invalid',
                message: `Invalid value "${value}" (using default: 30000)`
            };
        }

        if (parsed > 150000) {
            return {
                effective: 150000,
                status: 'capped',
                message: `Capped from ${parsed} to 150000`
            };
        }

        return { effective: parsed, status: 'valid' };
    }
};

/**
 * Validator for CLAUDE_CODE_MAX_OUTPUT_TOKENS environment variable
 */
const maxOutputTokensValidator = {
    name: 'CLAUDE_CODE_MAX_OUTPUT_TOKENS',
    default: 32000,

    /**
     * Validate the environment variable value
     * @param {string|undefined} value - The value to validate
     * @returns {ValidationResult}
     */
    validate(value) {
        if (!value) {
            return { effective: 32000, status: 'valid' };
        }

        const parsed = parseInt(value, 10);

        if (isNaN(parsed) || parsed <= 0) {
            return {
                effective: 32000,
                status: 'invalid',
                message: `Invalid value "${value}" (using default: 32000)`
            };
        }

        if (parsed > 64000) {
            return {
                effective: 64000,
                status: 'capped',
                message: `Capped from ${parsed} to 64000`
            };
        }

        return { effective: parsed, status: 'valid' };
    }
};

/**
 * Get max context window size for a model
 * @param {string} modelId - Model identifier
 * @returns {number} - Context window size
 */
function getMaxContextWindow(modelId) {
    // Extended context models
    if (modelId.includes('[1m]')) {
        return 1000000;
    }
    return 200000;
}

/**
 * Default max tool output tokens
 */
const DEFAULT_MAX_TOOL_OUTPUT_TOKENS = 20000;

export {
    bashMaxOutputLengthValidator,
    maxOutputTokensValidator,
    getMaxContextWindow,
    DEFAULT_MAX_TOOL_OUTPUT_TOKENS
};
