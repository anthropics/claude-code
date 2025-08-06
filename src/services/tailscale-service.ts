import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '@/utils/logger';

const execAsync = promisify(exec);

interface TailscaleStatus {
  connected: boolean;
  ipAddress?: string;
  hostname?: string;
  magicDNSName?: string;
  tailnetName?: string;
  error?: string;
}

interface TailscaleNode {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  online: boolean;
  lastSeen: Date;
  os: string;
}

export class TailscaleService {
  private logger: Logger;
  private isInitialized = false;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  // Initialize Tailscale connection
  async initialize(authKey?: string, hostname?: string): Promise<void> {
    try {
      // Check if Tailscale is installed
      await this.checkTailscaleInstalled();

      // Connect to Tailscale if auth key is provided
      if (authKey) {
        await this.connect(authKey, hostname);
      }

      // Verify connection status
      const status = await this.getStatus();
      if (status.connected) {
        this.logger.info(`Tailscale connected successfully: ${status.magicDNSName || status.ipAddress}`);
        this.isInitialized = true;
      } else {
        this.logger.warn('Tailscale is not connected');
      }
    } catch (error) {
      this.logger.error('Failed to initialize Tailscale:', error);
      throw error;
    }
  }

  // Check if Tailscale is installed
  private async checkTailscaleInstalled(): Promise<void> {
    try {
      await execAsync('tailscale version');
    } catch (error) {
      throw new Error(
        'Tailscale is not installed or not in PATH. Please install Tailscale from https://tailscale.com/'
      );
    }
  }

  // Connect to Tailscale network
  async connect(authKey: string, hostname?: string): Promise<void> {
    try {
      let command = `tailscale up --authkey="${authKey}"`;
      
      if (hostname) {
        command += ` --hostname="${hostname}"`;
      }

      // Add flags for headless server operation
      command += ' --accept-routes --accept-dns=false --shields-up=false';

      this.logger.info('Connecting to Tailscale...');
      const { stdout, stderr } = await execAsync(command);

      if (stderr && !stderr.includes('Warning') && !stderr.includes('Note')) {
        this.logger.warn('Tailscale connection warning:', stderr);
      }

      this.logger.info('Tailscale connection command completed');
      
      // Wait a moment for connection to establish
      await this.waitForConnection(10); // 10 second timeout

    } catch (error: any) {
      this.logger.error('Failed to connect to Tailscale:', error);
      throw new Error(`Tailscale connection failed: ${error.message}`);
    }
  }

  // Disconnect from Tailscale
  async disconnect(): Promise<void> {
    try {
      this.logger.info('Disconnecting from Tailscale...');
      await execAsync('tailscale down');
      this.isInitialized = false;
      this.logger.info('Disconnected from Tailscale');
    } catch (error: any) {
      this.logger.error('Failed to disconnect from Tailscale:', error);
      throw new Error(`Tailscale disconnect failed: ${error.message}`);
    }
  }

  // Get Tailscale connection status
  async getStatus(): Promise<TailscaleStatus> {
    try {
      const { stdout } = await execAsync('tailscale status --json');
      const status = JSON.parse(stdout);

      if (status.BackendState === 'Running') {
        // Parse the status to extract relevant information
        const self = status.Self;
        const peer = status.Peer?.[Object.keys(status.Peer)[0]];

        return {
          connected: true,
          ipAddress: self?.TailscaleIPs?.[0],
          hostname: self?.HostName,
          magicDNSName: self?.DNSName,
          tailnetName: status.CurrentTailnet?.Name,
        };
      } else {
        return {
          connected: false,
          error: `Tailscale state: ${status.BackendState}`,
        };
      }
    } catch (error: any) {
      this.logger.debug('Failed to get Tailscale status:', error);
      return {
        connected: false,
        error: error.message,
      };
    }
  }

  // Get list of nodes in the Tailnet
  async getNodes(): Promise<TailscaleNode[]> {
    try {
      const { stdout } = await execAsync('tailscale status --json');
      const status = JSON.parse(stdout);

      const nodes: TailscaleNode[] = [];

      // Add self
      if (status.Self) {
        const self = status.Self;
        nodes.push({
          id: self.PublicKey,
          name: self.DNSName || self.HostName,
          hostname: self.HostName,
          ipAddress: self.TailscaleIPs?.[0] || '',
          online: true,
          lastSeen: new Date(),
          os: self.OS || 'unknown',
        });
      }

      // Add peers
      if (status.Peer) {
        Object.values(status.Peer).forEach((peer: any) => {
          nodes.push({
            id: peer.PublicKey,
            name: peer.DNSName || peer.HostName,
            hostname: peer.HostName,
            ipAddress: peer.TailscaleIPs?.[0] || '',
            online: peer.Online,
            lastSeen: new Date(peer.LastSeen || Date.now()),
            os: peer.OS || 'unknown',
          });
        });
      }

      return nodes;
    } catch (error: any) {
      this.logger.error('Failed to get Tailscale nodes:', error);
      return [];
    }
  }

