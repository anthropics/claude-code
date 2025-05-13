// Main configuration index
// This file provides standardized imports for all configuration

const api = require('./api');
const backup = require('./backup');
const colorSchema = require('./color-schema');
const debug = require('./debug');
const enterprise = require('./enterprise');
const i18n = require('./i18n');
const mcp = require('./mcp');
const rag = require('./rag');
const saar = require('./saar');
const security = require('./security');
const workflows = require('./workflows');

module.exports = {
  api,
  backup,
  colorSchema,
  debug,
  enterprise,
  i18n,
  mcp,
  rag,
  saar,
  security,
  workflows,
  global: require('./global.json'),
};
