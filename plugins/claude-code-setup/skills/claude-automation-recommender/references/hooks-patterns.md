# Hooks Recommendations

Hooks automatically run commands in response to Claude's tool usage. They're ideal for enforcement and automation that should happen consistently.

## Auto-Formatting Hooks

### Prettier (JavaScript/TypeScript)
| Detection | File Exists |
|-----------|-------------|
| `.prettierrc`, `.prettierrc.json`, `prettier.config.js` | ✓ |

**Recommend**: PostToolUse hook on Edit/Write to auto-format
**Value**: Code stays formatted without thinking about it

### ESLint (JavaScript/TypeScript)
| Detection | File Exists |
|-----------|-------------|
| `.eslintrc`, `.eslintrc.json`, `eslint.config.js` | ✓ |

**Recommend**: PostToolUse hook on Edit/Write to auto-fix
**Value**: Lint errors fixed automatically

### Black/isort (Python)
| Detection | File Exists |
|-----------|-------------|
| `pyproject.toml` with black/isort, `.black`, `setup.cfg` | ✓ |

**Recommend**: PostToolUse hook to format Python files
**Value**: Consistent Python formatting

### Ruff (Python - Modern)
| Detection | File Exists |
|-----------|-------------|
| `ruff.toml`, `pyproject.toml` with `[tool.ruff]` | ✓ |

**Recommend**: PostToolUse hook for lint + format
**Value**: Fast, comprehensive Python linting

### gofmt (Go)
| Detection | File Exists |
|-----------|-------------|
| `go.mod` | ✓ |

**Recommend**: PostToolUse hook to run gofmt
**Value**: Standard Go formatting

### rustfmt (Rust)
| Detection | File Exists |
|-----------|-------------|
| `Cargo.toml` | ✓ |

**Recommend**: PostToolUse hook to run rustfmt
**Value**: Standard Rust formatting

---

## Type Checking Hooks

### TypeScript
| Detection | File Exists |
|-----------|-------------|
| `tsconfig.json` | ✓ |

**Recommend**: PostToolUse hook to run tsc --noEmit
**Value**: Catch type errors immediately

### mypy/pyright (Python)
| Detection | File Exists |
|-----------|-------------|
| `mypy.ini`, `pyrightconfig.json`, pyproject.toml with mypy | ✓ |

**Recommend**: PostToolUse hook for type checking
**Value**: Catch type errors in Python

---

## Protection Hooks

### Block Sensitive File Edits
| Detection | Presence Of |
|-----------|-------------|
| `.env`, `.env.local`, `.env.production` | Environment files |
| `credentials.json`, `secrets.yaml` | Secret files |
| `.git/` directory | Git internals |

**Recommend**: PreToolUse hook that blocks Edit/Write to these paths
**Value**: Prevent accidental secret exposure or git corruption

### Block Lock File Edits
| Detection | Presence Of |
|-----------|-------------|
| `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` | JS lock files |
| `Cargo.lock`, `poetry.lock`, `Pipfile.lock` | Other lock files |

**Recommend**: PreToolUse hook that blocks direct edits
**Value**: Lock files should only change via package manager

---

## Test Runner Hooks

### Jest (JavaScript/TypeScript)
| Detection | Presence Of |
|-----------|-------------|
| `jest.config.js`, `jest` in package.json | Jest configured |
| `__tests__/`, `*.test.ts`, `*.spec.ts` | Test files exist |

**Recommend**: PostToolUse hook to run related tests after edit
**Value**: Immediate test feedback on changes

### pytest (Python)
| Detection | Presence Of |
|-----------|-------------|
| `pytest.ini`, `pyproject.toml` with pytest | pytest configured |
| `tests/`, `test_*.py` | Test files exist |

**Recommend**: PostToolUse hook to run pytest on changed files
**Value**: Immediate test feedback

---

## Quick Reference: Detection → Recommendation

| If You See | Recommend This Hook |
|------------|-------------------|
| Prettier config | Auto-format on Edit/Write |
| ESLint config | Auto-lint on Edit/Write |
| Ruff/Black config | Auto-format Python |
| tsconfig.json | Type-check on Edit |
| Test directory | Run related tests on Edit |
| .env files | Block .env edits |
| Lock files | Block lock file edits |
| Go project | gofmt on Edit |
| Rust project | rustfmt on Edit |

---

## Hook Placement

Hooks go in `.claude/settings.json`:

```
.claude/
└── settings.json  ← Hook configurations here
```

Recommend creating the `.claude/` directory if it doesn't exist.
