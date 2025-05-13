# File Path Extractor

Extract a structured and organized list of file paths from command output while excluding specific directories and irrelevant files.

## Steps

1. Parse the provided list of entries and retain all directories and files, excluding the specified directories and their contents (`node_modules`, `__pycache__`, `venv`, `.git`).
2. Highlight main root directories for clarity, while maintaining a hierarchical structure for subdirectories and files.
3. Remove redundant metadata or system-related files such as `.DS_Store`, temporary files, or build artifacts.
4. Group the results based on the following hierarchy:
   - `Root Directories`
   - `Subdirectories`
   - `Files`
5. The focus should be on maintaining clarity and ensuring the hierarchy matches the given structure.

## Output Format

Output the final result in JSON format, providing clarity with clearly delineated root directories, subdirectories, and files. Use the following keys:
- `root_directory_names`: A list of root directory names.
- `expanded_structure`: A hierarchical dictionary that organizes the root directories, their subdirectories, and files under them.

JSON Template:
```json
{
  "root_directory_names": ["agents", "ai_docs", "cognitive", "..."],
  "expanded_structure": {
    "agents": {
      "subdirectories": ["commands", "..."],
      "files": ["agent_communication_framework.md", "..."]
    },
    "ai_docs": {
      "subdirectories": ["examples", "prompts", "templates"],
      "files": ["README.md"]
    },
    "...": {
      "subdirectories": [],
      "files": []
    }
  }
}
```

## Parameters

- `input`: Raw file paths or command output containing file paths
- `filter`: Directories to exclude (default: "node_modules,__pycache__,venv,.git")
- `format`: Output format (json, tree, list) (default: json)
- `addMeta`: Whether to include metadata like file sizes and types (default: false)

## Examples

### Basic Usage
```
/file-path-extractor --input="$(find . -type f | grep -v node_modules)"
```

### With Custom Format
```
/file-path-extractor --input="$(ls -R)" --format=tree
```

### With Additional Filtering
```
/file-path-extractor --input="$(find . -type f)" --filter="node_modules,dist,build,coverage" --format=json
```

### Including Metadata
```
/file-path-extractor --input="$(find . -type f)" --addMeta=true
```

## Additional Formatting Options

### Tree Format
When using the `tree` format, the output will be formatted as an ASCII tree:
```
.
├── agents
│   ├── commands
│   │   ├── agent-to-agent.md
│   │   └── analyze-complexity.md
│   └── agent_communication_framework.md
├── ai_docs
│   ├── examples
│   ├── prompts
│   └── README.md
└── ...
```

### List Format
When using the `list` format, the output will be a simple indented list:
```
agents
  commands
    agent-to-agent.md
    analyze-complexity.md
  agent_communication_framework.md
ai_docs
  examples
  prompts
  templates
  README.md
...
```

## Notes

- Ensure excluded directories and system-related files are not included in any part of the output
- For files located in the root, they will be included under a special "root" key in the expanded structure
- If a directory is empty after applying the filtering rules, it will still appear in the expanded structure with empty subdirectories and files arrays
- The command automatically handles relative and absolute paths in the input

## Advanced Processing Options

### Directory Size Analysis
- Provide directory size information (total and per subdirectory)
- Example output: `"size_info": {"total": "25.4MB", "by_dir": {"agents": "12.2MB", "ai_docs": "8.1MB", "tests": "5.1MB"}}`

### File Type Categorization
- Group files by extension or type
- Example output: `"file_types": {"js": 45, "md": 12, "json": 8}`

### Modification Time Analysis
- Include last modified timestamps for recently changed files
- Example: `"recent_changes": [{"path": "src/components/Button.js", "modified": "2025-05-12T10:15:32Z"}]`

### Dependency Analysis
- Identify import/require statements in code files
- Map dependencies between different modules
- Example: `"dependencies": {"src/App.js": ["src/components/Button.js", "src/utils/helpers.js"]}`