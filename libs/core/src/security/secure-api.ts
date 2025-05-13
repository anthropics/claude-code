/**
 * Secure API Implementation Example
 * 
 * This module demonstrates secure API implementation patterns for the Claude Neural Framework.
 * It should be used as a reference for implementing secure APIs within the framework.
 */

import crypto from 'crypto';
import { promisify } from 'util';
import { Request, Response, NextFunction } from 'express';

// Import standardized config manager
import configManager, { ConfigType } from '../config/config-manager';

// Import standardized logger
import { Logger } from '../logging/logger';

// Import error handler
import { ValidationError, ClaudeError } from '../error/error-handler';

// Import internationalization
import { I18n } from '../i18n/i18n';

/**
 * Promisified crypto functions
 */
const randomBytes = promisify(crypto.randomBytes);
const scrypt = promisify(crypto.scrypt);

/**
 * Security policy level enum
 */
export enum SecurityPolicyLevel {
  STRICT = 'strict',
  MODERATE = 'moderate',
  OPEN = 'open'
}

/**
 * Interface for secure API options
 */
export interface SecureAPIOptions {
  rateLimitRequests?: number;
  rateLimitWindowMs?: number;
  sessionTimeoutMs?: number;
  requireHTTPS?: boolean;
  csrfProtection?: boolean;
  secureHeaders?: boolean;
  inputValidation?: boolean;
  policyLevel?: SecurityPolicyLevel;
  [key: string]: any;
}

/**
 * Interface for client rate limit state
 */
interface ClientRateLimitState {
  requests: number;
  windowStart: number;
}

/**
 * Interface for password hash result
 */
export interface PasswordHashResult {
  hash: string;
  salt: string;
}

/**
 * Type guard for checking if an error is a ClaudeError
 */
export function isClaudeError(error: unknown): error is ClaudeError {
  return (
    typeof error === 'object' && 
    error !== null && 
    'type' in error && 
    'details' in error && 
    'statusCode' in error
  );
}

/**
 * Secure API base class with security best practices
 */
export class SecureAPI {
  private i18n: I18n;
  private options: SecureAPIOptions;
  private rateLimitState: Map<string, ClientRateLimitState>;
  private securityHeaders: Record<string, string>;
  private logger: Logger;
  
  /**
   * Create a new secure API instance
   * 
   * @param options - Configuration options
   */
  constructor(options: SecureAPIOptions = {}) {
    // Initialize logger
    this.logger = new Logger('secure-api');
    
    // Initialize internationalization
    this.i18n = new I18n();
    
    // Set default options with secure defaults
    this.options = {
      rateLimitRequests: 100,
      rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
      sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
      requireHTTPS: true,
      csrfProtection: true,
      secureHeaders: true,
      inputValidation: true,
      policyLevel: SecurityPolicyLevel.STRICT,
      ...options
    };
    
    // Initialize rate limiting state
    this.rateLimitState = new Map<string, ClientRateLimitState>();
    
    // Set up security headers
    this.securityHeaders = {
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; object-src 'none';",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'no-referrer-when-downgrade',
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache'
    };
    
    this.logger.info(this.i18n.translate('security.apiInitialized'), {
      options: this.options
    });
  }
  
  /**
   * Apply security middleware to a request handler
   * 
   * @param handler - Request handler function
   * @returns Secured request handler
   */
  public secureHandler<T = any>(
    handler: (req: Request, res: Response, ...args: any[]) => Promise<T>
  ): (req: Request, res: Response, ...args: any[]) => Promise<T | void> {
    return async (req: Request, res: Response, ...args: any[]): Promise<T | void> => {
      try {
        // Verify HTTPS
        if (this.options.requireHTTPS && !req.secure) {
          throw new ValidationError(this.i18n.translate('errors.httpsRequired'));
        }
        
        // Apply security headers
        if (this.options.secureHeaders) {
          this.applySecurityHeaders(res);
        }
        
        // Apply rate limiting
        if (!this.checkRateLimit(req)) {
          throw new ValidationError(this.i18n.translate('errors.rateLimitExceeded'), {
            details: {
              retryAfter: this.getRateLimitReset(req)
            },
            statusCode: 429
          });
        }
        
        // Validate CSRF token
        if (this.options.csrfProtection && !this.validateCSRF(req)) {
          throw new ValidationError(this.i18n.translate('errors.invalidCsrfToken'), {
            details: {},
            statusCode: 403
          });
        }
        
        // Validate input
        if (this.options.inputValidation) {
          this.validateInput(req);
        }
        
        // Call the original handler
        return await handler(req, res, ...args);
      } catch (error) {
        // Log error
        this.logger.error(this.i18n.translate('errors.requestError'), { error });
        
        // Format error response
        const formattedError = this.formatErrorResponse(error);
        
        // Send error response
        res.status(formattedError.status || 500).json({
          error: formattedError
        });
      }
    };
  }
  
  /**
   * Apply security headers to response
   * 
   * @param res - Response object
   * @private
   */
  private applySecurityHeaders(res: Response): void {
    Object.entries(this.securityHeaders).forEach(([header, value]) => {
      res.setHeader(header, value);
    });
  }
  
  /**
   * Check rate limiting for request
   * 
   * @param req - Request object
   * @returns True if request is within rate limits
   * @private
   */
  private checkRateLimit(req: Request): boolean {
    const clientId = this.getClientId(req);
    const now = Date.now();
    
    // Get client state
    let clientState = this.rateLimitState.get(clientId);
    
    // Initialize client state if not exists
    if (!clientState) {
      clientState = {
        requests: 0,
        windowStart: now
      };
      this.rateLimitState.set(clientId, clientState);
    }
    
    // Reset window if expired
    if (now - clientState.windowStart > this.options.rateLimitWindowMs!) {
      clientState.requests = 0;
      clientState.windowStart = now;
    }
    
    // Increment request count
    clientState.requests++;
    
    // Check if over limit
    return clientState.requests <= this.options.rateLimitRequests!;
  }
  
