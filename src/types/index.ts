export interface ClaudeSession {
  id: string;
  userId: string;
  deviceId: string;
  workingDirectory: string;
  environment: Record<string, string>;
  status: 'active' | 'inactive' | 'paused';
  createdAt: Date;
  lastActivity: Date;
  settings: SessionSettings;
}

export interface SessionSettings {
  shell: string;
  theme: 'light' | 'dark' | 'auto';
  fontSize: number;
  fontFamily: string;
  autoSave: boolean;
  notifications: boolean;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  passwordHash: string;
  devices: Device[];
  settings: UserSettings;
  createdAt: Date;
  lastLogin: Date;
}

export interface Device {
  id: string;
  name: string;
  type: 'mobile' | 'desktop' | 'tablet';
  platform: string;
  userAgent: string;
  lastSeen: Date;
  trusted: boolean;
  publicKey?: string;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    desktop: boolean;
  };
}

export interface AuthToken {
  userId: string;
  deviceId: string;
  sessionId?: string;
  permissions: Permission[];
  expiresAt: Date;
}

export interface Permission {
  resource: string;
  actions: string[];
}

export interface WebSocketMessage {
  type: MessageType;
  sessionId?: string;
  data: any;
  timestamp: Date;
}

export enum MessageType {
  // Terminal messages
  TERMINAL_INPUT = 'terminal:input',
  TERMINAL_OUTPUT = 'terminal:output',
  TERMINAL_RESIZE = 'terminal:resize',
  
  // Session messages
  SESSION_CREATE = 'session:create',
  SESSION_JOIN = 'session:join',
  SESSION_LEAVE = 'session:leave',
  SESSION_LIST = 'session:list',
  SESSION_STATUS = 'session:status',
  
  // File system messages
  FILE_WATCH = 'file:watch',
  FILE_UNWATCH = 'file:unwatch',
  FILE_CHANGE = 'file:change',
  
  // Auth messages
  AUTH_CHALLENGE = 'auth:challenge',
  AUTH_RESPONSE = 'auth:response',
  AUTH_SUCCESS = 'auth:success',
  AUTH_FAILURE = 'auth:failure',
  
  // System messages
  SYSTEM_STATUS = 'system:status',
  ERROR = 'error',
  PING = 'ping',
  PONG = 'pong'
}

export interface TerminalData {
  sessionId: string;
  data: string | Buffer;
  encoding?: string;
}

export interface FileWatchRequest {
  path: string;
  recursive?: boolean;
  ignored?: string[];
}

export interface FileChangeEvent {
  path: string;
  event: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  stats?: any;
}

export interface GitOperation {
  command: string;
  args: string[];
  workingDirectory: string;
}

export interface GitResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  ssl: {
    enabled: boolean;
    cert?: string;
    key?: string;
  };
  auth: {
    jwtSecret: string;
    sessionTimeout: number;
    maxDevicesPerUser: number;
  };
  database: {
    path: string;
  };
  tailscale: {
    enabled: boolean;
    authKey?: string;
    hostname?: string;
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    file?: string;
  };
  rateLimiting: {
    windowMs: number;
    max: number;
  };
}

export interface SetupWizardConfig {
  serverConfig: Partial<ServerConfig>;
  userConfig: {
    username: string;
    password: string;
    email?: string;
  };
  deviceConfig: {
    name: string;
    type: Device['type'];
  };
}

export interface ServiceStatus {
  status: 'running' | 'stopped' | 'error';
  uptime: number;
  version: string;
  sessions: number;
  connectedDevices: number;
  memory: {
    used: number;
    total: number;
  };
  cpu: {
    usage: number;
  };
}

export interface PairingRequest {
  deviceName: string;
  deviceType: Device['type'];
  platform: string;
  userAgent: string;
  publicKey?: string;
}

export interface PairingResponse {
  success: boolean;
  qrCode?: string;
  pairingCode?: string;
  expiresAt?: Date;
  error?: string;
}

// Error types
export class ClaudeCodeError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ClaudeCodeError';
  }
}

export class AuthenticationError extends ClaudeCodeError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 401);
  }
}

export class AuthorizationError extends ClaudeCodeError {
  constructor(message: string = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

export class SessionError extends ClaudeCodeError {
  constructor(message: string) {
    super(message, 'SESSION_ERROR', 400);
  }
}

export class ValidationError extends ClaudeCodeError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}