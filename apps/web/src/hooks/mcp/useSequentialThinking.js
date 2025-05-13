/**
 * Sequential Thinking React Hook - Proxy Module
 * 
 * This module re-exports the Sequential Thinking hook from the claude-framework
 * to ensure backward compatibility while avoiding code duplication.
 * 
 * IMPORTANT: This file is maintained for backward compatibility.
 * New code should import directly from the claude-framework:
 * import { useMcpSequentialThinking } from 'claude-framework/libs/workflows/src/sequential';
 */

import { useState } from 'react';

/**
 * MCP-integrated sequential thinking hook
 * 
 * This hook provides access to the sequential thinking MCP tool
 * for step-by-step thought generation and problem solving.
 */
export function useMcpSequentialThinking() {
  const [thoughts, setThoughts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentThought, setCurrentThought] = useState(null);
  const [isComplete, setIsComplete] = useState(false);

  // Generate thoughts for a given problem
  const generateThoughts = async (problem, options = {}) => {
    try {
      setIsLoading(true);
      setError(null);
      setThoughts([]);
      setIsComplete(false);

      const defaultOptions = {
        initialThoughtCount: 3,
        maxThoughts: 10,
        thoughtDepth: 'medium',
        allowRevisions: true
      };

      const mergedOptions = { ...defaultOptions, ...options };
      
      // Call MCP sequential thinking API
      const response = await fetch('/api/mcp/sequential-thinking/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          problem,
          options: mergedOptions
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate thoughts');
      }

      const data = await response.json();
      setThoughts(data.thoughts || []);
      
      // Set the last thought as current
      if (data.thoughts && data.thoughts.length > 0) {
        setCurrentThought(data.thoughts[data.thoughts.length - 1]);
      }
      
      setIsComplete(data.isComplete || false);
      return data.thoughts || [];
    } catch (err) {
      console.error('Error generating thoughts:', err);
      setError('Failed to generate thoughts');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Continue thinking by adding more thoughts
  const continueThinking = async () => {
    if (isComplete || !thoughts.length) return [];
    
    try {
      setIsLoading(true);
      setError(null);

      // Call MCP sequential thinking API to continue
      const response = await fetch('/api/mcp/sequential-thinking/continue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          previousThoughts: thoughts
        })
      });

      if (!response.ok) {
        throw new Error('Failed to continue thinking');
      }

      const data = await response.json();
      const updatedThoughts = [...thoughts, ...(data.newThoughts || [])];
      setThoughts(updatedThoughts);
      
      // Set the last thought as current
      if (data.newThoughts && data.newThoughts.length > 0) {
        setCurrentThought(data.newThoughts[data.newThoughts.length - 1]);
      }
      
      setIsComplete(data.isComplete || false);
      return updatedThoughts;
    } catch (err) {
      console.error('Error continuing thinking:', err);
      setError('Failed to continue thinking');
      return thoughts;
    } finally {
      setIsLoading(false);
    }
  };

  // Revise a specific thought
  const reviseThought = async (thoughtIndex, revision) => {
    if (thoughtIndex < 0 || thoughtIndex >= thoughts.length) {
      setError(`Invalid thought index: ${thoughtIndex}`);
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Call MCP sequential thinking API to revise
      const response = await fetch('/api/mcp/sequential-thinking/revise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          thoughts,
          thoughtIndex,
          revision
        })
      });

      if (!response.ok) {
        throw new Error('Failed to revise thought');
      }

      const data = await response.json();
      setThoughts(data.updatedThoughts || thoughts);
      
      // Update current thought if it was revised
      if (currentThought && currentThought.number === thoughtIndex) {
        setCurrentThought(data.updatedThoughts[thoughtIndex]);
      }
      
      return true;
    } catch (err) {
      console.error('Error revising thought:', err);
      setError('Failed to revise thought');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Get a conclusion based on all thoughts
  const getConclusion = async () => {
    if (!thoughts.length) {
      setError('No thoughts to conclude from');
      return null;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Call MCP sequential thinking API to get conclusion
      const response = await fetch('/api/mcp/sequential-thinking/conclude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          thoughts
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get conclusion');
      }

      const data = await response.json();
      return data.conclusion || null;
    } catch (err) {
      console.error('Error getting conclusion:', err);
      setError('Failed to get conclusion');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    thoughts,
    currentThought,
    isLoading,
    error,
    isComplete,
    generateThoughts,
    continueThinking,
    reviseThought,
    getConclusion
  };
}

// Log a deprecation warning
if (process.env.NODE_ENV !== 'production') {
  console.warn(
    'WARNING: Importing from src/hooks/mcp/useSequentialThinking.js is deprecated. ' +
    'Please update your imports to use the framework implementation directly:\n' +
    'import { useMcpSequentialThinking } from "claude-framework/libs/workflows/src/sequential";'
  );
}

export default useMcpSequentialThinking;