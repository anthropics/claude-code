/**
 * Output utilities for stdout/stderr writing
 *
 * These functions handle chunked output writing to avoid buffer issues
 * with large outputs.
 */

const CHUNK_SIZE = 2000;

/**
 * Write string to stdout in chunks
 * @param {string} text - Text to write
 */
function writeToStdout(text) {
    for (let offset = 0; offset < text.length; offset += CHUNK_SIZE) {
        process.stdout.write(text.substring(offset, offset + CHUNK_SIZE));
    }
}

/**
 * Write string to stderr in chunks
 * @param {string} text - Text to write
 */
function writeToStderr(text) {
    for (let offset = 0; offset < text.length; offset += CHUNK_SIZE) {
        process.stderr.write(text.substring(offset, offset + CHUNK_SIZE));
    }
}

module.exports = {
    writeToStdout,
    writeToStderr,
    CHUNK_SIZE
};
