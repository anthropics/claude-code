import { PlanStep, ExecutionResult } from "./types";
import { BaseExecutor } from './base-executor';
import { ConfigManager } from '@claude-framework/core/config';
import { ExecutionError } from '@claude-framework/core/error';

/**
 * Data-specific execution implementation.
 * Handles the execution of data processing and analysis steps.
 */
export class DataExecutor extends BaseExecutor {
  constructor() {
    super('data');
  }

  /**
   * Executes a data processing step
   * 
   * @param step The plan step to execute
   * @param context Execution context with data from previous steps
   * @returns Result of the execution
   */
  async executeStep(step: PlanStep, context: Record<string, any>): Promise<ExecutionResult> {
    this.logger.debug(`Executing data step: ${step.id}`, { step });
    
    try {
      const config = ConfigManager.getInstance().getConfig();
      
      switch(step.id) {
        case 'collect':
          return await this.collectData(step, context);
        case 'validate':
          return await this.validateData(step, context);
        case 'transform':
          return await this.transformData(step, context);
        case 'analyze':
          return await this.analyzeData(step, context);
        case 'visualize':
          return await this.visualizeResults(step, context);
        case 'store':
          return await this.storeData(step, context);
        default:
          throw new ExecutionError(`Unknown data step: ${step.id}`);
      }
    } catch (error) {
      this.logger.error(`Error executing data step ${step.id}`, { error });
      return {
        success: false,
        stepId: step.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: { error }
      };
    }
  }

  /**
   * Collects data from specified sources
   */
  private async collectData(step: PlanStep, context: Record<string, any>): Promise<ExecutionResult> {
    this.logger.info('Collecting data', { 
      sources: step.data.sources,
      formats: step.data.formats 
    });
    
    // Mock implementation
    const dataCollectionResults = {
      totalSources: step.data.sources.length,
      totalFiles: 15,
      totalRecords: 10000,
      dataBySource: step.data.sources.map(source => ({
        source,
        files: Math.floor(Math.random() * 10) + 1,
        records: Math.floor(Math.random() * 5000) + 500,
        formats: step.data.formats
      }))
    };
    
    return {
      success: true,
      stepId: step.id,
      message: `Collected ${dataCollectionResults.totalRecords} records from ${dataCollectionResults.totalSources} sources`,
      data: { dataCollectionResults }
    };
  }

  /**
   * Validates data quality and integrity
   */
  private async validateData(step: PlanStep, context: Record<string, any>): Promise<ExecutionResult> {
    this.logger.info('Validating data', {
      validateSchema: step.data.validateSchema,
      checkCompleteness: step.data.checkCompleteness,
      checkConsistency: step.data.checkConsistency
    });
    
    const collectionResults = context.collect?.data?.dataCollectionResults;
    if (!collectionResults) {
      throw new ExecutionError('No data collection results available from collect step');
    }
    
    // Mock implementation
    const validationResults = {
      totalRecords: collectionResults.totalRecords,
      validRecords: collectionResults.totalRecords - Math.floor(Math.random() * 100),
      invalidRecords: Math.floor(Math.random() * 100),
      issues: {
        schemaViolations: step.data.validateSchema ? Math.floor(Math.random() * 50) : 0,
        incompleteness: step.data.checkCompleteness ? Math.floor(Math.random() * 30) : 0,
        inconsistencies: step.data.checkConsistency ? Math.floor(Math.random() * 20) : 0
      },
      quality: {
        completeness: 0.985,
        consistency: 0.992,
        accuracy: 0.978
      }
    };
    
    const totalIssues = Object.values(validationResults.issues).reduce((sum, val) => sum + val, 0);
    const success = validationResults.invalidRecords / validationResults.totalRecords < 0.05;
    
    return {
      success,
      stepId: step.id,
      message: success 
        ? `Validated ${validationResults.totalRecords} records with ${totalIssues} minor issues`
        : `Validation failed: ${validationResults.invalidRecords} invalid records out of ${validationResults.totalRecords}`,
      data: { validationResults }
    };
  }

  /**
   * Transforms and processes the data
   */
  private async transformData(step: PlanStep, context: Record<string, any>): Promise<ExecutionResult> {
    this.logger.info('Transforming data', { 
      transformations: step.data.transformations,
      inPlace: step.data.inPlace
    });
    
    const validationResults = context.validate?.data?.validationResults;
    if (!validationResults) {
      throw new ExecutionError('No validation results available from validate step');
    }
    
    // Mock implementation
    const transformationResults = {
      inputRecords: validationResults.validRecords,
      outputRecords: validationResults.validRecords - Math.floor(Math.random() * 50),
      transformations: step.data.transformations.map(transform => ({
        name: transform,
        recordsAffected: Math.floor(Math.random() * validationResults.validRecords),
        success: true
      })),
      duration: Math.floor(Math.random() * 60) + 10, // seconds
      inPlace: step.data.inPlace
    };
    
    return {
      success: true,
      stepId: step.id,
      message: `Transformed ${transformationResults.inputRecords} records into ${transformationResults.outputRecords} output records in ${transformationResults.duration}s`,
      data: { transformationResults, processedData: { records: transformationResults.outputRecords } }
    };
  }

