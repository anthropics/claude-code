import { PlanStep, ExecutionResult } from "./types";
import { BaseExecutor } from './base-executor';
import { ConfigManager } from '@claude-framework/core/config';
import { ExecutionError } from '@claude-framework/core/error';

/**
 * CI/CD-specific execution implementation.
 * Handles the execution of continuous integration and deployment steps.
 */
export class CICDExecutor extends BaseExecutor {
  constructor() {
    super('cicd');
  }

  /**
   * Executes a CI/CD workflow step
   * 
   * @param step The plan step to execute
   * @param context Execution context with data from previous steps
   * @returns Result of the execution
   */
  async executeStep(step: PlanStep, context: Record<string, any>): Promise<ExecutionResult> {
    this.logger.debug(`Executing CI/CD step: ${step.id}`, { step });
    
    try {
      const config = ConfigManager.getInstance().getConfig();
      
      switch(step.id) {
        case 'lint':
          return await this.lintCode(step, context);
        case 'test':
          return await this.runTests(step, context);
        case 'build':
          return await this.buildProject(step, context);
        case 'deploy':
          return await this.deployProject(step, context);
        case 'verify':
          return await this.verifyDeployment(step, context);
        case 'notify':
          return await this.sendNotifications(step, context);
        default:
          throw new ExecutionError(`Unknown CI/CD step: ${step.id}`);
      }
    } catch (error) {
      this.logger.error(`Error executing CI/CD step ${step.id}`, { error });
      return {
        success: false,
        stepId: step.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: { error }
      };
    }
  }

  /**
   * Lints code to ensure code quality
   */
  private async lintCode(step: PlanStep, context: Record<string, any>): Promise<ExecutionResult> {
    this.logger.info('Linting code', { linters: step.data.linters });
    
    // Mock implementation
    const lintResults = {
      totalFiles: 120,
      filesWithIssues: 5,
      issuesBySeverity: {
        error: 2,
        warning: 8,
        info: 15
      },
      issuesFixed: step.data.fix ? 10 : 0
    };
    
    const success = lintResults.issuesBySeverity.error === 0 || step.data.fix;
    
    return {
      success,
      stepId: step.id,
      message: success 
        ? `Linted ${lintResults.totalFiles} files with ${lintResults.issuesFixed} issues fixed`
        : `Linting found ${lintResults.issuesBySeverity.error} errors that need to be fixed`,
      data: { lintResults }
    };
  }

  /**
   * Runs test suite
   */
  private async runTests(step: PlanStep, context: Record<string, any>): Promise<ExecutionResult> {
    this.logger.info('Running tests', { testTypes: step.data.testTypes });
    
    // Mock implementation
    const testResults = {
      testTypes: step.data.testTypes,
      totalTests: 250,
      passed: 245,
      failed: 5,
      skipped: 3,
      coverage: step.data.coverage ? {
        statements: 87.5,
        branches: 82.3,
        functions: 91.2,
        lines: 88.6,
        passesThreshold: true
      } : null
    };
    
    const success = testResults.failed === 0 || 
                   (testResults.coverage?.passesThreshold && testResults.failed < 10);
    
    return {
      success,
      stepId: step.id,
      message: success 
        ? `${testResults.passed}/${testResults.totalTests} tests passed with ${testResults.coverage?.lines}% line coverage`
        : `${testResults.failed} tests failed, coverage: ${testResults.coverage?.lines}%`,
      data: { testResults }
    };
  }

  /**
   * Builds the project
   */
  private async buildProject(step: PlanStep, context: Record<string, any>): Promise<ExecutionResult> {
    this.logger.info('Building project', { production: step.data.production });
    
    // Mock implementation
    const buildResults = {
      success: true,
      duration: Math.floor(Math.random() * 100) + 50, // Random build time in seconds
      artifacts: [
        { name: 'main.js', size: 1240000 },
        { name: 'styles.css', size: 356000 },
        { name: 'vendor.js', size: 2450000 }
      ],
      totalSize: 4046000,
      optimizationLevel: step.data.optimize ? 'high' : 'none'
    };
    
    return {
      success: buildResults.success,
      stepId: step.id,
      message: `Build completed in ${buildResults.duration}s with ${buildResults.artifacts.length} artifacts (${Math.round(buildResults.totalSize/1024/1024 * 100) / 100}MB)`,
      data: { buildResults }
    };
  }

