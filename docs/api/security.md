# Security API Documentation

The Security API provides security-related functionality for the Claude Neural Framework.

## SecurityReview

`SecurityReview` is the main class for security review and validation.

```javascript
const { SecurityReview } = require('../core/security/security_review');
```

### Methods

#### `constructor(options)`

Creates a new security review instance.

```javascript
const securityReview = new SecurityReview({
  autoFix: false,
  strictMode: true,
  reportPath: './security-report.json'
});
```

Parameters:
- `options` (Object, optional):
  - `autoFix` (boolean): Whether to automatically fix issues (default: false)
  - `strictMode` (boolean): Whether to use strict validation (default: true)
  - `reportPath` (string): Path to save the report (default: './security-report.json')

#### `registerValidator(name, validator)`

Registers a security validator.

```javascript
securityReview.registerValidator('custom-validator', async (context) => {
  // Validation logic
  return {
    findings: [],
    vulnerabilities: []
  };
});
```

Parameters:
- `name` (string): Validator name
- `validator` (Function): Validator function

Returns:
- (boolean): Success

#### `unregisterValidator(name)`

Unregisters a security validator.

```javascript
securityReview.unregisterValidator('custom-validator');
```

Parameters:
- `name` (string): Validator name

Returns:
- (boolean): Success

#### `async runValidators(context)`

Runs all registered security validators.

```javascript
const report = await securityReview.runValidators({
  targetDir: '/path/to/project',
  targetFiles: ['file1.js', 'file2.js'],
  excludePatterns: ['node_modules', 'dist']
});
```

Parameters:
- `context` (Object, optional): Context data for validation

Returns:
- (Promise<Object>): Validation results with:
  - `id` (string): Report ID
  - `timestamp` (string): Report timestamp
  - `framework` (Object): Framework information
  - `summary` (Object): Summary of findings
  - `findings` (Array): Detailed findings
  - `vulnerabilities` (Array): Detailed vulnerabilities
  - `recommendations` (Array): Recommendations

#### `addFinding(finding)`

Adds a finding to the security review.

```javascript
securityReview.addFinding({
  validator: 'api-key-exposure',
  type: 'api-key',
  title: 'Potential API Key in Code',
  description: 'Potential API key found in code. Use environment variables instead.',
  location: 'path/to/file.js:42'
});
```

Parameters:
- `finding` (Object): Finding details with:
  - `validator` (string): Validator name
  - `type` (string): Finding type
  - `title` (string): Finding title
  - `description` (string): Finding description
  - `location` (string): File location
  - `id` (string, optional): Finding ID (generated if not provided)
  - `timestamp` (string, optional): Finding timestamp (generated if not provided)

#### `addVulnerability(vulnerability)`

Adds a vulnerability to the security review.

```javascript
securityReview.addVulnerability({
  validator: 'config-constraints',
  type: 'configuration',
  title: 'Insecure Configuration Setting',
  description: 'A security-critical configuration setting is set to an insecure value.',
  severity: 'high',
  location: 'core/config/security_constraints.json',
  setting: 'network.allowed',
  currentValue: true,
  recommendedValue: false,
  recommendation: 'Disable unrestricted network access in security constraints.'
});
```

Parameters:
- `vulnerability` (Object): Vulnerability details with:
  - `validator` (string): Validator name
  - `type` (string): Vulnerability type
  - `title` (string): Vulnerability title
  - `description` (string): Vulnerability description
  - `severity` (string): Severity level ('critical', 'high', 'medium', 'low')
  - `location` (string): File location
  - `recommendation` (string): Recommended fix
  - `id` (string, optional): Vulnerability ID (generated if not provided)
  - `timestamp` (string, optional): Vulnerability timestamp (generated if not provided)

## SecureAPI

`SecureAPI` is a base class for implementing secure APIs.

```javascript
const { SecureAPI } = require('../core/security/secure_api');
```

### Methods

#### `constructor(options)`

Creates a new secure API instance.

```javascript
const secureApi = new SecureAPI({
  rateLimitRequests: 100,
  rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
  sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
  requireHTTPS: true,
  csrfProtection: true,
  secureHeaders: true,
  inputValidation: true
});
```

