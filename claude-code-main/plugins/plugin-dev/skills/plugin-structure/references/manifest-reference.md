# Plugin Manifest Reference

Complete reference for `plugin.json` configuration.

## File Location

**Required path**: `.claude-plugin/plugin.json`

The manifest MUST be in the `.claude-plugin/` directory at the plugin root. Claude Code will not recognize plugins without this file in the correct location.

## Complete Field Reference

### Core Fields

#### name (required)

**Type**: String
**Format**: kebab-case
**Example**: `"test-automation-suite"`

The unique identifier for the plugin. Used for:
- Plugin identification in Claude Code
- Conflict detection with other plugins
- Command namespacing (optional)

**Requirements**:
- Must be unique across all installed plugins
- Use only lowercase letters, numbers, and hyphens
- No spaces or special characters
- Start with a letter
- End with a letter or number

**Validation**:
```javascript
/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
```

**Examples**:
- ✅ Good: `api-tester`, `code-review`, `git-workflow-automation`
- ❌ Bad: `API Tester`, `code_review`, `-git-workflow`, `test-`

#### version

**Type**: String
**Format**: Semantic versioning (MAJOR.MINOR.PATCH)
**Example**: `"2.1.0"`
**Default**: `"0.1.0"` if not specified

Semantic versioning guidelines:
- **MAJOR**: Incompatible API changes, breaking changes
- **MINOR**: New functionality, backward-compatible
- **PATCH**: Bug fixes, backward-compatible

**Pre-release versions**:
- `"1.0.0-alpha.1"` - Alpha release
- `"1.0.0-beta.2"` - Beta release
- `"1.0.0-rc.1"` - Release candidate

**Examples**:
- `"0.1.0"` - Initial development
- `"1.0.0"` - First stable release
- `"1.2.3"` - Patch update to 1.2
- `"2.0.0"` - Major version with breaking changes

#### description

**Type**: String
**Length**: 50-200 characters recommended
**Example**: `"Automates code review workflows with style checks and automated feedback"`

Brief explanation of plugin purpose and functionality.

**Best practices**:
- Focus on what the plugin does, not how
- Use active voice
- Mention key features or benefits
- Keep under 200 characters for marketplace display

**Examples**:
- ✅ "Generates comprehensive test suites from code analysis and coverage reports"
- ✅ "Integrates with Jira for automatic issue tracking and sprint management"
- ❌ "A plugin that helps you do testing stuff"
- ❌ "This is a very long description that goes on and on about every single feature..."

### Metadata Fields

#### author

**Type**: Object
**Fields**: name (required), email (optional), url (optional)

```json
{
  "author": {
    "name": "Jane Developer",
    "email": "jane@example.com",
    "url": "https://janedeveloper.com"
  }
}
```

**Alternative format** (string only):
```json
{
  "author": "Jane Developer <jane@example.com> (https://janedeveloper.com)"
}
```

**Use cases**:
- Credit and attribution
- Contact for support or questions
- Marketplace display
- Community recognition

#### homepage

**Type**: String (URL)
**Example**: `"https://docs.example.com/plugins/my-plugin"`

Link to plugin documentation or landing page.

**Should point to**:
- Plugin documentation site
- Project homepage
- Detailed usage guide
- Installation instructions

**Not for**:
- Source code (use `repository` field)
- Issue tracker (include in documentation)
- Personal websites (use `author.url`)

#### repository

**Type**: String (URL) or Object
**Example**: `"https://github.com/user/plugin-name"`

Source code repository location.

**String format**:
```json
{
  "repository": "https://github.com/user/plugin-name"
}
```

**Object format** (detailed):
```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/user/plugin-name.git",
    "directory": "packages/plugin-name"
  }
}
```

**Use cases**:
- Source code access
- Issue reporting
- Community contributions
- Transparency and trust

#### license

**Type**: String
**Format**: SPDX identifier
**Example**: `"MIT"`

Software license identifier.

