import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { MessageType, WebSocketMessage, AuthToken, ClaudeSession, TerminalData, FileChangeEvent } from '@/types';
import { SessionManager } from '@/services/session-manager';
import { AuthService } from '@/services/auth-service';
import { FileWatcher } from '@/services/file-watcher';
import { Logger } from '@/utils/logger';

interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  deviceId: string;
  sessionId?: string;
  isAlive: boolean;
  id: string;
}

export class WebSocketServer {
  private wss: WebSocket.Server;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private sessionManager: SessionManager;
  private authService: AuthService;
  private fileWatcher: FileWatcher;
  private logger: Logger;
  private jwtSecret: string;

  constructor(
    server: any,
    sessionManager: SessionManager,
    authService: AuthService,
    fileWatcher: FileWatcher,
    logger: Logger,
    jwtSecret: string
  ) {
    this.sessionManager = sessionManager;
    this.authService = authService;
    this.fileWatcher = fileWatcher;
    this.logger = logger;
    this.jwtSecret = jwtSecret;

    this.wss = new WebSocket.Server({
      server,
      verifyClient: this.verifyClient.bind(this),
    });

    this.setupServer();
    this.startHeartbeat();
  }

  private verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): boolean {
    try {
      const url = parseUrl(info.req.url || '', true);
      const token = url.query.token as string;

      if (!token) {
        this.logger.warn('WebSocket connection rejected: No token provided');
        return false;
      }

      const decoded = jwt.verify(token, this.jwtSecret) as AuthToken;
      if (!decoded.userId || !decoded.deviceId) {
        this.logger.warn('WebSocket connection rejected: Invalid token');
        return false;
      }

      // Store auth info for later use
      (info.req as any).authInfo = decoded;
      return true;
    } catch (error) {
      this.logger.warn('WebSocket connection rejected: Token verification failed', error);
      return false;
    }
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const authInfo = (req as any).authInfo as AuthToken;
      const clientId = uuidv4();

      const authenticatedWs = ws as AuthenticatedWebSocket;
      authenticatedWs.userId = authInfo.userId;
      authenticatedWs.deviceId = authInfo.deviceId;
      authenticatedWs.sessionId = authInfo.sessionId;
      authenticatedWs.isAlive = true;
      authenticatedWs.id = clientId;

      this.clients.set(clientId, authenticatedWs);

      this.logger.info(`WebSocket client connected: ${clientId} (user: ${authInfo.userId}, device: ${authInfo.deviceId})`);

      // Setup message handlers
      authenticatedWs.on('message', (data: WebSocket.RawData) => {
        this.handleMessage(authenticatedWs, data);
      });

      authenticatedWs.on('close', (code: number, reason: Buffer) => {
        this.handleDisconnection(authenticatedWs, code, reason);
      });

      authenticatedWs.on('error', (error: Error) => {
        this.logger.error(`WebSocket error for client ${clientId}:`, error);
      });

      authenticatedWs.on('pong', () => {
        authenticatedWs.isAlive = true;
      });

      // Send initial status
      this.sendMessage(authenticatedWs, {
        type: MessageType.SYSTEM_STATUS,
        data: { status: 'connected', clientId },
        timestamp: new Date(),
      });
    });

    this.wss.on('error', (error: Error) => {
      this.logger.error('WebSocket server error:', error);
    });
  }

  private async handleMessage(client: AuthenticatedWebSocket, data: WebSocket.RawData): Promise<void> {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      
      this.logger.debug(`Received message from ${client.id}:`, message.type);

      switch (message.type) {
        case MessageType.PING:
          this.handlePing(client);
          break;

        case MessageType.SESSION_CREATE:
          await this.handleSessionCreate(client, message.data);
          break;

        case MessageType.SESSION_JOIN:
          await this.handleSessionJoin(client, message.data);
          break;

        case MessageType.SESSION_LEAVE:
          await this.handleSessionLeave(client);
          break;

        case MessageType.SESSION_LIST:
          await this.handleSessionList(client);
          break;

        case MessageType.TERMINAL_INPUT:
          await this.handleTerminalInput(client, message.data);
          break;

        case MessageType.TERMINAL_RESIZE:
          await this.handleTerminalResize(client, message.data);
          break;

        case MessageType.FILE_WATCH:
          await this.handleFileWatch(client, message.data);
          break;

        case MessageType.FILE_UNWATCH:
          await this.handleFileUnwatch(client, message.data);
          break;

        default:
          this.sendError(client, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error(`Error handling message from ${client.id}:`, error);
      this.sendError(client, 'Failed to process message');
    }
  }

  private handlePing(client: AuthenticatedWebSocket): void {
    this.sendMessage(client, {
      type: MessageType.PONG,
      data: { timestamp: new Date() },
      timestamp: new Date(),
    });
  }

  private async handleSessionCreate(client: AuthenticatedWebSocket, data: any): Promise<void> {
    try {
      const session = await this.sessionManager.createSession(
        client.userId,
        client.deviceId,
        data.workingDirectory || process.cwd(),
        data.settings
      );

      client.sessionId = session.id;

      // Setup terminal streaming
      this.sessionManager.onTerminalOutput(session.id, (output: string) => {
        this.sendMessage(client, {
          type: MessageType.TERMINAL_OUTPUT,
          sessionId: session.id,
          data: { data: output },
          timestamp: new Date(),
        });
      });

      this.sendMessage(client, {
        type: MessageType.SESSION_CREATE,
        sessionId: session.id,
        data: { session },
        timestamp: new Date(),
      });

      this.logger.info(`Session created: ${session.id} for user ${client.userId}`);
    } catch (error) {
      this.logger.error(`Failed to create session for user ${client.userId}:`, error);
      this.sendError(client, 'Failed to create session');
    }
  }

  private async handleSessionJoin(client: AuthenticatedWebSocket, data: any): Promise<void> {
    try {
      const sessionId = data.sessionId;
      const session = await this.sessionManager.getSession(sessionId);

      if (!session) {
        this.sendError(client, `Session not found: ${sessionId}`);
        return;
      }

      if (session.userId !== client.userId) {
        this.sendError(client, 'Access denied to session');
        return;
      }

      client.sessionId = sessionId;

      // Setup terminal streaming
      this.sessionManager.onTerminalOutput(sessionId, (output: string) => {
        this.sendMessage(client, {
          type: MessageType.TERMINAL_OUTPUT,
          sessionId: sessionId,
          data: { data: output },
          timestamp: new Date(),
        });
      });

      this.sendMessage(client, {
        type: MessageType.SESSION_JOIN,
        sessionId: sessionId,
        data: { session },
        timestamp: new Date(),
      });

      this.logger.info(`Client ${client.id} joined session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to join session:`, error);
      this.sendError(client, 'Failed to join session');
    }
  }

  private async handleSessionLeave(client: AuthenticatedWebSocket): Promise<void> {
    if (client.sessionId) {
      const sessionId = client.sessionId;
      client.sessionId = undefined;

      this.sendMessage(client, {
        type: MessageType.SESSION_LEAVE,
        sessionId: sessionId,
        data: { success: true },
        timestamp: new Date(),
      });

      this.logger.info(`Client ${client.id} left session ${sessionId}`);
    }
  }

  private async handleSessionList(client: AuthenticatedWebSocket): Promise<void> {
    try {
      const sessions = await this.sessionManager.getUserSessions(client.userId);

      this.sendMessage(client, {
        type: MessageType.SESSION_LIST,
        data: { sessions },
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to list sessions for user ${client.userId}:`, error);
      this.sendError(client, 'Failed to list sessions');
    }
  }

  private async handleTerminalInput(client: AuthenticatedWebSocket, data: TerminalData): Promise<void> {
    if (!client.sessionId) {
      this.sendError(client, 'No active session');
      return;
    }

    try {
      await this.sessionManager.writeToTerminal(client.sessionId, data.data);
    } catch (error) {
      this.logger.error(`Failed to write to terminal:`, error);
      this.sendError(client, 'Failed to write to terminal');
    }
  }

  private async handleTerminalResize(client: AuthenticatedWebSocket, data: any): Promise<void> {
    if (!client.sessionId) {
      this.sendError(client, 'No active session');
      return;
    }

    try {
      await this.sessionManager.resizeTerminal(client.sessionId, data.cols, data.rows);
    } catch (error) {
      this.logger.error(`Failed to resize terminal:`, error);
      this.sendError(client, 'Failed to resize terminal');
    }
  }

  private async handleFileWatch(client: AuthenticatedWebSocket, data: any): Promise<void> {
    try {
      const watchId = await this.fileWatcher.watch(
        data.path,
        (event: FileChangeEvent) => {
          this.sendMessage(client, {
            type: MessageType.FILE_CHANGE,
            data: event,
            timestamp: new Date(),
          });
        },
        data.recursive,
        data.ignored
      );

      this.sendMessage(client, {
        type: MessageType.FILE_WATCH,
        data: { success: true, watchId, path: data.path },
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to watch file:`, error);
      this.sendError(client, 'Failed to watch file');
    }
  }

  private async handleFileUnwatch(client: AuthenticatedWebSocket, data: any): Promise<void> {
    try {
      await this.fileWatcher.unwatch(data.watchId);

      this.sendMessage(client, {
        type: MessageType.FILE_UNWATCH,
        data: { success: true, watchId: data.watchId },
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to unwatch file:`, error);
      this.sendError(client, 'Failed to unwatch file');
    }
  }

  private handleDisconnection(client: AuthenticatedWebSocket, code: number, reason: Buffer): void {
    this.clients.delete(client.id);
    
    if (client.sessionId) {
      // Don't immediately destroy the session, just mark it as inactive
      this.sessionManager.pauseSession(client.sessionId).catch(error => {
        this.logger.error(`Failed to pause session ${client.sessionId}:`, error);
      });
    }

    this.logger.info(`WebSocket client disconnected: ${client.id} (code: ${code}, reason: ${reason.toString()})`);
  }

  private sendMessage(client: AuthenticatedWebSocket, message: WebSocketMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  private sendError(client: AuthenticatedWebSocket, error: string): void {
    this.sendMessage(client, {
      type: MessageType.ERROR,
      data: { error },
      timestamp: new Date(),
    });
  }

  private startHeartbeat(): void {
    const interval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          client.terminate();
          this.clients.delete(clientId);
          return;
        }

        client.isAlive = false;
        client.ping();
      });
    }, 30000); // 30 seconds

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  // Broadcast message to all clients for a specific user
  public broadcastToUser(userId: string, message: WebSocketMessage): void {
    this.clients.forEach(client => {
      if (client.userId === userId) {
        this.sendMessage(client, message);
      }
    });
  }

  // Broadcast message to all clients in a session
  public broadcastToSession(sessionId: string, message: WebSocketMessage): void {
    this.clients.forEach(client => {
      if (client.sessionId === sessionId) {
        this.sendMessage(client, message);
      }
    });
  }

  public getConnectedClients(): number {
    return this.clients.size;
  }

  public getActiveUsers(): Set<string> {
    const users = new Set<string>();
    this.clients.forEach(client => {
      users.add(client.userId);
    });
    return users;
  }

  public close(): void {
    this.wss.close();
  }
}