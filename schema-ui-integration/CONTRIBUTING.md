# Contributing to Claude Schema UI

Thank you for your interest in contributing to Claude Schema UI! This document provides guidelines and instructions for contributing to this project.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Install dependencies with `npm install`
4. Create a new branch for your feature or bugfix

## Development Workflow

1. Implement your changes
2. Write or update tests as necessary
3. Run tests with `npm test`
4. Ensure code passes linting with `npm run lint`
5. Submit a pull request

## Component Guidelines

When adding or modifying components, please follow these guidelines:

1. **Framework Agnostic**: Components should work both with and without the Claude Neural Framework.
2. **Adapter Pattern**: Use the adapter pattern to abstract framework-specific functionality.
3. **Documented Props**: Include JSDoc comments for all component props.
4. **Accessibility**: Ensure components are accessible (ARIA attributes, keyboard navigation, etc.).
5. **Unit Tests**: Include unit tests for all new components.

## Schema Handling

When working with JSON Schema:

1. **Draft-07**: Ensure compatibility with JSON Schema Draft-07.
2. **Validation**: Properly handle schema validation and errors.
3. **Schema Extensions**: Document any custom schema extensions.

## Commit Message Format

Use conventional commit format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code changes that neither fix bugs nor add features
- `test`: Adding or updating tests
- `chore`: Changes to the build process or auxiliary tools

## Pull Request Process

1. Update the README.md with any necessary changes
2. Update documentation as needed
3. Ensure tests pass and code lints cleanly
4. Obtain review from at least one maintainer

## License

By contributing to this project, you agree that your contributions will be licensed under the project's MIT license.