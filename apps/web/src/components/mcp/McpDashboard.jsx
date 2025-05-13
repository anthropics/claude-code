import React, { useState } from 'react';
import McpThinkingDemo from './McpThinkingDemo';
import McpSearchDemo from './McpSearchDemo';
import McpImageDemo from './McpImageDemo';
import McpSequentialPlannerDemo from './McpSequentialPlannerDemo';
import McpDocumentationGenerator from './McpDocumentationGenerator';
import { useMcpGameState } from "./../hooks/mcp";

/**
 * MCP Dashboard
 * 
 * This component provides a dashboard for demonstrating the MCP hooks
 * and their integration with various MCP tools.
 */
function McpDashboard() {
  const [activeTab, setActiveTab] = useState('thinking');
  const { gameState, isLoading: gameStateLoading } = useMcpGameState();

  // Render the active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'thinking':
        return <McpThinkingDemo />;
      case 'search':
        return <McpSearchDemo />;
      case 'image':
        return <McpImageDemo />;
      case 'planner':
        return <McpSequentialPlannerDemo />;
      case 'documentation':
        return <McpDocumentationGenerator />;
      default:
        return <div>Select a tab to explore MCP tools</div>;
    }
  };

  return (
    <div className="mcp-dashboard">
      <header className="dashboard-header">
        <h1>MCP Integration Dashboard</h1>
        <p>Explore the capabilities of MCP tools through React hooks</p>
        
        {!gameStateLoading && gameState && (
          <div className="game-state">
            <span className="level">Level: {gameState.level}</span>
            <span className="score">Score: {gameState.score}</span>
          </div>
        )}
      </header>
      
      <nav className="tab-navigation">
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
          Web Search
        </button>
        <button
          className={`tab-button ${activeTab === 'image' ? 'active' : ''}`}
          onClick={() => setActiveTab('image')}
        >
          Image Generation
        </button>
        <button
          className={`tab-button ${activeTab === 'planner' ? 'active' : ''}`}
          onClick={() => setActiveTab('planner')}
        >
          Sequential Planner
        </button>
        <button
          className={`tab-button ${activeTab === 'documentation' ? 'active' : ''}`}
          onClick={() => setActiveTab('documentation')}
        >
          Doc Generator
        </button>
      </nav>
      
      <main className="tab-content">
        {renderTabContent()}
      </main>
      
      <footer className="dashboard-footer">
        <p>Claude Neural Framework MCP Integration &copy; {new Date().getFullYear()}</p>
      </footer>
      
      <style jsx>{`
        .mcp-dashboard {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        .dashboard-header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 1px solid #e0e0e0;
          position: relative;
        }
        
        .dashboard-header h1 {
          margin-bottom: 10px;
          color: #333;
        }
        
        .dashboard-header p {
          color: #666;
          margin: 0;
        }
        
        .game-state {
          position: absolute;
          top: 10px;
          right: 10px;
          background-color: #f0f7ff;
          padding: 8px 15px;
          border-radius: 20px;
          border: 1px solid #0070f3;
          font-size: 14px;
          display: flex;
          gap: 15px;
        }
        
        .level {
          font-weight: 600;
          color: #0070f3;
        }
        
        .score {
          font-weight: 600;
          color: #333;
        }
        
        .tab-navigation {
          display: flex;
          justify-content: center;
          margin-bottom: 30px;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .tab-button {
          padding: 10px 20px;
          background-color: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          color: #666;
          transition: all 0.2s ease;
        }
        
        .tab-button:hover {
          color: #0070f3;
        }
        
        .tab-button.active {
          color: #0070f3;
          border-bottom-color: #0070f3;
        }
        
        .tab-content {
          min-height: 500px;
          padding: 20px;
          background-color: #f9f9f9;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .dashboard-footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
          text-align: center;
          color: #666;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}

export default McpDashboard;