  // Get current Tailscale IP address
  async getIpAddress(): Promise<string | null> {
    const status = await this.getStatus();
    return status.ipAddress || null;
  }

  // Get Magic DNS name
  async getMagicDNSName(): Promise<string | null> {
    const status = await this.getStatus();
    return status.magicDNSName || null;
  }

  // Wait for Tailscale connection to be established
  private async waitForConnection(timeoutSeconds: number = 30): Promise<void> {
    const startTime = Date.now();
    const timeout = timeoutSeconds * 1000;

    while (Date.now() - startTime < timeout) {
      const status = await this.getStatus();
      if (status.connected) {
        return;
      }

      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Tailscale connection timeout after ${timeoutSeconds} seconds`);
  }

  // Enable/disable Tailscale features
  async setAcceptRoutes(accept: boolean): Promise<void> {
    try {
      const command = `tailscale set --accept-routes=${accept}`;
      await execAsync(command);
      this.logger.info(`Tailscale accept-routes set to ${accept}`);
    } catch (error: any) {
      this.logger.error('Failed to set accept-routes:', error);
      throw new Error(`Failed to set accept-routes: ${error.message}`);
    }
  }

  async setShieldsUp(enabled: boolean): Promise<void> {
    try {
      const command = `tailscale set --shields-up=${enabled}`;
      await execAsync(command);
      this.logger.info(`Tailscale shields-up set to ${enabled}`);
    } catch (error: any) {
      this.logger.error('Failed to set shields-up:', error);
      throw new Error(`Failed to set shields-up: ${error.message}`);
    }
  }

  // Get Tailscale version
  async getVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync('tailscale version');
      return stdout.trim();
    } catch (error: any) {
      throw new Error(`Failed to get Tailscale version: ${error.message}`);
    }
  }

  // Generate a shareable invite link (if available)
  async generateInviteLink(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('tailscale web --listen=127.0.0.1:0 --cgi');
      // This would return a URL if Tailscale supports web interface
      return stdout.trim() || null;
    } catch (error: any) {
      this.logger.debug('Tailscale web interface not available:', error);
      return null;
    }
  }

  // Health check
  async healthCheck(): Promise<{
    installed: boolean;
    connected: boolean;
    reachable: boolean;
    ipAddress?: string;
    error?: string;
  }> {
    const result = {
      installed: false,
      connected: false,
      reachable: false,
      ipAddress: undefined as string | undefined,
      error: undefined as string | undefined,
    };

    try {
      // Check if Tailscale is installed
      await this.checkTailscaleInstalled();
      result.installed = true;

      // Check connection status
      const status = await this.getStatus();
      result.connected = status.connected;
      result.ipAddress = status.ipAddress;

      if (status.connected) {
        // Test reachability by pinging self (basic test)
        try {
          if (status.ipAddress) {
            await execAsync(`ping -c 1 -W 3 ${status.ipAddress}`);
            result.reachable = true;
          }
        } catch (error) {
          result.reachable = false;
        }
      }

      if (!status.connected && status.error) {
        result.error = status.error;
      }

    } catch (error: any) {
      result.error = error.message;
    }

    return result;
  }

  // Get connection URL for the server
  getConnectionUrl(port: number, useHttps: boolean = false): string | null {
    if (!this.isInitialized) {
      return null;
    }

    // This would return the Tailscale Magic DNS URL or IP
    // In practice, you'd get this from the status
    const protocol = useHttps ? 'https' : 'http';
    
    // Return a placeholder URL - in real implementation, get from Tailscale status
    return `${protocol}://claude-code-server:${port}`;
  }

  // Cleanup
  async cleanup(): Promise<void> {
    if (this.isInitialized) {
      try {
        // Don't automatically disconnect on cleanup as other services might need it
        this.logger.info('Tailscale service cleaned up');
      } catch (error) {
        this.logger.error('Error during Tailscale cleanup:', error);
      }
    }
  }
}