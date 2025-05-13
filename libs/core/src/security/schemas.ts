/**
 * Zod Schemas for Security Module
 * 
 * This file provides zod schemas for runtime validation of
 * security configurations and objects in the Claude Neural Framework.
 */

import { z } from 'zod';

/**
 * Security policy level schema
 */
export const SecurityPolicyLevelSchema = z.enum(['strict', 'moderate', 'open']);

/**
 * API Rule Type Schema
 */
export const ApiRuleTypeSchema = z.enum([
  'rate_limit',
  'ip_restriction',
  'auth_required',
  'cors',
  'content_type',
  'request_size'
]);

/**
 * API Access Rule Schema
 */
export const ApiAccessRuleSchema = z.object({
  id: z.string(),
  type: ApiRuleTypeSchema,
  description: z.string(),
  enabled: z.boolean(),
  parameters: z.record(z.string(), z.any()).optional(),
  path: z.string().optional(),
  method: z.string().optional(),
  priority: z.number().int().default(10)
});

/**
 * Security Policy Schema
 */
export const SecurityPolicySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  level: SecurityPolicyLevelSchema,
  rules: z.array(ApiAccessRuleSchema),
  default: z.boolean().default(false),
  created: z.string().datetime().optional(),
  modified: z.string().datetime().optional()
});

/**
 * Security Finding Schema
 */
export const SecurityFindingSchema = z.object({
  id: z.string(),
  validator: z.string(),
  type: z.string(),
  title: z.string(),
  description: z.string(),
  location: z.string(),
  timestamp: z.string().datetime(),
  // Additional properties can be added with extend()
});

/**
 * Security Vulnerability Schema with severity
 */
export const SecurityVulnerabilitySchema = z.object({
  id: z.string(),
  validator: z.string(),
  type: z.string(),
  title: z.string(),
  description: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  location: z.string(),
  recommendation: z.string().optional(),
  timestamp: z.string().datetime(),
  // Additional properties can be added with extend()
});

/**
 * Security Recommendation Schema
 */
export const SecurityRecommendationSchema = z.object({
  type: z.string(),
  findings: z.number().int().optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  title: z.string(),
  description: z.string()
});

/**
 * Security Report Summary Schema
 */
export const SecurityReportSummarySchema = z.object({
  securityScore: z.number().int().min(0).max(100),
  findingsCount: z.number().int().min(0),
  vulnerabilitiesCount: z.number().int().min(0),
  passedValidators: z.number().int().min(0),
  totalValidators: z.number().int().min(0)
});

/**
 * Security Report Schema
 */
export const SecurityReportSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  framework: z.object({
    name: z.string(),
    version: z.string()
  }),
  summary: SecurityReportSummarySchema,
  findings: z.array(SecurityFindingSchema),
  vulnerabilities: z.array(SecurityVulnerabilitySchema),
  recommendations: z.array(SecurityRecommendationSchema),
  reportPath: z.string().optional()
});

/**
 * Secure API Options Schema
 */
export const SecureAPIOptionsSchema = z.object({
  rateLimitRequests: z.number().int().positive().optional(),
  rateLimitWindowMs: z.number().int().positive().optional(),
  sessionTimeoutMs: z.number().int().positive().optional(),
  requireHTTPS: z.boolean().optional(),
  csrfProtection: z.boolean().optional(),
  secureHeaders: z.boolean().optional(),
  inputValidation: z.boolean().optional(),
  policyLevel: SecurityPolicyLevelSchema.optional()
}).strict().passthrough();

/**
 * Security Config Schema
 */
export const SecurityConfigSchema = z.object({
  version: z.string(),
  mcp: z.object({
    allowed_servers: z.array(z.string()),
    allow_server_autostart: z.boolean(),
    allow_remote_servers: z.boolean()
  }),
  filesystem: z.object({
    allowed_directories: z.array(z.string())
  }),
  api: z.object({
    require_https: z.boolean(),
    rate_limit: z.object({
      enabled: z.boolean(),
      requests_per_window: z.number().int().positive(),
      window_ms: z.number().int().positive()
    }),
    policies: z.array(SecurityPolicySchema)
  }).optional()
});

// Define types from schemas
export type SecurityPolicy = z.infer<typeof SecurityPolicySchema>;
export type ApiAccessRule = z.infer<typeof ApiAccessRuleSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

// Export validation functions
export function validateSecurityPolicy(data: unknown): SecurityPolicy {
  return SecurityPolicySchema.parse(data);
}

export function validateSecurityConfig(data: unknown): SecurityConfig {
  return SecurityConfigSchema.parse(data);
}

export function validateApiAccessRule(data: unknown): ApiAccessRule {
  return ApiAccessRuleSchema.parse(data);
}

// Export default validators
export default {
  validateSecurityPolicy,
  validateSecurityConfig,
  validateApiAccessRule
};