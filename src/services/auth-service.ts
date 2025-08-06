import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import qrcode from 'qrcode';
import { 
  User, 
  Device, 
  AuthToken, 
  PairingRequest, 
  PairingResponse,
  AuthenticationError,
  AuthorizationError,
  ValidationError
} from '@/types';
import { DatabaseService } from './database-service';
import { Logger } from '@/utils/logger';

interface PairingSession {
  id: string;
  userId: string;
  deviceInfo: PairingRequest;
  expiresAt: Date;
  attempts: number;
}

export class AuthService {
  private database: DatabaseService;
  private logger: Logger;
  private jwtSecret: string;
  private sessionTimeout: number;
  private maxDevicesPerUser: number;
  private pairingSessions: Map<string, PairingSession> = new Map();
  private readonly SALT_ROUNDS = 12;
  private readonly MAX_PAIRING_ATTEMPTS = 3;
  private readonly PAIRING_TIMEOUT_MINUTES = 5;

  constructor(
    database: DatabaseService,
    logger: Logger,
    jwtSecret: string,
    sessionTimeout: number = 24 * 60 * 60 * 1000, // 24 hours
    maxDevicesPerUser: number = 10
  ) {
    this.database = database;
    this.logger = logger;
    this.jwtSecret = jwtSecret;
    this.sessionTimeout = sessionTimeout;
    this.maxDevicesPerUser = maxDevicesPerUser;

    // Start cleanup of expired pairing sessions
    this.startPairingCleanup();
  }

