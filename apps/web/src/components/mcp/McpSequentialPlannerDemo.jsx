import React, { useState } from 'react';
import useSequentialPlanner from "./../hooks/mcp/useSequentialPlanner";

/**
 * Sequential Planner Demo Component
 * 
 * This component demonstrates the usage of the Sequential Execution Manager
 * through the useSequentialPlanner hook.
 */
function McpSequentialPlannerDemo() {
  // State
  const [domain, setDomain] = useState('documentation');
  const [goal, setGoal] = useState('');
  const [fallbackMode, setFallbackMode] = useState(true);
  
  // Use the sequential planner hook
  const {
    plan,
    currentStep,
    executedSteps,
    isLoading,
    error,
    isComplete,
    summary,
    generatePlan,
    executeCurrentStep,
    skipCurrentStep,
    resetPlanner,
    runEntirePlan
  } = useSequentialPlanner({
    domain,
    fallbackMode,
    maxSteps: 10,
    planningDepth: 'medium'
  });
  
  // Handle domain change
  const handleDomainChange = (e) => {
    setDomain(e.target.value);
    resetPlanner();
  };
  
  // Handle goal submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (\!goal) {
      return;
    }
    
    try {
      await generatePlan(goal);
    } catch (err) {
      console.error('Error generating plan:', err);
    }
  };
  
  // Handle step execution
  const handleExecuteStep = async () => {
    if (\!currentStep) return;
    
    try {
      await executeCurrentStep();
    } catch (err) {
      console.error('Error executing step:', err);
    }
  };
  
  // Handle step skip
  const handleSkipStep = async () => {
    if (\!currentStep) return;
    
    try {
      await skipCurrentStep();
    } catch (err) {
      console.error('Error skipping step:', err);
    }
  };
  
  // Handle automatic execution
  const handleAutoExecute = async () => {
    if (\!plan || plan.length === 0) return;
    
    try {
      await runEntirePlan();
    } catch (err) {
      console.error('Error running entire plan:', err);
    }
  };
  
  // Reset the planner
  const handleReset = () => {
    resetPlanner();
    setGoal('');
  };
  
  // Render
  return (
    <div className="sequential-planner-demo">
      <h1>Sequential Planner Demo</h1>
      
      {/* Controls */}
      <div className="controls">
        <div className="form-group">
          <label htmlFor="domain">Domain:</label>
          <select 
            id="domain" 
            value={domain} 
            onChange={handleDomainChange}
            disabled={isLoading || plan?.length > 0}
          >
            <option value="documentation">Documentation</option>
            <option value="cicd">CI/CD</option>
            <option value="data">Data Processing</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="fallbackMode">
            <input 
              type="checkbox" 
              id="fallbackMode" 
              checked={fallbackMode} 
              onChange={(e) => setFallbackMode(e.target.checked)}
              disabled={isLoading || plan?.length > 0}
            />
            Fallback Mode (No MCP)
          </label>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="goal">Goal:</label>
            <input 
              type="text" 
              id="goal" 
              value={goal} 
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Enter a goal..."
              disabled={isLoading}
              required
            />
          </div>
          
          <div className="button-group">
            <button 
              type="submit" 
              disabled={isLoading || \!goal}
            >
              Generate Plan
            </button>
            
            <button 
              type="button" 
              onClick={handleReset}
              disabled={isLoading}
            >
              Reset
            </button>
          </div>
        </form>
      </div>
      
      {/* Error display */}
      {error && (
        <div className="error">
          <h3>Error:</h3>
          <p>{error}</p>
        </div>
      )}
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="loading">
          <p>Loading...</p>
        </div>
      )}
      
      {/* Plan display */}
      {plan && plan.length > 0 && (
        <div className="plan">
          <h2>Plan:</h2>
          <ul>
            {plan.map((step) => (
              <li key={step.id} className={`step ${step.status}`}>
                <div className="step-header">
                  <span className="step-number">Step {step.number}:</span>
                  <span className="step-action">{step.actionType}</span>
                  <span className="step-status">{step.status}</span>
                </div>
                <div className="step-description">{step.description}</div>
                {step.status === 'completed' && step.result && (
                  <div className="step-result">
                    <small>{step.result.summary}</small>
                  </div>
                )}
              </li>
            ))}
          </ul>
          
          {/* Step execution controls */}
          {currentStep && (
            <div className="step-controls">
              <h3>Current Step: {currentStep.number}</h3>
              <p>{currentStep.description}</p>
              
              <div className="button-group">
                <button 
                  onClick={handleExecuteStep}
                  disabled={isLoading}
                >
                  Execute Step
                </button>
                
                <button 
                  onClick={handleSkipStep}
                  disabled={isLoading}
                >
                  Skip Step
                </button>
                
                <button 
                  onClick={handleAutoExecute}
                  disabled={isLoading}
                >
                  Execute All Remaining Steps
                </button>
              </div>
            </div>
          )}
          
          {/* Completion message */}
          {isComplete && (
            <div className="completion">
              <h3>Plan Execution Complete\!</h3>
              {summary && (
                <div className="summary">
                  <h4>Summary:</h4>
                  <p>{summary}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Default domain suggestions */}
      {\!plan && (
        <div className="suggestions">
          <h3>Example Goals:</h3>
          <ul>
            {domain === 'documentation' && (
              <>
                <li><button onClick={() => setGoal('Generate documentation for src/components/Button.jsx in markdown format')}>Document Button Component</button></li>
                <li><button onClick={() => setGoal('Create API documentation for REST endpoints')}>API Documentation</button></li>
                <li><button onClick={() => setGoal('Generate a README.md file for the project')}>Project README</button></li>
              </>
            )}
            
            {domain === 'cicd' && (
              <>
                <li><button onClick={() => setGoal('Build and deploy application to staging environment')}>Build & Deploy to Staging</button></li>
                <li><button onClick={() => setGoal('Set up CI pipeline for automated testing')}>Setup CI Pipeline</button></li>
                <li><button onClick={() => setGoal('Create release process for version 1.0')}>Create Release Process</button></li>
              </>
            )}
            
            {domain === 'data' && (
              <>
                <li><button onClick={() => setGoal('Perform ETL operation from MySQL database to data warehouse')}>ETL Operation</button></li>
                <li><button onClick={() => setGoal('Generate data visualization dashboards for sales metrics')}>Data Visualization</button></li>
                <li><button onClick={() => setGoal('Clean and preprocess customer data for analysis')}>Data Preprocessing</button></li>
              </>
            )}
            
            {domain === 'custom' && (
              <>
                <li><button onClick={() => setGoal('Generate a plan for refactoring the authentication system')}>Refactoring Plan</button></li>
                <li><button onClick={() => setGoal('Create a roadmap for implementing new feature X')}>Feature Roadmap</button></li>
                <li><button onClick={() => setGoal('Design an architecture for scaling the application')}>Architecture Design</button></li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default McpSequentialPlannerDemo;
EOF < /dev/null
