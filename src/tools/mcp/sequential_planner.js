/**
 * Sequential Planner Tool
 * 
 * This module provides utilities for working with the sequential planner,
 * which integrates sequential thinking, Context7, and 21st-dev-magic.
 */

const axios = require('axios');
const logger = require('../../core/logging/logger').createLogger('sequential-planner-tool');
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
 * @param {string} goal - The goal to plan for
 * @param {Object} options - Planning options
 * @returns {Promise<Array>} The generated plan
 */
async function generatePlan(goal, options = {}) {
  try {
    if (isApiServerAvailable) {
      // Use the API server
      const response = await axios.post('http://localhost:3030/api/mcp/sequential-planner/generate', {
        goal,
        options
      });
      
      return response.data.plan;
    } else {
      // Use the fallback implementation
      return fallback.generatePlan(goal, options);
    }
  } catch (err) {
    logger.error('Error generating plan', { error: err.message });
    
    // Fall back to the local implementation
    return fallback.generatePlan(goal, options);
  }
}

/**
 * Continue planning by adding more steps
 * @param {Array} thoughts - Previous thoughts
 * @returns {Promise<Array>} New steps
 */
async function continuePlanning(thoughts) {
  try {
    if (isApiServerAvailable) {
      // Use the API server
      const response = await axios.post('http://localhost:3030/api/mcp/sequential-planner/continue', {
        thoughts
      });
      
      return response.data.newSteps;
    } else {
      // Use the fallback implementation
      return fallback.continuePlanning(thoughts);
    }
  } catch (err) {
    logger.error('Error continuing planning', { error: err.message });
    
    // Fall back to the local implementation
    return fallback.continuePlanning(thoughts);
  }
}

/**
 * Execute a context step
 * @param {string} searchTerm - The search term
 * @returns {Promise<Object>} The execution result
 */
async function executeContextStep(searchTerm) {
  try {
    if (isApiServerAvailable) {
      // Use the API server
      const response = await axios.post('http://localhost:3030/api/mcp/sequential-planner/execute/context', {
        searchTerm
      });
      
      return response.data.result;
    } else {
      // Use the fallback implementation
      return fallback.executeContextStep(searchTerm);
    }
  } catch (err) {
    logger.error('Error executing context step', { error: err.message });
    
    // Fall back to the local implementation
    return fallback.executeContextStep(searchTerm);
  }
}

/**
 * Execute a UI step
 * @param {Object} componentSpec - The component specification
 * @returns {Promise<Object>} The execution result
 */
async function executeUIStep(componentSpec) {
  try {
    if (isApiServerAvailable) {
      // Use the API server
      const response = await axios.post('http://localhost:3030/api/mcp/sequential-planner/execute/ui', {
        componentSpec
      });
      
      return response.data.result;
    } else {
      // Use the fallback implementation
      return fallback.executeUIStep(componentSpec);
    }
  } catch (err) {
    logger.error('Error executing UI step', { error: err.message });
    
    // Fall back to the local implementation
    return fallback.executeUIStep(componentSpec);
  }
}

/**
 * Generate a summary of the executed plan
 * @param {Array} executedSteps - The executed steps
 * @returns {Promise<string>} The summary
 */
async function generateSummary(executedSteps) {
  try {
    if (isApiServerAvailable) {
      // Use the API server
      const response = await axios.post('http://localhost:3030/api/mcp/sequential-planner/summary', {
        executedSteps
      });
      
      return response.data.summary;
    } else {
      // Use the fallback implementation
      return fallback.generateSummary(executedSteps);
    }
  } catch (err) {
    logger.error('Error generating summary', { error: err.message });
    
    // Fall back to the local implementation
    return fallback.generateSummary(executedSteps);
  }
}

/**
 * Execute a plan step
 * @param {Object} step - The step to execute
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} The execution result
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
        // For manual steps, just return the provided result
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
    
    // Return an error result
    return {
      type: 'error',
      data: { error: err.message },
      summary: `Error: ${err.message}`
    };
  }
}

/**
 * Run a complete planning and execution cycle
 * @param {string} goal - The goal to achieve
 * @param {function} stepCallback - Callback function for each step execution
 * @param {Object} options - Planning and execution options
 * @returns {Promise<Object>} The execution result
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

module.exports = {
  generatePlan,
  continuePlanning,
  executeContextStep,
  executeUIStep,
  executeStep,
  generateSummary,
  runPlanningCycle,
  checkApiServer
};