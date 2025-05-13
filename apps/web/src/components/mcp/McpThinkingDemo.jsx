import React, { useState } from 'react';
import { useMcpSequentialThinking } from "./../hooks/mcp";

/**
 * MCP Sequential Thinking Demo
 * 
 * This component demonstrates how to use the useMcpSequentialThinking hook
 * for step-by-step problem solving with the MCP sequential thinking tool.
 */
function McpThinkingDemo() {
  const [problem, setProblem] = useState('');
  const [conclusion, setConclusion] = useState('');
  
  const {
    thoughts,
    currentThought,
    isLoading,
    error,
    isComplete,
    generateThoughts,
    continueThinking,
    reviseThought,
    getConclusion
  } = useMcpSequentialThinking();

  // Handle problem submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!problem.trim()) return;
    
    await generateThoughts(problem);
    setConclusion('');
  };

  // Handle continuing the thinking process
  const handleContinue = async () => {
    await continueThinking();
  };

  // Handle getting a conclusion
  const handleGetConclusion = async () => {
    const result = await getConclusion();
    if (result) {
      setConclusion(result);
    }
  };

  // Handle revising a thought
  const handleRevise = async (index) => {
    const revision = prompt('Enter your revision for this thought:');
    if (revision) {
      await reviseThought(index, revision);
    }
  };

  return (
    <div className="mcp-thinking-demo">
      <h2>Sequential Thinking with MCP</h2>
      
      <form onSubmit={handleSubmit} className="problem-form">
        <div className="form-group">
          <label htmlFor="problem">Enter Problem or Question:</label>
          <textarea 
            id="problem"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="Describe the problem to think through..."
            rows={3}
            required
          />
        </div>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Thinking...' : 'Start Thinking Process'}
        </button>
      </form>
      
      {error && (
        <div className="error-message">Error: {error}</div>
      )}
      
      {thoughts.length > 0 && (
        <div className="thoughts-container">
          <h3>Thinking Process</h3>
          
          <ul className="thoughts-list">
            {thoughts.map((thought, index) => (
              <li 
                key={index} 
                className={`thought ${currentThought && currentThought.number === thought.number ? 'current' : ''}`}
              >
                <div className="thought-number">
                  Thought {thought.number} {thought.isRevision && '(Revised)'}
                </div>
                <div className="thought-content">{thought.content}</div>
                <button 
                  onClick={() => handleRevise(index)}
                  className="revise-button"
                >
                  Revise
                </button>
              </li>
            ))}
          </ul>
          
          <div className="thinking-controls">
            {!isComplete && (
              <button 
                onClick={handleContinue} 
                disabled={isLoading || isComplete}
                className="continue-button"
              >
                {isLoading ? 'Thinking...' : 'Continue Thinking'}
              </button>
            )}
            
            <button 
              onClick={handleGetConclusion}
              disabled={isLoading || thoughts.length === 0}
              className="conclude-button"
            >
              Get Conclusion
            </button>
          </div>
          
          {conclusion && (
            <div className="conclusion">
              <h3>Conclusion</h3>
              <p>{conclusion}</p>
            </div>
          )}
        </div>
      )}
      
      <style jsx>{`
        .mcp-thinking-demo {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        .problem-form {
          margin-bottom: 30px;
        }
        
        .form-group {
          margin-bottom: 15px;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 600;
        }
        
        textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 16px;
          font-family: inherit;
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
        
        .error-message {
          color: #d32f2f;
          margin: 10px 0;
          padding: 10px;
          background-color: #ffebee;
          border-radius: 4px;
        }
        
        .thoughts-container {
          margin-top: 30px;
        }
        
        .thoughts-list {
          list-style: none;
          padding: 0;
        }
        
        .thought {
          margin-bottom: 20px;
          padding: 15px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          background-color: #f9f9f9;
        }
        
        .thought.current {
          border-color: #0070f3;
          background-color: #f0f7ff;
        }
        
        .thought-number {
          font-weight: 600;
          margin-bottom: 5px;
          color: #0070f3;
        }
        
        .thought-content {
          line-height: 1.5;
          margin-bottom: 10px;
        }
        
        .revise-button {
          background-color: #f5f5f5;
          color: #333;
          border: 1px solid #ccc;
        }
        
        .thinking-controls {
          margin: 20px 0;
        }
        
        .conclusion {
          margin-top: 20px;
          padding: 15px;
          background-color: #e8f5e9;
          border-radius: 4px;
          border-left: 4px solid #4caf50;
        }
      `}</style>
    </div>
  );
}

export default McpThinkingDemo;