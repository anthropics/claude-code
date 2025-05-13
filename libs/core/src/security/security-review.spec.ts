/**
 * Tests for the SecurityReview module
 */

import { SecurityReview, SecurityVulnerability, SecurityFinding } from './security-review';
import path from 'path';
import fs from 'fs';

// Mock dependencies
jest.mock('../logging/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

jest.mock('../config/config-manager', () => ({
  __esModule: true,
  ConfigType: {
    SECURITY: 'security',
    GLOBAL: 'global'
  },
  default: {
    getConfig: jest.fn().mockReturnValue({ mcp: { allowed_servers: [] } }),
    getConfigValue: jest.fn().mockReturnValue('1.0.0')
  }
}));

jest.mock('../i18n/i18n', () => ({
  I18n: jest.fn().mockImplementation(() => ({
    translate: jest.fn().mockImplementation(key => key)
  }))
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn()
}));

describe('SecurityReview', () => {
  let securityReview: SecurityReview;
  const tempReportPath = path.join(__dirname, 'temp-security-report.json');

  beforeEach(() => {
    jest.clearAllMocks();
    
    securityReview = new SecurityReview({
      reportPath: tempReportPath
    });
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(securityReview).toBeInstanceOf(SecurityReview);
    });

    it('should initialize with custom options', () => {
      const customReview = new SecurityReview({
        autoFix: true,
        strictMode: false,
        reportPath: '/custom/path.json'
      });
      expect(customReview).toBeInstanceOf(SecurityReview);
    });
  });

  describe('registerValidator', () => {
    it('should register a valid validator function', () => {
      const validatorFn = async () => ({ findings: [], vulnerabilities: [] });
      const result = securityReview.registerValidator('test-validator', validatorFn);
      expect(result).toBe(true);
    });

    it('should reject non-function validators', () => {
      // @ts-ignore - Testing invalid input
      const result = securityReview.registerValidator('invalid-validator', 'not-a-function');
      expect(result).toBe(false);
    });
  });

  describe('unregisterValidator', () => {
    it('should unregister an existing validator', async () => {
      const validatorFn = async () => ({ findings: [], vulnerabilities: [] });
      securityReview.registerValidator('test-validator', validatorFn);
      const result = securityReview.unregisterValidator('test-validator');
      expect(result).toBe(true);
    });

    it('should return false for non-existent validator', () => {
      const result = securityReview.unregisterValidator('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('addFinding', () => {
    it('should add a finding with minimal details', () => {
      securityReview.addFinding({
        title: 'Test Finding',
        description: 'A test finding',
        location: 'test.js'
      });
      
      // Run validators to check if finding was added
      securityReview.runValidators().then(report => {
        expect(report.findings.length).toBe(1);
        expect(report.findings[0].title).toBe('Test Finding');
      });
    });

    it('should generate ID if not provided', () => {
      securityReview.addFinding({
        title: 'Test Finding',
        description: 'A test finding',
        location: 'test.js'
      });
      
      securityReview.runValidators().then(report => {
        expect(report.findings[0].id).toBeDefined();
        expect(report.findings[0].id.startsWith('finding-')).toBe(true);
      });
    });
  });

  describe('addVulnerability', () => {
    it('should add a vulnerability with minimal details', () => {
      securityReview.addVulnerability({
        title: 'Test Vulnerability',
        description: 'A test vulnerability',
        location: 'test.js',
        severity: 'high'
      });
      
      securityReview.runValidators().then(report => {
        expect(report.vulnerabilities.length).toBe(1);
        expect(report.vulnerabilities[0].title).toBe('Test Vulnerability');
        expect(report.vulnerabilities[0].severity).toBe('high');
      });
    });

    it('should generate ID if not provided', () => {
      securityReview.addVulnerability({
        title: 'Test Vulnerability',
        description: 'A test vulnerability',
        location: 'test.js',
        severity: 'high'
      });
      
      securityReview.runValidators().then(report => {
        expect(report.vulnerabilities[0].id).toBeDefined();
        expect(report.vulnerabilities[0].id.startsWith('vuln-')).toBe(true);
      });
    });
  });

  describe('runValidators', () => {
    it('should run all registered validators', async () => {
      // Register custom validators
      const validator1 = jest.fn().mockResolvedValue({
        findings: [{ 
          id: 'finding-1',
          validator: 'validator-1',
          type: 'test',
          title: 'Finding 1',
          description: 'Test finding 1',
          location: 'test1.js',
          timestamp: new Date().toISOString()
        }],
        vulnerabilities: []
      });
      
      const validator2 = jest.fn().mockResolvedValue({
        findings: [],
        vulnerabilities: [{
          id: 'vuln-1',
          validator: 'validator-2',
          type: 'test',
          title: 'Vulnerability 1',
          description: 'Test vulnerability 1',
          severity: 'high',
          location: 'test2.js',
          timestamp: new Date().toISOString()
        }]
      });
      
      securityReview.registerValidator('validator-1', validator1);
      securityReview.registerValidator('validator-2', validator2);
      
      const report = await securityReview.runValidators();
      
      expect(validator1).toHaveBeenCalled();
      expect(validator2).toHaveBeenCalled();
      expect(report.findings.length).toBe(1);
      expect(report.vulnerabilities.length).toBe(1);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle validator errors gracefully', async () => {
      // Register a validator that throws an error
      const failingValidator = jest.fn().mockRejectedValue(new Error('Validator failed'));
      securityReview.registerValidator('failing-validator', failingValidator);
      
      const report = await securityReview.runValidators();
      
      expect(failingValidator).toHaveBeenCalled();
      expect(report.findings.length).toBe(0);
      expect(report.vulnerabilities.length).toBe(0);
    });

    it('should calculate security score based on findings and vulnerabilities', async () => {
      // Add critical vulnerability
      securityReview.addVulnerability({
        title: 'Critical Vulnerability',
        description: 'A critical vulnerability',
        location: 'critical.js',
        severity: 'critical'
      });
      
      // Add high vulnerability
      securityReview.addVulnerability({
        title: 'High Vulnerability',
        description: 'A high vulnerability',
        location: 'high.js',
        severity: 'high'
      });
      
      // Add findings
      securityReview.addFinding({
        title: 'Finding 1',
        description: 'A test finding',
        location: 'finding1.js'
      });
      
      securityReview.addFinding({
        title: 'Finding 2',
        description: 'Another test finding',
        location: 'finding2.js'
      });
      
      const report = await securityReview.runValidators();
      
      // Base score 100 - 20 (critical) - 10 (high) - 0.5*2 (findings) = 69
      expect(report.summary.securityScore).toBe(69);
    });
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations based on findings and vulnerabilities', async () => {
      // Add API key finding
      securityReview.addFinding({
        title: 'API Key Exposure',
        description: 'API key found in code',
        location: 'api.js',
        type: 'api-key',
        validator: 'api-key-exposure'
      });
      
      // Add dependency finding
      securityReview.addFinding({
        title: 'Outdated Dependency',
        description: 'Using outdated package',
        location: 'package.json',
        type: 'dependency',
        validator: 'secure-dependencies'
      });
      
      // Add critical vulnerability
      securityReview.addVulnerability({
        title: 'Critical Vulnerability',
        description: 'A critical vulnerability',
        location: 'critical.js',
        severity: 'critical',
        type: 'vulnerability',
        validator: 'config-constraints'
      });
      
      const report = await securityReview.runValidators();
      
      expect(report.recommendations.length).toBe(3);
      
      // Check for API key recommendation
      const apiKeyRec = report.recommendations.find(r => r.type === 'api-key');
      expect(apiKeyRec).toBeDefined();
      expect(apiKeyRec?.title).toBe('Secure API Keys');
      
      // Check for dependency recommendation
      const depRec = report.recommendations.find(r => r.type === 'dependency');
      expect(depRec).toBeDefined();
      expect(depRec?.title).toBe('Update Vulnerable Dependencies');
      
      // Check for vulnerability recommendation
      const vulnRec = report.recommendations.find(r => r.type === 'vulnerability');
      expect(vulnRec).toBeDefined();
      expect(vulnRec?.severity).toBe('critical');
    });
  });
});