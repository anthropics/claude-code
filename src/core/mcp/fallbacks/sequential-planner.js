/**
 * Sequential Planner Fallback - Proxy Module
 * 
 * This module re-exports the Sequential Planner from the claude-framework
 * to ensure backward compatibility while avoiding code duplication.
 * 
 * IMPORTANT: This file is maintained for backward compatibility.
 * New code should import directly from the claude-framework.
 */

const logger = require('../../logging/logger').createLogger('sequential-planner-fallback');

// Import the typescript version of SequentialPlanner from the framework
let frameworkPlanner;

try {
  // Try to import from the framework
  const { sequentialPlanner } = require('../../../../claude-framework/libs/workflows/src/sequential/services/sequential-planner');
  frameworkPlanner = sequentialPlanner;
  
  if (!frameworkPlanner) {
    throw new Error('Could not find SequentialPlanner in framework');
  }
  
  logger.info('Using framework implementation of Sequential Planner Fallback');
} catch (err) {
  logger.warn('Could not import SequentialPlanner from framework, using original implementation', err);
  
  // Generate a sequential plan
  async function generatePlan(goal, options = {}) {
    try {
      logger.debug('Using fallback to generate plan', { goalPrefix: goal.substring(0, 50) });
      
      // Simple fallback implementation that creates a basic plan
      const planSteps = [
        {
          id: 'step-1',
          number: 1,
          description: `Research information related to: ${goal}`,
          actionType: 'context',
          status: 'pending',
          result: null,
          isRevised: false
        },
        {
          id: 'step-2',
          number: 2,
          description: 'Analyze the gathered information',
          actionType: 'manual',
          status: 'pending',
          result: null,
          isRevised: false
        },
        {
          id: 'step-3',
          number: 3,
          description: 'Design a user interface component',
          actionType: 'ui',
          status: 'pending',
          result: null,
          isRevised: false
        },
        {
          id: 'step-4',
          number: 4,
          description: 'Implement the solution',
          actionType: 'manual',
          status: 'pending',
          result: null,
          isRevised: false
        },
        {
          id: 'step-5',
          number: 5,
          description: 'Test and verify the implementation',
          actionType: 'manual',
          status: 'pending',
          result: null,
          isRevised: false
        }
      ];
      
      return planSteps;
    } catch (err) {
      logger.error('Error in fallback generate plan', { error: err.message });
      throw err;
    }
  }
  
  // Continue planning by adding more steps
  async function continuePlanning(thoughts) {
    try {
      logger.debug('Using fallback to continue plan', { thoughtCount: thoughts.length });
      
      // Simple fallback implementation that adds standard steps
      const lastNumber = thoughts.reduce((max, thought) => 
        thought.number > max ? thought.number : max, 0);
      
      const newSteps = [
        {
          id: `step-${lastNumber + 1}`,
          number: lastNumber + 1,
          description: 'Review progress and adjust approach if needed',
          actionType: 'manual',
          status: 'pending',
          result: null,
          isRevised: false
        },
        {
          id: `step-${lastNumber + 2}`,
          number: lastNumber + 2,
          description: 'Document the implementation',
          actionType: 'manual',
          status: 'pending',
          result: null,
          isRevised: false
        }
      ];
      
      return newSteps;
    } catch (err) {
      logger.error('Error in fallback continue planning', { error: err.message });
      throw err;
    }
  }
  
  // Execute a context step
  async function executeContextStep(searchTerm) {
    try {
      logger.debug('Using fallback to execute context step', { 
        searchTermPrefix: searchTerm.substring(0, 50) 
      });
      
      // Simple fallback implementation that returns mock results
      return {
        type: 'context',
        data: [
          {
            title: 'Fallback Document 1',
            summary: `This is a fallback document related to "${searchTerm}". Note that this is a mock result because the Context7 MCP service is not available.`
          },
          {
            title: 'Fallback Document 2',
            summary: 'This is another fallback document. In a real environment, this would be retrieved from the Context7 MCP service.'
          }
        ],
        summary: 'Found 2 relevant documents (fallback mode)'
      };
    } catch (err) {
      logger.error('Error in fallback execute context step', { error: err.message });
      throw err;
    }
  }
  
  // Execute a UI step
  async function executeUIStep(componentSpec) {
    try {
      logger.debug('Using fallback to execute UI step', { 
        componentDescription: componentSpec.description?.substring(0, 50) 
      });
      
      // Simple fallback implementation that returns a mock component
      const componentName = componentSpec.type === 'form' 
        ? 'FallbackForm' 
        : 'FallbackComponent';
      
      return {
        type: 'ui',
        data: {
          name: componentName,
          code: `import React from 'react';

/**
 * ${componentName}
 * 
 * FALLBACK IMPLEMENTATION - This is a mock component because the 21st-dev-magic MCP service is not available.
 * Description: ${componentSpec.description || 'No description provided'}
 */
function ${componentName}(props) {
  return (
    <div className="${componentName.toLowerCase()}">
      <h2>${componentName}</h2>
      <p>This is a fallback component. In a real environment, this would be generated by the 21st-dev-magic MCP service.</p>
    </div>
  );
}

export default ${componentName};`
        },
        summary: `Generated UI component: ${componentName} (fallback mode)`
      };
    } catch (err) {
      logger.error('Error in fallback execute UI step', { error: err.message });
      throw err;
    }
  }
  
  // Generate a summary of the executed plan
  async function generateSummary(executedSteps) {
    try {
      logger.debug('Using fallback to generate summary', { stepCount: executedSteps.length });
      
      // Simple fallback implementation that creates a basic summary
      return `Summary of Plan Execution (Fallback Mode):

This is a fallback summary generated because the sequential thinking MCP service is not available.

The plan consisted of ${executedSteps.length} steps, of which ${executedSteps.filter(s => s.status === 'completed').length} were completed and ${executedSteps.filter(s => s.status === 'skipped').length} were skipped.

Key achievements:
${executedSteps
  .filter(s => s.status === 'completed')
  .map(s => `- ${s.description.substring(0, 100)}${s.description.length > 100 ? '...' : ''}`)
  .join('\n')}

Note: This is a simplified summary. In a real environment, it would be generated by the sequential thinking MCP service.`;
    } catch (err) {
      logger.error('Error in fallback generate summary', { error: err.message });
      throw err;
    }
  }
  
  frameworkPlanner = {
    generatePlan,
    continuePlanning,
    executeContextStep,
    executeUIStep,
    generateSummary
  };
}

// Log a deprecation warning
if (process.env.NODE_ENV !== 'production') {
  console.warn(
    'WARNING: Importing from src/core/mcp/fallbacks/sequential-planner.js is deprecated. ' +
    'Please update your imports to use: claude-framework/libs/workflows/src/sequential/services/sequential-planner'
  );
}

// Re-export the framework implementation or fallback
module.exports = frameworkPlanner;