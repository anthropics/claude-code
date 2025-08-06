#!/usr/bin/env node

import express from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { ConfigManager } from '@/utils/config';
import { Logger } from '@/utils/logger';
import { DatabaseService } from '@/services/database-service';
import { SessionManager } from '@/services/session-manager';
import { AuthService } from '@/services/auth-service';
import { FileWatcher } from '@/services/file-watcher';
import { WebSocketServer } from '@/websocket/websocket-server';
import { AuthMiddleware, createRateLimitMiddleware, errorHandler, requestLogger } from '@/middleware/auth';

// Routes
import { createAuthRoutes } from '@/routes/auth';
import { createSessionRoutes } from '@/routes/sessions';
import { createFileRoutes } from '@/routes/files';
import { createSystemRoutes } from '@/routes/system';

class ClaudeCodeServer {
  private app!: express.Application;
  private server!: http.Server | https.Server;
  private config: ConfigManager;
  private logger!: Logger;
  private database!: DatabaseService;
  private sessionManager!: SessionManager;
  private authService!: AuthService;
  private fileWatcher!: FileWatcher;
  private webSocketServer!: WebSocketServer;
  private authMiddleware!: AuthMiddleware;
  private startTime: Date = new Date();
  private isShuttingDown = false;

  constructor() {
    this.config = ConfigManager.getInstance();
    this.initializeLogger();
    this.initializeApp();
  }

  private initializeLogger(): void {
    const config = this.config.getConfig();
    this.logger = new Logger(config.logging.level, config.logging.file);
    this.logger.info('Claude Code Extended Server starting...');
  }

  private initializeApp(): void {
    this.app = express();

    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        // Allow localhost and development origins
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          'https://localhost:3000',
          'https://localhost:3001',
        ];

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Compression
    this.app.use(compression());

    // Request parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use(requestLogger(this.logger));

    // Rate limiting
    const config = this.config.getConfig();
    this.app.use(createRateLimitMiddleware(config.rateLimiting.windowMs, config.rateLimiting.max));
  }

  private async initializeServices(): Promise<void> {
    const config = ConfigManager.applyEnvironmentOverrides(this.config.getConfig());

    try {
      // Initialize database
      this.database = new DatabaseService(config.database.path, this.logger);
      await this.database.initialize();

      // Initialize file watcher
      this.fileWatcher = new FileWatcher(this.logger);

      // Initialize session manager
      this.sessionManager = new SessionManager(this.database, this.logger);

      // Initialize auth service
      this.authService = new AuthService(
        this.database,
        this.logger,
        config.auth.jwtSecret,
        config.auth.sessionTimeout,
        config.auth.maxDevicesPerUser
      );

      // Initialize auth middleware
      this.authMiddleware = new AuthMiddleware(this.authService, this.logger);

      this.logger.info('All services initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api/auth', createAuthRoutes(this.authService, this.authMiddleware, this.logger));
    this.app.use('/api/sessions', createSessionRoutes(this.sessionManager, this.authMiddleware, this.logger));
    this.app.use('/api/files', createFileRoutes(this.authMiddleware, this.fileWatcher, this.logger));
    this.app.use('/api/system', createSystemRoutes(
      this.authMiddleware,
      this.sessionManager,
      this.database,
      this.fileWatcher,
      this.logger,
      this.startTime
    ));

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Claude Code Extended Server',
        version: '1.0.0',
        status: 'running',
        uptime: Date.now() - this.startTime.getTime(),
        endpoints: {
          websocket: '/ws',
          auth: '/api/auth',
          sessions: '/api/sessions',
          files: '/api/files',
          system: '/api/system',
        },
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
      });
    });

    // Error handler (must be last)
    this.app.use(errorHandler(this.logger));
  }

  private createServer(): void {
    const config = this.config.getConfig();

    if (config.ssl.enabled && config.ssl.cert && config.ssl.key) {
      const options = {
        cert: fs.readFileSync(config.ssl.cert),
        key: fs.readFileSync(config.ssl.key),
      };
      this.server = https.createServer(options, this.app);
      this.logger.info('HTTPS server created');
    } else {
      this.server = http.createServer(this.app);
      this.logger.info('HTTP server created');
    }
  }

  private setupWebSocket(): void {
    this.webSocketServer = new WebSocketServer(
      this.server,
      this.sessionManager,
      this.authService,
      this.fileWatcher,
      this.logger,
      this.config.getConfig().auth.jwtSecret
    );

    this.logger.info('WebSocket server initialized');
  }

  private setupSignalHandlers(): void {
    const signals = ['SIGINT', 'SIGTERM'];

    signals.forEach(signal => {
      process.on(signal, async () => {
        if (this.isShuttingDown) {
          this.logger.warn(`Received ${signal} during shutdown, forcing exit`);
          process.exit(1);
        }

        this.isShuttingDown = true;
        this.logger.info(`Received ${signal}, starting graceful shutdown...`);

        try {
          await this.gracefulShutdown();
        } catch (error) {
          this.logger.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error(`Unhandled Rejection at: ${promise.toString()}, reason: ${reason}`);
      process.exit(1);
    });
  }

  private async gracefulShutdown(): Promise<void> {
    const shutdownTimeout = 10000; // 10 seconds

    const shutdownPromise = (async () => {
      try {
        this.logger.info('Closing WebSocket server...');
        this.webSocketServer?.close();

        this.logger.info('Closing terminals...');
        this.sessionManager?.closeAllTerminals();

        this.logger.info('Stopping file watchers...');
        await this.fileWatcher?.cleanup();

        this.logger.info('Closing database...');
        await this.database?.close();

        this.logger.info('Closing HTTP server...');
        await new Promise<void>((resolve, reject) => {
          this.server.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        this.logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    })();

    // Force shutdown if graceful shutdown takes too long
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Shutdown timeout'));
      }, shutdownTimeout);
    });

    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
    } catch (error) {
      this.logger.error('Shutdown timeout, forcing exit');
      process.exit(1);
    }
  }

  public async start(): Promise<void> {
    try {
      await this.initializeServices();
      this.setupRoutes();
      this.createServer();
      this.setupWebSocket();
      this.setupSignalHandlers();

      const config = this.config.getConfig();
      
      await new Promise<void>((resolve, reject) => {
        this.server.listen(config.port, config.host, (err?: Error) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      const protocol = config.ssl.enabled ? 'https' : 'http';
      this.logger.info(`Server running on ${protocol}://${config.host}:${config.port}`);
      this.logger.info('WebSocket endpoint available at /ws');
      
      // Start cleanup tasks
      this.startPeriodicTasks();

    } catch (error) {
      this.logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private startPeriodicTasks(): void {
    // Cleanup inactive sessions every hour
    setInterval(async () => {
      try {
        await this.sessionManager.cleanupInactiveSessions(60); // 60 minutes
        this.logger.debug('Completed session cleanup');
      } catch (error) {
        this.logger.error('Session cleanup failed:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    // Database maintenance every day
    setInterval(async () => {
      try {
        const cleaned = await this.database.cleanupOldSessions(30); // 30 days
        if (cleaned > 0) {
          this.logger.info(`Cleaned up ${cleaned} old sessions from database`);
        }
        
        await this.database.vacuum();
        this.logger.debug('Database maintenance completed');
      } catch (error) {
        this.logger.error('Database maintenance failed:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new ClaudeCodeServer();
  server.start().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default ClaudeCodeServer;