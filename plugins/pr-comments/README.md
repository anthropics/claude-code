# PR Comments Plugin

Fetch and display pull request review comments with filtering for resolved/unresolved conversations.

## Why This Plugin?

GitHub's REST API doesn't expose the "resolved" status of review threads (the "Resolve conversation" button). This plugin uses the GraphQL API which has the `isResolved` field on `reviewThreads`.

## Usage

```bash
/pr-comments:show              # Show all comments
/pr-comments:show unresolved   # Show only unresolved threads
/pr-comments:show resolved     # Show only resolved threads
```

## Features

- Uses GraphQL API to access `isResolved` field
- Filters by resolution status
- Shows diff hunks for context
- Groups comments by file and line
- Displays comment threads with replies

## Installation

Install via the Claude Code plugin system:

```bash
/plugins
# Search for "pr-comments"
# Install
```

Or add to your `.claude/settings.json`:

```json
{
  "plugins": ["pr-comments"]
}
```

## Note

This plugin complements the built-in `/pr-comments` command by adding resolution filtering. The built-in command uses REST API which doesn't have access to the resolution status.

## Related Issue

- [anthropics/claude-code#22355](https://github.com/anthropics/claude-code/issues/22355) - Request to enhance built-in `/pr-comments`

## Author

Avishay Zarad

## License

MIT
