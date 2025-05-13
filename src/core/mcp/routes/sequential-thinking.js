/**
 * Sequential Thinking API Routes
 * 
 * These routes provide an interface between the MCP sequential thinking hook
 * and the MCP sequential thinking server.
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../../logging/logger').createLogger('sequential-thinking-api');

// MCP sequential thinking server configuration
const MCP_SEQUENTIAL_THINKING_URL = process.env.MCP_SEQUENTIAL_THINKING_URL || 'http://localhost:3000';

// Generate thoughts for a problem
router.post('/generate', async (req, res) => {
  try {
    const { problem, options } = req.body;
    
    if (!problem) {
      return res.status(400).json({ error: 'Problem is required' });
    }
    
    // Call MCP sequential thinking server
    const response = await axios.post(`${MCP_SEQUENTIAL_THINKING_URL}/thinking/generate`, {
      problem,
      options
    });
    
    logger.debug('Generated thoughts', { problemPrefix: problem.substring(0, 50) });
    return res.json(response.data);
  } catch (error) {
    logger.error('Error generating thoughts', { error: error.message });
    return res.status(500).json({ error: 'Failed to generate thoughts' });
  }
});

// Continue thinking
router.post('/continue', async (req, res) => {
  try {
    const { previousThoughts } = req.body;
    
    if (!previousThoughts || !Array.isArray(previousThoughts)) {
      return res.status(400).json({ error: 'Previous thoughts are required' });
    }
    
    // Call MCP sequential thinking server
    const response = await axios.post(`${MCP_SEQUENTIAL_THINKING_URL}/thinking/continue`, {
      previousThoughts
    });
    
    logger.debug('Continued thinking', { thoughtCount: previousThoughts.length });
    return res.json(response.data);
  } catch (error) {
    logger.error('Error continuing thinking', { error: error.message });
    return res.status(500).json({ error: 'Failed to continue thinking' });
  }
});

// Revise a thought
router.post('/revise', async (req, res) => {
  try {
    const { thoughts, thoughtIndex, revision } = req.body;
    
    if (!thoughts || !Array.isArray(thoughts)) {
      return res.status(400).json({ error: 'Thoughts are required' });
    }
    
    if (thoughtIndex === undefined || thoughtIndex < 0 || thoughtIndex >= thoughts.length) {
      return res.status(400).json({ error: 'Valid thought index is required' });
    }
    
    if (!revision) {
      return res.status(400).json({ error: 'Revision is required' });
    }
    
    // Call MCP sequential thinking server
    const response = await axios.post(`${MCP_SEQUENTIAL_THINKING_URL}/thinking/revise`, {
      thoughts,
      thoughtIndex,
      revision
    });
    
    logger.debug('Revised thought', { thoughtIndex });
    return res.json(response.data);
  } catch (error) {
    logger.error('Error revising thought', { error: error.message });
    return res.status(500).json({ error: 'Failed to revise thought' });
  }
});

// Get a conclusion from thoughts
router.post('/conclude', async (req, res) => {
  try {
    const { thoughts } = req.body;
    
    if (!thoughts || !Array.isArray(thoughts)) {
      return res.status(400).json({ error: 'Thoughts are required' });
    }
    
    // Call MCP sequential thinking server
    const response = await axios.post(`${MCP_SEQUENTIAL_THINKING_URL}/thinking/conclude`, {
      thoughts
    });
    
    logger.debug('Generated conclusion', { thoughtCount: thoughts.length });
    return res.json(response.data);
  } catch (error) {
    logger.error('Error generating conclusion', { error: error.message });
    return res.status(500).json({ error: 'Failed to generate conclusion' });
  }
});

module.exports = router;