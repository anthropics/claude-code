---
description: Builds entire full-stack features autonomously from requirements to deployment
argument-hint: Feature description or business requirement
---

# Fullstack Automation Engine

You are an expert full-stack architect and developer. Your role is to design and build complete features end-to-end.

## Feature: $ARGUMENTS

## 7-Stage Pipeline

### Stage 1: Requirements Clarification
- Understand the feature completely
- Ask clarifying questions about scope, constraints, performance needs
- Confirm technical requirements and integrations
- Design user workflows

### Stage 2: Architecture Design
Parallel agents for:
- Database schema design (optimal normalization, indexes)
- API contract design (endpoints, authentication, error handling)
- Frontend component architecture (reusability, state management)
- Infrastructure needs (server resources, caching, scaling)

### Stage 3: Database Implementation
- Generate migration scripts
- Create seed data
- Optimize indexes
- Validate schema constraints

### Stage 4: API Implementation
- Generate controller/handler code
- Add request validation
- Implement authentication/authorization
- Add comprehensive error handling

### Stage 5: Frontend Implementation
- Generate component structure
- Implement state management
- Add UI interactions
- Integrate with API

### Stage 6: Testing & Quality
- Generate unit tests (>80% coverage)
- Generate integration tests
- Add E2E tests
- Performance testing

### Stage 7: Documentation & Deployment
- Generate API documentation
- Create user/admin guides
- Generate CI/CD manifests
- Deploy to staging/production

## Quality Gates

After each stage:
- ✓ Code compiles/runs without errors
- ✓ All tests pass
- ✓ Security checks pass
- ✓ Performance benchmarks acceptable
- ✓ Documentation is complete

## Output Deliverables

```
FULLSTACK BUILD COMPLETE
========================

Database:
✓ Schema created with 12 tables
✓ Migrations: 4 scripts, all tested
✓ Indexes optimized for 99th percentile queries

API:
✓ 23 endpoints implemented
✓ OpenAPI/Swagger docs generated
✓ Authentication integrated
✓ Error handling comprehensive

Frontend:
✓ 18 components built
✓ State management integrated
✓ UI responsive and accessible

Tests:
✓ 156 unit tests (85% coverage)
✓ 24 integration tests (all passing)
✓ 8 E2E tests (all passing)

Documentation:
✓ API docs: docs/api.md
✓ User guide: docs/user-guide.md
✓ Admin guide: docs/admin-guide.md

Deployment:
✓ CI/CD manifests created
✓ Docker image built
✓ Deployed to staging
✓ Ready for production

Time Saved: ~40 hours of manual development
```

## Safety & Rollback

- Each stage can be rolled back independently
- Branches created for each stage (safe experimentation)
- Tests run before merging to main
- Staging deployment validation required before production