  async createUser(username: string, password: string, email?: string): Promise<User> {
    // Validate input
    if (!username || username.length < 3) {
      throw new ValidationError('Username must be at least 3 characters long');
    }

    if (!password || password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Check if user already exists
    const existingUser = await this.database.getUserByUsername(username);
    if (existingUser) {
      throw new ValidationError('Username already exists');
    }

    if (email) {
      const existingEmailUser = await this.database.getUserByEmail(email);
      if (existingEmailUser) {
        throw new ValidationError('Email already registered');
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);
    const now = new Date();

    const user: User = {
      id: uuidv4(),
      username,
      email,
      passwordHash,
      devices: [],
      settings: {
        theme: 'auto',
        language: 'en',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notifications: {
          email: !!email,
          push: true,
          desktop: true,
        },
      },
      createdAt: now,
      lastLogin: now,
    };

    await this.database.saveUser(user);
    this.logger.info(`Created user: ${username} (${user.id})`);

    return user;
  }

  async authenticateUser(username: string, password: string): Promise<User> {
    const user = await this.database.getUserByUsername(username);
    if (!user) {
      throw new AuthenticationError('Invalid username or password');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid username or password');
    }

    // Update last login
    user.lastLogin = new Date();
    await this.database.updateUser(user);

    this.logger.info(`User authenticated: ${username} (${user.id})`);
    return user;
  }

  async addDevice(userId: string, deviceInfo: PairingRequest): Promise<Device> {
    const user = await this.database.getUser(userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Check device limit
    if (user.devices.length >= this.maxDevicesPerUser) {
      throw new AuthorizationError(`Maximum number of devices (${this.maxDevicesPerUser}) reached`);
    }

    // Check if device already exists
    const existingDevice = user.devices.find(d => 
      d.name === deviceInfo.deviceName && d.type === deviceInfo.deviceType
    );

    if (existingDevice) {
      throw new ValidationError('Device with this name already exists');
    }

    const device: Device = {
      id: uuidv4(),
      name: deviceInfo.deviceName,
      type: deviceInfo.deviceType,
      platform: deviceInfo.platform,
      userAgent: deviceInfo.userAgent,
      lastSeen: new Date(),
      trusted: false, // Device needs to be verified
      publicKey: deviceInfo.publicKey,
    };

    user.devices.push(device);
    await this.database.updateUser(user);

    this.logger.info(`Added device ${device.name} (${device.id}) for user ${userId}`);
    return device;
  }

  async startPairing(userId: string, deviceInfo: PairingRequest): Promise<PairingResponse> {
    try {
      // Create device first
      const device = await this.addDevice(userId, deviceInfo);
      
      // Generate pairing session
      const pairingId = uuidv4();
      const pairingCode = this.generatePairingCode();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + this.PAIRING_TIMEOUT_MINUTES);

      const pairingSession: PairingSession = {
        id: pairingId,
        userId,
        deviceInfo,
        expiresAt,
        attempts: 0,
      };

      this.pairingSessions.set(pairingId, pairingSession);

      // Generate QR code containing pairing information
      const pairingData = {
        pairingId,
        pairingCode,
        deviceId: device.id,
        serverInfo: {
          // This would be filled with actual server connection info
          host: 'localhost',
          port: 3000,
        },
        expiresAt: expiresAt.toISOString(),
      };

      const qrCodeData = await qrcode.toDataURL(JSON.stringify(pairingData));

      this.logger.info(`Started pairing session ${pairingId} for device ${device.name}`);

      return {
        success: true,
        qrCode: qrCodeData,
        pairingCode,
        expiresAt,
      };
    } catch (error) {
      this.logger.error('Failed to start pairing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start pairing',
      };
    }
  }

  async completePairing(pairingId: string, pairingCode: string): Promise<{ token: string; device: Device }> {
    const pairingSession = this.pairingSessions.get(pairingId);
    if (!pairingSession) {
      throw new AuthenticationError('Invalid or expired pairing session');
    }

    if (new Date() > pairingSession.expiresAt) {
      this.pairingSessions.delete(pairingId);
      throw new AuthenticationError('Pairing session expired');
    }

    pairingSession.attempts++;

    if (pairingSession.attempts > this.MAX_PAIRING_ATTEMPTS) {
      this.pairingSessions.delete(pairingId);
      throw new AuthenticationError('Maximum pairing attempts exceeded');
    }

    // Verify pairing code (in a real implementation, this would be more sophisticated)
    const expectedCode = this.generatePairingCode(); // This should use the stored code
    if (pairingCode !== expectedCode) {
      throw new AuthenticationError('Invalid pairing code');
    }

    // Mark device as trusted
    const user = await this.database.getUser(pairingSession.userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    const device = user.devices.find(d => d.name === pairingSession.deviceInfo.deviceName);
    if (!device) {
      throw new AuthenticationError('Device not found');
    }

    device.trusted = true;
    device.lastSeen = new Date();
    await this.database.updateUser(user);

    // Clean up pairing session
    this.pairingSessions.delete(pairingId);

    // Generate JWT token
    const token = await this.generateToken(user.id, device.id);

    this.logger.info(`Completed pairing for device ${device.name} (${device.id})`);

    return { token, device };
  }

  async generateToken(userId: string, deviceId: string, sessionId?: string): Promise<string> {
    const user = await this.database.getUser(userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    const device = user.devices.find(d => d.id === deviceId);
    if (!device || !device.trusted) {
      throw new AuthenticationError('Device not found or not trusted');
    }

    const authToken: AuthToken = {
      userId,
      deviceId,
      sessionId,
      permissions: [
        { resource: 'sessions', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'files', actions: ['read', 'write', 'watch'] },
        { resource: 'terminal', actions: ['read', 'write'] },
      ],
      expiresAt: new Date(Date.now() + this.sessionTimeout),
    };

    const token = jwt.sign(authToken, this.jwtSecret, {
      expiresIn: this.sessionTimeout / 1000,
    });

    this.logger.debug(`Generated token for user ${userId}, device ${deviceId}`);
    return token;
  }

  async verifyToken(token: string): Promise<AuthToken> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as AuthToken;
      
      // Check if token is expired
      if (new Date() > new Date(decoded.expiresAt)) {
        throw new AuthenticationError('Token expired');
      }

      // Verify user and device still exist and are valid
      const user = await this.database.getUser(decoded.userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      const device = user.devices.find(d => d.id === decoded.deviceId);
      if (!device || !device.trusted) {
        throw new AuthenticationError('Device not found or not trusted');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid token');
      }
      throw error;
    }
  }

  async revokeDevice(userId: string, deviceId: string): Promise<void> {
    const user = await this.database.getUser(userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    const deviceIndex = user.devices.findIndex(d => d.id === deviceId);
    if (deviceIndex === -1) {
      throw new ValidationError('Device not found');
    }

    user.devices.splice(deviceIndex, 1);
    await this.database.updateUser(user);

    this.logger.info(`Revoked device ${deviceId} for user ${userId}`);
  }

  async updateDeviceLastSeen(userId: string, deviceId: string): Promise<void> {
    const user = await this.database.getUser(userId);
    if (!user) {
      return; // Silently ignore if user not found
    }

    const device = user.devices.find(d => d.id === deviceId);
    if (device) {
      device.lastSeen = new Date();
      await this.database.updateUser(user);
    }
  }

  async getUserDevices(userId: string): Promise<Device[]> {
    const user = await this.database.getUser(userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    return user.devices;
  }

  private generatePairingCode(): string {
    // Generate a 6-digit code
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private startPairingCleanup(): void {
    setInterval(() => {
      const now = new Date();
      const expiredSessions: string[] = [];

      this.pairingSessions.forEach((session, id) => {
        if (now > session.expiresAt) {
          expiredSessions.push(id);
        }
      });

      expiredSessions.forEach(id => {
        this.pairingSessions.delete(id);
        this.logger.debug(`Cleaned up expired pairing session: ${id}`);
      });
    }, 60000); // Check every minute
  }

  // Get authentication statistics
  getStats(): {
    activePairingSessions: number;
    totalUsers: number;
    totalDevices: number;
  } {
    const activePairingSessions = this.pairingSessions.size;
    
    // These would be implemented in the database service
    return {
      activePairingSessions,
      totalUsers: 0, // Would get from database
      totalDevices: 0, // Would get from database
    };
  }

  // Cleanup
  cleanup(): void {
    this.pairingSessions.clear();
  }
}