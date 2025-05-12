const { useState, useCallback } = require('react');

// Mock hooks for testing
const useMcpSequentialThinking = () => {
  return {
    generateThoughts: async () => [],
    continueThinking: async () => [],
    getConclusion: async () => 'Conclusion'
  };
};

const useMcpContext7 = () => {
  return {
    searchDocuments: async () => []
  };
};

const useMcp21stDevMagic = () => {
  return {
    generateComponent: async () => ({ name: 'MockComponent', code: 'Mock code' })
  };
};

/**
 * MCP-integrated sequential planner hook
 * 
 * This hook combines sequential thinking, Context7, and 21st-dev-magic
 * to provide a powerful planning and execution system that allows for
 * interleaved planning and execution steps.
 */
function useMcpSequentialPlanner() {
  // Use the individual MCP hooks
  const sequentialThinking = useMcpSequentialThinking();
  const context7 = useMcpContext7();
  const magic21 = useMcp21stDevMagic();
  
  // Planning state
  const [plan, setPlan] = useState([]);
  const [currentStep, setCurrentStep] = useState(null);
  const [executedSteps, setExecutedSteps] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  
  /**
   * Generate a sequential plan using sequential thinking and Context7
   * @param {string} goal - The goal to plan for
   * @param {Object} options - Planning options
   * @returns {Array} The generated plan
   */
  const generatePlan = useCallback(async (goal, options = {}) => {
    try {
      setIsLoading(true);
      setError(null);
      setIsComplete(false);
      setPlan([]);
      setCurrentStep(null);
      setExecutedSteps([]);
      
      // First, try to fetch relevant context from Context7
      let contextPrompt = '';
      if (context7 && typeof context7.searchDocuments === 'function') {
        const relevantDocs = await context7.searchDocuments(goal);
        if (relevantDocs && relevantDocs.length > 0) {
          contextPrompt = `\n\nRelevant information:\n${relevantDocs.map(doc => 
            `- ${doc.title}: ${doc.summary}`
          ).join('\n')}`;
        }
      }
      
      // Generate sequential thoughts as a plan
      const planningPrompt = `Create a step-by-step plan to achieve this goal: ${goal}${contextPrompt}

Each step should be actionable and specific. If a step requires information lookup or references to existing documents, indicate that. If a step requires generating UI components, specify that.`;

      const thoughts = await sequentialThinking.generateThoughts(planningPrompt, {
        initialThoughtCount: options.initialSteps || 5,
        maxThoughts: options.maxSteps || 20,
        thoughtDepth: options.depth || 'medium'
      });
      
      // Convert thoughts to plan steps
      const planSteps = thoughts.map((thought, index) => {
        // Extract the action type through pattern matching
        let actionType = 'manual';
        if (thought.content.includes('search') || thought.content.includes('look up') || 
            thought.content.includes('reference') || thought.content.includes('document')) {
          actionType = 'context';
        } else if (thought.content.includes('UI') || thought.content.includes('component') || 
                  thought.content.includes('interface') || thought.content.includes('design')) {
          actionType = 'ui';
        } else if (thought.content.includes('automated') || thought.content.includes('execute')) {
          actionType = 'executable';
        }
        
        return {
          id: `step-${index + 1}`,
          number: index + 1,
          description: thought.content,
          actionType,
          status: 'pending',
          result: null,
          isRevised: thought.isRevision || false
        };
      });
      
      setPlan(planSteps);
      if (planSteps.length > 0) {
        setCurrentStep(planSteps[0]);
      }
      
      return planSteps;
    } catch (err) {
      console.error('Error generating plan:', err);
      setError('Failed to generate plan: ' + err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [sequentialThinking, context7]);
  
  /**
   * Continue planning by adding more steps
   * @returns {Array} The updated plan
   */
  const continuePlanning = useCallback(async () => {
    try {
      if (isComplete || plan.length === 0) return plan;
      
      setIsLoading(true);
      setError(null);
      
      // Continue sequential thinking to generate more steps
      const thoughts = await sequentialThinking.continueThinking();
      
      // Convert new thoughts to plan steps
      const existingIds = new Set(plan.map(step => step.id));
      const newSteps = thoughts
        .filter(thought => !existingIds.has(`step-${thought.number}`))
        .map((thought) => {
          // Extract the action type through pattern matching
          let actionType = 'manual';
          if (thought.content.includes('search') || thought.content.includes('look up') || 
              thought.content.includes('reference') || thought.content.includes('document')) {
            actionType = 'context';
          } else if (thought.content.includes('UI') || thought.content.includes('component') || 
                    thought.content.includes('interface') || thought.content.includes('design')) {
            actionType = 'ui';
          } else if (thought.content.includes('automated') || thought.content.includes('execute')) {
            actionType = 'executable';
          }
          
          return {
            id: `step-${thought.number}`,
            number: thought.number,
            description: thought.content,
            actionType,
            status: 'pending',
            result: null,
            isRevised: thought.isRevision || false
          };
        });
      
      const updatedPlan = [...plan, ...newSteps];
      setPlan(updatedPlan);
      
      // Update current step if none is set
      if (!currentStep && updatedPlan.length > 0) {
        setCurrentStep(updatedPlan[0]);
      }
      
      return updatedPlan;
    } catch (err) {
      console.error('Error continuing plan:', err);
      setError('Failed to continue plan: ' + err.message);
      return plan;
    } finally {
      setIsLoading(false);
    }
  }, [plan, currentStep, isComplete, sequentialThinking]);
  
  /**
   * Revise a specific step in the plan
   * @param {string} stepId - The ID of the step to revise
   * @param {string} revision - The revised step description
   * @returns {boolean} Success
   */
  const reviseStep = useCallback(async (stepId, revision) => {
    try {
      const stepIndex = plan.findIndex(step => step.id === stepId);
      if (stepIndex === -1) {
        setError(`Step with ID ${stepId} not found`);
        return false;
      }
      
      setIsLoading(true);
      setError(null);
      
      // Revise the step
      const updatedPlan = [...plan];
      updatedPlan[stepIndex] = {
        ...updatedPlan[stepIndex],
        description: revision,
        isRevised: true
      };
      
      setPlan(updatedPlan);
      
      // If this is the current step, update it
      if (currentStep && currentStep.id === stepId) {
        setCurrentStep(updatedPlan[stepIndex]);
      }
      
      return true;
    } catch (err) {
      console.error('Error revising step:', err);
      setError('Failed to revise step: ' + err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [plan, currentStep]);
  
  /**
   * Execute the current step based on its action type
   * @param {Object} options - Execution options
   * @returns {Object} Execution result
   */
  const executeCurrentStep = useCallback(async (options = {}) => {
    if (!currentStep) {
      setError('No current step to execute');
      return null;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      let result = null;
      
      // Execute the step based on its action type
      switch (currentStep.actionType) {
        case 'context':
          if (context7 && typeof context7.searchDocuments === 'function') {
            const searchTerm = options.searchTerm || currentStep.description;
            const docs = await context7.searchDocuments(searchTerm);
            result = {
              type: 'context',
              data: docs,
              summary: `Found ${docs.length} relevant documents`
            };
          } else {
            throw new Error('Context7 is not available');
          }
          break;
          
        case 'ui':
          if (magic21 && typeof magic21.generateComponent === 'function') {
            const componentSpec = options.componentSpec || {
              type: 'component',
              description: currentStep.description
            };
            const component = await magic21.generateComponent(componentSpec);
            result = {
              type: 'ui',
              data: component,
              summary: `Generated UI component: ${component.name || 'Component'}`
            };
          } else {
            throw new Error('21st-dev-magic is not available');
          }
          break;
          
        case 'executable':
        case 'manual':
        default:
          // For manual steps or executable steps, store the provided result
          result = {
            type: 'manual',
            data: options.result || {},
            summary: options.summary || 'Step executed manually'
          };
          break;
      }
      
      // Update the step with the result
      const updatedStep = {
        ...currentStep,
        status: 'completed',
        result: result
      };
      
      // Update the plan
      const updatedPlan = [...plan];
      const stepIndex = plan.findIndex(step => step.id === currentStep.id);
      if (stepIndex !== -1) {
        updatedPlan[stepIndex] = updatedStep;
      }
      
      setPlan(updatedPlan);
      setExecutedSteps([...executedSteps, updatedStep]);
      
      // Move to the next step if available
      const nextStepIndex = plan.findIndex(step => step.status === 'pending');
      if (nextStepIndex !== -1) {
        setCurrentStep(plan[nextStepIndex]);
      } else {
        setCurrentStep(null);
        setIsComplete(true);
      }
      
      return result;
    } catch (err) {
      console.error('Error executing step:', err);
      setError('Failed to execute step: ' + err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentStep, plan, executedSteps, context7, magic21]);
  
  /**
   * Skip the current step
   * @returns {boolean} Success
   */
  const skipCurrentStep = useCallback(() => {
    if (!currentStep) {
      setError('No current step to skip');
      return false;
    }
    
    try {
      // Update the step status
      const updatedStep = {
        ...currentStep,
        status: 'skipped',
        result: {
          type: 'skipped',
          summary: 'Step was skipped'
        }
      };
      
      // Update the plan
      const updatedPlan = [...plan];
      const stepIndex = plan.findIndex(step => step.id === currentStep.id);
      if (stepIndex !== -1) {
        updatedPlan[stepIndex] = updatedStep;
      }
      
      setPlan(updatedPlan);
      
      // Move to the next step if available
      const nextStepIndex = plan.findIndex(step => step.status === 'pending');
      if (nextStepIndex !== -1) {
        setCurrentStep(plan[nextStepIndex]);
      } else {
        setCurrentStep(null);
        setIsComplete(true);
      }
      
      return true;
    } catch (err) {
      console.error('Error skipping step:', err);
      setError('Failed to skip step: ' + err.message);
      return false;
    }
  }, [currentStep, plan]);
  
  /**
   * Generate a summary of the executed plan
   * @returns {string} Plan summary
   */
  const generateSummary = useCallback(async () => {
    try {
      if (executedSteps.length === 0) {
        return "No steps have been executed yet.";
      }
      
      setIsLoading(true);
      setError(null);
      
      // Generate summary using sequential thinking
      const summaryPrompt = `Summarize the following plan execution:
${executedSteps.map(step => 
  `Step ${step.number}: ${step.description}
Result: ${step.result?.summary || 'No result'}`
).join('\n\n')}

Please provide a concise summary of what was accomplished and any key outcomes.`;

      const conclusion = await sequentialThinking.getConclusion(summaryPrompt);
      return conclusion || "Unable to generate summary.";
    } catch (err) {
      console.error('Error generating summary:', err);
      setError('Failed to generate summary: ' + err.message);
      return "Error generating summary.";
    } finally {
      setIsLoading(false);
    }
  }, [executedSteps, sequentialThinking]);
  
  /**
   * Reset the planner state
   */
  const resetPlanner = useCallback(() => {
    setPlan([]);
    setCurrentStep(null);
    setExecutedSteps([]);
    setIsLoading(false);
    setError(null);
    setIsComplete(false);
  }, []);
  
  return {
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
  };
}

module.exports = { useMcpSequentialPlanner };