  /**
   * Analyzes the processed data
   */
  private async analyzeData(step: PlanStep, context: Record<string, any>): Promise<ExecutionResult> {
    this.logger.info('Analyzing data', { 
      analysisTypes: step.data.analysisTypes,
      generateReports: step.data.generateReports
    });
    
    const processedData = context.transform?.data?.processedData;
    if (!processedData) {
      throw new ExecutionError('No processed data available from transform step');
    }
    
    // Mock implementation
    const analysisResults = {
      inputRecords: processedData.records,
      analysisTypes: step.data.analysisTypes,
      insights: [
        { name: 'Key finding 1', confidence: 0.92, importance: 'high' },
        { name: 'Key finding 2', confidence: 0.85, importance: 'medium' },
        { name: 'Key finding 3', confidence: 0.78, importance: 'medium' }
      ],
      metrics: {
        mean: 42.5,
        median: 38.2,
        mode: 35.0,
        stdDev: 12.3
      },
      reports: step.data.generateReports ? [
        { name: 'summary_report.pdf', size: 250000 },
        { name: 'detailed_analysis.xlsx', size: 1250000 }
      ] : []
    };
    
    return {
      success: true,
      stepId: step.id,
      message: `Analyzed ${analysisResults.inputRecords} records with ${analysisResults.analysisTypes.length} analysis types${
        step.data.generateReports ? ` and generated ${analysisResults.reports.length} reports` : ''
      }`,
      data: { analysisResults }
    };
  }

  /**
   * Creates visualizations of the analysis results
   */
  private async visualizeResults(step: PlanStep, context: Record<string, any>): Promise<ExecutionResult> {
    this.logger.info('Visualizing results', { 
      visualizationTypes: step.data.visualizationTypes,
      interactive: step.data.interactive
    });
    
    const analysisResults = context.analyze?.data?.analysisResults;
    if (!analysisResults) {
      throw new ExecutionError('No analysis results available from analyze step');
    }
    
    // Mock implementation
    const visualizationResults = {
      visualizationTypes: step.data.visualizationTypes,
      interactive: step.data.interactive,
      visualizations: [
        { type: 'chart', name: 'distribution.png', size: 150000 },
        { type: 'graph', name: 'correlations.png', size: 180000 },
        { type: 'table', name: 'summary_table.html', size: 50000 }
      ],
      dashboards: step.data.interactive ? [
        { name: 'interactive_dashboard.html', size: 500000 }
      ] : []
    };
    
    return {
      success: true,
      stepId: step.id,
      message: `Created ${visualizationResults.visualizations.length} visualizations${
        step.data.interactive ? ` and ${visualizationResults.dashboards.length} interactive dashboard(s)` : ''
      }`,
      data: { visualizationResults }
    };
  }

  /**
   * Stores the processed data to the target location
   */
  private async storeData(step: PlanStep, context: Record<string, any>): Promise<ExecutionResult> {
    this.logger.info('Storing processed data', { 
      destination: step.data.destination,
      format: step.data.format,
      compression: step.data.compression
    });
    
    // Get the final data based on what steps were executed
    const hasAnalysisResults = !!context.analyze?.data?.analysisResults;
    const hasVisualizationResults = !!context.visualize?.data?.visualizationResults;
    const processedData = context.transform?.data?.processedData;
    
    if (!processedData) {
      throw new ExecutionError('No processed data available from previous steps');
    }
    
    // Mock implementation
    const storageResults = {
      destination: step.data.destination,
      format: step.data.format,
      compression: step.data.compression,
      files: [
        { name: 'processed_data.json', size: 2500000, compressed: step.data.compression !== 'none' },
        { name: 'metadata.json', size: 15000, compressed: false }
      ],
      totalSize: 2515000,
      compressedSize: step.data.compression !== 'none' ? 950000 : 2515000,
      timestamp: new Date().toISOString()
    };
    
    // Add additional files if we have analysis or visualization results
    if (hasAnalysisResults) {
      storageResults.files.push({ 
        name: 'analysis_results.json', 
        size: 350000, 
        compressed: step.data.compression !== 'none' 
      });
      storageResults.totalSize += 350000;
      storageResults.compressedSize += step.data.compression !== 'none' ? 120000 : 350000;
    }
    
    if (hasVisualizationResults) {
      storageResults.files.push(
        ...context.visualize.data.visualizationResults.visualizations.map(v => ({
          name: v.name,
          size: v.size,
          compressed: false // Assume visualizations are already compressed
        }))
      );
      
      const visualizationSize = context.visualize.data.visualizationResults.visualizations
        .reduce((sum, v) => sum + v.size, 0);
      
      storageResults.totalSize += visualizationSize;
      storageResults.compressedSize += visualizationSize;
    }
    
    return {
      success: true,
      stepId: step.id,
      message: `Stored ${storageResults.files.length} files (${Math.round(storageResults.totalSize/1024/1024 * 100) / 100}MB raw, ${
        Math.round(storageResults.compressedSize/1024/1024 * 100) / 100
      }MB stored) to ${storageResults.destination}`,
      data: { storageResults }
    };
  }
}