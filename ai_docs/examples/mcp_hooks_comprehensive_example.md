# Comprehensive MCP Hooks Integration Example

This example demonstrates how to integrate multiple MCP hooks into a React application to create a powerful, AI-enhanced user experience.

## Overview

In this example, we'll create a "Research Assistant" application that combines:

1. Sequential thinking for breaking down complex problems
2. Web search for gathering information
3. Image generation for visualizing concepts
4. Game state persistence for tracking user progress

## Main Application Component

```jsx
import React, { useState, useEffect } from 'react';
import { 
  useMcpSequentialThinking, 
  useMcpBraveSearch, 
  useMcpImageGeneration, 
  useMcpGameState 
} from '../hooks/mcp';

import ResearchForm from './ResearchForm';
import ThinkingProcess from './ThinkingProcess';
import SearchResults from './SearchResults';
import ImageGallery from './ImageGallery';
import ProgressTracker from './ProgressTracker';

function ResearchAssistant() {
  const [topic, setTopic] = useState('');
  const [activeStep, setActiveStep] = useState('thinking');
  const [searchQuery, setSearchQuery] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  
  // MCP hooks
  const thinking = useMcpSequentialThinking();
  const search = useMcpBraveSearch();
  const imageGen = useMcpImageGeneration();
  const gameState = useMcpGameState();
  
  // Track completion of each step
  const [stepsCompleted, setStepsCompleted] = useState({
    thinking: false,
    search: false,
    visualization: false
  });
  
  // Handle research topic submission
  const handleTopicSubmit = async (newTopic) => {
    setTopic(newTopic);
    setActiveStep('thinking');
    
    // Reset completion status
    setStepsCompleted({
      thinking: false,
      search: false,
      visualization: false
    });
    
    // Start thinking process
    await thinking.generateThoughts(`Research topic: ${newTopic}. Break down this topic into key areas to explore.`);
  };
  
  // Continue to the next step
  const handleContinueThinking = async () => {
    await thinking.continueThinking();
  };
  
  // Complete thinking step and generate search queries
  const handleCompleteThinking = async () => {
    const conclusion = await thinking.getConclusion();
    
    // Extract search queries from the conclusion
    const searchTerm = topic + ' ' + conclusion.split('.')[0];
    setSearchQuery(searchTerm);
    
    // Mark thinking as complete and move to search
    setStepsCompleted(prev => ({ ...prev, thinking: true }));
    setActiveStep('search');
    
    // Start search
    await search.searchWeb(searchTerm);
  };
  
  // Complete search step and generate image prompt
  const handleCompleteSearch = async () => {
    if (search.results.length === 0) return;
    
    // Generate an image prompt based on search results and thinking
    const imagePromptText = `Visual representation of ${topic}: ${thinking.thoughts[0]?.content || ''}`;
    setImagePrompt(imagePromptText);
    
    // Mark search as complete and move to visualization
    setStepsCompleted(prev => ({ ...prev, search: true }));
    setActiveStep('visualization');
    
    // Generate images
    await imageGen.generateImages(imagePromptText, { numberOfImages: 2 });
  };
  
  // Complete the research process
  const handleCompleteResearch = async () => {
    // Mark visualization as complete
    setStepsCompleted(prev => ({ ...prev, visualization: true }));
    
    // Update game state to track progress
    await gameState.updateScore(100);
    
    if (gameState.gameState?.completedTopics) {
      await gameState.saveGameState({
        ...gameState.gameState,
        completedTopics: [...gameState.gameState.completedTopics, topic]
      });
    } else {
      await gameState.saveGameState({
        ...gameState.gameState,
        completedTopics: [topic]
      });
    }
    
    // Check if level up is needed (every 5 topics)
    if (gameState.gameState?.completedTopics.length % 5 === 0) {
      await gameState.levelUp();
    }
  };
  
  // Render the active step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 'thinking':
        return (
          <ThinkingProcess 
            thoughts={thinking.thoughts}
            isLoading={thinking.isLoading}
            error={thinking.error}
            isComplete={thinking.isComplete}
            onContinue={handleContinueThinking}
            onComplete={handleCompleteThinking}
          />
        );
      case 'search':
        return (
          <SearchResults 
            results={search.results}
            isLoading={search.isLoading}
            error={search.error}
            totalResults={search.totalResults}
            currentPage={search.currentPage}
            onNextPage={search.nextPage}
            onPreviousPage={search.previousPage}
            onComplete={handleCompleteSearch}
          />
        );
      case 'visualization':
        return (
          <ImageGallery 
            images={imageGen.images}
            isLoading={imageGen.isLoading}
            error={imageGen.error}
            onComplete={handleCompleteResearch}
          />
        );
      default:
        return <div>Select a step to begin research</div>;
    }
  };
  
  return (
    <div className="research-assistant">
      <header>
        <h1>Research Assistant</h1>
        <ProgressTracker 
          level={gameState.gameState?.level || 1}
          score={gameState.gameState?.score || 0}
          completedTopics={gameState.gameState?.completedTopics?.length || 0}
        />
      </header>
      
      <ResearchForm 
        onSubmit={handleTopicSubmit}
        isLoading={thinking.isLoading}
      />
      
      {topic && (
        <>
          <div className="research-progress">
            <div className={`step ${activeStep === 'thinking' ? 'active' : ''} ${stepsCompleted.thinking ? 'completed' : ''}`}>
              1. Thinking
            </div>
            <div className={`step ${activeStep === 'search' ? 'active' : ''} ${stepsCompleted.search ? 'completed' : ''}`}>
              2. Research
            </div>
            <div className={`step ${activeStep === 'visualization' ? 'active' : ''} ${stepsCompleted.visualization ? 'completed' : ''}`}>
              3. Visualization
            </div>
          </div>
          
          <div className="step-content">
            <h2>
              {activeStep === 'thinking' && 'Breaking Down Research Topic'}
              {activeStep === 'search' && 'Gathering Information'}
              {activeStep === 'visualization' && 'Visualizing Concepts'}
            </h2>
            {renderStepContent()}
          </div>
        </>
      )}
    </div>
  );
}

export default ResearchAssistant;
```

