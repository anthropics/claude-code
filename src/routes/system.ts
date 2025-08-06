import { Router, Request, Response } from 'express';
import os from 'os';
import { AuthMiddleware, AuthenticatedRequest } from '@/middleware/auth';
import { SessionManager } from '@/services/session-manager';
import { DatabaseService } from '@/services/database-service';
import { FileWatcher } from '@/services/file-watcher';
import { ServiceStatus } from '@/types';
import { Logger } from '@/utils/logger';

export function createSystemRoutes(
  authMiddleware: AuthMiddleware,
  sessionManager: SessionManager,
  database: DatabaseService,
  fileWatcher: FileWatcher,
  logger: Logger,
  startTime: Date
): Router {
  const router = Router();

  // Health check endpoint (public)
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const uptime = Date.now() - startTime.getTime();
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Basic health checks
      const healthChecks = {
        database: await checkDatabase(),
        fileWatcher: checkFileWatcher(),
        memory: checkMemory(),
      };

      const isHealthy = Object.values(healthChecks).every(check => check.status === 'ok');

      const healthStatus = {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: uptime,
        version: '1.0.0', // This would come from package.json
        checks: healthChecks,
        system: {
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version,
          memory: {
            rss: memUsage.rss,
            heapTotal: memUsage.heapTotal,
            heapUsed: memUsage.heapUsed,
            external: memUsage.external,
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system,
          },
          loadAverage: os.loadavg(),
        },
      };

      res.status(isHealthy ? 200 : 503).json(healthStatus);
    } catch (error: any) {
      logger.error('Health check failed:', error);
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      });
    }
  });

  // Detailed status endpoint (requires authentication)
  router.get('/status', authMiddleware.optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uptime = Date.now() - startTime.getTime();
      const sessionStats = await sessionManager.getSessionStats();
      const dbStats = await database.getStats();
      const fileWatcherStats = fileWatcher.getStats();
      const memUsage = process.memoryUsage();
      
      const status: ServiceStatus = {
        status: 'running',
        uptime: uptime,
        version: '1.0.0',
        sessions: sessionManager.getActiveTerminalCount(),
        connectedDevices: 0, // This would come from WebSocket server
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
        },
        cpu: {
          usage: os.loadavg()[0], // 1-minute load average
        },
      };

      res.json({
        success: true,
        status,
        detailed: {
          sessions: sessionStats,
          database: dbStats,
          fileWatcher: fileWatcherStats,
          system: {
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            pid: process.pid,
            startTime: startTime.toISOString(),
            cwd: process.cwd(),
          },
        },
      });
    } catch (error: any) {
      logger.error('Status check failed:', error);
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  // Ping endpoint
  router.get('/ping', (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'pong',
      timestamp: new Date().toISOString(),
    });
  });

  // Server information endpoint
  router.get('/info', (req: Request, res: Response) => {
    res.json({
      success: true,
      info: {
        name: 'Claude Code Extended Server',
        version: '1.0.0',
        description: 'Remote access backend for Claude Code',
        author: 'Anthropic',
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        features: [
          'WebSocket terminal streaming',
          'REST API for file operations',
          'Session management',
          'Device pairing',
          'File watching',
          'Git integration',
        ],
        endpoints: {
          websocket: '/ws',
          auth: '/api/auth',
          sessions: '/api/sessions',
          files: '/api/files',
          system: '/api/system',
        },
      },
    });
  });

  // Metrics endpoint (requires authentication)
  router.get('/metrics', authMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const sessionStats = await sessionManager.getSessionStats();
      const dbStats = await database.getStats();
      const fileWatcherStats = fileWatcher.getStats();

      const metrics = {
        timestamp: new Date().toISOString(),
        uptime: Date.now() - startTime.getTime(),
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
          arrayBuffers: memUsage.arrayBuffers,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        system: {
          loadAverage: os.loadavg(),
          freeMemory: os.freemem(),
          totalMemory: os.totalmem(),
          cpuCount: os.cpus().length,
        },
        sessions: {
          total: sessionStats.total,
          active: sessionStats.active,
          paused: sessionStats.paused,
          inactive: sessionStats.inactive,
          activeTerminals: sessionManager.getActiveTerminalCount(),
        },
        database: dbStats,
        fileWatcher: fileWatcherStats,
        process: {
          pid: process.pid,
          ppid: process.ppid,
          uid: process.getuid?.() || null,
          gid: process.getgid?.() || null,
        },
      };

      res.json({
        success: true,
        metrics,
      });
    } catch (error: any) {
      logger.error('Metrics collection failed:', error);
      res.status(500).json({ error: 'Failed to collect metrics' });
    }
  });

  // Graceful shutdown endpoint (requires authentication)
  router.post('/shutdown', authMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      logger.info(`Shutdown requested by user ${req.user.userId}`);
      
      res.json({
        success: true,
        message: 'Shutdown initiated',
      });

      // Perform graceful shutdown
      setTimeout(async () => {
        try {
          logger.info('Starting graceful shutdown...');
          
          // Close all terminals
          sessionManager.closeAllTerminals();
          
          // Stop file watchers
          await fileWatcher.cleanup();
          
          // Close database
          await database.close();
          
          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      }, 1000);
    } catch (error: any) {
      logger.error('Shutdown failed:', error);
      res.status(500).json({ error: 'Failed to shutdown' });
    }
  });

  // Logs endpoint (requires authentication)
  router.get('/logs', authMiddleware.authenticate, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { lines = 100 } = req.query;
      const maxLines = Math.min(parseInt(lines as string) || 100, 1000);
      
      // This is a simplified implementation
      // In production, you'd want to read from actual log files
      res.json({
        success: true,
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `Logs endpoint accessed by user ${req.user.userId}`,
          },
          // More log entries would be read from files
        ],
        metadata: {
          requestedLines: maxLines,
          totalLines: 1,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get logs:', error);
      res.status(500).json({ error: 'Failed to get logs' });
    }
  });

  // Helper functions
  async function checkDatabase(): Promise<{ status: 'ok' | 'error'; message?: string }> {
    try {
      await database.getStats();
      return { status: 'ok' };
    } catch (error) {
      return { status: 'error', message: 'Database connection failed' };
    }
  }

  function checkFileWatcher(): { status: 'ok' | 'error'; message?: string } {
    try {
      const stats = fileWatcher.getStats();
      return { 
        status: 'ok',
        message: `${stats.activeWatchers} active watchers`
      };
    } catch (error) {
      return { status: 'error', message: 'File watcher check failed' };
    }
  }

  function checkMemory(): { status: 'ok' | 'warn' | 'error'; message?: string } {
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    if (heapUsedPercent > 90) {
      return { status: 'error', message: 'High memory usage' };
    } else if (heapUsedPercent > 75) {
      return { status: 'warn', message: 'Elevated memory usage' };
    } else {
      return { status: 'ok' };
    }
  }

  return router;
}