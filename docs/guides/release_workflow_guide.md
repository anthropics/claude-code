# Release Workflow Guide

This guide describes the enhanced release workflow for the Claude Neural Framework, including the automated tools, processes, and best practices for creating and managing releases.

## Overview

The Claude Neural Framework uses a structured release workflow based on the GitFlow branching model:

1. Development occurs on `develop` branch or feature branches
2. Release branches are created for each release
3. Release branches are merged to `main` and back to `develop`
4. Tags are created for each release
5. GitHub releases are created from tags

The workflow is supported by two main scripts:
- `scripts/git/release-start.js`: For starting a new release
- `scripts/git/release-finish.js`: For finalizing a release

## Starting a Release

### Prerequisites

Before starting a release, ensure that:
- You have the latest `develop` branch
- All features for the release are merged to `develop`
- All tests pass on `develop`
- There are no pending changes

### Create Release Branch

To start a new release:

```bash
# From the develop branch
node scripts/git/release-start.js <version>

# For example, to create release 1.1.0
node scripts/git/release-start.js 1.1.0
```

This script will:

1. Run pre-release checks to ensure all tests pass and there are no security issues
2. Create a new `release/v1.1.0` branch from `develop`
3. Update version in `package.json` and `VERSION.txt`
4. Generate a changelog based on commit history
5. Update `CHANGELOG.md` with the new version
6. Create a release notes template file `RELEASE_NOTES_v1.1.0.md`
7. Validate version consistency across all files

### During Release Preparation

After creating the release branch, you should:

1. Complete the release notes in `RELEASE_NOTES_v1.1.0.md`
2. Verify and enhance the changelog entries
3. Make any final adjustments for the release
4. Run tests to verify the release is stable
5. Address any issues found during validation
6. Commit all changes to the release branch

## Finishing a Release

Once the release branch is ready, you can finalize the release:

```bash
# From the release branch
node scripts/git/release-finish.js
```

This script will:

1. Run pre-release checks to ensure all tests pass and there are no security issues
2. Validate version consistency across all files
3. Push the release branch to origin
4. Merge the release branch to `main` with `--no-ff`
5. Create a tag for the release
6. Merge the release branch back to `develop` with `--no-ff`
7. Push `main`, `develop`, and the tag to origin
8. Create a GitHub release with notes from the release notes file or changelog
9. Clean up by deleting the release branch (optional)

## Enterprise Workflow Requirements

The release workflow integrates with enterprise policies:

1. **Branch Policies**: Release branches require 2 approvers from Engineering and QA teams
2. **Change Management**: All releases must include a changelog
3. **Security Checks**: Security validation is performed during release
4. **Audit Logging**: All release actions are logged for compliance

## Version Consistency

The framework maintains version consistency across multiple files:
- `package.json`: The primary source of version information
- `VERSION.txt`: Contains version with optional prefix (e.g., "Enterprise Beta 1.1.0")
- `CHANGELOG.md`: Contains a section for each version

The release scripts automatically update and validate version consistency.

## Changelog Generation

The changelog is automatically generated based on conventional commit messages:

- `feat:` -> Added
- `fix:` -> Fixed
- `docs:` -> Documentation
- `refactor:` -> Changed
- `perf:` -> Performance
- `test:` -> Tests
- `chore:` -> Chores

For best results, use conventional commit messages in your development process.

## Release Notes

Release notes are structured to provide comprehensive information:

- Overview
- Key Features
- Bug Fixes
- Breaking Changes
- Upgrade Notes
- Documentation
- Contributors

A template is automatically generated but should be completed manually with detailed information.

## Best Practices

1. **Plan Releases Carefully**: Determine scope and timing of releases in advance
2. **Use Conventional Commits**: This improves changelog generation
3. **Test Thoroughly**: Always run all tests on the release branch
4. **Document Changes**: Complete the release notes with detailed information
5. **Review Before Finalizing**: Have QA and Engineering review the release
6. **Communicate**: Notify team members about new releases

## Troubleshooting

### Version Inconsistency

If version consistency check fails:
1. Check `package.json` and `VERSION.txt` for correct version
2. Ensure version matches in all files
3. Make necessary updates and commit changes

### Failed Tests

If tests fail during release:
1. Fix the failing tests
2. Commit changes to the release branch
3. Run the release script again

### GitHub Release Creation Issues

If GitHub release creation fails:
1. Ensure `gh` CLI is installed
2. Login with `gh auth login`
3. Create the release manually if needed

## Additional Resources

- [GitFlow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Enterprise Workflow Guide](./enterprise_workflow.md)