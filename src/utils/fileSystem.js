/**
 * File system utilities with performance monitoring
 *
 * Wraps Node.js fs operations with timing to detect slow operations.
 */

import * as fs from 'fs';
import { stat as statAsync, open as openAsync } from 'fs/promises';

const SLOW_OPERATION_THRESHOLD_MS = 5;

/**
 * Wrap a synchronous operation with performance timing
 * @param {string} operationName - Name of the fs operation
 * @param {Function} operation - The operation to execute
 * @returns {*} - The result of the operation
 */
function withPerformanceTiming(operationName, operation) {
    const startTime = performance.now();
    try {
        return operation();
    } finally {
        const duration = performance.now() - startTime;
        if (duration > SLOW_OPERATION_THRESHOLD_MS) {
            console.warn(`[SLOW OPERATION DETECTED] fs.${operationName} (${duration.toFixed(1)}ms)`);
        }
    }
}

/**
 * Resolve symlinks and check if path is a symlink
 * @param {object} fileSystemAdapter - File system adapter
 * @param {string} filePath - Path to check
 * @returns {{resolvedPath: string, isSymlink: boolean}}
 */
function resolveSymlink(fileSystemAdapter, filePath) {
    if (!fileSystemAdapter.existsSync(filePath)) {
        return { resolvedPath: filePath, isSymlink: false };
    }

    try {
        const realPath = fileSystemAdapter.realpathSync(filePath);
        return {
            resolvedPath: realPath,
            isSymlink: realPath !== filePath
        };
    } catch (error) {
        return { resolvedPath: filePath, isSymlink: false };
    }
}

/**
 * Check if path has already been visited (for cycle detection)
 * @param {object} fileSystemAdapter - File system adapter
 * @param {string} filePath - Path to check
 * @param {Set<string>} visitedPaths - Set of already visited paths
 * @returns {boolean} - True if path was already visited
 */
function hasVisitedPath(fileSystemAdapter, filePath, visitedPaths) {
    const { resolvedPath } = resolveSymlink(fileSystemAdapter, filePath);

    if (visitedPaths.has(resolvedPath)) {
        return true;
    }

    visitedPaths.add(resolvedPath);
    return false;
}

/**
 * Get all possible paths for a file (original + resolved symlink)
 * @param {string} filePath - Original file path
 * @returns {string[]} - Array of paths
 */
function getAllPossiblePaths(filePath) {
    const paths = [filePath];
    const fileSystemAdapter = getFileSystemAdapter();

    const { resolvedPath, isSymlink } = resolveSymlink(fileSystemAdapter, filePath);

    if (isSymlink && resolvedPath !== filePath) {
        paths.push(resolvedPath);
    }

    return paths;
}

/**
 * Read file lines in reverse (from end to beginning)
 * @param {string} filePath - Path to the file
 * @yields {string} - Lines from the file in reverse order
 */
async function* readLinesReverse(filePath) {
    const fileHandle = await openAsync(filePath, 'r');

    try {
        const stats = await fileHandle.stat();
        let remainingBytes = stats.size;
        let partialLine = '';
        const buffer = Buffer.alloc(4096);

        while (remainingBytes > 0) {
            const bytesToRead = Math.min(4096, remainingBytes);
            remainingBytes -= bytesToRead;

            await fileHandle.read(buffer, 0, bytesToRead, remainingBytes);

            const chunk = buffer.toString('utf8', 0, bytesToRead);
            const lines = (chunk + partialLine).split('\n');

            partialLine = lines[0] || '';

            for (let i = lines.length - 1; i >= 1; i--) {
                const line = lines[i];
                if (line) {
                    yield line;
                }
            }
        }

        if (partialLine) {
            yield partialLine;
        }
    } finally {
        await fileHandle.close();
    }
}

/**
 * Create a file system adapter with wrapped operations
 * @returns {object} - File system adapter
 */
