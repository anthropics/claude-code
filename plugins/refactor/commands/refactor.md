---
description: Automated iterative code refactoring with specialized agents
argument-hint: Optional path or description of code to refactor
---

# Refactor Command

You are orchestrating an automated, iterative code refactoring process using specialized agents.

## Overview

This command implements a comprehensive refactoring workflow that:
1. Ensures adequate test coverage
2. Identifies architectural improvements
3. Implements clean code optimizations
4. Verifies quality through testing
5. Iterates multiple times for continuous improvement
6. Produces a detailed quality assessment report

## Arguments

**$ARGUMENTS**: Optional specification of what to refactor
- If empty: refactor the entire codebase
- If file path: refactor specific file(s)
- If description: refactor code matching description

## Refactoring Workflow

Execute the following steps systematically:

### Initialization

1. **Understand Scope**
   - Parse $ARGUMENTS to determine refactoring scope
   - If unclear, ask user to clarify what should be refactored
   - Set up refactoring context

2. **Initialize Counter**
   - Set `refactoring_iteration = 0`
   - Set `max_iterations = 3`

3. **Create Todo List**
   - Use TodoWrite to create comprehensive task list for all steps

### Step 1: Ensure Test Coverage

**Goal**: Guarantee production-quality test coverage before refactoring

**Actions**:
1. Launch the **test agent** with task:
   ```
   Analyze test coverage for [scope]. Ensure production-quality coverage by:
   1. Identifying all coverage gaps
   2. Adding comprehensive test cases for uncovered critical paths
   3. Running all tests and verifying they pass
   4. Reporting final coverage status

   Focus on: critical functionality, edge cases, error handling.
   Ensure every new test case runs successfully before reporting completion.
   ```

2. Wait for test agent to complete
3. Review coverage report
4. Verify all tests are passing before proceeding

### Step 2: Architecture Review & Optimization Planning

**Goal**: Identify and prioritize code quality improvements

**Actions**:
1. Launch the **architect agent** with task:
   ```
   Review code architecture for [scope] from design perspective.
   1. Analyze code structure, patterns, and quality
   2. Identify optimization opportunities (structural, duplication, naming, organization, complexity, dependencies)
   3. Create prioritized optimization plan
   4. Focus on improvements that enhance quality without changing functionality
   5. Provide top 3 high-priority optimizations to implement

   Iteration: {refactoring_iteration + 1} of {max_iterations}
   ```

2. Wait for architect agent to complete
3. Review optimization plan
4. Identify top 3 priorities for implementation

### Step 3: Implement Top 3 Optimizations

**Goal**: Execute highest-priority refactoring improvements

**Actions**:
1. Launch the **code agent** with task:
   ```
   Implement the top 3 optimizations from the following plan:

   [paste architect's optimization plan]

   Requirements:
   - Focus ONLY on the top 3 items
   - Preserve all existing functionality (no feature changes)
   - Apply clean code principles
   - Make incremental, safe changes
   - Provide detailed report of changes made
   ```

2. Wait for code agent to complete
3. Review implementation report

### Step 4: Run All Tests

**Goal**: Verify refactoring didn't break anything

**Actions**:
1. Launch the **test agent** with task:
   ```
   Run the complete test suite and report results.

   Provide:
   - Pass/fail status
   - If failures: detailed failure report with causes and suggestions
   - If success: confirmation that all tests pass
   ```

2. Wait for test agent to complete
3. Check test results

### Step 5: Fix Test Failures (If Any)

**Goal**: Resolve any issues introduced by refactoring

**Actions**:
1. **If tests failed**:
   a. Launch the **code agent** with task:
      ```
      Fix the following test failures:

      [paste test failure report]

      Analyze root causes and implement fixes.
      Preserve refactoring improvements where possible.
      ```

   b. Wait for code agent to complete
   c. **Go back to Step 4** (run tests again)

2. **If all tests passed**:
   - Proceed to Step 6

### Step 6: Increment Counter and Check Iteration Limit

**Goal**: Determine if more refactoring iterations are needed

**Actions**:
1. Increment counter: `refactoring_iteration += 1`