Parameters:
- `options` (Object, optional):
  - `rateLimitRequests` (number): Rate limit requests per window
  - `rateLimitWindowMs` (number): Rate limit window in milliseconds
  - `sessionTimeoutMs` (number): Session timeout in milliseconds
  - `requireHTTPS` (boolean): Whether to require HTTPS
  - `csrfProtection` (boolean): Whether to enable CSRF protection
  - `secureHeaders` (boolean): Whether to set secure headers
  - `inputValidation` (boolean): Whether to validate input

#### `secureHandler(handler)`

Applies security middleware to a request handler.

```javascript
const secureHandler = secureApi.secureHandler(async (req, res) => {
  // Handler logic
  res.json({ success: true });
});

// Use with Express
app.post('/api/endpoint', secureHandler);
```

Parameters:
- `handler` (Function): Request handler function

Returns:
- (Function): Secured request handler

#### `async generateSecureToken(bytes)`

Generates a secure random token.

```javascript
const token = await secureApi.generateSecureToken(32);
```

Parameters:
- `bytes` (number, optional): Number of random bytes (default: 32)

Returns:
- (Promise<string>): Random token

#### `async hashPassword(password, salt)`

Hashes a password securely.

```javascript
const { hash, salt } = await secureApi.hashPassword('password123');
```

Parameters:
- `password` (string): Password to hash
- `salt` (string, optional): Salt (generated if not provided)

Returns:
- (Promise<Object>): Object with:
  - `hash` (string): Password hash
  - `salt` (string): Salt used for hashing

#### `async verifyPassword(password, hash, salt)`

Verifies a password against a hash.

```javascript
const isValid = await secureApi.verifyPassword('password123', hash, salt);
```

Parameters:
- `password` (string): Password to verify
- `hash` (string): Stored password hash
- `salt` (string): Salt used for hashing

Returns:
- (Promise<boolean>): `true` if password matches, `false` otherwise

## Security Error Types

The framework provides several security-related error types.

```javascript
const { 
  SecurityError, 
  SecurityViolationError, 
  SecurityConfigError 
} = require('../core/security/security_review');
```

### SecurityError

Base error class for security-related errors.

```javascript
throw new SecurityError('Security error occurred', {
  code: 'ERR_SECURITY',
  component: 'security',
  status: 403,
  metadata: { key: 'value' }
});
```

### SecurityViolationError

Error for security violations.

```javascript
throw new SecurityViolationError('Security violation detected', {
  code: 'ERR_SECURITY_VIOLATION',
  status: 403,
  metadata: { violation: 'unauthorized-access' }
});
```

### SecurityConfigError

Error for security configuration issues.

```javascript
throw new SecurityConfigError('Invalid security configuration', {
  code: 'ERR_SECURITY_CONFIG',
  status: 500,
  metadata: { config: 'security.json' }
});
```

## Security Utilities

Utility functions for security operations.

### Security Constraints

```javascript
const securityConstraints = require('../core/config/security_constraints.json');
```

The security constraints file defines the security boundaries and constraints for the framework:

```javascript
// Example security constraints
{
  "execution": {
    "confirmation_required": true,
    "allowed_commands": ["git", "npm", "node", "python", "docker"],
    "blocked_commands": ["rm -rf /", "sudo", "chmod 777"]
  },
  "filesystem": {
    "read": {
      "allowed": true,
      "paths": ["./", "../", "~/.claude/"]
    },
    "write": {
      "allowed": true,
      "confirmation_required": true,
      "paths": ["./", "./src/", "./docs/"]
    }
  },
  "network": {
    "allowed": true,
    "restricted_domains": ["localhost"]
  }
}
```

### Security Check CLI

The framework includes a security check CLI tool:

```bash
node core/security/security_check.js --output security-report.json
```

Options:
- `--dir <directory>`: Target directory to check
- `--files <file-list>`: Comma-separated list of specific files to check
- `--exclude <pattern-list>`: Comma-separated list of patterns to exclude
- `--output <file>`: Output report file path
- `--autofix`: Automatically fix simple issues
- `--relaxed`: Relaxed mode (exit with success even with findings)
- `--verbose`: Show detailed information