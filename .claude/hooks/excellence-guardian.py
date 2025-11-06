#!/usr/bin/env python3
"""
Excellence Guardian Hook

This hook enforces coding excellence by detecting dangerous patterns,
performance anti-patterns, and best practice violations before code is written.
"""

import sys
import json
import re
from typing import Dict, List, Tuple

# Load hook input from stdin
hook_data = json.loads(sys.stdin.read())

tool_name = hook_data.get("tool_name", "")
tool_input = hook_data.get("tool_input", {})
session_id = hook_data.get("session_id", "")

# Only check Write and Edit operations
if tool_name not in ["Write", "Edit", "MultiEdit"]:
    sys.exit(0)

# Get the content being written
if tool_name == "Write":
    content = tool_input.get("content", "")
    file_path = tool_input.get("file_path", "")
elif tool_name == "Edit":
    content = tool_input.get("new_string", "")
    file_path = tool_input.get("file_path", "")
else:
    sys.exit(0)

# Store warnings
warnings: List[Tuple[str, str, str]] = []  # (severity, category, message)

# === SECURITY PATTERNS ===

# SQL Injection Risk
if re.search(r'(SELECT|INSERT|UPDATE|DELETE).*([\+]|f["\']|\$\{)', content, re.IGNORECASE):
    warnings.append((
        "CRITICAL",
        "Security - SQL Injection",
        "⚠️  SECURITY RISK: Potential SQL injection vulnerability detected!\n"
        "   Found SQL query with string concatenation.\n"
        "   ✅ Use parameterized queries instead:\n"
        "      Bad:  query = f\"SELECT * FROM users WHERE id = {user_id}\"\n"
        "      Good: query = \"SELECT * FROM users WHERE id = ?\", [user_id]"
    ))

# eval/exec usage
if re.search(r'\b(eval|exec|Function)\s*\(', content):
    warnings.append((
        "CRITICAL",
        "Security - Code Injection",
        "🚨 SECURITY RISK: Use of eval() or exec() detected!\n"
        "   These functions execute arbitrary code and are extremely dangerous.\n"
        "   ✅ Alternatives:\n"
        "      - Use JSON.parse() for JSON data\n"
        "      - Use specific parsers for your data format\n"
        "      - Avoid dynamic code execution entirely"
    ))

# Hardcoded secrets
if re.search(r'(password|api[_-]?key|secret|token)\s*[=:]\s*["\'][^"\']{8,}["\']', content, re.IGNORECASE):
    if not re.search(r'(process\.env|os\.environ|env\.get)', content):
        warnings.append((
            "CRITICAL",
            "Security - Hardcoded Secrets",
            "🔑 SECURITY RISK: Hardcoded secret detected!\n"
            "   Never commit passwords, API keys, or secrets to code.\n"
            "   ✅ Use environment variables:\n"
            "      Bad:  const apiKey = 'sk_live_abcdef123456'\n"
            "      Good: const apiKey = process.env.API_KEY"
        ))

# Command injection risk
if re.search(r'(exec|spawn|system)\([^)]*(\$\{|`|\+|f["\'])', content):
    warnings.append((
        "CRITICAL",
        "Security - Command Injection",
        "⚠️  SECURITY RISK: Potential command injection vulnerability!\n"
            "   Executing shell commands with user input is dangerous.\n"
        "   ✅ Safer alternatives:\n"
        "      - Use parameterized APIs instead of shell commands\n"
        "      - Validate and sanitize all inputs\n"
        "      - Use shell escaping functions"
    ))

# XSS Risk - innerHTML/dangerouslySetInnerHTML
if re.search(r'(innerHTML|dangerouslySetInnerHTML)', content):
    warnings.append((
        "HIGH",
        "Security - XSS",
        "⚠️  XSS RISK: innerHTML or dangerouslySetInnerHTML detected!\n"
        "   These can lead to cross-site scripting vulnerabilities.\n"
        "   ✅ Safer alternatives:\n"
        "      - Use textContent instead of innerHTML\n"
        "      - Use framework's safe rendering (React, Vue)\n"
        "      - Sanitize HTML with DOMPurify if HTML is necessary"
    ))