2. Check iteration limit:
   - **If `refactoring_iteration < max_iterations`**:
     - Inform user: "Iteration {refactoring_iteration} complete. Starting iteration {refactoring_iteration + 1}..."
     - **Go back to Step 2** (architecture review)

   - **If `refactoring_iteration >= max_iterations`**:
     - Inform user: "Completed {max_iterations} refactoring iterations. Proceeding to final assessment..."
     - Proceed to Step 7

### Step 7: Final Quality Assessment

**Goal**: Evaluate overall refactoring results and document quality

**Actions**:
1. Generate timestamp: `timestamp = {current_date_time}`

2. Launch the **architect agent** with task:
   ```
   Perform final quality assessment of the refactored code.

   Provide:
   1. Comprehensive review of final code state
   2. List of any remaining potential issues
   3. Clean Code Score (1-10) with justification
   4. Architecture Perfection Score (1-10) with justification
   5. Summary of improvements achieved across {max_iterations} iterations

   Create detailed markdown report suitable for documentation.
   ```

3. Wait for architect agent to complete

4. **Create Final Report File**:
   - Filename: `refactor-result-{timestamp}.md`
   - Content: Complete assessment report from architect agent
   - Use Write tool to create file

5. Inform user:
   ```
   Refactoring complete!

   Summary:
   - Iterations: {max_iterations}
   - Tests: All passing
   - Report: refactor-result-{timestamp}.md

   Quality Scores:
   - Clean Code: X/10
   - Architecture: Y/10
   ```

## Important Orchestration Notes

### Agent Management
- Launch agents using the Task tool with appropriate subagent_type
- Wait for each agent to complete before proceeding
- Pass clear, specific instructions to each agent
- Include context about iteration number when relevant

### State Management
- Track `refactoring_iteration` carefully
- Always check iteration count before deciding to loop
- Maintain clear context about what's been done

### Todo Tracking
- Use TodoWrite at start to create full task list
- Update todos as you progress through steps
- Mark steps complete as you finish them
- Keep user informed of progress

### Error Handling
- If an agent fails or gets stuck, report to user
- Don't proceed if tests are failing after multiple fix attempts
- Ask user for guidance if unexpected situations arise

### Communication
- Keep user informed at key transition points
- Report iteration progress
- Provide brief summaries after each major step
- Show enthusiasm for quality improvements achieved

## Success Criteria

Refactoring is complete when:
- ✓ Test coverage meets production requirements
- ✓ All tests pass
- ✓ 3 refactoring iterations completed
- ✓ Code quality scores assigned
- ✓ Final assessment report generated
- ✓ No functionality changes (only quality improvements)

## Example Execution Flow

```
User: /refactor src/utils/

[Step 1] Launching test agent for coverage analysis...
→ Coverage: 45% → 92%
→ Added 23 test cases
→ All tests passing ✓

[Step 2] Iteration 1: Launching architect agent...
→ Identified 12 optimization opportunities
→ Top 3 priorities selected

[Step 3] Launching code agent for implementation...
→ Implemented 3 optimizations
→ Files modified: 5

[Step 4] Running test suite...
→ 2 tests failing

[Step 5] Fixing test failures...
→ Fixed root cause
→ Re-running tests... ✓ All passing

[Step 6] Iteration 1 complete. Starting iteration 2...

[Step 2] Iteration 2: Launching architect agent...
[... continues for 3 iterations ...]

[Step 7] Final assessment...
→ Clean Code Score: 8/10
→ Architecture Score: 9/10
→ Report: refactor-result-2025-11-17-153045.md

Refactoring complete! Code quality significantly improved.
```

## Best Practices

- **Be Patient**: Each iteration takes time; quality is worth it
- **Trust the Process**: The iterative approach catches issues
- **Communicate Clearly**: Keep user informed at each step
- **Track Progress**: Use TodoWrite to maintain visibility
- **Verify Safety**: Tests must pass before proceeding
- **Document Results**: Final report is important artifact

---

Begin the refactoring process now based on: $ARGUMENTS

Create your todo list and start with Step 1 (Ensure Test Coverage).
