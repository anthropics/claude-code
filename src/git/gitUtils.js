/**
 * Git Utilities
 *
 * Helper functions for working with Git repositories.
 */

import { spawn } from 'child_process';

/**
 * Git command options
 */
const GIT_OPTIONS = {
    /** Abort commit (with -m flag) */
    ABBREV_COMMIT: '--abbrev-commit',
    /** Show abbreviated ref */
    ABBREV_REF: '--abbrev-ref',
    /** All branches */
    ALL: '--all',
    /** Amend last commit */
    AMEND: '--amend',
    /** Number of commits to show */
    MAX_COUNT: '-n',
    /** One line format */
    ONELINE: '--oneline',
    /** Porcelain output */
    PORCELAIN: '--porcelain',
    /** Short output */
    SHORT: '--short',
    /** Quiet output */
    QUIET: '-q',
    /** Force */
    FORCE: '-f',
    /** No verify hooks */
    NO_VERIFY: '--no-verify'
};

/**
 * Common git commands
 */
const GIT_COMMANDS = {
    ADD: 'add',
    BRANCH: 'branch',
    CHECKOUT: 'checkout',
    COMMIT: 'commit',
    DIFF: 'diff',
    FETCH: 'fetch',
    INIT: 'init',
    LOG: 'log',
    MERGE: 'merge',
    PULL: 'pull',
    PUSH: 'push',
    REBASE: 'rebase',
    RESET: 'reset',
    RESTORE: 'restore',
    REV_PARSE: 'rev-parse',
    SHOW: 'show',
    STASH: 'stash',
    STATUS: 'status',
    SWITCH: 'switch',
    TAG: 'tag'
};

/**
 * Execute a git command
 * @param {string[]} args - Git command arguments
 * @param {Object} [options] - Spawn options
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
function execGit(args, options = {}) {
    return new Promise((resolve, reject) => {
        const process = spawn('git', args, {
            cwd: options.cwd || process.cwd(),
            env: { ...process.env, ...options.env }
        });

        let stdout = '';
        let stderr = '';

        process.stdout?.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (exitCode) => {
            resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: exitCode || 0 });
        });

        process.on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Check if current directory is a git repository
 * @param {string} [cwd] - Working directory
 * @returns {Promise<boolean>}
 */
async function isGitRepository(cwd) {
    try {
        const result = await execGit([GIT_COMMANDS.REV_PARSE, '--git-dir'], { cwd });
        return result.exitCode === 0;
    } catch {
        return false;
    }
}

/**
 * Get the current branch name
 * @param {string} [cwd] - Working directory
 * @returns {Promise<string|null>}
 */
async function getCurrentBranch(cwd) {
    try {
        const result = await execGit([GIT_COMMANDS.REV_PARSE, GIT_OPTIONS.ABBREV_REF, 'HEAD'], { cwd });
        return result.exitCode === 0 ? result.stdout : null;
    } catch {
        return null;
    }
}

/**
 * Get the repository root directory
 * @param {string} [cwd] - Working directory
 * @returns {Promise<string|null>}
 */
async function getRepositoryRoot(cwd) {
    try {
        const result = await execGit([GIT_COMMANDS.REV_PARSE, '--show-toplevel'], { cwd });
        return result.exitCode === 0 ? result.stdout : null;
    } catch {
        return null;
    }
}

/**
 * Get git status
 * @param {string} [cwd] - Working directory
 * @param {boolean} [short=false] - Use short format
 * @returns {Promise<string>}
 */
async function getStatus(cwd, short = false) {
    const args = [GIT_COMMANDS.STATUS];
    if (short) args.push(GIT_OPTIONS.SHORT);

    const result = await execGit(args, { cwd });
    return result.stdout;
}

/**
 * @typedef {Object} StatusEntry
 * @property {string} path - File path
 * @property {string} index - Index status (staged)
 * @property {string} workTree - Work tree status
 */

/**
 * Parse git status porcelain output
 * @param {string} output - Porcelain output
 * @returns {StatusEntry[]}
 */
function parseStatusPorcelain(output) {
    if (!output) return [];

    return output.split('\n').filter(Boolean).map(line => {
        const index = line[0];
        const workTree = line[1];
        const path = line.substring(3);

        return { path, index, workTree };
    });
}

