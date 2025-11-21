#!/usr/bin/env python3
"""
Auto Formatter Hook for Claude Code
====================================
This PostToolUse hook automatically formats code files after they are written or edited.
It detects the file type and runs the appropriate formatter if available.

Supported formatters:
- prettier: JavaScript, TypeScript, JSON, CSS, HTML, Markdown, YAML
- black: Python
- gofmt: Go
- rustfmt: Rust
- clang-format: C, C++, Java
- rubocop: Ruby (with --autocorrect-all)
- mix format: Elixir
- terraform fmt: Terraform

Read more about hooks: https://code.claude.com/docs/en/hooks
"""

import json
import os
import subprocess
import sys
from pathlib import Path

# Debug mode - set to True to enable logging
DEBUG = os.environ.get("AUTO_FORMAT_DEBUG", "0") == "1"
DEBUG_LOG_FILE = "/tmp/auto-format-hook.log"


def debug_log(message):
	"""Log debug messages if DEBUG is enabled."""
	if DEBUG:
		try:
			with open(DEBUG_LOG_FILE, "a") as f:
				f.write(f"{message}\n")
		except Exception:
			pass


# File extension to formatter mapping
FORMATTERS = {
	# Prettier - JavaScript/TypeScript ecosystem
	"js": {"cmd": ["prettier", "--write"], "check": "prettier"},
	"jsx": {"cmd": ["prettier", "--write"], "check": "prettier"},
	"ts": {"cmd": ["prettier", "--write"], "check": "prettier"},
	"tsx": {"cmd": ["prettier", "--write"], "check": "prettier"},
	"json": {"cmd": ["prettier", "--write"], "check": "prettier"},
	"css": {"cmd": ["prettier", "--write"], "check": "prettier"},
	"scss": {"cmd": ["prettier", "--write"], "check": "prettier"},
	"less": {"cmd": ["prettier", "--write"], "check": "prettier"},
	"html": {"cmd": ["prettier", "--write"], "check": "prettier"},
	"vue": {"cmd": ["prettier", "--write"], "check": "prettier"},
	"md": {"cmd": ["prettier", "--write"], "check": "prettier"},
	"yaml": {"cmd": ["prettier", "--write"], "check": "prettier"},
	"yml": {"cmd": ["prettier", "--write"], "check": "prettier"},
	# Python
	"py": {"cmd": ["black", "--quiet"], "check": "black"},
	# Go
	"go": {"cmd": ["gofmt", "-w"], "check": "gofmt"},
	# Rust
	"rs": {"cmd": ["rustfmt"], "check": "rustfmt"},
	# C/C++
	"c": {"cmd": ["clang-format", "-i"], "check": "clang-format"},
	"cpp": {"cmd": ["clang-format", "-i"], "check": "clang-format"},
	"cc": {"cmd": ["clang-format", "-i"], "check": "clang-format"},
	"cxx": {"cmd": ["clang-format", "-i"], "check": "clang-format"},
	"h": {"cmd": ["clang-format", "-i"], "check": "clang-format"},
	"hpp": {"cmd": ["clang-format", "-i"], "check": "clang-format"},
	# Java
	"java": {"cmd": ["clang-format", "-i"], "check": "clang-format"},
	# Ruby
	"rb": {"cmd": ["rubocop", "--autocorrect-all", "--silent"], "check": "rubocop"},
	# Elixir
	"ex": {"cmd": ["mix", "format"], "check": "mix"},
	"exs": {"cmd": ["mix", "format"], "check": "mix"},
	# Terraform
	"tf": {"cmd": ["terraform", "fmt"], "check": "terraform"},
}


def find_formatter(formatter_name, project_dir):
	"""
	Find formatter command, checking multiple locations:
	1. Local node_modules (via npx)
	2. Global installation (via which)

	Returns the command array to use, or None if not found.
	"""
	# For Node.js formatters, try npx first (finds local node_modules)
	if formatter_name in ["prettier", "eslint"]:
		try:
			# Check if npx can find the formatter
			result = subprocess.run(
				["npx", "--no-install", formatter_name, "--version"],
				capture_output=True,
				text=True,
				timeout=2,
				cwd=project_dir,
			)
			if result.returncode == 0:
				debug_log(f"Found '{formatter_name}' via npx (local or global)")
				return ["npx", "--no-install", formatter_name]
		except (subprocess.TimeoutExpired, FileNotFoundError):
			debug_log(f"npx not available or '{formatter_name}' not found via npx")

	# Try global installation via which
	try:
		result = subprocess.run(
			["which", formatter_name],
			capture_output=True,
			text=True,
			timeout=1,
		)
		if result.returncode == 0:
			debug_log(f"Found '{formatter_name}' in PATH")
			return [formatter_name]
	except (subprocess.TimeoutExpired, FileNotFoundError):
		debug_log(f"Formatter '{formatter_name}' not found in PATH")

	debug_log(f"Formatter '{formatter_name}' not available")
	return None


