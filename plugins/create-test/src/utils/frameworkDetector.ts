/**
 * Framework Detector
 *
 * Inspects project configuration files to determine which test framework is in
 * use, so the test generator can emit idiomatic code without the user having to
 * specify `--framework` manually.
 *
 * Detection order (first match wins):
 *   1. Caller-supplied override (--framework flag)
 *   2. package.json → devDependencies / dependencies / scripts.test
 *   3. jest.config.* or vitest.config.* existence
 *   4. pyproject.toml → [tool.pytest.ini_options]
 *   5. requirements.txt containing "pytest"
 *   6. go.mod existence (Go projects always use the built-in test runner)
 *   7. Default → jest
 */

import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type SupportedFramework =
  | 'jest'
  | 'vitest'
  | 'mocha'
  | 'pytest'
  | 'go-test';

export interface DetectionResult {
  framework: SupportedFramework;
  /** Confidence level — how certain we are about the detection. */
  confidence: 'explicit' | 'detected' | 'default';
  /** Path of the config file that triggered detection (for diagnostics). */
  detectedFrom?: string;
  /** Command to run the full test suite (e.g. "npm test"). */
  runCommand: string;
  /** Command to run tests with coverage. */
  coverageCommand: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect the test framework for the project rooted at `projectRoot`.
 *
 * @param projectRoot  Absolute path to the project root directory.
 * @param override     Optional framework name supplied via `--framework` flag.
 */
export function detectFramework(
  projectRoot: string,
  override?: string,
): DetectionResult {
  // ── 1. Explicit override ──────────────────────────────────────────────────
  if (override) {
    const framework = normalizeFramework(override);
    return {
      framework,
      confidence: 'explicit',
      ...commands(framework),
    };
  }

  // ── 2. package.json ───────────────────────────────────────────────────────
  const pkgJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    const result = detectFromPackageJson(pkgJsonPath);
    if (result) return result;
  }

  // ── 3. Framework config files ─────────────────────────────────────────────
  const configResult = detectFromConfigFiles(projectRoot);
  if (configResult) return configResult;

  // ── 4. pyproject.toml ─────────────────────────────────────────────────────
  const pyprojectPath = path.join(projectRoot, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    const content = fs.readFileSync(pyprojectPath, 'utf-8');
    if (content.includes('[tool.pytest') || content.includes('pytest')) {
      return {
        framework: 'pytest',
        confidence: 'detected',
        detectedFrom: pyprojectPath,
        ...commands('pytest'),
      };
    }
  }

  // ── 5. requirements.txt ───────────────────────────────────────────────────
  for (const reqFile of ['requirements.txt', 'requirements-dev.txt']) {
    const reqPath = path.join(projectRoot, reqFile);
    if (fs.existsSync(reqPath)) {
      const content = fs.readFileSync(reqPath, 'utf-8');
      if (/^pytest(\s|==|>=|$)/m.test(content)) {
        return {
          framework: 'pytest',
          confidence: 'detected',
          detectedFrom: reqPath,
          ...commands('pytest'),
        };
      }
    }
  }

  // ── 6. go.mod ─────────────────────────────────────────────────────────────
  const goModPath = path.join(projectRoot, 'go.mod');
  if (fs.existsSync(goModPath)) {
    return {
      framework: 'go-test',
      confidence: 'detected',
      detectedFrom: goModPath,
      ...commands('go-test'),
    };
  }

