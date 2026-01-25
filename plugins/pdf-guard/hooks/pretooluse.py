#!/usr/bin/env python3
"""
PDF Guard Hook - Prevents the "PDF too large" infinite loop bug.

This hook intercepts Read tool calls for PDF files and validates them
BEFORE they're sent to the API, preventing context poisoning.

Bug Reference: https://github.com/anthropics/claude-code/issues/9789
               https://github.com/anthropics/claude-code/issues/6231
               https://github.com/anthropics/claude-code/issues/6197

The Problem:
- When a PDF exceeds 100 pages, the API returns a 400 error
- The PDF content is already embedded in conversation context
- Every subsequent API call fails because context contains the oversized PDF
- Even /compact fails since it also makes an API call
- User must kill the entire session to recover

The Solution:
- Intercept Read tool calls BEFORE execution
- Check PDF file size and page count
- Block oversized PDFs before they enter the context
- Provide clear error message and recovery options
"""

import json
import os
import sys
from pathlib import Path

# Configuration
MAX_PDF_PAGES = 100  # API limit
MAX_PDF_SIZE_MB = 25  # Reasonable size limit to prevent memory issues
WARN_PDF_SIZE_MB = 10  # Warning threshold


def count_pdf_pages(file_path: str) -> int:
    """
    Count pages in a PDF file without loading full content.
    Uses multiple methods for reliability.
    """
    try:
        with open(file_path, 'rb') as f:
            content = f.read()

        # Method 1: Count /Type /Page entries (most reliable)
        # This counts actual page objects in the PDF
        page_count = content.count(b'/Type /Page') - content.count(b'/Type /Pages')
        if page_count > 0:
            return page_count

        # Method 2: Look for /Count in the page tree
        import re
        count_matches = re.findall(rb'/Count\s+(\d+)', content)
        if count_matches:
            # Usually the largest count is the total page count
            return max(int(c) for c in count_matches)

        # Method 3: Count page references (fallback)
        page_refs = len(re.findall(rb'/Page\b', content))
        if page_refs > 0:
            return max(1, page_refs // 2)  # Rough estimate

        # If we can't determine, assume it's safe but warn
        return -1  # Unknown

    except Exception as e:
        print(f"Warning: Could not count PDF pages: {e}", file=sys.stderr)
        return -1


def get_file_size_mb(file_path: str) -> float:
    """Get file size in megabytes."""
    try:
        return os.path.getsize(file_path) / (1024 * 1024)
    except Exception:
        return 0


def main():
    """Main hook entry point."""
    # Read hook input from stdin
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error parsing hook input: {e}", file=sys.stderr)
        print(json.dumps({}))
        return

    tool_name = input_data.get('tool_name', '')
    tool_input = input_data.get('tool_input', {})

    # Only check Read tool
    if tool_name != 'Read':
        print(json.dumps({}))
        return

    file_path = tool_input.get('file_path', '')

    # Only check PDF files
    if not file_path.lower().endswith('.pdf'):
        print(json.dumps({}))
        return

    # Expand path
    file_path = os.path.expanduser(file_path)

    # Check if file exists
    if not os.path.isfile(file_path):
        print(json.dumps({}))
        return

    # Get file size
    size_mb = get_file_size_mb(file_path)

    # Check file size first (quick check)
    if size_mb > MAX_PDF_SIZE_MB:
        error_msg = f"""## PDF Guard: File Too Large

**File:** `{file_path}`
**Size:** {size_mb:.1f} MB (limit: {MAX_PDF_SIZE_MB} MB)

This PDF is too large and would cause memory issues.

### Alternatives:
1. **Extract specific pages** using a PDF tool
2. **Convert to text** using `pdftotext` or similar
3. **Use a smaller portion** of the document
4. **Ask me to search** for specific content instead

```bash
# Extract pages 1-50:
pdftk "{file_path}" cat 1-50 output smaller.pdf

# Convert to text:
pdftotext "{file_path}" output.txt
```
"""
        result = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny"
            },
            "systemMessage": error_msg
        }
        print(json.dumps(result))
        return

    # Count pages
    page_count = count_pdf_pages(file_path)

    if page_count > MAX_PDF_PAGES:
        error_msg = f"""## PDF Guard: Too Many Pages

**File:** `{file_path}`
**Pages:** {page_count} (API limit: {MAX_PDF_PAGES} pages)
**Size:** {size_mb:.1f} MB

The Anthropic API has a hard limit of 100 PDF pages. Sending this PDF would:
1. Fail with a 400 error
2. Poison the conversation context
3. Cause ALL subsequent requests to fail
4. Require killing the session to recover

### Alternatives:
1. **Extract first 100 pages:**
   ```bash
   pdftk "{file_path}" cat 1-100 output first_100_pages.pdf
   ```

2. **Convert to searchable text:**
   ```bash
   pdftotext "{file_path}" "{file_path}.txt"
   ```

3. **Extract specific page range:**
   ```bash
   pdftk "{file_path}" cat 50-149 output pages_50_to_149.pdf
   ```

4. **Tell me what you're looking for** and I'll suggest the best approach.
"""
        result = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny"
            },
            "systemMessage": error_msg
        }
        print(json.dumps(result))
        return

    # Unknown page count but large file - warn
    if page_count == -1 and size_mb > WARN_PDF_SIZE_MB:
        warn_msg = f"""## PDF Guard: Large PDF Warning

**File:** `{file_path}`
**Size:** {size_mb:.1f} MB

Could not determine page count. If this PDF has more than 100 pages,
it may cause issues. Consider extracting specific pages first.

Proceeding with read..."""
        result = {
            "systemMessage": warn_msg
        }
        print(json.dumps(result))
        return

    # PDF is safe to read
    print(json.dumps({}))


if __name__ == '__main__':
    main()
