---
enabled: true
max_header_lines: 50
---

# Strip License Headers Configuration

This plugin is enabled and will automatically strip license headers from source files when Claude reads them.

## How it works

When enabled, the plugin intercepts Read tool calls and:
1. Checks if the file is a supported source file type
2. Scans the first lines for license header patterns
3. Skips those lines by adjusting the read offset

## Supported patterns

- SPDX-License-Identifier
- Apache License 2.0
- MIT License
- GNU GPL/LGPL
- BSD License
- Generic copyright blocks

## Configuration options

- `enabled`: Set to `true` to enable the plugin (default: `false`)
- `max_header_lines`: Maximum lines to scan for license headers (default: `50`)

## To disable

Simply delete this file or set `enabled: false`.
