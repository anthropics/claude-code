import { Plan, PlanStep } from "./types";
import { BasePlanner } from './base-planner';
import { ConfigManager } from '@claude-framework/core/config';
import { Logger } from '@claude-framework/core/logging';

/**
 * CI/CD-specific planning implementation.
 * Specialized in planning continuous integration and deployment tasks.
 */
export class CICDPlanner extends BasePlanner {
  private logger: Logger;
  
  constructor() {
    super('cicd');
    this.logger = new Logger('CICDPlanner');
  }

  /**
   * Creates a CI/CD workflow plan based on input parameters
   * 
   * @param params Planning parameters specific to CI/CD workflows
   * @returns A complete CI/CD workflow plan
   */
  async createPlan(params: Record<string, any>): Promise<Plan> {
    this.logger.debug('Creating CI/CD plan', { params });
    
    const config = ConfigManager.getInstance().getConfig();
    const cicdConfig = config.cicd || {};
    
    // Determine pipeline type
    const pipelineType = params.pipelineType || cicdConfig.defaultPipelineType || 'standard';
    
    // Default plan steps for CI/CD
    const steps: PlanStep[] = [
      {
        id: 'lint',
        name: 'Lint code',
        description: 'Run code linting to ensure code quality',
        status: 'pending',
        data: { 
          linters: params.linters || cicdConfig.linters || ['eslint'],
          fix: params.autoFix || cicdConfig.autoFix || false
        }
      },
      {
        id: 'test',
        name: 'Run tests',
        description: 'Execute test suite',
        status: 'pending',
        dependsOn: ['lint'],
        data: {
          testTypes: params.testTypes || cicdConfig.testTypes || ['unit', 'integration'],
          coverage: params.coverage !== false,
          coverageThreshold: params.coverageThreshold || cicdConfig.coverageThreshold || 80
        }
      },
      {
        id: 'build',
        name: 'Build project',
        description: 'Compile and build the project',
        status: 'pending',
        dependsOn: ['test'],
        data: {
          production: params.production !== false,
          optimize: params.optimize !== false
        }
      }
    ];

    // Add deployment steps based on pipeline type
    if (pipelineType === 'deployment' || pipelineType === 'complete') {
      steps.push({
        id: 'deploy',
        name: 'Deploy project',
        description: 'Deploy the built project to target environment',
        status: 'pending',
        dependsOn: ['build'],
        data: {
          environment: params.environment || cicdConfig.defaultEnvironment || 'staging',
          strategy: params.deployStrategy || cicdConfig.deployStrategy || 'standard'
        }
      });
      
      steps.push({
        id: 'verify',
        name: 'Verify deployment',
        description: 'Verify the deployment was successful',
        status: 'pending',
        dependsOn: ['deploy'],
        data: {
          healthChecks: params.healthChecks !== false,
          smokeTests: params.smokeTests !== false
        }
      });
    }

    // Add notification step if specified
    if (params.notifications || cicdConfig.notifications) {
      steps.push({
        id: 'notify',
        name: 'Send notifications',
        description: 'Notify team members about pipeline results',
        status: 'pending',
        dependsOn: pipelineType === 'deployment' ? ['verify'] : ['build'],
        data: {
          channels: params.notificationChannels || cicdConfig.notificationChannels || ['email'],
          onlyOnFailure: params.notifyOnlyOnFailure || cicdConfig.notifyOnlyOnFailure || false
        }
      });
    }

    return {
      id: `cicd-plan-${Date.now()}`,
      name: params.name || `CI/CD ${pipelineType} Pipeline`,
      description: params.description || `Plan for ${pipelineType} CI/CD workflow`,
      domain: this.domain,
      steps,
      createdAt: new Date(),
      status: 'created'
    };
  }
}