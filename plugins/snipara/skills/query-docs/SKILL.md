---
name: query-docs
description: Query Snipara documentation when you need context about the codebase, APIs, architecture, or implementation details. Use this proactively whenever the user asks about how something works or where to find information.
---

When you need documentation or codebase context:

1. Use the `mcp__snipara__rlm_context_query` tool with:
   - `query`: The user's question or topic
   - `max_tokens`: 4000-8000 depending on complexity
   - `search_mode`: "hybrid" (best results)

2. If the Snipara MCP server is not available, fall back to local Read/Grep/Glob tools.

3. Present the results clearly, citing relevant sections and file paths.

Example queries:
- "How does authentication work?" → query="authentication"
- "Where are API endpoints defined?" → query="API endpoints"
- "What's the database schema?" → query="database schema"
