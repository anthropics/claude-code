import chokidar from 'chokidar';
import { v4 as uuidv4 } from 'uuid';
import { FileChangeEvent, FileWatchRequest } from '@/types';
import { Logger } from '@/utils/logger';

interface WatchSession {
  id: string;
  watcher: chokidar.FSWatcher;
  callback: (event: FileChangeEvent) => void;
  path: string;
  options: {
    recursive?: boolean;
    ignored?: string[];
  };
}

export class FileWatcher {
  private watchers: Map<string, WatchSession> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async watch(
    path: string,
    callback: (event: FileChangeEvent) => void,
    recursive: boolean = true,
    ignored: string[] = []
  ): Promise<string> {
    const watchId = uuidv4();

    // Default ignore patterns
    const defaultIgnored = [
      '**/node_modules/**',
      '**/.git/**',
      '**/.DS_Store',
      '**/Thumbs.db',
      '**/*.tmp',
      '**/*.swp',
      '**/*.log',
      '**/dist/**',
      '**/build/**',
      '**/__pycache__/**',
      '**/*.pyc',
      '**/.coverage',
      '**/coverage/**',
      '**/.next/**',
      '**/.cache/**',
    ];

    const allIgnored = [...defaultIgnored, ...ignored];

    try {
      const watcher = chokidar.watch(path, {
        ignored: allIgnored,
        persistent: true,
        ignoreInitial: false,
        followSymlinks: true,
        cwd: process.cwd(),
        disableGlobbing: false,
        usePolling: false,
        interval: 100,
        binaryInterval: 300,
        alwaysStat: false,
        depth: recursive ? undefined : 1,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 100,
        },
        ignorePermissionErrors: true,
      });

      // Setup event listeners
      watcher
        .on('add', (filePath, stats) => {
          this.logger.debug(`File added: ${filePath}`);
          callback({
            path: filePath,
            event: 'add',
            stats,
          });
        })
        .on('change', (filePath, stats) => {
          this.logger.debug(`File changed: ${filePath}`);
          callback({
            path: filePath,
            event: 'change',
            stats,
          });
        })
        .on('unlink', (filePath) => {
          this.logger.debug(`File removed: ${filePath}`);
          callback({
            path: filePath,
            event: 'unlink',
          });
        })
        .on('addDir', (dirPath, stats) => {
          this.logger.debug(`Directory added: ${dirPath}`);
          callback({
            path: dirPath,
            event: 'addDir',
            stats,
          });
        })
        .on('unlinkDir', (dirPath) => {
          this.logger.debug(`Directory removed: ${dirPath}`);
          callback({
            path: dirPath,
            event: 'unlinkDir',
          });
        })
        .on('error', (error) => {
          this.logger.error(`Watcher error for ${path}:`, error);
          callback({
            path,
            event: 'change', // Generic event for errors
          });
        })
        .on('ready', () => {
          this.logger.info(`File watcher ready for: ${path}`);
        });

      const watchSession: WatchSession = {
        id: watchId,
        watcher,
        callback,
        path,
        options: { recursive, ignored },
      };

      this.watchers.set(watchId, watchSession);

      this.logger.info(`Started watching: ${path} (ID: ${watchId})`);
      return watchId;
    } catch (error) {
      this.logger.error(`Failed to start watching ${path}:`, error);
      throw error;
    }
  }

  async unwatch(watchId: string): Promise<void> {
    const watchSession = this.watchers.get(watchId);
    if (!watchSession) {
      this.logger.warn(`Watch session not found: ${watchId}`);
      return;
    }

    try {
      await watchSession.watcher.close();
      this.watchers.delete(watchId);
      this.logger.info(`Stopped watching: ${watchSession.path} (ID: ${watchId})`);
    } catch (error) {
      this.logger.error(`Failed to stop watching ${watchSession.path}:`, error);
      throw error;
    }
  }

  async unwatchAll(): Promise<void> {
    const promises = Array.from(this.watchers.keys()).map(watchId => 
      this.unwatch(watchId).catch(error => 
        this.logger.error(`Failed to stop watcher ${watchId}:`, error)
      )
    );

    await Promise.all(promises);
    this.logger.info('All file watchers stopped');
  }

  getActiveWatchers(): Array<{
    id: string;
    path: string;
    options: { recursive?: boolean; ignored?: string[] };
  }> {
    return Array.from(this.watchers.values()).map(session => ({
      id: session.id,
      path: session.path,
      options: session.options,
    }));
  }

  getWatcherCount(): number {
    return this.watchers.size;
  }

  async getWatchedPaths(): Promise<string[]> {
    const paths: string[] = [];
    
    for (const session of this.watchers.values()) {
      try {
        const watchedPaths = session.watcher.getWatched();
        Object.keys(watchedPaths).forEach(dir => {
          watchedPaths[dir].forEach(file => {
            if (file === '.') {
              paths.push(dir);
            } else {
              paths.push(`${dir}/${file}`);
            }
          });
        });
      } catch (error) {
        this.logger.error(`Failed to get watched paths for ${session.path}:`, error);
      }
    }

    return [...new Set(paths)]; // Remove duplicates
  }

  // Health check for watchers
  async healthCheck(): Promise<{
    totalWatchers: number;
    activeWatchers: number;
    erroredWatchers: number;
  }> {
    let activeWatchers = 0;
    let erroredWatchers = 0;

    for (const session of this.watchers.values()) {
      try {
        // Check if watcher is still active by getting watched paths
        session.watcher.getWatched();
        activeWatchers++;
      } catch (error) {
        erroredWatchers++;
        this.logger.warn(`Watcher ${session.id} appears to be in error state:`, error);
      }
    }

    return {
      totalWatchers: this.watchers.size,
      activeWatchers,
      erroredWatchers,
    };
  }

  // Restart a failed watcher
  async restartWatcher(watchId: string): Promise<void> {
    const session = this.watchers.get(watchId);
    if (!session) {
      throw new Error(`Watcher not found: ${watchId}`);
    }

    this.logger.info(`Restarting watcher: ${watchId}`);

    try {
      // Close existing watcher
      await session.watcher.close();
    } catch (error) {
      this.logger.warn(`Error closing watcher ${watchId}:`, error);
    }

    // Create new watcher with same parameters
    const newWatchId = await this.watch(
      session.path,
      session.callback,
      session.options.recursive,
      session.options.ignored
    );

    // Remove old entry and update with new ID
    this.watchers.delete(watchId);
    
    this.logger.info(`Watcher restarted: ${watchId} -> ${newWatchId}`);
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    await this.unwatchAll();
  }

  // Get statistics about file system activity
  getStats(): {
    activeWatchers: number;
    totalPaths: number;
  } {
    let totalPaths = 0;

    this.watchers.forEach(session => {
      try {
        const watched = session.watcher.getWatched();
        totalPaths += Object.keys(watched).length;
      } catch (error) {
        // Ignore errors for stats
      }
    });

    return {
      activeWatchers: this.watchers.size,
      totalPaths,
    };
  }
}