# Weak cryptography
if re.search(r'\b(md5|sha1)\s*\(', content, re.IGNORECASE):
    warnings.append((
        "HIGH",
        "Security - Weak Cryptography",
        "🔐 SECURITY WARNING: Weak cryptographic algorithm detected!\n"
        "   MD5 and SHA1 are cryptographically broken for password hashing.\n"
        "   ✅ Use strong alternatives:\n"
        "      - bcrypt for password hashing\n"
        "      - Argon2 (even better for passwords)\n"
        "      - SHA-256 or SHA-3 for general hashing (not passwords!)"
    ))

# === PERFORMANCE PATTERNS ===

# Nested loops
nested_loop_pattern = r'(for|while)\s*\([^)]*\)\s*\{[^}]*(for|while)\s*\([^)]*\)'
if re.search(nested_loop_pattern, content):
    warnings.append((
        "MEDIUM",
        "Performance - Algorithm Complexity",
        "⚡ PERFORMANCE WARNING: Nested loops detected (O(n²) complexity)!\n"
        "   This can be very slow for large datasets.\n"
        "   ✅ Consider alternatives:\n"
        "      - Use a Map/Set for O(1) lookups instead of nested loops\n"
        "      - Use array methods like .filter() or .map() if appropriate\n"
        "      - Consider if you really need nested iteration"
    ))

# SELECT * queries
if re.search(r'SELECT\s+\*\s+FROM', content, re.IGNORECASE):
    warnings.append((
        "MEDIUM",
        "Performance - Database",
        "💾 PERFORMANCE TIP: SELECT * detected!\n"
        "   Fetching all columns wastes bandwidth and memory.\n"
        "   ✅ Best practice:\n"
        "      Bad:  SELECT * FROM users\n"
        "      Good: SELECT id, name, email FROM users"
    ))

# Synchronous file operations
if re.search(r'(readFileSync|writeFileSync|existsSync)', content):
    warnings.append((
        "MEDIUM",
        "Performance - Blocking I/O",
        "⏱️  PERFORMANCE WARNING: Synchronous file operation detected!\n"
        "   Sync operations block the entire event loop.\n"
        "   ✅ Use async alternatives:\n"
        "      Bad:  const data = fs.readFileSync('file.txt')\n"
        "      Good: const data = await fs.promises.readFile('file.txt')"
    ))

# Await in loops
if re.search(r'for\s*\([^)]*\)\s*\{[^}]*\bawait\b', content):
    warnings.append((
        "MEDIUM",
        "Performance - Sequential Async",
        "🔄 PERFORMANCE TIP: await inside loop detected!\n"
        "   This executes requests sequentially, which is slow.\n"
        "   ✅ Consider parallel execution:\n"
        "      Bad:  for (item of items) { await process(item) }\n"
        "      Good: await Promise.all(items.map(item => process(item)))"
    ))

# === CODE QUALITY PATTERNS ===

# Long functions (rough heuristic: > 50 lines between braces)
function_matches = list(re.finditer(r'(function|def)\s+\w+[^{]*\{', content))
for match in function_matches:
    start = match.end()
    # Count lines until closing brace (simplified)
    remaining = content[start:]
    lines_in_function = remaining[:1000].count('\n')  # Check first 1000 chars
    if lines_in_function > 50:
        warnings.append((
            "LOW",
            "Code Quality - Function Length",
            "📏 CODE QUALITY TIP: Very long function detected (>50 lines)!\n"
            "   Long functions are hard to understand and maintain.\n"
            "   ✅ Consider:\n"
            "      - Break into smaller, single-purpose functions\n"
            "      - Extract helper functions\n"
            "      - Follow Single Responsibility Principle"
        ))
        break  # Only warn once

