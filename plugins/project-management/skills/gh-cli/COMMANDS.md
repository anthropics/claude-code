# GitHub CLI Commands Reference

## Authentication

```bash
# Login
gh auth login                          # Interactive login
gh auth login --web                    # Browser-based login
gh auth login --with-token < token.txt # Token login

# Status
gh auth status                         # Check auth
gh auth token                          # Print token

# Manage
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
gh issue list --label "bug,urgent"     # Multiple labels
gh issue list --assignee @me           # Assigned to me
gh issue list --assignee user          # Assigned to user
gh issue list --author @me             # Created by me
gh issue list --milestone "v1.0"       # By milestone
gh issue list --limit 50               # Limit results
gh issue list --search "keyword"       # Search
```

### Create Issue

```bash
gh issue create                        # Interactive
gh issue create --title "Title"        # With title
gh issue create -t "Title" -b "Body"   # Title and body
gh issue create --label bug            # With label
gh issue create --assignee user        # With assignee
gh issue create --milestone "v1.0"     # With milestone
gh issue create --project "Board"      # Add to project

# Full example
gh issue create \
  --title "Bug: Login fails" \
  --body "Description here" \
  --label bug,priority \
  --assignee user1,user2 \
  --milestone "v1.0"
```

### View/Edit Issues

```bash
gh issue view 123                      # View issue
gh issue view 123 --web                # Open in browser
gh issue view 123 --json title,body    # JSON output
gh issue view 123 --comments           # Include comments

gh issue edit 123 --title "New title"  # Edit title
gh issue edit 123 --body "New body"    # Edit body
gh issue edit 123 --add-label bug      # Add label
gh issue edit 123 --remove-label old   # Remove label
gh issue edit 123 --add-assignee user  # Add assignee
```

### Manage Issues

```bash
gh issue close 123                     # Close issue
gh issue close 123 --comment "Done"    # Close with comment
gh issue reopen 123                    # Reopen issue
gh issue delete 123                    # Delete issue
gh issue pin 123                       # Pin issue
gh issue unpin 123                     # Unpin issue
gh issue lock 123                      # Lock issue
gh issue unlock 123                    # Unlock issue
gh issue transfer 123 owner/repo       # Transfer issue

# Comments
gh issue comment 123 --body "Comment"  # Add comment
gh issue comment 123 --edit-last       # Edit last comment
```

## Pull Requests

### List PRs

```bash
gh pr list                             # Open PRs
gh pr list --state closed              # Closed PRs
gh pr list --state merged              # Merged PRs
gh pr list --state all                 # All PRs
gh pr list --author @me                # Your PRs
gh pr list --assignee user             # Assigned PRs
gh pr list --label "needs-review"      # By label
gh pr list --base main                 # To specific base
gh pr list --head feature              # From specific head
gh pr list --draft                     # Draft PRs only
gh pr list --limit 50                  # Limit results
```

### Create PR

```bash
gh pr create                           # Interactive
gh pr create --title "Title"           # With title
gh pr create --fill                    # Fill from commits
gh pr create --draft                   # As draft
gh pr create --base main               # Target branch
gh pr create --head feature            # Source branch
gh pr create --reviewer user1,user2    # Request reviewers
gh pr create --assignee user           # Assign
gh pr create --label enhancement       # Add labels
gh pr create --milestone "v1.0"        # Set milestone
gh pr create --project "Board"         # Add to project

# Full example
gh pr create \
  --title "feat: add login" \
  --body "Fixes #123" \
  --draft \
  --base main \
  --head feature/123-login \
  --reviewer user1 \
  --label enhancement
```

### View/Edit PRs

```bash
gh pr view                             # Current branch PR
gh pr view 456                         # Specific PR
gh pr view --web                       # Open in browser
gh pr view --json state,mergeable      # JSON output

gh pr edit 456 --title "New title"     # Edit title
gh pr edit 456 --body "New body"       # Edit body
gh pr edit 456 --add-label bug         # Add label
gh pr edit 456 --add-reviewer user     # Add reviewer
gh pr edit 456 --base develop          # Change base
```

### PR Lifecycle

