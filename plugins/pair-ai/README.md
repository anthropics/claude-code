# pair-ai Plugin

> Two AIs debate while coding - one implements, one critiques, resulting in better code through collaborative discussion

[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-Plugin-blue)](https://github.com/anthropics/claude-code)
[![Version](https://img.shields.io/badge/version-1.0.0-green)](./plugin.json)

## Table of Contents

- [Overview](#overview)
- [Philosophy](#philosophy)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Command Reference](#command-reference)
- [The 5-Phase Workflow](#the-5-phase-workflow)
- [Agents](#agents)
- [Usage Examples](#usage-examples)
- [Configuration](#configuration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Contributing](#contributing)

---

## Overview

**pair-ai** brings the power of pair programming to AI-assisted coding. Instead of relying on a single AI perspective, two specialized AI agents collaborate:

- **Implementer**: A pragmatic engineer focused on writing working code
- **Critic**: A senior reviewer focused on quality, security, and edge cases

This debate-driven approach produces more robust code than either agent could create alone.

### Key Features

- **Real-time Quality Assurance**: Issues are caught during development, not after
- **Multi-perspective Review**: Security, performance, and maintainability checked simultaneously
- **Constructive Dialogue**: Agents debate and defend their positions
- **Severity-based Filtering**: Only important issues (score >= 70) are surfaced
- **Learning Opportunity**: See different perspectives on the same problem

### What Makes pair-ai Different?

| Aspect | Traditional Review | pair-ai |
|--------|-------------------|---------|
| Timing | After code is written | During development |
| Direction | One-way feedback | Two-way debate |
| Iterations | Usually one pass | Multiple refinement rounds |
| Perspective | Single reviewer bias | Multiple viewpoints |
| Learning | Limited | See debate rationale |

---

## Philosophy

### Why Pair Programming Works

Pair programming has been a cornerstone of software development practices for decades. Its benefits include:

1. **Immediate Feedback**: Issues are caught as they're introduced
2. **Knowledge Sharing**: Different perspectives improve understanding
3. **Reduced Bias**: Two minds prevent "tunnel vision"
4. **Higher Quality**: Code reviewed in real-time has fewer defects

### Bringing Pair Programming to AI

When a single AI writes code, it can fall into predictable patterns:
- First solution that works might not be the best
- Security implications might be overlooked
- Edge cases might be missed
- Performance issues might go unnoticed

By having two AIs with different roles and perspectives debate, we get:
- **Implementer** pushes for practical, working solutions
- **Critic** ensures quality standards are met
- **Debate** resolves disagreements through reasoning
- **Result** is code that satisfies both perspectives

---

## Installation

### Prerequisites

- Claude Code CLI installed and configured
- A Claude Code workspace or project

### Install the Plugin

```bash
# Clone or copy the plugin to your plugins directory
cp -r pair-ai ~/.claude/plugins/

# Or add to a project-specific plugins folder
cp -r pair-ai ./plugins/
```

### Verify Installation

```bash
# Start Claude Code
claude

# Check if the command is available
/pair-code --help
```

---

## Quick Start

### Your First Pair Coding Session

```bash
# Start Claude Code
claude

# Run a simple pair coding session
/pair-code "Write a function to validate email addresses"
```

### What Happens

1. **Phase 1**: Claude clarifies requirements if needed
2. **Phase 2**: Implementer writes initial code
3. **Phase 3**: Critic reviews and identifies issues
4. **Phase 4**: Implementer revises based on feedback
5. **Phase 5**: Final code and debate summary presented

---

## Command Reference

### `/pair-code`

Start a collaborative coding session with two AI agents.

**Syntax**:
```
/pair-code <description of what to build>
```

**Arguments**:
- `description`: A clear description of the code you want to create

**Examples**:
```bash
/pair-code "Create a user authentication function"
/pair-code "Implement a rate limiter using token bucket algorithm"
/pair-code "Write a function to parse and validate JSON configuration"
```

---

## The 5-Phase Workflow

### Phase 1: Understanding

**Goal**: Ensure clear requirements before coding begins

The session starts by clarifying what needs to be built. If the task description is ambiguous, you'll be asked for:

- **Specific Requirements**: What exactly should the code do?
- **Constraints**: Language, framework, performance requirements?
- **Acceptance Criteria**: How do we know when it's done?

**Example Clarification**:
```
User: /pair-code "Write a cache"

Claude: I need some clarification:
- What type of cache? (in-memory, distributed, file-based)
- What's the eviction policy? (LRU, LFU, TTL)
- What data types need to be cached?
- Any size or performance constraints?
```

### Phase 2: Initial Implementation

**Goal**: Create a working first draft

The **Implementer** agent writes the initial code, focusing on:

- Meeting functional requirements
- Writing clean, readable code
- Following project conventions
- Handling common error cases

**What You'll See**:
```
[Implementer] Phase 2: Initial Implementation

I'll implement a rate limiter using the token bucket algorithm.

```python
class TokenBucketRateLimiter:
    def __init__(self, rate, capacity):
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_update = time.time()

    def allow_request(self):
        self._refill()
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False

    def _refill(self):
        now = time.time()
        elapsed = now - self.last_update
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        self.last_update = now
```

This implementation provides the core token bucket functionality with
automatic refill based on elapsed time.
```

### Phase 3: Critique Round

**Goal**: Identify areas for improvement

The **Critic** agent reviews the implementation, analyzing:

- **Correctness**: Logic errors, edge cases, error handling
- **Security**: Vulnerabilities, data exposure, input validation
- **Performance**: Complexity, resource usage, scalability
- **Maintainability**: Readability, structure, documentation

**Scoring System**:
- **90-100 (Critical)**: Must fix - crashes, security holes
- **70-89 (Important)**: Should fix - bugs, significant issues
- **50-69 (Suggested)**: Nice to fix - minor improvements
- **0-49 (Nitpick)**: Optional - style preferences

Only issues scoring 70+ are reported.

**Example Critique**:
```
[Critic] Phase 3: Critique

## Code Review

### Critical Issues (90-100)
1. [Score: 92] Race condition in token bucket
   - Location: allow_request() and _refill()
   - Problem: Not thread-safe; concurrent calls can cause negative tokens
   - Suggestion: Add threading.Lock() for synchronization

### Important Issues (70-89)
1. [Score: 85] Integer overflow potential
   - Location: _refill() elapsed calculation
   - Problem: Very long intervals could cause float precision issues
   - Suggestion: Add maximum elapsed time cap

2. [Score: 78] Missing input validation
   - Location: __init__()
   - Problem: Negative rate or capacity not handled
   - Suggestion: Add validation in constructor

### Summary
- Total issues found: 3
- Critical: 1, Important: 2
- Overall assessment: Needs Work - Thread safety must be addressed
```

### Phase 4: Revision Round

**Goal**: Improve code based on critique

The **Implementer** receives the feedback and:

- Addresses high-priority issues
- Explains what changes were made
- Defends decisions if critique was incorrect
- May request another critique round if changes are significant

**Example Revision**:
```
[Implementer] Phase 4: Revision

Thank you for the thorough review. I've addressed all issues:

```python
import threading
import time

class TokenBucketRateLimiter:
    MAX_ELAPSED = 3600  # Cap refill calculation at 1 hour

    def __init__(self, rate: float, capacity: float):
        if rate <= 0:
            raise ValueError("Rate must be positive")
        if capacity <= 0:
            raise ValueError("Capacity must be positive")

        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_update = time.time()
        self._lock = threading.Lock()

    def allow_request(self) -> bool:
        with self._lock:
            self._refill()
            if self.tokens >= 1:
                self.tokens -= 1
                return True
            return False

    def _refill(self):
        now = time.time()
        elapsed = min(now - self.last_update, self.MAX_ELAPSED)
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        self.last_update = now
```

Changes made:
1. Added threading.Lock() for thread safety
2. Added MAX_ELAPSED cap to prevent precision issues
3. Added input validation in constructor
4. Added type hints for clarity
```

### Phase 5: Summary

**Goal**: Present final result with debate summary

The session concludes with:

- Final code implementation
- Summary of issues found and resolved
- Any remaining concerns
- Suggested next steps

**Example Summary**:
```
[Summary] Phase 5

## Final Code
[The revised implementation above]

## Debate Summary
- **Issues Found**: 3 (1 critical, 2 important)
- **Issues Resolved**: 3
- **Rounds**: 2 (initial + 1 revision)
- **Key Improvements**:
  1. Thread-safe with proper locking
  2. Protected against precision overflow
  3. Input validation added

## Suggested Next Steps
- Add unit tests for concurrent access
- Consider adding async/await support
- Add metrics/logging for monitoring
- Document the rate and capacity parameters
```

---

## Agents

### Implementer Agent

**Role**: The pragmatic coder who gets things working

**Characteristics**:
- Focuses on functional requirements first
- Writes clean, readable code
- Follows project conventions
- Open to constructive feedback
- Defends good decisions

**Tools Available**:
- `Read`: Read files to understand context
- `Write`: Create new files
- `Edit`: Modify existing files
- `Glob`: Find files by pattern
- `Grep`: Search file contents
- `Bash`: Run shell commands

**Model**: Sonnet (balanced speed and capability)

### Critic Agent

**Role**: The senior reviewer ensuring quality

**Characteristics**:
- Focuses on correctness first, then security, performance, maintainability
- Provides actionable feedback
- Uses severity scoring to prioritize issues
- Constructive rather than destructive
- Acknowledges good code

**Tools Available**:
- `Read`: Read files for review
- `Glob`: Find related files
- `Grep`: Search for patterns

**Model**: Opus (thorough analysis capability)

---

## Usage Examples

### Example 1: Simple Utility Function

```bash
/pair-code "Write a function to check if a string is a palindrome"
```

**Typical Flow**:
- Implementer: Basic palindrome check
- Critic: Points out Unicode handling, case sensitivity
- Implementer: Adds normalization
- Result: Robust palindrome checker

### Example 2: Security-Sensitive Code

```bash
/pair-code "Create a password hashing function for user registration"
```

**Typical Flow**:
- Implementer: Uses basic hashing
- Critic: Points out need for bcrypt/argon2, salt handling, timing attacks
- Implementer: Implements secure hashing with proper algorithm
- Result: Production-ready password handling

### Example 3: Performance-Critical Code

```bash
/pair-code "Implement a function to find the longest common subsequence"
```

**Typical Flow**:
- Implementer: Recursive solution
- Critic: Points out exponential complexity, suggests DP
- Implementer: Implements dynamic programming solution
- Result: Efficient O(mn) algorithm

### Example 4: API Integration

```bash
/pair-code "Write a retry wrapper for HTTP requests with exponential backoff"
```

**Typical Flow**:
- Implementer: Basic retry loop
- Critic: Points out jitter, max attempts, specific error handling
- Implementer: Adds jitter, configurable limits, proper exceptions
- Result: Production-ready retry mechanism

### Example 5: Data Validation

```bash
/pair-code "Create a function to validate and parse a configuration file"
```

**Typical Flow**:
- Implementer: Basic JSON/YAML parsing
- Critic: Points out schema validation, error messages, defaults
- Implementer: Adds comprehensive validation
- Result: Robust configuration parser

---

## Configuration

### Customizing Agent Behavior

You can modify the agent files to adjust behavior:

**Adjust Severity Threshold** (in `critic.md`):
```markdown
**Only report issues scoring 60+**  # Lower threshold for more feedback
```

**Change Implementer Focus** (in `implementer.md`):
```markdown
- Prioritize performance over readability  # For performance-critical code
```

### Workflow Customization

Modify `pair-code.md` to change the workflow:

**Add More Critique Rounds**:
```markdown
3. If significant changes were made, run another critique round (max 3 total)
```

**Skip Certain Phases**:
```markdown
## Phase 3: Critique Round (Optional)
Skip if the implementation is straightforward and low-risk.
```

---

## Best Practices

### Writing Good Task Descriptions

**Do**:
```bash
/pair-code "Write a function to validate email addresses that handles
international domains and returns detailed error messages"
```

**Don't**:
```bash
/pair-code "email validation"
```

### When to Use pair-ai

**Good Use Cases**:
- Security-sensitive code (authentication, encryption)
- Complex algorithms
- API integrations
- Data validation and parsing
- Concurrent/async code

**Consider Alternatives For**:
- Simple one-liners
- Well-understood boilerplate
- Quick prototypes where quality isn't critical

### Getting the Most from Debates

1. **Provide Context**: Include relevant constraints and requirements
2. **Be Specific**: Vague requests lead to generic debates
3. **Allow Iterations**: Don't rush; let the debate play out
4. **Learn from Debates**: Read the reasoning, not just the code

---

## Troubleshooting

### Common Issues

#### Debate Goes in Circles

**Problem**: Agents keep finding new issues without converging

**Solution**: The workflow limits critique rounds to 2 by default. If debates consistently need more rounds, the task may be too complex—consider breaking it into smaller pieces.

#### Critic is Too Harsh

**Problem**: Critic flags too many minor issues

**Solution**: Check that the severity threshold is set to 70+ in the critic agent. You can also modify the critic's guidelines to be more lenient.

#### Implementer Ignores Feedback

**Problem**: Revised code doesn't address critique

**Solution**: Ensure the feedback was clearly communicated. The implementer should acknowledge each issue and either fix it or explain why it's not applicable.

#### Session Takes Too Long

**Problem**: Pair coding session is very slow

**Solution**:
- Use more specific task descriptions
- Consider if the task is appropriate for pair-ai
- Check if the models are responding slowly

### Debug Mode

To see more details about what's happening:

```bash
# Run Claude Code with verbose logging
CLAUDE_DEBUG=1 claude
/pair-code "your task"
```

---

## FAQ

### General Questions

**Q: How is this different from code review plugins?**

A: Traditional code review happens after code is written. pair-ai integrates review into the writing process itself, catching issues before they're "finished."

**Q: Can I use pair-ai for existing code?**

A: pair-ai is designed for writing new code. For reviewing existing code, consider the code-review plugin.

**Q: Does pair-ai work with all programming languages?**

A: Yes, both agents are language-agnostic. They understand context from your project and adapt accordingly.

### Technical Questions

**Q: Why use different models for each agent?**

A: Sonnet is faster and good for implementation. Opus provides deeper analysis for critique. This balances speed and thoroughness.

**Q: Can I change the models?**

A: Yes, modify the `model:` field in each agent's markdown file.

**Q: How many rounds of debate happen?**

A: Typically 2-3 rounds: initial implementation, critique, and revision. Complex cases may have a second critique round, but it's capped at 2 critique rounds to prevent endless loops.

**Q: What happens if agents disagree?**

A: The implementer can defend their decisions. If the critique is wrong, the implementer explains why and the original code may be kept.

### Usage Questions

**Q: Can I interrupt a session?**

A: Yes, use Ctrl+C to stop. You can start a new session with refined requirements.

**Q: How do I provide additional context?**

A: Include it in your task description, or answer clarifying questions in Phase 1.

**Q: Can I see the full debate history?**

A: Yes, the entire conversation is shown in your Claude Code session.

---

## Contributing

We welcome contributions to improve pair-ai!

### Areas for Improvement

- Additional agent personalities (e.g., performance specialist, security expert)
- More workflow variations
- Better prompts for specific use cases
- Integration with testing frameworks

### Submitting Changes

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with various use cases
5. Submit a pull request

### Feedback

Found a bug or have a suggestion? Please open an issue on GitHub.

---

## License

This plugin is part of the Claude Code ecosystem. See the main repository for license details.

---

## Acknowledgments

- Inspired by traditional pair programming practices
- Built for the Claude Code plugin system
- Thanks to the Claude Code community for feedback and testing

---

## Changelog

### 1.0.0 (Initial Release)

- `/pair-code` command with 5-phase workflow
- Implementer agent (pragmatic coder)
- Critic agent (senior reviewer)
- Severity-based issue filtering (70+ threshold)
- Comprehensive documentation

---

## Appendix: Example Full Session

Below is a complete example of a pair-ai session for reference:

### Task: User Authentication Function

```
User: /pair-code "Create a user login function with password verification"

---

[Phase 1: Understanding]

I'll create a user authentication function. Let me confirm a few details:
- Should this use a specific hashing algorithm (bcrypt, argon2)?
- Is there an existing database interface to use?
- Should it return a session token or just boolean?

User: Use bcrypt, assume db.get_user(username) exists, return boolean

---

[Phase 2: Initial Implementation]

[Implementer]

def authenticate(username: str, password: str) -> bool:
    user = db.get_user(username)
    if user and user.password == password:
        return True
    return False

A straightforward authentication function that checks if the user exists
and if the password matches.

---

[Phase 3: Critique]

[Critic]

## Code Review

### Critical Issues (90-100)
1. [Score: 95] Plain text password comparison
   - Location: line 3
   - Problem: Comparing passwords in plain text is a critical security
     vulnerability. Passwords should be hashed.
   - Suggestion: Use bcrypt.checkpw() for password verification

2. [Score: 92] Timing attack vulnerability
   - Location: line 3
   - Problem: The function returns faster when user doesn't exist vs
     wrong password, leaking whether usernames are valid
   - Suggestion: Always perform password check, even for non-existent users

### Important Issues (70-89)
1. [Score: 82] Missing input validation
   - Location: function parameters
   - Problem: No validation of username/password format
   - Suggestion: Add basic length and type checks

2. [Score: 75] No logging for security events
   - Problem: Failed authentication attempts aren't logged
   - Suggestion: Add logging for security monitoring

### Summary
- Total issues found: 4
- Critical: 2, Important: 2
- Overall assessment: Significant Issues - Security vulnerabilities must
  be addressed before use

---

[Phase 4: Revision]

[Implementer]

Thank you for the critical security feedback. Here's the revised implementation:

import bcrypt
import logging

logger = logging.getLogger(__name__)

def authenticate(username: str, password: str) -> bool:
    """
    Authenticate a user with secure password verification.

    Args:
        username: The username to authenticate
        password: The plain text password to verify

    Returns:
        True if authentication successful, False otherwise
    """
    # Input validation
    if not username or not password:
        logger.warning(f"Authentication attempt with empty credentials")
        return False

    if len(username) > 255 or len(password) > 1024:
        logger.warning(f"Authentication attempt with oversized input")
        return False

    user = db.get_user(username)

    if not user:
        # Perform dummy hash to prevent timing-based user enumeration
        bcrypt.checkpw(b"dummy", bcrypt.gensalt())
        logger.info(f"Failed login attempt for non-existent user: {username}")
        return False

    # Verify password using bcrypt
    password_valid = bcrypt.checkpw(
        password.encode('utf-8'),
        user.password_hash.encode('utf-8')
    )

    if password_valid:
        logger.info(f"Successful login for user: {username}")
        return True
    else:
        logger.warning(f"Failed login attempt for user: {username}")
        return False

Changes made:
1. Using bcrypt.checkpw() for secure password comparison
2. Added dummy hash check for non-existent users (timing attack prevention)
3. Added input validation for username and password
4. Added logging for security monitoring
5. Added docstring for clarity

---

[Phase 4: Second Critique]

[Critic]

## Code Review

### Critical Issues (90-100)
None

### Important Issues (70-89)
1. [Score: 72] Logging username in failed attempts
   - Location: logger calls
   - Problem: Logging usernames for non-existent users could fill logs
     with attacker-provided data
   - Suggestion: Consider rate limiting or sanitizing logged usernames

### Summary
- Total issues found: 1
- Critical: 0, Important: 1
- Overall assessment: Good - Minor improvement possible but secure for use

---

[Phase 5: Summary]

## Final Code
[The revised implementation above]

## Debate Summary
- **Issues Found**: 5 total across 2 critique rounds
- **Issues Resolved**: 4 (1 minor issue noted but not critical)
- **Key Improvements**:
  1. Plain text comparison → bcrypt secure hashing
  2. Added timing attack protection
  3. Added input validation
  4. Added security logging

## Remaining Considerations
- Consider rate limiting or log sanitization for username logging
- Document that rate limiting should be applied at API layer

## Suggested Next Steps
- Add unit tests for authentication function
- Implement rate limiting middleware
- Set up security monitoring for failed login patterns
- Consider adding multi-factor authentication support
```

---

*Built with Claude Code - AI-assisted development*
