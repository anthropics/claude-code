#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPOSITORY_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

cd "$REPOSITORY_ROOT"
export PYTHONDONTWRITEBYTECODE=1

required_tools=(bash bun git jq pwsh python3 ruby)
for tool in "${required_tools[@]}"; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Required tool is not available: $tool" >&2
    exit 1
  fi
done

echo "Checking shell syntax..."
shell_count=0
while IFS= read -r -d '' file; do
  [[ -f "$file" ]] || continue
  bash -n "$REPOSITORY_ROOT/$file"
  shell_count=$((shell_count + 1))
done < <(git ls-files --cached --others --exclude-standard -z -- '*.sh')
if [[ "$shell_count" -eq 0 ]]; then
  echo "No shell scripts were found to validate" >&2
  exit 1
fi

echo "Parsing Python source without writing bytecode..."
python3 - "$REPOSITORY_ROOT" <<'PYTHON'
import ast
import os
import subprocess
import sys
import tokenize
from pathlib import Path

root = Path(sys.argv[1])
result = subprocess.run(
    [
        "git",
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
        "--",
        "*.py",
    ],
    cwd=root,
    check=True,
    stdout=subprocess.PIPE,
)
paths = [entry for entry in result.stdout.split(b"\0") if entry]
if not paths:
    raise SystemExit("No Python source files were found to validate")

for raw_path in paths:
    path = root / os.fsdecode(raw_path)
    if not path.is_file():
        continue
    with tokenize.open(str(path)) as source:
        ast.parse(source.read(), filename=str(path))
PYTHON

echo "Validating JSON documents..."
json_count=0
while IFS= read -r -d '' file; do
  [[ -f "$file" ]] || continue
  jq empty "$REPOSITORY_ROOT/$file"
  json_count=$((json_count + 1))
done < <(git ls-files --cached --others --exclude-standard -z -- '*.json')
if [[ "$json_count" -eq 0 ]]; then
  echo "No JSON documents were found to validate" >&2
  exit 1
fi

echo "Validating plugin hook schemas..."
readonly HOOK_SCHEMA_VALIDATOR="$REPOSITORY_ROOT/plugins/plugin-dev/skills/hook-development/scripts/validate-hook-schema.sh"
hook_config_count=0
while IFS= read -r -d '' file; do
  [[ -f "$file" ]] || continue
  bash "$HOOK_SCHEMA_VALIDATOR" "$REPOSITORY_ROOT/$file"
  hook_config_count=$((hook_config_count + 1))
done < <(git ls-files --cached --others --exclude-standard -z -- 'plugins/*/hooks/hooks.json')
if [[ "$hook_config_count" -eq 0 ]]; then
  echo "No plugin hook configurations were found to validate" >&2
  exit 1
fi

echo "Validating workflow YAML and agent frontmatter..."
ruby - "$REPOSITORY_ROOT" <<'RUBY'
require "open3"
require "psych"

root = ARGV.fetch(0)

def repository_files(root, pathspec)
  output, status = Open3.capture2(
    "git",
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    pathspec,
    chdir: root
  )
  raise "git ls-files failed for #{pathspec}" unless status.success?

  output.split("\0").reject(&:empty?)
end

workflow_paths = repository_files(root, ".github/workflows/*.yml") +
                 repository_files(root, ".github/workflows/*.yaml")
raise "No workflow YAML documents were found to validate" if workflow_paths.empty?

workflow_paths.uniq.each do |relative_path|
  path = File.join(root, relative_path)
  next unless File.file?(path)

  document = Psych.safe_load(
    File.read(path, encoding: "UTF-8"),
    [],
    [],
    false,
    filename: relative_path
  )
  raise "Workflow must be a YAML mapping: #{relative_path}" unless document.is_a?(Hash)
end

agent_paths = repository_files(root, "*.md").select { |path| path.include?("/agents/") }
raise "No agent definitions were found to validate" if agent_paths.empty?

agent_paths.each do |relative_path|
  path = File.join(root, relative_path)
  next unless File.file?(path)

  lines = File.readlines(path, encoding: "UTF-8")
  raise "Missing agent frontmatter: #{relative_path}" unless lines.first&.strip == "---"

  closing_index = lines[1..]&.find_index { |line| line.strip == "---" }
  raise "Unclosed agent frontmatter: #{relative_path}" unless closing_index

  frontmatter = lines[1, closing_index].join
  document = Psych.safe_load(frontmatter, [], [], false, filename: relative_path)
  raise "Agent frontmatter must be a YAML mapping: #{relative_path}" unless document.is_a?(Hash)
end
RUBY

echo "Running Bun automation tests..."
bun test tests/automation

python_suites=(
  "plugins/hookify/tests"
  "tests/data-safety"
  "tests/developer-experience"
  "tests/validator-security"
  "tests/quality-gate"
)

for suite in "${python_suites[@]}"; do
  echo "Running Python test suite: $suite"
  python3 -m unittest discover -s "$suite" -p 'test_*.py' -v
done

echo "Repository quality checks passed."
