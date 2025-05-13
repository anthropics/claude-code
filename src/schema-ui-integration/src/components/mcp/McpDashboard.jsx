import React, { useState, useEffect } from 'react';
import {
  useMcpSequentialThinking,
  useMcpBraveSearch,
  useMcpImageGeneration,
  useMcp21stDevMagic,
  useMcpRealTimeUpdates
} from '../../../src/hooks/mcp';

/**
 * MCP Dashboard Component
 * 
 * This is a demonstration component that shows how to integrate with
 * various MCP tools using the new MCP hooks library.
 */
const McpDashboard = () => {
  // State for active tab
  const [activeTab, setActiveTab] = useState('thinking');
  
  // MCP hooks
  const thinking = useMcpSequentialThinking();
  const search = useMcpBraveSearch();
  const images = useMcpImageGeneration();
  const components = useMcp21stDevMagic();
  const realTime = useMcpRealTimeUpdates();
  
  // Thinking state
  const [thinkingPrompt, setThinkingPrompt] = useState('');
  const [thoughts, setThoughts] = useState([]);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  // Image generation state
  const [imagePrompt, setImagePrompt] = useState('');
  const [generatedImages, setGeneratedImages] = useState([]);
  
  // Component generation state
  const [componentPrompt, setComponentPrompt] = useState('');
  const [generatedComponent, setGeneratedComponent] = useState('');
  
  // Handle thinking submission
  const handleThinking = async () => {
    if (!thinkingPrompt) return;
    
    const result = await thinking.generateThoughts(thinkingPrompt, {
      totalThoughts: 5
    });
    
    if (result) {
      // Add the new thought to the list
      setThoughts(prev => [...prev, result]);
    }
  };
  
  // Handle search submission
  const handleSearch = async () => {
    if (!searchQuery) return;
    
    const results = await search.search(searchQuery);
    if (results) {
      setSearchResults(results);
    }
  };
  
  // Handle image generation
  const handleImageGeneration = async () => {
    if (!imagePrompt) return;
    
    const result = await images.generateImages(imagePrompt, {
      numberOfImages: 2
    });
    
    if (result) {
      setGeneratedImages(result);
    }
  };
  
  // Handle component generation
  const handleComponentGeneration = async () => {
    if (!componentPrompt) return;
    
    const result = await components.generateComponent(componentPrompt);
    if (result) {
      setGeneratedComponent(result.code || '');
    }
  };
  
  // Update real-time data when it changes
  useEffect(() => {
    if (realTime.data) {
      console.log('Real-time update received:', realTime.data);
    }
  }, [realTime.data]);
  
  return (
    <div className="mcp-dashboard">
      <h1>MCP Integration Dashboard</h1>
      
      {/* Navigation Tabs */}
      <div className="mcp-tabs">
        <button 
          className={`tab-button ${activeTab === 'thinking' ? 'active' : ''}`}
          onClick={() => setActiveTab('thinking')}
        >
          Sequential Thinking
        </button>
        <button 
          className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          Search
        </button>
        <button 
          className={`tab-button ${activeTab === 'images' ? 'active' : ''}`}
          onClick={() => setActiveTab('images')}
        >
          Image Generation
        </button>
        <button 
          className={`tab-button ${activeTab === 'components' ? 'active' : ''}`}
          onClick={() => setActiveTab('components')}
        >
          UI Components
        </button>
        <button 
          className={`tab-button ${activeTab === 'realtime' ? 'active' : ''}`}
          onClick={() => setActiveTab('realtime')}
        >
          Real-Time Updates
        </button>
      </div>
      
      {/* Content Area */}
      <div className="mcp-content">
        {/* Sequential Thinking */}
        {activeTab === 'thinking' && (
          <div className="thinking-section">
            <h2>Sequential Thinking</h2>
            
            <div className="input-group">
              <textarea
                value={thinkingPrompt}
                onChange={(e) => setThinkingPrompt(e.target.value)}
                placeholder="Enter a thought to start the thinking process..."
                rows={3}
              />
              
              <button 
                onClick={handleThinking} 
                disabled={thinking.isLoading || !thinkingPrompt}
              >
                {thinking.isLoading ? 'Thinking...' : 'Think'}
              </button>
            </div>
            
            {thinking.error && (
              <div className="error-message">{thinking.error}</div>
            )}
            
            <div className="thoughts-list">
              {thoughts.length > 0 ? (
                thoughts.map((thought, index) => (
                  <div key={index} className="thought-card">
                    <h3>Thought {thought.thoughtNumber}/{thought.totalThoughts}</h3>
                    <p>{thought.thought}</p>
                    {thought.nextThoughtNeeded && (
                      <div className="continue-thinking">
                        <button
                          onClick={() => thinking.generateThoughts(thought.thought, {
                            thoughtNumber: thought.thoughtNumber + 1,
                            totalThoughts: thought.totalThoughts,
                            branchFromThought: thought.thoughtNumber
                          })}
                          disabled={thinking.isLoading}
                        >
                          Continue Thinking
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p>No thoughts generated yet. Enter a prompt to start thinking.</p>
              )}
            </div>
          </div>
        )}
        
        {/* Search */}
        {activeTab === 'search' && (
          <div className="search-section">
            <h2>Brave Search</h2>
            
            <div className="input-group">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter search query..."
              />
              
              <button 
                onClick={handleSearch} 
                disabled={search.isLoading || !searchQuery}
              >
                {search.isLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
            
            {search.error && (
              <div className="error-message">{search.error}</div>
            )}
            
            <div className="search-results">
              {searchResults.length > 0 ? (
                <div>
                  <h3>Search Results</h3>
                  <ul className="results-list">
                    {searchResults.map((result, index) => (
                      <li key={index} className="result-item">
                        <h4>{result.title}</h4>
                        <p>{result.description}</p>
                        <a href={result.url} target="_blank" rel="noopener noreferrer">{result.url}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p>No search results. Try searching for something.</p>
              )}
            </div>
          </div>
        )}
        
        {/* Image Generation */}
        {activeTab === 'images' && (
          <div className="images-section">
            <h2>Image Generation</h2>
            
            <div className="input-group">
              <input
                type="text"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="Describe the image you want to generate..."
              />
              
              <button 
                onClick={handleImageGeneration} 
                disabled={images.isLoading || !imagePrompt}
              >
                {images.isLoading ? 'Generating...' : 'Generate Images'}
              </button>
            </div>
            
            {images.error && (
              <div className="error-message">{images.error}</div>
            )}
            
            <div className="image-gallery">
              {generatedImages.length > 0 ? (
                generatedImages.map((image, index) => (
                  <div key={index} className="image-card">
                    <img src={image.url} alt={`Generated from: ${imagePrompt}`} />
                    <div className="image-actions">
                      <a href={image.url} download target="_blank" rel="noopener noreferrer">Download</a>
                    </div>
                  </div>
                ))
              ) : (
                <p>No images generated yet. Enter a prompt to create images.</p>
              )}
            </div>
          </div>
        )}
        
        {/* UI Component Generation */}
        {activeTab === 'components' && (
          <div className="components-section">
            <h2>UI Component Generation</h2>
            
            <div className="input-group">
              <textarea
                value={componentPrompt}
                onChange={(e) => setComponentPrompt(e.target.value)}
                placeholder="Describe the UI component you want to generate..."
                rows={3}
              />
              
              <button 
                onClick={handleComponentGeneration} 
                disabled={components.isLoading || !componentPrompt}
              >
                {components.isLoading ? 'Generating...' : 'Generate Component'}
              </button>
            </div>
            
            {components.error && (
              <div className="error-message">{components.error}</div>
            )}
            
            {generatedComponent && (
              <div className="component-output">
                <h3>Generated Component Code</h3>
                <pre className="code-block">{generatedComponent}</pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedComponent);
                    alert('Component code copied to clipboard');
                  }}
                >
                  Copy Code
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Real-Time Updates */}
        {activeTab === 'realtime' && (
          <div className="realtime-section">
            <h2>Real-Time MCP Updates</h2>
            
            <div className="connection-status">
              <div className={`status-indicator ${realTime.status}`}></div>
              <span>Status: {realTime.status}</span>
              
              {realTime.error && (
                <div className="error-message">{realTime.error}</div>
              )}
            </div>
            
            <div className="real-time-data">
              <h3>Latest Updates</h3>
              {realTime.data ? (
                <pre className="data-display">{JSON.stringify(realTime.data, null, 2)}</pre>
              ) : (
                <p>No updates received yet. Waiting for data...</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default McpDashboard;