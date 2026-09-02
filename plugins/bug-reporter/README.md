# bug-reporter

File bug reports directly to the Claude Code GitHub repository without leaving the terminal.

## Commands

### `/bug`

Guides you through describing a bug, shows you a preview of the GitHub issue, and files it after your confirmation.

```
/bug
/bug Claude crashes when I resize the window below 10 lines
```

**Flow:**
1. Collects your Claude Code version and OS automatically
2. Asks what went wrong and how to reproduce it
3. Drafts the issue in GitHub format and shows it to you
4. Files it only after you confirm — or lets you edit first

**Requirements:** `gh` CLI authenticated (`gh auth login`)
