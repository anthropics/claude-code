/**
 * Environment configuration utilities
 *
 * Handles environment variables, paths, and runtime configuration.
 */

import { join } from 'path';
import { homedir } from 'os';

/**
 * Get the Claude config directory path
 * @returns {string} - Config directory path
 */
function getConfigDirectory() {
    return process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
}

/**
 * Parse a string value as boolean (truthy)
 * @param {string|boolean|undefined} value - Value to parse
 * @returns {boolean} - Parsed boolean value
 */
function parseBooleanTruthy(value) {
    if (!value) {
        return false;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    const normalizedValue = value.toLowerCase().trim();
    return ['1', 'true', 'yes', 'on'].includes(normalizedValue);
}

/**
 * Parse a string value as boolean (falsy)
 * @param {string|boolean|undefined} value - Value to parse
 * @returns {boolean} - True if value is explicitly false
 */
function parseBooleanFalsy(value) {
    if (value === undefined) {
        return false;
    }

    if (typeof value === 'boolean') {
        return !value;
    }

    if (!value) {
        return false;
    }

    const normalizedValue = value.toLowerCase().trim();
    return ['0', 'false', 'no', 'off'].includes(normalizedValue);
}

/**
 * Parse environment variables from command line format
 * @param {string[]} envVarArgs - Array of KEY=value strings
 * @returns {object} - Parsed environment variables
 */
function parseEnvironmentVariables(envVarArgs) {
    const result = {};

    if (envVarArgs) {
        for (const envVar of envVarArgs) {
            const [key, ...valueParts] = envVar.split('=');

            if (!key || valueParts.length === 0) {
                throw new Error(
                    `Invalid environment variable format: ${envVar}, ` +
                    `environment variables should be added as: -e KEY1=value1 -e KEY2=value2`
                );
            }

            result[key] = valueParts.join('=');
        }
    }

    return result;
}

/**
 * Get the AWS region from environment
 * @returns {string} - AWS region
 */
function getAwsRegion() {
    return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
}

/**
 * Get the Cloud ML region from environment
 * @returns {string} - Cloud ML region
 */
function getCloudMlRegion() {
    return process.env.CLOUD_ML_REGION || 'us-east5';
}

/**
 * Check if Bash should maintain project working directory
 * @returns {boolean}
 */
function shouldMaintainProjectWorkingDir() {
    return parseBooleanTruthy(process.env.CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR);
}

/**
 * Get Vertex region for a specific Claude model
 * @param {string} modelId - Claude model ID
 * @returns {string} - Vertex region
 */
function getVertexRegionForModel(modelId) {
    const defaultRegion = getCloudMlRegion();

    if (modelId?.startsWith('claude-haiku-4-5')) {
        return process.env.VERTEX_REGION_CLAUDE_HAIKU_4_5 || defaultRegion;
    }

    if (modelId?.startsWith('claude-3-5-haiku')) {
        return process.env.VERTEX_REGION_CLAUDE_3_5_HAIKU || defaultRegion;
    }

    if (modelId?.startsWith('claude-3-5-sonnet')) {
        return process.env.VERTEX_REGION_CLAUDE_3_5_SONNET || defaultRegion;
    }

    if (modelId?.startsWith('claude-3-7-sonnet')) {
        return process.env.VERTEX_REGION_CLAUDE_3_7_SONNET || defaultRegion;
    }

    if (modelId?.startsWith('claude-opus-4-1')) {
        return process.env.VERTEX_REGION_CLAUDE_4_1_OPUS || defaultRegion;
    }

    if (modelId?.startsWith('claude-opus-4')) {
        return process.env.VERTEX_REGION_CLAUDE_4_0_OPUS || defaultRegion;
    }

    if (modelId?.startsWith('claude-sonnet-4-5')) {
        return process.env.VERTEX_REGION_CLAUDE_4_5_SONNET || defaultRegion;
    }

    if (modelId?.startsWith('claude-sonnet-4')) {
        return process.env.VERTEX_REGION_CLAUDE_4_0_SONNET || defaultRegion;
    }

    return defaultRegion;
}

/**
 * No-op function for placeholder callbacks
 */
const noop = () => {};

export {
    getConfigDirectory,
    parseBooleanTruthy,
    parseBooleanFalsy,
    parseEnvironmentVariables,
    getAwsRegion,
    getCloudMlRegion,
    shouldMaintainProjectWorkingDir,
    getVertexRegionForModel,
    noop
};
