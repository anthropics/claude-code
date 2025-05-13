/**
 * SAAR-MCP Performance Tests
 * 
 * Tests the performance of the SAAR-MCP integration.
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Test configuration
const CONFIG_DIR = process.env.HOME + '/.claude';
const WORKSPACE_DIR = process.cwd();
const TEST_DIR = path.join(WORKSPACE_DIR, 'tests', 'saar-mcp');
const PERFORMANCE_LOG = path.join(TEST_DIR, 'performance.log');

// Path to the saar-mcp.sh script
const SAAR_MCP_SCRIPT = path.join(WORKSPACE_DIR, 'saar-mcp.sh');

// Ensure the script is executable
beforeAll(async () => {
  // Make sure the script is executable
  try {
    await execAsync(`chmod +x ${SAAR_MCP_SCRIPT}`);
  } catch (err) {
    console.error(`Failed to make script executable: ${err.message}`);
  }
  
  // Create test data directory if it doesn't exist
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
});

// Helper function to run a command and capture output with timing
async function runCommandWithTiming(command, args = []) {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { shell: true });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      resolve({
        code,
        stdout,
        stderr,
        executionTime
      });
    });
    
    process.on('error', (err) => {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      reject({
        error: err,
        executionTime
      });
    });
  });
}

// Log performance data
function logPerformance(testName, executionTime, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    test: testName,
    executionTime,
    ...details
  };
  
  // Create or append to log file
  const logData = fs.existsSync(PERFORMANCE_LOG)
    ? JSON.parse(fs.readFileSync(PERFORMANCE_LOG, 'utf8'))
    : [];
    
  logData.push(logEntry);
  
  fs.writeFileSync(PERFORMANCE_LOG, JSON.stringify(logData, null, 2));
  
  return logEntry;
}

// Test the performance of basic commands
describe('Basic Command Performance', () => {
  // Test the help command performance
  test('should execute help command quickly', async () => {
    const result = await runCommandWithTiming(`${SAAR_MCP_SCRIPT} help`);
    
    // Log performance
    const logEntry = logPerformance('help-command', result.executionTime);
    
    // Expect reasonable performance (adjust as needed)
    expect(result.executionTime).toBeLessThan(2000); // Should be quick
    expect(result.code).toBe(0);
  });
  
  // Test the validate command performance
  test('should validate MCP tools with reasonable performance', async () => {
    const result = await runCommandWithTiming(`${SAAR_MCP_SCRIPT} validate`);
    
    // Log performance
    const logEntry = logPerformance('validate-command', result.executionTime, {
      toolsChecked: (result.stdout.match(/Checking/g) || []).length
    });
    
    // Validation might take time if it's checking multiple tools
    expect(result.executionTime).toBeLessThan(10000); // Up to 10 seconds allowed
    expect(result.code).toBe(0);
  });
});

// Test memory system performance
describe('Memory System Performance', () => {
  // Test memory store performance
  test('should store thoughts with good performance', async () => {
    // Create test thoughts
    const testThoughts = [
      'This is a test thought for performance testing',
      'Another test thought to measure memory storage performance',
      'A third test thought to ensure consistent performance'
    ];
    
    const results = [];
    
    // Store each thought and measure performance
    for (const thought of testThoughts) {
      const result = await runCommandWithTiming(`${SAAR_MCP_SCRIPT} memory store "${thought}"`);
      results.push(result);
      
      // Log performance
      logPerformance('memory-store', result.executionTime, {
        thoughtLength: thought.length
      });
    }
    
    // Calculate average execution time
    const avgTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
    
    // Log average
    logPerformance('memory-store-average', avgTime, {
      sampleSize: testThoughts.length
    });
    
    // Performance expectations
    expect(avgTime).toBeLessThan(5000); // Average under 5 seconds
    
    // Check all operations succeeded
    results.forEach(result => {
      expect(result.code).toBe(0);
    });
  });
  
  // Test memory search performance
  test('should search thoughts with good performance', async () => {
    const result = await runCommandWithTiming(`${SAAR_MCP_SCRIPT} memory search "test"`);
    
    // Log performance
    logPerformance('memory-search', result.executionTime, {
      query: 'test'
    });
    
    // Performance expectations
    expect(result.executionTime).toBeLessThan(5000); // Under 5 seconds
    expect(result.code).toBe(0);
  });
});

// Test workflow performance (if workflows are available)
describe('Workflow Performance', () => {
  // Skip actual execution and just test list performance
  test('should list workflows with good performance', async () => {
    const result = await runCommandWithTiming(`${SAAR_MCP_SCRIPT} workflow list`);
    
    // Log performance
    logPerformance('workflow-list', result.executionTime);
    
    // Performance expectations
    expect(result.executionTime).toBeLessThan(3000); // Under 3 seconds
    expect(result.code).toBe(0);
  });
});

// Test resource usage
describe('Resource Usage', () => {
  // Test memory usage (indirectly by checking if we can still run commands)
  test('should maintain reasonable memory usage across multiple operations', async () => {
    const commands = [
      `${SAAR_MCP_SCRIPT} help`,
      `${SAAR_MCP_SCRIPT} memory status`,
      `${SAAR_MCP_SCRIPT} mcp status`,
      `${SAAR_MCP_SCRIPT} workflow list`
    ];
    
    // Run multiple commands in sequence
    const results = [];
    for (const command of commands) {
      const result = await runCommandWithTiming(command);
      results.push(result);
    }
    
    // Calculate average execution time
    const avgTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
    
    // Log average
    logPerformance('multiple-commands-average', avgTime, {
      sampleSize: commands.length
    });
    
    // Ensure all commands succeeded
    results.forEach((result, index) => {
      expect(result.code).toBe(0);
      expect(result.stdout).not.toBe('');
    });
    
    // Performance should remain consistent
    const times = results.map(r => r.executionTime);
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    
    // Log consistency data
    logPerformance('command-consistency', maxTime - minTime, {
      minTime,
      maxTime,
      commands: commands.length
    });
    
    // Consistency expectations (adjust as needed)
    expect(maxTime).toBeLessThan(10000); // No command should take more than 10 seconds
  });
});

// Create a summary of performance results
afterAll(() => {
  if (fs.existsSync(PERFORMANCE_LOG)) {
    const logData = JSON.parse(fs.readFileSync(PERFORMANCE_LOG, 'utf8'));
    
    const summary = {
      totalTests: logData.length,
      averageExecutionTime: logData.reduce((sum, entry) => sum + entry.executionTime, 0) / logData.length,
      fastestTest: logData.reduce((fastest, entry) => 
        entry.executionTime < fastest.time ? { name: entry.test, time: entry.executionTime } : fastest, 
        { name: '', time: Infinity }),
      slowestTest: logData.reduce((slowest, entry) => 
        entry.executionTime > slowest.time ? { name: entry.test, time: entry.executionTime } : slowest, 
        { name: '', time: 0 }),
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(
      path.join(TEST_DIR, 'performance-summary.json'), 
      JSON.stringify(summary, null, 2)
    );
    
    console.log('Performance Summary:');
    console.log(`- Total Tests: ${summary.totalTests}`);
    console.log(`- Average Execution Time: ${summary.averageExecutionTime.toFixed(2)}ms`);
    console.log(`- Fastest Test: ${summary.fastestTest.name} (${summary.fastestTest.time.toFixed(2)}ms)`);
    console.log(`- Slowest Test: ${summary.slowestTest.name} (${summary.slowestTest.time.toFixed(2)}ms)`);
  }
});