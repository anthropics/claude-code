#!/usr/bin/env node
/**
 * createTest  —  CLI entry point
 *
 * Orchestrates the full pipeline:
 *   1. Parse and validate arguments
 *   2. Validate that the source file exists
 *   3. Detect the test framework
 *   4. Discover existing test conventions (location, file naming)
 *   5. Analyze the source file structure
 *   6. Generate the test file content
 *   7. Show a preview (always shown; skips write when --preview is set)
 *   8. Check for an existing test file (blocked by --force)
 *   9. Write the test file to disk
 *
 * Usage:
 *   npx ts-node src/commands/createTest.ts <file-path> [options]
 *
 * Options:
 *   --framework <jest|vitest|mocha|pytest|go-test>  Override framework detection
 *   --output <path>                                  Custom output path
 *   --preview                                        Print generated tests but do not write
 *   --force                                          Overwrite an existing test file
 *   --coverage-hints                                 Emit extra edge-case tests
 *   --help                                           Show this help text
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

import { analyzeFile } from '../analyzers/fileAnalyzer';
import { detectFramework } from '../utils/frameworkDetector';
import { generateTests } from '../generators/testGenerator';

// ─────────────────────────────────────────────────────────────────────────────
// CLI argument types
// ─────────────────────────────────────────────────────────────────────────────

interface CliArgs {
  filePath: string;
  framework?: string;
  output?: string;
  preview: boolean;
  force: boolean;
  coverageHints: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // ── 1. Validate source file ───────────────────────────────────────────────
  const absoluteSource = path.resolve(args.filePath);
  if (!fs.existsSync(absoluteSource)) {
    die(`File not found: ${args.filePath}\nPlease supply a valid path to the source file.`);
  }

  // ── 2. Detect framework ───────────────────────────────────────────────────
  const projectRoot = findProjectRoot(absoluteSource);
  const detection = detectFramework(projectRoot, args.framework);

  log(`Framework: ${detection.framework} (${detection.confidence}${
    detection.detectedFrom
      ? ` from ${path.relative(process.cwd(), detection.detectedFrom)}`
      : ''
  })`);

  // ── 3. Analyze the source file ────────────────────────────────────────────
  log(`Analyzing: ${path.relative(process.cwd(), absoluteSource)}`);
  const analyzed = analyzeFile(absoluteSource);

  const symbolCount =
    analyzed.functions.length + analyzed.classes.length;
  if (symbolCount === 0) {
    warn(
      'No exported symbols found. The generated file will contain a placeholder suite.\n' +
        'Make sure the file has at least one `export function` or `export class`.',
    );
  }

  // ── 4. Determine output path ──────────────────────────────────────────────
  const testFilePath = args.output
    ? path.resolve(args.output)
    : inferTestFilePath(absoluteSource, projectRoot, detection.framework);

  log(`Test file: ${path.relative(process.cwd(), testFilePath)}`);

  // ── 5. Generate test content ──────────────────────────────────────────────
  const testContent = generateTests(analyzed, detection.framework, {
    coverageHints: args.coverageHints,
  });

  // ── 6. Preview ────────────────────────────────────────────────────────────
  console.log('\n─── Preview ─────────────────────────────────────────────────\n');
  console.log(testContent);
  console.log('─────────────────────────────────────────────────────────────\n');

  if (args.preview) {
    log('--preview flag set: file not written.');
    process.exit(0);
  }

  // ── 7. Guard against overwriting ──────────────────────────────────────────
  if (fs.existsSync(testFilePath) && !args.force) {
    const answer = await prompt(
      `Test file already exists at ${path.relative(process.cwd(), testFilePath)}.\n` +
        'Overwrite? (y/N) ',
    );
    if (!answer.toLowerCase().startsWith('y')) {
      log('Aborted. Use --force to overwrite without confirmation.');
      process.exit(0);
    }
  }

  // ── 8. Write the test file ────────────────────────────────────────────────
  const testDir = path.dirname(testFilePath);
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(testFilePath, testContent, 'utf-8');

  log(`\nTest file written: ${path.relative(process.cwd(), testFilePath)}`);
  log(`\nNext steps:`);
  log(`  Run tests  : ${detection.runCommand}`);
  log(`  Coverage   : ${detection.coverageCommand}`);
  log(`  Fill TODOs : search the file for "TODO" comments`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Output path inference
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Infer where the test file should live by examining existing test conventions
 * in the project. Falls back to co-location next to the source file.
 */
function inferTestFilePath(
  sourcePath: string,
  projectRoot: string,
  framework: string,
): string {
  const sourceDir = path.dirname(sourcePath);
  const baseName = path.basename(sourcePath);
  const testBaseName = testFileName(baseName, framework);

  // ── Strategy A: co-located (most common) ──────────────────────────────────
  const colocated = path.join(sourceDir, testBaseName);
  if (hasTestsColocated(projectRoot)) {
    return colocated;
  }

  // ── Strategy B: __tests__ sibling directory ────────────────────────────────
  const sibling = path.join(sourceDir, '__tests__', testBaseName);
  if (hasTestsInSiblingDir(projectRoot)) {
    return sibling;
  }

  // ── Strategy C: top-level tests/ or test/ directory ────────────────────────
  const topLevelDir = findTopLevelTestDir(projectRoot);
  if (topLevelDir) {
    // Mirror source tree under the test directory
    const relSource = path.relative(projectRoot, sourceDir);
    return path.join(topLevelDir, relSource, testBaseName);
  }

  // ── Default: co-locate ────────────────────────────────────────────────────
  return colocated;
}

