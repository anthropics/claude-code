# Claude CLI (Research Preview)

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square)

> Use Claude, Anthropic's AI assistant, right from your terminal. Claude can understand your codebase, edit files, run terminal commands, and handle entire workflows for you.

```sh
$ npm install --global @anthropic-ai/claude-cli
$ claude
```

Claude CLI is a beta research preview. It’s not always perfect, and we’re working on improving the accuracy and quality of responses. We’d appreciate your feedback on what we can do to improve. 

## Features

- Chat with Claude in your terminal
- Interactive REPL: `claude repl` or just `claude`
- Tools: Claude can edit files, run bash commands, and explore your codebase
- Pipe in/out: `cat data.csv | claude ask "any interesting trends?" > result.txt`
- Use bash commands: type `!` to switch to bash mode
- Use tools: type `/` to switch to tool mode (or use `claude run <tool>`)
- Use Claude CLI as an MCP server
- Custom MCP clients coming soon!

#### From the CLI

```sh
# Create a commit
$ claude run commit

# Create a PR
$ claude run pr

# Prompt, then exit
$ claude ask "2+2"
4

# Pipe in
$ cat ./foo.csv | claude

# Pipe out
$ claude ask "2+2" > out.txt
$ cat out.txt
4

# Pipe in/out
$ cat ./employees.csv | claude ask "who is the newest?" | ...
```

#### From the REPL

Claude CLI will have read access to the directory you run it in. It will prompt you for write access when needed.

From the REPL, you can ask Claude anything. Claude will choose which tools to use to answer your question:

```sh
$ claude repl

> find files related to wombats
...

> edit foo.py to add an argument bar to baz
...

> which commit reverted flux capacitating?
... (claude will search commit history)

> npm run lint
... (claude will run the command and fix lint errors)

> how does foo work?
... (claude will pull in relevant files and summarize them to answer)
```

You can also run commands directly from the REPL by prefixing them with `/`:

```sh
> /help
... (claude will show you a list of available commands)

> /commit
... (claude will create a git commit)

> /pr
... (claude will create a git PR)

> /push
... (claude will push your changes to the remote branch)
```

Run bash commands directly with `!`. (Claude CLI will see the output, but will not react until you ask):

```sh
> !pyright
... (claude will run the command and show you the output)
```

#### Custom Context (advanced)

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

Claude also automatically reads CLAUDE.md files, and uses them as style guides. Ask Claude to look at a few files in your codebase and generate a CLAUDE.md for you to describe conventions around imports, formatting, types, test commands, and more.

## Safety & Security

Security and safety are top priorities. We’ve implemented a number of features to make agentic coding safe and less error-prone:

- A number of Bash commands -- including `cd`, `curl`, and `wget` -- that are vulnerable to prompt injection attacks are blocked by default.
- By default, we ask for permission for all file writes and Bash commands.
- While you can configure Claude CLI to not ask for confirmation before editing files in your current directory, file edits outside of your current directory always require explicit confirmation.

## Vulnerability Disclosure Program
Our Vulnerability Program guidelines are defined on our [HackerOne program page](https://hackerone.com/anthropic-vdp). We ask that any validated vulnerability in this tool be reported through the [submission form](https://hackerone.com/anthropic-vdp/reports/new?type=team&report_type=vulnerability)


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

## Build on Claude CLI

Claude CLI comes with an MCP Server that exposes all of Claude CLI's tools, as well as Claude CLI itself, over MCP. To start the server, run:

```sh
$ claude mcp
```

This server exposes the following tools:

- AskTool: `claude ask` -- ie. 1-shot prompts for Claude CLI. Prompt execution has access to all of Claude CLI's tools.
- BashTool: safely execute bash commands
- FileEditTool: partial file edits using string replace
- FileReadTool: safely read files
- FileSearchFast: quickly search the current directory
- FileSearchBalanced: search the current directory, summarizing the results with haiku (useful for summaries)
- FileSummarizeTool: summarize what a file does
- FileWriteTool: full file writes
- LSTool: list the folders and files in a directory

Claude CLI is also an MCP Client. To configure which MCP Servers it should query for tools and prompts, use the `claude mcp` sub-commands:

```sh
$ claude mcp add my-server ../my-server/index.js -- arg1 --flag1 --flag2
$ claude mcp get my-server
../my-server/index.js
$ claude mcp list
my-server:
  ../my-server/index.js
$ claude mcp delete my-server
```

*Note: Claude CLI's MCP Client does not yet support [resources](https://modelcontextprotocol.io/docs/concepts/resources).*

Learn more about MCP at [modelcontextprotocol.io](https://modelcontextprotocol.io).

## Why did we build this?

Many developers use Claude for coding. We built Claude CLI as a testing ground for new ways AI can take action to help developers, which helps us improve Claude as a proactive coding assistant for everyone.

## Design philosophy

We've designed Claude CLI to be a simple, easy-to-use tool for developers. It can run in a variety of contexts, including your terminal, VSCode terminal, and more. It is intentionally simple, with good defaults baked in out of the box.

Claude CLI is token-hungry by design, in order to offer the best possible performance -- it will use as many tokens as needed to answer your question and write code. That said, we take advantage of [prompt caching](https://www.anthropic.com/news/prompt-caching) to reduce costs and improve performance where possible.

## Data usage

Claude CLI is a beta research preview. We collect data as you use it, like when you accept suggestions or commands, to make the product experience better for users, including improving our models. This data is feedback per our [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms). If we train on any Feedback data obtained via Claude CLI, however, we will use it only for reinforcement learning training, not generative model pretraining. Your usage data and direct feedback help us address issues, improve model performance, and make Claude more reliable.

Data we collect includes:

- Conversation history
- Product interactions

Data is retained for up to 2 years. You can request deletion of your data at any time here: [Console Support](https://support.anthropic.com/en/articles/9015913-how-to-get-support).

Additionally, we log operational data to help us improve the product, including:

- Errors, logged to [Sentry](https://sentry.io)
- Telemetry, logged to [Statsig](https://www.statsig.com)

## Issues & bugs

Please file any issues or bugs on [GitHub](https://github.com/anthropics/claude-cli/issues). You can also submit bugs and feedback from within Claude CLI itself:

```sh
$ claude
$ /bug
```
