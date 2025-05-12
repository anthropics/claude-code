# File Hierarchy Visualizer Prompt

## Purpose
Generate visual representations of file and directory hierarchies from structured file path data.

## Input
A structured JSON object containing file path information, following the format:
```json
{
  "root_directory_names": ["@src", "@docs", "@tests"],
  "expanded_structure": {
    "@src": {
      "subdirectories": ["components", "utils"],
      "files": ["index.js", "App.js"]
    },
    ...
  }
}
```

## Processing Instructions

1. **Select Visualization Type**
   - Tree view (ASCII art)
   - Markdown list
   - HTML/CSS collapsible tree
   - Mind map format
   - JSON with visual indicators

2. **Configure Display Options**
   - Depth limit (max levels to show)
   - Show/hide files
   - Show/hide empty directories
   - Color coding by file type
   - Icon prefixes for different file types

3. **Add Metadata Visualization**
   - File sizes
   - Last modified dates
   - File type distribution
   - Ownership and permissions

## Output Formats

### ASCII Tree View
```
.
├── src/
│   ├── components/
│   │   └── Button.js
│   ├── utils/
│   │   └── helpers.js
│   └── index.js
├── docs/
│   └── README.md
└── tests/
    ├── unit/
    └── integration/
```

### Markdown List
```markdown
- src
  - components
    - Button.js
  - utils
    - helpers.js
  - index.js
- docs
  - README.md
- tests
  - unit
  - integration
```

### HTML Tree (Snippet)
```html
<ul class="tree">
  <li class="directory"><span class="toggle">▶</span> src
    <ul>
      <li class="directory"><span class="toggle">▶</span> components
        <ul>
          <li class="file">Button.js</li>
        </ul>
      </li>
      ...
    </ul>
  </li>
  ...
</ul>
```

## Example Usage

Input:
```json
{
  "root_directory_names": ["@src", "@docs"],
  "expanded_structure": {
    "@src": {
      "subdirectories": ["components"],
      "files": ["index.js"]
    },
    "@docs": {
      "subdirectories": [],
      "files": ["README.md"]
    }
  }
}
```

ASCII Tree Output:
```
.
├── src/
│   ├── components/
│   └── index.js
└── docs/
    └── README.md
```

## Advanced Features

### Interactive Commands
```
/expand all       # Expand all nodes
/collapse all     # Collapse all nodes
/show-only js     # Filter to show only JavaScript files
/depth 3          # Set maximum depth to 3 levels
/highlight src    # Highlight the src directory and its contents
```

### Integration Options
- Export to SVG/PNG for documentation
- Generate GraphViz DOT files
- Create interactive web-based visualizations
- Terminal-friendly output formats

### Color Coding
- Directories: Blue
- JavaScript files: Yellow
- Configuration files: Cyan
- Documentation: Green
- Test files: Magenta
- Build artifacts: Gray

## Implementation Note
This visualization tool can be implemented as a companion to the File Path Extractor, consuming its output to provide meaningful visual representations of directory structures.