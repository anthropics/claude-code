---
description: Ultimate code review using all expert agents - ensures world-class quality
argument-hint: "[path or scope to review]"
---

You are performing the **ultimate world-class code review**. This is the gold standard review that ensures code meets the highest quality bar before merging to main.

## Review Scope

Target: $ARGUMENTS

If no specific path provided, review all changed files: !`git diff --name-only`

## World-Class Review Process

This review orchestrates all expert agents to provide comprehensive feedback across every dimension of code quality.

## Phase 1: Context Gathering

Gather context about the changes:

```bash
# What changed?
!`git diff --stat`

# Detailed changes
!`git diff`

# Commit messages
!`git log --oneline -5`
```

## Phase 2: CLAUDE.md Compliance Check

Review changes against CLAUDE.md guidelines:

Read and reference: `.claude/CLAUDE.md`

**Check for:**
- ✅ Security-first mindset
- ✅ Code quality and readability
- ✅ Proper error handling
- ✅ Performance considerations
- ✅ Testing included
- ✅ Documentation updated

## Phase 3: Multi-Dimensional Expert Review

Launch ALL expert agents in PARALLEL for comprehensive analysis:

### Security Review (security-expert)

**Task:**
- Review $ARGUMENTS for security vulnerabilities
- Check authentication/authorization changes
- Verify input validation
- Look for injection risks
- Check for secrets in code
- Ensure security best practices

Provide: Critical/High/Medium/Low findings with exact locations and remediation.

### Architecture Review (architecture-guru)

**Task:**
- Review $ARGUMENTS for architectural quality
- Assess design decisions and patterns
- Check for code smells (god classes, tight coupling)
- Verify separation of concerns
- Evaluate maintainability
- Check scalability implications

Provide: Architecture assessment with improvement recommendations.

### Testing Review (test-master)

**Task:**
- Review $ARGUMENTS for test coverage
- Check if new code has tests
- Verify test quality (not flaky, deterministic)
- Identify missing edge cases
- Assess integration test needs
- Review test naming and structure

Provide: Test coverage analysis and recommendations for additional tests.

### Performance Review (performance-optimizer)

**Task:**
- Review $ARGUMENTS for performance issues
- Check algorithm complexity
- Look for database performance issues (N+1 queries)
- Identify caching opportunities
- Check for blocking operations
- Assess resource usage

Provide: Performance analysis with optimization recommendations.

### Documentation Review (docs-wizard)

**Task:**
- Review $ARGUMENTS for documentation quality
- Check for missing docstrings
- Verify inline comments for complex logic
- Check if README needs updates
- Verify API documentation updates
- Check changelog updates

Provide: Documentation assessment and recommendations.

---

**CRITICAL**: Launch all 5 agents in PARALLEL (single message with 5 Task tool calls) for maximum efficiency!

---

## Phase 4: Aggregate Expert Feedback

After all agents complete, compile comprehensive review:

