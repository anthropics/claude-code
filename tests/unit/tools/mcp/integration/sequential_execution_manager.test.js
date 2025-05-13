/**
 * Unit Tests for Sequential Execution Manager
 */
const path = require('path');
const SequentialExecutionManager = require('../../../../../tools/mcp/integration/sequential_execution_manager');

// Mock dependencies
jest.mock('../../../../../tools/mcp/sequential_planner', () => ({
  generatePlan: jest.fn().mockResolvedValue([
    {
      id: 'step-1',
      number: 1,
      description: 'First step',
      actionType: 'manual',
      status: 'pending',
      result: null,
      isRevised: false
    },
    {
      id: 'step-2',
      number: 2,
      description: 'Second step',
      actionType: 'manual',
      status: 'pending',
      result: null,
      isRevised: false
    }
  ]),
  continuePlanning: jest.fn().mockResolvedValue([
    {
      id: 'step-3',
      number: 3,
      description: 'Third step',
      actionType: 'manual',
      status: 'pending',
      result: null,
      isRevised: false
    }
  ]),
  executeContextStep: jest.fn().mockResolvedValue({
    type: 'context',
    data: { results: [] },
    summary: 'Mock context results'
  }),
  executeUIStep: jest.fn().mockResolvedValue({
    type: 'ui',
    data: { component: 'MockComponent' },
    summary: 'Mock UI component'
  }),
  generateSummary: jest.fn().mockResolvedValue('Mock summary of execution')
}));

