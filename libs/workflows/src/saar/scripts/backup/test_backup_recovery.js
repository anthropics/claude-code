#!/usr/bin/env node

/**
 * Comprehensive backup and recovery test for Claude Neural Framework
 * 
 * Performs a full backup and recovery test to ensure system recoverability
 * 
 * Usage:
 *   node test_backup_recovery.js [options]
 * 
 * Options:
 *   --category=critical|important|historical    Test specific category only
 *   --target=<path|db>                         Test specific target only
 *   --skip-restore                              Skip the restore phase
 *   --skip-verification                         Skip the verification phase
 *   --force                                     Skip confirmation prompts
 *   --verbose                                   Show detailed output
 *   --report=<path>                             Save test report to file
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { program } = require('commander');
const readline = require('readline');

// Import the logger from the core framework
const logger = require('../../core/logging/logger')('backup-test');

// CLI options
program
  .option('--category <category>', 'Test specific category only (critical, important, historical)')
  .option('--target <target>', 'Test specific target only (path or database)')
  .option('--skip-restore', 'Skip the restore phase')
  .option('--skip-verification', 'Skip the verification phase')
  .option('--force', 'Skip confirmation prompts')
  .option('--verbose', 'Show detailed output')
  .option('--report <path>', 'Save test report to file')
  .parse(process.argv);

const options = program.opts();

// Create readline interface for user prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper to run a command and return its output
const runCommand = (cmd, args, opts = {}) => {
  return new Promise((resolve, reject) => {
    if (options.verbose) {
      logger.info(`Running command: ${cmd} ${args.join(' ')}`);
    }
    
    const cmdProcess = spawn(cmd, args, { ...opts, stdio: 'pipe' });
    
    let stdout = '';
    let stderr = '';
    
    cmdProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      if (options.verbose) {
        process.stdout.write(data);
      }
    });
    
    cmdProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      if (options.verbose) {
        process.stderr.write(data);
      }
    });
    
    cmdProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
  });
};

// Save test report
const saveReport = (report) => {
  if (!options.report) return;
  
  try {
    const reportPath = options.report;
    const reportDir = path.dirname(reportPath);
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    logger.info(`Test report saved to ${reportPath}`);
  } catch (error) {
    logger.error(`Failed to save report: ${error.message}`);
  }
};

// Print test summary
const printSummary = (report) => {
  console.log('\nBackup and Recovery Test Summary:');
  console.log('----------------------------------');
  
  const overallStatus = report.overallStatus.toUpperCase();
  const statusColor = overallStatus === 'PASSED' ? '\x1b[32m' : '\x1b[31m';
  console.log(`Overall Status: ${statusColor}${overallStatus}\x1b[0m`);
  
  console.log('\nPhase Results:');
  Object.entries(report.phases).forEach(([phase, result]) => {
    const phaseStatus = result.status.toUpperCase();
    const phaseColor = phaseStatus === 'PASSED' ? '\x1b[32m' : '\x1b[31m';
    console.log(`  ${phase}: ${phaseColor}${phaseStatus}\x1b[0m (${result.durationMs}ms)`);
    
    if (result.problems && result.problems.length > 0) {
      console.log('    Problems:');
      result.problems.forEach((problem, i) => {
        console.log(`      ${i+1}. ${problem}`);
      });
    }
  });
  
  console.log('\nTest completed at:', report.timestamp);
  console.log(`Total duration: ${Math.round(report.totalDurationMs / 1000)}s`);
};

// Main test execution
const runTest = async () => {
  const startTime = Date.now();
  
  const report = {
    testId: `backup-test-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    timestamp: new Date().toISOString(),
    options: { ...options },
    phases: {},
    overallStatus: 'failed',
    totalDurationMs: 0
  };
  
  // Skip confirmation if --force is used
  if (!options.force) {
    await new Promise((resolve) => {
      rl.question('This test will perform a full backup and recovery test. Are you sure you want to continue? (y/N) ', (answer) => {
        if (answer.toLowerCase() !== 'y') {
          logger.info('Test cancelled by user');
          rl.close();
          process.exit(0);
        }
        resolve();
      });
    });
  }
  
  try {
    // Phase 1: Backup
    logger.info('Starting backup phase...');
    const backupPhaseStart = Date.now();
    
    const backupArgs = ['--type=full'];
    if (options.category) {
      backupArgs.push(`--category=${options.category}`);
    }
    if (options.target) {
      backupArgs.push(`--target=${options.target}`);
    }
    if (options.verbose) {
      backupArgs.push('--verbose');
    }
    
    try {
      const backupResult = await runCommand('node', 
        [path.join(__dirname, 'backup.js'), ...backupArgs]
      );
      
      // Extract backup ID from output
      const backupIdMatch = backupResult.stdout.match(/backup\s+with\s+ID\s+([a-zA-Z0-9-]+)/i);
      const backupId = backupIdMatch ? backupIdMatch[1] : null;
      
      if (!backupId) {
        throw new Error('Could not determine backup ID from output');
      }
      
      report.backupId = backupId;
      
      report.phases.backup = {
        status: 'passed',
        durationMs: Date.now() - backupPhaseStart,
        details: {
          backupId,
          output: backupResult.stdout
        }
      };
      
      logger.info(`Backup phase completed successfully. Backup ID: ${backupId}`);
      
    } catch (error) {
      report.phases.backup = {
        status: 'failed',
        durationMs: Date.now() - backupPhaseStart,
        problems: [error.message]
      };
      
      logger.error(`Backup phase failed: ${error.message}`);
      throw new Error('Backup phase failed');
    }
    
    // Phase 2: Verification
    if (!options.skipVerification) {
      logger.info('Starting verification phase...');
      const verifyPhaseStart = Date.now();
      
      const verifyArgs = ['--backup-id', report.backupId];
      if (options.category) {
        verifyArgs.push(`--category=${options.category}`);
      }
      if (options.target) {
        verifyArgs.push(`--target=${options.target}`);
      }
      if (options.verbose) {
        verifyArgs.push('--verbose');
      }
      
      try {
        const verifyResult = await runCommand('node', 
          [path.join(__dirname, 'verify.js'), ...verifyArgs]
        );
        
        const verificationStatus = verifyResult.stdout.includes('Status: PASSED') ? 'passed' : 'failed';
        
        report.phases.verification = {
          status: verificationStatus,
          durationMs: Date.now() - verifyPhaseStart,
          details: {
            output: verifyResult.stdout
          }
        };
        
        if (verificationStatus === 'failed') {
          // Extract problems from output
          const problems = [];
          const problemsMatch = verifyResult.stdout.match(/Problems:\n([\s\S]*?)(?:\n\n|$)/);
          if (problemsMatch) {
            problems.push(...problemsMatch[1].split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0));
          }
          
          report.phases.verification.problems = problems;
          logger.error('Verification phase failed');
        } else {
          logger.info('Verification phase completed successfully');
        }
        
      } catch (error) {
        report.phases.verification = {
          status: 'failed',
          durationMs: Date.now() - verifyPhaseStart,
          problems: [error.message]
        };
        
        logger.error(`Verification phase failed: ${error.message}`);
      }
    } else {
      logger.info('Skipping verification phase');
      report.phases.verification = {
        status: 'skipped',
        durationMs: 0
      };
    }
    
    // Phase 3: Restore
    if (!options.skipRestore) {
      logger.info('Starting restore phase...');
      const restorePhaseStart = Date.now();
      
      // Create a temporary restore location
      const tempRestoreDir = path.join('/tmp', 'claude-neural-framework-test-restore');
      
      try {
        // Create temp directory
        if (fs.existsSync(tempRestoreDir)) {
          execSync(`rm -rf ${tempRestoreDir}`);
        }
        fs.mkdirSync(tempRestoreDir, { recursive: true });
        
        // Build restore command args
        const restoreArgs = ['--backup-id', report.backupId, '--destination', tempRestoreDir, '--force'];
        if (options.category) {
          restoreArgs.push(`--category=${options.category}`);
        }
        if (options.target) {
          restoreArgs.push(`--target=${options.target}`);
        }
        if (options.verbose) {
          restoreArgs.push('--verbose');
        }
        
        // Run restore
        const restoreResult = await runCommand('node', 
          [path.join(__dirname, 'restore.js'), ...restoreArgs]
        );
        
        // Check for success message
        const restoreSuccess = restoreResult.stdout.includes('System restore completed successfully');
        
        report.phases.restore = {
          status: restoreSuccess ? 'passed' : 'failed',
          durationMs: Date.now() - restorePhaseStart,
          details: {
            restoreLocation: tempRestoreDir,
            output: restoreResult.stdout
          }
        };
        
        if (!restoreSuccess) {
          // Extract problems from output
          const problems = [];
          if (restoreResult.stderr) {
            problems.push(restoreResult.stderr);
          }
          
          report.phases.restore.problems = problems;
          logger.error('Restore phase failed');
        } else {
          logger.info('Restore phase completed successfully');
        }
        
        // Clean up temp directory
        if (restoreSuccess && !options.verbose) {
          execSync(`rm -rf ${tempRestoreDir}`);
        }
        
      } catch (error) {
        report.phases.restore = {
          status: 'failed',
          durationMs: Date.now() - restorePhaseStart,
          problems: [error.message]
        };
        
        logger.error(`Restore phase failed: ${error.message}`);
      }
    } else {
      logger.info('Skipping restore phase');
      report.phases.restore = {
        status: 'skipped',
        durationMs: 0
      };
    }
    
    // Phase 4: System Verification
    logger.info('Starting system verification phase...');
    const sysVerifyPhaseStart = Date.now();
    
    try {
      const sysVerifyArgs = [];
      if (options.verbose) {
        sysVerifyArgs.push('--verbose');
      }
      
      const sysVerifyResult = await runCommand('node', 
        [path.join(__dirname, 'system_verification.js'), ...sysVerifyArgs]
      );
      
      const sysVerificationStatus = sysVerifyResult.stdout.includes('Overall Status: PASSED') ? 'passed' : 'failed';
      
      report.phases.systemVerification = {
        status: sysVerificationStatus,
        durationMs: Date.now() - sysVerifyPhaseStart,
        details: {
          output: sysVerifyResult.stdout
        }
      };
      
      if (sysVerificationStatus === 'failed') {
        // Extract problems from output
        const problems = [];
        const problemsMatch = sysVerifyResult.stdout.match(/Problems:\n([\s\S]*?)(?:\n\n|$)/);
        if (problemsMatch) {
          problems.push(...problemsMatch[1].split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0));
        }
        
        report.phases.systemVerification.problems = problems;
        logger.error('System verification phase failed');
      } else {
        logger.info('System verification phase completed successfully');
      }
      
    } catch (error) {
      report.phases.systemVerification = {
        status: 'failed',
        durationMs: Date.now() - sysVerifyPhaseStart,
        problems: [error.message]
      };
      
      logger.error(`System verification phase failed: ${error.message}`);
    }
    
    // Calculate overall test results
    const failedPhases = Object.values(report.phases)
      .filter(phase => phase.status === 'failed')
      .length;
    
    report.overallStatus = failedPhases === 0 ? 'passed' : 'failed';
    report.totalDurationMs = Date.now() - startTime;
    
    // Save report if requested
    saveReport(report);
    
    // Print summary
    printSummary(report);
    
    return report.overallStatus === 'passed';
    
  } catch (error) {
    logger.error(`Backup and recovery test failed: ${error.message}`);
    
    report.overallStatus = 'failed';
    report.totalDurationMs = Date.now() - startTime;
    report.error = error.message;
    
    // Save report if requested
    saveReport(report);
    
    // Print summary
    printSummary(report);
    
    return false;
  } finally {
    rl.close();
  }
};

// Run the test
runTest().then(success => {
  process.exit(success ? 0 : 1);
});