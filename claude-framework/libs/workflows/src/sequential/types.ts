/**
 * Plan status
 */
export type PlanStatus = 'created' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

/**
 * Step status
 */
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

/**
 * Plan step interface
 */
export interface PlanStep {
  id: string;
  name: string;
  description: string;
  status: StepStatus;
  dependsOn?: string[];
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
  success: boolean;
  stepId: string;
  message?: string;
  error?: string;
  data?: Record<string, any>;
}

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
export type Domain = 'documentation' | 'cicd' | 'data' | 'general';