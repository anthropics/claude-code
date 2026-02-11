---
name: generate-map
description: Analyze codebase and generate a comprehensive project-map.md overview
argument-hint: "[--force]"
---

# Generate Project Map Command

You are generating a comprehensive `.claude/project-map.md` file for this codebase.

## Your Task

Analyze the entire codebase and create a clear, concise project map that a new developer can read in a few minutes to understand the system.

## Workflow

1. **Scan the codebase structure**
   - List all top-level directories
   - Identify the main technology stack
   - Find configuration files (package.json, pyproject.toml, docker-compose.yml, etc.)

2. **Identify the tech stack**
   - Backend framework and language
   - Frontend framework (if any)
   - Database(s)
   - Infrastructure (Docker, K8s, cloud services)
   - Key libraries and dependencies

3. **Map the project structure**
   - Main folders and their responsibilities
   - Entry points and important files
   - Configuration locations

4. **Document the API surface** (if applicable)
   - Main endpoints grouped by domain
   - Authentication method
   - Link to OpenAPI/Swagger if available

5. **Document the database** (if applicable)
   - Main entities and relationships
   - Migration tool and location

6. **Document the frontend** (if applicable)
   - Main pages/routes
   - Component organization
   - State management approach

7. **Document infrastructure**
   - How to run the project locally
   - Docker services and ports
   - Environment variables needed

8. **Document testing**
   - Test frameworks in use
   - How to run tests

## Output Format

Create/overwrite `.claude/project-map.md` with this structure:

```markdown
# Project Map

> Auto-generated overview of the codebase. Last updated: [date]

## Tech Stack

- **Backend:** [framework, language, version]
- **Frontend:** [framework, language, version]
- **Database:** [type, version]
- **Infrastructure:** [Docker, etc.]
- **Key Libraries:** [list]

## Project Structure

```
/
├── backend/          # [description]
├── frontend/         # [description]
├── ...
```

## API Surface

### [Domain 1]
- `GET /api/...` - [description]
- `POST /api/...` - [description]

### [Domain 2]
...

## Database Schema

Main entities:
- **Entity1** - [description, key fields]
- **Entity2** - [description, key fields]

Relationships: [brief description]

## Frontend Architecture

Main routes:
- `/` - [description]
- `/dashboard` - [description]

Key components: [list]

## Infrastructure

### Local Development
```bash
# Commands to run the project
```

### Docker Services
| Service | Port | Description |
|---------|------|-------------|
| ...     | ...  | ...         |

### Environment Variables
| Variable | Purpose | Required |
|----------|---------|----------|
| ...      | ...     | ...      |

## Testing

- **Framework:** [pytest/jest/etc.]
- **Run tests:** `[command]`

## Development Workflow

1. [Setup step]
2. [Run step]
3. [Test step]

## Current Features

- [Feature 1]
- [Feature 2]

## Known Limitations

- [Limitation 1]
- [Limitation 2]
```

## Guidelines

- Keep it concise - aim for a document readable in 5 minutes
- Use bullet points and tables
- Link to detailed docs rather than copying content
- Remove any sections that don't apply
- Be accurate - verify information from actual files

## After Generation

Report to the user:
- Summary of what was documented
- Any areas that need manual review
- Suggestions for missing documentation
