/**
 * Claude MCP Client API
 *
 * A user-friendly API for interacting with MCP servers.
 * This file provides functions for communicating with Claude through the Model Context Protocol.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, ChildProcess } from 'child_process';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Anthropic, MessageParam } from '@anthropic/sdk';

// Import standardized config manager and logger
import configManager, { ConfigType } from '@core/config/config-manager';
import { Logger } from '@core/logging/logger';

// Import internationalization
import { I18n } from '@core/i18n/i18n';

/**
 * MCP service configuration
 */
export interface McpServiceConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * Interface for server information
 */
export interface ServerInfo {
  id: string;
  description: string;
  autostart: boolean;
  running: boolean;
}

/**
 * Interface for MCP server configuration
 */
export interface ServerConfig {
  enabled: boolean;
  autostart: boolean;
  command: string;
  args: string[];
  description: string;
  api_key_env?: string;
}

/**
 * Interface for response generation options
 */
export interface GenerateResponseOptions {
  prompt: string;
  requiredTools?: string[];
  model?: string;
}

/**
 * Interface for Claude response
 */
export interface ClaudeResponse {
  text: string;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  requestId: string;
}

/**
 * Class for communicating with Claude via the Model Context Protocol
 */
export class ClaudeMcpClient {
  private axios: AxiosInstance;
  private config: McpServiceConfig;
  private mcpConfig: Record<string, any>;
  private serverProcesses: Map<string, ChildProcess>;
  private anthropic: Anthropic | null;
  private i18n: I18n;
  private logger: Logger;

  /**
   * Create a new MCP client
   * @param config MCP service configuration
   */
  constructor(config: McpServiceConfig) {
    this.config = config;
    this.logger = new Logger(`claude-mcp-client:${config.name}`);
    
    const axiosConfig: AxiosRequestConfig = {
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...config.headers,
      },
    };
    
    if (config.apiKey) {
      axiosConfig.headers!['Authorization'] = `Bearer ${config.apiKey}`;
    }
    
    this.axios = axios.create(axiosConfig);
    
    // Add request interceptor
    this.axios.interceptors.request.use(
      (config) => {
        this.logger.debug(`MCP ${this.config.name}: Request ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error(`MCP ${this.config.name}: Request error`, { error: error.message });
        return Promise.reject(error);
      }
    );
    
    // Add response interceptor
    this.axios.interceptors.response.use(
      (response) => {
        this.logger.debug(`MCP ${this.config.name}: Response ${response.status}`);
        return response;
      },
      (error) => {
        if (error.response) {
          this.logger.error(`MCP ${this.config.name}: Response error`, { 
            status: error.response.status,
            data: error.response.data
          });
        } else if (error.request) {
          this.logger.error(`MCP ${this.config.name}: No response received`, { 
            request: error.request
          });
        } else {
          this.logger.error(`MCP ${this.config.name}: Request setup error`, { 
            message: error.message
          });
        }
        return Promise.reject(error);
      }
    );

    // Initialize MCP process management
    this.serverProcesses = new Map();
    this.anthropic = null;
    this.i18n = new I18n();
    
    // Load MCP configuration
    try {
      this.mcpConfig = configManager.getConfig(ConfigType.MCP);
      
      // Initialize Anthropic client if API key is available
      this.initAnthropicClient();
      
      this.logger.info(this.i18n.translate('mcp.clientInitialized'));
    } catch (err) {
      this.logger.error(this.i18n.translate('errors.clientInitFailed'), { error: err });
    }
  }

  /**
   * Initialize Anthropic client with API key
   * @private
   */
  private initAnthropicClient(): void {
    const apiKeyEnv = configManager.getConfigValue<string>(ConfigType.RAG, 'claude.api_key_env', 'CLAUDE_API_KEY');
    const apiKey = process.env[apiKeyEnv];

    if (apiKey) {
      this.logger.debug(this.i18n.translate('mcp.initClient'));
      this.anthropic = new Anthropic({ apiKey });
    } else {
      this.logger.warn(this.i18n.translate('errors.noApiKey'));
    }
  }

  /**
   * Get the MCP service configuration
   * @returns MCP service configuration
   */
  public getConfig(): McpServiceConfig {
    return this.config;
  }

  /**
   * Check if the MCP service is available
   * @returns Promise that resolves to true if the service is available
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const response = await this.axios.get('/status');
      return response.status === 200;
    } catch (error) {
      this.logger.warn(`MCP ${this.config.name} is not available`);
      return false;
    }
  }

  /**
   * Get the service status
   * @returns Promise that resolves to the service status
   */
  public async getStatus(): Promise<any> {
    try {
      const response = await this.axios.get('/status');
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get status for MCP ${this.config.name}`, { error });
      throw error;
    }
  }

