import React, { useState } from 'react';
import { useMcpSequentialPlanner } from '../../hooks/mcp';

/**
 * MCP Sequential Planner Demo
 * 
 * This component demonstrates the useMcpSequentialPlanner hook
 * for creating and executing step-by-step plans that integrate
 * Context7, sequential thinking, and 21st-dev-magic.
 */
function McpSequentialPlannerDemo() {
  const [goal, setGoal] = useState('');
  const [summary, setSummary] = useState('');
  const [executionResult, setExecutionResult] = useState(null);
  const [manualResult, setManualResult] = useState('');
  
  const {
    plan,
    currentStep,
    executedSteps,
    isLoading,
    error,
    isComplete,
    generatePlan,
    continuePlanning,
    reviseStep,
    executeCurrentStep,
    skipCurrentStep,
    generateSummary,
    resetPlanner
  } = useMcpSequentialPlanner();

  // Handle goal submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!goal.trim()) return;
    
    await generatePlan(goal);
    setSummary('');
    setExecutionResult(null);
  };

  // Handle continuing the planning process
  const handleContinue = async () => {
    await continuePlanning();
  };

  // Handle executing the current step
  const handleExecute = async () => {
    if (!currentStep) return;
    
    let options = {};
    
    // For manual steps, use the manual result
    if (currentStep.actionType === 'manual' || currentStep.actionType === 'executable') {
      options = {
        result: { message: manualResult },
        summary: manualResult || 'Step executed manually'
      };
    }
    
    const result = await executeCurrentStep(options);
    setExecutionResult(result);
    setManualResult('');
  };

  // Handle skipping the current step
  const handleSkip = () => {
    skipCurrentStep();
    setExecutionResult(null);
  };

  // Handle revising a step
  const handleRevise = (stepId) => {
    const step = plan.find(s => s.id === stepId);
    if (!step) return;
    
    const revision = prompt('Enter your revision for this step:', step.description);
    if (revision && revision !== step.description) {
      reviseStep(stepId, revision);
    }
  };

  // Handle generating a summary
  const handleGenerateSummary = async () => {
    const result = await generateSummary();
    setSummary(result);
  };

  // Get step status class
  const getStepStatusClass = (status) => {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'skipped':
        return 'status-skipped';
      case 'pending':
        return '';
      default:
        return '';
    }
  };

  // Get step action type badge
  const getActionTypeBadge = (actionType) => {
    switch (actionType) {
      case 'context':
        return <span className="badge badge-context">Context</span>;
      case 'ui':
        return <span className="badge badge-ui">UI</span>;
      case 'executable':
        return <span className="badge badge-executable">Executable</span>;
      case 'manual':
      default:
        return <span className="badge badge-manual">Manual</span>;
    }
  };

  return (
    <div className="mcp-sequential-planner-demo">
      <h2>Sequential Planning & Execution</h2>
      
      <form onSubmit={handleSubmit} className="goal-form">
        <div className="form-group">
          <label htmlFor="goal">What would you like to plan?</label>
          <textarea 
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe your goal or project..."
            rows={3}
            required
          />
        </div>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Generating Plan...' : 'Generate Plan'}
        </button>
        <button type="button" onClick={resetPlanner} className="reset-button">
          Reset
        </button>
      </form>
      
      {error && (
        <div className="error-message">Error: {error}</div>
      )}
      
      {plan.length > 0 && (
        <div className="plan-container">
          <h3>Step-by-Step Plan</h3>
          
          <div className="plan-stats">
            <div className="stat">
              <span className="stat-label">Total Steps:</span>
              <span className="stat-value">{plan.length}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Completed:</span>
              <span className="stat-value">{executedSteps.length}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Remaining:</span>
              <span className="stat-value">{plan.filter(step => step.status === 'pending').length}</span>
            </div>
          </div>
          
          <ul className="plan-steps">
            {plan.map((step) => (
              <li 
                key={step.id} 
                className={`plan-step ${getStepStatusClass(step.status)} ${currentStep && currentStep.id === step.id ? 'current-step' : ''}`}
              >
                <div className="step-header">
                  <div className="step-number">Step {step.number}</div>
                  {getActionTypeBadge(step.actionType)}
                  {step.isRevised && <span className="badge badge-revised">Revised</span>}
                </div>
                <div className="step-description">{step.description}</div>
                
                {step.status === 'completed' && step.result && (
                  <div className="step-result">
                    <div className="result-label">Result:</div>
                    <div className="result-summary">{step.result.summary}</div>
                  </div>
                )}
                
                {step.status === 'skipped' && (
                  <div className="step-result skipped">
                    <div className="result-label">Status:</div>
                    <div className="result-summary">Skipped</div>
                  </div>
                )}
                
                {step.status === 'pending' && !currentStep && (
                  <button 
                    onClick={() => setCurrentStep(step)}
                    className="step-button"
                  >
                    Start from this step
                  </button>
                )}
                
                {step.status === 'pending' && (
                  <button 
                    onClick={() => handleRevise(step.id)}
                    className="revise-button"
                    disabled={isLoading}
                  >
                    Revise
                  </button>
                )}
              </li>
            ))}
          </ul>
          
          {!isComplete && plan.length > 0 && (
            <button 
              onClick={handleContinue} 
              disabled={isLoading}
              className="continue-button"
            >
              {isLoading ? 'Thinking...' : 'Add More Steps'}
            </button>
          )}
          
          {isComplete && (
            <div className="plan-complete">
              <span className="complete-icon">✓</span> Plan execution complete!
              <button 
                onClick={handleGenerateSummary}
                disabled={isLoading}
                className="summary-button"
              >
                Generate Summary
              </button>
            </div>
          )}
          
          {summary && (
            <div className="plan-summary">
              <h3>Execution Summary</h3>
              <p>{summary}</p>
            </div>
          )}
        </div>
      )}
      
      {currentStep && (
        <div className="execution-panel">
          <h3>Current Step Execution</h3>
          
          <div className="current-step-info">
            <div className="step-number">Step {currentStep.number}</div>
            {getActionTypeBadge(currentStep.actionType)}
            <div className="step-description">{currentStep.description}</div>
          </div>
          
          {(currentStep.actionType === 'manual' || currentStep.actionType === 'executable') && (
            <div className="manual-input">
              <label htmlFor="manualResult">Enter result of manual execution:</label>
              <textarea
                id="manualResult"
                value={manualResult}
                onChange={(e) => setManualResult(e.target.value)}
                placeholder="Describe what you did and the result..."
                rows={3}
              />
            </div>
          )}
          
          <div className="execution-controls">
            <button 
              onClick={handleExecute}
              disabled={isLoading}
              className="execute-button"
            >
              {isLoading ? 'Executing...' : `Execute ${currentStep.actionType === 'manual' ? 'Manually' : 'Automatically'}`}
            </button>
            
            <button 
              onClick={handleSkip}
              disabled={isLoading}
              className="skip-button"
            >
              Skip Step
            </button>
          </div>
          
          {executionResult && (
            <div className="execution-result">
              <h4>Execution Result</h4>
              <div className="result-type">Type: {executionResult.type}</div>
              <div className="result-summary">{executionResult.summary}</div>
              
              {executionResult.type === 'context' && executionResult.data && (
                <div className="context-results">
                  <h5>Related Documents</h5>
                  <ul className="document-list">
                    {executionResult.data.map((doc, index) => (
                      <li key={index} className="document-item">
                        <div className="document-title">{doc.title}</div>
                        <div className="document-summary">{doc.summary}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {executionResult.type === 'ui' && executionResult.data && (
                <div className="ui-results">
                  <h5>Generated Component</h5>
                  <div className="component-name">{executionResult.data.name}</div>
                  <pre className="component-code">{executionResult.data.code}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      <style jsx>{`
        .mcp-sequential-planner-demo {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        .goal-form {
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
        
        .reset-button {
          background-color: #f5f5f5;
          color: #333;
          border: 1px solid #ccc;
        }
        
        .error-message {
          color: #d32f2f;
          margin: 10px 0;
          padding: 10px;
          background-color: #ffebee;
          border-radius: 4px;
        }
        
        .plan-container {
          margin-top: 30px;
        }
        
        .plan-stats {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
          background-color: #f5f5f5;
          padding: 10px 15px;
          border-radius: 4px;
        }
        
        .stat {
          display: flex;
          flex-direction: column;
        }
        
        .stat-label {
          font-size: 12px;
          color: #666;
        }
        
        .stat-value {
          font-size: 18px;
          font-weight: 600;
          color: #333;
        }
        
        .plan-steps {
          list-style: none;
          padding: 0;
        }
        
        .plan-step {
          margin-bottom: 15px;
          padding: 15px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          background-color: #f9f9f9;
          position: relative;
        }
        
        .plan-step.current-step {
          border-color: #0070f3;
          border-width: 2px;
          box-shadow: 0 2px 8px rgba(0, 112, 243, 0.1);
        }
        
        .plan-step.status-completed {
          border-left: 4px solid #4caf50;
        }
        
        .plan-step.status-skipped {
          border-left: 4px solid #ffc107;
          opacity: 0.7;
        }
        
        .step-header {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
        }
        
        .step-number {
          font-weight: 600;
          margin-right: 10px;
        }
        
        .badge {
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          margin-right: 5px;
        }
        
        .badge-context {
          background-color: #e3f2fd;
          color: #0d47a1;
        }
        
        .badge-ui {
          background-color: #f3e5f5;
          color: #7b1fa2;
        }
        
        .badge-executable {
          background-color: #e8f5e9;
          color: #2e7d32;
        }
        
        .badge-manual {
          background-color: #fffde7;
          color: #ff6f00;
        }
        
        .badge-revised {
          background-color: #e1f5fe;
          color: #01579b;
        }
        
        .step-description {
          margin-bottom: 10px;
          line-height: 1.5;
        }
        
        .step-result {
          margin-top: 10px;
          padding: 10px;
          background-color: #e8f5e9;
          border-radius: 4px;
        }
        
        .step-result.skipped {
          background-color: #fff8e1;
        }
        
        .result-label {
          font-weight: 600;
          margin-bottom: 5px;
          color: #2e7d32;
        }
        
        .step-result.skipped .result-label {
          color: #ff6f00;
        }
        
        .result-summary {
          line-height: 1.4;
        }
        
        .step-button,
        .revise-button {
          margin-top: 10px;
          background-color: #f5f5f5;
          color: #333;
          border: 1px solid #ccc;
        }
        
        .continue-button {
          margin-top: 20px;
          background-color: #0070f3;
        }
        
        .plan-complete {
          margin-top: 20px;
          padding: 15px;
          background-color: #e8f5e9;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .complete-icon {
          background-color: #4caf50;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-right: 10px;
        }
        
        .summary-button {
          background-color: #4caf50;
        }
        
        .plan-summary {
          margin-top: 20px;
          padding: 15px;
          background-color: #f3f4f6;
          border-radius: 4px;
          line-height: 1.6;
        }
        
        .execution-panel {
          margin-top: 30px;
          padding: 20px;
          background-color: #f3f4f6;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .current-step-info {
          display: flex;
          align-items: center;
          margin-bottom: 15px;
          padding-bottom: 15px;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .manual-input {
          margin-bottom: 15px;
        }
        
        .execution-controls {
          display: flex;
          margin-bottom: 15px;
        }
        
        .execute-button {
          background-color: #4caf50;
        }
        
        .skip-button {
          background-color: #f5f5f5;
          color: #333;
          border: 1px solid #ccc;
        }
        
        .execution-result {
          padding: 15px;
          background-color: #e8f5e9;
          border-radius: 4px;
        }
        
        .result-type {
          font-weight: 500;
          margin-bottom: 5px;
        }
        
        .context-results,
        .ui-results {
          margin-top: 15px;
        }
        
        .document-list {
          list-style: none;
          padding: 0;
        }
        
        .document-item {
          margin-bottom: 10px;
          padding: 10px;
          background-color: white;
          border-radius: 4px;
          border: 1px solid #e0e0e0;
        }
        
        .document-title {
          font-weight: 600;
          margin-bottom: 5px;
        }
        
        .component-name {
          font-weight: 600;
          margin-bottom: 5px;
        }
        
        .component-code {
          padding: 10px;
          background-color: #f5f5f5;
          border-radius: 4px;
          overflow: auto;
          font-size: 14px;
          max-height: 300px;
        }
      `}</style>
    </div>
  );
}

export default McpSequentialPlannerDemo;