## Child Components

### ResearchForm

```jsx
import React, { useState } from 'react';

function ResearchForm({ onSubmit, isLoading }) {
  const [topic, setTopic] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    onSubmit(topic);
  };
  
  return (
    <form onSubmit={handleSubmit} className="research-form">
      <div className="form-group">
        <label htmlFor="topic">Research Topic:</label>
        <input 
          type="text"
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a topic to research..."
          required
        />
      </div>
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Processing...' : 'Start Research'}
      </button>
    </form>
  );
}

export default ResearchForm;
```

### ThinkingProcess

```jsx
import React from 'react';

function ThinkingProcess({ 
  thoughts, 
  isLoading, 
  error, 
  isComplete, 
  onContinue, 
  onComplete 
}) {
  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }
  
  if (thoughts.length === 0) {
    return <div className="loading">Analyzing topic...</div>;
  }
  
  return (
    <div className="thinking-process">
      <ul className="thoughts-list">
        {thoughts.map((thought, index) => (
          <li key={index} className="thought">
            <div className="thought-number">
              Thought {thought.number} {thought.isRevision && '(Revised)'}
            </div>
            <div className="thought-content">{thought.content}</div>
          </li>
        ))}
      </ul>
      
      <div className="thinking-controls">
        {!isComplete && (
          <button 
            onClick={onContinue} 
            disabled={isLoading}
            className="continue-button"
          >
            {isLoading ? 'Thinking...' : 'Think Deeper'}
          </button>
        )}
        
        <button 
          onClick={onComplete}
          disabled={isLoading || thoughts.length === 0}
          className="complete-button"
        >
          Complete Thinking
        </button>
      </div>
    </div>
  );
}

export default ThinkingProcess;
```

### SearchResults

```jsx
import React from 'react';

function SearchResults({ 
  results, 
  isLoading, 
  error, 
  totalResults, 
  currentPage, 
  onNextPage, 
  onPreviousPage, 
  onComplete 
}) {
  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }
  
  if (isLoading && results.length === 0) {
    return <div className="loading">Searching...</div>;
  }
  
  return (
    <div className="search-results">
      {results.length > 0 ? (
        <>
          <div className="results-stats">
            Found {totalResults} results
          </div>
          
          <ul className="results-list">
            {results.map((result, index) => (
              <li key={index} className="result-item">
                <h3>
                  <a href={result.url} target="_blank" rel="noopener noreferrer">
                    {result.title}
                  </a>
                </h3>
                <div className="result-url">{result.url}</div>
                <div className="result-description">{result.description}</div>
              </li>
            ))}
          </ul>
          
          <div className="pagination">
            <button 
              onClick={onPreviousPage}
              disabled={isLoading || currentPage === 0}
              className="pagination-button"
            >
              Previous
            </button>
            <span className="page-indicator">Page {currentPage + 1}</span>
            <button 
              onClick={onNextPage}
              disabled={isLoading || (currentPage + 1) * results.length >= totalResults}
              className="pagination-button"
            >
              Next
            </button>
          </div>
          
          <button 
            onClick={onComplete}
            className="complete-button"
          >
            Use These Results
          </button>
        </>
      ) : (
        <div className="no-results">
          No results found. Try refining your search query.
        </div>
      )}
    </div>
  );
}

export default SearchResults;
```

### ImageGallery

