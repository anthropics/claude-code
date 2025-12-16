#!/usr/bin/env python3
"""
Tests for the fix_file_permissions_example.py hook.

Run these tests with:
    python3 examples/hooks/test_fix_file_permissions.py

Or with pytest:
    pytest examples/hooks/test_fix_file_permissions.py -v
"""

import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

# Path to the hook script
HOOK_SCRIPT = Path(__file__).parent / "fix_file_permissions_example.py"


class TestFixFilePermissionsHook(unittest.TestCase):
    """Test cases for the file permissions fix hook."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.test_file = os.path.join(self.temp_dir, "test_file.txt")

    def tearDown(self):
        """Clean up test files."""
        if os.path.exists(self.test_file):
            os.remove(self.test_file)
        if os.path.exists(self.temp_dir):
            os.rmdir(self.temp_dir)

    def run_hook(self, tool_name: str, file_path: str) -> subprocess.CompletedProcess:
        """Run the hook script with given input."""
        input_data = {
            "tool_name": tool_name,
            "tool_input": {"file_path": file_path},
            "session_id": "test-session",
            "cwd": os.getcwd(),
        }

        result = subprocess.run(
            [sys.executable, str(HOOK_SCRIPT)],
            input=json.dumps(input_data),
            capture_output=True,
            text=True,
        )
        return result

    def create_file_with_permissions(self, path: str, mode: int) -> None:
        """Create a test file with specific permissions."""
        with open(path, "w") as f:
            f.write("test content")
        os.chmod(path, mode)

    def get_file_permissions(self, path: str) -> int:
        """Get the permission bits of a file."""
        return stat.S_IMODE(os.stat(path).st_mode)

    def test_fixes_restrictive_permissions_with_umask_022(self):
        """Test that 0600 permissions are fixed to 0644 with umask 022."""
        # Save and set umask
        old_umask = os.umask(0o022)
        try:
            # Create file with restrictive permissions (simulating Write tool bug)
            self.create_file_with_permissions(self.test_file, 0o600)
            self.assertEqual(self.get_file_permissions(self.test_file), 0o600)

            # Run the hook
            result = self.run_hook("Write", self.test_file)
            self.assertEqual(result.returncode, 0)

            # Check permissions were fixed
            expected_mode = 0o644  # 0666 & ~0022
            self.assertEqual(
                self.get_file_permissions(self.test_file),
                expected_mode,
                f"Expected {oct(expected_mode)}, got {oct(self.get_file_permissions(self.test_file))}",
            )
        finally:
            os.umask(old_umask)

    def test_fixes_restrictive_permissions_with_umask_002(self):
        """Test that 0600 permissions are fixed to 0664 with umask 002."""
        # Save and set umask
        old_umask = os.umask(0o002)
        try:
            # Create file with restrictive permissions
            self.create_file_with_permissions(self.test_file, 0o600)
            self.assertEqual(self.get_file_permissions(self.test_file), 0o600)

            # Run the hook
            result = self.run_hook("Write", self.test_file)
            self.assertEqual(result.returncode, 0)

            # Check permissions were fixed
            expected_mode = 0o664  # 0666 & ~0002
            self.assertEqual(
                self.get_file_permissions(self.test_file),
                expected_mode,
                f"Expected {oct(expected_mode)}, got {oct(self.get_file_permissions(self.test_file))}",
            )
        finally:
            os.umask(old_umask)

    def test_preserves_permissions_matching_umask(self):
        """Test that permissions already matching umask are not changed."""
        old_umask = os.umask(0o022)
        try:
            # Create file with correct permissions already
            self.create_file_with_permissions(self.test_file, 0o644)

            # Run the hook
            result = self.run_hook("Write", self.test_file)
            self.assertEqual(result.returncode, 0)

            # Permissions should be unchanged
            self.assertEqual(self.get_file_permissions(self.test_file), 0o644)
        finally:
            os.umask(old_umask)

    def test_respects_umask_077(self):
        """Test that umask 077 results in 0600 (no change needed)."""
        old_umask = os.umask(0o077)
        try:
            # Create file with 0600 permissions
            self.create_file_with_permissions(self.test_file, 0o600)

            # Run the hook
            result = self.run_hook("Write", self.test_file)
            self.assertEqual(result.returncode, 0)

            # With umask 077, 0600 is correct - should remain unchanged
            self.assertEqual(self.get_file_permissions(self.test_file), 0o600)
        finally:
            os.umask(old_umask)

    def test_handles_edit_tool(self):
        """Test that the hook also works for the Edit tool."""
        old_umask = os.umask(0o022)
        try:
            self.create_file_with_permissions(self.test_file, 0o600)

            result = self.run_hook("Edit", self.test_file)
            self.assertEqual(result.returncode, 0)

            self.assertEqual(self.get_file_permissions(self.test_file), 0o644)
        finally:
            os.umask(old_umask)

    def test_ignores_other_tools(self):
        """Test that the hook ignores non-Write/Edit tools."""
        old_umask = os.umask(0o022)
        try:
            self.create_file_with_permissions(self.test_file, 0o600)

            result = self.run_hook("Read", self.test_file)
            self.assertEqual(result.returncode, 0)

            # Permissions should be unchanged for Read tool
            self.assertEqual(self.get_file_permissions(self.test_file), 0o600)
        finally:
            os.umask(old_umask)

    def test_handles_nonexistent_file(self):
        """Test that the hook handles non-existent files gracefully."""
        result = self.run_hook("Write", "/nonexistent/path/file.txt")
        self.assertEqual(result.returncode, 0)

    def test_handles_empty_file_path(self):
        """Test that the hook handles empty file path gracefully."""
        input_data = {
            "tool_name": "Write",
            "tool_input": {},
            "session_id": "test-session",
        }

        result = subprocess.run(
            [sys.executable, str(HOOK_SCRIPT)],
            input=json.dumps(input_data),
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0)

    def test_handles_invalid_json(self):
        """Test that the hook handles invalid JSON input gracefully."""
        result = subprocess.run(
            [sys.executable, str(HOOK_SCRIPT)],
            input="not valid json",
            capture_output=True,
            text=True,
        )
        # Should exit 0 even with invalid input (don't block the workflow)
        self.assertEqual(result.returncode, 0)
        self.assertIn("Invalid JSON", result.stderr)

    def test_handles_directory_path(self):
        """Test that the hook ignores directory paths."""
        result = self.run_hook("Write", self.temp_dir)
        self.assertEqual(result.returncode, 0)

    def test_outputs_system_message_on_fix(self):
        """Test that the hook outputs a systemMessage when fixing permissions."""
        old_umask = os.umask(0o022)
        try:
            self.create_file_with_permissions(self.test_file, 0o600)

            result = self.run_hook("Write", self.test_file)
            self.assertEqual(result.returncode, 0)

            # Check that stdout contains the systemMessage JSON
            if result.stdout.strip():
                output = json.loads(result.stdout)
                self.assertIn("systemMessage", output)
                self.assertIn("Fixed file permissions", output["systemMessage"])
        finally:
            os.umask(old_umask)


class TestCalculateFilePermissions(unittest.TestCase):
    """Test the calculate_file_permissions function directly."""

    def test_umask_022(self):
        """Test permission calculation with umask 022."""
        # Import the function from the hook script
        import importlib.util

        spec = importlib.util.spec_from_file_location("hook", HOOK_SCRIPT)
        hook = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(hook)

        result = hook.calculate_file_permissions(0o022)
        self.assertEqual(result, 0o644)

    def test_umask_002(self):
        """Test permission calculation with umask 002."""
        import importlib.util

        spec = importlib.util.spec_from_file_location("hook", HOOK_SCRIPT)
        hook = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(hook)

        result = hook.calculate_file_permissions(0o002)
        self.assertEqual(result, 0o664)

    def test_umask_077(self):
        """Test permission calculation with umask 077."""
        import importlib.util

        spec = importlib.util.spec_from_file_location("hook", HOOK_SCRIPT)
        hook = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(hook)

        result = hook.calculate_file_permissions(0o077)
        self.assertEqual(result, 0o600)

    def test_umask_000(self):
        """Test permission calculation with umask 000."""
        import importlib.util

        spec = importlib.util.spec_from_file_location("hook", HOOK_SCRIPT)
        hook = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(hook)

        result = hook.calculate_file_permissions(0o000)
        self.assertEqual(result, 0o666)


if __name__ == "__main__":
    unittest.main()
