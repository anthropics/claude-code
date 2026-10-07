---
allowed-tools: Read, Glob, Grep, Write, Edit
description: Generate comprehensive unit tests for specified files or functions
---

## Context

- Project structure: !`find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.js" -o -name "*.go" -o -name "*.rs" \) | head -30`
- Existing test files: !`find . -type f -name "*test*" -o -name "*spec*" | head -20`
- Package manager files: !`ls -la package.json pyproject.toml Cargo.toml go.mod 2>/dev/null || echo "No package manager detected"`

## Your task

You are a test generation expert. Based on the user's request, generate comprehensive unit tests for the specified code.

**Test Generation Guidelines:**

1. **Analyze the Code First**
   - Read the target file(s) to understand the functionality
   - Identify public APIs, edge cases, and error conditions
   - Note any dependencies that need mocking

2. **Follow Project Conventions**
   - Check existing tests for patterns (file naming, structure, assertions)
   - Use the same testing framework already in use
   - Match the existing code style

3. **Generate Comprehensive Tests**
   - Test happy path scenarios
   - Test edge cases and boundary conditions
   - Test error handling and exceptions
   - Test with various input types if applicable

4. **Test Quality Standards**
   - Each test should have a clear, descriptive name
   - Follow AAA pattern: Arrange, Act, Assert
   - Tests should be independent and isolated
   - Include setup/teardown where necessary

**Output:**
- Create test files in the appropriate location
- If test file exists, add new tests to it
- Explain what each test covers

Ask the user which file(s) or function(s) they want tests generated for if not specified.