// Mock logger
jest.mock('../../../../../core/logging/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

describe('Sequential Execution Manager', () => {
  let manager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    manager = new SequentialExecutionManager({
      fallbackMode: true,
      maxSteps: 5,
      planningDepth: 'medium'
    });
  });
  
  describe('Constructor', () => {
    test('should initialize with default options', () => {
      const defaultManager = new SequentialExecutionManager();
      expect(defaultManager.options.fallbackMode).toBe(false);
      expect(defaultManager.options.maxSteps).toBe(20);
      expect(defaultManager.options.stepTimeout).toBe(30000);
      expect(defaultManager.options.planningDepth).toBe('medium');
    });
    
    test('should initialize with custom options', () => {
      expect(manager.options.fallbackMode).toBe(true);
      expect(manager.options.maxSteps).toBe(5);
      expect(manager.options.planningDepth).toBe('medium');
    });
    
    test('should register standard handlers', () => {
      expect(manager.handlers.size).toBeGreaterThan(0);
      expect(manager.handlers.has('context')).toBe(true);
      expect(manager.handlers.has('ui')).toBe(true);
      expect(manager.handlers.has('manual')).toBe(true);
      expect(manager.handlers.has('executable')).toBe(true);
    });
  });
  
  describe('Observer Pattern', () => {
    test('should add and remove observers', () => {
      const observer = jest.fn();
      
      manager.addObserver(observer);
      expect(manager.observers.length).toBe(1);
      
      manager.removeObserver(observer);
      expect(manager.observers.length).toBe(0);
    });
    
    test('should notify observers of events', () => {
      const observer = jest.fn();
      manager.addObserver(observer);
      
      manager._notifyObservers('testEvent', { test: true });
      
      expect(observer).toHaveBeenCalledWith('testEvent', { test: true });
    });
    
    test('should handle errors in observers', () => {
      const goodObserver = jest.fn();
      const badObserver = jest.fn().mockImplementation(() => {
        throw new Error('Observer error');
      });
      
      manager.addObserver(goodObserver);
      manager.addObserver(badObserver);
      
      // Should not throw an error
      manager._notifyObservers('testEvent', { test: true });
      
      expect(goodObserver).toHaveBeenCalledWith('testEvent', { test: true });
      expect(badObserver).toHaveBeenCalledWith('testEvent', { test: true });
    });
  });
  
  describe('Plan Generation', () => {
    test('should generate a plan', async () => {
      const plan = await manager.generatePlan('Test goal');
      
      expect(plan).toHaveLength(2);
      expect(manager.currentPlan).toHaveLength(2);
      expect(manager.currentStep).toEqual(plan[0]);
      expect(manager.currentGoal).toBe('Test goal');
    });
    
    test('should throw an error if no goal is provided', async () => {
      await expect(manager.generatePlan()).rejects.toThrow('Goal is required');
    });
    
    test('should continue a plan', async () => {
      await manager.generatePlan('Test goal');
      const updatedPlan = await manager.continuePlan();
      
      expect(updatedPlan).toHaveLength(3); // 2 original + 1 new
      expect(manager.currentPlan).toHaveLength(3);
    });
    
    test('should throw an error if continuing with no active plan', async () => {
      await expect(manager.continuePlan()).rejects.toThrow('No active plan to continue');
    });
  });
  
  describe('Step Execution', () => {
    beforeEach(async () => {
      await manager.generatePlan('Test goal');
    });
    
    test('should execute the current step', async () => {
      const result = await manager.executeCurrentStep();
      
      expect(result).toBeDefined();
      expect(manager.executedSteps).toHaveLength(1);
      
      // First step should be completed
      expect(manager.currentPlan[0].status).toBe('completed');
      
      // Second step should now be current
      expect(manager.currentStep).toEqual(manager.currentPlan[1]);
    });
    
    test('should throw an error if no current step', async () => {
      manager.currentStep = null;
      await expect(manager.executeCurrentStep()).rejects.toThrow('No current step to execute');
    });
    
    test('should skip the current step', async () => {
      const success = await manager.skipCurrentStep();
      
      expect(success).toBe(true);
      expect(manager.executedSteps).toHaveLength(1);
      
      // First step should be skipped
      expect(manager.currentPlan[0].status).toBe('skipped');
      
      // Second step should now be current
      expect(manager.currentStep).toEqual(manager.currentPlan[1]);
    });
    
    test('should throw an error if no current step to skip', async () => {
      manager.currentStep = null;
      await expect(manager.skipCurrentStep()).rejects.toThrow('No current step to skip');
    });
    
    test('should revise a step', async () => {
      const stepId = manager.currentPlan[0].id;
      const revision = 'Revised step description';
      
      const success = await manager.reviseStep(stepId, revision);
      
      expect(success).toBe(true);
      expect(manager.currentPlan[0].description).toBe(revision);
      expect(manager.currentPlan[0].isRevised).toBe(true);
    });
    
    test('should throw an error if no active plan for revision', async () => {
      manager.currentPlan = null;
      await expect(manager.reviseStep('step-1', 'Revision')).rejects.toThrow('No active plan');
    });
    
    test('should throw an error if step not found for revision', async () => {
      await expect(manager.reviseStep('non-existent', 'Revision')).rejects.toThrow('Step with ID non-existent not found');
    });
  });
  
  describe('Plan Completion', () => {
    beforeEach(async () => {
      await manager.generatePlan('Test goal');
    });
    
    test('should complete the plan after all steps are executed', async () => {
      // Execute first step
      await manager.executeCurrentStep();
      expect(manager.isComplete).toBe(false);
      
      // Execute second step
      await manager.executeCurrentStep();
      
      // Plan should be complete
      expect(manager.isComplete).toBe(true);
      expect(manager.currentStep).toBeNull();
      expect(manager.executedSteps).toHaveLength(2);
      expect(manager.executionResult).toBeDefined();
    });
    
    test('should generate a summary', async () => {
      // Execute all steps
      await manager.executeCurrentStep();
      await manager.executeCurrentStep();
      
      const summary = await manager.generateSummary();
      
      expect(summary).toBe('Mock summary of execution');
    });
    
    test('should run the entire plan', async () => {
      const result = await manager.runEntirePlan();
      
      expect(result).toBeDefined();
      expect(result.executedSteps).toHaveLength(2);
      expect(result.summary).toBe('Mock summary of execution');
      expect(manager.isComplete).toBe(true);
    });
    
    test('should reset the manager state', () => {
      manager.reset();
      
      expect(manager.currentPlan).toBeNull();
      expect(manager.currentStep).toBeNull();
      expect(manager.executedSteps).toHaveLength(0);
      expect(manager.isLoading).toBe(false);
      expect(manager.error).toBeNull();
      expect(manager.isComplete).toBe(false);
      expect(manager.currentGoal).toBeNull();
      expect(manager.executionResult).toBeNull();
    });
  });
  
  describe('Domain-Specific Planning', () => {
    test('should create a documentation domain manager', () => {
      const docManager = SequentialExecutionManager.forDomain('documentation');
      
      expect(docManager).toBeInstanceOf(SequentialExecutionManager);
      expect(docManager.handlers.has('code_analysis')).toBe(true);
      expect(docManager.handlers.has('documentation')).toBe(true);
    });
    
    test('should create a CI/CD domain manager', () => {
      const cicdManager = SequentialExecutionManager.forDomain('cicd');
      
      expect(cicdManager).toBeInstanceOf(SequentialExecutionManager);
      expect(cicdManager.handlers.has('test')).toBe(true);
      expect(cicdManager.handlers.has('build')).toBe(true);
      expect(cicdManager.handlers.has('deploy')).toBe(true);
    });
    
    test('should create a data processing domain manager', () => {
      const dataManager = SequentialExecutionManager.forDomain('data');
      
      expect(dataManager).toBeInstanceOf(SequentialExecutionManager);
      expect(dataManager.handlers.has('extract')).toBe(true);
      expect(dataManager.handlers.has('transform')).toBe(true);
      expect(dataManager.handlers.has('load')).toBe(true);
    });
  });
});