# GitHub CLI Commands Reference

## Authentication

```bash
gh auth login                          # Interactive login
gh auth login --web                    # Browser-based login
gh auth status                         # Check auth
gh auth token                          # Print token
gh auth refresh                        # Refresh token
gh auth logout                         # Logout
```

## Issues

### List Issues

```bash
gh issue list                          # Open issues
gh issue list --state closed           # Closed issues
gh issue list --state all              # All issues
gh issue list --label "bug"            # Filter by label
gh issue list --assignee @me           # Assigned to me
gh issue list --author @me             # Created by me
gh issue list --milestone "v1.0"       # By milestone
gh issue list --limit 50               # Limit results
```

### Create Issue

```bash
gh issue create                        # Interactive
gh issue create --title "Title"        # With title
gh issue create -t "Title" -b "Body"   # Title and body
gh issue create --label bug            # With label
gh issue create --assignee user        # With assignee
```

### View/Edit Issues

```bash
gh issue view 123                      # View issue
gh issue view 123 --web                # Open in browser
gh issue view 123 --comments           # Include comments
gh issue edit 123 --title "New title"  # Edit title
gh issue edit 123 --add-label bug      # Add label
```

### Manage Issues

```bash
gh issue close 123                     # Close issue
gh issue reopen 123                    # Reopen issue
gh issue delete 123                    # Delete issue
gh issue comment 123 --body "Comment"  # Add comment
```

## Pull Requests

### List PRs

```bash
gh pr list                             # Open PRs
gh pr list --state closed              # Closed PRs
gh pr list --state merged              # Merged PRs
gh pr list --author @me                # Your PRs
gh pr list --draft                     # Draft PRs only
```

### Create PR

```bash
gh pr create                           # Interactive
gh pr create --title "Title"           # With title
gh pr create --fill                    # Fill from commits
gh pr create --draft                   # As draft
gh pr create --base main               # Target branch
gh pr create --reviewer user1,user2    # Request reviewers
```

### PR Lifecycle

```bash
gh pr ready                            # Mark ready
gh pr review --approve                 # Approve
gh pr review --request-changes -b "Fix X"
gh pr checks                           # View checks
gh pr checks --watch                   # Watch checks
gh pr merge --squash                   # Squash merge
gh pr merge --auto                     # Auto-merge when ready
gh pr merge --delete-branch            # Delete branch after
gh pr close 456                        # Close PR
```

## Workflows and Runs

```bash
gh workflow list                       # List workflows
gh workflow view name.yml              # View workflow
gh workflow enable name.yml            # Enable workflow
gh workflow run name.yml               # Run workflow
gh workflow run name.yml -f input=val  # With inputs

gh run list                            # List runs
gh run view                            # Latest run
gh run view --log                      # With logs
gh run watch                           # Watch current run
gh run rerun 12345                     # Rerun failed
gh run cancel 12345                    # Cancel run
```

## Releases

```bash
gh release list                        # List releases
gh release create v1.0.0               # Create release
gh release create v1.0.0 --draft       # As draft
gh release create v1.0.0 --generate-notes
gh release view v1.0.0                 # View release
gh release download v1.0.0             # Download assets
```

## Repository

```bash
gh repo view                           # Current repo
gh repo view owner/repo                # Specific repo
gh repo clone owner/repo               # Clone
gh repo fork                           # Fork current
gh repo create name                    # Create repo
gh repo list                           # Your repos
```

## API

```bash
gh api repos/{owner}/{repo}
gh api repos/{owner}/{repo}/issues
gh api -X POST repos/{owner}/{repo}/issues -f title="Title" -f body="Body"
```
