# PDF Guard Plugin

**Prevents the infamous "PDF too large" infinite loop bug in Claude Code.**

## The Problem

When Claude Code attempts to read a PDF with more than 100 pages:

1. The API returns a 400 error: `"A maximum of 100 PDF pages may be provided"`
2. The PDF content is **already embedded** in the conversation context
3. **Every subsequent API call fails** because context contains the oversized PDF
4. Even `/compact` fails since it also makes an API call
5. The only recovery is to **kill the entire session**

This bug has been reported multiple times:
- [#9789](https://github.com/anthropics/claude-code/issues/9789) - PDF too large
- [#6231](https://github.com/anthropics/claude-code/issues/6231) - PDF Upload Exceeds 100-Page Limit
- [#6197](https://github.com/anthropics/claude-code/issues/6197) - Original report

## The Solution

This plugin intercepts `Read` tool calls **before** they execute:

1. Detects PDF file reads
2. Checks file size (quick) and page count (thorough)
3. **Blocks oversized PDFs before they enter the context**
4. Provides clear error messages with recovery options

## Installation

### Option 1: Copy to your hooks directory

```bash
# Create hooks directory if it doesn't exist
mkdir -p ~/.claude/hooks

# Copy the hook
cp hooks/pretooluse.py ~/.claude/hooks/pdf_guard_pretooluse.py
chmod +x ~/.claude/hooks/pdf_guard_pretooluse.py
```

### Option 2: Add to your settings.json

Add this to your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/pdf-guard/hooks/pretooluse.py"
          }
        ]
      }
    ]
  }
}
```

## Configuration

Edit `hooks/pretooluse.py` to adjust limits:

```python
MAX_PDF_PAGES = 100   # API hard limit (don't change)
MAX_PDF_SIZE_MB = 25  # Size limit in MB
WARN_PDF_SIZE_MB = 10 # Warning threshold
```

## How It Works

The hook performs these checks in order:

1. **Tool Check**: Only intercepts `Read` tool calls
2. **Extension Check**: Only checks `.pdf` files
3. **Size Check**: Blocks PDFs > 25MB immediately
4. **Page Count**: Counts pages without loading full content
5. **Decision**:
   - ✅ Allow: < 100 pages and < 25MB
   - ⚠️ Warn: Unknown page count but > 10MB
   - ❌ Block: > 100 pages or > 25MB

## Error Messages

When a PDF is blocked, the user sees helpful alternatives:

```
## PDF Guard: Too Many Pages

**File:** `/path/to/large.pdf`
**Pages:** 250 (API limit: 100 pages)
**Size:** 15.2 MB

### Alternatives:
1. Extract first 100 pages: `pdftk ... cat 1-100 ...`
2. Convert to text: `pdftotext ...`
3. Extract specific range: `pdftk ... cat 50-149 ...`
```

## Dependencies

- Python 3.6+
- No external packages required (uses only stdlib)

## Testing

```bash
# Test with a small PDF (should pass)
echo '{"tool_name": "Read", "tool_input": {"file_path": "small.pdf"}}' | python3 hooks/pretooluse.py

# Test with path to large PDF
echo '{"tool_name": "Read", "tool_input": {"file_path": "/path/to/large.pdf"}}' | python3 hooks/pretooluse.py
```

## License

MIT - Same as Claude Code