  // ── 7. Default ────────────────────────────────────────────────────────────
  return {
    framework: 'jest',
    confidence: 'default',
    ...commands('jest'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Parse package.json and look for known test-framework signatures. */
function detectFromPackageJson(pkgJsonPath: string): DetectionResult | null {
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')) as Record<
      string,
      unknown
    >;
  } catch {
    return null; // malformed JSON — skip
  }

  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  const allDeps = { ...deps, ...devDeps };
  const testScript =
    typeof (pkg as { scripts?: { test?: string } }).scripts?.test === 'string'
      ? ((pkg as { scripts: { test: string } }).scripts.test as string)
      : '';

  // Priority: vitest > jest > mocha (vitest is often added alongside jest)
  const checks: Array<[string, SupportedFramework]> = [
    ['vitest', 'vitest'],
    ['jest', 'jest'],
    ['@jest/core', 'jest'],
    ['ts-jest', 'jest'],
    ['mocha', 'mocha'],
  ];

  for (const [dep, framework] of checks) {
    if (allDeps[dep] !== undefined) {
      return {
        framework,
        confidence: 'detected',
        detectedFrom: pkgJsonPath,
        ...commands(framework),
      };
    }
  }

  // Fall back to the test script text
  if (/\bvitest\b/.test(testScript)) {
    return {
      framework: 'vitest',
      confidence: 'detected',
      detectedFrom: pkgJsonPath,
      ...commands('vitest'),
    };
  }
  if (/\bjest\b/.test(testScript)) {
    return {
      framework: 'jest',
      confidence: 'detected',
      detectedFrom: pkgJsonPath,
      ...commands('jest'),
    };
  }
  if (/\bmocha\b/.test(testScript)) {
    return {
      framework: 'mocha',
      confidence: 'detected',
      detectedFrom: pkgJsonPath,
      ...commands('mocha'),
    };
  }

  return null;
}

/** Look for well-known config file names in the project root. */
function detectFromConfigFiles(projectRoot: string): DetectionResult | null {
  const vitestConfigs = [
    'vitest.config.ts',
    'vitest.config.js',
    'vitest.config.mts',
  ];
  for (const f of vitestConfigs) {
    const full = path.join(projectRoot, f);
    if (fs.existsSync(full)) {
      return {
        framework: 'vitest',
        confidence: 'detected',
        detectedFrom: full,
        ...commands('vitest'),
      };
    }
  }

  const jestConfigs = [
    'jest.config.ts',
    'jest.config.js',
    'jest.config.mjs',
    'jest.config.cjs',
  ];
  for (const f of jestConfigs) {
    const full = path.join(projectRoot, f);
    if (fs.existsSync(full)) {
      return {
        framework: 'jest',
        confidence: 'detected',
        detectedFrom: full,
        ...commands('jest'),
      };
    }
  }

  const mochaConfigs = ['.mocharc.js', '.mocharc.yml', '.mocharc.json'];
  for (const f of mochaConfigs) {
    const full = path.join(projectRoot, f);
    if (fs.existsSync(full)) {
      return {
        framework: 'mocha',
        confidence: 'detected',
        detectedFrom: full,
        ...commands('mocha'),
      };
    }
  }

  if (fs.existsSync(path.join(projectRoot, 'pytest.ini')) ||
      fs.existsSync(path.join(projectRoot, 'setup.cfg'))) {
    return {
      framework: 'pytest',
      confidence: 'detected',
      detectedFrom: path.join(projectRoot, 'pytest.ini'),
      ...commands('pytest'),
    };
  }

  return null;
}

/** Validate and normalize a user-supplied framework string. */
function normalizeFramework(value: string): SupportedFramework {
  const normalized = value.toLowerCase().trim();
  const valid: SupportedFramework[] = [
    'jest',
    'vitest',
    'mocha',
    'pytest',
    'go-test',
  ];
  if (valid.includes(normalized as SupportedFramework)) {
    return normalized as SupportedFramework;
  }
  throw new Error(
    `Unknown framework "${value}". Valid options: ${valid.join(', ')}`,
  );
}

/** Return the run and coverage commands for a given framework. */
function commands(framework: SupportedFramework): {
  runCommand: string;
  coverageCommand: string;
} {
  switch (framework) {
    case 'jest':
      return {
        runCommand: 'npx jest',
        coverageCommand: 'npx jest --coverage',
      };
    case 'vitest':
      return {
        runCommand: 'npx vitest run',
        coverageCommand: 'npx vitest run --coverage',
      };
    case 'mocha':
      return {
        runCommand: 'npx mocha',
        coverageCommand: 'npx nyc mocha',
      };
    case 'pytest':
      return {
        runCommand: 'pytest',
        coverageCommand: 'pytest --cov',
      };
    case 'go-test':
      return {
        runCommand: 'go test ./...',
        coverageCommand: 'go test -cover ./...',
      };
  }
}
