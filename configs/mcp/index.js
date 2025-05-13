// Configuration index for mcp
// This file provides standardized imports for configuration

const config = require('./config.json');
const server_config = require('./server_config.json');
const servers = require('./servers.json');

module.exports = {
  config,
  server_config,
  servers,
};
