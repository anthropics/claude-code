/**
 * Sequential Documentation Generator
 * 
 * This module uses the Sequential Planner to generate comprehensive documentation
 * by integrating sequential thinking, Context7, and 21st-dev-magic MCP tools.
 */

const path = require('path');
const fs = require('fs');
const sequentialPlanner = require('../mcp/sequential_planner');
const logger = require('../../core/logging/logger').createLogger('doc-generator');

/**
 * Generate documentation for a file or directory
 * @param {Object} options - Documentation options
 * @param {string} options.path - File or directory path
 * @param {string} options.format - Output format (markdown, html, json)
 * @param {string} options.output - Output file path
 * @param {boolean} options.includePrivate - Whether to include private methods/properties
 * @returns {Promise<Object>} Generation result
 */
async function generateDocumentation(options) {
  try {
    logger.info('Generating documentation', { 
      path: options.path,
      format: options.format || 'markdown'
    });
    
    // Normalize options
    const normalizedOptions = {
      path: options.path,
      format: options.format || 'markdown',
      output: options.output || `./docs/${path.basename(options.path)}.${options.format || 'md'}`,
      includePrivate: options.includePrivate || false
    };
    
    // Check if path exists
    if (!fs.existsSync(normalizedOptions.path)) {
      throw new Error(`Path does not exist: ${normalizedOptions.path}`);
    }
    
    // Determine if it's a file or directory
    const stats = fs.statSync(normalizedOptions.path);
    const isDirectory = stats.isDirectory();
    
    // Create goal for sequential planner
    const goal = isDirectory
      ? `Generate comprehensive documentation for all code files in the directory: ${normalizedOptions.path}`
      : `Generate comprehensive documentation for the code file: ${normalizedOptions.path}`;
      
    // Add format details to goal
    const detailedGoal = `${goal} in ${normalizedOptions.format} format. ${
      normalizedOptions.includePrivate ? 'Include' : 'Exclude'
    } private methods and properties.`;
    
    // Run the sequential planner
    const result = await sequentialPlanner.runPlanningCycle(
      detailedGoal,
      async ({ step, plan, executedSteps, isLastStep }) => {
        logger.info('Executing documentation step', { 
          stepNumber: step.number,
          description: step.description.substring(0, 100) + (step.description.length > 100 ? '...' : '')
        });
        
        // For file analysis steps, provide file content
        if (step.description.toLowerCase().includes('analyze') || 
            step.description.toLowerCase().includes('read file') ||
            step.description.toLowerCase().includes('parse code')) {
          
          // Get file content
          let fileContent;
          if (isDirectory) {
            // If directory, get all file contents
            const files = readDirectory(normalizedOptions.path);
            fileContent = files;
          } else {
            // If file, get content
            fileContent = fs.readFileSync(normalizedOptions.path, 'utf8');
          }
          
          return {
            type: 'code_analysis',
            data: { fileContent },
            summary: `Code analyzed from ${isDirectory ? 'directory' : 'file'}: ${normalizedOptions.path}`
          };
        }
        
        // For documentation generation steps
        if (step.description.toLowerCase().includes('generate documentation') ||
            step.description.toLowerCase().includes('create documentation') ||
            step.description.toLowerCase().includes('write documentation')) {
          
          // Get the content from previous steps
          const analysisSteps = executedSteps.filter(s => 
            s.result && s.result.type === 'code_analysis');
          
          if (analysisSteps.length === 0) {
            return {
              type: 'error',
              data: { error: 'No code analysis found in previous steps' },
              summary: 'Failed to find code analysis results'
            };
          }
          
          // Create documentation output directory if it doesn't exist
          const outputDir = path.dirname(normalizedOptions.output);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          // Write documentation to file
          const documentationContent = await generateDocumentationContent(
            analysisSteps, 
            normalizedOptions
          );
          
          fs.writeFileSync(normalizedOptions.output, documentationContent);
          
          return {
            type: 'documentation',
            data: { 
              path: normalizedOptions.output,
              content: documentationContent.substring(0, 500) + 
                (documentationContent.length > 500 ? '...' : '')
            },
            summary: `Documentation generated and saved to ${normalizedOptions.output}`
          };
        }
        
        // For UI component generation steps
        if (step.actionType === 'ui') {
          return {
            type: 'ui',
            data: {
              name: 'DocumentationUI',
              code: '// UI component would be generated here in a real environment'
            },
            summary: 'Documentation UI component generated'
          };
        }
        
        // For other steps, continue with default handling
        return undefined;
      }
    );
    
    // Return the result
    return {
      success: true,
      output: normalizedOptions.output,
      summary: result.summary,
      executedSteps: result.executedSteps.map(step => ({
        number: step.number,
        description: step.description,
        status: step.status,
        result: step.result ? step.result.summary : null
      }))
    };
  } catch (err) {
    logger.error('Error generating documentation', { error: err.message });
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Read a directory recursively
 * @param {string} dir - Directory path
 * @returns {Array<Object>} Files with content
 */
function readDirectory(dir) {
  const results = [];
  
  function processDir(currentPath, relativePath = '') {
    const entries = fs.readdirSync(currentPath);
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry);
      const entryRelativePath = path.join(relativePath, entry);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        // Skip node_modules, .git, etc.
        if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'build') {
          continue;
        }
        
        processDir(fullPath, entryRelativePath);
      } else {
        // Only include code files
        const ext = path.extname(entry).toLowerCase();
        if (['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.cs'].includes(ext)) {
          results.push({
            path: fullPath,
            relativePath: entryRelativePath,
            content: fs.readFileSync(fullPath, 'utf8'),
            extension: ext
          });
        }
      }
    }
  }
  
  processDir(dir);
  return results;
}

