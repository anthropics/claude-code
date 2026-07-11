#!/bin/bash
# Agent File Validator
# Parses YAML frontmatter with Ruby's standard Psych parser before validating it.

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 <path/to/agent.md>"
  echo ""
  echo "Validates agent files for:"
  echo "  - Strictly parseable YAML frontmatter"
  echo "  - Required name and description fields"
  echo "  - Official optional frontmatter field formats"
  echo "  - System prompt presence and length"
  exit 1
fi

AGENT_FILE="$1"

if [ ! -f "$AGENT_FILE" ]; then
  echo "❌ File not found: $AGENT_FILE"
  exit 1
fi

if ! command -v ruby >/dev/null 2>&1; then
  echo "❌ Ruby is required to parse YAML frontmatter"
  exit 1
fi

exec ruby -rpsych - "$AGENT_FILE" <<'RUBY'
agent_file = ARGV.fetch(0)
lines = File.readlines(agent_file, encoding: "UTF-8")

puts "🔍 Validating agent file: #{agent_file}"
puts

unless lines.first&.strip == "---"
  warn "❌ File must start with YAML frontmatter (---)"
  exit 1
end

closing_index = (1...lines.length).find { |index| lines[index].strip == "---" }
unless closing_index
  warn "❌ Frontmatter not closed (missing second ---)"
  exit 1
end

frontmatter = lines[1...closing_index].join
system_prompt = (lines[(closing_index + 1)..-1] || []).join.strip

begin
  metadata = Psych.safe_load(frontmatter, [], [], false)
rescue Psych::Exception => error
  warn "❌ Invalid YAML frontmatter: #{error.message.lines.first.strip}"
  exit 1
end

unless metadata.is_a?(Hash)
  warn "❌ YAML frontmatter must be a mapping"
  exit 1
end

errors = []
warnings = []

supported_fields = %w[
  name description model effort maxTurns tools disallowedTools skills memory
  background isolation color initialPrompt
]
(metadata.keys - supported_fields).sort.each do |field|
  errors << "#{field} is not supported in plugin agent frontmatter"
end

valid_tool_list = lambda do |value|
  case value
  when String
    entries = value.split(",", -1).map(&:strip)
    !entries.empty? && entries.all? { |entry| !entry.empty? }
  when Array
    !value.empty? && value.all? { |entry| entry.is_a?(String) && !entry.strip.empty? }
  else
    false
  end
end

name = metadata["name"]
if !name.is_a?(String) || name.empty?
  errors << "Missing required string field: name"
else
  unless name.match?(/\A[a-z](?:[a-z-]*[a-z])?\z/)
    errors << "name must start/end with a lowercase letter and contain only lowercase letters and hyphens"
  end
  errors << "name too short (minimum 3 characters)" if name.length < 3
  errors << "name too long (maximum 50 characters)" if name.length > 50
  warnings << "name is too generic: #{name}" if %w[helper assistant agent tool].include?(name)
end

description = metadata["description"]
if !description.is_a?(String) || description.strip.empty?
  errors << "Missing required string field: description"
else
  warnings << "description too short (minimum 10 characters recommended)" if description.length < 10
  warnings << "description very long (over 5,000 characters)" if description.length > 5_000
  warnings << "description should include <example> blocks for triggering" unless description.include?("<example>")
  warnings << "description should start with 'Use this agent when...'" unless description.match?(/use this agent when/i)
end

if metadata.key?("model")
  model = metadata["model"]
  if !model.is_a?(String) || model.empty?
    errors << "model must be a non-empty string when present"
  elsif !%w[inherit sonnet opus haiku fable].include?(model) &&
        !model.match?(/\Aclaude-[a-z0-9][a-z0-9.-]*\z/)
    warnings << "Unknown model: #{model}"
  end
end

if metadata.key?("tools")
  unless valid_tool_list.call(metadata["tools"])
    errors << "tools must be a comma-separated string or an array of non-empty strings when present"
  end
end

if metadata.key?("disallowedTools") && !valid_tool_list.call(metadata["disallowedTools"])
  errors << "disallowedTools must be a comma-separated string or an array of non-empty strings when present"
end

if metadata.key?("maxTurns") &&
   (!metadata["maxTurns"].is_a?(Integer) || metadata["maxTurns"] <= 0)
  errors << "maxTurns must be a positive integer"
end

if metadata.key?("skills")
  skills = metadata["skills"]
  unless skills.is_a?(Array) && skills.all? { |skill| skill.is_a?(String) && !skill.strip.empty? }
    errors << "skills must be an array of non-empty strings when present"
  end
end

if metadata.key?("memory") && !%w[user project local].include?(metadata["memory"])
  errors << "memory must be one of: user, project, local"
end

if metadata.key?("background") && metadata["background"] != true && metadata["background"] != false
  errors << "background must be a boolean"
end

if metadata.key?("effort") && !%w[low medium high xhigh max].include?(metadata["effort"])
  errors << "effort must be one of: low, medium, high, xhigh, max"
end

if metadata.key?("isolation") && metadata["isolation"] != "worktree"
  errors << "isolation must be 'worktree' when present"
end

if metadata.key?("color") &&
   !%w[red blue green yellow purple orange pink cyan].include?(metadata["color"])
  errors << "color must be one of: red, blue, green, yellow, purple, orange, pink, cyan"
end

if metadata.key?("initialPrompt") &&
   (!metadata["initialPrompt"].is_a?(String) || metadata["initialPrompt"].strip.empty?)
  errors << "initialPrompt must be a non-empty string when present"
end

if system_prompt.empty?
  errors << "System prompt is empty"
elsif system_prompt.length < 20
  errors << "System prompt too short (minimum 20 characters)"
else
  warnings << "System prompt very long (over 10,000 characters)" if system_prompt.length > 10_000
  warnings << "System prompt should use second person (You are..., You will..., Your...)" unless system_prompt.match?(/\b(?:You are|You will|Your)\b/)
end

puts "✅ YAML frontmatter parsed"
puts "✅ name: #{name}" if name.is_a?(String) && !name.empty?
puts "✅ description: #{description.length} characters" if description.is_a?(String)
puts "✅ model: #{metadata['model']}" if metadata.key?("model")
puts "💡 model: not specified (optional)" unless metadata.key?("model")
puts "✅ System prompt: #{system_prompt.length} characters" unless system_prompt.empty?

warnings.each { |message| puts "⚠️  #{message}" }
errors.each { |message| puts "❌ #{message}" }

puts
puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if errors.empty? && warnings.empty?
  puts "✅ All checks passed!"
  exit 0
elsif errors.empty?
  puts "⚠️  Validation passed with #{warnings.length} warning(s)"
  exit 0
else
  puts "❌ Validation failed with #{errors.length} error(s) and #{warnings.length} warning(s)"
  exit 1
end
RUBY
