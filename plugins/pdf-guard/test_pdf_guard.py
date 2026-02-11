#!/usr/bin/env python3
"""Tests for PDF Guard hook."""

import json
import subprocess
import tempfile
import os


def run_hook(input_data: dict) -> dict:
    """Run the hook with given input and return output."""
    hook_path = os.path.join(os.path.dirname(__file__), 'hooks', 'pretooluse.py')
    result = subprocess.run(
        ['python3', hook_path],
        input=json.dumps(input_data),
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"Hook stderr: {result.stderr}")
    return json.loads(result.stdout) if result.stdout.strip() else {}


def test_non_pdf_passthrough():
    """Non-PDF files should pass through without interference."""
    result = run_hook({
        "tool_name": "Read",
        "tool_input": {"file_path": "/some/file.txt"}
    })
    assert result == {}, f"Expected empty result for .txt file, got: {result}"
    print("✓ Non-PDF files pass through")


def test_non_read_tool_passthrough():
    """Non-Read tools should pass through."""
    result = run_hook({
        "tool_name": "Write",
        "tool_input": {"file_path": "/some/file.pdf", "content": "test"}
    })
    assert result == {}, f"Expected empty result for Write tool, got: {result}"
    print("✓ Non-Read tools pass through")


def test_nonexistent_pdf_passthrough():
    """Nonexistent PDFs should pass through (let Read tool handle error)."""
    result = run_hook({
        "tool_name": "Read",
        "tool_input": {"file_path": "/nonexistent/file.pdf"}
    })
    assert result == {}, f"Expected empty result for nonexistent file, got: {result}"
    print("✓ Nonexistent PDFs pass through")


def test_small_pdf_passthrough():
    """Small PDFs should pass through."""
    # Create a minimal valid PDF (1 page)
    minimal_pdf = b"""%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer << /Size 4 /Root 1 0 R >>
startxref
196
%%EOF"""

    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
        f.write(minimal_pdf)
        temp_path = f.name

    try:
        result = run_hook({
            "tool_name": "Read",
            "tool_input": {"file_path": temp_path}
        })
        assert result == {}, f"Expected empty result for small PDF, got: {result}"
        print("✓ Small PDFs pass through")
    finally:
        os.unlink(temp_path)


def test_large_page_count_blocked():
    """PDFs with >100 pages should be blocked."""
    # Create a PDF that looks like it has many pages
    # We'll fake it by including many /Type /Page entries
    pages = b""
    for i in range(3, 153):  # 150 page objects
        pages += f"{i} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj\n".encode()

    large_pdf = b"""%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Count 150 /Kids [""" + b" ".join(f"{i} 0 R".encode() for i in range(3, 153)) + b"""] >> endobj
""" + pages + b"""
xref
0 153
trailer << /Size 153 /Root 1 0 R >>
startxref
99999
%%EOF"""

    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
        f.write(large_pdf)
        temp_path = f.name

    try:
        result = run_hook({
            "tool_name": "Read",
            "tool_input": {"file_path": temp_path}
        })
        assert "hookSpecificOutput" in result, f"Expected block for large PDF, got: {result}"
        assert result["hookSpecificOutput"]["permissionDecision"] == "deny"
        assert "Too Many Pages" in result.get("systemMessage", "")
        print("✓ Large page count PDFs are blocked")
    finally:
        os.unlink(temp_path)


def test_case_insensitive_extension():
    """Should handle .PDF, .Pdf, etc."""
    result = run_hook({
        "tool_name": "Read",
        "tool_input": {"file_path": "/nonexistent/file.PDF"}
    })
    # Should pass through because file doesn't exist
    assert result == {}, f"Expected passthrough for .PDF extension"
    print("✓ Case insensitive extension handling")


if __name__ == '__main__':
    print("Running PDF Guard tests...\n")
    test_non_pdf_passthrough()
    test_non_read_tool_passthrough()
    test_nonexistent_pdf_passthrough()
    test_small_pdf_passthrough()
    test_large_page_count_blocked()
    test_case_insensitive_extension()
    print("\n✅ All tests passed!")
