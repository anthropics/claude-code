/**
 * Generate comprehensive test report for SAAR-MCP integration
 */

const fs = require('fs');
const path = require('path');

// Configuration
const TEST_DIR = path.join(__dirname, '..');
const REPORT_DIR = path.join(TEST_DIR, 'reports');
const PERFORMANCE_LOG = path.join(TEST_DIR, 'performance.log');
const SECURITY_LOG = path.join(TEST_DIR, 'security.log');
const PERFORMANCE_SUMMARY = path.join(TEST_DIR, 'performance-summary.json');
const SECURITY_SUMMARY = path.join(TEST_DIR, 'security-summary.json');

// Create report directory if it doesn't exist
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

// Generate HTML report
function generateHtmlReport() {
  let performanceData = { totalTests: 0 };
  let securityData = { totalTests: 0 };
  
  // Read performance data if available
  if (fs.existsSync(PERFORMANCE_SUMMARY)) {
    try {
      performanceData = JSON.parse(fs.readFileSync(PERFORMANCE_SUMMARY, 'utf8'));
    } catch (err) {
      console.error(`Error reading performance summary: ${err.message}`);
    }
  }
  
  // Read security data if available
  if (fs.existsSync(SECURITY_SUMMARY)) {
    try {
      securityData = JSON.parse(fs.readFileSync(SECURITY_SUMMARY, 'utf8'));
    } catch (err) {
      console.error(`Error reading security summary: ${err.message}`);
    }
  }
  
  // Read raw performance logs if available
  let performanceLogs = [];
  if (fs.existsSync(PERFORMANCE_LOG)) {
    try {
      performanceLogs = JSON.parse(fs.readFileSync(PERFORMANCE_LOG, 'utf8'));
    } catch (err) {
      console.error(`Error reading performance logs: ${err.message}`);
    }
  }
  
  // Read raw security logs if available
  let securityLogs = [];
  if (fs.existsSync(SECURITY_LOG)) {
    try {
      securityLogs = JSON.parse(fs.readFileSync(SECURITY_LOG, 'utf8'));
    } catch (err) {
      console.error(`Error reading security logs: ${err.message}`);
    }
  }
  
  // Generate HTML content
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SAAR-MCP Test Report</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    h1, h2, h3 {
      color: #0066cc;
    }
    
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    }
    
    .summary {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    
    .summary-card {
      background-color: #f9f9f9;
      border-radius: 5px;
      padding: 20px;
      width: 48%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .section {
      margin-bottom: 40px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    
    th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
    
    tr:hover {
      background-color: #f5f5f5;
    }
    
    .pass {
      color: #4caf50;
      font-weight: bold;
    }
    
    .fail {
      color: #f44336;
      font-weight: bold;
    }
    
    .bar-chart {
      background-color: #e0e0e0;
      height: 20px;
      width: 100%;
      border-radius: 4px;
      overflow: hidden;
      margin: 10px 0;
    }
    
    .bar {
      height: 100%;
      background-color: #4caf50;
    }
    
    .recommendations {
      background-color: #fff8e1;
      padding: 15px;
      border-left: 4px solid #ffc107;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>SAAR-MCP Integration Test Report</h1>
    <p>Generated on: ${new Date().toLocaleString()}</p>
  </div>
  
  <div class="summary">
    <div class="summary-card">
      <h2>Performance Summary</h2>
      <p><strong>Total Tests:</strong> ${performanceData.totalTests || 'N/A'}</p>
      <p><strong>Average Execution Time:</strong> ${
        performanceData.averageExecutionTime 
          ? `${performanceData.averageExecutionTime.toFixed(2)}ms` 
          : 'N/A'
      }</p>
      <p><strong>Fastest Test:</strong> ${
        performanceData.fastestTest 
          ? `${performanceData.fastestTest.name} (${performanceData.fastestTest.time.toFixed(2)}ms)` 
          : 'N/A'
      }</p>
      <p><strong>Slowest Test:</strong> ${
        performanceData.slowestTest 
          ? `${performanceData.slowestTest.name} (${performanceData.slowestTest.time.toFixed(2)}ms)` 
          : 'N/A'
      }</p>
    </div>
    
    <div class="summary-card">
      <h2>Security Summary</h2>
      <p><strong>Total Tests:</strong> ${securityData.totalTests || 'N/A'}</p>
      <p><strong>Passed Tests:</strong> ${securityData.passedTests || 'N/A'}</p>
      <p><strong>Pass Rate:</strong> ${
        securityData.passRate 
          ? `${securityData.passRate.toFixed(2)}%` 
          : 'N/A'
      }</p>
      
      <div class="bar-chart">
        <div class="bar" style="width: ${securityData.passRate || 0}%"></div>
      </div>
      
      ${securityData.failedTests && securityData.failedTests.length > 0 
        ? `<p><strong>Failed Tests:</strong></p>
           <ul>
             ${securityData.failedTests.map(test => `<li>${test}</li>`).join('')}
           </ul>`
        : ''}
    </div>
  </div>
  
  <div class="section">
    <h2>Performance Details</h2>
    ${performanceLogs.length > 0 
      ? `<table>
           <thead>
             <tr>
               <th>Test</th>
               <th>Execution Time (ms)</th>
               <th>Details</th>
             </tr>
           </thead>
           <tbody>
             ${performanceLogs.map(log => `
               <tr>
                 <td>${log.test}</td>
                 <td>${log.executionTime}</td>
                 <td>${Object.entries(log)
                   .filter(([key]) => !['timestamp', 'test', 'executionTime'].includes(key))
                   .map(([key, value]) => `<strong>${key}:</strong> ${JSON.stringify(value)}`)
                   .join(', ')}</td>
               </tr>
             `).join('')}
           </tbody>
         </table>`
      : '<p>No performance data available</p>'}
  </div>
  
  <div class="section">
    <h2>Security Details</h2>
    ${securityLogs.length > 0 
      ? `<table>
           <thead>
             <tr>
               <th>Test</th>
               <th>Result</th>
               <th>Details</th>
             </tr>
           </thead>
           <tbody>
             ${securityLogs.map(log => `
               <tr>
                 <td>${log.test}</td>
                 <td class="${log.passed ? 'pass' : 'fail'}">${log.passed ? 'PASS' : 'FAIL'}</td>
                 <td>${Object.entries(log)
                   .filter(([key]) => !['timestamp', 'test', 'passed'].includes(key))
                   .map(([key, value]) => `<strong>${key}:</strong> ${JSON.stringify(value)}`)
                   .join(', ')}</td>
               </tr>
             `).join('')}
           </tbody>
         </table>`
      : '<p>No security data available</p>'}
  </div>
  
  <div class="section">
    <h2>Recommendations</h2>
    <div class="recommendations">
      <h3>Performance Recommendations</h3>
      <ul>
        ${performanceData.averageExecutionTime && performanceData.averageExecutionTime > 5000
          ? '<li>Consider optimizing command execution to improve average response time</li>'
          : '<li>Performance is within acceptable limits</li>'}
        
        ${performanceData.slowestTest && performanceData.slowestTest.time > 10000
          ? `<li>The slowest test (${performanceData.slowestTest.name}) exceeds 10 seconds - consider optimizing this specific operation</li>`
          : ''}
      </ul>
      
      <h3>Security Recommendations</h3>
      <ul>
        ${securityData.passRate && securityData.passRate < 100
          ? '<li>Security tests failed - address all security issues before deployment</li>'
          : '<li>All security tests passed</li>'}
        
        ${securityData.failedTests && securityData.failedTests.length > 0
          ? securityData.failedTests.map(test => `<li>Fix security issue in test: ${test}</li>`).join('')
          : ''}
        
        <li>Regularly update and run security tests to maintain security posture</li>
      </ul>
      
      <h3>General Recommendations</h3>
      <ul>
        <li>Implement continuous integration to run these tests automatically</li>
        <li>Consider adding more comprehensive integration tests covering additional components</li>
        <li>Review error handling to ensure graceful failure in all cases</li>
      </ul>
    </div>
  </div>
  
  <div class="section">
    <h2>Test Environment</h2>
    <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Platform:</strong> ${process.platform}</p>
    <p><strong>Node.js Version:</strong> ${process.version}</p>
  </div>
</body>
</html>
  `;
  
  // Write HTML report
  const reportPath = path.join(REPORT_DIR, 'test-report.html');
  fs.writeFileSync(reportPath, html);
  
  console.log(`HTML report generated: ${reportPath}`);
  return reportPath;
}

// Generate Markdown report
function generateMarkdownReport() {
  let performanceData = { totalTests: 0 };
  let securityData = { totalTests: 0 };
  
  // Read performance data if available
  if (fs.existsSync(PERFORMANCE_SUMMARY)) {
    try {
      performanceData = JSON.parse(fs.readFileSync(PERFORMANCE_SUMMARY, 'utf8'));
    } catch (err) {
      console.error(`Error reading performance summary: ${err.message}`);
    }
  }
  
  // Read security data if available
  if (fs.existsSync(SECURITY_SUMMARY)) {
    try {
      securityData = JSON.parse(fs.readFileSync(SECURITY_SUMMARY, 'utf8'));
    } catch (err) {
      console.error(`Error reading security summary: ${err.message}`);
    }
  }
  
  // Generate Markdown content
  const markdown = `
# SAAR-MCP Integration Test Report

Report generated on: ${new Date().toLocaleString()}

## Summary

### Performance Summary
- **Total Tests:** ${performanceData.totalTests || 'N/A'}
- **Average Execution Time:** ${
    performanceData.averageExecutionTime 
      ? `${performanceData.averageExecutionTime.toFixed(2)}ms` 
      : 'N/A'
  }
- **Fastest Test:** ${
    performanceData.fastestTest 
      ? `${performanceData.fastestTest.name} (${performanceData.fastestTest.time.toFixed(2)}ms)` 
      : 'N/A'
  }
- **Slowest Test:** ${
    performanceData.slowestTest 
      ? `${performanceData.slowestTest.name} (${performanceData.slowestTest.time.toFixed(2)}ms)` 
      : 'N/A'
  }

### Security Summary
- **Total Tests:** ${securityData.totalTests || 'N/A'}
- **Passed Tests:** ${securityData.passedTests || 'N/A'}
- **Pass Rate:** ${
    securityData.passRate 
      ? `${securityData.passRate.toFixed(2)}%` 
      : 'N/A'
  }

${securityData.failedTests && securityData.failedTests.length > 0 
  ? `**Failed Tests:**
${securityData.failedTests.map(test => `- ${test}`).join('\n')}`
  : ''}

## Recommendations

### Performance Recommendations
${performanceData.averageExecutionTime && performanceData.averageExecutionTime > 5000
  ? '- Consider optimizing command execution to improve average response time'
  : '- Performance is within acceptable limits'}

${performanceData.slowestTest && performanceData.slowestTest.time > 10000
  ? `- The slowest test (${performanceData.slowestTest.name}) exceeds 10 seconds - consider optimizing this specific operation`
  : ''}

### Security Recommendations
${securityData.passRate && securityData.passRate < 100
  ? '- Security tests failed - address all security issues before deployment'
  : '- All security tests passed'}

${securityData.failedTests && securityData.failedTests.length > 0
  ? securityData.failedTests.map(test => `- Fix security issue in test: ${test}`).join('\n')
  : ''}

- Regularly update and run security tests to maintain security posture

### General Recommendations
- Implement continuous integration to run these tests automatically
- Consider adding more comprehensive integration tests covering additional components
- Review error handling to ensure graceful failure in all cases

## Test Environment
- **Date:** ${new Date().toLocaleString()}
- **Platform:** ${process.platform}
- **Node.js Version:** ${process.version}
  `;
  
  // Write Markdown report
  const reportPath = path.join(REPORT_DIR, 'test-report.md');
  fs.writeFileSync(reportPath, markdown);
  
  console.log(`Markdown report generated: ${reportPath}`);
  return reportPath;
}

// Generate reports
try {
  const htmlReport = generateHtmlReport();
  const markdownReport = generateMarkdownReport();
  
  console.log('\nTest reports generated successfully!');
  console.log(`- HTML Report: ${htmlReport}`);
  console.log(`- Markdown Report: ${markdownReport}`);
} catch (err) {
  console.error(`Error generating reports: ${err.message}`);
  console.error(err);
  process.exit(1);
}