/**
 * Get staged files
 * @param {string} [cwd] - Working directory
 * @returns {Promise<string[]>}
 */
async function getStagedFiles(cwd) {
    const result = await execGit([GIT_COMMANDS.STATUS, GIT_OPTIONS.PORCELAIN], { cwd });
    const entries = parseStatusPorcelain(result.stdout);

    return entries
        .filter(e => e.index !== ' ' && e.index !== '?')
        .map(e => e.path);
}

/**
 * Get modified files (unstaged)
 * @param {string} [cwd] - Working directory
 * @returns {Promise<string[]>}
 */
async function getModifiedFiles(cwd) {
    const result = await execGit([GIT_COMMANDS.STATUS, GIT_OPTIONS.PORCELAIN], { cwd });
    const entries = parseStatusPorcelain(result.stdout);

    return entries
        .filter(e => e.workTree !== ' ' && e.workTree !== '?')
        .map(e => e.path);
}

/**
 * Get untracked files
 * @param {string} [cwd] - Working directory
 * @returns {Promise<string[]>}
 */
async function getUntrackedFiles(cwd) {
    const result = await execGit([GIT_COMMANDS.STATUS, GIT_OPTIONS.PORCELAIN], { cwd });
    const entries = parseStatusPorcelain(result.stdout);

    return entries
        .filter(e => e.index === '?' && e.workTree === '?')
        .map(e => e.path);
}

/**
 * Get the diff of staged changes
 * @param {string} [cwd] - Working directory
 * @returns {Promise<string>}
 */
async function getStagedDiff(cwd) {
    const result = await execGit([GIT_COMMANDS.DIFF, '--cached'], { cwd });
    return result.stdout;
}

/**
 * Get recent commits
 * @param {number} [count=5] - Number of commits
 * @param {string} [cwd] - Working directory
 * @returns {Promise<string>}
 */
async function getRecentCommits(count = 5, cwd) {
    const result = await execGit([
        GIT_COMMANDS.LOG,
        GIT_OPTIONS.ONELINE,
        GIT_OPTIONS.MAX_COUNT,
        String(count)
    ], { cwd });
    return result.stdout;
}

/**
 * @typedef {Object} CommitInfo
 * @property {string} hash - Commit hash
 * @property {string} message - Commit message
 */

/**
 * Parse oneline log output
 * @param {string} output - Oneline log output
 * @returns {CommitInfo[]}
 */
function parseOnelineLog(output) {
    if (!output) return [];

    return output.split('\n').filter(Boolean).map(line => {
        const spaceIndex = line.indexOf(' ');
        return {
            hash: line.substring(0, spaceIndex),
            message: line.substring(spaceIndex + 1)
        };
    });
}

/**
 * Get the default branch name
 * @param {string} [cwd] - Working directory
 * @returns {Promise<string>}
 */
async function getDefaultBranch(cwd) {
    // Try to get from remote
    const result = await execGit([
        'symbolic-ref',
        'refs/remotes/origin/HEAD',
        '--short'
    ], { cwd });

    if (result.exitCode === 0 && result.stdout) {
        // Returns something like "origin/main"
        const parts = result.stdout.split('/');
        return parts[parts.length - 1];
    }

    // Fall back to common defaults
    const branches = ['main', 'master'];
    for (const branch of branches) {
        const check = await execGit([GIT_COMMANDS.REV_PARSE, '--verify', branch], { cwd });
        if (check.exitCode === 0) return branch;
    }

    return 'main';
}

/**
 * Check if there are uncommitted changes
 * @param {string} [cwd] - Working directory
 * @returns {Promise<boolean>}
 */
async function hasUncommittedChanges(cwd) {
    const result = await execGit([GIT_COMMANDS.STATUS, GIT_OPTIONS.PORCELAIN], { cwd });
    return result.stdout.length > 0;
}

export {
    GIT_OPTIONS,
    GIT_COMMANDS,
    execGit,
    isGitRepository,
    getCurrentBranch,
    getRepositoryRoot,
    getStatus,
    parseStatusPorcelain,
    getStagedFiles,
    getModifiedFiles,
    getUntrackedFiles,
    getStagedDiff,
    getRecentCommits,
    parseOnelineLog,
    getDefaultBranch,
    hasUncommittedChanges
};
