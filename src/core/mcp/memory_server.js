#!/usr/bin/env node

/**
 * MCP Memory Server
 * =================
 * 
 * Express server that provides memory persistence API endpoints for MCP hooks.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('../logging/logger').createLogger('mcp-memory-server');

// Import the memory persistence router
const memoryPersistenceRouter = require('../../saar/startup/memory-persistence-backend');

// Initialize Express app
const app = express();
const PORT = process.env.MEMORY_SERVER_PORT || 3033;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  logger.debug('Incoming request', { 
    method: req.method, 
    path: req.path 
  });
  next();
});

// Register the memory persistence router
app.use('/api/mcp/memory', memoryPersistenceRouter);

// Status endpoint
app.get('/status', (req, res) => {
  res.json({ status: 'ok', service: 'mcp-memory-server' });
});

// Start the server
app.listen(PORT, () => {
  logger.info(`MCP Memory Server started on port ${PORT}`);
  console.log(`MCP Memory Server is running on http://localhost:${PORT}`);
});