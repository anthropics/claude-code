#!/bin/bash

# Script to convert JavaScript files to TypeScript and update import paths
# This script demonstrates the process for a single file as an example

set -e

SOURCE_ROOT="/home/jan/Schreibtisch/TEST/claude-code"
TARGET_ROOT="/home/jan/Schreibtisch/TEST/claude-code/claude-framework"

# Function to convert a JavaScript file to TypeScript
convert_file() {
  local source_file="$1"
  local target_file="$2"
  
  echo "Converting $source_file to TypeScript..."
  
  # Create target directory if it doesn't exist
  mkdir -p "$(dirname "$target_file")"
  
  # Read the source file
  local content=$(cat "$source_file")
  
  # Replace require statements with imports
  content=$(echo "$content" | sed -E 's/const ([a-zA-Z0-9_]+) = require\(['"'"'"](.*)['"'"'"]\);/import \1 from "\2";/g')
  content=$(echo "$content" | sed -E 's/const \{ ([a-zA-Z0-9_]+) \} = require\(['"'"'"](.*)['"'"'"]\);/import { \1 } from "\2";/g')
  content=$(echo "$content" | sed -E 's/const \{ ([a-zA-Z0-9_]+), ([a-zA-Z0-9_]+) \} = require\(['"'"'"](.*)['"'"'"]\);/import { \1, \2 } from "\3";/g')
  
  # Replace module.exports with export default
  content=$(echo "$content" | sed -E 's/module\.exports = ([a-zA-Z0-9_]+);/export default \1;/g')
  
  # Replace module.exports = { ... } with export { ... }
  content=$(echo "$content" | sed -E 's/module\.exports = \{/export {/g')
  
  # Update path aliases for the framework
  content=$(echo "$content" | sed -E 's/from "(\.\.\/)+claude-framework\//from "@claude-framework\//g')
  
  # Write the converted file
  echo "$content" > "$target_file"
  
  echo "Conversion complete: $target_file"
}

# Example conversion for a sequential-planner.js file
# This is a demonstration of how to convert a single file
# A complete solution would need to iterate over many files

# Convert the sequential planner fallback
echo "Converting Sequential Planner Fallback..."

SOURCE_FILE="$SOURCE_ROOT/src/core/mcp/fallbacks/sequential-planner.js"
TARGET_FILE="$TARGET_ROOT/libs/workflows/src/sequential/services/sequential-planner-fallback.ts"

if [ -f "$SOURCE_FILE" ]; then
  # Manually convert with type information added
  cat > "$TARGET_FILE" << 'EOF'
import { Logger } from '@claude-framework/core/logging';
import { Step, PlanStep } from '../types';

/**
 * Sequential Planner Fallback
 * 
 * This module provides fallback implementations for the Sequential Planner
 * when the MCP service is unavailable.
 */

interface ComponentSpec {
  type?: string;
  description?: string;
}

interface ExecutionContext {
  type: string;
  data: any;
  summary: string;
}

const logger = new Logger('sequential-planner-fallback');

/**
 * Generate a sequential plan based on a goal
 * @param goal The goal to plan for
 * @param options Planning options
 * @returns Array of plan steps
 */
async function generatePlan(goal: string, options: Record<string, any> = {}): Promise<PlanStep[]> {
  try {
    logger.debug('Using fallback to generate plan', { goalPrefix: goal.substring(0, 50) });
    
    // Simple fallback implementation that creates a basic plan
    const planSteps: PlanStep[] = [
      {
        id: 'step-1',
        number: 1,
        description: `Research information related to: ${goal}`,
        actionType: 'context',
        status: 'pending',
        result: null,
        isRevised: false
      },
      {
        id: 'step-2',
        number: 2,
        description: 'Analyze the gathered information',
        actionType: 'manual',
        status: 'pending',
        result: null,
        isRevised: false
      },
      {
        id: 'step-3',
        number: 3,
        description: 'Design a user interface component',
        actionType: 'ui',
        status: 'pending',
        result: null,
        isRevised: false
      },
      {
        id: 'step-4',
        number: 4,
        description: 'Implement the solution',
        actionType: 'manual',
        status: 'pending',
        result: null,
        isRevised: false
      },
      {
        id: 'step-5',
        number: 5,
        description: 'Test and verify the implementation',
        actionType: 'manual',
        status: 'pending',
        result: null,
        isRevised: false
      }
    ];
    
    return planSteps;
  } catch (err) {
    logger.error('Error in fallback generate plan', { 
      error: err instanceof Error ? err.message : String(err) 
    });
    throw err;
  }
}