def get_file_extension(file_path):
	"""Extract file extension from path."""
	return Path(file_path).suffix.lstrip(".")


def format_file(file_path, project_dir):
	"""
	Format a file based on its extension.
	Automatically finds and uses the appropriate formatter.
	Returns True if formatting was successful, False otherwise.
	"""
	# Check if file exists
	if not os.path.exists(file_path):
		debug_log(f"File does not exist: {file_path}")
		return False

	# Get file extension
	ext = get_file_extension(file_path)
	debug_log(f"File extension: {ext}")

	# Check if we have a formatter for this extension
	if ext not in FORMATTERS:
		debug_log(f"No formatter configured for extension: {ext}")
		return False

	formatter_config = FORMATTERS[ext]
	formatter_name = formatter_config["check"]
	formatter_args = formatter_config["cmd"][1:]  # Get args without command name

	# Find the formatter
	formatter_cmd = find_formatter(formatter_name, project_dir)
	if formatter_cmd is None:
		debug_log(f"Formatter '{formatter_name}' not found")
		return False

	# Build full command
	full_cmd = formatter_cmd + formatter_args + [file_path]

	# Run formatter
	try:
		debug_log(f"Running formatter: {' '.join(full_cmd)}")
		result = subprocess.run(
			full_cmd,
			capture_output=True,
			text=True,
			timeout=30,
			cwd=project_dir,
		)

		if result.returncode == 0:
			debug_log(f"Successfully formatted: {file_path}")
			if result.stdout:
				debug_log(f"stdout: {result.stdout}")
			return True
		else:
			debug_log(f"Formatter failed with code {result.returncode}")
			if result.stderr:
				debug_log(f"stderr: {result.stderr}")
			if result.stdout:
				debug_log(f"stdout: {result.stdout}")
			# Don't fail the hook even if formatting fails
			return False

	except subprocess.TimeoutExpired:
		debug_log(f"Formatter timed out for: {file_path}")
		return False
	except Exception as e:
		debug_log(f"Error running formatter: {e}")
		return False


def main():
	"""Main hook function."""
	debug_log("=== Auto Formatter Hook Started ===")

	# Check if auto-formatting is enabled
	if os.environ.get("AUTO_FORMAT_ENABLED", "1") == "0":
		debug_log("Auto-formatting is disabled via AUTO_FORMAT_ENABLED=0")
		sys.exit(0)

	# Read input from stdin
	try:
		raw_input = sys.stdin.read()
		input_data = json.loads(raw_input)
		debug_log(f"Received input: {json.dumps(input_data, indent=2)}")
	except json.JSONDecodeError as e:
		debug_log(f"JSON decode error: {e}")
		sys.exit(0)  # Allow tool to proceed if we can't parse input

	# Extract tool information
	tool_name = input_data.get("tool_name", "")
	tool_input = input_data.get("tool_input", {})
	hook_event_name = input_data.get("hook_event_name", "")

	debug_log(f"Tool: {tool_name}, Event: {hook_event_name}")

	# Only process Write and Edit tools
	if tool_name not in ["Write", "Edit"]:
		debug_log(f"Skipping tool: {tool_name}")
		sys.exit(0)

	# Extract file path
	file_path = tool_input.get("file_path", "")
	if not file_path:
		debug_log("No file_path in tool_input")
		sys.exit(0)

	# Make file_path absolute if it isn't already
	if not os.path.isabs(file_path):
		project_dir = input_data.get("CLAUDE_PROJECT_DIR", os.getcwd())
		file_path = os.path.join(project_dir, file_path)

	debug_log(f"Processing file: {file_path}")

	# Get project directory
	project_dir = input_data.get("CLAUDE_PROJECT_DIR", os.getcwd())
	if not os.path.isabs(file_path):
		project_dir = os.getcwd()
	else:
		project_dir = os.path.dirname(file_path)

	# Format the file
	formatted = format_file(file_path, project_dir)

	if formatted:
		debug_log(f"File formatted successfully: {file_path}")
	else:
		debug_log(f"File not formatted: {file_path}")

	# Always exit 0 - we never want to block the tool execution
	debug_log("=== Auto Formatter Hook Completed ===\n")
	sys.exit(0)


if __name__ == "__main__":
	main()
