# Claude Code IDE Integration Guide

This guide provides comprehensive, end-to-end instructions on how to integrate Claude Code into Visual Studio Code, Cursor, JetBrains IDEs, and custom-built coding agents.

## Table of Contents

1.  [Introduction](#introduction)
2.  [Prerequisites & Setup](#prerequisites--setup)
    *   [Required Tools & Libraries](#required-tools--libraries)
    *   [Environment Configuration](#environment-configuration)
3.  [Installation & Integration](#installation--integration)
    *   [Visual Studio Code (and forks like Cursor)](#visual-studio-code-and-forks-like-cursor)
    *   [JetBrains IDEs (IntelliJ, PyCharm, WebStorm, etc.)](#jetbrains-ides-intellij-pycharm-webstorm-etc)
    *   [Custom Coding Agents/IDEs](#custom-coding-agentsides)
    *   [Configuration](#configuration)
4.  [Customization & Usage](#customization--usage)
    *   [Key Features](#key-features)
    *   [Extending for Different Workflows](#extending-for-different-workflows)
    *   [Activating, Using, and Testing](#activating-using-and-testing)
5.  [Deployment Workflow](#deployment-workflow)
    *   [Packaging and Building](#packaging-and-building)
    *   [CI/CD Pipelines](#cicd-pipelines)
    *   [Platform-Specific Deployment](#platform-specific-deployment)
6.  [Review & Debugging](#review--debugging)
    *   [Logging and Monitoring](#logging-and-monitoring)
    *   [Common Issues & Troubleshooting](#common-issues--troubleshooting)
    *   [Code Review and Quality](#code-review-and-quality)
7.  [Maintenance & Scaling](#maintenance--scaling)
    *   [Updating Claude Code](#updating-claude-code)
    *   [Version Control with Claude Code](#version-control-with-claude-code)
    *   [Performance Optimization](#performance-optimization)
8.  [Official Resources](#official-resources)

## 1. Introduction

Claude Code is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster by executing routine tasks, explaining complex code, and handling git workflows—all through natural language commands. Integrating it into your IDE can significantly streamline your development process.

This document details how to set up and use Claude Code within various IDEs.

## 2. Prerequisites & Setup

### Required Tools & Libraries

*   **Node.js and npm:** Claude Code is distributed as an npm package.
    *   Node.js (version 18+ recommended). You can download it from [nodejs.org](https://nodejs.org/).
    *   npm (usually comes with Node.js).
*   **Git:** For version control tasks.
*   **Supported IDE:**
    *   Visual Studio Code (or forks like Cursor, Windsurf)
    *   JetBrains IDEs (PyCharm, WebStorm, IntelliJ IDEA, GoLand, etc.)
*   **Anthropic API Key:** Required for Claude Code to function. You can get this after signing up at [Anthropic's website](https://console.anthropic.com/login).

### Environment Configuration

Claude Code is a command-line tool and generally works across Windows, macOS, and Linux, provided Node.js is set up correctly.

*   **ANTHROPIC_API_KEY Environment Variable:**
    It's recommended to set your Anthropic API key as an environment variable for security and ease of use.
    *   **macOS/Linux:** Add `export ANTHROPIC_API_KEY='your_api_key_here'` to your shell configuration file (e.g., `~/.bashrc`, `~/.zshrc`).
    *   **Windows:** Set it via System Properties > Environment Variables.
    *   Alternatively, Claude Code will prompt you for the key on first run if not set.
*   **Shell Command in PATH (for VS Code & forks):**
    *   Ensure your IDE's shell command is available in your system's PATH.
        *   **VS Code:** `code`
        *   **Cursor:** `cursor`
        *   **Windsurf:** `windsurf`
    *   In VS Code, you can add this by opening the Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`) and searching for "Shell Command: Install 'code' command in PATH". Other forks have similar commands.

## 3. Installation & Integration

First, install Claude Code globally using npm:

```bash
npm install -g @anthropic-ai/claude-code
```

After installation, you'll need to authenticate. If the `ANTHROPIC_API_KEY` environment variable isn't set, running `claude` for the first time will prompt you to enter it.

Refer to the [official setup guide](https://docs.anthropic.com/en/docs/claude-code/setup) for more details.

### Visual Studio Code (and forks like Cursor)

1.  **Open VS Code or its fork (e.g., Cursor).**
2.  **Open the integrated terminal** (View > Terminal or ``Ctrl+` ``).
3.  **Run the `claude` command** in the integrated terminal:
    ```bash
    claude
    ```
    The Claude Code extension should auto-install. If it's the first time, you might be prompted for your API key if not already configured.
4.  **Verify Installation:** Look for a Claude Code icon or related messages in the IDE.

You can also use the `/ide` command within an external terminal session of `claude` to connect to a running instance of VS Code.

### JetBrains IDEs (IntelliJ, PyCharm, WebStorm, etc.)

There are two primary ways to install the Claude Code plugin:

*   **Marketplace Installation (Recommended):**
    1.  Open your JetBrains IDE.
    2.  Go to `File > Settings/Preferences > Plugins`.
    3.  Search for "Claude Code" in the Marketplace tab.
    4.  Click "Install" and restart the IDE when prompted.
    5.  [Link to JetBrains Plugin Marketplace for Claude Code](https://docs.anthropic.com/s/claude-code-jetbrains) (Placeholder, actual link might differ or not exist directly, the docs link to this path)

*   **Automatic Installation via Terminal:**
    1.  Open your JetBrains IDE.
    2.  Open the integrated terminal (`View > Tool Windows > Terminal` or `Alt+F12`).
    3.  Run the `claude` command:
        ```bash
        claude
        ```
        The plugin may auto-install. The IDE must be restarted completely for the changes to take effect. You might need to restart multiple times.

**Remote Development (JetBrains):** If using JetBrains Remote Development, you must install the plugin on the remote host via `Settings > Plugins (Host)`.

### Custom Coding Agents/IDEs

Integrating Claude Code into a custom agent or a non-officially supported IDE generally involves leveraging its command-line interface (CLI) nature.

1.  **Core Interaction:** Your custom agent will need to be able to:
    *   Invoke the `claude` CLI tool as a subprocess.
    *   Send commands (natural language prompts or slash commands) to its standard input.
    *   Read responses from its standard output and standard error.
2.  **Environment:** Ensure Node.js is available in the environment where your custom agent runs the `claude` command. The `ANTHROPIC_API_KEY` must also be accessible.
3.  **File System Access:** Claude Code works with files on the local system. Your agent needs to ensure `claude` is run in the context of the project directory it's working on.
4.  **Contextual Information:** To provide context similar to official IDE integrations (e.g., current file, selection), your agent would need to:
    *   Identify the current active file and selection.
    *   Pass this information to `claude` using its file referencing syntax (e.g., `@path/to/file.py#L10-L20`) or by including it in the prompt.
5.  **Displaying Diffs:** For displaying changes, your agent could:
    *   Parse diffs produced by Claude Code (if configured to output to stdout).
    *   Apply these diffs or present them in a custom UI.
    *   Alternatively, allow Claude Code to modify files directly and then refresh the view in the custom IDE.
6.  **Model Context Protocol (MCP):** For deeper integration, especially if your agent manages complex project contexts or virtual file systems, explore the [Model Context Protocol (MCP)](https://docs.anthropic.com/en/docs/mcp). This protocol allows tools to provide Claude with rich, real-time context about the codebase.
7.  **Claude Code SDK:** Anthropic also provides a [Claude Code SDK](https://docs.anthropic.com/en/docs/claude-code/sdk) which might be more suitable for programmatic integration than direct CLI interaction for some custom agents. This would likely involve TypeScript/JavaScript.

**Example (Conceptual) for a custom agent sending a prompt:**

```python
# Python example for a custom agent
import subprocess

project_dir = "/path/to/user/project"
prompt = "Explain the function at @src/utils.py#L15-L30"

process = subprocess.Popen(
    ['claude'], # Assuming 'claude' is in PATH
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    cwd=project_dir
)
stdout, stderr = process.communicate(input=prompt + "\n/exit\n") # Send prompt and then exit command

print("Claude's output:", stdout)
if stderr:
    print("Claude's errors:", stderr)
```

### Configuration

Once Claude Code is installed and integrated (especially for VS Code and JetBrains), you can configure its behavior.

1.  **Launch Claude Code:** Run `claude` in your IDE's integrated terminal or an external terminal.
2.  **Run `/config` command:** Inside the Claude Code interactive session, type:
    ```
    /config
    ```
3.  **IDE-Specific Features:**
    *   **Diff Tool:** Set the `diff_tool` to `auto` for automatic IDE detection. This allows Claude Code to display changes directly in the IDE's diff viewer.
        ```
        /config set diff_tool auto
        ```
    *   Refer to [Claude Code Settings Documentation](https://docs.anthropic.com/en/docs/claude-code/settings) for all available options.

If you are using an external terminal (not the IDE's built-in one), use the `/ide` command after launching `claude` to connect to your IDE. This enables features like diff viewing and context sharing. Ensure `claude` is started from the same directory as your IDE project root.

## 4. Customization & Usage

### Key Features

Once integrated, Claude Code offers several powerful features within your IDE:

*   **Quick Launch:**
    *   **Mac:** `Cmd+Esc`
    *   **Windows/Linux:** `Ctrl+Esc`
    *   This shortcut opens Claude Code directly from your editor. Alternatively, some IDEs might add a Claude Code button to the UI.
*   **Diff Viewing:** Code changes suggested by Claude can be displayed directly in the IDE's native diff viewer instead of the terminal (requires `diff_tool` set to `auto` or the specific IDE).
*   **Selection Context:** The current code selection or active tab in your IDE is automatically shared with Claude Code, providing immediate context for your prompts.
*   **File Reference Shortcuts:**
    *   **Mac:** `Cmd+Option+K`
    *   **Linux/Windows:** `Alt+Ctrl+K`
    *   This inserts a formatted reference to the currently active file and selection (e.g., `@path/to/file.ext#L1-99`) into the Claude Code prompt.
*   **Diagnostic Sharing:** Errors and warnings (linting, syntax errors) from your IDE are automatically shared with Claude Code, allowing it to assist with debugging.

### Extending for Different Workflows

Claude Code's flexibility allows it to be adapted to various developer workflows:

*   **Git Operations:** Use natural language for complex git tasks like "find the commit where this function was introduced" or "rebase my current branch onto main and resolve conflicts."
*   **Code Understanding:** Ask "explain this regex" or "what are the potential side effects of this function?"
*   **Test Generation/Fixing:** Prompts like "write a unit test for this function" or "this test is failing, can you see why?" (after sharing test output).
*   **Refactoring:** "Refactor this class to use composition instead of inheritance."
*   **Documentation:** "Write a docstring for this Python function." or "Generate markdown documentation for this module."
*   **Web Search:** Use the `/web` command to ask Claude to search the internet for information, e.g., `/web how to use the requests library in Python`.

### Activating, Using, and Testing

*   **Activation:**
    *   Launch `claude` in the integrated terminal.
    *   Use the quick launch keyboard shortcuts (`Cmd+Esc` or `Ctrl+Esc`).
    *   Click any Claude Code UI elements if provided by the IDE extension.
*   **Usage:**
    *   Once the Claude Code prompt is active, type your requests in natural language.
    *   Use [slash commands](https://docs.anthropic.com/en/docs/claude-code/slash-commands) for specific actions (e.g., `/commit`, `/test`, `/config`, `/help`).
    *   Use file references (`@path/to/file`) and line number references (`@path/to/file#L10-L20`) to direct Claude's attention.
*   **Testing the Integration:**
    1.  Open a project in your IDE.
    2.  Launch Claude Code.
    3.  Select a piece of code in your editor.
    4.  Ask Claude a question about the selected code, e.g., "Explain this selected code." Verify that Claude's response is relevant to the selection.
    5.  Ask Claude to make a simple change, e.g., "Add a comment 'TODO' at the beginning of this function." If `diff_tool` is configured, verify the change appears in the IDE's diff viewer.
    6.  Try a file reference shortcut (`Cmd+Option+K` or `Alt+Ctrl+K`) to see if it correctly inserts the file path and line numbers.
    7.  Introduce a syntax error in a file and see if Claude Code (potentially with a prompt like "fix errors in @current_file") acknowledges or uses diagnostic information.

## 5. Deployment Workflow

Claude Code itself is a developer tool, not typically "deployed" in the same way as an application. However, this section addresses aspects related to its distribution and use in various environments.

### Packaging and Building

*   **Claude Code CLI:** Claude Code is distributed as a pre-built `npm` package. There's no separate packaging or building step for the end-user other than `npm install -g @anthropic-ai/claude-code`.
*   **IDE Extensions/Plugins:**
    *   **VS Code:** The extension is bundled with the `claude` CLI and auto-installs.
    *   **JetBrains:** The plugin is available on the JetBrains Marketplace.
*   **Custom Agents:** If you're building a custom agent that bundles or uses Claude Code:
    *   You might package your agent using tools like Electron, PyInstaller, or simply distribute it as a script/package that lists `claude-code` as a dependency (if using the SDK) or assumes `claude` CLI is pre-installed.
    *   Ensure the Node.js runtime is available in the target environment for the `claude` CLI.

### CI/CD Pipelines

Claude Code can be used *within* CI/CD pipelines, primarily through its GitHub Action or by running the CLI directly:

*   **[Claude Code GitHub Action](https://docs.anthropic.com/en/docs/claude-code/github-actions):** Allows you to trigger Claude Code on GitHub events (e.g., PR comments, issues). Example usage:
    ```yaml
    name: Claude Code
    on:
      issue_comment:
        types: [created]
      # ... other triggers

    jobs:
      claude:
        if: contains(github.event.comment.body, '@claude') # Example condition
        runs-on: ubuntu-latest
        steps:
          - name: Checkout repository
            uses: actions/checkout@v4
          - name: Run Claude Code
            uses: anthropics/claude-code-action@beta # Or specific version
            with:
              anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
              # other options like prompt, command, etc.
    ```
*   **Direct CLI Usage in CI:** You can install and run `claude` CLI in any CI environment that supports Node.js. This could be used for automated code reviews, documentation generation, or other tasks.
    ```bash
    # Example CI script steps
    npm install -g @anthropic-ai/claude-code
    claude --non-interactive --prompt "Review all staged files for potential issues" # Fictional non-interactive mode, check CLI reference
    # Actual non-interactive use might involve piping prompts or specific commands.
    ```
    Refer to the [CLI Reference](https://docs.anthropic.com/en/docs/claude-code/cli-reference) for command-line options suitable for scripting.

### Platform-Specific Deployment

*   **Development Containers:** Claude Code can be included in development containers for a consistent environment. Anthropic provides a [reference dev container setup](https://docs.anthropic.com/en/docs/claude-code/devcontainer).
    *   Your `.devcontainer/devcontainer.json` could include `claude-code` in `postCreateCommand` or as a feature.
    *   Ensure Node.js is part of the dev container image.
*   **Corporate Proxies / LLM Gateways:**
    *   For enterprise environments, Claude Code can be configured to work with [corporate proxies](https://docs.anthropic.com/en/docs/claude-code/corporate-proxy) or [LLM gateways](https://docs.anthropic.com/en/docs/claude-code/llm-gateway). This usually involves setting environment variables like `HTTPS_PROXY` or specific Claude Code configurations for API endpoints.
*   **Cloud IDEs (e.g., AWS Cloud9, GitHub Codespaces):**
    *   These are essentially Linux environments. Install Node.js and Claude Code as you would on a local Linux machine.
    *   VS Code-based cloud IDEs (like Codespaces) should support the VS Code extension auto-install mechanism.
    *   Ensure network connectivity for API calls and `npm install`.

## 6. Review & Debugging

### Logging and Monitoring

*   **Claude Code CLI Output:** The primary source of logging is the direct output from the `claude` CLI in the terminal. Verbosity might be adjustable with future CLI options or config settings (check `/config help`).
*   **IDE Extension Logs:**
    *   **VS Code:** Check `Output > Claude Code` or general developer tool logs (`Help > Toggle Developer Tools`).
    *   **JetBrains:** Look for logs via `Help > Show Log in Finder/Explorer`. The plugin might have its own log files or use the main IDE logs.
*   **Configuration for API calls:**
    *   If using Claude Code via Amazon Bedrock or Google Vertex AI, those platforms offer their own monitoring and logging for API calls made to the Claude models. Refer to [Amazon Bedrock Integration](https://docs.anthropic.com/en/docs/claude-code/amazon-bedrock) and [Google Vertex AI Integration](https://docs.anthropic.com/en/docs/claude-code/google-vertex-ai).
*   **Local Log Files:** Claude Code may store some local logs or history. The location would be platform-dependent (e.g., in `~/.config/claude-code` on Linux or `%APPDATA%\claude-code` on Windows). Check official documentation for specifics.
    *   The `/history` command in Claude Code shows recent interactions.

### Common Issues & Troubleshooting

Refer to the official [Troubleshooting Guide](https://docs.anthropic.com/en/docs/claude-code/troubleshooting) and the [IDE Integrations Troubleshooting Section](https://docs.anthropic.com/en/docs/claude-code/ide-integrations#troubleshooting).

*   **VS Code Extension Not Installing:**
    *   Ensure `claude` is run from VS Code's integrated terminal.
    *   The `code` (or `cursor`, `windsurf`) command must be in PATH. Install via Command Palette: "Shell Command: Install 'code' command in PATH".
    *   Check VS Code permissions for installing extensions.
*   **JetBrains Plugin Not Working:**
    *   Run `claude` from the project root directory.
    *   Ensure the plugin is enabled in `Settings/Preferences > Plugins`.
    *   Restart the IDE completely (sometimes multiple times).
    *   For Remote Development, ensure plugin is installed on the remote host.
*   **API Key Issues:**
    *   Ensure `ANTHROPIC_API_KEY` is correctly set or entered when prompted.
    *   Verify the key is active and has not expired.
*   **Connectivity Problems:**
    *   Check internet connection.
    *   If behind a proxy, configure `HTTPS_PROXY` or see [Corporate Proxy Docs](https://docs.anthropic.com/en/docs/claude-code/corporate-proxy).
*   **Unexpected Behavior or Errors:**
    *   Try `/reset` within Claude Code to clear session context.
    *   Update to the latest version: `npm update -g @anthropic-ai/claude-code`.
    *   Run `claude --verbose` (if such an option exists, check `/help`) for more detailed output.
    *   Report bugs using the `/bug` command within Claude Code or via [GitHub Issues](https://github.com/anthropics/claude-code/issues).

### Code Review and Quality

*   **Using Claude Code for Reviews:** You can ask Claude Code to review your code before committing: "Review the changes in @git_staged for any issues." or "Critique this function: @path/to/file.py#L5-L20".
*   **Human Oversight:** Always treat Claude Code's suggestions as input to your own judgment. Review changes made by Claude carefully, especially complex ones.
*   **Testing:** Ensure any code generated or modified by Claude Code is thoroughly tested.
*   **Consistency:** While Claude can adapt to different coding styles, guide it with specific instructions if your project has strict conventions ("Refactor this using our standard error handling pattern...").

## 7. Maintenance & Scaling

### Updating Claude Code

*   Keep Claude Code updated to the latest version to benefit from new features, bug fixes, and model improvements:
    ```bash
    npm update -g @anthropic-ai/claude-code
    ```
*   Check the [Changelog](CHANGELOG.md) or [Release Notes](https://docs.anthropic.com/en/release-notes/overview) for information on updates.

### Version Control with Claude Code

*   Claude Code can help with Git operations:
    *   `claude "Commit all staged changes with a summary of the changes as the message."`
    *   `claude "Create a new branch named 'feature/x' and switch to it."`
    *   `claude "/git_blame @path/to/file#L10"` (using hypothetical slash command for blame)
*   **Best Practice:** Review diffs of changes made by Claude Code before staging and committing them. Use your IDE's diff viewer or `git diff`.

### Performance Optimization

*   **Context Management:** Be mindful of the context provided to Claude. Very large files or overly broad prompts might slow down responses or hit context limits. Use precise file references and line numbers. The `/list` command can show you what context Claude currently has.
*   **Slash Commands:** Use specific slash commands where available, as they can be more efficient than general natural language prompts for certain tasks.
*   **IDE Responsiveness:** If IDE integration feels slow:
    *   Ensure the IDE and Claude Code plugin/extension are up to date.
    *   Check for conflicting extensions in your IDE.
    *   Ensure your machine meets the recommended specs for your IDE.
*   **Network Latency:** Claude Code relies on API calls to Anthropic (or Bedrock/Vertex AI). A stable, low-latency internet connection is important for performance.
*   **Custom Agents:** If building a custom agent:
    *   Optimize how often and how much data you send to the `claude` CLI.
    *   Consider using the Claude Code SDK for more fine-grained control if performance is critical.
    *   Implement caching for frequently requested, static information if applicable (though Claude Code has its own internal memory/context).

## 8. Official Resources

*   **Claude Code Documentation:** [https://docs.anthropic.com/en/docs/claude-code/overview](https://docs.anthropic.com/en/docs/claude-code/overview)
*   **Setup Guide:** [https://docs.anthropic.com/en/docs/claude-code/setup](https://docs.anthropic.com/en/docs/claude-code/setup)
*   **IDE Integrations:** [https://docs.anthropic.com/en/docs/claude-code/ide-integrations](https://docs.anthropic.com/en/docs/claude-code/ide-integrations)
*   **CLI Reference:** [https://docs.anthropic.com/en/docs/claude-code/cli-reference](https://docs.anthropic.com/en/docs/claude-code/cli-reference)
*   **Slash Commands:** [https://docs.anthropic.com/en/docs/claude-code/slash-commands](https://docs.anthropic.com/en/docs/claude-code/slash-commands)
*   **Settings:** [https://docs.anthropic.com/en/docs/claude-code/settings](https://docs.anthropic.com/en/docs/claude-code/settings)
*   **Troubleshooting:** [https://docs.anthropic.com/en/docs/claude-code/troubleshooting](https://docs.anthropic.com/en/docs/claude-code/troubleshooting)
*   **GitHub Repository (for issues/actions):** [https://github.com/anthropics/claude-code](https://github.com/anthropics/claude-code)
*   **Developer Discord:** [https://www.anthropic.com/discord](https://www.anthropic.com/discord)

---

*This document is based on information available up to late 2023 / early 2024 and features of Claude Code as described in its official documentation at that time. Features and commands may evolve. Always refer to the official Claude Code documentation for the most current information.*
