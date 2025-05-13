# Integration Guide for Claude Environments

This guide explains how to integrate Claude Schema UI with different Claude environments:
- Claude Desktop
- Claude Max
- Claude Code
- Custom environments

## Claude Desktop Integration

Claude Desktop offers a native integration option:

```bash
# Install the package
npm install claude-schema-ui

# In Claude Desktop, use the Plugin Manager to add the package
cd ~/.claude/plugins
claude plugin add claude-schema-ui
```

After installation, you can import components directly in your plugins:

```jsx
import { SchemaForm, ColorSchemaForm } from 'claude-schema-ui';
```

## Claude Max Integration

In Claude Max, use the Project Settings to integrate:

1. Go to Project Settings > Integrations
2. Add a new integration with the NPM package name `claude-schema-ui`
3. In your project, import the components:

```jsx
import { SchemaForm, AboutProfileForm } from 'claude-schema-ui';
```

## Claude Code Integration

Claude Code supports both direct installation and git-based integration:

### Option 1: NPM Installation

```bash
# From your project directory
npm install claude-schema-ui
```

### Option 2: Git Integration

```bash
# Add as a git submodule
git submodule add https://github.com/claude-framework/schema-ui.git libs/claude-schema-ui

# In your package.json, add the local dependency
"dependencies": {
  "claude-schema-ui": "file:libs/claude-schema-ui"
}
```

## Integration with Framework Components

When using the Claude Neural Framework, configure the adapter to use framework services:

```jsx
import { SchemaForm, createFrameworkAdapter } from 'claude-schema-ui';
import { mcpClient } from './core/mcp/claude_mcp_client';
import { logger } from './core/logging/logger';
import { configManager } from './core/config/config_manager';
import { i18n } from './core/i18n/i18n';
import { errorHandler } from './core/error/error_handler';

// Create adapter for the framework
const adapter = createFrameworkAdapter({
  mcp: mcpClient,
  logger,
  config: configManager,
  i18n,
  errorHandler
});

// Use adapter with components
function MyComponent() {
  return (
    <SchemaForm 
      adapter={adapter}
      schema={mySchema}
      onSubmit={handleSubmit}
    />
  );
}
```

## Standalone Usage

For environments without framework integration, use the standalone adapter:

```jsx
import { SchemaForm, standaloneAdapter } from 'claude-schema-ui';

function MyComponent() {
  return (
    <SchemaForm 
      adapter={standaloneAdapter}
      schema={mySchema}
      onSubmit={handleSubmit}
    />
  );
}
```

## Context7 Integration

To directly integrate with Context7:

```jsx
import { AboutProfileForm, createFrameworkAdapter } from 'claude-schema-ui';

// Create a minimal adapter with just Context7 support
const context7Adapter = createFrameworkAdapter({
  mcp: {
    invoke: async (service, method, params) => {
      // Implement your Context7 API calls here
      if (service === 'context7') {
        // Call Context7 API
        const response = await fetch(`/api/context7/${method}`, {
          method: 'POST',
          body: JSON.stringify(params)
        });
        return response.json();
      }
      return null;
    }
  }
});

function ProfileEditor() {
  return (
    <AboutProfileForm
      adapter={context7Adapter}
      onSave={handleSaveProfile}
    />
  );
}
```

## File-based Schema Loading

Load schemas from local files:

```jsx
import { SchemaForm } from 'claude-schema-ui';
import aboutSchema from './schemas/about-schema.json';

function ProfileForm() {
  return (
    <SchemaForm
      schema={aboutSchema}
      onSubmit={handleSubmit}
    />
  );
}
```

## Creating a New Git Branch

To add the integration to your existing repository:

```bash
# Create a new branch
git checkout -b feature/add-schema-ui

# Clone the schema-ui repo into a subdirectory
git clone https://github.com/claude-framework/schema-ui.git libs/claude-schema-ui

# Add the files to your repo
git add libs/claude-schema-ui

# Commit the changes
git commit -m "Add Claude Schema UI integration"

# Push the branch
git push -u origin feature/add-schema-ui
```

## Creating a New Repository

To set up a new project:

```bash
# Clone the schema-ui repo
git clone https://github.com/claude-framework/schema-ui.git my-claude-schema-project

# Initialize a new repository
cd my-claude-schema-project
rm -rf .git
git init
git add .
git commit -m "Initial commit with Claude Schema UI"

# Add your remote
git remote add origin https://github.com/yourusername/my-claude-schema-project.git
git push -u origin main
```