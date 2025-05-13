#!/usr/bin/env node

/**
 * Security Check CLI Tool
 * 
 * Command-line tool to run security reviews for the Claude Neural Framework.
 */

import fs from 'fs';
import path from 'path';
import { program } from 'commander';
import chalk from 'chalk';

// Import the security review module
import { SecurityReview, SecurityReport } from './security-review';

// Import logger
import { Logger } from '../logging/logger';

/**
 * Interface for security check options
 */
interface SecurityCheckOptions {
  dir?: string;
  files?: string;
  exclude?: string;
  output?: string;
  autofix?: boolean;
  relaxed?: boolean;
  verbose?: boolean;
}

/**
 * Run security check
 * 
 * @param options - Security check options
 */
async function runSecurityCheck(options: SecurityCheckOptions): Promise<void> {
  const logger = new Logger('security-check');
  
  console.log(chalk.bold('\n=== Claude Neural Framework - Security Check ===\n'));
  
  try {
    // Create security review instance
    const securityReview = new SecurityReview({
      autoFix: options.autofix,
      strictMode: !options.relaxed,
      reportPath: options.output || path.join(process.cwd(), 'security-report.json')
    });
    
    console.log(chalk.blue('Running security review...'));
    
    // Context for validation
    const context = {
      targetDir: options.dir || process.cwd(),
      targetFiles: options.files ? options.files.split(',') : undefined,
      excludePatterns: options.exclude ? options.exclude.split(',') : undefined
    };
    
    // Run validators
    const results = await securityReview.runValidators(context);
    
    // Print results summary
    printResultsSummary(results);
    
    // Print detailed results if requested
    if (options.verbose) {
      printDetailedResults(results);
    }
    
    // Exit with error code if issues found and strict mode enabled
    const hasIssues = results.summary.vulnerabilitiesCount > 0 || 
      (results.summary.findingsCount > 0 && !options.relaxed);
    
    if (hasIssues && !options.relaxed) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error(chalk.red(`\nError: ${(error as Error).message}`));
    
    if (options.verbose) {
      console.error(error);
    }
    
    process.exit(1);
  }
}

/**
 * Print results summary
 * 
 * @param results - Security report results
 */
function printResultsSummary(results: SecurityReport): void {
  const { summary } = results;
  
  console.log('\n');
  console.log(chalk.bold('Security Review Summary:'));
  console.log('─'.repeat(50));
  
  // Security score with color
  let scoreColor;
  if (summary.securityScore >= 90) {
    scoreColor = chalk.green;
  } else if (summary.securityScore >= 70) {
    scoreColor = chalk.yellow;
  } else {
    scoreColor = chalk.red;
  }
  
  console.log(`Security Score: ${scoreColor(summary.securityScore + '/100')}`);
  
  // Validators summary
  console.log(`Validators: ${chalk.green(summary.passedValidators + ' passed')}, ${
    chalk.red((summary.totalValidators - summary.passedValidators) + ' failed')
  } (${summary.totalValidators} total)`);
  
  // Issues summary
  if (summary.vulnerabilitiesCount > 0) {
    console.log(`Vulnerabilities: ${chalk.red(summary.vulnerabilitiesCount + ' found')}`);
  } else {
    console.log(`Vulnerabilities: ${chalk.green('None found')}`);
  }
  
  if (summary.findingsCount > 0) {
    console.log(`Findings: ${chalk.yellow(summary.findingsCount + ' found')}`);
  } else {
    console.log(`Findings: ${chalk.green('None found')}`);
  }
  
  // Report location
  console.log(`\nDetailed report saved to: ${chalk.cyan(results.reportPath || '')}`);
  
  // Recommendations preview
  if (results.recommendations && results.recommendations.length > 0) {
    console.log('\n');
    console.log(chalk.bold('Top Recommendations:'));
    
    // Sort recommendations by severity/importance
    const sortedRecommendations = [...results.recommendations]
      .sort((a, b) => {
        // Sort vulnerabilities first, then by severity
        if (a.type === 'vulnerability' && b.type !== 'vulnerability') return -1;
        if (a.type !== 'vulnerability' && b.type === 'vulnerability') return 1;
        
        // Sort vulnerabilities by severity
        if (a.type === 'vulnerability' && b.type === 'vulnerability') {
          const severityOrder: Record<string, number> = { 
            critical: 0, 
            high: 1, 
            medium: 2, 
            low: 3 
          };
          if (a.severity && b.severity) {
            return severityOrder[a.severity] - severityOrder[b.severity];
          }
        }
        
        return 0;
      });
    
    // Show top 3 recommendations
    for (let i = 0; i < Math.min(3, sortedRecommendations.length); i++) {
      const rec = sortedRecommendations[i];
      console.log(`${i + 1}. ${(rec.type === 'vulnerability' && 
        (rec.severity === 'critical' || rec.severity === 'high')) 
        ? chalk.red(rec.title) 
        : chalk.yellow(rec.title)
      }`);
    }
    
    if (sortedRecommendations.length > 3) {
      console.log(`... and ${sortedRecommendations.length - 3} more recommendations`);
    }
  }
  
  console.log('\n');
}

