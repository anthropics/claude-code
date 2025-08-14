#!/usr/bin/env node

/**
 * Test script to verify the configuration corruption fix for issue #2810
 * 
 * This test demonstrates:
 * 1. Atomic writes prevent corruption
 * 2. Automatic recovery from corrupted files
 * 3. Backup mechanism works correctly
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Setup test directory
const testDir = path.join(os.tmpdir(), `config-test-${Date.now()}`);
fs.mkdirSync(testDir, { recursive: true });
process.env.CLAUDE_CONFIG_DIR = testDir;

console.log('Testing configuration corruption fix for issue #2810');
console.log('Test directory:', testDir);
console.log('');

// Load the fixed ConfigManager
const { ConfigManager } = require('./dist/utils/config.js');

function test(name, fn) {
  console.log(`TEST: ${name}`);
  try {
    fn();
    console.log('  ✅ PASSED\n');
    return true;
  } catch (error) {
    console.log(`  ❌ FAILED: ${error.message}\n`);
    return false;
  }
}

let passed = 0;
let failed = 0;

// Test 1: Basic save and load
if (test('Config persists correctly', () => {
  const manager = ConfigManager.getInstance();
  const config = manager.getConfig();
  config.testValue = 'test-data';
  manager.saveConfig(config);
  
  // Verify file exists and is valid JSON
  const savedData = fs.readFileSync(manager.getConfigFilePath(), 'utf8');
  const parsed = JSON.parse(savedData);
  if (parsed.testValue !== 'test-data') {
    throw new Error('Config not saved correctly');
  }
})) passed++; else failed++;

// Test 2: Atomic writes (no temp files left)
if (test('Atomic writes leave no temp files', () => {
  ConfigManager.instance = null;
  const manager = ConfigManager.getInstance();
  
  // Multiple rapid saves
  for (let i = 0; i < 10; i++) {
    const config = manager.getConfig();
    config.counter = i;
    manager.saveConfig(config);
  }
  
  // Check for temp files
  const dir = path.dirname(manager.getConfigFilePath());
  const tempFiles = fs.readdirSync(dir).filter(f => f.includes('.tmp.'));
  if (tempFiles.length > 0) {
    throw new Error(`Found ${tempFiles.length} temp files`);
  }
})) passed++; else failed++;

// Test 3: Corruption recovery
if (test('Automatic recovery from corruption', () => {
  ConfigManager.instance = null;
  const manager = ConfigManager.getInstance();
  
  // Save valid config
  const config = manager.getConfig();
  config.importantData = 'must-preserve';
  manager.saveConfig(config);
  
  // Corrupt the file
  const configPath = manager.getConfigFilePath();
  fs.writeFileSync(configPath, '{ invalid json }}}');
  
  // Load with new instance - should auto-recover
  ConfigManager.instance = null;
  const newManager = ConfigManager.getInstance();
  const recovered = newManager.getConfig();
  
  if (!recovered || !recovered.auth || !recovered.auth.jwtSecret) {
    throw new Error('Failed to recover from corruption');
  }
})) passed++; else failed++;

// Test 4: Backup creation
if (test('Backup mechanism works', () => {
  const dir = path.dirname(ConfigManager.getInstance().getConfigFilePath());
  const backups = fs.readdirSync(dir).filter(f => f.includes('.backup'));
  
  if (backups.length === 0) {
    throw new Error('No backup files created');
  }
})) passed++; else failed++;

// Summary
console.log('='.repeat(50));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('✅ All tests passed! Fix for #2810 is working.');
} else {
  console.log('❌ Some tests failed.');
}

// Cleanup
try {
  fs.rmSync(testDir, { recursive: true, force: true });
  console.log('Test directory cleaned up.');
} catch (e) {
  // Ignore cleanup errors
}

process.exit(failed === 0 ? 0 : 1);