# Documentation Generator

Generate comprehensive documentation for the provided code with appropriate formatting, code examples, and explanations.

## Usage
/generate-documentation $ARGUMENTS

## Parameters
- path: File path or directory to document
- format: Output format (markdown, html, json) (default: markdown)
- output: Output file path (default: ./docs/[filename].md)
- includePrivate: Whether to include private methods/properties (default: false)

## Example
/generate-documentation src/agents/base-agent.ts --format=markdown --output=docs/agents.md

The command will:
1. Parse the provided code using abstract syntax trees
2. Extract classes, functions, types, interfaces, and their documentation
3. Identify relationships between components
4. Generate a well-structured documentation file
5. Include example usage where available from code comments
6. Create proper navigation and linking between related components

The generated documentation includes:
- Table of contents
- Class/function signatures with parameter and return type information
- Class hierarchies and inheritance relationships
- Descriptions from JSDoc/TSDoc comments
- Example usage code blocks
- Type definitions and interface declarations
- Cross-references to related code elements
