# Testing and CI Documentation

## Overview

This document describes the testing infrastructure and CI/CD setup for the Claude Code Rust implementation.

## Test Coverage

### Summary

- **Total Tests**: 234 passing tests
- **Test Suites**: 10 test suites across all crates
- **Coverage**: All crates have unit tests and doc tests

### Tests by Crate

#### Core Crates
- **claude-core**: 19 tests (types, errors, tool abstractions)
- **claude-api**: 29 tests (API models, request builders, serialization)
- **claude-config**: 13 tests (configuration loading, merging, plugin management)

#### Tool Crates
- **claude-tools**: 42 tests (file operations, bash, search, glob tools)
- **claude-mcp**: 32 tests (MCP protocol, client/server)
- **claude-session**: 26 tests (session management, state persistence)

#### Plugin System
- **claude-plugins**: 11 tests (command parsing, frontmatter, discovery)
- **claude-hooks**: 15 tests (hook execution, protocol)
- **claude-agents**: 17 tests (agent orchestration, context management)

#### CLI
- **claude-cli**: 3 integration tests (version, help, doctor commands)

### Documentation Tests

All crates include doc tests (28 total) to ensure code examples in documentation remain up-to-date and functional.

## Running Tests

### Run All Tests
```bash
cd claude-code-rust
cargo test --workspace
```

### Run Tests for Specific Crate
```bash
cargo test -p claude-api
cargo test -p claude-tools
```

### Run Tests with Output
```bash
cargo test -- --nocapture
```

### Run Doc Tests Only
```bash
cargo test --doc
```

### Run Integration Tests Only
```bash
cargo test --test '*'
```

## Code Quality

### Formatting
```bash
cargo fmt --all -- --check
```

### Linting
```bash
cargo clippy --all-targets --all-features --workspace
```

### Build
```bash
# Debug build
cargo build

# Release build (optimized)
cargo build --release
```

## Continuous Integration

### CI Workflow

The project uses GitHub Actions for continuous integration. The workflow is defined in `.github/workflows/rust-ci.yml`.

#### Jobs

1. **Test Suite** (`test`)
   - Runs on: Ubuntu, macOS, Windows
   - Rust versions: stable, beta
   - Executes all unit tests and doc tests
   - Uses caching for faster builds

2. **Code Formatting** (`fmt`)
   - Validates code formatting with `rustfmt`
   - Ensures consistent code style

3. **Linting** (`clippy`)
   - Runs Clippy linter for code quality
   - Checks for common mistakes and improvements

4. **Build** (`build`)
   - Cross-platform builds (Linux, macOS, Windows)
   - Produces optimized release binaries
   - Uploads artifacts for each platform

5. **Code Coverage** (`coverage`)
   - Generates coverage reports using `cargo-tarpaulin`
   - Uploads to Codecov
   - Tracks test coverage over time

6. **Security Audit** (`security-audit`)
   - Runs `cargo-audit` to check for security vulnerabilities
   - Scans dependencies for known CVEs

7. **Check** (`check`)
   - Fast compilation check without codegen
   - Catches compilation errors early

### Triggering CI

CI runs automatically on:
- Push to `main` or `develop` branches
- Pull requests targeting `main` or `develop`
- Changes to Rust code in `claude-code-rust/**`
- Changes to the CI workflow itself

### Caching

The workflow uses GitHub Actions caching to speed up builds:
- Cargo registry cache
- Cargo git cache
- Build target cache

This reduces build times from ~5 minutes to ~1 minute for subsequent runs.

## Adding New Tests

### Unit Tests

Add tests in the same file as the code being tested:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_my_function() {
        assert_eq!(my_function(2), 4);
    }
}
```

### Async Tests

For async code, use `#[tokio::test]`:

```rust
#[tokio::test]
async fn test_async_function() {
    let result = async_function().await;
    assert!(result.is_ok());
}
```

### Integration Tests

Create files in the `tests/` directory:

```rust
// crates/claude-cli/tests/integration_test.rs
use std::process::Command;

#[test]
fn test_cli_version() {
    let output = Command::new("cargo")
        .args(["run", "--", "--version"])
        .output()
        .expect("Failed to run command");

    assert!(output.status.success());
}
```

### Doc Tests

Add examples in documentation comments:

````rust
/// Adds two numbers together.
///
/// # Examples
///
/// ```
/// let result = add(2, 3);
/// assert_eq!(result, 5);
/// ```
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}
````

## Test Best Practices

1. **Test Names**: Use descriptive names that explain what is being tested
   - Good: `test_config_loads_from_file`
   - Bad: `test1`

2. **Arrange-Act-Assert**: Structure tests in three parts
   ```rust
   #[test]
   fn test_example() {
       // Arrange - set up test data
       let input = 42;

       // Act - execute the code
       let result = function_under_test(input);

       // Assert - verify the result
       assert_eq!(result, expected);
   }
   ```

3. **Test One Thing**: Each test should verify a single behavior

4. **Use Helper Functions**: Extract common setup code

5. **Test Edge Cases**: Include tests for:
   - Empty inputs
   - Null/None values
   - Boundary conditions
   - Error cases

6. **Avoid Test Interdependence**: Tests should be independent and runnable in any order

## Performance Testing

For benchmarking, use `cargo bench` (requires nightly Rust):

```rust
#[bench]
fn bench_function(b: &mut Bencher) {
    b.iter(|| {
        // Code to benchmark
    });
}
```

## Test Coverage Goals

- **Minimum**: 70% line coverage
- **Target**: 80%+ line coverage
- **Critical paths**: 90%+ coverage

Use `cargo tarpaulin` to generate coverage reports:

```bash
cargo install cargo-tarpaulin
cargo tarpaulin --all-features --workspace --out Html
```

## Troubleshooting

### Tests Fail Locally But Pass in CI

- Check Rust version: `rustc --version`
- Update dependencies: `cargo update`
- Clear cache: `cargo clean`

### Slow Tests

- Use `--jobs` to parallelize: `cargo test --jobs 8`
- Use `--release` for faster execution: `cargo test --release`

### Flaky Tests

- Avoid timing-dependent tests
- Use proper synchronization for concurrent tests
- Mock external dependencies

## Resources

- [Rust Testing Guide](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [Cargo Test Documentation](https://doc.rust-lang.org/cargo/commands/cargo-test.html)
- [GitHub Actions for Rust](https://github.com/actions-rs)
