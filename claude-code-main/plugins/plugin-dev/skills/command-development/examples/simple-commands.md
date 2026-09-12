# Simple Command Examples

Basic slash command patterns for common use cases.

**Important:** All examples below are written as instructions FOR Claude (agent consumption), not messages TO users. Commands tell Claude what to do, not tell users what will happen.

## Example 1: Code Review Command

**File:** `.claude/commands/review.md`

```markdown
---
description: Review code for quality and issues
allowed-tools: Read, Bash(git:*)
---

Review the code in this repository for:

1. **Code Quality:**
   - Readability and maintainability
   - Consistent style and formatting
   - Appropriate abstraction levels

2. **Potential Issues:**
   - Logic errors or bugs
   - Edge cases not handled
   - Performance concerns

3. **Best Practices:**
   - Design patterns used correctly
   - Error handling present
   - Documentation adequate

Provide specific feedback with file and line references.
```

**Usage:**
```
> /review
```

---

## Example 2: Security Review Command

**File:** `.claude/commands/security-review.md`

```markdown
---
description: Review code for security vulnerabilities
allowed-tools: Read, Grep
model: sonnet
---

Perform comprehensive security review checking for:

**Common Vulnerabilities:**
- SQL injection risks
- Cross-site scripting (XSS)
- Authentication/authorization issues
- Insecure data handling
- Hardcoded secrets or credentials

**Security Best Practices:**
- Input validation present
- Output encoding correct
- Secure defaults used
- Error messages safe
- Logging appropriate (no sensitive data)

For each issue found:
- File and line number
- Severity (Critical/High/Medium/Low)
- Description of vulnerability
- Recommended fix

Prioritize issues by severity.
```

**Usage:**
```
> /security-review
```

---

## Example 3: Test Command with File Argument

**File:** `.claude/commands/test-file.md`

```markdown
---
description: Run tests for specific file
argument-hint: [test-file]
allowed-tools: Bash(npm:*), Bash(jest:*)
---

Run tests for $1:

Test execution: !`npm test $1`

Analyze results:
- Tests passed/failed
- Code coverage
- Performance issues
- Flaky tests

If failures found, suggest fixes based on error messages.
```

**Usage:**
```
> /test-file src/utils/helpers.test.ts
```

---

## Example 4: Documentation Generator

**File:** `.claude/commands/document.md`

```markdown
---
description: Generate documentation for file
argument-hint: [source-file]
---

Generate comprehensive documentation for @$1

Include:

**Overview:**
- Purpose and responsibility
- Main functionality
- Dependencies

**API Documentation:**
- Function/method signatures
- Parameter descriptions with types
- Return values with types
- Exceptions/errors thrown

**Usage Examples:**
- Basic usage
- Common patterns
- Edge cases

**Implementation Notes:**
- Algorithm complexity
- Performance considerations
- Known limitations

Format as Markdown suitable for project documentation.
```

**Usage:**
```
> /document src/api/users.ts
```

---

## Example 5: Git Status Summary

**File:** `.claude/commands/git-status.md`

```markdown
---
description: Summarize Git repository status
allowed-tools: Bash(git:*)
---

Repository Status Summary:

**Current Branch:** !`git branch --show-current`

**Status:** !`git status --short`

**Recent Commits:** !`git log --oneline -5`

**Remote Status:** !`git fetch && git status -sb`

Provide:
- Summary of changes
- Suggested next actions
- Any warnings or issues
```

**Usage:**
```
> /git-status
```

---

## Example 6: Deployment Command

**File:** `.claude/commands/deploy.md`

```markdown
---
description: Deploy to specified environment
argument-hint: [environment] [version]
allowed-tools: Bash(kubectl:*), Read
---

Deploy to $1 environment using version $2

**Pre-deployment Checks:**
1. Verify $1 configuration exists
2. Check version $2 is valid
3. Verify cluster accessibility: !`kubectl cluster-info`

**Deployment Steps:**
1. Update deployment manifest with version $2
2. Apply configuration to $1
3. Monitor rollout status
4. Verify pod health
5. Run smoke tests

**Rollback Plan:**
Document current version for rollback if issues occur.

Proceed with deployment? (yes/no)
```

**Usage:**
```
> /deploy staging v1.2.3
```

---

## Example 7: Comparison Command

**File:** `.claude/commands/compare-files.md`