  /**
   * Deploys the project to target environment
   */
  private async deployProject(step: PlanStep, context: Record<string, any>): Promise<ExecutionResult> {
    this.logger.info('Deploying project', { 
      environment: step.data.environment,
      strategy: step.data.strategy 
    });
    
    // Check if previous build was successful
    const buildSuccess = context.build?.success !== false;
    if (!buildSuccess) {
      throw new ExecutionError('Cannot deploy: previous build step failed');
    }
    
    // Mock implementation
    const deployResults = {
      success: true,
      environment: step.data.environment,
      timestamp: new Date().toISOString(),
      deploymentId: `deploy-${Date.now()}`,
      duration: Math.floor(Math.random() * 60) + 20, // Random deployment time in seconds
      url: `https://${step.data.environment}.example.com`
    };
    
    return {
      success: deployResults.success,
      stepId: step.id,
      message: `Deployed to ${deployResults.environment} in ${deployResults.duration}s (${deployResults.url})`,
      data: { deployResults }
    };
  }

  /**
   * Verifies the deployment was successful
   */
  private async verifyDeployment(step: PlanStep, context: Record<string, any>): Promise<ExecutionResult> {
    this.logger.info('Verifying deployment', { 
      healthChecks: step.data.healthChecks,
      smokeTests: step.data.smokeTests 
    });
    
    // Check if previous deploy was successful
    const deploySuccess = context.deploy?.success !== false;
    if (!deploySuccess) {
      throw new ExecutionError('Cannot verify: previous deployment step failed');
    }
    
    const deploymentUrl = context.deploy?.data?.deployResults?.url;
    if (!deploymentUrl) {
      throw new ExecutionError('Cannot verify: deployment URL not found');
    }
    
    // Mock implementation
    const verificationResults = {
      success: true,
      healthChecks: step.data.healthChecks ? {
        endpoints: 5,
        passed: 5,
        responseTime: 320 // ms
      } : null,
      smokeTests: step.data.smokeTests ? {
        tests: 8,
        passed: 8
      } : null
    };
    
    return {
      success: verificationResults.success,
      stepId: step.id,
      message: `Deployment verified successfully: ${
        verificationResults.healthChecks ? `${verificationResults.healthChecks.passed}/${verificationResults.healthChecks.endpoints} health checks passed` : ''
      }${
        verificationResults.smokeTests ? `, ${verificationResults.smokeTests.passed}/${verificationResults.smokeTests.tests} smoke tests passed` : ''
      }`,
      data: { verificationResults }
    };
  }

  /**
   * Sends notifications about pipeline results
   */
  private async sendNotifications(step: PlanStep, context: Record<string, any>): Promise<ExecutionResult> {
    this.logger.info('Sending notifications', { 
      channels: step.data.channels,
      onlyOnFailure: step.data.onlyOnFailure 
    });
    
    // Determine if pipeline was successful overall
    const overallSuccess = !Object.entries(context)
      .filter(([key]) => key !== 'notify') // Exclude the current step
      .some(([_, result]) => result.success === false);
    
    // Skip notifications if configured to only notify on failure and pipeline succeeded
    if (step.data.onlyOnFailure && overallSuccess) {
      return {
        success: true,
        stepId: step.id,
        message: 'Notifications skipped: pipeline succeeded and onlyOnFailure is true',
        data: { notificationsSent: false }
      };
    }
    
    // Mock implementation
    const notificationResults = {
      success: true,
      recipients: 5,
      channels: step.data.channels,
      messageType: overallSuccess ? 'success' : 'failure',
      timestamp: new Date().toISOString()
    };
    
    return {
      success: notificationResults.success,
      stepId: step.id,
      message: `Notifications sent to ${notificationResults.recipients} recipients via ${notificationResults.channels.join(', ')}`,
      data: { notificationResults }
    };
  }
}