#!/bin/bash

# Script to remove redundant frontend components and optimize MCP integration
# This script implements the recommendations from the frontend_mcp_optimization.md document

echo "Starting cleanup of redundant frontend components..."

# Create backup directory
BACKUP_DIR="./backup/frontend_$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR
echo "Created backup directory: $BACKUP_DIR"

# 1. Backup and remove redundant dashboard implementation
echo "Backing up dashboard components..."
mkdir -p $BACKUP_DIR/ui/dashboard
if [ -d "./ui/dashboard" ]; then
  cp -r ./ui/dashboard/* $BACKUP_DIR/ui/dashboard/
  echo "Backed up dashboard components to $BACKUP_DIR/ui/dashboard/"
  
  # Remove the standalone main.js dashboard implementation
  if [ -f "./ui/dashboard/main.js" ]; then
    echo "Removing redundant dashboard implementation: ./ui/dashboard/main.js"
    rm ./ui/dashboard/main.js
  fi
fi

# 2. Backup color schema implementation before modification
if [ -f "./ui/dashboard/color-schema-integration.js" ]; then
  echo "Backing up color schema integration..."
  cp ./ui/dashboard/color-schema-integration.js $BACKUP_DIR/
  echo "Backed up color schema integration to $BACKUP_DIR/"
  
  # We don't remove this yet, as we need to consolidate it with schema-ui-integration
  echo "Color schema implementation will be consolidated in a separate step"
fi

# 3. Create directories for new MCP hooks library
echo "Creating MCP hooks library structure..."
mkdir -p ./src/hooks/mcp

# 4. Create sample unified MCP hooks file
echo "Creating MCP hooks library template..."
cat > ./src/hooks/mcp/index.js << 'EOL'
/**
 * MCP Hooks Library
 * 
 * This library provides React hooks for interacting with MCP tools directly
 * from frontend components. It implements the recommendations from the
 * frontend_mcp_optimization.md document.
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for sequential thinking MCP tool
 */