# console.log in production code (excluding test files)
if not any(test in file_path.lower() for test in ['test', 'spec', '__tests__']):
    if re.search(r'\bconsole\.(log|debug)\(', content):
        warnings.append((
            "LOW",
            "Code Quality - Debugging Code",
            "🐛 CODE QUALITY TIP: console.log() detected!\n"
            "   Debug logs should be removed before committing.\n"
            "   ✅ Alternatives:\n"
            "      - Use proper logging library (winston, pino)\n"
            "      - Remove debug statements\n"
            "      - Use debugger or IDE debugging tools"
        ))

# No error handling around async/await
if re.search(r'\bawait\b', content):
    if not re.search(r'(try\s*\{|catch\s*\()', content):
        warnings.append((
            "MEDIUM",
            "Code Quality - Error Handling",
            "❗ ERROR HANDLING: await without try/catch detected!\n"
            "   Unhandled promise rejections can crash your application.\n"
            "   ✅ Always handle errors:\n"
            "      try {\n"
            "        await asyncOperation()\n"
            "      } catch (error) {\n"
            "        // Handle error appropriately\n"
            "      }"
        ))

# Magic numbers (numbers > 1 not in constants)
if re.search(r'=\s*[2-9]\d+\b(?!.*const)', content):
    warnings.append((
        "LOW",
        "Code Quality - Magic Numbers",
        "🔢 CODE QUALITY TIP: Magic numbers detected!\n"
        "   Unexplained numbers make code hard to understand.\n"
        "   ✅ Use named constants:\n"
        "      Bad:  if (age > 18)\n"
        "      Good: const LEGAL_AGE = 18; if (age > LEGAL_AGE)"
    ))

# === OUTPUT WARNINGS ===

if warnings:
    print("\n" + "="*70, file=sys.stderr)
    print("🛡️  EXCELLENCE GUARDIAN - Code Quality Analysis", file=sys.stderr)
    print("="*70, file=sys.stderr)

    # Group by severity
    critical = [w for w in warnings if w[0] == "CRITICAL"]
    high = [w for w in warnings if w[0] == "HIGH"]
    medium = [w for w in warnings if w[0] == "MEDIUM"]
    low = [w for w in warnings if w[0] == "LOW"]

    print(f"\nAnalyzing: {file_path}", file=sys.stderr)
    print(f"Found {len(warnings)} potential issues:", file=sys.stderr)
    print(f"  🚨 Critical: {len(critical)}", file=sys.stderr)
    print(f"  ⚠️  High: {len(high)}", file=sys.stderr)
    print(f"  ⚡ Medium: {len(medium)}", file=sys.stderr)
    print(f"  💡 Low: {len(low)}", file=sys.stderr)
    print("", file=sys.stderr)

    # Print all warnings
    for severity, category, message in warnings:
        print(f"[{severity}] {category}", file=sys.stderr)
        print(message, file=sys.stderr)
        print("", file=sys.stderr)

    print("="*70, file=sys.stderr)
    print("These are suggestions to help you write excellent code.", file=sys.stderr)
    print("Review each warning and address if applicable.", file=sys.stderr)
    print("For security issues, strongly consider fixing them!", file=sys.stderr)
    print("="*70, file=sys.stderr)
    print("", file=sys.stderr)

    # Block if critical security issues
    if critical:
        print("🚨 CRITICAL SECURITY ISSUES DETECTED!", file=sys.stderr)
        print("These must be addressed before proceeding.", file=sys.stderr)
        print("", file=sys.stderr)
        # Exit code 1 shows warning but doesn't block
        # Exit code 2 blocks execution
        sys.exit(1)  # Show warning but allow to proceed (Claude can override)

    # For non-critical, just warn (exit 1)
    sys.exit(1)

# No issues found - allow execution
sys.exit(0)
