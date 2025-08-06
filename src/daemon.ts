#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { ConfigManager } from '@/utils/config';
import { Logger } from '@/utils/logger';

interface DaemonStatus {
  running: boolean;
  pid?: number;
  uptime?: number;
  startTime?: Date;
}

class DaemonManager {
  private configManager: ConfigManager;
  private logger: Logger;
  private pidFile: string;
  private logFile: string;

  constructor() {
    this.configManager = ConfigManager.getInstance();
    const dataDir = this.configManager.getDataDirectory();
    this.pidFile = path.join(dataDir, 'claude-server.pid');
    this.logFile = path.join(dataDir, 'logs', 'daemon.log');
    
    // Ensure log directory exists
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.logger = new Logger('info', this.logFile);
  }

  private writePidFile(pid: number): void {
    fs.writeFileSync(this.pidFile, pid.toString());
  }

  private removePidFile(): void {
    if (fs.existsSync(this.pidFile)) {
      fs.unlinkSync(this.pidFile);
    }
  }

  private getPidFromFile(): number | null {
    if (!fs.existsSync(this.pidFile)) {
      return null;
    }

    try {
      const pid = parseInt(fs.readFileSync(this.pidFile, 'utf8').trim());
      return isNaN(pid) ? null : pid;
    } catch (error) {
      return null;
    }
  }

