# create-test

A Claude Code plugin that analyzes a source file and automatically generates a corresponding unit test file — complete with framework detection, dependency mocking, and structured test suites.

---

## Features

- **Automatic framework detection** — reads `package.json`, `pyproject.toml`, `requirements.txt`, or `go.mod` to pick the right test framework
- **Smart output path detection** — mirrors the project's existing test structure (`__tests__/`, `tests/`, or colocated)
- **Structured test generation** — groups tests by function/class with happy path, edge cases, and error cases
- **Dependency mocking** — identifies external imports (databases, HTTP clients, queues) and generates mock stubs
- **Language support** — TypeScript, JavaScript, Python, Go
- **Non-destructive by default** — will not overwrite existing test files unless `--force` is set

---

## Installation

Copy this plugin directory to your Claude Code plugins folder or reference it via `--plugin-dir`:

```bash
cc --plugin-dir /path/to/create-test
```

Or install globally in your Claude Code configuration.

---

## Usage

```
/create-test <file-path> [options]
```

### Options

| Flag | Description |
|------|-------------|
| `--framework <name>` | Override detected framework (`jest`, `vitest`, `mocha`, `pytest`, `go-test`) |
| `--output <path>` | Custom output path for the generated test file |
| `--preview` | Show the generated test before writing it to disk |
| `--force` | Overwrite an existing test file |

### Examples

```bash
# Basic usage — auto-detect everything
/create-test src/services/authService.ts

# Override framework
/create-test src/utils/dateHelpers.ts --framework vitest

# Custom output location
/create-test src/api/userController.ts --output tests/unit/userController.test.ts

# Preview before writing
/create-test src/lib/validator.ts --preview

# Overwrite an existing test
/create-test src/services/authService.ts --force
```

---

## Framework Detection Logic

| Project file | Framework detected |
|---|---|
| `package.json` with `vitest` | vitest |
| `package.json` with `jest` / `ts-jest` | jest |
| `package.json` with `mocha` | mocha |
| `requirements.txt` / `pyproject.toml` with `pytest` | pytest |
| `go.mod` present | go-test |
| *(none of the above)* | jest (default) |

---

## Test File Naming Conventions

| Language | Source file | Test file |
|---|---|---|
| TypeScript / JS | `authService.ts` | `authService.test.ts` |
| TypeScript / JS (spec) | `authService.ts` | `authService.spec.ts` |
| Python | `auth_service.py` | `test_auth_service.py` |
| Go | `auth_service.go` | `auth_service_test.go` |

---

## Example: Generated Jest Test

**Source file:** `src/services/authService.ts`

```typescript
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../database';

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthToken {
  token: string;
  expiresAt: Date;
}

export async function login(input: LoginInput): Promise<AuthToken> {
  const user = await db.users.findByEmail(input.email);
  if (!user) throw new Error('User not found');

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new Error('Invalid credentials');

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '1h' });
  return { token, expiresAt: new Date(Date.now() + 3600_000) };
}

export async function logout(userId: string): Promise<void> {
  await db.sessions.deleteByUserId(userId);
}
```

**Generated:** `src/services/authService.test.ts`

```typescript
import { login, logout, LoginInput } from './authService';

// Mock external dependencies
jest.mock('../database');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

import { db } from '../database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const mockDb = db as jest.Mocked<typeof db>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('AuthService', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  // ── login ────────────────────────────────────────────────────────────────

  describe('login', () => {

    it('should return an auth token for valid credentials', async () => {
      // Arrange
      // TODO: configure mock user record
      const mockUser = { id: 'user-1', email: 'user@example.com', passwordHash: 'hashed' };
      (mockDb.users.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);
      (mockJwt.sign as jest.Mock).mockReturnValue('signed-token');

      const input: LoginInput = {
        email: 'user@example.com',
        // TODO: provide test password
        password: 'correct-password',
      };

      // Act
      const result = await login(input);

      // Assert
      expect(result.token).toBe('signed-token');
      expect(result.expiresAt).toBeInstanceOf(Date);
      // TODO: assert expiresAt is approximately 1 hour from now
    });

    it('should throw when the user is not found', async () => {
      // Arrange
      (mockDb.users.findByEmail as jest.Mock).mockResolvedValue(null);

      const input: LoginInput = {
        email: 'unknown@example.com',
        password: 'any-password',
      };

      // Act & Assert
      await expect(login(input)).rejects.toThrow('User not found');
    });

    it('should throw when the password is incorrect', async () => {
      // Arrange
      const mockUser = { id: 'user-1', email: 'user@example.com', passwordHash: 'hashed' };
      (mockDb.users.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

      const input: LoginInput = {
        email: 'user@example.com',
        password: 'wrong-password',
      };

      // Act & Assert
      await expect(login(input)).rejects.toThrow('Invalid credentials');
    });

    it('should propagate database errors', async () => {
      // Arrange
      (mockDb.users.findByEmail as jest.Mock).mockRejectedValue(new Error('DB connection failed'));

      const input: LoginInput = {
        email: 'user@example.com',
        password: 'password',
      };

      // Act & Assert
      await expect(login(input)).rejects.toThrow('DB connection failed');
    });

  });

  // ── logout ───────────────────────────────────────────────────────────────

  describe('logout', () => {

    it('should delete the user session', async () => {
      // Arrange
      (mockDb.sessions.deleteByUserId as jest.Mock).mockResolvedValue(undefined);
      // TODO: provide a realistic user ID
      const userId = 'user-1';

      // Act
      await logout(userId);

      // Assert
      expect(mockDb.sessions.deleteByUserId).toHaveBeenCalledWith(userId);
      expect(mockDb.sessions.deleteByUserId).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from the session store', async () => {
      // Arrange
      (mockDb.sessions.deleteByUserId as jest.Mock).mockRejectedValue(new Error('Session store unavailable'));

      // Act & Assert
      await expect(logout('user-1')).rejects.toThrow('Session store unavailable');
    });

  });

});
```

---

## Architecture

The plugin uses two specialized agents orchestrated by the command:

```
/create-test
    │
    ├─► source-analyzer agent
    │     Reads the source file and produces structured analysis:
    │     exports, parameters, return types, async behavior,
    │     external dependencies, and recommended test cases
    │
    └─► test-generator agent
          Takes the analysis + framework + project conventions
          and produces the complete, ready-to-edit test file
```

### Files

```
plugins/create-test/
├── .claude-plugin/
│   └── plugin.json          Plugin manifest
├── commands/
│   └── create-test.md       Main command — orchestrates the workflow
├── agents/
│   ├── source-analyzer.md   Analyzes source files for test generation
│   └── test-generator.md    Generates complete test files from analysis
└── README.md                This file
```

---

## Supported Languages

| Language | Frameworks | Mocking |
|---|---|---|
| TypeScript | Jest, Vitest, Mocha | `jest.mock()` / `vi.mock()` / sinon |
| JavaScript | Jest, Vitest, Mocha | Same as TypeScript |
| Python | pytest | `unittest.mock.patch`, `MagicMock` |
| Go | go test | Interface mocks, testify |

---

## Developer Notes

Generated tests are intentionally incomplete. Every non-trivial assertion and test data definition includes a `// TODO:` comment. The goal is to provide structure and boilerplate so developers can focus on writing meaningful assertions, not scaffolding.

Tests are always runnable immediately after generation — no syntax errors, no missing imports. They will fail until the TODOs are completed.
