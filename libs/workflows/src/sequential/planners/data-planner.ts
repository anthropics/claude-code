import { Plan, PlanStep } from "./types";
import { BasePlanner } from './base-planner';
import { ConfigManager } from '@claude-framework/core/config';
import { Logger } from '@claude-framework/core/logging';

/**
 * Data-specific planning implementation.
 * Specialized in planning data processing, analysis and transformation tasks.
 */
export class DataPlanner extends BasePlanner {
  private logger: Logger;
  
  constructor() {
    super('data');
    this.logger = new Logger('DataPlanner');
  }

  /**
   * Creates a data processing plan based on input parameters
   * 
   * @param params Planning parameters specific to data processing
   * @returns A complete data processing plan
   */
  async createPlan(params: Record<string, any>): Promise<Plan> {
    this.logger.debug('Creating data processing plan', { params });
    
    const config = ConfigManager.getInstance().getConfig();
    const dataConfig = config.data || {};
    
    // Determine data workflow type
    const workflowType = params.workflowType || dataConfig.defaultWorkflowType || 'processing';
    
    // Default plan steps for data processing
    const steps: PlanStep[] = [
      {
        id: 'collect',
        name: 'Collect data',
        description: 'Gather data from specified sources',
        status: 'pending',
        data: { 
          sources: params.sources || dataConfig.defaultSources || ['local'],
          formats: params.formats || dataConfig.formats || ['json', 'csv']
        }
      },
      {
        id: 'validate',
        name: 'Validate data',
        description: 'Ensure data quality and integrity',
        status: 'pending',
        dependsOn: ['collect'],
        data: {
          validateSchema: params.validateSchema !== false,
          checkCompleteness: params.checkCompleteness !== false,
          checkConsistency: params.checkConsistency !== false
        }
      },
      {
        id: 'transform',
        name: 'Transform data',
        description: 'Process and transform the data',
        status: 'pending',
        dependsOn: ['validate'],
        data: {
          transformations: params.transformations || dataConfig.defaultTransformations || ['normalize', 'filter'],
          inPlace: params.inPlace || false
        }
      }
    ];

    // Add analysis steps for analysis workflows
    if (workflowType === 'analysis' || workflowType === 'complete') {
      steps.push({
        id: 'analyze',
        name: 'Analyze data',
        description: 'Perform data analysis',
        status: 'pending',
        dependsOn: ['transform'],
        data: {
          analysisTypes: params.analysisTypes || dataConfig.analysisTypes || ['statistical', 'exploratory'],
          generateReports: params.generateReports !== false
        }
      });
      
      steps.push({
        id: 'visualize',
        name: 'Visualize results',
        description: 'Create visualizations of analysis results',
        status: 'pending',
        dependsOn: ['analyze'],
        data: {
          visualizationTypes: params.visualizationTypes || dataConfig.visualizationTypes || ['charts', 'graphs'],
          interactive: params.interactive !== false
        }
      });
    }

    // Add storage step if specified
    steps.push({
      id: 'store',
      name: 'Store processed data',
      description: 'Save the processed data to the target location',
      status: 'pending',
      dependsOn: workflowType === 'analysis' ? ['visualize'] : ['transform'],
      data: {
        destination: params.destination || dataConfig.defaultDestination || './data/processed',
        format: params.outputFormat || dataConfig.outputFormat || 'json',
        compression: params.compression || dataConfig.compression || 'none'
      }
    });

    return {
      id: `data-plan-${Date.now()}`,
      name: params.name || `Data ${workflowType} Plan`,
      description: params.description || `Plan for ${workflowType} data workflow`,
      domain: this.domain,
      steps,
      createdAt: new Date(),
      status: 'created'
    };
  }
}