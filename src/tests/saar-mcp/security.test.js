/**
 * SAAR-MCP Security Tests
 * 
 * Tests the security aspects of the SAAR-MCP integration.
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
const SECURITY_LOG = path.join(TEST_DIR, 'security.log');

// Path to the saar-mcp.sh script
const SAAR_MCP_SCRIPT = path.join(WORKSPACE_DIR, 'saar-mcp.sh');

// Test storage
let testData = {};

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

// Helper function to run a command and capture output
async function runCommand(command, args = []) {
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
      resolve({
        code,
        stdout,
        stderr
      });
    });
    
    process.on('error', (err) => {
      reject(err);
    });
  });
}

// Log security test results
function logSecurityTest(testName, result, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    test: testName,
    passed: result,
    ...details
  };
  
  // Create or append to log file
  const logData = fs.existsSync(SECURITY_LOG)
    ? JSON.parse(fs.readFileSync(SECURITY_LOG, 'utf8'))
    : [];
    
  logData.push(logEntry);
  
  fs.writeFileSync(SECURITY_LOG, JSON.stringify(logData, null, 2));
  
  return logEntry;
}

// Test script permissions
describe('Script Permissions', () => {
  // Test that the script has the right permissions
  test('should have executable permissions', async () => {
    // Check file permissions
    const stats = fs.statSync(SAAR_MCP_SCRIPT);
    const isExecutable = !!(stats.mode & fs.constants.S_IXUSR);
    
    logSecurityTest('executable-permissions', isExecutable, {
      scriptPath: SAAR_MCP_SCRIPT,
      mode: stats.mode.toString(8)
    });
    
    expect(isExecutable).toBe(true);
  });
  
  // Test that the script is owned by the right user
  test('should be owned by the current user', async () => {
    // Get current user
    const { stdout: userId } = await execAsync('id -u');
    const currentUserId = Number(userId.trim());
    
    // Get file owner
    const stats = fs.statSync(SAAR_MCP_SCRIPT);
    
    const result = stats.uid === currentUserId;
    
    logSecurityTest('owner-check', result, {
      scriptPath: SAAR_MCP_SCRIPT,
      fileOwner: stats.uid,
      currentUser: currentUserId
    });
    
    expect(result).toBe(true);
  });
});

// Test command injection prevention
describe('Command Injection Prevention', () => {
  // Test handling of potentially dangerous input
  test('should safely handle special characters', async () => {
    // Create a list of potentially dangerous inputs
    const testInputs = [
      ';echo INJECTION_SUCCESSFUL',
      '$(echo INJECTION_SUCCESSFUL)',
      '`echo INJECTION_SUCCESSFUL`',
      '&&echo INJECTION_SUCCESSFUL',
      '||echo INJECTION_SUCCESSFUL',
      '|echo INJECTION_SUCCESSFUL'
    ];
    
    const results = [];
    
    // Test each input with the memory store command
    for (const input of testInputs) {
      const result = await runCommand(`${SAAR_MCP_SCRIPT} memory store "${input}"`);
      results.push({
        input,
        result,
        isVulnerable: result.stdout.includes('INJECTION_SUCCESSFUL') || 
                      result.stderr.includes('INJECTION_SUCCESSFUL')
      });
      
      logSecurityTest(`command-injection-${input}`, !results[results.length - 1].isVulnerable, {
        input,
        vulnerable: results[results.length - 1].isVulnerable
      });
    }
    
    // Check if any tests were vulnerable
    const vulnerableResults = results.filter(r => r.isVulnerable);
    
    expect(vulnerableResults.length).toBe(0);
    
    if (vulnerableResults.length > 0) {
      console.error('Vulnerable to command injection:');
      vulnerableResults.forEach(v => {
        console.error(`- Input: ${v.input}`);
      });
    }
  });
});

// Test path traversal prevention
describe('Path Traversal Prevention', () => {
  // Test handling of path traversal attempts
  test('should safely handle path traversal attempts', async () => {
    // Test only if mcp integration script exists
    const mcp_integration_path = path.join(WORKSPACE_DIR, 'saar', 'startup', '07_mcp_integration.sh');
    if (!fs.existsSync(mcp_integration_path)) {
      console.warn('Skipping path traversal test - mcp integration script not found');
      return;
    }
    
    // Find a sensitive file that should be protected
    const sensitiveFile = path.join(WORKSPACE_DIR, 'saar', 'startup', '07_mcp_integration.sh');
    if (!fs.existsSync(sensitiveFile)) {
      console.warn('Skipping path traversal test - sensitive file not found');
      return;
    }
    
    // Try to access files outside the allowed directories
    const pathTraversals = [
      '../../../etc/passwd',
      '../../../../etc/passwd',
      '%2e%2e%2f%2e%2e%2fetc/passwd', // URL-encoded ../../etc/passwd
      path.relative(TEST_DIR, sensitiveFile)
    ];
    
    const results = [];
    
    // Test each input with the memory get/read command
    for (const traversalPath of pathTraversals) {
      // No direct 'read file' command in saar-mcp.sh, so we test with memory get
      // which won't directly read these files but should reject such paths
      const result = await runCommand(`${SAAR_MCP_SCRIPT} memory get "${traversalPath}"`);
      
      const isVulnerable = result.code === 0 && 
                          (result.stdout.includes('root:') || 
                           result.stdout.includes('bin:') ||
                           result.stdout.includes('function setup_mcp_integration'));
      
      results.push({
        path: traversalPath,
        result,
        isVulnerable
      });
      
      logSecurityTest(`path-traversal-${traversalPath}`, !isVulnerable, {
        traversalPath,
        vulnerable: isVulnerable
      });
    }
    
    // Check if any tests were vulnerable
    const vulnerableResults = results.filter(r => r.isVulnerable);
    
    expect(vulnerableResults.length).toBe(0);
    
    if (vulnerableResults.length > 0) {
      console.error('Vulnerable to path traversal:');
      vulnerableResults.forEach(v => {
        console.error(`- Path: ${v.path}`);
      });
    }
  });
});

// Test directory access control
describe('Directory Access Control', () => {
  // Test that the script doesn't access disallowed directories
  test('should confine access to allowed directories', async () => {
    // Create a list of directories that should be protected
    const protectedDirs = [
      '/etc',
      '/usr',
      '/bin',
      '/sbin',
      '/var',
      '/boot',
      '/dev'
    ];
    
    // Create a temporary file to be used for testing
    const testFile = path.join(TEST_DIR, 'test-dir-access.txt');
    const testContent = 'This is a test file for directory access control';
    
    fs.writeFileSync(testFile, testContent);
    
    // Run a simple command to test directory access
    const result = await runCommand(`bash -c "grep 'CONFIG_DIR=' ${SAAR_MCP_SCRIPT}"`);
    
    // Extract the CONFIG_DIR value
    const configDirMatch = result.stdout.match(/CONFIG_DIR="([^"]+)"/);
    if (configDirMatch) {
      testData.configDir = configDirMatch[1];
    }
    
    // Check if the script tries to access protected directories
    let accessesProtectedDirs = false;
    for (const dir of protectedDirs) {
      if (result.stdout.includes(`"${dir}"`) || result.stdout.includes(`'${dir}'`)) {
        accessesProtectedDirs = true;
        break;
      }
    }
    
    logSecurityTest('directory-access-control', !accessesProtectedDirs, {
      configDir: testData.configDir,
      accessesProtectedDirs
    });
    
    expect(accessesProtectedDirs).toBe(false);
  });
});

// Test for insecure temporary files
describe('Temporary File Security', () => {
  // Test that the script creates temporary files securely
  test('should create temporary files securely', async () => {
    // First, check if the script actually creates temp files
    // by looking for mktemp or similar
    const result = await runCommand(`grep -E 'mktemp|tempfile' ${SAAR_MCP_SCRIPT}`);
    
    // If no temp files are created, skip this test
    if (result.stdout.trim() === '') {
      console.log('No temporary file creation detected in script');
      return;
    }
    
    // Check if mktemp is used (secure) rather than a fixed pattern (insecure)
    const usesMktemp = result.stdout.includes('mktemp');
    const usesFixedPattern = result.stdout.match(/\/tmp\/[a-zA-Z0-9_]+\b/);
    
    logSecurityTest('secure-temp-files', usesMktemp && !usesFixedPattern, {
      usesMktemp,
      usesFixedPattern: !!usesFixedPattern
    });
    
    expect(usesMktemp).toBe(true);
    expect(usesFixedPattern).toBeFalsy();
  });
});

// Create a summary of security results
afterAll(() => {
  if (fs.existsSync(SECURITY_LOG)) {
    const logData = JSON.parse(fs.readFileSync(SECURITY_LOG, 'utf8'));
    
    const passedTests = logData.filter(entry => entry.passed).length;
    const totalTests = logData.length;
    
    const summary = {
      totalTests,
      passedTests,
      passRate: (passedTests / totalTests) * 100,
      failedTests: logData.filter(entry => !entry.passed).map(entry => entry.test),
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(
      path.join(TEST_DIR, 'security-summary.json'), 
      JSON.stringify(summary, null, 2)
    );
    
    console.log('Security Test Summary:');
    console.log(`- Total Tests: ${totalTests}`);
    console.log(`- Passed Tests: ${passedTests}`);
    console.log(`- Pass Rate: ${summary.passRate.toFixed(2)}%`);
    
    if (summary.failedTests.length > 0) {
      console.log('- Failed Tests:');
      summary.failedTests.forEach(test => {
        console.log(`  - ${test}`);
      });
    }
  }
});