/**
 * Generate documentation content based on code analysis
 * @param {Array} analysisSteps - Code analysis steps
 * @param {Object} options - Documentation options
 * @returns {Promise<string>} Documentation content
 */
async function generateDocumentationContent(analysisSteps, options) {
  // This would normally involve complex parsing and documentation generation
  // Here we're providing a simplified implementation
  
  let content = '';
  
  // Add header based on format
  if (options.format === 'markdown' || options.format === 'md') {
    const title = path.basename(options.path).replace(/\.[^/.]+$/, '');
    
    content += `# ${title} Documentation\n\n`;
    content += `Generated on: ${new Date().toISOString().split('T')[0]}\n\n`;
    content += `## Table of Contents\n\n`;
    content += `- [Overview](#overview)\n`;
    content += `- [Files](#files)\n`;
    content += `- [Classes](#classes)\n`;
    content += `- [Functions](#functions)\n`;
    content += `- [Interfaces & Types](#interfaces--types)\n\n`;
    
    content += `## Overview\n\n`;
    content += `This documentation was automatically generated for \`${options.path}\` using the Sequential Documentation Generator.\n\n`;
    
    content += `## Files\n\n`;
    
    // List files if directory
    const files = analysisSteps[0].result.data.fileContent;
    if (Array.isArray(files)) {
      content += `The following files were analyzed:\n\n`;
      
      files.forEach(file => {
        content += `- \`${file.relativePath}\`\n`;
      });
      
      content += `\n`;
    } else {
      content += `Analyzed file: \`${options.path}\`\n\n`;
    }
    
    // Add placeholder sections (would be populated by actual parsing in a real implementation)
    content += `## Classes\n\n`;
    content += `*Classes would be documented here based on code analysis*\n\n`;
    
    content += `## Functions\n\n`;
    content += `*Functions would be documented here based on code analysis*\n\n`;
    
    content += `## Interfaces & Types\n\n`;
    content += `*Interfaces and Types would be documented here based on code analysis*\n\n`;
  } else if (options.format === 'html') {
    const title = path.basename(options.path).replace(/\.[^/.]+$/, '');
    
    content += `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} Documentation</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1, h2, h3 { margin-top: 2em; }
    code { background-color: #f5f5f5; padding: 2px 4px; border-radius: 4px; }
    pre { background-color: #f5f5f5; padding: 15px; border-radius: 8px; overflow-x: auto; }
    .toc { background-color: #f9f9f9; padding: 15px; border-radius: 8px; }
    .file { margin-bottom: 15px; }
  </style>
</head>
<body>
  <h1>${title} Documentation</h1>
  <p>Generated on: ${new Date().toISOString().split('T')[0]}</p>
  
  <div class="toc">
    <h2>Table of Contents</h2>
    <ul>
      <li><a href="#overview">Overview</a></li>
      <li><a href="#files">Files</a></li>
      <li><a href="#classes">Classes</a></li>
      <li><a href="#functions">Functions</a></li>
      <li><a href="#interfaces">Interfaces & Types</a></li>
    </ul>
  </div>
  
  <h2 id="overview">Overview</h2>
  <p>This documentation was automatically generated for <code>${options.path}</code> using the Sequential Documentation Generator.</p>
  
  <h2 id="files">Files</h2>
`;
    
    // List files if directory
    const files = analysisSteps[0].result.data.fileContent;
    if (Array.isArray(files)) {
      content += `  <p>The following files were analyzed:</p>\n  <ul>\n`;
      
      files.forEach(file => {
        content += `    <li class="file"><code>${file.relativePath}</code></li>\n`;
      });
      
      content += `  </ul>\n`;
    } else {
      content += `  <p>Analyzed file: <code>${options.path}</code></p>\n`;
    }
    
    // Add placeholder sections (would be populated by actual parsing in a real implementation)
    content += `  <h2 id="classes">Classes</h2>
  <p><em>Classes would be documented here based on code analysis</em></p>
  
  <h2 id="functions">Functions</h2>
  <p><em>Functions would be documented here based on code analysis</em></p>
  
  <h2 id="interfaces">Interfaces & Types</h2>
  <p><em>Interfaces and Types would be documented here based on code analysis</em></p>
</body>
</html>`;
  } else if (options.format === 'json') {
    // Create JSON structure
    const files = analysisSteps[0].result.data.fileContent;
    
    const jsonDoc = {
      title: path.basename(options.path).replace(/\.[^/.]+$/, ''),
      generated: new Date().toISOString(),
      path: options.path,
      includePrivate: options.includePrivate,
      files: Array.isArray(files) 
        ? files.map(f => ({ path: f.relativePath })) 
        : [{ path: options.path }],
      classes: [],
      functions: [],
      interfaces: []
    };
    
    content = JSON.stringify(jsonDoc, null, 2);
  }
  
  return content;
}

/**
 * Command-line interface for documentation generation
 * @param {Array} args - Command line arguments
 */
async function cli(args) {
  const options = {
    path: args[0],
    format: args.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'markdown',
    output: args.find(arg => arg.startsWith('--output='))?.split('=')[1],
    includePrivate: args.includes('--includePrivate')
  };
  
  if (!options.path) {
    console.error('Error: Path is required');
    console.log('Usage: node sequential_doc_generator.js <path> [--format=<format>] [--output=<output>] [--includePrivate]');
    return;
  }
  
  console.log(`Generating documentation for ${options.path}...`);
  
  const result = await generateDocumentation(options);
  
  if (result.success) {
    console.log(`Documentation generated successfully!`);
    console.log(`Output: ${result.output}`);
  } else {
    console.error(`Error generating documentation: ${result.error}`);
  }
}

// Run CLI if called directly
if (require.main === module) {
  cli(process.argv.slice(2));
}

module.exports = {
  generateDocumentation
};