function createFileSystemAdapter() {
    return {
        cwd() {
            return process.cwd();
        },

        existsSync(path) {
            return withPerformanceTiming('existsSync', () => fs.existsSync(path));
        },

        async stat(path) {
            return statAsync(path);
        },

        statSync(path) {
            return withPerformanceTiming('statSync', () => fs.statSync(path));
        },

        lstatSync(path) {
            return withPerformanceTiming('lstatSync', () => fs.lstatSync(path));
        },

        readFileSync(path, options) {
            return withPerformanceTiming('readFileSync', () =>
                fs.readFileSync(path, { encoding: options.encoding })
            );
        },

        readFileBytesSync(path) {
            return withPerformanceTiming('readFileBytesSync', () => fs.readFileSync(path));
        },

        readSync(path, options) {
            return withPerformanceTiming('readSync', () => {
                let fileDescriptor;
                try {
                    fileDescriptor = fs.openSync(path, 'r');
                    const buffer = Buffer.alloc(options.length);
                    const bytesRead = fs.readSync(fileDescriptor, buffer, 0, options.length, 0);
                    return { buffer, bytesRead };
                } finally {
                    if (fileDescriptor) {
                        fs.closeSync(fileDescriptor);
                    }
                }
            });
        },

        writeFileSync(path, data, options) {
            return withPerformanceTiming('writeFileSync', () => {
                const fileExists = fs.existsSync(path);

                if (!options.flush) {
                    const writeOptions = { encoding: options.encoding };
                    if (!fileExists) {
                        writeOptions.mode = options.mode ?? 0o600;
                    } else if (options.mode !== undefined) {
                        writeOptions.mode = options.mode;
                    }
                    fs.writeFileSync(path, data, writeOptions);
                    return;
                }

                let fileDescriptor;
                try {
                    const mode = !fileExists ? (options.mode ?? 0o600) : options.mode;
                    fileDescriptor = fs.openSync(path, 'w', mode);
                    fs.writeFileSync(fileDescriptor, data, { encoding: options.encoding });
                    fs.fsyncSync(fileDescriptor);
                } finally {
                    if (fileDescriptor) {
                        fs.closeSync(fileDescriptor);
                    }
                }
            });
        },

        appendFileSync(path, data, options) {
            return withPerformanceTiming('appendFileSync', () => {
                if (!fs.existsSync(path)) {
                    const mode = options?.mode ?? 0o600;
                    const fileDescriptor = fs.openSync(path, 'a', mode);
                    try {
                        fs.appendFileSync(fileDescriptor, data);
                    } finally {
                        fs.closeSync(fileDescriptor);
                    }
                } else {
                    fs.appendFileSync(path, data);
                }
            });
        },

        copyFileSync(source, destination) {
            return withPerformanceTiming('copyFileSync', () =>
                fs.copyFileSync(source, destination)
            );
        },

        unlinkSync(path) {
            return withPerformanceTiming('unlinkSync', () => fs.unlinkSync(path));
        },

        renameSync(oldPath, newPath) {
            return withPerformanceTiming('renameSync', () => fs.renameSync(oldPath, newPath));
        },

        linkSync(existingPath, newPath) {
            return withPerformanceTiming('linkSync', () => fs.linkSync(existingPath, newPath));
        },

        symlinkSync(target, path) {
            return withPerformanceTiming('symlinkSync', () => fs.symlinkSync(target, path));
        },

        readlinkSync(path) {
            return withPerformanceTiming('readlinkSync', () => fs.readlinkSync(path));
        },

        realpathSync(path) {
            return withPerformanceTiming('realpathSync', () => fs.realpathSync(path));
        },

        mkdirSync(path) {
            return withPerformanceTiming('mkdirSync', () => {
                if (!fs.existsSync(path)) {
                    fs.mkdirSync(path, { recursive: true, mode: 0o700 });
                }
            });
        },

        readdirSync(path) {
            return withPerformanceTiming('readdirSync', () =>
                fs.readdirSync(path, { withFileTypes: true })
            );
        },

        readdirStringSync(path) {
            return withPerformanceTiming('readdirStringSync', () => fs.readdirSync(path));
        },

        isDirEmptySync(path) {
            return withPerformanceTiming('isDirEmptySync', () => {
                return this.readdirSync(path).length === 0;
            });
        },

        rmdirSync(path) {
            return withPerformanceTiming('rmdirSync', () => fs.rmdirSync(path));
        },

        rmSync(path, options) {
            return withPerformanceTiming('rmSync', () => fs.rmSync(path, options));
        },

        createWriteStream(path) {
            return fs.createWriteStream(path);
        }
    };
}

// Singleton instance
let fileSystemAdapterInstance = null;

/**
 * Get the file system adapter singleton
 * @returns {object} - File system adapter
 */
function getFileSystemAdapter() {
    if (!fileSystemAdapterInstance) {
        fileSystemAdapterInstance = createFileSystemAdapter();
    }
    return fileSystemAdapterInstance;
}

export {
    withPerformanceTiming,
    resolveSymlink,
    hasVisitedPath,
    getAllPossiblePaths,
    readLinesReverse,
    createFileSystemAdapter,
    getFileSystemAdapter,
    SLOW_OPERATION_THRESHOLD_MS
};
