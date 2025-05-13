import React, { useState } from 'react';
import { useMcpBraveSearch } from "./../hooks/mcp";

/**
 * MCP Search Demo
 * 
 * This component demonstrates how to use the useMcpBraveSearch hook
 * for web and local search capabilities using the MCP Brave Search tool.
 */
function McpSearchDemo() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('web');
  
  const {
    results,
    isLoading,
    error,
    totalResults,
    currentPage,
    searchWeb,
    searchLocal,
    nextPage,
    previousPage
  } = useMcpBraveSearch();

  // Handle search submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    if (searchType === 'web') {
      await searchWeb(query);
    } else {
      await searchLocal(query);
    }
  };

  return (
    <div className="mcp-search-demo">
      <h2>Web Search with MCP</h2>
      
      <form onSubmit={handleSubmit} className="search-form">
        <div className="form-group">
          <label htmlFor="query">Search Query:</label>
          <input 
            type="text"
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your search query..."
            required
          />
        </div>
        
        <div className="form-group">
          <label className="radio-label">
            <input 
              type="radio" 
              name="searchType" 
              value="web"
              checked={searchType === 'web'}
              onChange={() => setSearchType('web')}
            />
            Web Search
          </label>
          <label className="radio-label">
            <input 
              type="radio" 
              name="searchType" 
              value="local"
              checked={searchType === 'local'}
              onChange={() => setSearchType('local')}
            />
            Local Search
          </label>
        </div>
        
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>
      
      {error && (
        <div className="error-message">Error: {error}</div>
      )}
      
      {results.length > 0 && (
        <div className="results-container">
          <div className="results-stats">
            Found {totalResults} results
          </div>
          
          <ul className="results-list">
            {results.map((result, index) => (
              <li key={index} className="result-item">
                {searchType === 'web' ? (
                  <>
                    <h3>
                      <a href={result.url} target="_blank" rel="noopener noreferrer">
                        {result.title}
                      </a>
                    </h3>
                    <div className="result-url">{result.url}</div>
                    <div className="result-description">{result.description}</div>
                  </>
                ) : (
                  <>
                    <h3>{result.name}</h3>
                    <div className="result-address">{result.address}</div>
                    {result.rating && (
                      <div className="result-rating">Rating: {result.rating} ⭐</div>
                    )}
                    {result.phone && (
                      <div className="result-phone">{result.phone}</div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          
          <div className="pagination">
            <button 
              onClick={previousPage}
              disabled={isLoading || currentPage === 0}
              className="pagination-button"
            >
              Previous
            </button>
            <span className="page-indicator">Page {currentPage + 1}</span>
            <button 
              onClick={nextPage}
              disabled={isLoading || (currentPage + 1) * results.length >= totalResults}
              className="pagination-button"
            >
              Next
            </button>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .mcp-search-demo {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        .search-form {
          margin-bottom: 30px;
          display: flex;
          align-items: flex-end;
          flex-wrap: wrap;
        }
        
        .form-group {
          margin-right: 15px;
          margin-bottom: 15px;
          flex: 1;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 600;
        }
        
        .radio-label {
          display: inline-flex;
          align-items: center;
          margin-right: 15px;
          font-weight: normal;
        }
        
        input[type="text"] {
          width: 100%;
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 16px;
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
          height: 42px;
        }
        
        button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .error-message {
          color: #d32f2f;
          margin: 10px 0;
          padding: 10px;
          background-color: #ffebee;
          border-radius: 4px;
        }
        
        .results-container {
          margin-top: 30px;
        }
        
        .results-stats {
          margin-bottom: 15px;
          color: #666;
        }
        
        .results-list {
          list-style: none;
          padding: 0;
        }
        
        .result-item {
          margin-bottom: 20px;
          padding: 15px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          background-color: #f9f9f9;
        }
        
        .result-item h3 {
          margin-top: 0;
          margin-bottom: 5px;
        }
        
        .result-item h3 a {
          color: #1a0dab;
          text-decoration: none;
        }
        
        .result-item h3 a:hover {
          text-decoration: underline;
        }
        
        .result-url {
          color: #006621;
          margin-bottom: 5px;
          font-size: 14px;
        }
        
        .result-description {
          line-height: 1.5;
          color: #333;
        }
        
        .result-address, .result-phone {
          margin-bottom: 5px;
          color: #555;
        }
        
        .result-rating {
          color: #f57c00;
          margin-bottom: 5px;
        }
        
        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-top: 20px;
        }
        
        .pagination-button {
          margin: 0 10px;
        }
        
        .page-indicator {
          color: #555;
        }
      `}</style>
    </div>
  );
}

export default McpSearchDemo;