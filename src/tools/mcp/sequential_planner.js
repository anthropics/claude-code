/**
 * Sequential Planner Tool - Proxy Module
 * 
 * This module re-exports the Sequential Planner from the claude-framework
 * to ensure backward compatibility while avoiding code duplication.
 * 
 * IMPORTANT: This file is maintained for backward compatibility.
 * New code should import directly from the claude-framework.
 */

const logger = require('../../core/logging/logger').createLogger('sequential-planner-tool');

// Import the typescript version of SequentialPlanner from the framework
let frameworkPlanner;

try {
  // Try to import from the framework
  const { sequentialPlanner } = require('../../../claude-framework/libs/workflows/src/sequential/services/sequential-planner');
  frameworkPlanner = sequentialPlanner;
  
  if (!frameworkPlanner) {
    throw new Error('Could not find SequentialPlanner in framework');
  }
  
  logger.info('Using framework implementation of Sequential Planner');
} catch (err) {
  logger.warn('Could not import SequentialPlanner from framework, using original implementation', err);
  
  // Keep the original implementation
  const axios = require('axios');
  const fallback = require('../../core/mcp/fallbacks/sequential-planner');
  
  // Check if the API server is available
  let isApiServerAvailable = false;
  async function checkApiServer() {
    try {
      const response = await axios.get('http://localhost:3030/status');
      isApiServerAvailable = response.data && response.data.status === 'ok';
      logger.debug('API server status check', { available: isApiServerAvailable });
      return isApiServerAvailable;
    } catch (err) {
      logger.warn('API server not available', { error: err.message });
      isApiServerAvailable = false;
      return false;
    }
  }
  
  // Initial check
  checkApiServer().catch(() => {});
  
  // Recheck periodically (every 5 minutes)
  setInterval(() => {
    checkApiServer().catch(() => {});
  }, 5 * 60 * 1000);
  
  /**
   * Generate a sequential plan
   */
  async function generatePlan(goal, options = {}) {
    try {
      if (isApiServerAvailable) {
        const response = await axios.post('http://localhost:3030/api/mcp/sequential-planner/generate', { goal, options });
        return response.data.plan;
      } else {
        return fallback.generatePlan(goal, options);
      }
    } catch (err) {
      logger.error('Error generating plan', { error: err.message });
      return fallback.generatePlan(goal, options);
    }
  }
  
  /**
   * Continue planning by adding more steps
   */
  async function continuePlanning(thoughts) {
    try {
      if (isApiServerAvailable) {
        const response = await axios.post('http://localhost:3030/api/mcp/sequential-planner/continue', { thoughts });
        return response.data.newSteps;
      } else {
        return fallback.continuePlanning(thoughts);
      }
    } catch (err) {
      logger.error('Error continuing planning', { error: err.message });
      return fallback.continuePlanning(thoughts);
    }
  }
  
  /**
   * Execute a context step
   */
  async function executeContextStep(searchTerm) {
    try {
      if (isApiServerAvailable) {
        const response = await axios.post('http://localhost:3030/api/mcp/sequential-planner/execute/context', { searchTerm });
        return response.data.result;
      } else {
        return fallback.executeContextStep(searchTerm);
      }
    } catch (err) {
      logger.error('Error executing context step', { error: err.message });
      return fallback.executeContextStep(searchTerm);
    }
  }
  
  /**
   * Execute a UI step
   */
  async function executeUIStep(componentSpec) {
    try {
      if (isApiServerAvailable) {
        const response = await axios.post('http://localhost:3030/api/mcp/sequential-planner/execute/ui', { componentSpec });
        return response.data.result;
      } else {
        return fallback.executeUIStep(componentSpec);
      }
    } catch (err) {
      logger.error('Error executing UI step', { error: err.message });
      return fallback.executeUIStep(componentSpec);
    }
  }
  
  /**
   * Generate a summary of the executed plan
   */
  async function generateSummary(executedSteps) {
    try {
      if (isApiServerAvailable) {
        const response = await axios.post('http://localhost:3030/api/mcp/sequential-planner/summary', { executedSteps });
        return response.data.summary;
      } else {
        return fallback.generateSummary(executedSteps);
      }
    } catch (err) {
      logger.error('Error generating summary', { error: err.message });
      return fallback.generateSummary(executedSteps);
    }
  }
  
  /**
   * Execute a plan step
   */
  async function executeStep(step, options = {}) {
    logger.debug('Executing step', { stepNumber: step.number, actionType: step.actionType });
    
    try {
      switch (step.actionType) {
        case 'context':
          return await executeContextStep(options.searchTerm || step.description);
        case 'ui':
          return await executeUIStep(options.componentSpec || {
            type: 'component',
            description: step.description
          });
        case 'executable':
        case 'manual':
        default:
          return {
            type: 'manual',
            data: options.result || {},
            summary: options.summary || 'Step executed manually'
          };
      }
    } catch (err) {
      logger.error('Error executing step', { 
        stepNumber: step.number, 
        actionType: step.actionType,
        error: err.message
      });
      
      return {
        type: 'error',
        data: { error: err.message },
        summary: `Error: ${err.message}`
      };
    }
  }
  
  /**
   * Run a complete planning and execution cycle
   */
  async function runPlanningCycle(goal, stepCallback, options = {}) {
    try {
      logger.info('Starting planning cycle', { goalPrefix: goal.substring(0, 50) });
      
      // Generate the initial plan
      const plan = await generatePlan(goal, options);
      
      // Execute each step
      const executedSteps = [];
      
      for (const step of plan) {
        // Allow the callback to control execution
        if (typeof stepCallback === 'function') {
          const callbackResult = await stepCallback({
            step,
            plan,
            executedSteps,
            isLastStep: step === plan[plan.length - 1]
          });
          
          // If the callback returns false, skip this step
          if (callbackResult === false) {
            const skippedResult = {
              type: 'skipped',
              data: {},
              summary: 'Step was skipped'
            };
            
            executedSteps.push({
              ...step,
              status: 'skipped',
              result: skippedResult
            });
            
            continue;
          }
          
          // If the callback returns an object, use it as the step result
          if (callbackResult && typeof callbackResult === 'object') {
            executedSteps.push({
              ...step,
              status: 'completed',
              result: callbackResult
            });
            
            continue;
          }
        }
        
        // Execute the step
        const result = await executeStep(step, options);
        
        executedSteps.push({
          ...step,
          status: 'completed',
          result
        });
      }
      
      // Generate the summary
      const summary = await generateSummary(executedSteps);
      
      logger.info('Planning cycle completed', { 
        goalPrefix: goal.substring(0, 50),
        stepCount: executedSteps.length
      });
      
      return {
        plan,
        executedSteps,
        summary
      };
    } catch (err) {
      logger.error('Error running planning cycle', { error: err.message });
      throw err;
    }
  }
  
  frameworkPlanner = {
    generatePlan,
    continuePlanning,
    executeContextStep,
    executeUIStep,
    executeStep,
    generateSummary,
    runPlanningCycle,
    checkApiServer
  };
}

// Log a deprecation warning
if (process.env.NODE_ENV !== 'production') {
  console.warn(
    'WARNING: Importing from src/tools/mcp/sequential_planner.js is deprecated. ' +
    'Please update your imports to use: claude-framework/libs/workflows/src/sequential/services/sequential-planner'
  );
}

// Re-export the framework implementation or fallback
module.exports = frameworkPlanner;