/**
 * Continue planning by adding more steps
 * @param thoughts Existing thoughts or plan steps
 * @returns Additional plan steps
 */
async function continuePlanning(thoughts: Step[]): Promise<PlanStep[]> {
  try {
    logger.debug('Using fallback to continue plan', { thoughtCount: thoughts.length });
    
    // Simple fallback implementation that adds standard steps
    const lastNumber = thoughts.reduce((max, thought) => 
      thought.number > max ? thought.number : max, 0);
    
    const newSteps: PlanStep[] = [
      {
        id: `step-${lastNumber + 1}`,
        number: lastNumber + 1,
        description: 'Review progress and adjust approach if needed',
        actionType: 'manual',
        status: 'pending',
        result: null,
        isRevised: false
      },
      {
        id: `step-${lastNumber + 2}`,
        number: lastNumber + 2,
        description: 'Document the implementation',
        actionType: 'manual',
        status: 'pending',
        result: null,
        isRevised: false
      }
    ];
    
    return newSteps;
  } catch (err) {
    logger.error('Error in fallback continue planning', { 
      error: err instanceof Error ? err.message : String(err) 
    });
    throw err;
  }
}

/**
 * Execute a context step
 * @param searchTerm Term to search for
 * @returns Execution context with results
 */
async function executeContextStep(searchTerm: string): Promise<ExecutionContext> {
  try {
    logger.debug('Using fallback to execute context step', { 
      searchTermPrefix: searchTerm.substring(0, 50) 
    });
    
    // Simple fallback implementation that returns mock results
    return {
      type: 'context',
      data: [
        {
          title: 'Fallback Document 1',
          summary: `This is a fallback document related to "${searchTerm}". Note that this is a mock result because the Context7 MCP service is not available.`
        },
        {
          title: 'Fallback Document 2',
          summary: 'This is another fallback document. In a real environment, this would be retrieved from the Context7 MCP service.'
        }
      ],
      summary: 'Found 2 relevant documents (fallback mode)'
    };
  } catch (err) {
    logger.error('Error in fallback execute context step', { 
      error: err instanceof Error ? err.message : String(err) 
    });
    throw err;
  }
}

/**
 * Execute a UI step
 * @param componentSpec Component specification
 * @returns Execution context with component
 */
async function executeUIStep(componentSpec: ComponentSpec): Promise<ExecutionContext> {
  try {
    logger.debug('Using fallback to execute UI step', { 
      componentDescription: componentSpec.description?.substring(0, 50) 
    });
    
    // Simple fallback implementation that returns a mock component
    const componentName = componentSpec.type === 'form' 
      ? 'FallbackForm' 
      : 'FallbackComponent';
    
    return {
      type: 'ui',
      data: {
        name: componentName,
        code: `import React from 'react';

/**
 * ${componentName}
 * 
 * FALLBACK IMPLEMENTATION - This is a mock component because the 21st-dev-magic MCP service is not available.
 * Description: ${componentSpec.description || 'No description provided'}
 */
function ${componentName}(props: Record<string, any>) {
  return (
    <div className="${componentName.toLowerCase()}">
      <h2>${componentName}</h2>
      <p>This is a fallback component. In a real environment, this would be generated by the 21st-dev-magic MCP service.</p>
    </div>
  );
}

export default ${componentName};`
      },
      summary: `Generated UI component: ${componentName} (fallback mode)`
    };
  } catch (err) {
    logger.error('Error in fallback execute UI step', { 
      error: err instanceof Error ? err.message : String(err) 
    });
    throw err;
  }
}

/**
 * Generate a summary of the executed plan
 * @param executedSteps Executed plan steps
 * @returns Summary text
 */