export function useMcpSequentialThinking() {
  const [thinking, setThinking] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const generateThoughts = useCallback(async (initialThought, options = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/mcp/sequential-thinking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thought: initialThought,
          thoughtNumber: 1,
          totalThoughts: options.totalThoughts || 5,
          ...options
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const result = await response.json();
      setThinking(result);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  return {
    thinking,
    isLoading,
    error,
    generateThoughts
  };
}

/**
 * Hook for brave search MCP tool
 */
export function useMcpBraveSearch() {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const search = useCallback(async (query, options = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/mcp/brave-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          ...options
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const result = await response.json();
      setResults(result);
      return result;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  return {
    results,
    isLoading,
    error,
    search
  };
}

/**
 * Hook for image generation MCP tool
 */
export function useMcpImageGeneration() {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const generateImages = useCallback(async (prompt, options = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/mcp/imagen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          numberOfImages: options.numberOfImages || 1,
          ...options
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const result = await response.json();
      setImages(result);
      return result;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  return {
    images,
    isLoading,
    error,
    generateImages
  };
}

/**
 * Hook for UI component generation with 21st-dev-magic
 */
export function useMcp21stDevMagic() {
  const [component, setComponent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const generateComponent = useCallback(async (prompt, options = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/mcp/21st-dev-magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          ...options
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const result = await response.json();
      setComponent(result);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  return {
    component,
    isLoading,
    error,
    generateComponent
  };
}

/**
 * Hook for real-time updates from MCP tools via WebSocket
 */
export function useMcpRealTimeUpdates() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  
  useEffect(() => {
    let ws = null;
    
    try {
      ws = new WebSocket('ws://localhost:3000/mcp-updates');
      
      ws.onopen = () => {
        setStatus('connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setData(message);
        } catch (err) {
          setError('Error parsing WebSocket message');
        }
      };
      
      ws.onerror = (event) => {
        setStatus('error');
        setError('WebSocket error');
      };
      
      ws.onclose = () => {
        setStatus('disconnected');
      };
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
    
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);
  
  return {
    data,
    status,
    error
  };
}
EOL

echo "Created MCP hooks library template at ./src/hooks/mcp/index.js"

# 5. Create an enhanced MemoryProfileForm with MCP integration
echo "Creating enhanced MemoryProfileForm template..."
mkdir -p $BACKUP_DIR/schema-ui-integration/src/components/profile

# Backup original MemoryProfileForm
if [ -f "./schema-ui-integration/src/components/profile/MemoryProfileForm.jsx" ]; then
  cp "./schema-ui-integration/src/components/profile/MemoryProfileForm.jsx" $BACKUP_DIR/schema-ui-integration/src/components/profile/
fi

# Create integration documentation
echo "Creating integration documentation..."
cat > ./docs/guides/frontend_mcp_integration.md << 'EOL'
# Frontend MCP Integration Guide

This guide demonstrates how to use the new MCP hooks library to integrate MCP tools directly into frontend components.

## Getting Started

Import the hooks from the MCP hooks library:

```javascript
import { 
  useMcpSequentialThinking, 
  useMcpBraveSearch, 
  useMcpImageGeneration,
  useMcp21stDevMagic,
  useMcpRealTimeUpdates
} from '../hooks/mcp';
```

## Using Sequential Thinking

The Sequential Thinking hook allows components to generate thoughts recursively:

```javascript
function ThinkingComponent() {
  const { thinking, isLoading, error, generateThoughts } = useMcpSequentialThinking();
  
  const handleThink = async () => {
    await generateThoughts("Initial thought about solving this problem", { totalThoughts: 5 });
  };
  
  return (
    <div>
      <button onClick={handleThink} disabled={isLoading}>
        {isLoading ? 'Thinking...' : 'Think'}
      </button>
      
      {error && <div className="error">{error}</div>}
      
      {thinking && (
        <div className="thinking-result">
          <h3>Thought {thinking.thoughtNumber}/{thinking.totalThoughts}</h3>
          <p>{thinking.thought}</p>
        </div>
      )}
    </div>
  );
}
```

## Using Image Generation

The Image Generation hook allows components to generate images:

```javascript
function ImageGenerationComponent() {
  const { images, isLoading, error, generateImages } = useMcpImageGeneration();
  const [prompt, setPrompt] = useState('');
  
  const handleGenerate = async () => {
    await generateImages(prompt, { numberOfImages: 2 });
  };
  
  return (
    <div>
      <input 
        type="text" 
        value={prompt} 
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter image description"
      />
      
      <button onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? 'Generating...' : 'Generate Images'}
      </button>
      
      {error && <div className="error">{error}</div>}
      
      <div className="image-gallery">
        {images.map((image, index) => (
          <img key={index} src={image.url} alt={`Generated image ${index}`} />
        ))}
      </div>
    </div>
  );
}
```

## Using UI Component Generation

The 21st Dev Magic hook allows components to generate UI components:

```javascript
function ComponentGeneratorForm() {
  const { component, isLoading, error, generateComponent } = useMcp21stDevMagic();
  const [prompt, setPrompt] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  
  const handleGenerate = async () => {
    const result = await generateComponent(prompt);
    if (result) {
      setGeneratedCode(result.code);
    }
  };
  
  return (
    <div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the UI component you need..."
        rows={5}
      />
      
      <button onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? 'Generating...' : 'Generate Component'}
      </button>
      
      {error && <div className="error">{error}</div>}
      
      {generatedCode && (
        <div className="generated-code">
          <h3>Generated Component</h3>
          <pre>{generatedCode}</pre>
        </div>
      )}
    </div>
  );
}
```

## Using Real-Time Updates

The Real-Time Updates hook allows components to receive real-time updates:

```javascript
function RealTimeMonitor() {
  const { data, status, error } = useMcpRealTimeUpdates();
  
  return (
    <div>
      <div className="status">
        Connection Status: {status}
        {error && <span className="error">{error}</span>}
      </div>
      
      <div className="real-time-data">
        {data ? (
          <pre>{JSON.stringify(data, null, 2)}</pre>
        ) : (
          <p>Waiting for data...</p>
        )}
      </div>
    </div>
  );
}
```

## API Backend Integration

To support these hooks, add the following API endpoints to your backend:

- `/api/mcp/sequential-thinking` - For sequential thinking requests
- `/api/mcp/brave-search` - For search requests
- `/api/mcp/imagen` - For image generation
- `/api/mcp/21st-dev-magic` - For UI component generation
- WebSocket endpoint at `ws://localhost:3000/mcp-updates` for real-time updates

These endpoints should forward requests to the appropriate MCP tools and return the results.
EOL

echo "Created frontend MCP integration guide at ./docs/guides/frontend_mcp_integration.md"

# Output completion message
echo ""
echo "Cleanup process completed successfully."
echo "Removed redundant dashboard implementation from ./ui/dashboard/main.js"
echo "Created MCP hooks library template at ./src/hooks/mcp/index.js"
echo "Created integration documentation at ./docs/guides/frontend_mcp_integration.md"
echo ""
echo "Next steps:"
echo "1. Update the schema-ui-integration components to use the new MCP hooks"
echo "2. Consolidate the color schema implementation"
echo "3. Implement the API endpoints for MCP tool integration"
echo ""
echo "See ./docs/recommendations/frontend_mcp_optimization.md for more details."

# Make script executable
chmod +x ./scripts/cleanup/remove_redundant_frontend.sh