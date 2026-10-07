# Refactor Plugin

Automated iterative code refactoring with specialized AI agents that ensure test coverage, design optimizations, implement clean code improvements, and verify quality.

## Overview

The Refactor plugin orchestrates three specialized agents in an iterative workflow to systematically improve code quality while preserving functionality:

- **Test Agent**: Ensures comprehensive test coverage and validates changes
- **Architect Agent**: Reviews code architecture and plans optimizations
- **Code Agent**: Implements clean code improvements safely

## How It Works

The refactoring process follows a rigorous 7-step workflow that iterates 3 times:

```
1. Ensure Test Coverage
   └─> Test agent adds missing tests, guarantees all tests pass

2. Architecture Review (Iteration 1-3)
   └─> Architect agent identifies improvements, creates prioritized plan

3. Implement Top 3 Optimizations
   └─> Code agent refactors code following clean code principles

4. Run All Tests
   └─> Test agent validates changes

5. Fix Failures (if any)
   └─> Code agent fixes issues, return to step 4

6. Check Iteration Limit
   └─> If < 3 iterations, return to step 2
   └─> If >= 3 iterations, proceed to step 7

7. Final Assessment
   └─> Architect agent scores quality, documents results
```

## Quick Start

```bash
# Refactor entire codebase
/refactor

# Refactor specific directory
/refactor src/utils/

# Refactor specific file
/refactor src/app.ts

# Refactor by description
/refactor "authentication logic"
```

## Features

### 🔒 Safety First
- **No Functionality Changes**: Only improves code quality, never alters behavior
- **Test-Driven**: Ensures tests pass before and after each change
- **Iterative Validation**: Multiple check points prevent regressions

### 🎯 Comprehensive Coverage
- **Automatic Test Generation**: Adds missing test cases to meet production standards
- **Edge Case Detection**: Identifies and tests boundary conditions
- **Coverage Analysis**: Reports before/after coverage metrics

### 🏗️ Architecture Excellence
- **Design Review**: Evaluates SOLID principles, patterns, and structure
- **Prioritized Planning**: Focuses on high-impact, low-effort improvements
- **Quality Scoring**: Provides objective Clean Code and Architecture scores (1-10)

### ✨ Clean Code Implementation
- **Focused Improvements**: Implements top 3 optimizations per iteration
- **Progressive Refinement**: 3 iterations ensure thorough improvement
- **Best Practices**: Applies proven refactoring patterns

### 📊 Detailed Reporting
- **Iteration Summaries**: Track progress through each cycle
- **Final Assessment**: Comprehensive quality report with scores
- **Actionable Insights**: Identifies remaining improvements

## The Refactoring Workflow

### Step 1: Ensure Test Coverage

Before any refactoring begins, the test agent:
- Analyzes current test coverage
- Identifies critical gaps
- Writes comprehensive test cases
- Runs all tests to ensure they pass
- Reports final coverage status

**Goal**: Achieve production-quality test coverage (typically 80%+)

### Step 2: Architecture Review

The architect agent examines code quality and identifies opportunities:
- Structural improvements (extract methods/classes, reduce complexity)
- Code duplication elimination (DRY principle)
- Naming clarity improvements
- Better organization and separation of concerns
- Appropriate design pattern application
- Complexity reduction
- Dependency decoupling

**Output**: Prioritized list of optimizations with impact/effort ratings

### Step 3: Implement Optimizations

The code agent carefully implements the top 3 improvements:
- Makes incremental, safe changes
- Preserves all existing functionality
- Applies clean code principles
- Self-reviews each change
- Documents modifications

