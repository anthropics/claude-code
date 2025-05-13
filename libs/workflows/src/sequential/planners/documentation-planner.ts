import { Plan, PlanStep } from "./types";
import { BasePlanner } from './base-planner';
import { ConfigManager } from '@claude-framework/core/config';
import { Logger } from '@claude-framework/core/logging';

/**
 * Documentation-specific planning implementation.
 * Specialized in planning documentation generation tasks.
 */
export class DocumentationPlanner extends BasePlanner {
  private logger: Logger;
  
  constructor() {
    super('documentation');
    this.logger = new Logger('DocumentationPlanner');
  }

  /**
   * Creates a documentation generation plan based on input parameters
   * 
   * @param params Planning parameters specific to documentation
   * @returns A complete documentation generation plan
   */
  async createPlan(params: Record<string, any>): Promise<Plan> {
    this.logger.debug('Creating documentation plan', { params });
    
    const config = ConfigManager.getInstance().getConfig();
    const docConfig = config.documentation || {};
    
    // Default plan steps for documentation
    const steps: PlanStep[] = [
      {
        id: 'analyze',
        name: 'Analyze codebase structure',
        description: 'Scan codebase to identify components requiring documentation',
        status: 'pending',
        data: { 
          patterns: params.patterns || docConfig.defaultPatterns || ['**/*.ts', '**/*.js'],
          excludePatterns: params.excludePatterns || docConfig.excludePatterns || ['**/node_modules/**']
        }
      },
      {
        id: 'extract',
        name: 'Extract documentation from code',
        description: 'Parse JSDoc, TSDoc and other documentation comments',
        status: 'pending',
        dependsOn: ['analyze'],
        data: {
          extractComments: true,
          extractTypes: true,
          extractExamples: params.extractExamples !== false
        }
      },
      {
        id: 'generate',
        name: 'Generate documentation',
        description: 'Create documentation files based on extracted information',
        status: 'pending',
        dependsOn: ['extract'],
        data: {
          format: params.format || docConfig.defaultFormat || 'markdown',
          outputDir: params.outputDir || docConfig.outputDir || './docs',
          templates: params.templates || docConfig.templates
        }
      },
      {
        id: 'validate',
        name: 'Validate documentation',
        description: 'Check for completeness and correctness of generated docs',
        status: 'pending',
        dependsOn: ['generate'],
        data: {
          validateLinks: true,
          validateExamples: params.validateExamples !== false,
          validateCoverage: params.validateCoverage !== false
        }
      }
    ];

    // Add optional API documentation step if specified
    if (params.includeApi || docConfig.includeApi) {
      steps.push({
        id: 'api-docs',
        name: 'Generate API documentation',
        description: 'Create API reference documentation',
        status: 'pending',
        dependsOn: ['extract'],
        data: {
          format: params.apiFormat || docConfig.apiFormat || 'html',
          outputDir: params.apiOutputDir || docConfig.apiOutputDir || './docs/api'
        }
      });
    }

    return {
      id: `doc-plan-${Date.now()}`,
      name: params.name || 'Documentation Generation Plan',
      description: params.description || 'Plan for generating project documentation',
      domain: this.domain,
      steps,
      createdAt: new Date(),
      status: 'created'
    };
  }
}