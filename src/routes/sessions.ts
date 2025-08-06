import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SessionManager } from '@/services/session-manager';
import { AuthMiddleware, AuthenticatedRequest } from '@/middleware/auth';
import { Logger } from '@/utils/logger';

const createSessionSchema = z.object({
  workingDirectory: z.string().optional(),
  settings: z.object({
    shell: z.string().optional(),
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    fontSize: z.number().min(8).max(72).optional(),
    fontFamily: z.string().optional(),
    autoSave: z.boolean().optional(),
    notifications: z.boolean().optional(),
  }).optional(),
});

const resizeTerminalSchema = z.object({
  cols: z.number().min(1).max(1000),
  rows: z.number().min(1).max(1000),
});

export function createSessionRoutes(
  sessionManager: SessionManager,
  authMiddleware: AuthMiddleware,
  logger: Logger
): Router {
  const router = Router();

  // Apply authentication to all session routes
  router.use(authMiddleware.authenticate);
  router.use(authMiddleware.requirePermission('sessions', 'read'));

  // Get all user sessions
  router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sessions = await sessionManager.getUserSessions(req.user.userId);
      
      res.json({
        success: true,
        sessions: sessions.map(session => ({
          id: session.id,
          deviceId: session.deviceId,
          workingDirectory: session.workingDirectory,
          status: session.status,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          settings: session.settings,
        })),
      });
    } catch (error: any) {
      logger.error('Failed to get user sessions:', error);
      res.status(500).json({ error: 'Failed to get sessions' });
    }
  });

  // Create new session
  router.post('/', authMiddleware.requirePermission('sessions', 'create'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { workingDirectory, settings } = createSessionSchema.parse(req.body);
      
      const session = await sessionManager.createSession(
        req.user.userId,
        req.user.deviceId,
        workingDirectory,
        settings
      );
      
      logger.info(`Session created: ${session.id} for user ${req.user.userId}`);
      
      res.status(201).json({
        success: true,
        session: {
          id: session.id,
          deviceId: session.deviceId,
          workingDirectory: session.workingDirectory,
          status: session.status,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          settings: session.settings,
        },
      });
    } catch (error: any) {
      logger.error('Failed to create session:', error);
      
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Invalid session data' });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // Get specific session
  router.get('/:sessionId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const session = await sessionManager.getSession(sessionId);
      
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Verify session belongs to user
      if (session.userId !== req.user.userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      res.json({
        success: true,
        session: {
          id: session.id,
          deviceId: session.deviceId,
          workingDirectory: session.workingDirectory,
          status: session.status,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          settings: session.settings,
          environment: session.environment,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get session:', error);
      res.status(500).json({ error: 'Failed to get session' });
    }
  });

  // Resume session
  router.post('/:sessionId/resume', authMiddleware.requirePermission('sessions', 'update'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const session = await sessionManager.getSession(sessionId);
      
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Verify session belongs to user
      if (session.userId !== req.user.userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const resumedSession = await sessionManager.resumeSession(sessionId);
      
      logger.info(`Session resumed: ${sessionId} by user ${req.user.userId}`);
      
      res.json({
        success: true,
        session: {
          id: resumedSession.id,
          deviceId: resumedSession.deviceId,
          workingDirectory: resumedSession.workingDirectory,
          status: resumedSession.status,
          createdAt: resumedSession.createdAt,
          lastActivity: resumedSession.lastActivity,
          settings: resumedSession.settings,
        },
      });
    } catch (error: any) {
      logger.error('Failed to resume session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Pause session
  router.post('/:sessionId/pause', authMiddleware.requirePermission('sessions', 'update'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const session = await sessionManager.getSession(sessionId);
      
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Verify session belongs to user
      if (session.userId !== req.user.userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      await sessionManager.pauseSession(sessionId);
      
      logger.info(`Session paused: ${sessionId} by user ${req.user.userId}`);
      
      res.json({
        success: true,
        message: 'Session paused successfully',
      });
    } catch (error: any) {
      logger.error('Failed to pause session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Terminate session
  router.delete('/:sessionId', authMiddleware.requirePermission('sessions', 'delete'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const session = await sessionManager.getSession(sessionId);
      
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Verify session belongs to user
      if (session.userId !== req.user.userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      await sessionManager.terminateSession(sessionId);
      
      logger.info(`Session terminated: ${sessionId} by user ${req.user.userId}`);
      
      res.json({
        success: true,
        message: 'Session terminated successfully',
      });
    } catch (error: any) {
      logger.error('Failed to terminate session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Resize terminal
  router.post('/:sessionId/resize', authMiddleware.requirePermission('terminal', 'write'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { cols, rows } = resizeTerminalSchema.parse(req.body);
      
      const session = await sessionManager.getSession(sessionId);
      
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Verify session belongs to user
      if (session.userId !== req.user.userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      await sessionManager.resizeTerminal(sessionId, cols, rows);
      
      logger.debug(`Terminal resized: ${sessionId} to ${cols}x${rows}`);
      
      res.json({
        success: true,
        message: 'Terminal resized successfully',
      });
    } catch (error: any) {
      logger.error('Failed to resize terminal:', error);
      
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Invalid resize parameters' });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // Send input to terminal
  router.post('/:sessionId/input', authMiddleware.requirePermission('terminal', 'write'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { data } = req.body;
      
      if (typeof data !== 'string') {
        res.status(400).json({ error: 'Input data must be a string' });
        return;
      }

      const session = await sessionManager.getSession(sessionId);
      
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Verify session belongs to user
      if (session.userId !== req.user.userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      await sessionManager.writeToTerminal(sessionId, data);
      
      res.json({
        success: true,
        message: 'Input sent to terminal',
      });
    } catch (error: any) {
      logger.error('Failed to send terminal input:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get session statistics
  router.get('/stats/overview', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userSessions = await sessionManager.getUserSessions(req.user.userId);
      const activeTerminals = sessionManager.getActiveTerminalCount();
      const sessionStats = await sessionManager.getSessionStats();
      
      res.json({
        success: true,
        stats: {
          userSessions: {
            total: userSessions.length,
            active: userSessions.filter(s => s.status === 'active').length,
            paused: userSessions.filter(s => s.status === 'paused').length,
            inactive: userSessions.filter(s => s.status === 'inactive').length,
          },
          globalStats: {
            activeTerminals,
            totalSessions: sessionStats.total,
            activeSessions: sessionStats.active,
            pausedSessions: sessionStats.paused,
            inactiveSessions: sessionStats.inactive,
          },
        },
      });
    } catch (error: any) {
      logger.error('Failed to get session stats:', error);
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  });

  return router;
}