  /**
   * Invoke an MCP method
   * @param method Method name
   * @param params Method parameters
   * @returns Promise that resolves to the method result
   */
  public async invoke<T>(method: string, params: any): Promise<T> {
    try {
      const response = await this.axios.post('/api/invoke', {
        method,
        params,
      });
      
      return response.data.result;
    } catch (error) {
      this.logger.error(`Failed to invoke method ${method} on MCP ${this.config.name}`, { error });
      throw error;
    }
  }

  /**
   * Make a raw HTTP request to the MCP service
   * @param method HTTP method
   * @param url URL path
   * @param data Request data
   * @param config Additional request configuration
   * @returns Promise that resolves to the axios response
   */
  public async request<T = any>(
    method: string, 
    url: string, 
    data?: any, 
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.axios.request<T>({
      method,
      url,
      data,
      ...config,
    });
  }

  /**
   * Get list of available MCP servers
   * 
   * @returns List of available servers
   */
  public getAvailableServers(): ServerInfo[] {
    this.logger.debug('Getting available MCP servers');
    
    const servers = Object.entries(this.mcpConfig.servers || {})
      .filter(([, serverConfig]) => (serverConfig as ServerConfig).enabled)
      .map(([serverId, serverConfig]) => ({
        id: serverId,
        description: (serverConfig as ServerConfig).description,
        autostart: (serverConfig as ServerConfig).autostart,
        running: this.serverProcesses.has(serverId)
      }));
    
    this.logger.debug('Available MCP servers', { count: servers.length });
    return servers;
  }
  
  /**
   * Start an MCP server
   * 
   * @param serverId - Server ID
   * @returns Success
   */
  public startServer(serverId: string): boolean {
    this.logger.info(this.i18n.translate('mcp.serverStarting'), { serverId });

    // Check if server is already running
    if (this.serverProcesses.has(serverId)) {
      this.logger.warn(this.i18n.translate('mcp.serverAlreadyRunning'), { serverId });
      return true;
    }

    // Get server configuration
    const serverConfig = this.mcpConfig.servers?.[serverId] as ServerConfig | undefined;
    if (!serverConfig) {
      this.logger.error(this.i18n.translate('mcp.serverNotFound'), { serverId });
      return false;
    }

    if (!serverConfig.enabled) {
      this.logger.warn(this.i18n.translate('mcp.serverDisabled'), { serverId });
      return false;
    }

    try {
      // Start server process
      const process = spawn(serverConfig.command, serverConfig.args, {
        stdio: 'inherit'
      });

      // Store process
      this.serverProcesses.set(serverId, process);

      // Handle process exit
      process.on('exit', (code) => {
        this.logger.info('Server process exited', { serverId, code });
        this.serverProcesses.delete(serverId);
      });

      this.logger.info(this.i18n.translate('mcp.serverStartSuccess'), { serverId });
      return true;
    } catch (err) {
      this.logger.error(this.i18n.translate('errors.serverError', { message: (err as Error).message }), { serverId, error: err });
      return false;
    }
  }
  
  /**
   * Stop an MCP server
   * 
   * @param serverId - Server ID
   * @returns Success
   */
  public stopServer(serverId: string): boolean {
    this.logger.info(this.i18n.translate('mcp.serverStopping'), { serverId });

    // Check if server is running
    if (!this.serverProcesses.has(serverId)) {
      this.logger.warn(this.i18n.translate('mcp.serverNotRunning'), { serverId });
      return false;
    }

    try {
      // Get process
      const process = this.serverProcesses.get(serverId)!;

      // Kill process
      process.kill();

      this.logger.info(this.i18n.translate('mcp.serverStopSuccess'), { serverId });
      return true;
    } catch (err) {
      this.logger.error(this.i18n.translate('mcp.serverStopFailed'), { serverId, error: err });
      return false;
    }
  }
  
