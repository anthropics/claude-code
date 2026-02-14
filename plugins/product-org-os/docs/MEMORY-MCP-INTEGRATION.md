# Memory MCP Integration Guide

**Optional Enhancement for Product Org OS**

Memory MCP adds a persistent knowledge graph to your Product Org, enabling Claude to remember entities, relationships, and observations across all sessions.

---

## What Memory MCP Does

Memory MCP creates a **knowledge graph** with three components:

| Component | Description | Example |
|-----------|-------------|---------|
| **Entities** | Nodes representing people, products, competitors, decisions | "AXIA" (product), "Competitor X" (company) |
| **Relations** | Directed connections between entities | "AXIA" → "competes_with" → "Competitor X" |
| **Observations** | Atomic facts attached to entities | "AXIA launched enterprise tier in Q2 2026" |

### Tools Provided

| Tool | Purpose |
|------|---------|
| `create_entities` | Add new nodes to the graph |
| `create_relations` | Connect entities with relationships |
| `add_observations` | Attach facts to existing entities |
| `delete_entities` | Remove nodes (cascades to relations) |
| `delete_observations` | Remove specific facts |
| `delete_relations` | Remove connections |
| `read_graph` | Retrieve entire knowledge structure |
| `search_nodes` | Query by name, type, or content |
| `open_nodes` | Access specific entities and their connections |

---

## Installation

### Prerequisites
- Node.js 18+ installed
- Claude Code with MCP support

### Step 1: Add to .mcp.json

Add the memory server to your project's `.mcp.json` file:

**macOS/Linux:**
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": {
        "MEMORY_FILE_PATH": "./context/memory/knowledge-graph.json"
      }
    }
  }
}
```

**Windows:**
```json
{
  "mcpServers": {
    "memory": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@modelcontextprotocol/server-memory"],
      "env": {
        "MEMORY_FILE_PATH": ".\\context\\memory\\knowledge-graph.json"
      }
    }
  }
}
```

### Step 2: Create Storage Directory

```bash
mkdir -p context/memory
```

### Step 3: Restart Claude Code

Restart your Claude Code session for the MCP server to load.

---

## Using Memory MCP with Product Org OS

### How It Complements the Context Layer

| Context Layer (Files) | Memory MCP (Graph) |
|----------------------|-------------------|
| Structured documents (PRDs, decisions) | Entity relationships |
| Full content searchable | Quick entity lookups |
| Version-controlled markdown | Graph queries |
| `/context-recall` retrieval | `search_nodes` retrieval |

**Best Practice:** Use both together:
- **Context Layer** for document-centric memory (decisions, bets, feedback)
- **Memory MCP** for relationship-centric memory (who owns what, how things connect)

### Example Workflows

**After a Decision Record:**
```
User: Save this decision to the knowledge graph

Claude: Creating entities and relations:
- Entity: "DR-2026-015" (type: decision)
- Entity: "Pricing Strategy" (type: topic)
- Relation: DR-2026-015 → "about" → Pricing Strategy
- Observation on DR-2026-015: "Adopted tiered pricing model on 2026-01-28"
```

**Before a Strategic Session:**
```
User: What do we know about Competitor X?

Claude: [Uses search_nodes to find Competitor X entity]
Found entity "Competitor X" with:
- Relations: competes_with → AXIA, acquired → StartupY
- Observations:
  - "Launched enterprise tier at $199/seat (Q4 2025)"
  - "Raised Series C in January 2026"
  - "Lost deal to us: Acme Corp (security concerns)"
```

### Agent Integration

Agents can use Memory MCP to:
1. **Recall prior context** before starting work
2. **Store observations** after completing tasks
3. **Map relationships** between products, competitors, decisions

---

## Configuration Options

### Custom Storage Path

Set `MEMORY_FILE_PATH` to control where the knowledge graph is stored:

```json
"env": {
  "MEMORY_FILE_PATH": "/path/to/your/knowledge-graph.json"
}
```

### Docker Installation (Alternative)

```json
{
  "mcpServers": {
    "memory": {
      "command": "docker",
      "args": ["run", "-i", "-v", "claude-memory:/app/dist", "--rm", "mcp/memory"]
    }
  }
}
```

---

## Best Practices

### Entity Naming
- Use consistent, unique names
- Include type for clarity: "AXIA (product)", "John Smith (PM)"

### Relation Naming
- Use active voice: "owns", "decided", "competes_with"
- Be consistent across the graph

### Observations
- Keep atomic (one fact per observation)
- Include dates when relevant
- Be specific and actionable

### Graph Maintenance
- Periodically review with `read_graph`
- Delete stale entities and observations
- Keep relations current

---

## Troubleshooting

### Server Not Loading
1. Check Node.js version: `node --version` (need 18+)
2. Verify `.mcp.json` syntax is valid JSON
3. Ensure `MEMORY_FILE_PATH` directory exists
4. Restart Claude Code

### Permission Errors
- Ensure write access to the storage directory
- On Windows, use double backslashes in paths: `"G:\\My Drive\\..."`

### Graph Not Persisting
- Check `MEMORY_FILE_PATH` is set correctly
- Verify the file is being created in the expected location

---

## Resources

- [Memory MCP Source](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)
- [MCP Protocol Docs](https://modelcontextprotocol.io)
- [Product Org OS Documentation](./PRODUCT-ORG-CLAUDE.md)

---

**Memory MCP is optional.** Product Org OS works fully without it. Add it when you want relationship-based memory alongside the document-based context layer.
