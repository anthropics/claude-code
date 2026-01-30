# Enhanced Security Guidance Plugin

This plugin provides enhanced security warnings and guidance when editing files in Claude Code. It helps developers identify and avoid common security vulnerabilities before they become issues.

## Features

### 🔒 **Comprehensive Security Pattern Detection**
- **Command Injection**: Detects unsafe use of `exec()`, `os.system()`, and shell commands
- **Code Injection**: Identifies `eval()`, `new Function()`, and dynamic code execution
- **XSS Vulnerabilities**: Warns about `dangerouslySetInnerHTML`, `innerHTML`, and `document.write()`
- **SQL Injection**: Detects unsafe SQL query construction
- **Path Traversal**: Identifies potential directory traversal vulnerabilities
- **Hardcoded Secrets**: Warns about hardcoded passwords, API keys, and tokens
- **GitHub Actions**: Specialized warnings for workflow security issues
- **Deserialization**: Warns about unsafe pickle usage

### 🚀 **Performance Optimizations**
- **Content Truncation**: Limits content analysis to 10KB for performance
- **Regex Compilation**: Pre-compiles regex patterns for faster matching
- **Efficient State Management**: Optimized session state tracking
- **Smart Cleanup**: Automatic cleanup of old state files

### 🛡️ **Enhanced Error Handling**
- **Graceful Degradation**: Continues operation even if errors occur
- **Comprehensive Logging**: Detailed debug logging for troubleshooting
- **Type Safety**: Full type hints for better code maintainability
- **Exception Handling**: Robust error handling throughout the codebase

### 📊 **Improved User Experience**
- **Severity Levels**: Critical, High, Medium severity classifications
- **Better Formatting**: Enhanced warning messages with code examples
- **Session Management**: Prevents duplicate warnings within the same session
- **Configurable**: Environment variable controls for enabling/disabling

## Security Patterns Detected

### Critical Severity
- **eval() Usage**: Arbitrary code execution vulnerabilities
- **Pickle Deserialization**: Code execution through malicious pickle files

### High Severity
- **Command Injection**: Shell injection through exec() and os.system()
- **Code Injection**: Dynamic code execution through new Function()
- **XSS Vulnerabilities**: Cross-site scripting through innerHTML and dangerouslySetInnerHTML
- **SQL Injection**: Database injection through string concatenation
- **Path Traversal**: Directory traversal vulnerabilities
- **GitHub Actions**: Workflow injection vulnerabilities

### Medium Severity
- **Hardcoded Secrets**: Passwords, API keys, and tokens in code
- **document.write()**: XSS and performance issues

## Configuration

### Environment Variables
- `ENABLE_SECURITY_REMINDER`: Set to "0" to disable security warnings (default: "1")

### State Management
- Session-specific warning tracking prevents duplicate alerts
- Automatic cleanup of state files older than 30 days
- State files stored in `~/.claude/security_warnings_state_{session_id}.json`

## Usage Examples

### Command Injection Warning
```javascript
// This will trigger a warning:
exec(`command ${userInput}`)

// Safe alternative:
import { execFileNoThrow } from '../utils/execFileNoThrow.js'
await execFileNoThrow('command', [userInput])
```

### XSS Prevention
```javascript
// This will trigger a warning:
element.innerHTML = userContent

// Safe alternative:
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userContent);
```

### SQL Injection Prevention
```python
# This will trigger a warning:
cursor.execute("SELECT * FROM users WHERE id = " + user_id)

# Safe alternative:
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
```

## Technical Details

### Architecture
- **SecurityPattern Class**: Object-oriented pattern definition with compiled regexes
- **Type Hints**: Full type annotations for better IDE support and maintainability
- **Performance**: Optimized for large codebases with content truncation
- **Extensibility**: Easy to add new security patterns

### Performance Characteristics
- **Content Analysis**: Limited to 10KB per file for performance
- **Regex Matching**: Pre-compiled patterns for faster execution
- **State Persistence**: Efficient JSON-based session tracking
- **Memory Usage**: Minimal memory footprint with cleanup routines

### Error Handling
- **Graceful Degradation**: Continues operation even with errors
- **Debug Logging**: Comprehensive logging to `/tmp/security-warnings-log.txt`
- **Exception Safety**: All operations wrapped in try-catch blocks
- **Input Validation**: Robust input validation and sanitization

## Contributing

### Adding New Security Patterns
1. Create a new `SecurityPattern` instance in `SECURITY_PATTERNS`
2. Define appropriate severity level
3. Add regex patterns for complex matching
4. Provide clear, actionable warning messages
5. Include code examples for safe alternatives

### Testing
- Test with various file types and content sizes
- Verify performance with large files
- Test error handling scenarios
- Validate state management functionality

## Changelog

### Enhanced Version (Current)
- ✅ Added comprehensive security pattern detection
- ✅ Implemented performance optimizations
- ✅ Enhanced error handling and logging
- ✅ Added type hints and better code structure
- ✅ Improved warning messages with code examples
- ✅ Added severity classification system
- ✅ Implemented efficient state management
- ✅ Added automatic cleanup functionality

### Original Version
- Basic security pattern detection
- Simple substring matching
- Basic state management
- Limited error handling

## License

This plugin is part of the Claude Code project and follows the same licensing terms.