/**
 * Print detailed results
 * 
 * @param results - Security report results
 */
function printDetailedResults(results: SecurityReport): void {
  console.log('\n');
  console.log(chalk.bold('Detailed Security Review Results:'));
  console.log('═'.repeat(70));
  
  // Print vulnerabilities
  if (results.vulnerabilities && results.vulnerabilities.length > 0) {
    console.log('\n');
    console.log(chalk.bold(chalk.red('Vulnerabilities:')));
    console.log('─'.repeat(50));
    
    for (const vuln of results.vulnerabilities) {
      let severityColor;
      switch (vuln.severity) {
        case 'critical':
          severityColor = chalk.bgRed.white;
          break;
        case 'high':
          severityColor = chalk.red;
          break;
        case 'medium':
          severityColor = chalk.yellow;
          break;
        case 'low':
          severityColor = chalk.blue;
          break;
        default:
          severityColor = chalk.white;
      }
      
      console.log(`${severityColor(vuln.severity.toUpperCase())} - ${chalk.bold(vuln.title)}`);
      console.log(`Description: ${vuln.description}`);
      console.log(`Location: ${chalk.cyan(vuln.location)}`);
      
      if (vuln.recommendation) {
        console.log(`Recommendation: ${vuln.recommendation}`);
      }
      
      console.log('─'.repeat(50));
    }
  }
  
  // Print findings
  if (results.findings && results.findings.length > 0) {
    console.log('\n');
    console.log(chalk.bold(chalk.yellow('Findings:')));
    console.log('─'.repeat(50));
    
    for (const finding of results.findings) {
      console.log(`${chalk.yellow('FINDING')} - ${chalk.bold(finding.title)}`);
      console.log(`Description: ${finding.description}`);
      console.log(`Location: ${chalk.cyan(finding.location)}`);
      console.log(`Validator: ${finding.validator}`);
      console.log('─'.repeat(50));
    }
  }
  
  // Print recommendations
  if (results.recommendations && results.recommendations.length > 0) {
    console.log('\n');
    console.log(chalk.bold('Recommendations:'));
    console.log('─'.repeat(50));
    
    for (const rec of results.recommendations) {
      let titleColor = chalk.white;
      
      if (rec.type === 'vulnerability') {
        switch (rec.severity) {
          case 'critical':
          case 'high':
            titleColor = chalk.red;
            break;
          case 'medium':
            titleColor = chalk.yellow;
            break;
          default:
            titleColor = chalk.blue;
        }
      }
      
      console.log(`${titleColor(chalk.bold(rec.title))}`);
      console.log(`${rec.description}`);
      console.log('─'.repeat(50));
    }
  }
}

// Setup CLI options
program
  .name('security-check')
  .description('Run security review for Claude Neural Framework')
  .version('1.0.0')
  .option('-d, --dir <directory>', 'target directory to check (defaults to current directory)')
  .option('-f, --files <file-list>', 'comma-separated list of specific files to check')
  .option('-e, --exclude <pattern-list>', 'comma-separated list of patterns to exclude')
  .option('-o, --output <file>', 'output report file path')
  .option('-a, --autofix', 'automatically fix simple issues')
  .option('-r, --relaxed', 'relaxed mode (exit with success even with findings)')
  .option('-v, --verbose', 'show detailed information')
  .parse(process.argv);

// Run security check with CLI options
runSecurityCheck(program.opts() as SecurityCheckOptions);