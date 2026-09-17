# Local Shell Interceptor Plugin

This plugin intercepts standard shell commands typed directly into Claude Code (e.g. `ls`, `watch`, `pwd`) and executes them locally on your machine instead of sending the prompt to the LLM. 

This saves tokens and reduces latency, while still providing the command output directly within the context of your Claude Code session.

## Features

- Intercepts a predefined map of standard shell commands.
- Runs commands locally via standard `subprocess`.
- Prevents LLM context consumption for standard read-only commands.
- Appends the standard output (stdout/stderr) of your commands back to Claude.

## Supported Commands

Currently intercepted commands:
`ls`, `ll`, `la`, `pwd`, `date`, `whoami`, `echo`, `cat`, `watch`, `git`, `tree`, `ps`, `top`, `htop`, `df`, `free`

## Installation

Add this plugin to your Claude project by initializing it:

```bash
claude plugin add path/to/plugins/local-shell
```

Or just copy the `hooks.json` and `intercept_command.py` into your `.claude-plugin/` hooks directory if you are configuring it manually.

## How It Works

It uses the `UserPromptSubmit` hook. Before Claude sends your prompt to the LLM, this hook parses the prompt. If the first word matches a supported local command, it executes it, blocks the prompt from being sent to the LLM, and outputs the result as a `systemMessage`.
