# Contributing to Claude Code

Claude Code welcomes contributions via forks and pull requests on GitHub.

## Getting started

1. **Fork** the repo on GitHub: click "Fork" at `https://github.com/anthropics/claude-code`.
2. **Clone your fork**:

   ```bash
   git clone https://github.com/<your-username>/claude-code.git
   cd claude-code
   ```

3. **Add the upstream remote** so you can pull the latest changes from the main repo:

   ```bash
   git remote add upstream https://github.com/anthropics/claude-code.git
   ```

At this point:

- `origin` points at your fork (for example, `https://github.com/<your-username>/claude-code.git`)
- `upstream` points at the main repo (`https://github.com/anthropics/claude-code.git`)

## Contribution workflow

1. **Create a branch** for your change:

   ```bash
   git checkout -b your-feature-name
   ```

2. **Make your changes** and commit:

   ```bash
   git add .
   git commit -m "Your commit message"
   ```

3. **Push to your fork**:

   ```bash
   git push -u origin your-feature-name
   ```

4. **Open a Pull Request** on GitHub from your fork to `anthropics/claude-code`:

   - Go to `https://github.com/anthropics/claude-code/compare`
   - Or run: `gh pr create --repo anthropics/claude-code`

## Staying in sync with upstream

Before starting new work, pull the latest from upstream `main`:

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

Or use rebase to keep a linear history:

```bash
git fetch upstream
git checkout main
git rebase upstream/main
```

## Quick reference

| Action      | Command                                                               |
|-------------|-----------------------------------------------------------------------|
| Sync `main` | `git fetch upstream && git checkout main && git merge upstream/main` |
| Create PR   | `gh pr create`                                                       |
| Report bugs | Use `/bug` in Claude Code or [file an issue](https://github.com/anthropics/claude-code/issues) |

