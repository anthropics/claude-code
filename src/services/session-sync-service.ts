import { ClaudeSession, Device, WebSocketMessage, MessageType } from '@/types';
import { SessionManager } from './session-manager';
import { DatabaseService } from './database-service';
import { Logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

interface SessionSnapshot {
  sessionId: string;
  userId: string;
  workingDirectory: string;
  terminalBuffer: string[];
  commandHistory: string[];
  environment: Record<string, string>;
  cursorPosition: { row: number; col: number };
  timestamp: Date;
  checksum: string;
}

interface SyncState {
  deviceId: string;
  sessionId: string;
  lastSyncTime: Date;
  pendingChanges: any[];
  isOnline: boolean;
}

export class SessionSyncService {
  private syncStates: Map<string, SyncState> = new Map();
  private sessionSnapshots: Map<string, SessionSnapshot> = new Map();
  private syncInterval: NodeJS.Timer | null = null;
  
  constructor(
    private sessionManager: SessionManager,
    private database: DatabaseService,
    private logger: Logger
  ) {
    this.startSyncInterval();
  }

  /**
   * Create a snapshot of the current session state for offline sync
   */
  async createSessionSnapshot(sessionId: string): Promise<SessionSnapshot> {
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const terminalData = await this.sessionManager.getTerminalBuffer(sessionId);
    const commandHistory = await this.sessionManager.getCommandHistory(sessionId);
    
    const snapshot: SessionSnapshot = {
      sessionId,
      userId: session.userId,
      workingDirectory: session.workingDirectory,
      terminalBuffer: terminalData || [],
      commandHistory: commandHistory || [],
      environment: session.environment,
      cursorPosition: { row: 0, col: 0 },
      timestamp: new Date(),
      checksum: ''
    };

    // Generate checksum for data integrity
    snapshot.checksum = this.generateChecksum(snapshot);
    
    this.sessionSnapshots.set(sessionId, snapshot);
    await this.database.saveSessionSnapshot(snapshot);
    
    this.logger.info(`Created snapshot for session ${sessionId}`);
    return snapshot;
  }

  /**
   * Sync offline changes when device comes back online
   */
  async syncOfflineChanges(deviceId: string, changes: any[]): Promise<void> {
    const syncState = this.syncStates.get(deviceId);
    if (!syncState) {
      throw new Error(`No sync state found for device ${deviceId}`);
    }

    this.logger.info(`Syncing ${changes.length} offline changes for device ${deviceId}`);
    
    // Sort changes by timestamp to maintain order
    changes.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    for (const change of changes) {
      try {
        await this.applyChange(syncState.sessionId, change);
      } catch (error) {
        this.logger.error(`Failed to apply change: ${error}`);
        // Store failed changes for retry
        syncState.pendingChanges.push(change);
      }
    }
    
    syncState.lastSyncTime = new Date();
    syncState.isOnline = true;
  }

  /**
   * Handle device handoff - transfer session to another device
   */
  async initiateHandoff(
    sessionId: string,
    fromDeviceId: string,
    toDeviceId: string
  ): Promise<void> {
    this.logger.info(`Initiating handoff of session ${sessionId} from ${fromDeviceId} to ${toDeviceId}`);
    
    // Create snapshot of current state
    const snapshot = await this.createSessionSnapshot(sessionId);
    
    // Pause session on source device
    await this.sessionManager.pauseSession(sessionId);
    
    // Transfer session ownership
    const session = await this.sessionManager.getSession(sessionId);
    if (session) {
      session.deviceId = toDeviceId;
      await this.database.updateSession(session);
    }
    
    // Resume session on target device
    await this.sessionManager.resumeSession(sessionId);
    
    // Notify both devices
    await this.notifyHandoff(fromDeviceId, toDeviceId, sessionId);
  }

  /**
   * Get sync status for a device
   */
  getSyncStatus(deviceId: string): SyncState | undefined {
    return this.syncStates.get(deviceId);
  }

  /**
   * Register device for sync
   */
  registerDevice(deviceId: string, sessionId: string): void {
    const syncState: SyncState = {
      deviceId,
      sessionId,
      lastSyncTime: new Date(),
      pendingChanges: [],
      isOnline: true
    };
    
    this.syncStates.set(deviceId, syncState);
    this.logger.info(`Registered device ${deviceId} for sync with session ${sessionId}`);
  }

  /**
   * Mark device as offline
   */
  markDeviceOffline(deviceId: string): void {
    const syncState = this.syncStates.get(deviceId);
    if (syncState) {
      syncState.isOnline = false;
      this.logger.info(`Device ${deviceId} marked as offline`);
    }
  }

  /**
   * Get pending changes for a device
   */
  getPendingChanges(deviceId: string): any[] {
    const syncState = this.syncStates.get(deviceId);
    return syncState?.pendingChanges || [];
  }

  /**
   * Clear pending changes after successful sync
   */
  clearPendingChanges(deviceId: string): void {
    const syncState = this.syncStates.get(deviceId);
    if (syncState) {
      syncState.pendingChanges = [];
    }
  }

  /**
   * Generate checksum for data integrity
   */
  private generateChecksum(data: any): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  /**
   * Apply a change to the session
   */
  private async applyChange(sessionId: string, change: any): Promise<void> {
    switch (change.type) {
      case 'terminal_input':
        await this.sessionManager.sendInput(sessionId, change.data);
        break;
      case 'file_change':
        // Handle file changes
        break;
      case 'environment_update':
        // Handle environment updates
        break;
      default:
        this.logger.warn(`Unknown change type: ${change.type}`);
    }
  }

  /**
   * Notify devices about handoff
   */
  private async notifyHandoff(
    fromDeviceId: string,
    toDeviceId: string,
    sessionId: string
  ): Promise<void> {
    // Implementation would send notifications via WebSocket or push notifications
    this.logger.info(`Notified devices about handoff of session ${sessionId}`);
  }

  /**
   * Start periodic sync interval
   */
  private startSyncInterval(): void {
    this.syncInterval = setInterval(async () => {
      await this.performPeriodicSync();
    }, 30000); // Sync every 30 seconds
  }

  /**
   * Perform periodic sync for all online devices
   */
  private async performPeriodicSync(): Promise<void> {
    for (const [deviceId, syncState] of this.syncStates) {
      if (syncState.isOnline && syncState.pendingChanges.length > 0) {
        try {
          await this.syncOfflineChanges(deviceId, syncState.pendingChanges);
          this.clearPendingChanges(deviceId);
        } catch (error) {
          this.logger.error(`Periodic sync failed for device ${deviceId}: ${error}`);
        }
      }
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.syncStates.clear();
    this.sessionSnapshots.clear();
  }
}