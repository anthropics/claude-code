# Advanced Testing Features 🚀

This document describes advanced testing capabilities beyond the basics.

## Table of Contents

- [Parallel Test Execution](#parallel-test-execution)
- [Watch Mode](#watch-mode)
- [Coverage Reporting](#coverage-reporting)
- [Performance Benchmarks](#performance-benchmarks)
- [Mutation Testing](#mutation-testing)
- [Test Analytics](#test-analytics)
- [Docker Testing](#docker-testing)
- [Matrix Testing](#matrix-testing)
- [Pre-commit Hooks](#pre-commit-hooks)

---

## Parallel Test Execution

Run tests in parallel for faster feedback:

```bash
npm run test:parallel

# Or with custom parallel count
MAX_PARALLEL=8 bash tests/scripts/parallel-runner.sh
```

**Features:**
- Automatically detects optimal parallelism
- Shows real-time progress
- Aggregates results with timing
- Displays failed test output

**Performance:**
- Serial execution: ~60-90 seconds
- Parallel (4-way): ~15-25 seconds
- **Speed improvement: 3-4x**

---

## Watch Mode

Continuous test execution during development:

```bash
npm run test:watch
```

**Features:**
- Watches for file changes in:
  - `.devcontainer/`
  - `.github/`
  - `tests/`
- Auto-runs tests on change
- Clear visual feedback
- Debounced execution

**Use Cases:**
- TDD workflow
- Rapid iteration
- Debugging failing tests

---

## Coverage Reporting

Generate comprehensive coverage reports:

```bash
npm run coverage
```

**Outputs:**
- HTML dashboard (`coverage/index.html`)
- Component-level breakdown
- Test statistics
- Coverage badges

**Coverage Metrics:**
```
Component       Coverage    Tests
────────────────────────────────
Firewall        95%         80+
GitHub Actions  90%         40+
Workflows       85%         30+
DevContainer    80%         20+
```

**View Report:**
```bash
open coverage/index.html
# or
firefox coverage/index.html
```

---

## Performance Benchmarks

Measure test and script performance:

```bash
npm run benchmark
```

**Benchmarks Include:**
- CIDR validation performance
- IP validation speed
- JSON parsing time
- Script syntax checking
- Batch validation throughput

**Sample Output:**
```
📊 Test 1: CIDR Validation
  Average: 0.8ms
  Min: 0.6ms
  Max: 1.2ms

📊 Test 2: IP Validation
  Average: 0.5ms
  Min: 0.4ms
  Max: 0.7ms
```

**Performance Targets:**
- CIDR/IP validation: < 1ms
- Full script execution: < 5s
- GitHub API call: < 500ms
- DNS resolution: < 100ms/domain

---

## Mutation Testing

Test the quality of your tests:

```bash
npm run test:mutation

# Or for specific script
bash tests/scripts/mutation-test.sh .devcontainer/init-firewall.sh
```

**What is Mutation Testing?**

Mutation testing introduces intentional bugs (mutations) into code. If your tests catch the bug, the mutation is "killed" (good). If tests still pass, the mutation "survived" (indicates test gaps).

**Mutations Applied:**
- String replacements (`ERROR` → `WARNING`)
- Logic inversions (`-z` → `! -z`)
- Comparison flips (`-gt` → `-lt`)
- Regex modifications

**Interpreting Results:**
- **Mutation Score > 80%**: Excellent test quality
- **60-80%**: Good, room for improvement
- **< 60%**: Tests need strengthening

**Example Output:**
```
Mutation 1: 'ERROR' → 'WARNING' ... KILLED ✓
Mutation 2: '-z' → '! -z' ... KILLED ✓
Mutation 3: 'ACCEPT' → 'DROP' ... SURVIVED ⚠️

Mutation Score: 85%
✨ Excellent test quality!
```

---

## Test Analytics

View comprehensive test metrics:

```bash
npm run analytics
```

**Analytics Include:**
- Total test count
- Test distribution (unit vs integration)
- Component coverage breakdown
- Test complexity metrics
- Recent activity
- Quality metrics
- Execution time estimates

**Sample Output:**
```
📈 Test Analytics Dashboard

🎯 Overall Statistics
Test Files:        23
Total Tests:       170+
Lines of Test Code: 2,334

📊 Test Distribution
Unit Tests:        90 (53%)
Integration Tests: 50 (29%)
Static Analysis:   30 (18%)

🎨 Coverage by Component
Firewall        80 tests (Unit: 60 | Integration: 20)
Actions         40 tests (Unit: 30 | Integration: 10)
DevContainer    20 tests (Unit:  5 | Integration: 15)
```

---

## Docker Testing

Run tests in isolated Docker environment:

```bash
npm run test:docker

# Or individual services
cd tests/docker
docker-compose -f docker-compose.test.yml up unit-tests
docker-compose -f docker-compose.test.yml up integration-tests
docker-compose -f docker-compose.test.yml up benchmarks
```

**Available Services:**
- `unit-tests` - Fast unit tests
- `integration-tests` - Full integration suite (privileged)
- `static-analysis` - ShellCheck + ActionLint
- `benchmarks` - Performance testing
- `coverage` - Coverage report generation

**Benefits:**
- Clean environment every run
- Reproducible results
- No host system pollution
- Easy CI/CD integration

---

## Matrix Testing

Comprehensive testing across multiple environments:

**Triggered By:**
- Push to `main` or `claude/**` branches
- Pull requests
- Daily at 2 AM UTC
- Manual workflow dispatch

**Test Matrix:**
- **OS**: Ubuntu 22.04, Ubuntu 20.04, macOS 13, macOS 14
- **Parallel Jobs**: Up to 4 concurrent
- **Docker Tests**: Full isolation testing
- **Nightly Tests**: Comprehensive suite with benchmarks

**Workflow:** `.github/workflows/test-matrix.yml`

**Features:**
- Multi-OS compatibility testing
- Parallel test execution
- Coverage reporting (Ubuntu)
- Performance benchmarks (Ubuntu)
- Result aggregation
- Artifact uploads

---

## Pre-commit Hooks

Automatic quality checks before commits:

### Installation

```bash
pip install pre-commit
pre-commit install
```

### What Gets Checked

✅ **ShellCheck** - Bash script linting
✅ **File Quality** - Trailing whitespace, line endings
✅ **YAML/JSON** - Syntax validation
✅ **Secret Detection** - Prevent committing secrets
✅ **ActionLint** - GitHub Actions validation
✅ **Unit Tests** - Run before commit

### Manual Run

```bash
npm run pre-commit

# Or
pre-commit run --all-files
```

### Configuration

See `.pre-commit-config.yaml` for hook configuration.

### Bypassing Hooks

Only when absolutely necessary:

```bash
git commit --no-verify
```

---

## Advanced Workflows

### Continuous Testing

For active development:

```bash
# Terminal 1: Watch mode
npm run test:watch

# Terminal 2: Development work
# Edit files...

# Tests run automatically on save
```

### Pre-deployment Checklist

```bash
# 1. Run all tests
npm run test:all

# 2. Check coverage
npm run coverage

# 3. Run benchmarks
npm run benchmark

# 4. Test analytics
npm run analytics

# 5. Mutation testing
npm run test:mutation
```

### CI/CD Pipeline

```yaml
# .github/workflows/custom.yml
- name: Run parallel tests
  run: npm run test:parallel

- name: Generate coverage
  run: npm run coverage

- name: Run benchmarks
  run: npm run benchmark

- name: Upload results
  uses: actions/upload-artifact@v4
  with:
    name: test-results
    path: coverage/
```

---

## Performance Optimization

### Parallel Execution

```bash
# Adjust parallelism based on CPU cores
MAX_PARALLEL=8 npm run test:parallel
```

### Docker Layer Caching

```dockerfile
# Cache dependencies
RUN apt-get update && apt-get install -y bats shellcheck

# Copy tests last for better caching
COPY tests/ /workspace/tests/
```

### Selective Test Runs

```bash
# Only unit tests (fast)
npm run test:unit

# Specific component
bats tests/unit/firewall/*.bats

# Single test file
bats tests/unit/firewall/cidr-validation.bats
```

---

## Troubleshooting

### Parallel Tests Hang

```bash
# Reduce parallelism
MAX_PARALLEL=2 npm run test:parallel
```

### Watch Mode Not Detecting Changes

```bash
# Install file watchers
# Linux:
sudo apt-get install inotify-tools

# macOS:
brew install fswatch
```

### Docker Tests Fail

```bash
# Clean Docker state
docker-compose -f tests/docker/docker-compose.test.yml down -v
docker system prune -f

# Rebuild images
docker-compose -f tests/docker/docker-compose.test.yml build --no-cache
```

### Mutation Tests Too Slow

```bash
# Test specific script sections
bash tests/scripts/mutation-test.sh | head -20
```

---

## Best Practices

### 1. Development Workflow

```bash
# Start watch mode
npm run test:watch

# Make changes
# Tests run automatically

# Before committing
npm run test:all
```

### 2. Performance Monitoring

```bash
# Baseline benchmark
npm run benchmark > baseline.txt

# After changes
npm run benchmark > current.txt

# Compare
diff baseline.txt current.txt
```

### 3. Coverage Tracking

```bash
# Generate report
npm run coverage

# Check trends
git log -p coverage/index.html
```

### 4. Quality Gates

```bash
# Minimum mutation score: 80%
npm run test:mutation | grep "Mutation Score"

# All tests must pass
npm run test:all || exit 1
```

---

## Integration Examples

### GitHub Actions

```yaml
name: Advanced Tests

jobs:
  advanced-testing:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: cd tests && ./setup-bats.sh

      - name: Parallel tests
        run: npm run test:parallel

      - name: Coverage
        run: npm run coverage

      - name: Mutation testing
        run: npm run test:mutation

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/
```

### Pre-commit Integration

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: fast-tests
        name: Run fast unit tests
        entry: bats tests/unit/**/*.bats
        language: system
        pass_filenames: false
```

### VS Code Integration

```json
{
  "tasks": [
    {
      "label": "Run Tests (Watch)",
      "type": "shell",
      "command": "npm run test:watch",
      "problemMatcher": [],
      "isBackground": true
    }
  ]
}
```

---

## Metrics & KPIs

Track these metrics for test suite health:

- **Coverage**: Target > 80%
- **Mutation Score**: Target > 75%
- **Test Count Growth**: Track over time
- **Execution Time**: Monitor for regression
- **Flaky Tests**: Target = 0
- **Test-to-Code Ratio**: Target > 1:1

---

## Further Reading

- [Bats Documentation](https://bats-core.readthedocs.io/)
- [Mutation Testing Explained](https://en.wikipedia.org/wiki/Mutation_testing)
- [Pre-commit Framework](https://pre-commit.com/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [GitHub Actions Matrix](https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs)

---

## Contributing

Have ideas for more advanced features? Submit a PR or issue!

**Potential Enhancements:**
- Test result visualization
- Historical trend analysis
- Slack/Discord notifications
- Performance regression detection
- AI-powered test generation
- Property-based testing

---

**Happy Advanced Testing! 🚀**
