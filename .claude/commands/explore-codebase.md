---
description: Deep codebase exploration and architecture mapping
argument-hint: "[path or scope to explore]"
---

You are performing **comprehensive codebase exploration** to deeply understand the system architecture, dependencies, and critical paths.

## Exploration Scope

Target: $ARGUMENTS

If no specific path provided, explore the entire codebase systematically.

## Exploration Process

### Phase 1: Launch Code Explorer Agent

**Task for code-explorer:**

Perform comprehensive exploration of: $ARGUMENTS

**Your mission:**

1. **Reconnaissance** (30,000 foot view)
   - Read README and understand the project purpose
   - Identify the technology stack
   - Find entry points (main.*, index.*, app.*, server.*)
   - Map directory structure

2. **Structural Analysis** (10,000 foot view)
   - Map module boundaries and dependencies
   - Identify architectural layers (presentation, business, data)
   - Recognize architectural patterns (MVC, layered, microservices, etc.)
   - Find core abstractions (interfaces, base classes, key types)

3. **Critical Path Mapping** (Ground level)
   - Trace at least 3 critical user journeys/workflows
   - Map data flow from entry to persistence
   - Identify external dependencies (APIs, databases, services)
   - Document error handling paths

4. **Dependency Analysis**
   - Build import/dependency graph
   - Identify circular dependencies
   - Find tightly coupled modules
   - Assess module cohesion

5. **Pattern Recognition**
   - Identify design patterns in use
   - Find architectural patterns
   - Spot anti-patterns and code smells
   - Recognize consistency (or lack thereof)

6. **Technical Debt Assessment**
   - Find complexity hotspots (high cyclomatic complexity)
   - Identify god classes/functions
   - Spot maintenance red flags
   - Assess documentation coverage

**Deliverables Required:**

Provide a comprehensive exploration report including:

```markdown
## Codebase Exploration Report

### Executive Summary
- Project type and domain
- Tech stack
- Architecture pattern
- Overall health score (0-100)

### Architecture Overview
[High-level ASCII diagram of components]

### Key Components
List major modules/components with:
- Purpose
- Location
- Dependencies
- Entry points

### Critical Paths Mapped
For each critical path:
- User journey/workflow
- Code execution flow
- Data transformations
- External dependencies
- Error handling

### Dependency Graph
[Visual representation of module dependencies]
- Circular dependencies (if any)
- High coupling areas
- Module isolation score

### Patterns Identified
- Architectural patterns
- Design patterns
- Coding conventions
- Consistency assessment

### Technical Debt Hotspots
Prioritized list of issues:
1. **Critical** - [Issues blocking progress]
2. **High** - [Major friction points]
3. **Medium** - [Minor improvements]

### Code Organization Assessment
- Directory structure evaluation
- Naming conventions
- File sizes and complexity
- Test coverage

### Entry Points
- Main application entry
- API endpoints
- Background jobs/workers
- CLI commands

### Recommendations
1. **Quick Wins** - Easy improvements with high impact
2. **Refactoring Candidates** - Areas needing restructure
3. **Documentation Needs** - Missing or unclear docs
4. **Architecture Improvements** - Strategic enhancements
```

### Phase 2: Create Visual Maps (Optional)

If the codebase is complex, create visual representations:

**Architecture Diagram:**
```
┌─────────────────────────────────────────┐
│           Frontend (React)              │
└───────────────┬─────────────────────────┘
                │ HTTP/REST
                ↓
┌─────────────────────────────────────────┐
│         API Gateway (Express)           │
└───┬───────────────────────────────┬─────┘
    │                               │
    ↓                               ↓
┌─────────────┐            ┌──────────────┐
│  Auth       │            │  Business    │
│  Service    │            │  Services    │
└──────┬──────┘            └──────┬───────┘
       │                          │
       ↓                          ↓
┌─────────────────────────────────────────┐
│         Data Layer (Repositories)        │
└───────────────┬─────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│         Database (PostgreSQL)            │
└─────────────────────────────────────────┘
```

**Data Flow Diagram:**
```
User Request
    ↓
Validation
    ↓
Authentication
    ↓
Business Logic
    ↓
Database Query
    ↓
Response Transform
    ↓
Client Response
```

### Phase 3: Interactive Discovery (Optional)

Based on the exploration, you may want to:

**Dig deeper into specific areas:**
```
"Explore the authentication flow in detail"
"Map all API endpoints"
"Analyze the database layer"
```

**Find specific patterns:**
```
"Find all uses of the Factory pattern"
"Locate all database transactions"
"Find error handling patterns"
```

**Understand specific features:**
```
"How does user registration work?"
"Trace the payment processing flow"
"Where is caching implemented?"
```

## Use Cases

### 1. Onboarding New Developers
**Goal:** Help new developers understand the codebase quickly
**Focus:** Architecture overview, entry points, critical paths
**Output:** Onboarding documentation with visual maps

### 2. Planning Refactoring
**Goal:** Identify areas that need improvement
**Focus:** Technical debt, code smells, coupling analysis
**Output:** Prioritized refactoring backlog

### 3. Security Audit Preparation
**Goal:** Understand security-critical paths
**Focus:** Authentication, authorization, data flow, external APIs
**Output:** Security-critical component map

### 4. Performance Optimization
**Goal:** Find performance bottlenecks
**Focus:** Data flow, database queries, critical paths
**Output:** Performance analysis with hotspot identification

### 5. Dependency Management
**Goal:** Understand module coupling
**Focus:** Dependency graph, circular dependencies, boundaries
**Output:** Decoupling strategy

### 6. Legacy Code Understanding
**Goal:** Make sense of undocumented code
**Focus:** Pattern recognition, git history, test analysis
**Output:** Architectural documentation

## Exploration Strategies by Codebase Size

### Small Codebase (< 10k LOC)
- **Approach:** Comprehensive exploration
- **Time:** 30-60 minutes
- **Coverage:** 100% of code

### Medium Codebase (10k-100k LOC)
- **Approach:** Focus on critical paths + sampling
- **Time:** 2-4 hours
- **Coverage:** Critical paths + 20% sampling

### Large Codebase (> 100k LOC)
- **Approach:** Architecture-first, then targeted deep-dives
- **Time:** 1-2 days
- **Coverage:** Architecture + critical modules

### Massive Codebase (> 1M LOC)
- **Approach:** Incremental, domain-focused exploration
- **Time:** Ongoing
- **Coverage:** One domain at a time

## After Exploration

### Create Artifacts:
1. **Architecture documentation** - Visual diagrams and descriptions
2. **Developer onboarding guide** - How to navigate the codebase
3. **Technical debt backlog** - Prioritized improvements
4. **Dependency map** - Module relationships
5. **Critical path documentation** - How key features work

### Next Steps:
- Share findings with the team
- Update documentation based on discoveries
- Create tickets for technical debt
- Plan refactoring initiatives
- Improve code organization where needed

## Tips for Effective Exploration

1. **Start high-level, then drill down** - Don't get lost in details
2. **Follow the data** - Data flow reveals true structure
3. **Look at tests** - Tests show intended behavior
4. **Check git history** - Understand evolution and why
5. **Draw as you go** - Visual maps help understanding
6. **Ask questions** - What, why, how, when, who
7. **Document insights** - Memory fades, write it down

---

**Remember:** The goal is not to read every line of code - it's to build a mental model of the system that enables effective development.

🗺️ **Good exploration is an investment that pays dividends in faster development, better decisions, and fewer surprises.**
