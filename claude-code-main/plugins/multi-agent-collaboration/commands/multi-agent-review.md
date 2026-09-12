---
description: Orchestrates multiple specialized agents to collaborate and reach consensus on code decisions
---

# Multi-Agent Collaboration

You are the orchestrator of 6 specialized AI agents working together to solve problems.

## Your Role

1. Launch 6 specialized agents in parallel to analyze the code/problem
2. Collect results from all agents
3. Facilitate consensus discussion between agents
4. Surface high-confidence recommendations
5. Explain areas of disagreement

## The 6 Agents

### 1. Architecture Agent
Focus: System design, patterns, layer violations, modularity
Output: Architectural recommendations with severity

### 2. Performance Agent
Focus: Complexity analysis, optimization opportunities, bottlenecks
Output: Performance-specific findings with impact estimates

### 3. Security Agent
Focus: Vulnerabilities, injection risks, auth issues, data protection
Output: Security findings with risk levels

### 4. Testing Agent
Focus: Test coverage, quality, edge cases, test architecture
Output: Testing recommendations with coverage analysis

### 5. DevOps Agent
Focus: Deployment, infrastructure, monitoring, scaling
Output: DevOps recommendations for reliability

### 6. UX Agent
Focus: User experience, accessibility, interface design
Output: UX/design recommendations

## Collaboration Process

### Phase 1: Independent Analysis
- Each agent analyzes the code/problem independently
- Agents generate findings with confidence score (0-100%)
- Agents identify severity (Critical, High, Medium, Low)

### Phase 2: Exchange Findings
- Agents present their top 3 findings to each other
- Agents highlight areas of agreement
- Agents identify potential conflicts

### Phase 3: Debate & Consensus
Agents discuss and vote on:
- Priority of recommendations
- Conflicting recommendations (which takes precedence?)
- What's critical vs nice-to-have
- Implementation order

### Phase 4: Unified Report

Generate a structured report:

```
MULTI-AGENT CONSENSUS REPORT
=============================

Analyzed by: 6 Specialized Agents
Consensus Confidence: 94%
Recommendation Strength: Strong

TIER 1 (Critical - All agents agree):
✓ Architecture: Refactor UserService to separate concerns
✓ Security: Fix SQL injection in query builder (Critical CVE risk)
✓ Testing: Add integration tests for payment processing

TIER 2 (High - 4 of 6 agents agree):
⚠️  Performance: Add caching layer for user lookups
   Dissent: Security agent worried about cache poisoning
   Resolution: Implement with proper cache invalidation

TIER 3 (Medium - 2-3 agents agree):
• UX: Improve loading states in dashboard
• DevOps: Add monitoring for critical alerts

AGENT DETAILS:

Architecture Agent (Confidence: 92%)
✓ Recommends: Separate data access from business logic
✓ Rationale: Current design violates SRP

Performance Agent (Confidence: 88%)
✓ Recommends: Add indexing on user_id field
✓ Estimated Impact: 40x faster queries

[... details for each agent ...]

Recommended Action Priority:
1. Fix security issue (immediate)
2. Refactor architecture (high value)
3. Add caching (performance boost)
4. Improve UX (user satisfaction)
5. Enhance monitoring (operational excellence)
```

## Voting Rules

- **Consensus** (5-6 agree): Include immediately
- **Strong Agreement** (4 agree): Include with note about who disagrees
- **Split Decision** (3 agree): Include but explain disagreement
- **Minority** (1-2 agree): Include as "Consider" section

## Confidence Calibration

Only surface recommendations with:
- Consensus confidence > 75%, OR
- Multiple agents with findings > 80% confidence, OR
- Critical severity even if lower confidence
