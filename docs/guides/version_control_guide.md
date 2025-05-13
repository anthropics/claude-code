# Version Control Guide for Claude Neural Framework

This guide outlines the version control strategy for the Claude Neural Framework.

## Branching Strategy

The Claude Neural Framework follows a simplified Git Flow branching model:

### Main Branches

- **main**: The production branch, containing the stable code that has been released
- **develop**: The development branch, containing the latest features and changes

### Supporting Branches

- **feature/**: Feature branches for new features or enhancements
- **bugfix/**: Bugfix branches for fixing issues
- **release/**: Release branches for preparing releases
- **hotfix/**: Hotfix branches for critical production fixes

## Branch Naming Conventions

- **feature/**: `feature/XXX-feature-name` (where XXX is the issue number)
- **bugfix/**: `bugfix/XXX-bug-description`
- **release/**: `release/vX.Y.Z` (where X.Y.Z is the version number)
- **hotfix/**: `hotfix/vX.Y.Z` (where X.Y.Z is the version number)

Examples:
- `feature/123-add-rag-integration`
- `bugfix/456-fix-memory-leak`
- `release/v1.2.0`
- `hotfix/v1.2.1`

## Workflow

### Feature Development

1. Create a feature branch from `develop`:
   ```bash
   git checkout develop
   git pull
   git checkout -b feature/XXX-feature-name
   ```

2. Develop the feature with regular commits:
   ```bash
   git add .
   git commit -m "feat: add feature X"
   ```

3. Keep your feature branch up to date with `develop`:
   ```bash
   git fetch
   git merge origin/develop
   ```

4. Push your feature branch:
   ```bash
   git push -u origin feature/XXX-feature-name
   ```

5. Create a Pull Request to merge into `develop`

### Bug Fixing

1. Create a bugfix branch from `develop`:
   ```bash
   git checkout develop
   git pull
   git checkout -b bugfix/XXX-bug-description
   ```

2. Fix the bug with regular commits:
   ```bash
   git add .
   git commit -m "fix: resolve issue with X"
   ```

3. Push your bugfix branch:
   ```bash
   git push -u origin bugfix/XXX-bug-description
   ```

4. Create a Pull Request to merge into `develop`

### Release Process

1. Create a release branch from `develop`:
   ```bash
   git checkout develop
   git pull
   git checkout -b release/vX.Y.Z
   ```

2. Update version numbers and prepare for release:
   ```bash
   # Update version in package.json
   npm version X.Y.Z --no-git-tag-version
   
   # Update CHANGELOG.md
   node scripts/prepare_release.js
   
   git add package.json CHANGELOG.md
   git commit -m "chore: prepare release vX.Y.Z"
   ```

3. Push the release branch:
   ```bash
   git push -u origin release/vX.Y.Z
   ```

4. Create a Pull Request to merge into `main`

5. After merging to `main`, create a tag:
   ```bash
   git checkout main
   git pull
   git tag -a vX.Y.Z -m "Release vX.Y.Z"
   git push origin vX.Y.Z
   ```

6. Merge changes back to `develop`:
   ```bash
   git checkout develop
   git pull
   git merge main
   git push
   ```

### Hotfix Process

1. Create a hotfix branch from `main`:
   ```bash
   git checkout main
   git pull
   git checkout -b hotfix/vX.Y.Z
   ```

2. Fix the critical issue:
   ```bash
   git add .
   git commit -m "fix: resolve critical issue X"
   ```

3. Update version and changelog:
   ```bash
   # Update version in package.json
   npm version X.Y.Z --no-git-tag-version
   
   # Update CHANGELOG.md
   node scripts/prepare_release.js
   
   git add package.json CHANGELOG.md
   git commit -m "chore: prepare hotfix vX.Y.Z"
   ```

4. Push the hotfix branch:
   ```bash
   git push -u origin hotfix/vX.Y.Z
   ```

5. Create a Pull Request to merge into `main`

6. After merging to `main`, create a tag:
   ```bash
   git checkout main
   git pull
   git tag -a vX.Y.Z -m "Hotfix vX.Y.Z"
   git push origin vX.Y.Z
   ```

7. Merge changes back to `develop`:
   ```bash
   git checkout develop
   git pull
   git merge main
   git push
   ```

## Commit Message Conventions

The Claude Neural Framework follows the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, etc.)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to our CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files

### Examples

```
feat(rag): add vector database integration

fix(mcp): resolve connection timeout issue

docs: update README with installation instructions

refactor(config): simplify configuration loading

test(logger): add unit tests for logger components

chore: update dependencies
```

## Pull Request Process

1. Create a branch following the naming conventions
2. Make your changes with appropriate commits
3. Push your branch to the remote repository
4. Create a Pull Request with the following information:
   - Clear description of the changes
   - Reference to any relevant issues
   - Type of change (feature, bugfix, etc.)
   - Testing performed
   - Any specific review points
5. Request reviews from appropriate team members
6. Address any review comments
7. Merge the PR once approved

## Versioning

The Claude Neural Framework follows [Semantic Versioning](https://semver.org/):

- **Major version (x.0.0)**: Incompatible API changes
- **Minor version (0.x.0)**: Backwards-compatible functionality
- **Patch version (0.0.x)**: Backwards-compatible bug fixes

### Version Bumping

- For new features: Increment the minor version
- For bug fixes: Increment the patch version
- For breaking changes: Increment the major version

## Release Process

1. Create a release branch
2. Update version numbers
3. Update CHANGELOG.md
4. Run tests and checks
5. Create a Pull Request to `main`
6. After merging, tag the release
7. Merge changes back to `develop`
8. Create GitHub Release with release notes

## Git Hooks

The repository includes Git hooks to enforce commit message conventions and run tests before pushing:

### pre-commit

- Runs linters
- Checks for formatting issues
- Prevents committing sensitive information

### commit-msg

- Validates commit message format
- Ensures conventional commit compliance

### pre-push

- Runs tests
- Checks for security vulnerabilities

## Git Tools and Aliases

### Recommended Git Configuration

```bash
# Set up user information
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Set up helpful aliases
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
git config --global alias.unstage 'reset HEAD --'
git config --global alias.last 'log -1 HEAD'
git config --global alias.visual '!gitk'
```

### Useful Git Commands

```bash
# Undo last commit but keep changes
git reset --soft HEAD~1

# Undo last commit and discard changes
git reset --hard HEAD~1

# Amend last commit
git commit --amend

# Create a feature branch
git checkout -b feature/XXX-feature-name

# Push branch and set upstream
git push -u origin feature/XXX-feature-name

# Clean up local branches
git fetch -p && git branch -vv | grep ': gone]' | awk '{print $1}' | xargs git branch -d

# Show commit history with graph
git log --graph --oneline --decorate
```

## Best Practices

1. **Atomic Commits**: Each commit should represent a single logical change
2. **Descriptive Commit Messages**: Follow conventional commits for clear messaging
3. **Regular Updates**: Keep branches up to date with their base branches
4. **Pull Request Size**: Keep PRs focused and limited in scope
5. **Code Reviews**: All code should be reviewed before merging
6. **Continuous Integration**: Run tests before merging
7. **Protected Branches**: Prevent direct pushes to `main` and `develop`
8. **Signed Commits**: Use GPG to sign commits where possible

## Git Workflow Automation

The framework includes scripts for automating common Git workflows:

### Feature Start

```bash
node scripts/git/feature-start.js "Add RAG integration" 123
# Creates and checks out feature/123-add-rag-integration
```

### Feature Finish

```bash
node scripts/git/feature-finish.js
# Merges current feature branch to develop
```

### Release Start

```bash
node scripts/git/release-start.js 1.2.0
# Creates and checks out release/v1.2.0
```

### Release Finish

```bash
node scripts/git/release-finish.js
# Merges current release branch to main and develop
```

## Troubleshooting

### Common Issues

1. **Merge Conflicts**:
   ```bash
   # Abort merge
   git merge --abort
   
   # Resolve conflicts and continue
   git add .
   git merge --continue
   ```

2. **Accidental Commits to Wrong Branch**:
   ```bash
   # Create a new branch with your changes
   git checkout -b feature/new-branch
   
   # Go back to the original branch and reset
   git checkout original-branch
   git reset --hard origin/original-branch
   ```

3. **Need to Undo a Merge Commit**:
   ```bash
   git reset --hard HEAD~1
   ```

### Getting Help

If you encounter any issues with the Git workflow, please contact the framework maintainers or consult the Git documentation.