```jsx
import React from 'react';

function ImageGallery({ images, isLoading, error, onComplete }) {
  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }
  
  if (isLoading && images.length === 0) {
    return <div className="loading">Generating images...</div>;
  }
  
  return (
    <div className="image-gallery">
      {images.length > 0 ? (
        <>
          <div className="gallery-grid">
            {images.map((image, index) => (
              <div key={index} className="image-item">
                <img 
                  src={image.url} 
                  alt={`Generated image ${index + 1}`}
                  loading="lazy"
                />
                <div className="image-caption">Image {index + 1}</div>
              </div>
            ))}
          </div>
          
          <button 
            onClick={onComplete}
            className="complete-button"
          >
            Complete Research
          </button>
        </>
      ) : (
        <div className="no-images">
          No images generated. Try a different prompt.
        </div>
      )}
    </div>
  );
}

export default ImageGallery;
```

### ProgressTracker

```jsx
import React from 'react';

function ProgressTracker({ level, score, completedTopics }) {
  return (
    <div className="progress-tracker">
      <div className="progress-item level">
        <span className="label">Level</span>
        <span className="value">{level}</span>
      </div>
      <div className="progress-item score">
        <span className="label">Score</span>
        <span className="value">{score}</span>
      </div>
      <div className="progress-item topics">
        <span className="label">Topics</span>
        <span className="value">{completedTopics}</span>
      </div>
    </div>
  );
}

export default ProgressTracker;
```

## Styling

You can add this CSS to style the application:

```css
.research-assistant {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  font-family: system-ui, -apple-system, sans-serif;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e0e0e0;
}

header h1 {
  margin: 0;
}

.progress-tracker {
  display: flex;
  gap: 20px;
}

.progress-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 15px;
  border-radius: 8px;
  background-color: #f5f5f5;
}

.progress-item .label {
  font-size: 14px;
  color: #666;
}

.progress-item .value {
  font-size: 20px;
  font-weight: 600;
  color: #0070f3;
}

.research-progress {
  display: flex;
  justify-content: space-between;
  margin: 30px 0;
}

.step {
  flex: 1;
  padding: 15px;
  text-align: center;
  background-color: #f9f9f9;
  border: 1px solid #e0e0e0;
  position: relative;
}

.step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -15px;
  width: 30px;
  height: 2px;
  background-color: #e0e0e0;
  z-index: 1;
}

.step.active {
  background-color: #f0f7ff;
  border-color: #0070f3;
  font-weight: 600;
}

.step.completed {
  background-color: #e8f5e9;
  border-color: #4caf50;
}

.step-content {
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  min-height: 400px;
}

button {
  padding: 10px 15px;
  background-color: #0070f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  margin-right: 10px;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.complete-button {
  background-color: #4caf50;
}

.error-message {
  color: #d32f2f;
  padding: 10px;
  background-color: #ffebee;
  border-radius: 4px;
}

.loading {
  padding: 20px;
  text-align: center;
  color: #666;
}

/* Add more specific styles for each component as needed */
```

## Backend API Routes

For this example to work, you'll need to set up the necessary backend API routes to communicate with the MCP tools:

```javascript
// routes/mcp/sequential-thinking.js
const express = require('express');
const router = express.Router();

router.post('/generate', async (req, res) => {
  // Implementation for sequential thinking generation
});

router.post('/continue', async (req, res) => {
  // Implementation for continuing thinking
});

router.post('/revise', async (req, res) => {
  // Implementation for revising a thought
});

router.post('/conclude', async (req, res) => {
  // Implementation for generating a conclusion
});

module.exports = router;

// routes/mcp/brave-search.js
const express = require('express');
const router = express.Router();

router.post('/web', async (req, res) => {
  // Implementation for web search
});

router.post('/local', async (req, res) => {
  // Implementation for local search
});

module.exports = router;

// routes/mcp/imagen.js
const express = require('express');
const router = express.Router();

router.post('/generate', async (req, res) => {
  // Implementation for image generation
});

router.get('/get/:id', async (req, res) => {
  // Implementation for retrieving generated images
});

router.get('/list', async (req, res) => {
  // Implementation for listing all generated images
});

router.post('/html', async (req, res) => {
  // Implementation for creating gallery HTML
});

module.exports = router;
```

## Key Benefits

This comprehensive example demonstrates several key benefits of using MCP hooks:

1. **Component Separation**: Each MCP tool is encapsulated in its own hook, allowing clean separation of concerns.

2. **State Management**: Loading states, errors, and results are managed consistently across all tools.

3. **Progress Tracking**: The application tracks user progress using the game state hook, providing persistence.

4. **Workflow Orchestration**: The hooks work together to create a cohesive research workflow, with each step building on the previous one.

5. **Reusable Logic**: The MCP hooks can be reused across different components and features of the application.

6. **Consistent Error Handling**: All hooks follow the same pattern for error handling, making it easy to display errors consistently.

7. **Loading States**: Each hook provides isLoading state, making it easy to show loading indicators.

By leveraging MCP hooks, this application provides a powerful, AI-enhanced user experience with minimal boilerplate code.