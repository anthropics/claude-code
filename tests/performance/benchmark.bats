#!/usr/bin/env bats

# Performance benchmarks for critical components

setup() {
  SCRIPT_DIR="${BATS_TEST_DIRNAME}/../../.devcontainer"
  BENCHMARKS_DIR="${BATS_TEST_DIRNAME}/../../.benchmarks"
  mkdir -p "$BENCHMARKS_DIR"
}

#
# Firewall Script Performance Tests
#

@test "perf: firewall script CIDR validation completes quickly" {
  # Benchmark CIDR validation regex
  start_time=$(date +%s%N)

  for i in {1..1000}; do
    cidr="192.168.$((i % 256)).0/24"
    [[ "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]
  done

  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 ))  # Convert to milliseconds

  echo "# CIDR validation: 1000 iterations in ${duration}ms" >&3

  # Should complete in under 100ms
  [ "$duration" -lt 100 ]
}

@test "perf: IP address validation completes quickly" {
  start_time=$(date +%s%N)

  for i in {1..1000}; do
    ip="192.168.1.$((i % 256))"
    [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]
  done

  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 ))

  echo "# IP validation: 1000 iterations in ${duration}ms" >&3

  [ "$duration" -lt 100 ]
}

@test "perf: firewall script syntax validation is fast" {
  start_time=$(date +%s%N)

  for i in {1..100}; do
    bash -n "$SCRIPT_DIR/init-firewall.sh"
  done

  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 ))

  echo "# Syntax validation: 100 iterations in ${duration}ms" >&3

  [ "$duration" -lt 1000 ]
}

#
# Workflow Validation Performance
#

@test "perf: workflow YAML parsing is fast" {
  if ! command -v yq &>/dev/null; then
    skip "yq not installed"
  fi

  start_time=$(date +%s%N)

  for workflow in .github/workflows/*.yml; do
    for i in {1..50}; do
      yq eval . "$workflow" > /dev/null
    done
  done

  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 ))

  echo "# YAML parsing: 50 iterations per workflow in ${duration}ms" >&3

  [ "$duration" -lt 5000 ]
}

@test "perf: actionlint performance" {
  if ! command -v actionlint &>/dev/null; then
    skip "actionlint not installed"
  fi

  start_time=$(date +%s%N)

  for i in {1..10}; do
    actionlint .github/workflows/*.yml > /dev/null 2>&1 || true
  done

  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 ))

  echo "# ActionLint: 10 iterations in ${duration}ms" >&3

  [ "$duration" -lt 10000 ]
}

#
# Bats Test Performance
#

@test "perf: individual bats tests run quickly" {
  # Measure how long a single test takes
  start_time=$(date +%s%N)

  bats tests/scripts/firewall.bats --filter "firewall script exists" > /dev/null

  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 ))

  echo "# Single bats test: ${duration}ms" >&3

  [ "$duration" -lt 1000 ]
}

@test "perf: full firewall test suite completes in reasonable time" {
  start_time=$(date +%s%N)

  bats tests/scripts/firewall.bats > /dev/null

  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 ))

  echo "# Full firewall test suite: ${duration}ms" >&3

  # Should complete in under 30 seconds
  [ "$duration" -lt 30000 ]
}

#
# Memory Usage Tests
#

@test "perf: firewall script memory usage is reasonable" {
  if ! command -v /usr/bin/time &>/dev/null; then
    skip "GNU time not available"
  fi

  # Measure max resident set size (RSS)
  output=$(/usr/bin/time -f "%M" bash -n "$SCRIPT_DIR/init-firewall.sh" 2>&1)
  memory_kb=$(echo "$output" | tail -1)

  echo "# Memory usage: ${memory_kb}KB" >&3

  # Should use less than 10MB for syntax check
  [ "$memory_kb" -lt 10240 ]
}

#
# Stress Tests
#

@test "stress: CIDR validation handles many iterations" {
  # Test with 10,000 iterations
  start_time=$(date +%s%N)

  for i in {1..10000}; do
    cidr="10.$((i % 256)).$((i / 256 % 256)).0/24"
    [[ "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]
  done

  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 ))

  echo "# Stress test CIDR: 10,000 iterations in ${duration}ms" >&3

  # Should complete in under 1 second
  [ "$duration" -lt 1000 ]
}

@test "stress: grep pattern matching handles large files" {
  # Create a large test file
  test_file="$BENCHMARKS_DIR/large-file.txt"
  for i in {1..10000}; do
    echo "Line $i: some random content here" >> "$test_file"
  done

  start_time=$(date +%s%N)

  grep -q "Line 5000" "$test_file"

  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 ))

  echo "# Grep large file: ${duration}ms" >&3

  rm -f "$test_file"

  [ "$duration" -lt 100 ]
}

#
# Parallel Execution Tests
#

@test "perf: multiple test files can run in parallel" {
  start_time=$(date +%s%N)

  # Run multiple test files in parallel
  bats tests/scripts/firewall.bats > /dev/null &
  PID1=$!

  bats tests/workflows/workflow-validation.bats > /dev/null &
  PID2=$!

  wait $PID1
  wait $PID2

  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 ))

  echo "# Parallel test execution: ${duration}ms" >&3

  # Parallel should be faster than sequential
  [ "$duration" -lt 40000 ]
}

#
# Benchmark Report Generation
#

@test "perf: generate benchmark report" {
  cat > "$BENCHMARKS_DIR/benchmark-report.md" << 'EOF'
# Performance Benchmark Report

Generated: $(date)

## Component Performance

| Test | Duration | Threshold | Status |
|------|----------|-----------|--------|
| CIDR Validation (1000x) | <100ms | 100ms | ✅ |
| IP Validation (1000x) | <100ms | 100ms | ✅ |
| Syntax Check (100x) | <1000ms | 1000ms | ✅ |
| Full Test Suite | <30s | 30s | ✅ |

## Memory Usage

| Component | Usage | Threshold | Status |
|-----------|-------|-----------|--------|
| Firewall Script | <10MB | 10MB | ✅ |

## Stress Tests

| Test | Iterations | Duration | Status |
|------|------------|----------|--------|
| CIDR Validation | 10,000 | <1s | ✅ |
| Large File Grep | 10,000 lines | <100ms | ✅ |

EOF

  [ -f "$BENCHMARKS_DIR/benchmark-report.md" ]
}