async function generateSummary(executedSteps: PlanStep[]): Promise<string> {
  try {
    logger.debug('Using fallback to generate summary', { stepCount: executedSteps.length });
    
    // Simple fallback implementation that creates a basic summary
    return `Summary of Plan Execution (Fallback Mode):

This is a fallback summary generated because the sequential thinking MCP service is not available.

The plan consisted of ${executedSteps.length} steps, of which ${executedSteps.filter(s => s.status === 'completed').length} were completed and ${executedSteps.filter(s => s.status === 'skipped').length} were skipped.

Key achievements:
${executedSteps
  .filter(s => s.status === 'completed')
  .map(s => `- ${s.description.substring(0, 100)}${s.description.length > 100 ? '...' : ''}`)
  .join('\n')}

Note: This is a simplified summary. In a real environment, it would be generated by the sequential thinking MCP service.`;
  } catch (err) {
    logger.error('Error in fallback generate summary', { 
      error: err instanceof Error ? err.message : String(err) 
    });
    throw err;
  }
}

/**
 * Sequential planner fallback exports
 */
export const sequentialPlannerFallback = {
  generatePlan,
  continuePlanning,
  executeContextStep,
  executeUIStep,
  generateSummary
};

// Default export for backward compatibility
export default sequentialPlannerFallback;
EOF

  echo "Manual conversion of Sequential Planner Fallback completed."
else
  echo "Source file not found: $SOURCE_FILE"
fi

# Create a proxy module in the original location
PROXY_FILE="$SOURCE_ROOT/src/core/mcp/fallbacks/sequential-planner.js.new"

cat > "$PROXY_FILE" << 'EOF'
/**
 * Sequential Planner Fallback - Proxy Module
 * 
 * This module re-exports the Sequential Planner Fallback from the claude-framework
 * to ensure backward compatibility while avoiding code duplication.
 * 
 * IMPORTANT: This file is maintained for backward compatibility.
 * New code should import directly from the claude-framework.
 */

const logger = require('../../logging/logger').createLogger('sequential-planner-fallback');

// Import the typescript version from the framework
let frameworkPlanner;

try {
  // Try to import from the framework
  const { sequentialPlannerFallback } = require('../../../../claude-framework/libs/workflows/src/sequential/services/sequential-planner-fallback');
  frameworkPlanner = sequentialPlannerFallback;
  
  if (!frameworkPlanner) {
    throw new Error('Could not find SequentialPlannerFallback in framework');
  }
  
  logger.info('Using framework implementation of Sequential Planner Fallback');
} catch (err) {
  logger.warn('Could not import SequentialPlannerFallback from framework, using original implementation', err);
  
  // Import the original backup implementation which we'll preserve here
  // so that the code continues to work even if the framework import fails
  const originalImplementation = require('./sequential-planner.js.original');
  frameworkPlanner = originalImplementation;
}

// Log a deprecation warning
if (process.env.NODE_ENV !== 'production') {
  console.warn(
    'WARNING: Importing from src/core/mcp/fallbacks/sequential-planner.js is deprecated. ' +
    'Please update your imports to use: @claude-framework/workflows/sequential/services/sequential-planner-fallback'
  );
}

// Re-export the framework implementation or fallback
module.exports = frameworkPlanner;
EOF

echo "Created proxy module for Sequential Planner Fallback."

# Explain next steps
echo "
This script demonstrates the process for converting JavaScript to TypeScript for a single file.
To fully convert the codebase, you would need to:

1. Iterate through all JavaScript files in the source directories
2. Convert each file to TypeScript with proper typing
3. Update import paths to use the new module structure
4. Create proxy modules for backward compatibility
5. Test each component to ensure functionality is preserved

Key aspects of the conversion:
- Add TypeScript interfaces and types
- Convert require() to import statements
- Convert module.exports to export/export default
- Update relative imports to use module aliases (@claude-framework/...)
- Handle error types properly (instanceof Error checks)
- Preserve functionality while improving type safety

For a complete conversion, you would expand this script to handle all files
or use a tool like jscodeshift for more complex transformations.
"