```markdown
---
description: Compare two files
argument-hint: [file1] [file2]
---

Compare @$1 with @$2

**Analysis:**

1. **Differences:**
   - Lines added
   - Lines removed
   - Lines modified

2. **Functional Changes:**
   - Breaking changes
   - New features
   - Bug fixes
   - Refactoring

3. **Impact:**
   - Affected components
   - Required updates elsewhere
   - Migration requirements

4. **Recommendations:**
   - Code review focus areas
   - Testing requirements
   - Documentation updates needed

Present as structured comparison report.
```

**Usage:**
```
> /compare-files src/old-api.ts src/new-api.ts
```

---

## Example 8: Quick Fix Command

**File:** `.claude/commands/quick-fix.md`

```markdown
---
description: Quick fix for common issues
argument-hint: [issue-description]
model: haiku
---

Quickly fix: $ARGUMENTS

**Approach:**
1. Identify the issue
2. Find relevant code
3. Propose fix
4. Explain solution

Focus on:
- Simple, direct solution
- Minimal changes
- Following existing patterns
- No breaking changes

Provide code changes with file paths and line numbers.
```

**Usage:**
```
> /quick-fix button not responding to clicks
> /quick-fix typo in error message
```

---

## Example 9: Research Command

**File:** `.claude/commands/research.md`

```markdown
---
description: Research best practices for topic
argument-hint: [topic]
model: sonnet
---

Research best practices for: $ARGUMENTS

**Coverage:**

1. **Current State:**
   - How we currently handle this
   - Existing implementations

2. **Industry Standards:**
   - Common patterns
   - Recommended approaches
   - Tools and libraries

3. **Comparison:**
   - Our approach vs standards
   - Gaps or improvements needed
   - Migration considerations

4. **Recommendations:**
   - Concrete action items
   - Priority and effort estimates
   - Resources for implementation

Provide actionable guidance based on research.
```

**Usage:**
```
> /research error handling in async operations
> /research API authentication patterns
```

---

## Example 10: Explain Code Command

**File:** `.claude/commands/explain.md`

```markdown
---
description: Explain how code works
argument-hint: [file-or-function]
---

Explain @$1 in detail

**Explanation Structure:**

1. **Overview:**
   - What it does
   - Why it exists
   - How it fits in system

2. **Step-by-Step:**
   - Line-by-line walkthrough
   - Key algorithms or logic
   - Important details

3. **Inputs and Outputs:**
   - Parameters and types
   - Return values
   - Side effects

4. **Edge Cases:**
   - Error handling
   - Special cases
   - Limitations

5. **Usage Examples:**
   - How to call it
   - Common patterns
   - Integration points

Explain at level appropriate for junior engineer.
```

**Usage:**
```
> /explain src/utils/cache.ts
> /explain AuthService.login
```

---

## Key Patterns

### Pattern 1: Read-Only Analysis

```markdown
---
allowed-tools: Read, Grep
---

Analyze but don't modify...
```

**Use for:** Code review, documentation, analysis

### Pattern 2: Git Operations

```markdown
---
allowed-tools: Bash(git:*)
---

!`git status`
Analyze and suggest...
```

**Use for:** Repository status, commit analysis

### Pattern 3: Single Argument

```markdown
---
argument-hint: [target]
---

Process $1...
```

**Use for:** File operations, targeted actions

### Pattern 4: Multiple Arguments

```markdown
---
argument-hint: [source] [target] [options]
---

Process $1 to $2 with $3...
```

**Use for:** Workflows, deployments, comparisons

### Pattern 5: Fast Execution

```markdown
---
model: haiku
---

Quick simple task...
```

**Use for:** Simple, repetitive commands

### Pattern 6: File Comparison

```markdown
Compare @$1 with @$2...
```

**Use for:** Diff analysis, migration planning

### Pattern 7: Context Gathering

```markdown
---
allowed-tools: Bash(git:*), Read
---

Context: !`git status`
Files: @file1 @file2

Analyze...
```

**Use for:** Informed decision making

## Tips for Writing Simple Commands

1. **Start basic:** Single responsibility, clear purpose
2. **Add complexity gradually:** Start without frontmatter
3. **Test incrementally:** Verify each feature works
4. **Use descriptive names:** Command name should indicate purpose
5. **Document arguments:** Always use argument-hint
6. **Provide examples:** Show usage in comments
7. **Handle errors:** Consider missing arguments or files