**Principles Applied**:
- Meaningful names
- Small, focused functions
- Single responsibility
- DRY (Don't Repeat Yourself)
- Appropriate abstraction
- Minimal complexity

### Step 4: Test Validation

The test agent runs the full test suite:
- Executes all tests
- Reports pass/fail status
- Provides detailed failure analysis if needed

### Step 5: Fix Failures

If tests fail, the code agent:
- Analyzes root causes
- Implements targeted fixes
- Preserves refactoring improvements
- Returns to step 4 for re-validation

### Step 6: Iteration Control

The system tracks iterations:
- Completes 3 full refactoring cycles
- Each iteration builds on previous improvements
- Progressive refinement ensures thorough optimization

### Step 7: Final Assessment

The architect agent produces a comprehensive report:
- **Clean Code Score (1-10)**: Measures readability, simplicity, maintainability
- **Architecture Perfection Score (1-10)**: Evaluates design quality, SOLID principles
- **Improvement Summary**: Documents changes across all iterations
- **Remaining Issues**: Lists potential future improvements
- **Recommendations**: Provides maintenance guidelines

**Report saved as**: `refactor-result-{timestamp}.md`

## Understanding the Quality Scores

### Clean Code Score (1-10)

- **9-10**: Exemplary code - clear, simple, maintainable
- **7-8**: Good quality with minor improvement opportunities
- **5-6**: Acceptable but needs notable improvements
- **3-4**: Poor quality with significant issues
- **1-2**: Very poor, requires major refactoring

**Evaluates**: Naming, function size, DRY principle, comments, error handling, formatting

### Architecture Perfection Score (1-10)

- **9-10**: Excellent architecture following best practices
- **7-8**: Good design with minor concerns
- **5-6**: Acceptable architecture, some issues
- **3-4**: Poor architecture needing significant redesign
- **1-2**: Very poor, major architectural problems

**Evaluates**: SOLID principles, coupling/cohesion, abstraction levels, testability, extensibility

## The Three Agents

### Test Agent
**Role**: Quality assurance through testing

**Capabilities**:
- Coverage analysis
- Test case generation
- Test execution
- Failure diagnosis

**Tools**: Glob, Grep, Read, Write, Edit, Bash, TodoWrite

### Architect Agent
**Role**: Design and architecture analysis

**Capabilities**:
- Code structure review
- Pattern identification
- Optimization planning
- Quality scoring

**Tools**: Glob, Grep, Read, TodoWrite, WebFetch

### Code Agent
**Role**: Implementation of refactoring

**Capabilities**:
- Clean code refactoring
- Safe incremental changes
- Test failure fixing
- Best practice application

**Tools**: Glob, Grep, Read, Write, Edit, TodoWrite

## Use Cases

### When to Use Refactor

✅ **Good for**:
- Legacy code that needs modernization
- Code with low test coverage
- Code with known quality issues
- Preparation before adding features
- Technical debt reduction
- Post-implementation cleanup
- Code review follow-up

❌ **Not suitable for**:
- Adding new features (functionality changes)
- Quick fixes during incidents
- Code with no tests and no test framework
- Experimental or prototype code
- Code scheduled for deletion

## Examples

### Example 1: Full Codebase Refactoring

```bash
/refactor
```

**What happens**:
1. Analyzes entire codebase test coverage
2. Adds missing tests across all modules
3. Performs 3 iterations of architecture review and optimization
4. Generates comprehensive quality report

**Duration**: ~30-60 minutes (depending on codebase size)

### Example 2: Specific Module

```bash
/refactor src/services/payment/
```

**What happens**:
1. Focuses only on payment service code
2. Ensures payment logic is well-tested
3. Optimizes payment service architecture
4. Produces targeted improvement report

**Duration**: ~10-20 minutes

### Example 3: Single File

```bash
/refactor src/utils/validators.ts
```

**What happens**:
1. Tests only validators.ts
2. Refactors validator functions
3. Reports on validator code quality

**Duration**: ~5-10 minutes

## Best Practices

### Before Running Refactor

1. **Commit Your Work**: Ensure clean git state
2. **Set Expectations**: Large codebases take time
3. **Review Scope**: Be specific about what to refactor if needed

### During Refactoring

1. **Be Patient**: Quality takes time, trust the process
2. **Monitor Progress**: Watch the iteration updates
3. **Stay Available**: May need input on ambiguous situations

### After Refactoring

1. **Review the Report**: Read `refactor-result-{timestamp}.md`
2. **Check the Scores**: Understand quality improvements
3. **Review Changes**: Use `git diff` to see modifications
4. **Run Manual Tests**: Verify in your development environment
5. **Consider Remaining Issues**: Plan follow-up work if needed

## Configuration

The refactoring process uses these defaults:

- **Max Iterations**: 3
- **Optimizations per Iteration**: Top 3
- **Test Coverage Target**: Production quality (typically 80%+)

These are currently hardcoded but designed for future configurability.

## Troubleshooting

### Tests Keep Failing

**Issue**: Tests fail repeatedly after fixes

**Solution**:
- Review the test failure patterns
- Check if the code has hidden dependencies
- Ensure test environment is properly configured
- May need to run `/refactor` on smaller scope first

### Iteration Takes Too Long

**Issue**: Each iteration is very slow

**Solution**:
- Reduce scope (refactor specific files/directories)
- Ensure fast test suite (split out slow integration tests)
- Check for performance bottlenecks in codebase

### Scores Are Lower Than Expected

**Issue**: Quality scores don't meet expectations

**Solution**:
- Review the detailed assessment in the report
- Address critical issues identified
- Consider running additional refactoring cycles manually
- Some codebases need multiple refactoring sessions

### Agent Gets Stuck

**Issue**: An agent doesn't complete its task

**Solution**:
- Check the agent's progress output
- May need to cancel and restart with smaller scope
- Report issue if it's a bug in agent instructions

## FAQ

**Q: Will this change my code's functionality?**
A: No. The refactoring process explicitly preserves all functionality. Only code quality and structure are improved.

**Q: How long does refactoring take?**
A: Depends on scope:
- Single file: 5-10 minutes
- Module: 10-20 minutes
- Full codebase: 30-60 minutes

**Q: Can I stop mid-refactor?**
A: Yes, but you'll lose progress. Better to start with smaller scope.

**Q: Do I need to review every change?**
A: Recommended. While agents are thorough, human review is valuable.

**Q: What if my project has no tests?**
A: The test agent will create them! That's step 1.

**Q: Can I run this on production code?**
A: Only if you have proper review and deployment processes. Always review changes first.

**Q: What languages/frameworks are supported?**
A: All languages. Agents adapt to your project's testing framework and conventions.

**Q: Can I customize the iteration count?**
A: Currently fixed at 3 iterations, but designed for future configurability.

## Learn More

- Read the [Clean Code](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882) book by Robert C. Martin
- Study [Refactoring](https://refactoring.com/) by Martin Fowler
- Understand [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- Explore [Design Patterns](https://refactoring.guru/design-patterns)

## Feedback

Found a bug or have a suggestion? Open an issue in the Claude Code repository.

## Version

Current version: 1.0.0

---

**Ready to improve your code quality?**

Run `/refactor` and watch AI agents systematically transform your codebase! 🚀
