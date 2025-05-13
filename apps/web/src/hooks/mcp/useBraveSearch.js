import { useState } from 'react';

/**
 * MCP-integrated brave search hook
 * 
 * This hook provides access to the Brave Search MCP tool
 * for web and local search capabilities.
 */
export function useMcpBraveSearch() {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastQuery, setLastQuery] = useState('');
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);

  // Perform a web search
  const searchWeb = async (query, options = {}) => {
    if (!query || query.trim() === '') {
      setError('Search query is required');
      return [];
    }

    try {
      setIsLoading(true);
      setError(null);
      setLastQuery(query);

      const defaultOptions = {
        count: 10,
        offset: 0,
        safeSearch: true,
        freshness: null, // null, 'past-day', 'past-week', 'past-month'
        allowedDomains: [],
        blockedDomains: []
      };

      const mergedOptions = { ...defaultOptions, ...options };
      setCurrentPage(Math.floor(mergedOptions.offset / mergedOptions.count));
      
      // Call MCP brave search API
      const response = await fetch('/api/mcp/brave-search/web', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          options: mergedOptions
        })
      });

      if (!response.ok) {
        throw new Error('Failed to perform web search');
      }

      const data = await response.json();
      setResults(data.results || []);
      setTotalResults(data.totalResults || 0);
      return data.results || [];
    } catch (err) {
      console.error('Error performing web search:', err);
      setError('Failed to perform web search');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Perform a local search for places and businesses
  const searchLocal = async (query, options = {}) => {
    if (!query || query.trim() === '') {
      setError('Search query is required');
      return [];
    }

    try {
      setIsLoading(true);
      setError(null);
      setLastQuery(query);

      const defaultOptions = {
        count: 5,
        location: null // null for auto-detect, or "latitude,longitude"
      };

      const mergedOptions = { ...defaultOptions, ...options };
      
      // Call MCP brave search API for local search
      const response = await fetch('/api/mcp/brave-search/local', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          options: mergedOptions
        })
      });

      if (!response.ok) {
        throw new Error('Failed to perform local search');
      }

      const data = await response.json();
      setResults(data.results || []);
      setTotalResults(data.totalResults || 0);
      return data.results || [];
    } catch (err) {
      console.error('Error performing local search:', err);
      setError('Failed to perform local search');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate to the next page of results
  const nextPage = () => {
    if (isLoading || !lastQuery) return;
    
    const nextOffset = (currentPage + 1) * (results.length || 10);
    if (nextOffset >= totalResults) return;
    
    return searchWeb(lastQuery, {
      offset: nextOffset,
      count: results.length || 10
    });
  };

  // Navigate to the previous page of results
  const previousPage = () => {
    if (isLoading || !lastQuery || currentPage <= 0) return;
    
    const prevOffset = (currentPage - 1) * (results.length || 10);
    return searchWeb(lastQuery, {
      offset: prevOffset,
      count: results.length || 10
    });
  };

  return {
    results,
    isLoading,
    error,
    totalResults,
    currentPage,
    lastQuery,
    searchWeb,
    searchLocal,
    nextPage,
    previousPage
  };
}

export default useMcpBraveSearch;