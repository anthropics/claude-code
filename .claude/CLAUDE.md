# Claude Code - Coding Excellence Guidelines

## Mission Statement

This project represents the future of AI-assisted development. Every line of code, every decision, every interaction should embody excellence, security, and thoughtful engineering.

## Core Development Principles

### 1. Security First
- **Never compromise on security** - Validate all inputs, sanitize all outputs
- **Principle of least privilege** - Request only necessary permissions
- **Defense in depth** - Multiple layers of security validation
- **Zero trust architecture** - Validate everything, trust nothing
- **Secure by default** - Safe defaults, explicit opt-in for risky operations

**Specific Requirements:**
- No hardcoded credentials or secrets
- All user inputs must be validated and sanitized
- Use parameterized queries for database operations
- Implement rate limiting on API endpoints
- Log security-relevant events
- Regular dependency audits

### 2. Code Quality and Maintainability
- **Readability over cleverness** - Code is read 10x more than written
- **Single Responsibility Principle** - Each function/class does one thing well
- **DRY but not WET** - Don't Repeat Yourself, but avoid wrong abstractions
- **YAGNI** - You Aren't Gonna Need It - build what's needed now
- **Boy Scout Rule** - Leave code better than you found it

**Specific Requirements:**
- Functions should be < 50 lines (preferably < 20)
- Maximum cyclomatic complexity of 10
- Meaningful variable and function names (no `x`, `tmp`, `foo`)
- Comments explain "why", not "what"
- Extract magic numbers and strings into named constants

### 3. Testing and Reliability
- **Test before ship** - No untested code reaches production
- **Test pyramid** - Many unit tests, fewer integration tests, few E2E tests
- **Test behavior, not implementation** - Tests should survive refactoring
- **Coverage is a tool, not a goal** - 80%+ coverage, but focus on critical paths
- **Fail fast and loud** - Errors should be obvious and actionable

**Specific Requirements:**
- All new features must include tests
- All bug fixes must include regression tests
- Tests must be deterministic (no flaky tests)
- Use descriptive test names: `test_userLogin_withInvalidPassword_returnsUnauthorized`
- Mock external dependencies in unit tests

### 4. Performance and Scalability
- **Measure before optimize** - Premature optimization is the root of all evil
- **Design for scale** - Consider growth from day one
- **Async where it matters** - Don't block on I/O
- **Cache intelligently** - But cache invalidation is hard
- **Monitor everything** - You can't improve what you don't measure

**Specific Requirements:**
- Database queries must use indexes for large tables
- API responses should be < 200ms (p95)
- Implement pagination for list endpoints
- Use connection pooling for database connections
- Profile before optimizing hot paths

### 5. Error Handling and Resilience
- **Never swallow errors silently** - All errors must be logged
- **Fail gracefully** - Degrade functionality, don't crash
- **Provide context** - Error messages should be actionable
- **Retry with backoff** - For transient failures
- **Circuit breakers** - Prevent cascade failures

**Specific Requirements:**
- Use specific error types, not generic exceptions
- Include stack traces in error logs
- User-facing error messages must be helpful and safe
- Implement timeouts for all external calls
- Log errors with sufficient context for debugging

### 6. Documentation and Knowledge Sharing
- **Code documents itself** - Clear names, obvious structure
- **README for every module** - Purpose, usage, examples
- **API documentation** - All public APIs must be documented
- **Architecture Decision Records** - Document why, not just what
- **Runbooks for operations** - How to deploy, debug, recover

**Specific Requirements:**
- All public functions/methods must have docstrings
- README includes quick start and common use cases
- Architecture diagrams for complex systems
- Changelog follows Keep a Changelog format
- Document all environment variables and configuration

## Technology-Specific Guidelines

### TypeScript/JavaScript
- Use TypeScript strict mode
- Prefer `const` over `let`, never use `var`
- Avoid `any` type - use `unknown` if truly unknown
- Use async/await over raw Promises
- Prefer functional programming patterns
- Use optional chaining `?.` and nullish coalescing `??`

### Python
- Follow PEP 8 style guide
- Use type hints for all function signatures
- Prefer f-strings over `.format()` or `%`
- Use context managers (`with`) for resources
- Virtual environments for all projects
- Use `black` for formatting, `mypy` for type checking

