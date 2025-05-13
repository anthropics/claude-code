# MCP Hooks Library

This library provides React hooks for integrating MCP (Model Context Protocol) capabilities directly into React components.

## Available Hooks

- `useMcpSequentialThinking`: Access sequential thinking capabilities
- `useMcpBraveSearch`: Perform web and local searches
- `useMcpImageGeneration`: Generate and manage images
- `useMcpGameState`: Manage game state with persistence
- `useMcpDailyRewards`: Manage daily rewards with persistence

## Getting Started

### Prerequisites

1. MCP API server is running
2. Required MCP tools are installed and running

### Installation

No additional installation is required. The hooks are included in the Claude Neural Framework.

### Testing

To test the MCP hooks:

1. Start the MCP API server:

```bash
node core/mcp/api.js
```

2. Run the test script:

```bash
node tests/hooks/test_mcp_hooks.js
```

3. View the dashboard demo:

```bash
# If using Next.js or similar framework
npm run dev

# Then visit http://localhost:3000/mcp-dashboard
```

## Usage Examples

### Sequential Thinking

```jsx
import { useMcpSequentialThinking } from '../hooks/mcp';

function MyComponent() {
  const { 
    thoughts, 
    generateThoughts, 
    continueThinking, 
    isLoading 
  } = useMcpSequentialThinking();
  
  const handleProblemSubmit = async (problem) => {
    await generateThoughts(problem);
  };
  
  return (
    <div>
      <form onSubmit={(e) => {
        e.preventDefault();
        handleProblemSubmit(e.target.problem.value);
      }}>
        <input name="problem" />
        <button type="submit" disabled={isLoading}>
          Start Thinking
        </button>
      </form>
      
      {thoughts.map((thought, i) => (
        <div key={i}>{thought.content}</div>
      ))}
      
      <button onClick={continueThinking} disabled={isLoading}>
        Continue Thinking
      </button>
    </div>
  );
}
```

### Web Search

```jsx
import { useMcpBraveSearch } from '../hooks/mcp';

function SearchComponent() {
  const { 
    results, 
    searchWeb, 
    nextPage, 
    isLoading 
  } = useMcpBraveSearch();
  
  const handleSearch = async (query) => {
    await searchWeb(query);
  };
  
  return (
    <div>
      <form onSubmit={(e) => {
        e.preventDefault();
        handleSearch(e.target.query.value);
      }}>
        <input name="query" />
        <button type="submit" disabled={isLoading}>
          Search
        </button>
      </form>
      
      {results.map((result, i) => (
        <div key={i}>
          <h3>{result.title}</h3>
          <p>{result.description}</p>
        </div>
      ))}
      
      <button onClick={nextPage} disabled={isLoading}>
        Next Page
      </button>
    </div>
  );
}
```

### Image Generation

```jsx
import { useMcpImageGeneration } from '../hooks/mcp';

function ImageComponent() {
  const { 
    images, 
    generateImages, 
    isLoading 
  } = useMcpImageGeneration();
  
  const handleGenerate = async (prompt) => {
    await generateImages(prompt, { numberOfImages: 2 });
  };
  
  return (
    <div>
      <form onSubmit={(e) => {
        e.preventDefault();
        handleGenerate(e.target.prompt.value);
      }}>
        <input name="prompt" />
        <button type="submit" disabled={isLoading}>
          Generate
        </button>
      </form>
      
      <div className="image-grid">
        {images.map((image, i) => (
          <img key={i} src={image.url} alt={`Generated ${i}`} />
        ))}
      </div>
    </div>
  );
}
```

### Game State

```jsx
import { useMcpGameState } from '../hooks/mcp';

function GameComponent() {
  const { 
    gameState, 
    updateScore, 
    levelUp, 
    isLoading 
  } = useMcpGameState();
  
  if (isLoading) return <div>Loading...</div>;
  if (!gameState) return <div>No game state</div>;
  
  return (
    <div>
      <h2>Level: {gameState.level}</h2>
      <h3>Score: {gameState.score}</h3>
      
      <button onClick={() => updateScore(100)}>
        Add 100 Points
      </button>
      
      <button onClick={levelUp}>
        Level Up
      </button>
    </div>
  );
}
```

## API Reference

Each hook follows a consistent pattern:

- `isLoading`: Boolean indicating whether an operation is in progress
- `error`: Error message if an operation failed
- `*`: Main state (varies by hook)
- Various methods for interacting with the state

See the [MCP Hooks Usage Guide](../../docs/guides/mcp_hooks_usage.md) for detailed API documentation.

## Demo Components

The following components demonstrate how to use the MCP hooks:

- `McpThinkingDemo.jsx`: Demonstrates sequential thinking
- `McpSearchDemo.jsx`: Demonstrates web search
- `McpImageDemo.jsx`: Demonstrates image generation
- `McpDashboard.jsx`: Integrates all demos into a single dashboard

## Architecture

The MCP hooks architecture consists of:

1. **React Hooks**: Frontend integration points
2. **API Server**: Backend service that communicates with MCP tools
3. **MCP Tools**: External services that provide AI capabilities

```
┌────────────┐       ┌───────────┐       ┌────────────┐
│            │       │           │       │            │
│  React     │       │  MCP API  │       │  MCP Tools │
│  Hooks     │◄─────►│  Server   │◄─────►│            │
│            │       │           │       │            │
└────────────┘       └───────────┘       └────────────┘
```

## Contributing

To add a new MCP hook:

1. Create a new file in `src/hooks/mcp/` (e.g., `useNewMcpTool.js`)
2. Export the hook from `src/hooks/mcp/index.js`
3. Create API routes in `core/mcp/routes/`
4. Register the routes in `core/mcp/api.js`
5. Update documentation

## See Also

- [MCP Hooks Usage Guide](../../docs/guides/mcp_hooks_usage.md)
- [Comprehensive MCP Hooks Example](../../docs/examples/mcp_hooks_comprehensive_example.md)
- [MCP Frontend Integration Guide](../../docs/guides/mcp_frontend_integration.md)