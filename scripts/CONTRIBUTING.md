# Contributing to Deployment Scripts

Thank you for your interest in improving the deployment scripts! This guide will help you contribute effectively.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Setup](#development-setup)
4. [Making Changes](#making-changes)
5. [Testing](#testing)
6. [Submitting Changes](#submitting-changes)
7. [Script Guidelines](#script-guidelines)
8. [Documentation Guidelines](#documentation-guidelines)

---

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Focus on constructive feedback
- Prioritize user experience and security
- Write clear, maintainable code
- Document everything thoroughly

### Not Acceptable

- Hostile or derogatory language
- Harassment of any kind
- Publishing others' private information
- Unethical or unprofessional conduct

---

## Getting Started

### Prerequisites

```bash
# For script development
- Bash 4.0+
- shellcheck (for validation)
- Basic knowledge of shell scripting

# For testing
- Termux (recommended) or Linux environment
- Git
- Node.js (for testing deployments)
```

### Fork and Clone

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/claude-code.git
cd claude-code/scripts

# 3. Add upstream remote
git remote add upstream https://github.com/LOUSTA79/claude-code.git

# 4. Create a branch
git checkout -b feature/your-feature-name
```

---

## Development Setup

### Install Development Tools

```bash
# Termux
pkg install shellcheck git nodejs

# Ubuntu/Debian
apt install shellcheck git nodejs

# macOS
brew install shellcheck git node
```

### Validate Your Environment

```bash
# Run the test script
./test-deployment.sh

# Check syntax
bash -n your-script.sh

# Run shellcheck
shellcheck your-script.sh
```

---

## Making Changes

### What We Accept

#### Bug Fixes
- Security vulnerabilities
- Error handling issues
- Logic errors
- Performance problems

#### Features
- Improved error messages
- Better user experience
- Additional validation
- Enhanced documentation
- New deployment options

#### Documentation
- Clarifications
- Examples
- Troubleshooting tips
- Translation improvements

### What We Don't Accept

- Breaking changes without discussion
- Malicious code
- Undocumented features
- Changes without tests
- Security-weakening modifications

---

## Script Guidelines

### General Principles

1. **Safety First**
   - Validate all inputs
   - Handle errors gracefully
   - Never expose secrets
   - Fail safely

2. **User Experience**
   - Clear progress indicators
   - Helpful error messages
   - Time estimates
   - Confirmation prompts for destructive actions

3. **Maintainability**
   - Comment complex logic
   - Use descriptive variable names
   - Modular functions
   - Consistent formatting

### Script Structure

```bash
#!/data/data/com.termux/files/usr/bin/bash

# Script description
# Usage: ./script.sh [options]
# Version: X.Y.Z

set -e  # Exit on error
trap 'error_handler $? $LINENO' ERR

# ============================================
# CONFIGURATION
# ============================================

# Constants
readonly SCRIPT_VERSION="1.0.0"
readonly REQUIRED_BASH_VERSION=4

# Variables
OPTION_VALUE=""

# ============================================
# FUNCTIONS
# ============================================

error_handler() {
    local exit_code=$1
    local line_number=$2
    echo "Error on line $line_number (exit: $exit_code)"
    exit $exit_code
}

validate_input() {
    local input=$1
    # Validation logic
}

# ============================================
# MAIN SCRIPT
# ============================================

main() {
    # Script logic here
}

# Run main function
main "$@"
```

### Error Handling

```bash
# Always use error traps
set -e
trap 'handle_error $? $LINENO' ERR

# Validate inputs
if [[ ! "$EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
    echo "Invalid email format"
    exit 1
fi

# Check command availability
if ! command -v git &> /dev/null; then
    echo "Git not installed"
    exit 1
fi

# Retry logic for network operations
for attempt in {1..3}; do
    if download_file; then
        break
    fi
    if [[ $attempt -eq 3 ]]; then
        echo "Failed after 3 attempts"
        exit 1
    fi
    sleep 2
done
```

### Input Validation

```bash
# Email validation
validate_email() {
    local email=$1
    [[ "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]
}

# URL validation
validate_url() {
    local url=$1
    [[ "$url" =~ ^https?:// ]]
}

# Non-empty validation
validate_not_empty() {
    local value=$1
    [[ -n "$value" ]]
}

# Numeric validation
validate_number() {
    local value=$1
    [[ "$value" =~ ^[0-9]+$ ]]
}
```

### User Interaction

```bash
# Clear prompts
read -p "Enter your email: " EMAIL

# Hidden input for secrets
read -s -p "Enter password: " PASSWORD
echo  # New line after hidden input

# Confirmation
read -p "Are you sure? (y/n): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    exit 0
fi

# Progress indicators
echo "Step 1/5: Installing packages..."
echo "This may take 3-5 minutes..."
```

### Security

```bash
# Never log secrets
echo "Stripe key: ${STRIPE_KEY:0:7}..." # Show only first 7 chars

# Use secure file permissions
chmod 600 .env

# Validate before executing
if [[ ! "$COMMAND" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "Invalid command"
    exit 1
fi

# Don't expose sensitive info in errors
if [[ $PRODUCTION_MODE == "true" ]]; then
    echo "An error occurred"
else
    echo "Error: $DETAILED_MESSAGE"
fi
```

---

## Testing

### Before Submitting

```bash
# 1. Syntax check
bash -n your-script.sh

# 2. Shellcheck
shellcheck -x your-script.sh

# 3. Test in clean environment
# Create fresh Termux install or Docker container

# 4. Test error scenarios
# - No network
# - Insufficient space
# - Invalid inputs
# - Missing dependencies

# 5. Test on target platform
# Termux (primary)
# Linux (secondary)
```

### Test Checklist

```
Functionality:
□ Script runs without errors
□ All features work as expected
□ Error handling works correctly
□ Rollback/cleanup works

User Experience:
□ Clear progress indicators
□ Helpful error messages
□ Reasonable time estimates
□ Good feedback on success

Security:
□ No secrets exposed
□ Input validation works
□ Secure file permissions
□ Safe error messages

Compatibility:
□ Works in Termux
□ Works on standard Linux (if applicable)
□ Handles different environments
□ Backward compatible (if updating)
```

---

## Documentation Guidelines

### Required Documentation

1. **Inline Comments**
   ```bash
   # Complex logic needs explanation
   # Good: Why we're doing something
   # Bad: What the code does (should be obvious)
   ```

2. **Function Documentation**
   ```bash
   # Validates email format
   # Args:
   #   $1 - email address to validate
   # Returns:
   #   0 if valid, 1 if invalid
   validate_email() {
       # Implementation
   }
   ```

3. **README Updates**
   - Document new features
   - Update usage examples
   - Add to troubleshooting if needed

4. **CHANGELOG Updates**
   - Add entry for your changes
   - Follow Keep a Changelog format
   - Include version bump info

### Documentation Style

```markdown
# Clear Headings

Use descriptive headings that explain what follows.

## Code Blocks

Always specify language:

```bash
echo "Example command"
```

## Lists

- Use bullet points for unordered lists
- Be consistent with formatting
- Keep items parallel in structure

## Links

- [Descriptive text](https://example.com)
- Not: [click here](https://example.com)

## Emphasis

- **Bold** for important points
- *Italic* for emphasis
- `Code` for commands and filenames
```

---

## Submitting Changes

### Pull Request Process

1. **Update Documentation**
   ```bash
   # Update all relevant docs
   - README.md
   - CHANGELOG.md
   - TROUBLESHOOTING.md (if needed)
   - Inline comments
   ```

2. **Test Thoroughly**
   ```bash
   # Run all tests
   ./test-deployment.sh
   bash -n your-script.sh
   shellcheck your-script.sh
   ```

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: Add feature description

   - Detailed change 1
   - Detailed change 2

   Fixes #123"
   ```

4. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   # Then create PR on GitHub
   ```

### Commit Message Format

```
type: Short description (50 chars max)

Longer description if needed. Explain what and why,
not how. The code shows how.

- Bullet point 1
- Bullet point 2

Fixes #issue-number
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting changes
- `refactor`: Code restructuring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Security fix

## Testing
- [ ] Tested in Termux
- [ ] Tested error scenarios
- [ ] Updated documentation
- [ ] All tests pass

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
- [ ] CHANGELOG.md updated

## Screenshots (if applicable)
Add screenshots showing the changes

## Additional Notes
Any other relevant information
```

---

## Review Process

### What We Look For

1. **Functionality**
   - Does it work as intended?
   - Are edge cases handled?
   - Is error handling robust?

2. **Code Quality**
   - Is it readable?
   - Is it maintainable?
   - Is it well-documented?

3. **Security**
   - Are inputs validated?
   - Are secrets protected?
   - Are permissions correct?

4. **User Experience**
   - Are error messages helpful?
   - Is progress indicated?
   - Is feedback clear?

5. **Testing**
   - Are changes tested?
   - Do existing tests pass?
   - Are new tests added?

### Review Timeline

- Initial review: Within 3 days
- Follow-up: Within 2 days of updates
- Merge: After approval from maintainer

---

## Getting Help

### Questions?

- **General Questions:** Open a discussion on GitHub
- **Bug Reports:** Create an issue with details
- **Feature Requests:** Open an issue with proposal
- **Security Issues:** Email maintainer directly

### Resources

- **Bash Guide:** https://mywiki.wooledge.org/BashGuide
- **Shellcheck Wiki:** https://www.shellcheck.net/wiki/
- **Termux Wiki:** https://wiki.termux.com
- **Keep a Changelog:** https://keepachangelog.com

---

## Recognition

Contributors will be:
- Listed in CHANGELOG.md
- Mentioned in release notes
- Added to contributors list
- Thanked in documentation

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

**Thank you for contributing! Your help makes this project better for everyone.** 🎉
