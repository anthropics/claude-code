/**
 * Security Module for Claude Neural Framework
 * 
 * This module provides security-related functionality including:
 * - Security review and validation
 * - Security check CLI tool
 * - Secure API implementation
 */

// Export security review components
export {
  SecurityReview,
  SecurityError,
  SecurityViolationError,
  SecurityConfigError,
  type SecurityErrorOptions,
  type SecurityReviewOptions,
  type ValidationContext,
  type SecurityFinding,
  type SecurityVulnerability,
  type SecurityRecommendation,
  type ValidationResult,
  type SecurityReportSummary,
  type SecurityReport
} from './security-review';

// Export secure API components
export {
  SecureAPI,
  SecurityPolicyLevel,
  type SecureAPIOptions,
  type PasswordHashResult,
  isClaudeError
} from './secure-api';

// Default export for easy importing
import SecurityReview from './security-review';
export default SecurityReview;