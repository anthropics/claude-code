/**
 * Sequential Planner React Hook - Proxy Module
 * 
 * This module re-exports the Sequential Planner hooks from the claude-framework
 * to ensure backward compatibility while avoiding code duplication.
 * 
 * IMPORTANT: This file is maintained for backward compatibility.
 * New code should import directly from the claude-framework:
 * import { useSequentialPlanner, SequentialExecutionManager, sequentialDocGenerator } 
 * from 'claude-framework/libs/workflows/src/sequential';
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Try to import from the framework
let SequentialExecutionManager;

try {
  // Import from the framework
  const { default: FrameworkManager } = require('../../../claude-framework/libs/workflows/src/sequential');
  SequentialExecutionManager = FrameworkManager;
  
  if (!SequentialExecutionManager) {
    throw new Error('Could not find SequentialExecutionManager in framework');
  }
  
  console.info('Using framework implementation of Sequential Execution Manager');
} catch (err) {
  console.warn('Could not import SequentialExecutionManager from framework, using original implementation', err);
  
  // Fallback to the original implementation
  SequentialExecutionManager = require('../../../tools/mcp/integration/sequential_execution_manager');
}

/**
 * Hook for using the Sequential Execution Manager in React components
 * @param {Object} options - Hook options
 * @param {string} options.domain - The domain to use (documentation, cicd, data, custom)
 * @param {boolean} options.fallbackMode - Use fallback mode (no MCP)
 * @param {number} options.maxSteps - Maximum number of steps in a plan
 * @param {string} options.planningDepth - Depth of planning (shallow, medium, deep)
 * @returns {Object} The hook state and methods
 */
const useSequentialPlanner = (options = {}) => {
  // Default options
  const hookOptions = {
    domain: options.domain || 'custom',
    fallbackMode: options.fallbackMode || false,
    maxSteps: options.maxSteps || 20,
    planningDepth: options.planningDepth || 'medium'
  };
  
  // Manager instance (ref to avoid recreation on render)
  const managerRef = useRef(null);
  
  // Initialize manager
  useEffect(() => {
    managerRef.current = SequentialExecutionManager.forDomain(
      hookOptions.domain,
      {
        fallbackMode: hookOptions.fallbackMode,
        maxSteps: hookOptions.maxSteps,
        planningDepth: hookOptions.planningDepth
      }
    );
    
    // Cleanup function
    return () => {
      // No cleanup needed as there are no event listeners
    };
  }, [hookOptions.domain, hookOptions.fallbackMode, hookOptions.maxSteps, hookOptions.planningDepth]);
  
  // State
  const [plan, setPlan] = useState([]);
  const [currentStep, setCurrentStep] = useState(null);
  const [executedSteps, setExecutedSteps] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [summary, setSummary] = useState(null);
  
  // Update state from manager
  const updateState = useCallback(() => {
    if (!managerRef.current) return;
    
    const state = managerRef.current.getState();
    setPlan(state.plan || []);
    setCurrentStep(state.currentStep);
    setExecutedSteps(state.executedSteps || []);
    setIsLoading(state.isLoading || false);
    setError(state.error);
    setIsComplete(state.isComplete || false);
    
    if (state.executionResult && state.executionResult.summary) {
      setSummary(state.executionResult.summary);
    }
  }, []);
  
  // Add observer for state updates
  useEffect(() => {
    if (!managerRef.current) return;
    
    const observer = (event, data) => {
      updateState();
    };
    
    managerRef.current.addObserver(observer);
    
    return () => {
      if (managerRef.current) {
        managerRef.current.removeObserver(observer);
      }
    };
  }, [updateState]);
  
  // Action methods
  
  /**
   * Generate a plan for a goal
   * @param {string} goal - The goal to plan for
   * @param {Object} options - Planning options
   * @returns {Promise<Array>} The generated plan
   */
  const generatePlan = useCallback(async (goal, planOptions = {}) => {
    if (!managerRef.current) return [];
    
    try {
      setIsLoading(true);
      setError(null);
      setIsComplete(false);
      setSummary(null);
      
      const plan = await managerRef.current.generatePlan(goal, planOptions);
      updateState();
      return plan;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [updateState]);
  
  /**
   * Continue the plan by adding more steps
   * @returns {Promise<Array>} The updated plan
   */
  const continuePlan = useCallback(async () => {
    if (!managerRef.current) return [];
    
    try {
      setIsLoading(true);
      setError(null);
      
      const updatedPlan = await managerRef.current.continuePlan();
      updateState();
      return updatedPlan;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [updateState]);
  
  /**
   * Execute the current step
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} The execution result
   */
  const executeCurrentStep = useCallback(async (options = {}) => {
    if (!managerRef.current || !managerRef.current.currentStep) {
      return null;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await managerRef.current.executeCurrentStep(options);
      updateState();
      return result;
    } catch (err) {
      setError(err.message);
      updateState();
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [updateState]);
  
  /**
   * Skip the current step
   * @returns {Promise<boolean>} Success
   */
  const skipCurrentStep = useCallback(async () => {
    if (!managerRef.current || !managerRef.current.currentStep) {
      return false;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const success = await managerRef.current.skipCurrentStep();
      updateState();
      return success;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [updateState]);
  
  /**
   * Revise a step in the plan
   * @param {string} stepId - The ID of the step to revise
   * @param {string} revision - The revised step description
   * @returns {Promise<boolean>} Success
   */
  const reviseStep = useCallback(async (stepId, revision) => {
    if (!managerRef.current) return false;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const success = await managerRef.current.reviseStep(stepId, revision);
      updateState();
      return success;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [updateState]);
  
  /**
   * Generate a summary of the executed plan
   * @returns {Promise<string>} The summary
   */
  const generateSummary = useCallback(async () => {
    if (!managerRef.current) return '';
    
    try {
      setIsLoading(true);
      setError(null);
      
      const summary = await managerRef.current.generateSummary();
      setSummary(summary);
      return summary;
    } catch (err) {
      setError(err.message);
      return '';
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * Run the entire plan execution
   * @param {Function} stepCallback - Optional callback for each step
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} The execution result
   */
  const runEntirePlan = useCallback(async (stepCallback, options = {}) => {
    if (!managerRef.current) return null;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await managerRef.current.runEntirePlan(stepCallback, options);
      updateState();
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [updateState]);
  
  /**
   * Reset the execution manager state
   */
  const resetPlanner = useCallback(() => {
    if (!managerRef.current) return;
    
    managerRef.current.reset();
    setPlan([]);
    setCurrentStep(null);
    setExecutedSteps([]);
    setIsLoading(false);
    setError(null);
    setIsComplete(false);
    setSummary(null);
  }, []);
  
  return {
    // State
    plan,
    currentStep,
    executedSteps,
    isLoading,
    error,
    isComplete,
    summary,
    
    // Actions
    generatePlan,
    continuePlan,
    executeCurrentStep,
    skipCurrentStep,
    reviseStep,
    generateSummary,
    runEntirePlan,
    resetPlanner,
    
    // Raw manager (for advanced usage)
    getManager: () => managerRef.current
  };
};

// Log a deprecation warning
if (process.env.NODE_ENV !== 'production') {
  console.warn(
    'WARNING: Importing from src/hooks/mcp/useSequentialPlanner.js is deprecated. ' +
    'Please update your imports to use the framework implementation directly:\n' +
    'import { useSequentialPlanner, SequentialExecutionManager, sequentialDocGenerator } ' +
    'from "claude-framework/libs/workflows/src/sequential";'
  );
}

export default useSequentialPlanner;