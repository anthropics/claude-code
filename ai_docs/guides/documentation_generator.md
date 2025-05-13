# Documentation Generator Guide

The Documentation Generator is a powerful tool that leverages the Sequential Planner to create comprehensive documentation for code files and directories. It integrates multiple MCP tools (Sequential Thinking, Context7, and 21st-dev-magic) to analyze code and generate well-structured documentation.

## Overview

The Documentation Generator allows you to:

1. Generate comprehensive documentation for code files and directories
2. Output documentation in various formats (Markdown, HTML, JSON)
3. Include or exclude private methods and properties
4. Customize output paths and formats
5. Track the documentation generation process step-by-step

## Components

### 1. Sequential Documentation Generator

The core functionality is implemented in `tools/documentation/sequential_doc_generator.js`. This module uses the Sequential Planner to:

- Parse code files using abstract syntax trees (AST)
- Extract classes, functions, types, interfaces, and their documentation
- Identify relationships between components
- Generate well-structured documentation files
- Include example usage where available from code comments
- Create proper navigation and linking between related components

### 2. Command-Line Interface

The command-line interface is implemented in `cli/commands/generate-documentation.js`. You can use it as follows:

```bash
# Basic usage
node cli/commands/generate-documentation.js src/components/MyComponent.jsx

# Specify output format
node cli/commands/generate-documentation.js src/components/MyComponent.jsx --format=html

# Specify output path
node cli/commands/generate-documentation.js src/components/MyComponent.jsx --output=docs/my-component.md

# Include private methods and properties
node cli/commands/generate-documentation.js src/components/MyComponent.jsx --includePrivate
```

### 3. React Component

The `McpDocumentationGenerator` component provides a UI for generating documentation:

- Input fields for code path, output format, and output path
- Option to include private methods and properties
- Visualization of the documentation generation plan
- Step-by-step execution of the plan
- Display of the generation result and summary

## Usage

### Command-Line Interface

```bash
# Generate Markdown documentation for a file
node cli/commands/generate-documentation.js src/components/MyComponent.jsx

# Generate HTML documentation for a directory
node cli/commands/generate-documentation.js src/components --format=html

# Generate JSON documentation with a custom output path
node cli/commands/generate-documentation.js src/utils --format=json --output=docs/api/utils.json

# Include private methods and properties
node cli/commands/generate-documentation.js src/services --includePrivate
```

### React Component

The `McpDocumentationGenerator` component is available in the MCP Dashboard under the "Doc Generator" tab. To use it:

1. Enter the code path (file or directory)
2. Select the output format (Markdown, HTML, JSON)
3. Optionally specify an output path
4. Choose whether to include private methods and properties
5. Click "Generate Documentation"
6. Execute each step of the documentation generation plan
7. View the generation result and summary

## Implementation Details

### Documentation Generation Process

The documentation generation process follows these steps:

1. **Analyze Code**: Parse the code files to extract structure and documentation comments
2. **Identify Components**: Extract classes, functions, types, interfaces, and their relationships
3. **Generate Documentation**: Create a well-structured documentation file in the specified format
4. **Add Navigation**: Create a table of contents and cross-references
5. **Save Output**: Write the documentation to the specified output path

### Integration with MCP Tools

The Documentation Generator integrates with multiple MCP tools:

- **Sequential Thinking**: Used to plan and execute the documentation generation process
- **Context7**: Used to gather additional context and information about the code
- **21st-dev-magic**: Used to generate UI components for documentation previews

### Output Formats

The Documentation Generator supports the following output formats:

- **Markdown**: A plain text format with simple formatting, ideal for GitHub and other Markdown-based platforms
- **HTML**: A web-based format with full styling and navigation capabilities
- **JSON**: A structured format ideal for programmatic access and custom rendering

## API Reference

### `generateDocumentation(options)`

Generates documentation for a file or directory.

**Parameters:**

- `options` (Object): Documentation options
  - `path` (string): File or directory path
  - `format` (string): Output format (markdown, html, json)
  - `output` (string): Output file path
  - `includePrivate` (boolean): Whether to include private methods/properties

**Returns:**

A Promise that resolves to an object with the following properties:

- `success` (boolean): Whether the generation was successful
- `output` (string): The path to the output file
- `summary` (string): A summary of the documentation generation process
- `executedSteps` (Array): The executed steps of the documentation generation plan

**Example:**

```javascript
const docGenerator = require('./tools/documentation/sequential_doc_generator');

const result = await docGenerator.generateDocumentation({
  path: 'src/components/MyComponent.jsx',
  format: 'markdown',
  output: 'docs/my-component.md',
  includePrivate: false
});

if (result.success) {
  console.log(`Documentation generated successfully: ${result.output}`);
} else {
  console.error(`Error generating documentation: ${result.error}`);
}
```

## Best Practices

1. **Organize Documentation**: Group related documentation files together in a logical structure
2. **Use JSDoc/TSDoc Comments**: Add detailed comments to your code to improve the generated documentation
3. **Include Examples**: Add example usage in your code comments to include in the documentation
4. **Review Generated Documentation**: Always review and edit the generated documentation to ensure accuracy and completeness
5. **Version Documentation**: Keep documentation up-to-date with code changes by regenerating it when needed

## Troubleshooting

### Common Issues

- **Missing Documentation**: Make sure your code includes JSDoc/TSDoc comments
- **Incorrect Output Format**: Check that the specified format is one of: markdown, html, json
- **File Not Found**: Verify that the specified path exists and is accessible
- **Permission Error**: Check that you have permission to write to the output path
- **Large Files**: For very large files, the documentation generator may take a long time to run

## Extensions and Customization

The Documentation Generator can be extended and customized in several ways:

1. **Custom Templates**: Create custom templates for different documentation formats
2. **Additional Output Formats**: Add support for additional output formats like PDF or AsciiDoc
3. **Integration with Documentation Systems**: Integrate with systems like Docusaurus or VuePress
4. **Custom Parsing Rules**: Add custom rules for parsing specific code patterns or frameworks
5. **Advanced Visualization**: Add support for generating diagrams and visualizations