/** Derive the test file name from a source file name. */
function testFileName(baseName: string, framework: string): string {
  if (framework === 'go-test') {
    // Go convention: foo.go → foo_test.go
    return baseName.replace(/\.go$/, '_test.go');
  }
  if (framework === 'pytest') {
    // Python convention: foo.py → test_foo.py
    return `test_${baseName}`;
  }

  // TypeScript/JavaScript: detect whether the project uses .spec. or .test.
  const ext = path.extname(baseName); // e.g. ".ts"
  const stem = baseName.slice(0, -ext.length); // e.g. "authService"
  return `${stem}.test${ext}`; // e.g. "authService.test.ts"
}

/** True when the project has existing *.test.* files next to their source. */
function hasTestsColocated(projectRoot: string): boolean {
  return findFirstMatch(projectRoot, /\.(test|spec)\.[jt]sx?$/, 2);
}

/** True when the project uses __tests__ sibling directories. */
function hasTestsInSiblingDir(projectRoot: string): boolean {
  return directoryExists(path.join(projectRoot, 'src', '__tests__')) ||
    directoryExists(path.join(projectRoot, '__tests__'));
}

/** Return the path of the top-level test directory, if one exists. */
function findTopLevelTestDir(projectRoot: string): string | null {
  for (const candidate of ['tests', 'test', 'spec']) {
    const full = path.join(projectRoot, candidate);
    if (directoryExists(full)) return full;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Project root discovery
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Walk up the directory tree from `startDir` until we find a package.json,
 * go.mod, pyproject.toml, or .git — whichever comes first.
 * Falls back to the cwd if nothing is found.
 */
function findProjectRoot(startDir: string): string {
  const rootMarkers = ['package.json', 'go.mod', 'pyproject.toml', '.git'];
  let dir = fs.statSync(startDir).isDirectory() ? startDir : path.dirname(startDir);

  while (true) {
    for (const marker of rootMarkers) {
      if (fs.existsSync(path.join(dir, marker))) return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  return process.cwd();
}

// ─────────────────────────────────────────────────────────────────────────────
// Argument parsing  (no external dependencies)
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): CliArgs {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const result: Partial<CliArgs> = {
    preview: false,
    force: false,
    coverageHints: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--framework' || arg === '-f') {
      result.framework = requireNextArg(argv, i, '--framework');
      i++;
    } else if (arg.startsWith('--framework=')) {
      result.framework = arg.split('=')[1];
    } else if (arg === '--output' || arg === '-o') {
      result.output = requireNextArg(argv, i, '--output');
      i++;
    } else if (arg.startsWith('--output=')) {
      result.output = arg.split('=')[1];
    } else if (arg === '--preview') {
      result.preview = true;
    } else if (arg === '--force') {
      result.force = true;
    } else if (arg === '--coverage-hints') {
      result.coverageHints = true;
    } else if (!arg.startsWith('-')) {
      if (!result.filePath) {
        result.filePath = arg;
      }
    } else {
      die(`Unknown option: ${arg}\nRun with --help for usage information.`);
    }
  }

  if (!result.filePath) {
    die('Missing required argument: <file-path>\nRun with --help for usage information.');
  }

  return result as CliArgs;
}

function requireNextArg(argv: string[], i: number, flag: string): string {
  if (i + 1 >= argv.length || argv[i + 1].startsWith('-')) {
    die(`${flag} requires a value`);
  }
  return argv[i + 1];
}

function printHelp(): void {
  console.log(`
create-test — Automatically generate unit tests for a source file

Usage:
  create-test <file-path> [options]

Options:
  --framework <name>   Test framework: jest | vitest | mocha | pytest | go-test
                       (auto-detected from project config when omitted)
  --output <path>      Write the test file to this path instead of the default
  --preview            Print the generated test file but do not write it
  --force              Overwrite an existing test file without prompting
  --coverage-hints     Emit extra edge-case and boundary-value tests
  --help, -h           Show this help text

Examples:
  create-test src/services/authService.ts
  create-test src/utils/parser.py --framework pytest
  create-test pkg/api/handler.go --output pkg/api/handler_test.go
  create-test src/lib/math.ts --preview --coverage-hints
`.trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// Small utilities
// ─────────────────────────────────────────────────────────────────────────────

function log(msg: string): void {
  console.log(`[create-test] ${msg}`);
}

function warn(msg: string): void {
  console.warn(`[create-test] WARNING: ${msg}`);
}

function die(msg: string): never {
  console.error(`[create-test] ERROR: ${msg}`);
  process.exit(1);
}

function directoryExists(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Walk the directory tree (BFS, max `maxDepth` levels) and return true when
 * any file matches `pattern`.
 */
function findFirstMatch(
  rootDir: string,
  pattern: RegExp,
  maxDepth: number,
): boolean {
  const queue: Array<[string, number]> = [[rootDir, 0]];

  while (queue.length) {
    const [dir, depth] = queue.shift()!;
    if (depth > maxDepth) continue;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      // Skip common noise directories
      if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
        continue;
      }
      if (entry.isFile() && pattern.test(entry.name)) return true;
      if (entry.isDirectory()) queue.push([path.join(dir, entry.name), depth + 1]);
    }
  }

  return false;
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

main().catch((err: unknown) => {
  die(err instanceof Error ? err.message : String(err));
});
