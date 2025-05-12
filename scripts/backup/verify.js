#!/usr/bin/env node

/**
 * Backup verification script for Claude Neural Framework
 * 
 * Verifies the integrity and recoverability of backups
 * 
 * Usage:
 *   node verify.js [options]
 * 
 * Options:
 *   --backup-id=<id>           Specific backup ID to verify
 *   --category=<category>      Verify specific category (critical, important, historical, all)
 *   --target=<path|db>         Verify specific path or database only
 *   --latest                   Verify the latest backup
 *   --verbose                  Show detailed output
 *   --report=<path>            Save verification report to file
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { execSync } = require('child_process');
const { program } = require('commander');

// Import the logger from the core framework
const logger = require('../../core/logging/logger')('verify');

// Read configuration
let config;
try {
  const configPath = path.join(__dirname, '../../core/config/backup_config.json');
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error('Error loading backup configuration:', error.message);
  process.exit(1);
}

// CLI options
program
  .option('--backup-id <id>', 'Specific backup ID to verify')
  .option('--category <category>', 'Verify specific category (critical, important, historical, all)', 'all')
  .option('--target <path>', 'Verify specific path or database only')
  .option('--latest', 'Verify the latest backup')
  .option('--verbose', 'Show detailed output')
  .option('--report <path>', 'Save verification report to file')
  .parse(process.argv);

const options = program.opts();

// Find the backup to verify
const findBackup = () => {
  if (options.backupId) {
    return options.backupId;
  }
  
  if (options.latest) {
    // Find latest backup
    // In a real implementation, this would scan for the latest backup
    return 'backup-full-' + new Date().toISOString().replace(/[:.]/g, '-');
  }
  
  console.error('Error: Must specify --backup-id or --latest');
  process.exit(1);
};

// Decrypt data if needed
const decryptData = (data) => {
  if (!config.encryption.enabled) return data;
  
  // In a real system, would get key from secure storage
  const key = process.env[config.encryption.keyVariable] || 'default-dev-key-0000000000000000';
  
  const iv = data.slice(0, 16);
  const encryptedData = data.slice(16);
  
  try {
    const decipher = crypto.createDecipheriv(
      config.encryption.algorithm, 
      Buffer.from(key, 'utf8').slice(0, 32), 
      iv
    );
    
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  } catch (error) {
    return null; // Indicate decryption failure
  }
};

// Decompress data if needed
const decompressData = (data) => {
  if (!config.compression.enabled) return data;
  
  if (config.compression.algorithm === 'gzip') {
    try {
      return zlib.gunzipSync(data);
    } catch (error) {
      return null; // Indicate decompression failure
    }
  }
  
  return data;
};

// Verify a specific backup
const verifyBackup = (backupId, category) => {
  logger.info(`Verifying ${category} backup: ${backupId}`);
  
  // Determine backup path
  const backupPath = path.join(
    config.backupLocations.local.path,
    category,
    backupId
  );
  
  if (options.verbose) {
    logger.info(`Backup path: ${backupPath}`);
  }
  
  // Check if backup exists
  // In a real implementation, this would check if the path exists
  // For the demo, we'll just assume it does
  
  // Read and parse the manifest
  // In a real implementation, we would read the actual manifest
  // For the demo, just create a placeholder
  const manifest = {
    backupId,
    timestamp: new Date().toISOString(),
    type: 'full',
    files: [
      { path: 'core/config/config.json', size: 1024, checksum: 'abc123' },
      { path: 'core/mcp/server_config.json', size: 512, checksum: 'def456' }
    ],
    databases: [
      { name: 'rag_vector_store', type: 'vector', size: 10240 }
    ]
  };
  
  // Verification results
  const results = {
    backupId,
    category,
    totalFiles: manifest.files.length,
    validFiles: 0,
    invalidFiles: 0,
    missingFiles: 0,
    totalDatabases: manifest.databases.length,
    validDatabases: 0,
    invalidDatabases: 0,
    decryptionErrors: 0,
    decompressionErrors: 0,
    startTime: new Date(),
    endTime: null,
    status: 'failed',
    problems: []
  };
  
  // Verify files
  for (const file of manifest.files) {
    if (options.verbose) {
      logger.info(`Verifying file: ${file.path}`);
    }
    
    // Check if file exists in backup
    const filePath = path.join(backupPath, file.path);
    
    // In a real implementation, we would check if the file exists
    // For the demo, we'll just assume it does
    
    // Check if target is specified and match
    if (options.target && !file.path.includes(options.target)) {
      continue;
    }
    
    // Read file content
    // In a real implementation, we would read the actual file
    // For the demo, create dummy content for verification
    const fileContent = Buffer.from('dummy content');
    
    // Process file
    let processedContent;
    try {
      // Decrypt if needed
      const decrypted = decryptData(fileContent);
      if (decrypted === null) {
        results.decryptionErrors++;
        results.invalidFiles++;
        results.problems.push(`Decryption failed for ${file.path}`);
        continue;
      }
      
      // Decompress if needed
      processedContent = decompressData(decrypted);
      if (processedContent === null) {
        results.decompressionErrors++;
        results.invalidFiles++;
        results.problems.push(`Decompression failed for ${file.path}`);
        continue;
      }
      
      // Verify checksum
      const checksum = crypto.createHash('sha256').update(processedContent).digest('hex');
      
      if (checksum !== file.checksum) {
        results.invalidFiles++;
        results.problems.push(`Checksum mismatch for ${file.path}`);
        continue;
      }
      
      results.validFiles++;
    } catch (error) {
      results.invalidFiles++;
      results.problems.push(`Error processing ${file.path}: ${error.message}`);
    }
  }
  
  // Verify databases
  for (const db of manifest.databases) {
    if (options.verbose) {
      logger.info(`Verifying database: ${db.name}`);
    }
    
    // Check if target is specified and match
    if (options.target && options.target !== db.name) {
      continue;
    }
    
    // In a real implementation, this would verify database dumps
    // For the demo, we'll just assume they're valid
    
    results.validDatabases++;
  }
  
  // Update final status
  results.endTime = new Date();
  
  if (results.invalidFiles === 0 && results.missingFiles === 0 && 
      results.decryptionErrors === 0 && results.decompressionErrors === 0) {
    results.status = 'passed';
  }
  
  // Calculate verification duration
  const durationMs = results.endTime - results.startTime;
  results.duration = `${(durationMs / 1000).toFixed(2)}s`;
  
  return results;
};

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
  console.log('\nVerification Summary:');
  console.log('--------------------');
  console.log(`Backup ID: ${results.backupId}`);
  console.log(`Category: ${results.category}`);
  console.log(`Status: ${results.status.toUpperCase()}`);
  console.log(`Duration: ${results.duration}`);
  console.log('\nFiles:');
  console.log(`  Total: ${results.totalFiles}`);
  console.log(`  Valid: ${results.validFiles}`);
  console.log(`  Invalid: ${results.invalidFiles}`);
  console.log(`  Missing: ${results.missingFiles}`);
  console.log('\nDatabases:');
  console.log(`  Total: ${results.totalDatabases}`);
  console.log(`  Valid: ${results.validDatabases}`);
  console.log(`  Invalid: ${results.totalDatabases - results.validDatabases}`);
  
  if (results.problems.length > 0) {
    console.log('\nProblems:');
    results.problems.forEach((problem, i) => {
      console.log(`  ${i+1}. ${problem}`);
    });
  }
  
  console.log('\nVerification completed at:', results.endTime.toISOString());
};

// Main execution logic
const runVerification = async () => {
  try {
    // Find backup to verify
    const backupId = findBackup();
    
    let allResults = [];
    let overallStatus = 'passed';
    
    // Determine categories to verify
    const categoriesToVerify = options.category === 'all' 
      ? Object.keys(config.dataCategories)
      : [options.category];
    
    // Verify each category
    for (const category of categoriesToVerify) {
      if (!config.dataCategories[category]) {
        logger.warn(`Unknown category: ${category}, skipping`);
        continue;
      }
      
      const results = verifyBackup(backupId, category);
      allResults.push(results);
      
      if (results.status === 'failed') {
        overallStatus = 'failed';
      }
    }
    
    // Generate combined results
    const combinedResults = {
      backupId,
      categories: categoriesToVerify,
      results: allResults,
      overallStatus,
      timestamp: new Date().toISOString()
    };
    
    // Save report if requested
    saveReport(combinedResults);
    
    // Print summary for each category
    allResults.forEach(results => {
      printSummary(results);
    });
    
    // Return success/failure
    return overallStatus === 'passed';
    
  } catch (error) {
    logger.error(`Verification failed: ${error.message}`);
    return false;
  }
};

// Run the verification
const success = runVerification();
if (!success) {
  process.exit(1);
}