/**
 * Tests for the Zod schemas in the Security module
 */

import {
  SecurityPolicyLevelSchema,
  ApiRuleTypeSchema,
  ApiAccessRuleSchema,
  SecurityPolicySchema,
  SecurityFindingSchema,
  SecurityVulnerabilitySchema,
  SecurityRecommendationSchema,
  SecurityReportSummarySchema,
  SecurityReportSchema,
  SecureAPIOptionsSchema,
  SecurityConfigSchema,
  validateSecurityPolicy,
  validateSecurityConfig,
  validateApiAccessRule
} from './schemas';

import { z } from 'zod';

describe('Security Schemas', () => {
  describe('SecurityPolicyLevelSchema', () => {
    it('should validate valid policy levels', () => {
      expect(SecurityPolicyLevelSchema.parse('strict')).toBe('strict');
      expect(SecurityPolicyLevelSchema.parse('moderate')).toBe('moderate');
      expect(SecurityPolicyLevelSchema.parse('open')).toBe('open');
    });

    it('should reject invalid policy levels', () => {
      expect(() => SecurityPolicyLevelSchema.parse('invalid')).toThrow(z.ZodError);
      expect(() => SecurityPolicyLevelSchema.parse('')).toThrow(z.ZodError);
    });
  });

  describe('ApiRuleTypeSchema', () => {
    it('should validate valid rule types', () => {
      expect(ApiRuleTypeSchema.parse('rate_limit')).toBe('rate_limit');
      expect(ApiRuleTypeSchema.parse('ip_restriction')).toBe('ip_restriction');
      expect(ApiRuleTypeSchema.parse('auth_required')).toBe('auth_required');
    });

    it('should reject invalid rule types', () => {
      expect(() => ApiRuleTypeSchema.parse('invalid')).toThrow(z.ZodError);
    });
  });

  describe('ApiAccessRuleSchema', () => {
    it('should validate valid API access rules', () => {
      const validRule = {
        id: 'rule-123',
        type: 'rate_limit',
        description: 'Limit API calls',
        enabled: true,
        parameters: { limit: 100, window: 60000 },
        path: '/api/v1',
        method: 'GET',
        priority: 10
      };
      
      expect(ApiAccessRuleSchema.parse(validRule)).toEqual(validRule);
    });

    it('should set default priority if not provided', () => {
      const ruleWithoutPriority = {
        id: 'rule-123',
        type: 'rate_limit',
        description: 'Limit API calls',
        enabled: true
      };
      
      const parsed = ApiAccessRuleSchema.parse(ruleWithoutPriority);
      expect(parsed.priority).toBe(10);
    });

    it('should reject invalid API access rules', () => {
      // Missing required fields
      expect(() => ApiAccessRuleSchema.parse({})).toThrow(z.ZodError);
      
      // Invalid type
      expect(() => ApiAccessRuleSchema.parse({
        id: 'rule-123',
        type: 'invalid_type',
        description: 'Limit API calls',
        enabled: true
      })).toThrow(z.ZodError);
    });
  });

  describe('SecurityPolicySchema', () => {
    it('should validate valid security policies', () => {
      const validPolicy = {
        id: 'policy-123',
        name: 'Default Policy',
        description: 'Default security policy',
        level: 'strict',
        rules: [
          {
            id: 'rule-123',
            type: 'rate_limit',
            description: 'Limit API calls',
            enabled: true
          }
        ],
        default: true
      };
      
      expect(SecurityPolicySchema.parse(validPolicy)).toEqual(validPolicy);
    });

    it('should set default value for default property', () => {
      const policyWithoutDefault = {
        id: 'policy-123',
        name: 'Default Policy',
        description: 'Default security policy',
        level: 'strict',
        rules: []
      };
      
      const parsed = SecurityPolicySchema.parse(policyWithoutDefault);
      expect(parsed.default).toBe(false);
    });

    it('should reject invalid security policies', () => {
      // Missing required fields
      expect(() => SecurityPolicySchema.parse({})).toThrow(z.ZodError);
      
      // Invalid level
      expect(() => SecurityPolicySchema.parse({
        id: 'policy-123',
        name: 'Default Policy',
        description: 'Default security policy',
        level: 'invalid',
        rules: []
      })).toThrow(z.ZodError);
    });
  });

  describe('SecurityFindingSchema', () => {
    it('should validate valid security findings', () => {
      const validFinding = {
        id: 'finding-123',
        validator: 'api-key-exposure',
        type: 'api-key',
        title: 'API Key Exposure',
        description: 'API key found in code',
        location: 'src/api.js',
        timestamp: '2023-01-01T00:00:00.000Z'
      };
      
      expect(SecurityFindingSchema.parse(validFinding)).toEqual(validFinding);
    });

    it('should reject invalid security findings', () => {
      // Missing required fields
      expect(() => SecurityFindingSchema.parse({})).toThrow(z.ZodError);
      
      // Invalid timestamp
      expect(() => SecurityFindingSchema.parse({
        id: 'finding-123',
        validator: 'api-key-exposure',
        type: 'api-key',
        title: 'API Key Exposure',
        description: 'API key found in code',
        location: 'src/api.js',
        timestamp: 'invalid-date'
      })).toThrow(z.ZodError);
    });
  });

  describe('SecurityVulnerabilitySchema', () => {
    it('should validate valid security vulnerabilities', () => {
      const validVulnerability = {
        id: 'vuln-123',
        validator: 'dependency-check',
        type: 'dependency',
        title: 'Vulnerable Dependency',
        description: 'Using vulnerable package',
        severity: 'high',
        location: 'package.json',
        recommendation: 'Update to latest version',
        timestamp: '2023-01-01T00:00:00.000Z'
      };
      
      expect(SecurityVulnerabilitySchema.parse(validVulnerability)).toEqual(validVulnerability);
    });

    it('should reject invalid security vulnerabilities', () => {
      // Missing required fields
      expect(() => SecurityVulnerabilitySchema.parse({})).toThrow(z.ZodError);
      
      // Invalid severity
      expect(() => SecurityVulnerabilitySchema.parse({
        id: 'vuln-123',
        validator: 'dependency-check',
        type: 'dependency',
        title: 'Vulnerable Dependency',
        description: 'Using vulnerable package',
        severity: 'invalid',
        location: 'package.json',
        timestamp: '2023-01-01T00:00:00.000Z'
      })).toThrow(z.ZodError);
    });
  });

  describe('SecurityReportSchema', () => {
    it('should validate valid security reports', () => {
      const validReport = {
        id: 'report-123',
        timestamp: '2023-01-01T00:00:00.000Z',
        framework: {
          name: 'Claude Neural Framework',
          version: '1.0.0'
        },
        summary: {
          securityScore: 85,
          findingsCount: 2,
          vulnerabilitiesCount: 1,
          passedValidators: 7,
          totalValidators: 8
        },
        findings: [
          {
            id: 'finding-123',
            validator: 'api-key-exposure',
            type: 'api-key',
            title: 'API Key Exposure',
            description: 'API key found in code',
            location: 'src/api.js',
            timestamp: '2023-01-01T00:00:00.000Z'
          }
        ],
        vulnerabilities: [
          {
            id: 'vuln-123',
            validator: 'dependency-check',
            type: 'dependency',
            title: 'Vulnerable Dependency',
            description: 'Using vulnerable package',
            severity: 'high',
            location: 'package.json',
            timestamp: '2023-01-01T00:00:00.000Z'
          }
        ],
        recommendations: [
          {
            type: 'api-key',
            findings: 1,
            title: 'Secure API Keys',
            description: 'Secure API keys by using environment variables'
          }
        ]
      };
      
      expect(SecurityReportSchema.parse(validReport)).toEqual(validReport);
    });

    it('should reject invalid security reports', () => {
      // Missing required fields
      expect(() => SecurityReportSchema.parse({})).toThrow(z.ZodError);
      
      // Invalid summary
      expect(() => SecurityReportSchema.parse({
        id: 'report-123',
        timestamp: '2023-01-01T00:00:00.000Z',
        framework: {
          name: 'Claude Neural Framework',
          version: '1.0.0'
        },
        summary: {
          securityScore: 'invalid', // should be number
          findingsCount: 2,
          vulnerabilitiesCount: 1,
          passedValidators: 7,
          totalValidators: 8
        },
        findings: [],
        vulnerabilities: [],
        recommendations: []
      })).toThrow(z.ZodError);
    });
  });

  describe('validateSecurityPolicy', () => {
    it('should validate security policies correctly', () => {
      const validPolicy = {
        id: 'policy-123',
        name: 'Default Policy',
        description: 'Default security policy',
        level: 'strict',
        rules: [],
        default: true
      };
      
      expect(validateSecurityPolicy(validPolicy)).toEqual(validPolicy);
    });

    it('should throw for invalid policies', () => {
      expect(() => validateSecurityPolicy({})).toThrow();
    });
  });

  describe('validateSecurityConfig', () => {
    it('should validate security configs correctly', () => {
      const validConfig = {
        version: '1.0.0',
        mcp: {
          allowed_servers: ['sequentialthinking', 'brave-search'],
          allow_server_autostart: true,
          allow_remote_servers: false
        },
        filesystem: {
          allowed_directories: ['/home/user/projects']
        }
      };
      
      expect(validateSecurityConfig(validConfig)).toEqual(validConfig);
    });

    it('should throw for invalid configs', () => {
      expect(() => validateSecurityConfig({})).toThrow();
    });
  });

  describe('validateApiAccessRule', () => {
    it('should validate API access rules correctly', () => {
      const validRule = {
        id: 'rule-123',
        type: 'rate_limit',
        description: 'Limit API calls',
        enabled: true
      };
      
      expect(validateApiAccessRule(validRule)).toEqual({
        ...validRule,
        priority: 10
      });
    });

    it('should throw for invalid rules', () => {
      expect(() => validateApiAccessRule({})).toThrow();
    });
  });
});