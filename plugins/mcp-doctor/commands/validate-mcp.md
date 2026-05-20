Run the MCP configuration validator to check all .mcp.json files in the current project hierarchy.

Execute the validation script:
```bash
python3 ${CLAUDE_PLUGIN_ROOT}/hooks/validate_mcp_config.py
```

Report the results to the user. If any issues are found, suggest specific fixes based on the diagnostic output. If all configs are valid, confirm that everything looks good.

This validator checks:
- JSON syntax with detailed parse error positions
- BOM and encoding issues
- Required fields per server type (stdio needs `command`, sse/http/ws need `url`)
- Environment variable placeholder syntax
- Common misconfigurations (trailing commas, comments in JSON, duplicate keys)
