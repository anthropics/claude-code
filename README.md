# Claude CLI (Research Preview)

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square)

Use Claude, Anthropic's AI assistant, right from your terminal. Claude can understand your codebase, edit files, run terminal commands, and handle entire workflows for you.

```sh
$ npm install --global @anthropic-ai/claude-cli
$ claude
```

## Why did we build this?

Many developers already use Claude for coding. We built Claude CLI as a testing ground for new features and ways AI can take action to help developers, helping us improve Claude as a hands-on coding assistant for everyone.

We collect data as you use the product, like when you accept suggestions or commands, to make the experience better. Your usage data and direct feedback help us fix problems, improve performance, and make Claude more reliable. Since this is a beta version, please review any suggested code or changes before using them.

## Features

- Chat with Claude in your terminal
- Interactive REPL: `claude repl` or just `claude`
- Tools: Claude can edit files, run bash commands, and explore your codebase
- Pipe in/out: `cat data.csv | claude ask "any interesting trends?" > result.txt`
- Use bash commands: type `!` to switch to bash mode
- Use tools: type `/` to switch to tool mode (or use `claude run <tool>`)

### Custom Context (advanced)

Claude automatically understands your codebase and uses it to help with tasks. You can also add custom context variables:

```sh
$ claude context set "test command" "pytest"
```

To manage context, use:

```sh
$ claude context get "test command" # "pytest"
$ claude context list # list all context variables
$ claude context delete "test command"
```

Claude also automatically reads STYLE.md files, and uses them as style guides. Ask Claude to look at a few files in your codebase and generate a STYLE.md for you to describe conventions around imports, formatting, types, and so on.

## Benchmarks

[@sidb todo]

## Safety & Security

We take security seriously, and have implemented a number of safety features to make agentic coding safe and less error-prone:

- A number of bash commands are blocked by default, including `cd`, `curl`, and `wget`.
- While you can configure Claude CLI to not ask for confirmation before editing files in your current directory, file edits outside of your current directory always require explicit confirmation.

## Configuration

Claude CLI supports both global and project-specific configurations.

### Global Configuration

Global settings are stored in `~/.claude.json` and include:

- Anthropic API key
- Other global preferences

Manage the config with `claude config`:

```sh
claude config set --global anthropicApiKey sk-ant-...
claude config get --global anthropicApiKey
claude config delete --global anthropicApiKey
claude config list --global
```

### Environment Variables

You can also use environment variables for configuration. All of these are optional:

```sh
ANTHROPIC_API_KEY=sk-ant-...

# Anthropic model
ANTHROPIC_MODEL=claude-3-5-sonnet-...

# Google API key (for web search -- see https://developers.google.com/custom-search/v1/overview)
GOOGLE_API_KEY=yourkey
```

### Project Configuration

Project-specific settings are stored per-directory and include:

- Context variables
- Other preferences

Manage project configs using:

```sh
claude config get
claude config set key value
claude config delete key
claude config list
```

### Chat history

Full chat history is stored in `~/.claude/messages/`. Errors are stored in `~/.claude/errors/`.

View logs and errors with:

```sh
claude log      # View message history
claude error    # View error logs
```

## Data usage

We collect data as you use the product, like when you accept suggestions or commands, to make the experience better. Your usage data and direct feedback help us fix problems, improve performance, and make Claude more reliable.

Data we collect includes:

- Conversation history
- Tool usage
- String replacements

Data is retained for up to 2 years, and may be used to improve our products, including for training purposes. You can delete your data at any time here: [Console Support](https://support.anthropic.com/en/articles/9015913-how-to-get-support).

# Issues & bugs

Please file any issues or bugs on [GitHub](https://github.com/anthropics/claude-cli/issues).