  /**
   * Stop all running MCP servers
   */
  public stopAllServers(): void {
    this.logger.info(this.i18n.translate('mcp.serverStopping'));

    // Stop each running server
    this.serverProcesses.forEach((process, serverId) => {
      try {
        process.kill();
        this.logger.debug(this.i18n.translate('mcp.serverStopSuccess'), { serverId });
      } catch (err) {
        this.logger.error(this.i18n.translate('mcp.serverStopFailed'), { serverId, error: err });
      }
    });

    // Clear process map
    this.serverProcesses.clear();

    this.logger.info(this.i18n.translate('mcp.allServersStopped'));
  }
  
  /**
   * Generate a response from Claude with MCP server integration
   * 
   * @param options - Generation options
   * @returns Claude response
   */
  public async generateResponse(options: GenerateResponseOptions): Promise<ClaudeResponse> {
    const { prompt, requiredTools = [], model } = options;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    this.logger.info(this.i18n.translate('mcp.generatingResponse'), {
      requestId,
      promptLength: prompt.length,
      requiredTools,
      model
    });

    // Check if Anthropic client is available
    if (!this.anthropic) {
      const error = new Error(this.i18n.translate('errors.anthropicNotInitialized'));
      this.logger.error(this.i18n.translate('errors.failedToGenerateResponse'), { requestId, error });
      throw error;
    }

    // Start required servers
    if (requiredTools.length > 0) {
      this.logger.debug(this.i18n.translate('mcp.startingRequiredServers'), { requestId, requiredTools });

      for (const tool of requiredTools) {
        if (!this.serverProcesses.has(tool)) {
          this.startServer(tool);
        }
      }
    }

    try {
      // Generate response
      const startTime = Date.now();

      // Get Claude model from configuration
      const defaultModel = configManager.getConfigValue<string>(ConfigType.RAG, 'claude.model', 'claude-3-sonnet-20240229');

      // Create messages array for Claude
      const messages: MessageParam[] = [
        {
          role: 'user',
          content: prompt
        }
      ];

      // Call Claude API
      const response = await this.anthropic.messages.create({
        model: model || defaultModel,
        messages,
        max_tokens: 4000
      });

      const duration = Date.now() - startTime;

      this.logger.info(this.i18n.translate('mcp.responseGenerated'), {
        requestId,
        duration,
        tokensUsed: response.usage,
        model: response.model
      });

      return {
        text: response.content[0].text,
        model: response.model,
        usage: response.usage,
        requestId
      };
    } catch (err) {
      this.logger.error(this.i18n.translate('errors.failedToGenerateResponse'), { requestId, error: err });
      throw err;
    }
  }
}

/**
 * Create a new ClaudeMcpClient instance
 * @param config MCP service configuration
 * @returns ClaudeMcpClient instance
 */
export function createMcpClient(config: McpServiceConfig): ClaudeMcpClient {
  return new ClaudeMcpClient(config);
}

/**
 * Create a client for the sequential thinking MCP server
 * @returns ClaudeMcpClient for sequential thinking
 */
export function createSequentialThinkingClient(): ClaudeMcpClient {
  return createMcpClient({
    name: 'sequential-thinking',
    baseUrl: 'http://localhost:3020',
    timeout: 60000
  });
}

/**
 * Create a client for the brave search MCP server
 * @returns ClaudeMcpClient for brave search
 */
export function createBraveSearchClient(): ClaudeMcpClient {
  const apiKey = process.env.BRAVE_API_KEY || process.env.MCP_API_KEY;
  
  return createMcpClient({
    name: 'brave-search',
    baseUrl: 'http://localhost:3021',
    apiKey,
    timeout: 30000
  });
}

// Export default client for sequential thinking
export default createSequentialThinkingClient();