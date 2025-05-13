/**
 * MCP API Server
 *
 * This server provides API endpoints for MCP hooks to communicate
 * with MCP services.
 */

const express = require('express');
const cors = require('cors');
const logger = require('../logging/logger').createLogger('mcp-api');

// Import route handlers
const sequentialThinkingRoutes = require('./routes/sequential-thinking');
const sequentialPlannerRoutes = require('./routes/sequential-planner');
const braveSearchRoutes = require('./routes/brave-search');
const imagenRoutes = require('./routes/imagen');
const memoryPersistenceRouter = require('../../saar/startup/memory-persistence-backend');

// Create Express app
const app = express();
const PORT = process.env.MCP_API_PORT || 3030;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path
  });
  next();
});

// Register routes
app.use('/api/mcp/sequential-thinking', sequentialThinkingRoutes);
app.use('/api/mcp/sequential-planner', sequentialPlannerRoutes);
app.use('/api/mcp/brave-search', braveSearchRoutes);
app.use('/api/mcp/imagen', imagenRoutes);
app.use('/api/mcp/memory', memoryPersistenceRouter);

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mcp-api',
    routes: [
      '/api/mcp/sequential-thinking',
      '/api/mcp/sequential-planner',
      '/api/mcp/brave-search',
      '/api/mcp/imagen',
      '/api/mcp/memory'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('API error', { error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
function startServer() {
  app.listen(PORT, () => {
    logger.info(`MCP API Server started on port ${PORT}`);
    console.log(`MCP API Server is running on http://localhost:${PORT}`);
  });
}

// If this file is run directly, start the server
if (require.main === module) {
  startServer();
}

// Export for use in other files
module.exports = {
  app,
  startServer
};