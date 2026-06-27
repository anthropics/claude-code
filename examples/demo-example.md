# Example Demo File

This is a demonstration file created to show the PR workflow.

## Purpose

This file was created as part of a PR demo to illustrate:
- Branch creation
- Making changes
- Committing
- Opening a pull request

## Workflow Steps

### 1. Create a Branch

Start by creating a new branch from the main branch:

```bash
git checkout -b my-feature-branch
```

### 2. Make Your Changes

Edit files, add new files, or delete files as needed for your feature or fix.

### 3. Stage and Commit

Stage your changes and create a commit with a descriptive message:

```bash
git add .
git commit -m "Description of your changes"
```

### 4. Push to Remote

Push your branch to the remote repository:

```bash
git push -u origin my-feature-branch
```

### 5. Create a Pull Request

Use the GitHub CLI or web interface to create a PR:

```bash
gh pr create --title "My Feature" --body "Description of changes"
```

### 6. Address Review Comments

Reviewers may leave comments on your PR. Address them by making additional commits to your branch and pushing them.

### 7. Merge

Once approved, the PR can be merged into the main branch.
