---
description: Comprehensive quality assessment - testing, architecture, performance, security, docs
argument-hint: "[path or scope to check]"
---

You are performing a **comprehensive quality assessment** of the codebase. This is a holistic review covering all aspects of software quality.

## Quality Assessment Scope

Target: $ARGUMENTS

If no specific path provided, assess the entire codebase.

## Multi-Agent Quality Analysis

Launch all quality agents in PARALLEL for maximum efficiency:

### 1. Testing Quality (test-master)

**Task for test-master:**
- Analyze test coverage for: $ARGUMENTS
- Identify untested code paths
- Assess test quality (flaky tests, slow tests, brittle tests)
- Recommend tests to add
- Check for edge cases and boundary conditions

### 2. Architecture Quality (architecture-guru)

**Task for architecture-guru:**
- Analyze architecture and design of: $ARGUMENTS
- Evaluate scalability and maintainability
- Identify architectural smells (god classes, tight coupling)
- Check for appropriate use of design patterns
- Assess modularity and separation of concerns

### 3. Performance Quality (performance-optimizer)

**Task for performance-optimizer:**
- Analyze performance of: $ARGUMENTS
- Identify bottlenecks and inefficiencies
- Check algorithm complexity
- Look for database performance issues
- Assess caching strategy

### 4. Security Quality (security-expert)

**Task for security-expert:**
- Security audit of: $ARGUMENTS
- Check for common vulnerabilities
- Verify input validation and sanitization
- Review authentication/authorization
- Look for hardcoded secrets

### 5. Documentation Quality (docs-wizard)

**Task for docs-wizard:**
- Assess documentation for: $ARGUMENTS
- Check for missing docstrings
- Verify README and guides are current
- Look for undocumented features
- Assess code comment quality

---

**Important**: Launch all 5 agents in parallel (single message with multiple Task tool calls) for efficiency!

---

## Quality Scoring

After agents complete their analysis, compile a quality score:

```markdown
# Code Quality Report

**Scope**: $ARGUMENTS
**Date**: [Current date]

## Overall Quality Score: [X/100]

### Dimension Scores

| Dimension | Score | Grade | Status |
|-----------|-------|-------|--------|
| Testing | [X/20] | [A-F] | [✅/⚠️/❌] |
| Architecture | [X/20] | [A-F] | [✅/⚠️/❌] |
| Performance | [X/20] | [A-F] | [✅/⚠️/❌] |
| Security | [X/20] | [A-F] | [✅/⚠️/❌] |
| Documentation | [X/20] | [A-F] | [✅/⚠️/❌] |

### Grading Scale
- **A (18-20)**: Excellent - Best practices followed
- **B (15-17)**: Good - Minor improvements needed
- **C (12-14)**: Acceptable - Some issues to address
- **D (9-11)**: Needs Work - Significant improvements required
- **F (0-8)**: Poor - Critical issues present

## Executive Summary

### Strengths ✅
- [What's done well across all dimensions]
- [Positive findings]

### Critical Issues ❌
- [Critical problems that must be fixed immediately]
- [Blockers for production deployment]

### High Priority Improvements ⚠️
- [Important issues to address soon]
- [Technical debt to pay down]

### Recommendations 💡
- [Strategic improvements]
- [Process recommendations]
- [Tools to adopt]

## Detailed Findings

### Testing Quality

**Coverage**: [X%]
**Test Count**: [N unit, M integration, P E2E]

**Strengths**:
- [From test-master agent]

**Gaps**:
- [From test-master agent]

**Recommendations**:
- [From test-master agent]

### Architecture Quality

**Architecture Pattern**: [Identified pattern]
**Modularity Score**: [Rating]

**Strengths**:
- [From architecture-guru agent]

**Issues**:
- [From architecture-guru agent]

**Recommendations**:
- [From architecture-guru agent]

### Performance Quality

**p95 Response Time**: [X ms]
**Throughput**: [Y req/s]

**Strengths**:
- [From performance-optimizer agent]

**Bottlenecks**:
- [From performance-optimizer agent]

**Recommendations**:
- [From performance-optimizer agent]

### Security Quality

**Security Issues**: [N critical, M high, P medium, Q low]

**Strengths**:
- [From security-expert agent]

**Vulnerabilities**:
- [From security-expert agent]

**Recommendations**:
- [From security-expert agent]

### Documentation Quality

**Documentation Coverage**: [X%]
**Docstrings Present**: [Y%]

**Strengths**:
- [From docs-wizard agent]

**Gaps**:
- [From docs-wizard agent]

**Recommendations**:
- [From docs-wizard agent]

## Action Plan

### Immediate Actions (This Week)
1. [Critical fixes from all agents]
2. [Blockers for deployment]

### Short-term Improvements (This Month)
1. [High priority improvements]
2. [Important technical debt]

### Long-term Strategic Improvements (This Quarter)
1. [Architectural refactoring]
2. [Process improvements]
3. [Infrastructure upgrades]

## Compliance Check

Verify compliance with CLAUDE.md guidelines:

- [ ] **Security First** - No critical security issues
- [ ] **Code Quality** - Follows coding standards
- [ ] **Testing** - 80%+ coverage, all tests pass
- [ ] **Performance** - Meets performance targets
- [ ] **Error Handling** - Proper error handling throughout
- [ ] **Documentation** - All public APIs documented

## Quality Gates

### Ready for Development ✅
- [ ] All critical issues resolved
- [ ] High priority issues planned
- [ ] Technical debt documented

### Ready for Code Review ✅
- [ ] All tests pass
- [ ] No linter errors
- [ ] Code coverage ≥80%
- [ ] No critical security issues

### Ready for Production ✅
- [ ] All critical and high issues resolved
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Monitoring in place

## Trend Analysis

Compare with previous quality checks (if available):

| Metric | Previous | Current | Trend |
|--------|----------|---------|-------|
| Overall Score | [X] | [Y] | [↑/↓/→] |
| Test Coverage | [X%] | [Y%] | [↑/↓/→] |
| Security Issues | [N] | [M] | [↑/↓/→] |
| Tech Debt Items | [X] | [Y] | [↑/↓/→] |

## Next Steps

1. **Review findings** with the team
2. **Prioritize improvements** based on impact
3. **Create tasks** for action items
4. **Schedule fixes** in upcoming sprints
5. **Set up monitoring** for quality metrics
6. **Schedule next quality check** (recommended: monthly)

---

## Quality Metrics Dashboard

Consider implementing continuous quality monitoring:

**Automated Checks:**
- Test coverage tracking
- Linter in CI/CD
- Security scanning (npm audit, Snyk)
- Performance benchmarks in CI
- Documentation coverage

**Manual Reviews:**
- Monthly quality assessments
- Quarterly architecture reviews
- Regular security audits
- Code review metrics tracking

---

**Remember**: Quality is not a phase - it's a continuous practice. This assessment provides a snapshot, but quality must be maintained every day through good practices, automated checks, and team discipline.

🎯 Excellence is not an act, it's a habit.
```

## After the Assessment

Based on the quality report:

1. **Address Critical Issues** - Block everything else until fixed
2. **Plan High Priority Fixes** - Schedule in next sprint
3. **Document Technical Debt** - Track medium/low issues
4. **Share Learnings** - Discuss with team
5. **Update Processes** - Improve to prevent similar issues
6. **Celebrate Wins** - Acknowledge what's done well

Quality assessment is not about blame - it's about continuous improvement. Use these findings to build better software. 🚀
