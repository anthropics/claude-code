---
description: Complete feature development with architecture, implementation, testing, and documentation
argument-hint: "[feature description]"
---

You are building a world-class feature from scratch. Follow this comprehensive workflow:

## Phase 0: Codebase Exploration (if needed)

If you're unfamiliar with the codebase, first launch the **code-explorer** agent to understand the system:

**Task for code-explorer:**
- Map the current architecture and identify where the new feature fits
- Find relevant existing code that the feature will interact with
- Identify patterns and conventions to follow
- Locate entry points and integration points
- **Note:** Skip this phase if you already understand the codebase well

## Phase 1: Architecture & Design

Launch the **architecture-guru** agent to analyze the current codebase and design the feature architecture.

**Task for architecture-guru:**
- Understand the existing architecture
- Design how the new feature: $ARGUMENTS fits into the system
- Identify components that need to be created or modified
- Provide implementation approach with clear structure
- Consider scalability, maintainability, and best practices

## Phase 2: Security Planning

Launch the **security-expert** agent to identify security considerations for this feature.

**Task for security-expert:**
- Identify security requirements for: $ARGUMENTS
- Review authentication/authorization needs
- Check for potential vulnerabilities
- Provide security implementation guidelines
- Ensure compliance with security best practices from CLAUDE.md

## Phase 3: Implementation

Based on the architecture design and security guidelines:

1. **Create or modify necessary files** following the architectural plan
2. **Implement the feature** with:
   - Clean, readable code
   - Proper error handling
   - Security measures implemented
   - Following CLAUDE.md guidelines
3. **Add type annotations** (if TypeScript/Python)
4. **Document as you code** (docstrings, comments where needed)

## Phase 4: Testing

Launch the **test-master** agent to design comprehensive tests.

**Task for test-master:**
- Design test strategy for the implemented feature
- Identify edge cases and boundary conditions
- Provide unit test examples
- Suggest integration test scenarios

Then implement the tests:
- Write unit tests
- Write integration tests if needed
- Ensure tests are deterministic and fast
- Run tests and verify they pass

## Phase 5: Performance Review

Launch the **performance-optimizer** agent to review performance.

**Task for performance-optimizer:**
- Analyze the implemented code for performance issues
- Check algorithm complexity
- Identify potential bottlenecks
- Provide optimization recommendations if needed

Implement any critical performance improvements.

## Phase 6: Documentation

Launch the **docs-wizard** agent to create comprehensive documentation.

**Task for docs-wizard:**
- Document the new feature in README or docs
- Ensure all public APIs have docstrings
- Add usage examples
- Update changelog with new feature

## Phase 7: DevOps Integration (if needed)

If the feature requires deployment changes, CI/CD updates, or infrastructure:

Launch the **devops-expert** agent:
- Review deployment requirements
- Update CI/CD pipeline if needed
- Add monitoring/alerting for the new feature
- Ensure proper rollback strategy
- **Note:** Skip this phase if no DevOps changes needed

## Phase 8: Final Quality Check

Run a final review to ensure:
- ✅ All tests pass
- ✅ Code follows CLAUDE.md guidelines
- ✅ Security measures implemented
- ✅ Performance is acceptable
- ✅ Documentation is complete
- ✅ DevOps considerations addressed (if applicable)
- ✅ No linting errors

## Deliverables

Provide a summary:
1. **What was built**: Brief description
2. **Architecture decisions**: Key design choices
3. **Security measures**: How the feature is secured
4. **Test coverage**: What's tested
5. **Performance characteristics**: Expected performance
6. **Documentation**: Where users can learn more

---

**Important Notes:**
- Launch agents in parallel when possible for efficiency
- Each agent should provide detailed, actionable guidance
- Implementation should follow all recommendations from agents
- If agents identify critical issues, address them before proceeding
- Document any trade-offs or decisions made during development

This workflow ensures the feature is: **secure, performant, well-tested, and thoroughly documented** from day one. 🚀
