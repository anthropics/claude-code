# Learning Style Plugin

This plugin combines the unshipped Learning output style with explanatory functionality as a SessionStart hook.

**Note:** This plugin differs from the original unshipped Learning output style by also incorporating all functionality from the [explanatory-output-style plugin](https://github.com/anthropics/claude-code/tree/main/plugins/explanatory-output-style), providing both interactive learning and educational insights.

WARNING: Do not install this plugin unless you are fine with incurring the token cost of this plugin's additional instructions and the interactive nature of learning mode.

## What it does

When enabled, this plugin automatically adds instructions at the start of each session that encourage Claude to:

1. **Learning Mode:** Engage you in active learning by requesting meaningful code contributions at decision points
2. **Explanatory Mode:** Provide educational insights about implementation choices and codebase patterns

Instead of implementing everything automatically, Claude will:

1. Identify opportunities where you can write 5-10 lines of meaningful code
2. Focus on business logic and design choices where your input truly matters
3. Prepare the context and location for your contribution
4. Explain trade-offs and guide your implementation
5. Provide educational insights before and after writing code

## How it works

The plugin uses a SessionStart hook to inject additional context into every session. This context instructs Claude to adopt an interactive teaching approach where you actively participate in writing key parts of the code.

## When Claude requests contributions

Claude will ask you to write code for:
- Business logic with multiple valid approaches
- Error handling strategies
- Algorithm implementation choices
- Data structure decisions
- User experience decisions
- Design patterns and architecture choices

## When Claude won't request contributions

Claude will implement directly:
- Boilerplate or repetitive code
- Obvious implementations with no meaningful choices
- Configuration or setup code
- Simple CRUD operations

## Example interaction

**Claude:** I've set up the authentication middleware. The session timeout behavior is a security vs. UX trade-off - should sessions auto-extend on activity, or have a hard timeout?

In `auth/middleware.ts`, implement the `handleSessionTimeout()` function to define the timeout behavior.

Consider: auto-extending improves UX but may leave sessions open longer; hard timeouts are more secure but might frustrate active users.

**You:** [Write 5-10 lines implementing your preferred approach]

## Educational insights

In addition to interactive learning, Claude will provide educational insights about implementation choices using this format:

```
`★ Insight ─────────────────────────────────────`
[2-3 key educational points about the codebase or implementation]
`─────────────────────────────────────────────────`
```

These insights focus on:
- Specific implementation choices for your codebase
- Patterns and conventions in your code
- Trade-offs and design decisions
- Codebase-specific details rather than general programming concepts

## Usage

Once installed, the plugin activates automatically at the start of every session. No additional configuration is needed.

## Migration from Output Styles

This plugin combines the unshipped "Learning" output style with the deprecated "Explanatory" output style. It provides an interactive learning experience where you actively contribute code at meaningful decision points, while also receiving educational insights about implementation choices.

If you previously used the explanatory-output-style plugin, this learning plugin includes all of that functionality plus interactive learning features.

This SessionStart hook pattern is roughly equivalent to CLAUDE.md, but it is more flexible and allows for distribution through plugins.

## Managing changes

- Disable the plugin - keep the code installed on your device
- Uninstall the plugin - remove the code from your device
- Update the plugin - create a local copy of this plugin to personalize it
  - Hint: Ask Claude to read https://docs.claude.com/en/docs/claude-code/plugins.md and set it up for you!

## Philosophy

Learning by doing is more effective than passive observation. This plugin transforms your interaction with Claude from "watch and learn" to "build and understand," ensuring you develop practical skills through hands-on coding of meaningful logic.
