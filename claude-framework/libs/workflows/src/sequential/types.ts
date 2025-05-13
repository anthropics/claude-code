/**
 * Plan status
 */
export type PlanStatus = 'created' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

/**
 * Step status
 */
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

/**
 * Action type
 */
export type ActionType = 'context' | 'ui' | 'manual' | 'executable' | 'code_analysis' | 'documentation' | 
                         'test' | 'build' | 'deploy' | 'extract' | 'transform' | 'load' | string;

/**
 * Plan step interface
 */
export interface PlanStep {
  id: string;
  number: number;
  name?: string;
  description: string;
  actionType: ActionType;
  status: StepStatus;
  isRevised?: boolean;
  dependsOn?: string[];
  result?: ExecutionResult;
  data?: Record<string, any>;
}

/**
 * Plan interface
 */
export interface Plan {
  id: string;
  name: string;
  description: string;
  domain: string;
  steps: PlanStep[];
  createdAt: Date;
  status: PlanStatus;
}

/**
 * Execution result interface
 */
export interface ExecutionResult {
  type: string;
  data: Record<string, any>;
  summary: string;
  success?: boolean;
  stepId?: string;
  message?: string;
  error?: string;
}

/**
 * Execution options
 */
export interface ExecutionOptions {
  [key: string]: any;
  timeout?: number;
  fallbackMode?: boolean;
  maxSteps?: number;
  initialSteps?: number;
  depth?: 'shallow' | 'medium' | 'deep';
  planningDepth?: 'shallow' | 'medium' | 'deep';
  searchTerm?: string;
  componentSpec?: any;
  result?: any;
  summary?: string;
  executeFunction?: (step: PlanStep) => Promise<any>;
  fileContent?: any;
  path?: string;
  outputPath?: string;
  content?: string;
  testResults?: any;
  testCount?: number;
  failCount?: number;
  artifacts?: string[];
  artifactCount?: number;
  environment?: string;
  url?: string;
  recordCount?: number;
  source?: string;
  transformationCount?: number;
  destination?: string;
}

/**
 * Step handler function
 */
export type StepHandler = (step: PlanStep, options?: ExecutionOptions) => Promise<ExecutionResult>;

/**
 * Execution observer callback type
 */
export type ExecutionObserver = (event: string, data: any) => void;

/**
 * Sequential Execution Manager Options
 */
export interface SequentialExecutionManagerOptions {
  fallbackMode?: boolean;
  maxSteps?: number;
  stepTimeout?: number;
  planningDepth?: 'shallow' | 'medium' | 'deep';
  [key: string]: any;
}

/**
 * Executor options
 */
export interface ExecutorOptions {
  fallbackMode?: boolean;
  timeout?: number;
  [key: string]: any;
}

/**
 * Plan execution result
 */
export interface PlanExecutionResult {
  planId: string;
  domain: string;
  success: boolean;
  executedSteps: PlanStep[];
  results: Record<string, ExecutionResult>;
  error?: string;
  summary?: string;
}

/**
 * Domain type
 */
export type Domain = 'documentation' | 'cicd' | 'data' | 'custom' | 'general';