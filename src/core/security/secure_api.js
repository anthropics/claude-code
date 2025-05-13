/**
 * Secure API Implementation Example
 * 
 * This module demonstrates secure API implementation patterns for the Claude Neural Framework.
 * It should be used as a reference for implementing secure APIs within the framework.
 */

const crypto = require('crypto');
const { promisify } = require('util');
const randomBytes = promisify(crypto.randomBytes);
const scrypt = promisify(crypto.scrypt);

// Import standardized config manager
const configManager = require('../config/config_manager');
const { CONFIG_TYPES } = configManager;

// Import standardized logger
const logger = require('../logging/logger').createLogger('secure-api');

// Import error handler
const { ValidationError, FrameworkError } = require('../error/error_handler');

// Import internationalization
const { I18n } = require('../i18n/i18n');

/**
 * Secure API base class with security best practices
 */
class SecureAPI {
  /**
   * Create a new secure API instance
   * 
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
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
      ...options
    };
    
    // Initialize rate limiting state
    this.rateLimitState = new Map();
    
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
    
    logger.info(this.i18n.translate('security.apiInitialized'), {
      options: this.options
    });
  }
  
  /**
   * Apply security middleware to a request handler
   * 
   * @param {Function} handler - Request handler function
   * @returns {Function} Secured request handler
   */
  secureHandler(handler) {
    return async (req, res, ...args) => {
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
            status: 429,
            metadata: {
              retryAfter: this.getRateLimitReset(req)
            }
          });
        }
        
        // Validate CSRF token
        if (this.options.csrfProtection && !this.validateCSRF(req)) {
          throw new ValidationError(this.i18n.translate('errors.invalidCsrfToken'), {
            status: 403
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
        logger.error(this.i18n.translate('errors.requestError'), { error });
        
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
   * @param {Object} res - Response object
   * @private
   */
  applySecurityHeaders(res) {
    Object.entries(this.securityHeaders).forEach(([header, value]) => {
      res.setHeader(header, value);
    });
  }
  
  /**
   * Check rate limiting for request
   * 
   * @param {Object} req - Request object
   * @returns {boolean} True if request is within rate limits
   * @private
   */
  checkRateLimit(req) {
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
    if (now - clientState.windowStart > this.options.rateLimitWindowMs) {
      clientState.requests = 0;
      clientState.windowStart = now;
    }
    
    // Increment request count
    clientState.requests++;
    
    // Check if over limit
    return clientState.requests <= this.options.rateLimitRequests;
  }
  
  /**
   * Get when rate limit will reset for a client
   * 
   * @param {Object} req - Request object
   * @returns {number} Milliseconds until rate limit reset
   * @private
   */
  getRateLimitReset(req) {
    const clientId = this.getClientId(req);
    const clientState = this.rateLimitState.get(clientId);
    
    if (!clientState) {
      return 0;
    }
    
    return Math.max(0, this.options.rateLimitWindowMs - (Date.now() - clientState.windowStart));
  }
  
  /**
   * Get a unique identifier for the client
   * 
   * @param {Object} req - Request object
   * @returns {string} Client identifier
   * @private
   */
  getClientId(req) {
    // Use X-Forwarded-For header if available and trusted
    // Otherwise use the remote address
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
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
   * @param {Object} req - Request object
   * @returns {boolean} True if CSRF token is valid
   * @private
   */
  validateCSRF(req) {
    // Skip for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return true;
    }
    
    // Get CSRF token from request
    const requestToken = req.headers['x-csrf-token'] || 
                         (req.body && req.body._csrf) || 
                         (req.query && req.query._csrf);
    
    // Get session token
    const sessionToken = req.session && req.session.csrfToken;
    
    // Validate token
    return requestToken && sessionToken && requestToken === sessionToken;
  }
  
  /**
   * Validate request input
   * 
   * @param {Object} req - Request object
   * @throws {ValidationError} If validation fails
   * @private
   */
  validateInput(req) {
    // This should be implemented by subclasses
    // Default implementation does nothing
  }
  
  /**
   * Format error response
   * 
   * @param {Error} error - Error object
   * @returns {Object} Formatted error response
   * @private
   */
  formatErrorResponse(error) {
    // For framework errors, use their properties
    if (error instanceof FrameworkError) {
      return {
        message: error.message,
        code: error.code,
        status: error.status,
        component: error.component
      };
    }
    
    // For other errors, provide a generic response
    return {
      message: error.message || this.i18n.translate('errors.unexpectedError'),
      code: 'ERR_UNKNOWN',
      status: 500
    };
  }
  
  /**
   * Generate a secure random token
   * 
   * @param {number} [bytes=32] - Number of random bytes
   * @returns {Promise<string>} Random token
   */
  async generateSecureToken(bytes = 32) {
    const buffer = await randomBytes(bytes);
    return buffer.toString('hex');
  }
  
  /**
   * Hash a password securely
   * 
   * @param {string} password - Password to hash
   * @param {string} [salt] - Optional salt (generated if not provided)
   * @returns {Promise<Object>} Hashed password and salt
   */
  async hashPassword(password, salt = null) {
    // Generate salt if not provided
    if (!salt) {
      const saltBuffer = await randomBytes(16);
      salt = saltBuffer.toString('hex');
    }
    
    // Hash password with scrypt
    const derivedKey = await scrypt(password, salt, 64);
    
    return {
      hash: derivedKey.toString('hex'),
      salt
    };
  }
  
  /**
   * Verify a password against a hash
   * 
   * @param {string} password - Password to verify
   * @param {string} hash - Stored password hash
   * @param {string} salt - Salt used for hashing
   * @returns {Promise<boolean>} True if password matches
   */
  async verifyPassword(password, hash, salt) {
    // Hash the input password with the same salt
    const { hash: inputHash } = await this.hashPassword(password, salt);
    
    // Compare hashes using constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(inputHash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  }
}

module.exports = {
  SecureAPI
};