```bash
# Draft management
gh pr ready                            # Mark ready
gh pr ready 456                        # Specific PR

# Review
gh pr review --approve                 # Approve
gh pr review --approve --body "LGTM"   # Approve with comment
gh pr review --request-changes -b "Fix X"
gh pr review --comment -b "Consider Y"

# Checks
gh pr checks                           # View checks
gh pr checks --watch                   # Watch checks
gh pr checks --required                # Required only

# Merge
gh pr merge                            # Merge (interactive)
gh pr merge --merge                    # Merge commit
gh pr merge --squash                   # Squash merge
gh pr merge --rebase                   # Rebase merge
gh pr merge --auto                     # Auto-merge when ready
gh pr merge --delete-branch            # Delete branch after
gh pr merge --admin                    # Admin override

# Other
gh pr close 456                        # Close PR
gh pr reopen 456                       # Reopen PR
gh pr diff                             # View diff
gh pr diff --patch                     # Patch format
```

### PR Comments

```bash
gh pr comment 456 --body "Comment"     # Add comment
gh pr comment --body-file comment.md   # From file
```

## Workflows & Runs

### Workflows

```bash
gh workflow list                       # List workflows
gh workflow view                       # View workflow
gh workflow view name.yml              # Specific workflow
gh workflow enable name.yml            # Enable workflow
gh workflow disable name.yml           # Disable workflow

# Trigger
gh workflow run name.yml               # Run workflow
gh workflow run name.yml -f input=val  # With inputs
gh workflow run name.yml --ref branch  # On specific ref
```

### Runs

```bash
gh run list                            # List runs
gh run list --workflow name.yml        # Filter by workflow
gh run list --status failure           # Filter by status
gh run list --limit 20                 # Limit results

gh run view                            # Latest run
gh run view 12345                      # Specific run
gh run view --log                      # With logs
gh run view --job 67890                # Specific job

gh run watch                           # Watch current run
gh run watch 12345                     # Watch specific run

gh run rerun 12345                     # Rerun failed
gh run rerun 12345 --failed            # Rerun failed jobs only
gh run cancel 12345                    # Cancel run

gh run download 12345                  # Download artifacts
```

## Releases

```bash
# List
gh release list                        # List releases

# Create
gh release create v1.0.0               # Create release
gh release create v1.0.0 --draft       # As draft
gh release create v1.0.0 --prerelease  # Pre-release
gh release create v1.0.0 --generate-notes
gh release create v1.0.0 --notes "Notes"
gh release create v1.0.0 --notes-file CHANGELOG.md
gh release create v1.0.0 ./dist/*      # With assets

# Manage
gh release view v1.0.0                 # View release
gh release edit v1.0.0 --draft=false   # Publish draft
gh release delete v1.0.0               # Delete release
gh release download v1.0.0             # Download assets
gh release upload v1.0.0 ./new-file    # Upload asset
```

## Repository

```bash
# View
gh repo view                           # Current repo
gh repo view owner/repo                # Specific repo
gh repo view --json name,description   # JSON output
gh repo view --web                     # Open in browser

# Clone/Fork
gh repo clone owner/repo               # Clone
gh repo fork                           # Fork current
gh repo fork owner/repo                # Fork specific
gh repo fork --clone                   # Fork and clone

# Create
gh repo create name                    # Create
gh repo create name --public           # Public repo
gh repo create name --private          # Private repo
gh repo create name --description "Desc"
gh repo create name --clone            # Create and clone

# Configure
gh repo set-default owner/repo         # Set default
gh repo rename new-name                # Rename
gh repo archive                        # Archive
gh repo delete owner/repo --yes        # Delete

# List
gh repo list                           # Your repos
gh repo list owner                     # User's repos
gh repo list --limit 50                # Limit results
```

## API

```bash
# REST API
gh api repos/{owner}/{repo}
gh api repos/{owner}/{repo}/issues
gh api -X POST repos/{owner}/{repo}/issues \
  -f title="Title" \
  -f body="Body"

# GraphQL
gh api graphql -f query='
  query {
    viewer {
      login
      repositories(first: 10) {
        nodes { name }
      }
    }
  }
'

# Pagination
gh api repos/{owner}/{repo}/issues --paginate
```

## Configuration

```bash
gh config set editor vim               # Set editor
gh config set git_protocol ssh         # Use SSH
gh config set prompt disabled          # Disable prompts
gh config get editor                   # Get config value
gh config list                         # List all config
```

## Aliases

```bash
gh alias set pv 'pr view'              # Create alias
gh alias list                          # List aliases
gh alias delete pv                     # Delete alias

# Useful aliases
gh alias set co 'pr checkout'
gh alias set prs 'pr status'
gh alias set myissues 'issue list --assignee @me'
```