```markdown
# World-Class Code Review

**Reviewer**: Claude Code (Multi-Agent Review)
**Scope**: $ARGUMENTS
**Date**: [Current date]

## Review Summary

### Overall Assessment: [APPROVE / REQUEST CHANGES / REJECT]

**Decision Criteria:**
- **APPROVE**: No blocking issues, minor suggestions only
- **REQUEST CHANGES**: Non-critical issues that should be addressed
- **REJECT**: Critical issues present, must fix before merge

### Quality Score: [X/100]

| Dimension | Score | Status | Blocking Issues |
|-----------|-------|--------|-----------------|
| Security | [X/20] | [✅/⚠️/❌] | [N] |
| Architecture | [X/20] | [✅/⚠️/❌] | [N] |
| Testing | [X/20] | [✅/⚠️/❌] | [N] |
| Performance | [X/20] | [✅/⚠️/❌] | [N] |
| Documentation | [X/20] | [✅/⚠️/❌] | [N] |

**Legend:**
- ✅ Excellent - No issues
- ⚠️ Good - Minor improvements suggested
- ❌ Needs Work - Issues must be addressed

## Critical Issues (MUST FIX - Blocking) 🚫

[Issues that absolutely must be fixed before merge]

### From Security Expert:
- [Critical security vulnerabilities]

### From Architecture Guru:
- [Critical architecture problems]

### From Test Master:
- [Critical missing tests]

### From Performance Optimizer:
- [Critical performance issues]

### From Docs Wizard:
- [Critical missing documentation]

## High Priority Issues (SHOULD FIX) ⚠️

[Important issues that should be addressed before or shortly after merge]

### Security:
- [High priority security concerns]

### Architecture:
- [High priority design issues]

### Testing:
- [High priority test gaps]

### Performance:
- [High priority performance concerns]

### Documentation:
- [High priority documentation gaps]

## Medium Priority Suggestions (NICE TO HAVE) 💡

[Improvements that would be beneficial but not blocking]

### Security:
- [Medium priority security improvements]

### Architecture:
- [Medium priority design improvements]

### Testing:
- [Medium priority test improvements]

### Performance:
- [Medium priority optimizations]

### Documentation:
- [Medium priority documentation improvements]

## What's Done Well ✨

[Positive feedback - what the author did right]

- ✅ [Specific praise from agents]
- ✅ [Good patterns observed]
- ✅ [Best practices followed]

## CLAUDE.md Compliance

Check against project guidelines:

- [✅/❌] **Security First** - [Findings]
- [✅/❌] **Code Quality** - [Findings]
- [✅/❌] **Testing** - [Findings]
- [✅/❌] **Performance** - [Findings]
- [✅/❌] **Error Handling** - [Findings]
- [✅/❌] **Documentation** - [Findings]

## Detailed Agent Reports

### Security Expert Report
[Full report from security-expert agent]

### Architecture Guru Report
[Full report from architecture-guru agent]

### Test Master Report
[Full report from test-master agent]

### Performance Optimizer Report
[Full report from performance-optimizer agent]

### Docs Wizard Report
[Full report from docs-wizard agent]

## Recommended Next Steps

### Before Merge:
1. [Must-fix items]
2. [Should-fix items]
3. [Test additions needed]

### After Merge (Technical Debt):
1. [Future improvements]
2. [Refactoring opportunities]
3. [Enhancement ideas]

## Review Checklist

- [ ] **Security**: No critical vulnerabilities
- [ ] **Architecture**: Design is sound and maintainable
- [ ] **Testing**: Adequate test coverage, tests pass
- [ ] **Performance**: No obvious bottlenecks
- [ ] **Documentation**: Changes are documented
- [ ] **CLAUDE.md**: Follows project guidelines
- [ ] **Breaking Changes**: None, or properly documented
- [ ] **Dependencies**: No new vulnerabilities introduced

## Confidence Score

**Overall Confidence**: [High/Medium/Low]

This review was performed by 5 specialized AI agents with expertise in:
- Security (security-expert)
- Architecture (architecture-guru)
- Testing (test-master)
- Performance (performance-optimizer)
- Documentation (docs-wizard)

While comprehensive, this review should complement (not replace) human code review. The agents may miss context that human reviewers would catch.

## Final Recommendation

### [APPROVE ✅ / REQUEST CHANGES ⚠️ / REJECT ❌]

**Rationale**: [Explanation of decision]

**If REQUEST CHANGES or REJECT**:
1. Address all critical issues
2. Fix high priority issues where possible
3. Respond to feedback in follow-up commit
4. Request re-review after changes

**If APPROVE**:
- All critical issues resolved
- Code meets quality standards
- Ready to merge to main branch
- Minor suggestions tracked as future improvements

---

## Merge Guidelines

**Ready to Merge When:**
- ✅ No critical issues (security, correctness, data loss risks)
- ✅ High priority issues addressed or have plan
- ✅ All tests pass
- ✅ Code coverage meets threshold (80%+)
- ✅ Documentation updated
- ✅ Breaking changes documented
- ✅ At least one human reviewer approved

**Do NOT Merge If:**
- ❌ Critical security vulnerabilities present
- ❌ Tests failing
- ❌ Code could cause data loss or corruption
- ❌ Breaking changes without migration path
- ❌ Significant performance regressions
- ❌ Missing tests for new functionality

---

Thank you for your contribution! This thorough review ensures we maintain world-class code quality. 🚀

Questions? Discuss feedback with the team or request clarification on specific points.
```

## Phase 5: Interactive Discussion (Optional)

If the author has questions about feedback:
- Explain the rationale behind findings
- Discuss trade-offs
- Suggest alternative approaches
- Clarify ambiguous feedback

## Remember

**This world-class review ensures:**
- 🔒 Security vulnerabilities caught early
- 🏗️ Architecture remains maintainable
- 🧪 Test coverage is comprehensive
- ⚡ Performance is acceptable
- 📚 Documentation stays current

**Review mindset:**
- Be thorough but kind
- Suggest, don't demand (except for critical issues)
- Explain the "why" behind feedback
- Acknowledge good work
- Focus on impact, not perfection

**The goal is not perfection - it's continuous improvement.**

Every review is a learning opportunity for both the author and reviewers. Build each other up, share knowledge, and create excellent software together. 💪
