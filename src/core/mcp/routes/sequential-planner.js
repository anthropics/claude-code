/**
 * Sequential Planner API Routes - Proxy Module
 * 
 * This module re-exports the Sequential Planner routes from the claude-framework.
 * 
 * IMPORTANT: This file is maintained for backward compatibility.
 * New code should import directly from the claude-framework.
 */

const express = require('express');
const router = express.Router();
const logger = require('../../logging/logger').createLogger('sequential-planner-api');

// Log deprecation warning
logger.warn(
  'Using deprecated sequential-planner routes. ' +
  'Please update your code to use the claude-framework implementation instead.'
);

try {
  // Try to import from the framework
  const frameworkRouter = require('../../../../claude-framework/libs/workflows/src/sequential/integration/routes');
  
  // Re-export all routes from the framework
  if (frameworkRouter && typeof frameworkRouter === 'function') {
    // If the framework exports a function that returns a router
    router.use('/', frameworkRouter());
  } else if (frameworkRouter) {
    // If the framework exports a router directly
    router.use('/', frameworkRouter);
  } else {
    throw new Error('Could not find Sequential Planner routes in framework');
  }
} catch (err) {
  logger.error('Failed to import framework routes, falling back to original implementation', err);
  
  // Keep the original implementation to maintain backward compatibility
  const axios = require('axios');
  
  // MCP server configuration
  const MCP_CONFIG = {
    sequentialThinking: process.env.MCP_SEQUENTIAL_THINKING_URL || 'http://localhost:3000',
    context7: process.env.MCP_CONTEXT7_URL || 'http://localhost:3001',
    magic21: process.env.MCP_21ST_DEV_MAGIC_URL || 'http://localhost:3002'
  };
  
  // Rate limiting to prevent abuse
  const RATE_LIMIT = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10 // 10 requests per minute
  };
  
  // In-memory rate limiting (simple implementation)
  const requestCounts = new Map();
  const rateLimiter = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - RATE_LIMIT.windowMs;
    
    // Clean up old entries
    for (const [key, timestamps] of requestCounts.entries()) {
      requestCounts.set(key, timestamps.filter(timestamp => timestamp > windowStart));
      if (requestCounts.get(key).length === 0) {
        requestCounts.delete(key);
      }
    }
    
    // Check rate limit
    const timestamps = requestCounts.get(ip) || [];
    if (timestamps.length >= RATE_LIMIT.maxRequests) {
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }
    
    // Update timestamps
    timestamps.push(now);
    requestCounts.set(ip, timestamps);
    
    next();
  };
  
  // Apply rate limiter to all routes
  router.use(rateLimiter);
  
  /**
   * Generate a plan
   * POST /api/mcp/sequential-planner/generate
   */
  router.post('/generate', async (req, res) => {
    try {
      const { goal, options } = req.body;
      
      if (!goal) {
        return res.status(400).json({ error: 'Goal is required' });
      }
      
      logger.debug('Generating plan', { goalPrefix: goal.substring(0, 50) });
      
      // Step 1: Fetch relevant context from Context7
      let contextPrompt = '';
      try {
        if (MCP_CONFIG.context7) {
          const contextResponse = await axios.post(`${MCP_CONFIG.context7}/search`, {
            query: goal,
            limit: options?.contextLimit || 5
          });
          
          if (contextResponse.data && contextResponse.data.results) {
            contextPrompt = `\n\nRelevant information:\n${contextResponse.data.results.map(doc => 
              `- ${doc.title}: ${doc.summary}`
            ).join('\n')}`;
          }
        }
      } catch (contextError) {
        logger.warn('Failed to fetch context', { error: contextError.message });
        // Continue without context
      }
      
      // Step 2: Generate sequential thoughts as a plan
      const planningPrompt = `Create a step-by-step plan to achieve this goal: ${goal}${contextPrompt}

Each step should be actionable and specific. If a step requires information lookup or references to existing documents, indicate that. If a step requires generating UI components, specify that.`;

      const thoughtsResponse = await axios.post(`${MCP_CONFIG.sequentialThinking}/thinking/generate`, {
        problem: planningPrompt,
        options: {
          initialThoughtCount: options?.initialSteps || 5,
          maxThoughts: options?.maxSteps || 20,
          thoughtDepth: options?.depth || 'medium'
        }
      });
      
      if (!thoughtsResponse.data || !thoughtsResponse.data.thoughts) {
        throw new Error('Failed to generate thoughts');
      }
      
      // Step 3: Convert thoughts to plan steps
      const thoughts = thoughtsResponse.data.thoughts;
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
      
      logger.info('Plan generated', { 
        goalPrefix: goal.substring(0, 50),
        stepCount: planSteps.length 
      });
      
      return res.json({ plan: planSteps });
    } catch (error) {
      logger.error('Error generating plan', { error: error.message });
      return res.status(500).json({ error: 'Failed to generate plan' });
    }
  });
  
  /**
   * Continue a plan by adding more steps
   * POST /api/mcp/sequential-planner/continue
   */
  router.post('/continue', async (req, res) => {
    try {
      const { thoughts } = req.body;
      
      if (!thoughts || !Array.isArray(thoughts)) {
        return res.status(400).json({ error: 'Previous thoughts are required' });
      }
      
      logger.debug('Continuing plan', { thoughtCount: thoughts.length });
      
      // Continue sequential thinking
      const response = await axios.post(`${MCP_CONFIG.sequentialThinking}/thinking/continue`, {
        previousThoughts: thoughts
      });
      
      if (!response.data || !response.data.newThoughts) {
        throw new Error('Failed to continue thinking');
      }
      
      // Convert new thoughts to plan steps
      const newThoughts = response.data.newThoughts;
      const existingIds = new Set(thoughts.map(thought => `step-${thought.number}`));
      
      const newSteps = newThoughts
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
      
      logger.info('Plan continued', { newStepCount: newSteps.length });
      
      return res.json({ newSteps });
    } catch (error) {
      logger.error('Error continuing plan', { error: error.message });
      return res.status(500).json({ error: 'Failed to continue plan' });
    }
  });
  
  /**
   * Execute a context step
   * POST /api/mcp/sequential-planner/execute/context
   */
  router.post('/execute/context', async (req, res) => {
    try {
      const { searchTerm } = req.body;
      
      if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
      }
      
      logger.debug('Executing context step', { searchTermPrefix: searchTerm.substring(0, 50) });
      
      // Search for documents using Context7
      const response = await axios.post(`${MCP_CONFIG.context7}/search`, {
        query: searchTerm,
        limit: 5
      });
      
      if (!response.data || !response.data.results) {
        throw new Error('Failed to search documents');
      }
      
      logger.info('Context step executed', { 
        searchTermPrefix: searchTerm.substring(0, 50),
        resultCount: response.data.results.length 
      });
      
      return res.json({
        result: {
          type: 'context',
          data: response.data.results,
          summary: `Found ${response.data.results.length} relevant documents`
        }
      });
    } catch (error) {
      logger.error('Error executing context step', { error: error.message });
      return res.status(500).json({ error: 'Failed to execute context step' });
    }
  });
  
  /**
   * Execute a UI step
   * POST /api/mcp/sequential-planner/execute/ui
   */
  router.post('/execute/ui', async (req, res) => {
    try {
      const { componentSpec } = req.body;
      
      if (!componentSpec) {
        return res.status(400).json({ error: 'Component specification is required' });
      }
      
      logger.debug('Executing UI step', { componentType: componentSpec.type });
      
      // Generate a UI component using 21st-dev-magic
      const response = await axios.post(`${MCP_CONFIG.magic21}/generate`, {
        type: componentSpec.type || 'component',
        description: componentSpec.description,
        props: componentSpec.props || {}
      });
      
      if (!response.data || !response.data.component) {
        throw new Error('Failed to generate component');
      }
      
      logger.info('UI step executed', { componentName: response.data.component.name });
      
      return res.json({
        result: {
          type: 'ui',
          data: response.data.component,
          summary: `Generated UI component: ${response.data.component.name || 'Component'}`
        }
      });
    } catch (error) {
      logger.error('Error executing UI step', { error: error.message });
      return res.status(500).json({ error: 'Failed to execute UI step' });
    }
  });
  
  /**
   * Generate a summary of the executed plan
   * POST /api/mcp/sequential-planner/summary
   */
  router.post('/summary', async (req, res) => {
    try {
      const { executedSteps } = req.body;
      
      if (!executedSteps || !Array.isArray(executedSteps) || executedSteps.length === 0) {
        return res.status(400).json({ error: 'Executed steps are required' });
      }
      
      logger.debug('Generating summary', { stepCount: executedSteps.length });
      
      // Generate summary using sequential thinking
      const summaryPrompt = `Summarize the following plan execution:
${executedSteps.map(step => 
  `Step ${step.number}: ${step.description}
Result: ${step.result?.summary || 'No result'}`
).join('\n\n')}

Please provide a concise summary of what was accomplished and any key outcomes.`;

      const response = await axios.post(`${MCP_CONFIG.sequentialThinking}/thinking/conclude`, {
        thoughts: executedSteps.map((step, index) => ({
          number: index + 1,
          content: `${step.description}\nResult: ${step.result?.summary || 'No result'}`
        }))
      });
      
      if (!response.data || !response.data.conclusion) {
        throw new Error('Failed to generate summary');
      }
      
      logger.info('Summary generated', { summaryLength: response.data.conclusion.length });
      
      return res.json({ summary: response.data.conclusion });
    } catch (error) {
      logger.error('Error generating summary', { error: error.message });
      return res.status(500).json({ error: 'Failed to generate summary' });
    }
  });
}

module.exports = router;