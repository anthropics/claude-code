import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { createLogger } from '@claude-framework/core';

const logger = createLogger('claude-mcp-client');

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
 * MCP client for interacting with MCP services
 */
export class ClaudeMcpClient {
  private axios: AxiosInstance;
  private config: McpServiceConfig;

  /**
   * Create a new MCP client
   * @param config MCP service configuration
   */
  constructor(config: McpServiceConfig) {
    this.config = config;
    
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
        logger.debug(`MCP ${this.config.name}: Request ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error(`MCP ${this.config.name}: Request error`, { error: error.message });
        return Promise.reject(error);
      }
    );
    
    // Add response interceptor
    this.axios.interceptors.response.use(
      (response) => {
        logger.debug(`MCP ${this.config.name}: Response ${response.status}`);
        return response;
      },
      (error) => {
        if (error.response) {
          logger.error(`MCP ${this.config.name}: Response error`, { 
            status: error.response.status,
            data: error.response.data
          });
        } else if (error.request) {
          logger.error(`MCP ${this.config.name}: No response received`, { 
            request: error.request
          });
        } else {
          logger.error(`MCP ${this.config.name}: Request setup error`, { 
            message: error.message
          });
        }
        return Promise.reject(error);
      }
    );
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
      logger.warn(`MCP ${this.config.name} is not available`);
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
      logger.error(`Failed to get status for MCP ${this.config.name}`, { error });
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
      logger.error(`Failed to invoke method ${method} on MCP ${this.config.name}`, { error });
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
}