  private isProcessRunning(pid: number): boolean {
    try {
      // Sending signal 0 checks if process exists without affecting it
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  public getStatus(): DaemonStatus {
    const pid = this.getPidFromFile();
    
    if (!pid) {
      return { running: false };
    }

    const running = this.isProcessRunning(pid);
    
    if (!running) {
      // Clean up stale PID file
      this.removePidFile();
      return { running: false };
    }

    // Try to get process start time (this is platform-dependent)
    let startTime: Date | undefined;
    let uptime: number | undefined;

    try {
      if (process.platform !== 'win32') {
        const stat = fs.statSync(`/proc/${pid}/stat`);
        startTime = stat.birthtime || stat.ctime;
        uptime = Date.now() - startTime.getTime();
      }
    } catch (error) {
      // Fallback: use PID file creation time
      try {
        const pidStat = fs.statSync(this.pidFile);
        startTime = pidStat.ctime;
        uptime = Date.now() - startTime.getTime();
      } catch (err) {
        // Ignore
      }
    }

    return {
      running: true,
      pid,
      startTime,
      uptime,
    };
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const status = this.getStatus();
      
      if (status.running) {
        console.log(`Claude Code server is already running (PID: ${status.pid})`);
        resolve();
        return;
      }

      console.log('Starting Claude Code server daemon...');
      this.logger.info('Starting daemon...');

      // Path to the compiled server file
      const serverScript = path.resolve(__dirname, 'server.js');
      
      if (!fs.existsSync(serverScript)) {
        reject(new Error(`Server script not found: ${serverScript}`));
        return;
      }

      // Spawn the server process as a daemon
      const child = spawn('node', [serverScript], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'production',
        },
      });

      // Write PID file
      this.writePidFile(child.pid!);

      // Set up logging for daemon output
      const logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
      
      child.stdout?.pipe(logStream);
      child.stderr?.pipe(logStream);

      // Handle process events
      child.on('error', (error) => {
        this.logger.error('Daemon process error:', error);
        this.removePidFile();
        reject(error);
      });

      child.on('exit', (code, signal) => {
        this.logger.info(`Daemon process exited with code ${code}, signal ${signal}`);
        this.removePidFile();
        
        if (code !== 0) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });

      // Give the process a moment to start up and check if it's still running
      setTimeout(() => {
        const newStatus = this.getStatus();
        if (newStatus.running) {
          console.log(`✅ Claude Code server started successfully (PID: ${newStatus.pid})`);
          this.logger.info(`Daemon started successfully (PID: ${newStatus.pid})`);
          
          // Unref the child process so the parent can exit
          child.unref();
          resolve();
        } else {
          reject(new Error('Server failed to start'));
        }
      }, 2000);
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      const status = this.getStatus();
      
      if (!status.running) {
        console.log('Claude Code server is not running');
        resolve();
        return;
      }

      console.log(`Stopping Claude Code server daemon (PID: ${status.pid})...`);
      this.logger.info(`Stopping daemon (PID: ${status.pid})...`);

      try {
        // Send SIGTERM for graceful shutdown
        process.kill(status.pid!, 'SIGTERM');
        
        // Wait for process to exit
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds
        
        const checkExit = setInterval(() => {
          attempts++;
          const currentStatus = this.getStatus();
          
          if (!currentStatus.running) {
            clearInterval(checkExit);
            console.log('✅ Claude Code server stopped successfully');
            this.logger.info('Daemon stopped successfully');
            resolve();
            return;
          }

          if (attempts >= maxAttempts) {
            // Force kill if graceful shutdown failed
            console.log('Forcing server shutdown...');
            this.logger.warn('Forcing daemon shutdown with SIGKILL');
            
            try {
              process.kill(status.pid!, 'SIGKILL');
              this.removePidFile();
              console.log('✅ Claude Code server force stopped');
              this.logger.info('Daemon force stopped');
            } catch (error) {
              this.logger.error('Failed to force stop daemon:', error);
              reject(error);
              return;
            }
            
            clearInterval(checkExit);
            resolve();
          }
        }, 1000);

      } catch (error) {
        this.logger.error('Failed to stop daemon:', error);
        reject(error);
      }
    });
  }

  public restart(): Promise<void> {
    return this.stop().then(() => {
      // Wait a moment before restarting
      return new Promise(resolve => setTimeout(resolve, 1000));
    }).then(() => {
      return this.start();
    });
  }

  public status(): void {
    const status = this.getStatus();
    
    if (status.running) {
      console.log('✅ Claude Code server is running');
      console.log(`   PID: ${status.pid}`);
      
      if (status.startTime) {
        console.log(`   Started: ${status.startTime.toISOString()}`);
      }
      
      if (status.uptime !== undefined) {
        const uptimeSeconds = Math.floor(status.uptime / 1000);
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;
        console.log(`   Uptime: ${hours}h ${minutes}m ${seconds}s`);
      }
    } else {
      console.log('❌ Claude Code server is not running');
    }
  }

  public logs(lines: number = 50): void {
    if (!fs.existsSync(this.logFile)) {
      console.log('No log file found');
      return;
    }

    try {
      const logContent = fs.readFileSync(this.logFile, 'utf8');
      const logLines = logContent.split('\n');
      const lastLines = logLines.slice(-lines).join('\n');
      
      console.log(`Last ${Math.min(lines, logLines.length)} lines from ${this.logFile}:\n`);
      console.log(lastLines);
    } catch (error) {
      console.error('Failed to read log file:', error);
    }
  }
}

// CLI interface
function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];
  const daemon = new DaemonManager();

  switch (command) {
    case 'start':
      daemon.start().catch((error) => {
        console.error('Failed to start daemon:', error.message);
        process.exit(1);
      });
      break;

    case 'stop':
      daemon.stop().catch((error) => {
        console.error('Failed to stop daemon:', error.message);
        process.exit(1);
      });
      break;

    case 'restart':
      daemon.restart().catch((error) => {
        console.error('Failed to restart daemon:', error.message);
        process.exit(1);
      });
      break;

    case 'status':
      daemon.status();
      break;

    case 'logs':
      const lines = args[1] ? parseInt(args[1]) : 50;
      daemon.logs(lines);
      break;

    default:
      console.log('Claude Code Extended Daemon Manager\n');
      console.log('Usage: claude-daemon <command> [options]\n');
      console.log('Commands:');
      console.log('  start    Start the daemon');
      console.log('  stop     Stop the daemon');
      console.log('  restart  Restart the daemon');
      console.log('  status   Show daemon status');
      console.log('  logs     Show daemon logs (optional: number of lines)');
      console.log('\nExamples:');
      console.log('  claude-daemon start');
      console.log('  claude-daemon logs 100');
      break;
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  main();
}

export default DaemonManager;