import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/services/auth-service';
import { AuthenticationError, AuthorizationError } from '@/types';
import { Logger } from '@/utils/logger';

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    deviceId: string;
    sessionId?: string;
  };
}

export class AuthMiddleware {
  private authService: AuthService;
  private logger: Logger;

  constructor(authService: AuthService, logger: Logger) {
    this.authService = authService;
    this.logger = logger;
  }

  // Middleware to authenticate JWT tokens
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        res.status(401).json({ error: 'Authorization header missing' });
        return;
      }

      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;

      if (!token) {
        res.status(401).json({ error: 'Token missing' });
        return;
      }

      const authToken = await this.authService.verifyToken(token);
      
      // Attach user info to request
      (req as AuthenticatedRequest).user = {
        userId: authToken.userId,
        deviceId: authToken.deviceId,
        sessionId: authToken.sessionId,
      };

      // Update device last seen
      await this.authService.updateDeviceLastSeen(authToken.userId, authToken.deviceId);

      next();
    } catch (error) {
      this.logger.warn('Authentication failed:', error);
      
      if (error instanceof AuthenticationError) {
        res.status(401).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Authentication error' });
      }
    }
  };

  // Middleware to check specific permissions
  requirePermission = (resource: string, action: string) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const authReq = req as AuthenticatedRequest;
        
        if (!authReq.user) {
          res.status(401).json({ error: 'Not authenticated' });
          return;
        }

        // For now, we'll implement basic permission checking
        // In a production system, this would check against user roles/permissions
        const hasPermission = this.checkPermission(authReq.user, resource, action);
        
        if (!hasPermission) {
          res.status(403).json({ error: `Insufficient permissions for ${action} on ${resource}` });
          return;
        }

        next();
      } catch (error) {
        this.logger.error('Permission check failed:', error);
        res.status(500).json({ error: 'Authorization error' });
      }
    };
  };

  // Optional authentication - don't fail if no token provided
  optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader) {
        const token = authHeader.startsWith('Bearer ') 
          ? authHeader.slice(7) 
          : authHeader;

        if (token) {
          try {
            const authToken = await this.authService.verifyToken(token);
            
            (req as AuthenticatedRequest).user = {
              userId: authToken.userId,
              deviceId: authToken.deviceId,
              sessionId: authToken.sessionId,
            };

            await this.authService.updateDeviceLastSeen(authToken.userId, authToken.deviceId);
          } catch (error) {
            // Ignore authentication errors for optional auth
            this.logger.debug('Optional authentication failed:', error);
          }
        }
      }

      next();
    } catch (error) {
      this.logger.error('Optional auth middleware error:', error);
      next(); // Continue even if there's an error
    }
  };

  private checkPermission(user: { userId: string; deviceId: string; sessionId?: string }, resource: string, action: string): boolean {
    // Basic permission system - all authenticated users have access to basic resources
    const allowedResources = ['sessions', 'files', 'terminal', 'user'];
    const allowedActions = ['create', 'read', 'update', 'delete', 'write', 'watch'];

    return allowedResources.includes(resource) && allowedActions.includes(action);
  }
}

// Rate limiting middleware
export const createRateLimitMiddleware = (windowMs: number, max: number) => {
  const { RateLimiterMemory } = require('rate-limiter-flexible');
  
  const rateLimiter = new RateLimiterMemory({
    keyPrefix: 'claude_api',
    points: max, // Number of requests
    duration: Math.floor(windowMs / 1000), // Per duration in seconds
  });

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = req.ip;
      await rateLimiter.consume(key);
      next();
    } catch (rejRes: any) {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.round(rejRes.msBeforeNext) || 1000,
      });
    }
  };
};

// Error handling middleware
export const errorHandler = (logger: Logger) => {
  return (error: any, req: Request, res: Response, next: NextFunction): void => {
    logger.error('API Error:', error);

    // Handle specific error types
    if (error instanceof AuthenticationError) {
      res.status(401).json({ error: error.message });
      return;
    }

    if (error instanceof AuthorizationError) {
      res.status(403).json({ error: error.message });
      return;
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      res.status(400).json({ error: error.message });
      return;
    }

    // Handle JWT errors
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expired' });
      return;
    }

    // Default error response
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  };
};

// Request logging middleware
export const requestLogger = (logger: Logger) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.userId || 'anonymous';
      
      logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - User: ${userId}`);
    });

    next();
  };
};