  /**
   * Get when rate limit will reset for a client
   * 
   * @param req - Request object
   * @returns Milliseconds until rate limit reset
   * @private
   */
  private getRateLimitReset(req: Request): number {
    const clientId = this.getClientId(req);
    const clientState = this.rateLimitState.get(clientId);
    
    if (!clientState) {
      return 0;
    }
    
    return Math.max(0, this.options.rateLimitWindowMs! - (Date.now() - clientState.windowStart));
  }
  
  /**
   * Get a unique identifier for the client
   * 
   * @param req - Request object
   * @returns Client identifier
   * @private
   */
  private getClientId(req: Request): string {
    // Use X-Forwarded-For header if available and trusted
    // Otherwise use the remote address
    const clientIp = (req.headers['x-forwarded-for'] as string | undefined) || req.socket.remoteAddress || '';
    
    // Combine with user agent if available
    const userAgent = req.headers['user-agent'] || '';
    
    // Create a hash of the combined values
    return crypto
      .createHash('sha256')
      .update(`${clientIp}:${userAgent}`)
      .digest('hex');
  }
  
  /**
   * Validate CSRF token
   * 
   * @param req - Request object
   * @returns True if CSRF token is valid
   * @private
   */
  private validateCSRF(req: Request): boolean {
    // Skip for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return true;
    }
    
    // Get CSRF token from request
    const requestToken = (req.headers['x-csrf-token'] as string | undefined) || 
                        (req.body && req.body._csrf) || 
                        (req.query && req.query._csrf);
    
    // Get session token
    const sessionToken = req.session && (req.session as any).csrfToken;
    
    // Validate token
    return Boolean(requestToken && sessionToken && requestToken === sessionToken);
  }
  
  /**
   * Validate request input
   * 
   * @param req - Request object
   * @throws {ValidationError} If validation fails
   * @private
   */
  protected validateInput(req: Request): void {
    // This should be implemented by subclasses
    // Default implementation does nothing
  }
  
  /**
   * Format error response
   * 
   * @param error - Error object
   * @returns Formatted error response
   * @private
   */
  private formatErrorResponse(error: unknown): { 
    message: string; 
    code: string; 
    status: number;
    component?: string; 
  } {
    // For framework errors, use their properties
    if (isClaudeError(error)) {
      return {
        message: error.message,
        code: error.type,
        status: error.statusCode,
        component: 'api'
      };
    }
    
    // For other errors, provide a generic response
    return {
      message: error instanceof Error ? error.message : this.i18n.translate('errors.unexpectedError'),
      code: 'ERR_UNKNOWN',
      status: 500
    };
  }
  
  /**
   * Generate a secure random token
   * 
   * @param bytes - Number of random bytes
   * @returns Random token
   */
  public async generateSecureToken(bytes: number = 32): Promise<string> {
    const buffer = await randomBytes(bytes);
    return buffer.toString('hex');
  }
  
  /**
   * Hash a password securely
   * 
   * @param password - Password to hash
   * @param salt - Optional salt (generated if not provided)
   * @returns Hashed password and salt
   */
  public async hashPassword(password: string, salt?: string | null): Promise<PasswordHashResult> {
    // Generate salt if not provided
    if (!salt) {
      const saltBuffer = await randomBytes(16);
      salt = saltBuffer.toString('hex');
    }
    
    // Hash password with scrypt
    const derivedKey = await scrypt(password, salt, 64) as Buffer;
    
    return {
      hash: derivedKey.toString('hex'),
      salt
    };
  }
  
  /**
   * Verify a password against a hash
   * 
   * @param password - Password to verify
   * @param hash - Stored password hash
   * @param salt - Salt used for hashing
   * @returns True if password matches
   */
  public async verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
    try {
      // Hash the input password with the same salt
      const { hash: inputHash } = await this.hashPassword(password, salt);
      
      // Compare hashes using constant-time comparison
      return crypto.timingSafeEqual(
        Buffer.from(inputHash, 'hex'),
        Buffer.from(hash, 'hex')
      );
    } catch (error) {
      this.logger.error('Password verification failed', { error });
      return false;
    }
  }
  
  /**
   * Create a middleware for Express applications
   * 
   * @returns Express middleware function
   */
  public createMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Apply security headers
        if (this.options.secureHeaders) {
          this.applySecurityHeaders(res);
        }
        
        // Check rate limit
        if (!this.checkRateLimit(req)) {
          throw new ValidationError(this.i18n.translate('errors.rateLimitExceeded'), {
            details: {
              retryAfter: this.getRateLimitReset(req)
            },
            statusCode: 429
          });
        }
        
        // Check HTTPS requirement
        if (this.options.requireHTTPS && !req.secure) {
          throw new ValidationError(this.i18n.translate('errors.httpsRequired'));
        }
        
        // Validate CSRF token for non-safe methods
        if (this.options.csrfProtection && !this.validateCSRF(req)) {
          throw new ValidationError(this.i18n.translate('errors.invalidCsrfToken'), {
            details: {},
            statusCode: 403
          });
        }
        
        // Validate input if needed
        if (this.options.inputValidation) {
          this.validateInput(req);
        }
        
        // Proceed to next middleware if all checks pass
        next();
      } catch (error) {
        // Handle errors
        const formattedError = this.formatErrorResponse(error);
        
        // Send error response
        res.status(formattedError.status || 500).json({
          error: formattedError
        });
      }
    };
  }
}

export default SecureAPI;