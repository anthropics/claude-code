# Enhancement Proposal: Expand STDOUT via MCP tool name suffix

## Summary
Add mode namespace support (e.g., **`__expand`**) to MCP tool names.  

Example use case: **`mcp__acme__get_help__expand`**

## Motivation
- Enable tools to indicate behavior/mode directly in their name.
- Facilitate zero-configuration, self-documenting, and minimal implementation for new tool modes.
- Maintain backward compatibility and avoid changes to the MCP specification.

## Proposed Solution

- Allow tool names to include a mode namespace suffix such as `__expand`.

Example usage:

  ```js
  server.registerTool(
    "help__expand",  // ← mode namespace
    {
      title: "Help",
      description: "Display help information (always expanded)",
      inputSchema: zodToJsonSchema(z.object({})),
    }
    // ...
  )
  ```
  