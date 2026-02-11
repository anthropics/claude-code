---
name: api-contract
description: This skill should be used when the user asks about "API contract", "api-contract.md", "shared interface", "TypeScript interfaces", "request response schemas", "endpoint design", or needs guidance on designing contracts that coordinate backend and frontend agents.
version: 1.0.0
author: Damien Laine <damien.laine@gmail.com>
license: MIT
allowed-tools:
  - Read
---

# API Contract Design

The API contract (`api-contract.md`) is the shared interface between implementation agents. It defines what the backend provides and what the frontend consumes, ensuring both sides build compatible systems without direct communication.

## Purpose

The contract serves as:
- **Single source of truth** for API shape
- **Coordination mechanism** between backend and frontend agents
- **Validation reference** for QA testing
- **Documentation** for the implemented API

## Contract Structure

A complete api-contract.md contains:

```markdown
# API Contract: [Feature Name]

## Base URL
[API base path, e.g., /api/v1]

## Authentication
[Auth requirements for endpoints]

## Endpoints

### [Endpoint Group]

#### [METHOD] [Route]
[Description]

**Request:**
[Request schema]

**Response:**
[Response schema]

**Errors:**
[Error codes and meanings]

## TypeScript Interfaces
[Shared type definitions]

## Validation Rules
[Input validation requirements]
```

## Writing Endpoints

### Endpoint Definition

```markdown
#### POST /auth/register

Create a new user account.

**Request:**
```json
{
  "email": "string (required, valid email)",
  "password": "string (required, min 8 chars)",
  "name": "string (optional)"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "email": "string",
  "name": "string | null",
  "createdAt": "ISO 8601 datetime"
}
```

**Errors:**
- 400: Invalid request body
- 409: Email already exists
- 422: Validation failed
```

### Key Elements

| Element | Purpose |
|---------|---------|
| Method + Route | HTTP verb and path |
| Description | What the endpoint does |
| Request | Input schema with types and constraints |
| Response | Output schema with status code |
| Errors | Possible error responses |

## TypeScript Interfaces

Define shared types for type safety across agents:

```markdown
## TypeScript Interfaces

```typescript
// User types
interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

interface CreateUserRequest {
  email: string;
  password: string;
  name?: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface AuthResponse {
  user: User;
  token: string;
  expiresAt: string;
}

// Error response
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}
```
```

### Type Guidelines

- Use explicit types, not `any`
- Mark optional fields with `?`
- Use union types for nullable: `string | null`
- Include all possible response shapes
- Match types to JSON serialization

## Validation Rules

Document validation requirements explicitly:

```markdown
## Validation Rules

### User Registration
| Field | Rules |
|-------|-------|
| email | Required, valid email format, unique |
| password | Required, min 8 chars, 1 uppercase, 1 number |
| name | Optional, max 100 chars |

### Product Creation
| Field | Rules |
|-------|-------|
| title | Required, 3-200 chars |
| price | Required, positive number, max 2 decimals |
| category | Required, must exist in categories table |
```

### Why Document Validation

- Backend implements the rules
- Frontend can pre-validate before submit
- QA tests edge cases
- All agents have same understanding

## Error Handling

### Standard Error Format

```markdown
## Error Response Format

All errors return:
```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable message",
  "details": {
    "field": ["error1", "error2"]
  }
}
```

### Error Codes
| Code | HTTP Status | Meaning |
|------|-------------|---------|
| VALIDATION_ERROR | 422 | Input validation failed |
| NOT_FOUND | 404 | Resource doesn't exist |
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Permission denied |
| CONFLICT | 409 | Resource conflict |
```

### Error Consistency

Use consistent error codes across all endpoints. This helps:
- Frontend implement unified error handling
- QA test all error scenarios
- Users get predictable feedback

## Pagination

For list endpoints:

```markdown
#### GET /products

List products with pagination.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | integer | 1 | Page number |
| limit | integer | 20 | Items per page (max 100) |
| sort | string | createdAt | Sort field |
| order | string | desc | Sort order (asc/desc) |

**Response (200):**
```json
{
  "data": [Product],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```
```

### Pagination Interface

```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

## Contract Evolution

### During Sprint

1. **Initial**: Architect creates contract based on specs
2. **Implementation**: Agents follow contract exactly
3. **Deviations**: If agent must deviate, document in report
4. **Update**: Architect updates contract if deviation justified
5. **Final**: Contract reflects implemented reality

### Contract Changes

When changing an existing contract:
- Note breaking changes
- Consider versioning for major changes
- Update both request and response if affected
- Notify dependent agents via specs

## Best Practices

### Be Specific

```markdown
// Good
"email": "string (required, valid email format)"

// Bad
"email": "string"
```

### Include Examples

```markdown
**Request Example:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```
```

### Document All States

Include responses for:
- Success (200, 201, 204)
- Client errors (400, 401, 403, 404, 422)
- Empty states (empty arrays, null values)

### Keep It DRY

Reference shared types instead of duplicating:

```markdown
**Response:** `User` (see TypeScript Interfaces)
```

### No Implementation Details

The contract defines WHAT, not HOW:
- Don't mention database columns
- Don't specify frameworks
- Don't include file paths

## Common Patterns

### CRUD Endpoints

```markdown
### Products

| Method | Route | Description |
|--------|-------|-------------|
| GET | /products | List all products |
| GET | /products/:id | Get single product |
| POST | /products | Create product |
| PUT | /products/:id | Update product |
| DELETE | /products/:id | Delete product |
```

### Authentication Endpoints

```markdown
### Authentication

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /auth/register | No | Create account |
| POST | /auth/login | No | Get token |
| POST | /auth/logout | Yes | Invalidate token |
| GET | /auth/me | Yes | Current user |
| POST | /auth/refresh | Yes | Refresh token |
```

## Additional Resources

For complete examples, examine the `api-contract.md` files generated in sprint directories after running `/sprint`.
