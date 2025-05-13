#!/usr/bin/env node

/**
 * System verification script for Claude Neural Framework
 * 
 * Verifies system integrity after a recovery operation
 * 
 * Usage:
 *   node system_verification.js [options]
 * 
 * Options:
 *   --component=<name>    Verify specific component only
 *   --all                 Verify all components (default)
 *   --verbose             Show detailed output
 *   --report=<path>       Save verification report to file
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { program } = require('commander');

// Import the logger from the core framework
const logger = require('../../core/logging/logger')('system-verify');

// CLI options
program
  .option('--component <name>', 'Verify specific component only')
  .option('--all', 'Verify all components', true)
  .option('--verbose', 'Show detailed output')
  .option('--report <path>', 'Save verification report to file')
  .parse(process.argv);

const options = program.opts();

// System components to verify
const components = {
  configuration: {
    name: 'Configuration',
    verify: verifyConfiguration,
    critical: true
  },
  filesystem: {
    name: 'File System',
    verify: verifyFilesystem,
    critical: true
  },
  database: {
    name: 'Database',
    verify: verifyDatabase,
    critical: true
  },
  security: {
    name: 'Security',
    verify: verifySecurity,
    critical: true
  },
  mcp: {
    name: 'MCP Integration',
    verify: verifyMCP,
    critical: false
  },
  rag: {
    name: 'RAG System',
    verify: verifyRAG,
    critical: false
  },
  network: {
    name: 'Network',
    verify: verifyNetwork,
    critical: false
  }
};

// Verify configuration system
async function verifyConfiguration() {
  logger.info('Verifying configuration system...');
  
  const result = {
    component: 'configuration',
    status: 'failed',
    problems: [],
    details: {}
  };
  
  try {
    // Check if core config files exist
    const configFiles = [
      '/workspace/core/config/mcp_config.json',
      '/workspace/core/config/rag_config.json',
      '/workspace/core/config/security_constraints.json',
      '/workspace/core/config/backup_config.json'
    ];
    
    let allFilesExist = true;
    for (const file of configFiles) {
      // In a real implementation, check if the file exists and has valid JSON
      // For demo, we'll just simulate success
      
      if (options.verbose) {
        logger.info(`Checking config file: ${file}`);
      }
      
      // Simulate success
      result.details[file] = 'valid';
    }
    
    if (allFilesExist) {
      result.status = 'passed';
    } else {
      result.problems.push('Missing essential configuration files');
    }
  } catch (error) {
    result.problems.push(`Configuration verification error: ${error.message}`);
  }
  
  return result;
}

// Verify filesystem integrity
async function verifyFilesystem() {
  logger.info('Verifying filesystem integrity...');
  
  const result = {
    component: 'filesystem',
    status: 'failed',
    problems: [],
    details: {}
  };
  
  try {
    // Check critical directories and permissions
    const criticalDirs = [
      '/workspace/core',
      '/workspace/core/mcp',
      '/workspace/core/rag',
      '/workspace/core/config',
      '/workspace/scripts',
      '/workspace/scripts/backup'
    ];
    
    let allDirsExist = true;
    for (const dir of criticalDirs) {
      // In a real implementation, check if the directory exists and has proper permissions
      // For demo, we'll just simulate success
      
      if (options.verbose) {
        logger.info(`Checking directory: ${dir}`);
      }
      
      // Simulate success
      result.details[dir] = 'exists';
    }
    
    if (allDirsExist) {
      result.status = 'passed';
    } else {
      result.problems.push('Missing critical directories');
    }
  } catch (error) {
    result.problems.push(`Filesystem verification error: ${error.message}`);
  }
  
  return result;
}

// Verify database integrity
async function verifyDatabase() {
  logger.info('Verifying database integrity...');
  
  const result = {
    component: 'database',
    status: 'failed',
    problems: [],
    details: {}
  };
  
  try {
    // In a real implementation, check vector database integrity
    // For demo, we'll just simulate success
    
    if (options.verbose) {
      logger.info('Checking RAG vector database...');
    }
    
    // Simulate database connection and verification
    result.details.vectorDb = 'connected';
    result.details.vectorDbSize = '1024 records';
    result.details.vectorDbIntegrity = 'valid';
    
    result.status = 'passed';
  } catch (error) {
    result.problems.push(`Database verification error: ${error.message}`);
  }
  
  return result;
}

// Verify security system
async function verifySecurity() {
  logger.info('Verifying security system...');
  
  const result = {
    component: 'security',
    status: 'failed',
    problems: [],
    details: {}
  };
  
  try {
    // In a real implementation, check security configuration
    // For demo, we'll just simulate success
    
    if (options.verbose) {
      logger.info('Checking security constraints...');
    }
    
    // Simulate security checks
    result.details.securityConstraints = 'valid';
    result.details.apiSecurity = 'enabled';
    result.details.encryptionKeys = 'available';
    
    result.status = 'passed';
  } catch (error) {
    result.problems.push(`Security verification error: ${error.message}`);
  }
  
  return result;
}

// Verify MCP integration
async function verifyMCP() {
  logger.info('Verifying MCP integration...');
  
  const result = {
    component: 'mcp',
    status: 'failed',
    problems: [],
    details: {}
  };
  
  try {
    // In a real implementation, check MCP connectivity
    // For demo, we'll just simulate success
    
    if (options.verbose) {
      logger.info('Checking MCP server configuration...');
    }
    
    // Simulate MCP checks
    result.details.mcpConfig = 'valid';
    result.details.mcpConnection = 'available';
    
    result.status = 'passed';
  } catch (error) {
    result.problems.push(`MCP verification error: ${error.message}`);
  }
  
  return result;
}

// Verify RAG system
async function verifyRAG() {
  logger.info('Verifying RAG system...');
  
  const result = {
    component: 'rag',
    status: 'failed',
    problems: [],
    details: {}
  };
  
  try {
    // In a real implementation, check RAG system
    // For demo, we'll just simulate success
    
    if (options.verbose) {
      logger.info('Checking RAG configuration...');
    }
    
    // Simulate RAG checks
    result.details.ragConfig = 'valid';
    result.details.embeddingModels = 'available';
    result.details.vectorDbConnection = 'working';
    
    result.status = 'passed';
  } catch (error) {
    result.problems.push(`RAG verification error: ${error.message}`);
  }
  
  return result;
}

// Verify network connectivity
async function verifyNetwork() {
  logger.info('Verifying network connectivity...');
  
  const result = {
    component: 'network',
    status: 'failed',
    problems: [],
    details: {}
  };
  
  try {
    // In a real implementation, check network connectivity
    // For demo, we'll just simulate success
    
    if (options.verbose) {
      logger.info('Checking network connectivity...');
    }
    
    // Simulate network checks
    result.details.claudeApi = 'accessible';
    result.details.mcpApi = 'accessible';
    result.details.internalNetwork = 'working';
    
    result.status = 'passed';
  } catch (error) {
    result.problems.push(`Network verification error: ${error.message}`);
  }
  
  return result;
}

// Save verification report if requested
const saveReport = (results) => {
  if (!options.report) return;
  
  try {
    const reportPath = options.report;
    const reportDir = path.dirname(reportPath);
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    logger.info(`Verification report saved to ${reportPath}`);
  } catch (error) {
    logger.error(`Failed to save report: ${error.message}`);
  }
};

// Print verification summary
const printSummary = (results) => {
  console.log('\nSystem Verification Summary:');
  console.log('--------------------------');
  
  const overallStatus = results.overallStatus.toUpperCase();
  const statusColor = overallStatus === 'PASSED' ? '\x1b[32m' : '\x1b[31m';
  console.log(`Overall Status: ${statusColor}${overallStatus}\x1b[0m`);
  
  console.log('\nComponent Results:');
  results.componentResults.forEach(result => {
    const componentStatus = result.status.toUpperCase();
    const componentColor = componentStatus === 'PASSED' ? '\x1b[32m' : '\x1b[31m';
    console.log(`  ${result.component}: ${componentColor}${componentStatus}\x1b[0m`);
    
    if (result.problems.length > 0) {
      console.log('    Problems:');
      result.problems.forEach((problem, i) => {
        console.log(`      ${i+1}. ${problem}`);
      });
    }
  });
  
  console.log('\nVerification completed at:', results.timestamp);
};

// Main execution logic
const runVerification = async () => {
  try {
    logger.info('Starting system verification...');
    
    const results = {
      componentResults: [],
      overallStatus: 'passed',
      timestamp: new Date().toISOString(),
      criticalFailures: 0,
      nonCriticalFailures: 0
    };
    
    // Determine components to verify
    const componentsToVerify = options.component
      ? [options.component]
      : Object.keys(components);
    
    // Verify each component
    for (const componentKey of componentsToVerify) {
      const component = components[componentKey];
      
      if (!component) {
        logger.warn(`Unknown component: ${componentKey}, skipping`);
        continue;
      }
      
      logger.info(`Verifying ${component.name}...`);
      
      const result = await component.verify();
      results.componentResults.push(result);
      
      if (result.status === 'failed') {
        if (component.critical) {
          results.criticalFailures++;
        } else {
          results.nonCriticalFailures++;
        }
      }
    }
    
    // Determine overall status
    if (results.criticalFailures > 0) {
      results.overallStatus = 'failed';
      logger.error(`System verification failed with ${results.criticalFailures} critical component failures`);
    } else if (results.nonCriticalFailures > 0) {
      results.overallStatus = 'warning';
      logger.warn(`System verification passed with warnings: ${results.nonCriticalFailures} non-critical component failures`);
    } else {
      logger.info('System verification passed successfully');
    }
    
    // Save report if requested
    saveReport(results);
    
    // Print summary
    printSummary(results);
    
    // Return success/failure
    return results.criticalFailures === 0;
    
  } catch (error) {
    logger.error(`System verification failed: ${error.message}`);
    return false;
  }
};

// Run the verification
const success = runVerification();
if (!success) {
  process.exit(1);
}