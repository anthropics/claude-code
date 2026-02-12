/**
 * Test Suite for Directory Operations Fix
 * Tests the critical crash scenarios identified in Issue #9855
 */

import { DirectoryOperationHandler, detectModelCompatibility } from '../src/directoryOperations';
import { Logger, LogLevel } from '../src/logger';

describe('DirectoryOperationHandler', () => {
  let handler: DirectoryOperationHandler;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = new Logger('Test', LogLevel.ERROR); // Reduce noise in tests
    handler = new DirectoryOperationHandler(mockLogger);
  });

  describe('processDirectoryListing', () => {
    it('should handle missing assistant_message gracefully', async () => {
      // This simulates the main crash scenario from Issue #9855
      const result = await handler.processDirectoryListing('/test/path');

      expect(result).toBeDefined();
      expect(result.error || result.assistant_message || result.content).toBeTruthy();
    });

    it('should create fallback response on complete failure', async () => {
      // Force all attempts to fail by using invalid path
      const result = await handler.processDirectoryListing('');

      expect(result).toBeDefined();
      expect(result.assistant_message).toContain('Unable to process directory');
      expect(result.files).toEqual([]);
      expect(result.directories).toEqual([]);
    });

    it('should respect retry configuration', async () => {
      handler.setRetryConfig(2, 100);

      const startTime = Date.now();
      await handler.processDirectoryListing('/test/retry');
      const endTime = Date.now();

      // Should complete quickly with only 2 retries and 100ms delay
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should handle Bedrock Haiku model compatibility', async () => {
      const modelInfo = detectModelCompatibility('bedrock-haiku-4.5');
      const result = await handler.processDirectoryListing('/test/bedrock', modelInfo);

      expect(result).toBeDefined();
      expect(modelInfo.requiresSpecialHandling).toBe(true);
    });
  });

  describe('Model Compatibility Detection', () => {
    it('should detect Bedrock Haiku models correctly', () => {
      const result = detectModelCompatibility('bedrock-haiku-4.5');

      expect(result.responseFormat).toBe('haiku');
      expect(result.requiresSpecialHandling).toBe(true);
    });

    it('should detect standard models correctly', () => {
      const result = detectModelCompatibility('claude-3-5-sonnet');

      expect(result.responseFormat).toBe('standard');
      expect(result.requiresSpecialHandling).toBe(false);
    });

    it('should handle generic Bedrock models', () => {
      const result = detectModelCompatibility('bedrock-claude-3');

      expect(result.responseFormat).toBe('bedrock');
      expect(result.requiresSpecialHandling).toBe(true);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle empty responses without crashing', async () => {
      // This tests the scenario that causes "No assistant message found"
      const result = await handler.processDirectoryListing('/empty/response');

      expect(result).toBeDefined();
      expect(() => JSON.stringify(result)).not.toThrow();
    });

    it('should handle malformed responses', async () => {
      const result = await handler.processDirectoryListing('/malformed/response');

      expect(result).toBeDefined();
      expect(result.assistant_message || result.content).toBeTruthy();
    });
  });
});

describe('Logger', () => {
  let logger: Logger;
  const originalConsoleLog = console.log;

  beforeEach(() => {
    logger = new Logger('TestLogger', LogLevel.DEBUG);
    console.log = jest.fn(); // Mock console.log
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it('should log messages with proper format', () => {
    logger.info('Test message', { key: 'value' });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[TestLogger] INFO: Test message')
    );
  });

  it('should respect log levels', () => {
    logger.setLogLevel(LogLevel.WARN);
    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warn message');

    expect(console.log).toHaveBeenCalledTimes(1); // Only warn message
  });

  it('should maintain log history', () => {
    logger.info('Message 1');
    logger.warn('Message 2');

    const history = logger.getRecentLogs(10);
    expect(history).toHaveLength(2);
    expect(history[0].message).toBe('Message 1');
    expect(history[1].message).toBe('Message 2');
  });

  it('should export logs as JSON', () => {
    logger.error('Error message');

    const exported = logger.exportLogs();
    const parsed = JSON.parse(exported);

    expect(parsed).toBeInstanceOf(Array);
    expect(parsed[0]).toHaveProperty('message', 'Error message');
    expect(parsed[0]).toHaveProperty('level', 'ERROR');
  });
});