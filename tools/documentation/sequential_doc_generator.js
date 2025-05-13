/**
 * Sequential Documentation Generator - Proxy Module
 * 
 * This module re-exports the Sequential Documentation Generator from the claude-framework
 * to ensure backward compatibility while avoiding code duplication.
 * 
 * IMPORTANT: This file is maintained for backward compatibility.
 * New code should import directly from the claude-framework:
 * import { sequentialDocGenerator } from 'claude-framework/libs/workflows/src/sequential';
 */

const path = require('path');
const fs = require('fs');
const logger = require('../../core/logging/logger').createLogger('doc-generator-proxy');

// Import the typescript version of SequentialDocGenerator from the framework
let frameworkDocGenerator;

try {
  // Try to import from the framework
  const { sequentialDocGenerator } = require('../../claude-framework/libs/workflows/src/sequential/documentation/sequential-doc-generator');
  frameworkDocGenerator = sequentialDocGenerator;
  
  if (!frameworkDocGenerator) {
    throw new Error('Could not find SequentialDocGenerator in framework');
  }
  
  logger.info('Using framework implementation of Sequential Documentation Generator');
} catch (err) {
  logger.warn('Could not import SequentialDocGenerator from framework, using original implementation', err);
  
  // Fallback to the original implementation
  const SequentialExecutionManager = require('../mcp/integration/sequential_execution_manager');

  /**
   * Generate documentation for a code file
   * @param {Object} options - Options for documentation generation
   * @param {string} options.path - Path to the code file
   * @param {string} options.format - Output format (markdown, html, json)
   * @param {string} options.output - Output file path
   * @param {boolean} options.includeExamples - Whether to include examples
   * @param {boolean} options.fallbackMode - Use fallback mode (no MCP)
   * @returns {Promise<Object>} The result
   */
  async function generateDocumentation(options) {
    logger.info('Generating documentation', { 
      path: options.path,
      format: options.format || 'markdown'
    });
    
    // Set defaults
    const docOptions = {
      path: options.path,
      format: options.format || 'markdown',
      output: options.output || getDefaultOutputPath(options.path, options.format),
      includeExamples: options.includeExamples !== false,
      fallbackMode: options.fallbackMode || false
    };
    
    // Create an execution manager for documentation
    const manager = SequentialExecutionManager.forDomain('documentation', {
      fallbackMode: docOptions.fallbackMode,
      maxSteps: 15,
      planningDepth: 'deep'
    });
    
    // Create the goal
    const goal = `Generate comprehensive documentation for ${docOptions.path} in ${docOptions.format} format. ${
      docOptions.includeExamples ? 'Include examples.' : 'Do not include examples.'
    }`;
    
    try {
      // Generate plan
      await manager.generatePlan(goal);
      
      // Read the file content
      const fileContent = fs.readFileSync(docOptions.path, 'utf8');
      
      // Execute the plan with custom handling
      const result = await manager.runEntirePlan(async ({ step }) => {
        // Custom handling for specific action types
        if (step.actionType === 'code_analysis') {
          // Provide the file content for analysis
          return {
            type: 'code_analysis',
            data: {
              content: fileContent,
              path: docOptions.path
            },
            summary: `Analyzed code from ${docOptions.path}`
          };
        }
        
        if (step.actionType === 'documentation') {
          // Save documentation to output file
          const outputContent = step.result?.data?.content || 
            `# Documentation for ${path.basename(docOptions.path)}\n\nThis is generated documentation.`;
          
          // Create directories if they don't exist
          const outputDir = path.dirname(docOptions.output);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          // Write to file
          fs.writeFileSync(docOptions.output, outputContent);
          
          return {
            type: 'documentation',
            data: {
              content: outputContent,
              path: docOptions.output
            },
            summary: `Documentation generated and saved to ${docOptions.output}`
          };
        }
        
        // Let the manager handle other steps
        return undefined;
      });
      
      logger.info('Documentation generation completed', {
        outputPath: docOptions.output,
        executedStepCount: result.executedSteps.length
      });
      
      return {
        success: true,
        output: docOptions.output,
        summary: result.summary,
        executedSteps: result.executedSteps
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
   * Get the default output path for a file
   * @param {string} filePath - The input file path
   * @param {string} format - The output format
   * @returns {string} The default output path
   */
  function getDefaultOutputPath(filePath, format = 'markdown') {
    // Extract file name and extension
    const parsedPath = path.parse(filePath);
    const extension = format === 'markdown' || format === 'md' 
      ? '.md' 
      : format === 'html' 
        ? '.html' 
        : '.json';
    
    // Create output path in docs/api directory
    return path.join(
      'docs', 
      'api', 
      parsedPath.dir.replace(/^src|^lib/, ''), 
      `${parsedPath.name}${extension}`
    );
  }

  /**
   * Run the documentation generator from the command line
   */
  async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = {
      path: null,
      format: 'markdown',
      output: null,
      includeExamples: true,
      fallbackMode: false
    };
    
    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--path' || arg === '-p') {
        options.path = args[++i];
      } else if (arg === '--format' || arg === '-f') {
        options.format = args[++i];
      } else if (arg === '--output' || arg === '-o') {
        options.output = args[++i];
      } else if (arg === '--no-examples') {
        options.includeExamples = false;
      } else if (arg === '--fallback') {
        options.fallbackMode = true;
      } else if (!options.path) {
        options.path = arg;
      }
    }
    
    // Check for required parameters
    if (!options.path) {
      console.error('Error: No input file specified');
      console.log('Usage: node sequential_doc_generator.js [options] <file-path>');
      console.log('Options:');
      console.log('  --path, -p <path>      Path to the input file');
      console.log('  --format, -f <format>  Output format (markdown, html, json)');
      console.log('  --output, -o <path>    Output file path');
      console.log('  --no-examples          Do not include examples');
      console.log('  --fallback             Use fallback mode (no MCP dependency)');
      process.exit(1);
    }
    
    try {
      // Generate documentation
      const result = await generateDocumentation(options);
      
      if (result.success) {
        console.log(`Documentation generated successfully and saved to ${result.output}`);
      } else {
        console.error(`Error: ${result.error}`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`Fatal error: ${err.message}`);
      process.exit(1);
    }
  }

  frameworkDocGenerator = {
    generateDocumentation
  };
}

// Log a deprecation warning
if (process.env.NODE_ENV !== 'production') {
  console.warn(
    'WARNING: Importing from tools/documentation/sequential_doc_generator.js is deprecated. ' +
    'Please update your imports to use: claude-framework/libs/workflows/src/sequential/documentation/sequential-doc-generator'
  );
}

// Run as CLI if invoked directly
if (require.main === module) {
  main();
}

// Re-export the framework implementation or fallback
module.exports = {
  generateDocumentation: frameworkDocGenerator.generateDocumentation
};