# File Path Extractor

Extract and organize file paths from command output with filtering and structured formatting.

## Usage
/file-path-extractor $ARGUMENTS

## Parameters
- input: Raw file paths or command output containing file paths
- filter: Directories to exclude (default: "node_modules,__pycache__,venv,.git")
- format: Output format (json, tree, list) (default: json)
- addMeta: Whether to include metadata like file sizes and types (default: false)

## Example
/file-path-extractor --input="$(find . -type f | grep -v node_modules)" --format=tree

The command will:
1. Parse the input to extract all file paths
2. Filter out specified directories and system files
3. Organize paths into a hierarchical structure
4. Apply formatting according to the specified output format
5. Add metadata if requested

The output varies based on the specified format:
- JSON: Structured object with root directories and expanded hierarchy
- Tree: ASCII tree visualization of the directory structure
- List: Simple indented list of files and directories