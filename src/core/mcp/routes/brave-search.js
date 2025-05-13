/**
 * Brave Search API Routes
 * 
 * These routes provide an interface between the MCP brave search hook
 * and the MCP brave search server.
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../../logging/logger').createLogger('brave-search-api');

// MCP brave search server configuration
const MCP_BRAVE_SEARCH_URL = process.env.MCP_BRAVE_SEARCH_URL || 'http://localhost:3001';

// Perform a web search
router.post('/web', async (req, res) => {
  try {
    const { query, options } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    // Call MCP brave search server
    const response = await axios.post(`${MCP_BRAVE_SEARCH_URL}/search/web`, {
      query,
      count: options?.count || 10,
      offset: options?.offset || 0,
      safeSearch: options?.safeSearch,
      freshness: options?.freshness,
      allowedDomains: options?.allowedDomains,
      blockedDomains: options?.blockedDomains
    });
    
    logger.debug('Performed web search', { query });
    return res.json({
      results: response.data.results || [],
      totalResults: response.data.totalResults || 0
    });
  } catch (error) {
    logger.error('Error performing web search', { error: error.message });
    return res.status(500).json({ error: 'Failed to perform web search' });
  }
});

// Perform a local search
router.post('/local', async (req, res) => {
  try {
    const { query, options } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    // Call MCP brave search server
    const response = await axios.post(`${MCP_BRAVE_SEARCH_URL}/search/local`, {
      query,
      count: options?.count || 5,
      location: options?.location
    });
    
    logger.debug('Performed local search', { query });
    return res.json({
      results: response.data.results || [],
      totalResults: response.data.totalResults || 0
    });
  } catch (error) {
    logger.error('Error performing local search', { error: error.message });
    return res.status(500).json({ error: 'Failed to perform local search' });
  }
});

module.exports = router;