const express = require('express');
const router = express.Router();
const logger = require('../../core/logging/logger').createLogger('memory-persistence');

// In-memory storage (fallback when MCP is not available)
const memoryStore = new Map();

// Configure MCP memory client
let mcpMemoryClient = null;
try {
  mcpMemoryClient = require('../../core/mcp/mcp_memory_client');
  logger.info('MCP memory client initialized');
} catch (error) {
  logger.warn('MCP memory client not available, using fallback storage', { error: error.message });
}

// Set a value in memory
router.post('/set', async (req, res) => {
  try {
    const { key, value, ttl } = req.body;
    
    if (!key) {
      return res.status(400).json({ success: false, error: 'Key is required' });
    }
    
    // Try to use MCP memory
    if (mcpMemoryClient && mcpMemoryClient.isAvailable()) {
      const success = await mcpMemoryClient.setValue(key, value, ttl);
      
      if (success) {
        logger.debug('Value saved to MCP memory', { key });
        return res.json({ success: true });
      }
      
      logger.warn('Failed to save to MCP memory, using fallback', { key });
    }
    
    // Fallback to in-memory storage
    memoryStore.set(key, {
      value,
      expires: ttl ? Date.now() + (ttl * 1000) : null
    });
    
    logger.debug('Value saved to fallback memory', { key });
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error setting memory value', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get a value from memory
router.post('/get', async (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({ success: false, error: 'Key is required' });
    }
    
    // Try to use MCP memory
    if (mcpMemoryClient && mcpMemoryClient.isAvailable()) {
      const value = await mcpMemoryClient.getValue(key);
      
      if (value !== undefined) {
        logger.debug('Value retrieved from MCP memory', { key });
        return res.json({ success: true, value });
      }
      
      logger.debug('Value not found in MCP memory, checking fallback', { key });
    }
    
    // Fallback to in-memory storage
    const entry = memoryStore.get(key);
    
    if (!entry) {
      logger.debug('Value not found in fallback memory', { key });
      return res.json({ success: true, value: null });
    }
    
    // Check if entry is expired
    if (entry.expires && entry.expires < Date.now()) {
      memoryStore.delete(key);
      logger.debug('Value expired in fallback memory', { key });
      return res.json({ success: true, value: null });
    }
    
    logger.debug('Value retrieved from fallback memory', { key });
    return res.json({ success: true, value: entry.value });
  } catch (error) {
    logger.error('Error getting memory value', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a value from memory
router.post('/delete', async (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({ success: false, error: 'Key is required' });
    }
    
    // Try to use MCP memory
    if (mcpMemoryClient && mcpMemoryClient.isAvailable()) {
      const success = await mcpMemoryClient.deleteValue(key);
      
      if (success) {
        logger.debug('Value deleted from MCP memory', { key });
      } else {
        logger.warn('Failed to delete from MCP memory', { key });
      }
    }
    
    // Also remove from fallback memory
    memoryStore.delete(key);
    
    logger.debug('Value deleted from fallback memory', { key });
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting memory value', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// List all keys
router.get('/keys', async (req, res) => {
  try {
    const keys = new Set();
    
    // Get keys from MCP memory
    if (mcpMemoryClient && mcpMemoryClient.isAvailable()) {
      const mcpKeys = await mcpMemoryClient.getKeys();
      mcpKeys.forEach(key => keys.add(key));
    }
    
    // Add keys from fallback memory
    memoryStore.forEach((_, key) => keys.add(key));
    
    return res.json({ success: true, keys: Array.from(keys) });
  } catch (error) {
    logger.error('Error listing memory keys', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;