**Common licenses**:
- `"MIT"` - Permissive, popular choice
- `"Apache-2.0"` - Permissive with patent grant
- `"GPL-3.0"` - Copyleft
- `"BSD-3-Clause"` - Permissive
- `"ISC"` - Permissive, similar to MIT
- `"UNLICENSED"` - Proprietary, not open source

**Full list**: https://spdx.org/licenses/

**Multiple licenses**:
```json
{
  "license": "(MIT OR Apache-2.0)"
}
```

#### keywords

**Type**: Array of strings
**Example**: `["testing", "automation", "ci-cd", "quality-assurance"]`

Tags for plugin discovery and categorization.

**Best practices**:
- Use 5-10 keywords
- Include functionality categories
- Add technology names
- Use common search terms
- Avoid duplicating plugin name

**Categories to consider**:
- Functionality: `testing`, `debugging`, `documentation`, `deployment`
- Technologies: `typescript`, `python`, `docker`, `aws`
- Workflows: `ci-cd`, `code-review`, `git-workflow`
- Domains: `web-development`, `data-science`, `devops`

### Component Path Fields

#### commands

**Type**: String or Array of strings
**Default**: `["./commands"]`
**Example**: `"./cli-commands"`

Additional directories or files containing command definitions.

**Single path**:
```json
{
  "commands": "./custom-commands"
}
```

**Multiple paths**:
```json
{
  "commands": [
    "./commands",
    "./admin-commands",
    "./experimental-commands"
  ]
}
```

**Behavior**: Supplements default `commands/` directory (does not replace)

**Use cases**:
- Organizing commands by category
- Separating stable from experimental commands
- Loading commands from shared locations

#### agents

**Type**: String or Array of strings
**Default**: `["./agents"]`
**Example**: `"./specialized-agents"`

Additional directories or files containing agent definitions.

**Format**: Same as `commands` field

**Use cases**:
- Grouping agents by specialization
- Separating general-purpose from task-specific agents
- Loading agents from plugin dependencies

#### hooks

**Type**: String (path to JSON file) or Object (inline configuration)
**Default**: `"./hooks/hooks.json"`

Hook configuration location or inline definition.

**File path**:
```json
{
  "hooks": "./config/hooks.json"
}
```

**Inline configuration**:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/validate.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

**Use cases**:
- Simple plugins: Inline configuration (< 50 lines)
- Complex plugins: External JSON file
- Multiple hook sets: Separate files for different contexts

#### mcpServers

**Type**: String (path to JSON file) or Object (inline configuration)
**Default**: `./.mcp.json`

MCP server configuration location or inline definition.

**File path**:
```json
{
  "mcpServers": "./.mcp.json"
}
```

