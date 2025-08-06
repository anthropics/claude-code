import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '@/services/auth-service';
import { AuthMiddleware, AuthenticatedRequest } from '@/middleware/auth';
import { Logger } from '@/utils/logger';

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
});

const registerSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
  email: z.string().email().optional(),
});

const pairingRequestSchema = z.object({
  deviceName: z.string().min(1),
  deviceType: z.enum(['mobile', 'desktop', 'tablet']),
  platform: z.string().min(1),
  userAgent: z.string().min(1),
  publicKey: z.string().optional(),
});

const pairingCompleteSchema = z.object({
  pairingId: z.string().uuid(),
  pairingCode: z.string().length(6),
});

export function createAuthRoutes(
  authService: AuthService,
  authMiddleware: AuthMiddleware,
  logger: Logger
): Router {
  const router = Router();

  // Register new user
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { username, password, email } = registerSchema.parse(req.body);
      
      const user = await authService.createUser(username, password, email);
      
      logger.info(`New user registered: ${username}`);
      
      res.status(201).json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt,
        },
      });
    } catch (error: any) {
      logger.warn('Registration failed:', error);
      
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Invalid input data' });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  });

  // User login
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      const user = await authService.authenticateUser(username, password);
      
      logger.info(`User login: ${username}`);
      
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          devices: user.devices.map(device => ({
            id: device.id,
            name: device.name,
            type: device.type,
            platform: device.platform,
            lastSeen: device.lastSeen,
            trusted: device.trusted,
          })),
        },
      });
    } catch (error: any) {
      logger.warn('Login failed:', error);
      
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Invalid input data' });
      } else {
        res.status(401).json({ error: error.message });
      }
    }
  });

  // Start device pairing
  router.post('/pair/start', authMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const deviceInfo = pairingRequestSchema.parse(req.body);
      
      const pairingResponse = await authService.startPairing(req.user.userId, deviceInfo as any);
      
      if (pairingResponse.success) {
        logger.info(`Pairing started for user ${req.user.userId}, device: ${deviceInfo.deviceName}`);
      }
      
      res.json(pairingResponse);
    } catch (error: any) {
      logger.error('Failed to start pairing:', error);
      
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Invalid device information' });
      } else {
        res.status(500).json({ error: 'Failed to start pairing' });
      }
    }
  });

  // Complete device pairing
  router.post('/pair/complete', async (req: Request, res: Response) => {
    try {
      const { pairingId, pairingCode } = pairingCompleteSchema.parse(req.body);
      
      const result = await authService.completePairing(pairingId, pairingCode);
      
      logger.info(`Device pairing completed: ${result.device.name}`);
      
      res.json({
        success: true,
        token: result.token,
        device: {
          id: result.device.id,
          name: result.device.name,
          type: result.device.type,
          platform: result.device.platform,
          trusted: result.device.trusted,
        },
      });
    } catch (error: any) {
      logger.warn('Pairing completion failed:', error);
      
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Invalid pairing data' });
      } else {
        res.status(401).json({ error: error.message });
      }
    }
  });

  // Generate token for existing device
  router.post('/token', authMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { deviceId, sessionId } = req.body;
      
      // Verify deviceId belongs to user
      const devices = await authService.getUserDevices(req.user.userId);
      const device = devices.find(d => d.id === deviceId);
      
      if (!device) {
        res.status(404).json({ error: 'Device not found' });
        return;
      }

      const token = await authService.generateToken(
        req.user.userId,
        deviceId,
        sessionId
      );
      
      logger.info(`Token generated for user ${req.user.userId}, device ${deviceId}`);
      
      res.json({
        success: true,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });
    } catch (error: any) {
      logger.error('Token generation failed:', error);
      res.status(500).json({ error: 'Failed to generate token' });
    }
  });

  // Get user profile
  router.get('/profile', authMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const devices = await authService.getUserDevices(req.user.userId);
      
      res.json({
        success: true,
        user: {
          id: req.user.userId,
          devices: devices.map(device => ({
            id: device.id,
            name: device.name,
            type: device.type,
            platform: device.platform,
            lastSeen: device.lastSeen,
            trusted: device.trusted,
          })),
        },
      });
    } catch (error: any) {
      logger.error('Failed to get user profile:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  });

  // Revoke device
  router.delete('/devices/:deviceId', authMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { deviceId } = req.params;
      
      await authService.revokeDevice(req.user.userId, deviceId);
      
      logger.info(`Device revoked: ${deviceId} for user ${req.user.userId}`);
      
      res.json({
        success: true,
        message: 'Device revoked successfully',
      });
    } catch (error: any) {
      logger.error('Failed to revoke device:', error);
      res.status(500).json({ error: 'Failed to revoke device' });
    }
  });

  // Get authentication status
  router.get('/status', authMiddleware.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const authenticated = !!req.user;
    
    res.json({
      authenticated,
      user: authenticated ? {
        userId: req.user.userId,
        deviceId: req.user.deviceId,
        sessionId: req.user.sessionId,
      } : null,
    });
  });

  return router;
}