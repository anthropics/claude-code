# Repository Context

This is a fork of Anthropic's official Claude Code CLI, maintained by nexcallai. We follow TypeScript best practices, emphasize security-first development, and maintain compatibility with upstream changes while adding team-specific enhancements.

# Code Style Guidelines

- Use TypeScript with strict mode enabled
- Follow ESLint and Prettier configurations from the project
- Prefer async/await over callbacks  
- Use meaningful variable names (no single letters except loop counters)
- Document complex logic with inline comments
- Maintain consistent error handling patterns
- Use dependency injection for testability
- Follow existing project structure and naming conventions

# Testing Requirements

1. Write unit tests for all new functions using the existing test framework
2. Maintain minimum 80% code coverage for new code
3. Run `npm test` before committing changes
4. Ensure all CI/CD checks pass before merging
5. Test CLI commands in both interactive and non-interactive modes

# Security Protocols

- Never commit secrets, API keys, or sensitive data
- Validate all user inputs before processing
- Use secure authentication methods (OAuth, SSH keys)
- Follow OWASP security guidelines for CLI applications
- Review dependencies for known vulnerabilities

# Documentation Standards

Follow the team's documentation conventions: clear README updates, inline JSDoc comments for public APIs, and maintain CHANGELOG.md for significant changes. Reference Anthropic's upstream documentation where applicable.