**Inline configuration**:
```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/servers/github-mcp.js"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

**Use cases**:
- Simple plugins: Single inline server (< 20 lines)
- Complex plugins: External `.mcp.json` file
- Multiple servers: Always use external file

## Path Resolution

### Relative Path Rules

All paths in component fields must follow these rules:

1. **Must be relative**: No absolute paths
2. **Must start with `./`**: Indicates relative to plugin root
3. **Cannot use `../`**: No parent directory navigation
4. **Forward slashes only**: Even on Windows

**Examples**:
- ✅ `"./commands"`
- ✅ `"./src/commands"`
- ✅ `"./configs/hooks.json"`
- ❌ `"/Users/name/plugin/commands"`
- ❌ `"commands"` (missing `./`)
- ❌ `"../shared/commands"`
- ❌ `".\\commands"` (backslash)

### Resolution Order

When Claude Code loads components:

1. **Default directories**: Scans standard locations first
   - `./commands/`
   - `./agents/`
   - `./skills/`
   - `./hooks/hooks.json`
   - `./.mcp.json`

2. **Custom paths**: Scans paths specified in manifest
   - Paths from `commands` field
   - Paths from `agents` field
   - Files from `hooks` and `mcpServers` fields

3. **Merge behavior**: Components from all locations load
   - No overwriting
   - All discovered components register
   - Name conflicts cause errors

## Validation

### Manifest Validation

Claude Code validates the manifest on plugin load:

**Syntax validation**:
- Valid JSON format
- No syntax errors
- Correct field types

**Field validation**:
- `name` field present and valid format
- `version` follows semantic versioning (if present)
- Paths are relative with `./` prefix
- URLs are valid (if present)

**Component validation**:
- Referenced paths exist
- Hook and MCP configurations are valid
- No circular dependencies

### Common Validation Errors

**Invalid name format**:
```json
{
  "name": "My Plugin"  // ❌ Contains spaces
}
```
Fix: Use kebab-case
```json
{
  "name": "my-plugin"  // ✅
}
```

**Absolute path**:
```json
{
  "commands": "/Users/name/commands"  // ❌ Absolute path
}
```
Fix: Use relative path
```json
{
  "commands": "./commands"  // ✅
}
```

**Missing ./ prefix**:
```json
{
  "hooks": "hooks/hooks.json"  // ❌ No ./
}
```
Fix: Add ./ prefix
```json
{
  "hooks": "./hooks/hooks.json"  // ✅
}
```

**Invalid version**:
```json
{
  "version": "1.0"  // ❌ Not semantic versioning
}
```
Fix: Use MAJOR.MINOR.PATCH
```json
{
  "version": "1.0.0"  // ✅
}
```

## Minimal vs. Complete Examples

### Minimal Plugin

Bare minimum for a working plugin:

```json
{
  "name": "hello-world"
}
```

Relies entirely on default directory discovery.

### Recommended Plugin

Good metadata for distribution:

```json
{
  "name": "code-review-assistant",
  "version": "1.0.0",
  "description": "Automates code review with style checks and suggestions",
  "author": {
    "name": "Jane Developer",
    "email": "jane@example.com"
  },
  "homepage": "https://docs.example.com/code-review",
  "repository": "https://github.com/janedev/code-review-assistant",
  "license": "MIT",
  "keywords": ["code-review", "automation", "quality", "ci-cd"]
}
```

### Complete Plugin

Full configuration with all features:

```json
{
  "name": "enterprise-devops",
  "version": "2.3.1",
  "description": "Comprehensive DevOps automation for enterprise CI/CD pipelines",
  "author": {
    "name": "DevOps Team",
    "email": "devops@company.com",
    "url": "https://company.com/devops"
  },
  "homepage": "https://docs.company.com/plugins/devops",
  "repository": {
    "type": "git",
    "url": "https://github.com/company/devops-plugin.git"
  },
  "license": "Apache-2.0",
  "keywords": [
    "devops",
    "ci-cd",
    "automation",
    "kubernetes",
    "docker",
    "deployment"
  ],
  "commands": [
    "./commands",
    "./admin-commands"
  ],
  "agents": "./specialized-agents",
  "hooks": "./config/hooks.json",
  "mcpServers": "./.mcp.json"
}
```

## Best Practices

### Metadata

1. **Always include version**: Track changes and updates
2. **Write clear descriptions**: Help users understand plugin purpose
3. **Provide contact information**: Enable user support
4. **Link to documentation**: Reduce support burden
5. **Choose appropriate license**: Match project goals

### Paths

1. **Use defaults when possible**: Minimize configuration
2. **Organize logically**: Group related components
3. **Document custom paths**: Explain why non-standard layout used
4. **Test path resolution**: Verify on multiple systems

### Maintenance

1. **Bump version on changes**: Follow semantic versioning
2. **Update keywords**: Reflect new functionality
3. **Keep description current**: Match actual capabilities
4. **Maintain changelog**: Track version history
5. **Update repository links**: Keep URLs current

### Distribution

1. **Complete metadata before publishing**: All fields filled
2. **Test on clean install**: Verify plugin works without dev environment
3. **Validate manifest**: Use validation tools
4. **Include README**: Document installation and usage
5. **Specify license file**: Include LICENSE file in plugin root