### Git Workflow
- Descriptive commit messages (50 char summary, detailed body)
- Small, focused commits (one logical change per commit)
- Never commit directly to main/master
- Pull request descriptions explain the "why"
- Squash commits before merging to keep history clean
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`

### Code Review Standards
- Review for correctness, security, and maintainability
- Suggest improvements, don't just criticize
- Ask questions to understand intent
- Approve when code meets standards, not when perfect
- Block merging for security issues or broken tests
- Respond to reviews within 24 hours

## Anti-Patterns to Avoid

### Security Anti-Patterns
- ❌ `eval()` or `exec()` with user input
- ❌ SQL string concatenation (SQL injection risk)
- ❌ Storing passwords in plain text
- ❌ Using weak cryptographic algorithms (MD5, SHA1 for passwords)
- ❌ Exposing internal error details to users
- ❌ Trusting client-side validation alone

### Performance Anti-Patterns
- ❌ N+1 query problem (query in a loop)
- ❌ Loading entire collections into memory
- ❌ Synchronous operations blocking the main thread
- ❌ No pagination on large datasets
- ❌ Missing database indexes on frequently queried fields
- ❌ Premature optimization without profiling

### Code Quality Anti-Patterns
- ❌ God objects (classes that do everything)
- ❌ Long parameter lists (> 4 parameters)
- ❌ Deep nesting (> 3 levels of indentation)
- ❌ Global state and singletons (where avoidable)
- ❌ Swallowing exceptions silently
- ❌ Commented-out code (use version control instead)

## Development Workflow

### Feature Development Process
1. **Understand** - Clarify requirements, identify edge cases
2. **Design** - Plan architecture, consider alternatives
3. **Implement** - Write clean, tested code
4. **Review** - Self-review, then peer review
5. **Test** - Unit, integration, manual testing
6. **Document** - Update docs, add examples
7. **Deploy** - Roll out gradually, monitor closely
8. **Iterate** - Gather feedback, improve

### Definition of Done
A task is "done" when:
- ✅ Code is written and follows all guidelines above
- ✅ All tests pass (unit, integration, E2E)
- ✅ Code coverage meets threshold (80%+)
- ✅ Security review completed (no critical/high issues)
- ✅ Documentation updated
- ✅ Peer review approved
- ✅ No linter/type checker warnings
- ✅ Deployed to staging and tested
- ✅ Performance benchmarks meet SLAs

## Emergency Response

### Production Incidents
1. **Detect** - Monitoring alerts, user reports
2. **Assess** - Severity, impact, affected users
3. **Mitigate** - Stop the bleeding (rollback, disable feature)
4. **Communicate** - Notify stakeholders, status updates
5. **Resolve** - Permanent fix, verify in production
6. **Learn** - Post-mortem, prevent recurrence

### Security Incidents
1. **Contain** - Isolate affected systems immediately
2. **Assess** - Determine scope and impact
3. **Eradicate** - Remove threat, patch vulnerabilities
4. **Recover** - Restore systems safely
5. **Notify** - Inform affected parties as required
6. **Improve** - Update security controls

## Continuous Improvement

### Learning Culture
- Embrace mistakes as learning opportunities
- Share knowledge through documentation and pairing
- Stay current with security advisories
- Regularly review and update dependencies
- Conduct post-mortems without blame
- Invest in developer productivity tools

### Metrics That Matter
- **Lead time** - Time from commit to production
- **Deployment frequency** - How often we ship
- **Mean time to recovery** - How fast we fix issues
- **Change failure rate** - How often deployments cause issues
- **Code review time** - Feedback loop speed
- **Test coverage** - Safety net quality

## Principles for AI-Assisted Development

### When Using AI (Claude Code)
- **Verify AI suggestions** - AI can make mistakes, always review
- **Understand the code** - Don't merge what you don't understand
- **Security first** - Extra vigilance on security-sensitive code
- **Test thoroughly** - AI-generated code needs testing like any other
- **Learn from AI** - Use explanations to improve your skills
- **Provide context** - Better context → better AI suggestions

### AI as a Force Multiplier
- Use AI for boilerplate, focus on creative problems
- Let AI handle routine tasks, you handle critical thinking
- AI suggests, you decide - maintain agency
- Collaborate with AI, don't just consume
- Teach AI your standards through examples and feedback

---

## Remember

**Excellence is not a destination, it's a habit.**

Every commit is an opportunity to demonstrate craftsmanship. Every code review is a chance to share knowledge. Every bug is a lesson to prevent future issues.

We're not just writing code - we're building systems that empower people, protect their data, and make their lives better. That responsibility demands our best work.

Let's change the world through excellent engineering. 🚀
