import React, { useState } from 'react';
import { useMcpSequentialPlanner } from "./../hooks/mcp";

/**
 * MCP Documentation Generator
 * 
 * This component provides a UI for generating comprehensive documentation
 * using the Sequential Planner with Context7 and 21st-dev-magic integration.
 */
function McpDocumentationGenerator() {
  const [path, setPath] = useState('');
  const [format, setFormat] = useState('markdown');
  const [includePrivate, setIncludePrivate] = useState(false);
  const [outputPath, setOutputPath] = useState('');
  const [generationResult, setGenerationResult] = useState(null);
  
  const {
    plan,
    currentStep,
    executedSteps,
    isLoading,
    error,
    isComplete,
    generatePlan,
    executeCurrentStep,
    skipCurrentStep,
    generateSummary,
    resetPlanner
  } = useMcpSequentialPlanner();

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!path.trim()) return;
    
    // Reset previous state
    resetPlanner();
    setGenerationResult(null);
    
    // Generate plan for documentation
    const goal = `Generate comprehensive documentation for ${path} in ${format} format. ${
      includePrivate ? 'Include' : 'Exclude'
    } private methods and properties.`;
    
    await generatePlan(goal);
  };

  // Handle executing current step
  const handleExecuteStep = async () => {
    if (!currentStep) return;
    
    // For file analysis steps, simulate file content
    if (currentStep.actionType === 'context') {
      await executeCurrentStep({
        result: { fileContent: 'Sample file content for ' + path },
        summary: `Analyzed code from ${path}`
      });
    } else {
      await executeCurrentStep();
    }
    
    // If plan is complete, generate summary
    if (isComplete) {
      const summary = await generateSummary();
      setGenerationResult({
        success: true,
        output: outputPath || `./docs/${path.split('/').pop()}.${format === 'markdown' ? 'md' : format}`,
        summary
      });
    }
  };

  // Handle skipping current step
  const handleSkipStep = () => {
    skipCurrentStep();
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
    <div className="mcp-documentation-generator">
      <h2>Documentation Generator with Sequential Planning</h2>
      
      <form onSubmit={handleSubmit} className="doc-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="path">Code Path:</label>
            <input 
              type="text"
              id="path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="src/components/MyComponent.jsx"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="format">Output Format:</label>
            <select 
              id="format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              <option value="markdown">Markdown</option>
              <option value="html">HTML</option>
              <option value="json">JSON</option>
            </select>
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="outputPath">Output Path (Optional):</label>
            <input 
              type="text"
              id="outputPath"
              value={outputPath}
              onChange={(e) => setOutputPath(e.target.value)}
              placeholder="docs/my-component.md"
            />
          </div>
          
          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input 
                type="checkbox"
                checked={includePrivate}
                onChange={(e) => setIncludePrivate(e.target.checked)}
              />
              Include Private Methods/Properties
            </label>
          </div>
        </div>
        
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Planning...' : 'Generate Documentation'}
        </button>
      </form>
      
      {error && (
        <div className="error-message">Error: {error}</div>
      )}
      
      {plan.length > 0 && (
        <div className="plan-container">
          <h3>Documentation Generation Plan</h3>
          
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
              </li>
            ))}
          </ul>
          
          {currentStep && (
            <div className="execution-controls">
              <button 
                onClick={handleExecuteStep}
                disabled={isLoading}
                className="execute-button"
              >
                {isLoading ? 'Executing...' : `Execute Step ${currentStep.number}`}
              </button>
              
              <button 
                onClick={handleSkipStep}
                disabled={isLoading}
                className="skip-button"
              >
                Skip Step
              </button>
            </div>
          )}
          
          {isComplete && (
            <div className="plan-complete">
              <span className="complete-icon">✓</span> Documentation generation complete!
            </div>
          )}
        </div>
      )}
      
      {generationResult && (
        <div className="generation-result">
          <h3>Documentation Generated</h3>
          
          <div className="result-details">
            <div className="result-item">
              <span className="result-label">Status:</span>
              <span className="result-value success">Success</span>
            </div>
            <div className="result-item">
              <span className="result-label">Output File:</span>
              <span className="result-value">{generationResult.output}</span>
            </div>
          </div>
          
          <div className="result-summary">
            <h4>Summary</h4>
            <p>{generationResult.summary}</p>
          </div>
          
          <div className="next-steps">
            <h4>Next Steps</h4>
            <ul>
              <li>Review the generated documentation</li>
              <li>Manually add missing details if needed</li>
              <li>Share with team members</li>
            </ul>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .mcp-documentation-generator {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        .doc-form {
          margin-bottom: 30px;
          background-color: #f9f9f9;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .form-row {
          display: flex;
          gap: 15px;
          margin-bottom: 15px;
        }
        
        .form-group {
          flex: 1;
        }
        
        .checkbox-group {
          display: flex;
          align-items: flex-end;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 600;
        }
        
        .checkbox-label {
          display: flex;
          align-items: center;
          font-weight: normal;
        }
        
        input[type="text"],
        select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 16px;
          font-family: inherit;
        }
        
        input[type="checkbox"] {
          margin-right: 8px;
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
        
        .execution-controls {
          margin-top: 20px;
          display: flex;
          gap: 10px;
        }
        
        .execute-button {
          background-color: #4caf50;
        }
        
        .skip-button {
          background-color: #f5f5f5;
          color: #333;
          border: 1px solid #ccc;
        }
        
        .plan-complete {
          margin-top: 20px;
          padding: 15px;
          background-color: #e8f5e9;
          border-radius: 4px;
          display: flex;
          align-items: center;
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
        
        .generation-result {
          margin-top: 30px;
          padding: 20px;
          background-color: #f9f9f9;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
        }
        
        .result-details {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }
        
        .result-item {
          display: flex;
          flex-direction: column;
        }
        
        .result-label {
          font-size: 12px;
          color: #666;
        }
        
        .result-value {
          font-size: 16px;
          font-weight: 500;
        }
        
        .result-value.success {
          color: #4caf50;
        }
        
        .result-summary,
        .next-steps {
          margin-top: 20px;
        }
        
        .result-summary h4,
        .next-steps h4 {
          margin-bottom: 10px;
          padding-bottom: 5px;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .next-steps ul {
          padding-left: 20px;
        }
        
        .next-steps li {
          margin-bottom: 5px;
        }
      `}</style>
    </div>
  );
}

export default McpDocumentationGenerator;