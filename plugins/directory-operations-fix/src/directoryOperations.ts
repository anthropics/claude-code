/**
 * Enhanced Directory Operations Module
 * Fixes critical crashes when processing directory listings (Issue #9855)
 *
 * Key improvements:
 * - Robust error handling for missing assistant messages
 * - Model-specific response parsing for Bedrock Haiku variants
 * - Fallback mechanisms for malformed responses
 * - Comprehensive logging for debugging
 */

import { Logger } from './logger';

export interface DirectoryResponse {
  assistant_message?: string;
  content?: string;
  error?: string;
  files?: string[];
  directories?: string[];
}

export interface ModelCompatibility {
  name: string;
  responseFormat: 'standard' | 'bedrock' | 'haiku';
  requiresSpecialHandling: boolean;
}

export class DirectoryOperationHandler {
  private logger: Logger;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000; // ms

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Main directory listing function with comprehensive error handling
   */
  async processDirectoryListing(path: string, modelInfo?: ModelCompatibility): Promise<DirectoryResponse> {
    this.logger.info('Processing directory listing', { path, model: modelInfo?.name });

    let attempt = 0;
    while (attempt < this.retryAttempts) {
      try {
        const response = await this.executeDirectoryOperation(path, modelInfo);

        // Validate response structure
        if (!this.validateResponse(response)) {
          throw new Error("Invalid or malformed response structure");
        }

        // Check for missing assistant message (primary crash cause)
        if (!response.assistant_message && !response.content) {
          throw new Error("Missing assistant response - no content found");
        }

        this.logger.info('Directory listing successful', { path, attempt });
        return response;

      } catch (error) {
        attempt++;
        this.logger.warn('Directory operation attempt failed', {
          path,
          attempt,
          error: error.message,
          stack: error.stack
        });

        if (attempt >= this.retryAttempts) {
          this.logger.error('All directory operation attempts failed', { path, totalAttempts: attempt });
          return this.createFallbackResponse(path, error);
        }

        // Exponential backoff
        await this.sleep(this.retryDelay * Math.pow(2, attempt - 1));
      }
    }

    return this.createFallbackResponse(path, new Error("Maximum retry attempts exceeded"));
  }

  /**
   * Execute the actual directory operation with model-specific handling
   */
  private async executeDirectoryOperation(path: string, modelInfo?: ModelCompatibility): Promise<DirectoryResponse> {
    // Mock implementation - in real scenario this would call the actual Claude API
    // This demonstrates the structure for handling different model types

    if (modelInfo?.name?.includes('bedrock') && modelInfo?.responseFormat === 'haiku') {
      return this.handleBedrockHaikuResponse(path);
    }

    return this.handleStandardResponse(path);
  }

  /**
   * Handle Bedrock Haiku specific response format issues
   */
  private async handleBedrockHaikuResponse(path: string): Promise<DirectoryResponse> {
    this.logger.debug('Using Bedrock Haiku-specific handling', { path });

    // Simulate the problematic response format from Bedrock Haiku
    const response = await this.mockApiCall(path);

    // Bedrock Haiku sometimes returns responses without the expected assistant_message field
    if (!response.assistant_message && response.content) {
      response.assistant_message = response.content;
    }

    // Handle empty responses that cause crashes
    if (!response.assistant_message && !response.content) {
      throw new Error("Bedrock Haiku returned empty response");
    }

    return response;
  }

  /**
   * Handle standard model responses
   */
  private async handleStandardResponse(path: string): Promise<DirectoryResponse> {
    this.logger.debug('Using standard response handling', { path });
    return this.mockApiCall(path);
  }

  /**
   * Validate response structure to prevent crashes
   */
  private validateResponse(response: any): boolean {
    if (!response || typeof response !== 'object') {
      this.logger.warn('Response validation failed: not an object', { response });
      return false;
    }

    // At minimum, we need either assistant_message or content
    const hasContent = response.assistant_message || response.content || response.files || response.directories;

    if (!hasContent) {
      this.logger.warn('Response validation failed: no content fields present');
      return false;
    }

    return true;
  }

  /**
   * Create fallback response when operations fail
   */
  private createFallbackResponse(path: string, error: Error): DirectoryResponse {
    this.logger.info('Creating fallback response', { path, error: error.message });

    return {
      assistant_message: `Unable to process directory "${path}" due to system limitations. Error: ${error.message}`,
      content: `Directory listing failed for: ${path}`,
      error: error.message,
      files: [],
      directories: []
    };
  }

  /**
   * Mock API call - replace with actual Claude API integration
   */
  private async mockApiCall(path: string): Promise<DirectoryResponse> {
    // Simulate potential failure conditions
    const random = Math.random();

    if (random < 0.3) {
      // Simulate missing assistant_message (the main crash cause)
      return { content: `Files in ${path}` };
    } else if (random < 0.1) {
      // Simulate completely empty response
      return {};
    } else {
      // Normal successful response
      return {
        assistant_message: `Here are the contents of ${path}`,
        content: `Directory listing for ${path}`,
        files: ['file1.txt', 'file2.js'],
        directories: ['subdir1', 'subdir2']
      };
    }
  }

  /**
   * Utility sleep function for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Configure retry behavior
   */
  public setRetryConfig(attempts: number, delayMs: number): void {
    this.retryAttempts = Math.max(1, attempts);
    this.retryDelay = Math.max(100, delayMs);
    this.logger.info('Retry configuration updated', { attempts: this.retryAttempts, delay: this.retryDelay });
  }
}

/**
 * Factory function to create directory operation handler
 */
export function createDirectoryOperationHandler(logger: Logger): DirectoryOperationHandler {
  return new DirectoryOperationHandler(logger);
}

/**
 * Utility function to detect model compatibility
 */
export function detectModelCompatibility(modelName: string): ModelCompatibility {
  const lowerName = modelName.toLowerCase();

  if (lowerName.includes('bedrock') && lowerName.includes('haiku')) {
    return {
      name: modelName,
      responseFormat: 'haiku',
      requiresSpecialHandling: true
    };
  } else if (lowerName.includes('bedrock')) {
    return {
      name: modelName,
      responseFormat: 'bedrock',
      requiresSpecialHandling: true
    };
  } else {
    return {
      name: modelName,
      responseFormat: 'standard',
      requiresSpecialHandling: false
    };
  }
}