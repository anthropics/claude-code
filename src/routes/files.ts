import { Router, Request, Response } from 'express';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { simpleGit } from 'simple-git';
import { AuthMiddleware, AuthenticatedRequest } from '@/middleware/auth';
import { FileWatcher } from '@/services/file-watcher';
import { Logger } from '@/utils/logger';

const readFileSchema = z.object({
  path: z.string().min(1),
  encoding: z.string().optional().default('utf8'),
});

const writeFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  encoding: z.string().optional().default('utf8'),
});

const listDirectorySchema = z.object({
  path: z.string().min(1),
  showHidden: z.boolean().optional().default(false),
});

const gitCommandSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional().default([]),
  workingDirectory: z.string().min(1),
});

const watchFileSchema = z.object({
  path: z.string().min(1),
  recursive: z.boolean().optional().default(true),
  ignored: z.array(z.string()).optional().default([]),
});

export function createFileRoutes(
  authMiddleware: AuthMiddleware,
  fileWatcher: FileWatcher,
  logger: Logger
): Router {
  const router = Router();

  // Apply authentication and permission checks
  router.use(authMiddleware.authenticate);

  // Read file content
  router.post('/read', authMiddleware.requirePermission('files', 'read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { path: filePath, encoding } = readFileSchema.parse(req.body);
      
      // Security check: prevent path traversal attacks
      if (filePath.includes('..') || path.isAbsolute(filePath) === false) {
        res.status(400).json({ error: 'Invalid file path' });
        return;
      }

      const resolvedPath = path.resolve(process.cwd(), filePath);
      
      // Check if file exists
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        res.status(400).json({ error: 'Path is not a file' });
        return;
      }

      const content = await fs.readFile(resolvedPath, encoding as BufferEncoding);
      
      res.json({
        success: true,
        data: {
          path: filePath,
          content,
          size: stats.size,
          modified: stats.mtime,
          encoding,
        },
      });
      
      logger.debug(`File read: ${filePath} by user ${req.user.userId}`);
    } catch (error: any) {
      logger.error('Failed to read file:', error);
      
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'File not found' });
      } else if (error.code === 'EACCES') {
        res.status(403).json({ error: 'Permission denied' });
      } else if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Invalid request data' });
      } else {
        res.status(500).json({ error: 'Failed to read file' });
      }
    }
  });

  // Write file content
  router.post('/write', authMiddleware.requirePermission('files', 'write'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { path: filePath, content, encoding } = writeFileSchema.parse(req.body);
      
      // Security check: prevent path traversal attacks
      if (filePath.includes('..') || path.isAbsolute(filePath) === false) {
        res.status(400).json({ error: 'Invalid file path' });
        return;
      }

      const resolvedPath = path.resolve(process.cwd(), filePath);
      
      // Ensure directory exists
      const dirPath = path.dirname(resolvedPath);
      await fs.mkdir(dirPath, { recursive: true });

      // Write file
      await fs.writeFile(resolvedPath, content, encoding as BufferEncoding);
      
      // Get file stats
      const stats = await fs.stat(resolvedPath);
      
      res.json({
        success: true,
        data: {
          path: filePath,
          size: stats.size,
          modified: stats.mtime,
          encoding,
        },
      });
      
      logger.info(`File written: ${filePath} by user ${req.user.userId}`);
    } catch (error: any) {
      logger.error('Failed to write file:', error);
      
      if (error.code === 'EACCES') {
        res.status(403).json({ error: 'Permission denied' });
      } else if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Invalid request data' });
      } else {
        res.status(500).json({ error: 'Failed to write file' });
      }
    }
  });

  // List directory contents
  router.post('/list', authMiddleware.requirePermission('files', 'read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { path: dirPath, showHidden } = listDirectorySchema.parse(req.body);
      
      // Security check: prevent path traversal attacks
      if (dirPath.includes('..') || path.isAbsolute(dirPath) === false) {
        res.status(400).json({ error: 'Invalid directory path' });
        return;
      }

      const resolvedPath = path.resolve(process.cwd(), dirPath);
      
      // Check if directory exists
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        res.status(400).json({ error: 'Path is not a directory' });
        return;
      }

      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
      
      const files = await Promise.all(
        entries
          .filter(entry => showHidden || !entry.name.startsWith('.'))
          .map(async entry => {
            try {
              const entryPath = path.join(resolvedPath, entry.name);
              const entryStats = await fs.stat(entryPath);
              
              return {
                name: entry.name,
                path: path.join(dirPath, entry.name),
                type: entry.isDirectory() ? 'directory' : 'file',
                size: entryStats.size,
                modified: entryStats.mtime,
                permissions: entryStats.mode,
              };
            } catch (error) {
              // Skip files we can't stat
              return null;
            }
          })
      );

      res.json({
        success: true,
        data: {
          path: dirPath,
          entries: files.filter(file => file !== null),
        },
      });
      
      logger.debug(`Directory listed: ${dirPath} by user ${req.user.userId}`);
    } catch (error: any) {
      logger.error('Failed to list directory:', error);
      
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Directory not found' });
      } else if (error.code === 'EACCES') {
        res.status(403).json({ error: 'Permission denied' });
      } else if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Invalid request data' });
      } else {
        res.status(500).json({ error: 'Failed to list directory' });
      }
    }
  });

  // Delete file or directory
  router.delete('/', authMiddleware.requirePermission('files', 'delete'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { path: targetPath } = req.body;
      
      if (!targetPath) {
        res.status(400).json({ error: 'Path is required' });
        return;
      }

      // Security check: prevent path traversal attacks
      if (targetPath.includes('..') || path.isAbsolute(targetPath) === false) {
        res.status(400).json({ error: 'Invalid path' });
        return;
      }

      const resolvedPath = path.resolve(process.cwd(), targetPath);
      
      // Check if exists
      const stats = await fs.stat(resolvedPath);
      
      if (stats.isDirectory()) {
        await fs.rmdir(resolvedPath, { recursive: true });
      } else {
        await fs.unlink(resolvedPath);
      }
      
      res.json({
        success: true,
        message: `${stats.isDirectory() ? 'Directory' : 'File'} deleted successfully`,
      });
      
      logger.info(`${stats.isDirectory() ? 'Directory' : 'File'} deleted: ${targetPath} by user ${req.user.userId}`);
    } catch (error: any) {
      logger.error('Failed to delete:', error);
      
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'File or directory not found' });
      } else if (error.code === 'EACCES') {
        res.status(403).json({ error: 'Permission denied' });
      } else {
        res.status(500).json({ error: 'Failed to delete' });
      }
    }
  });

  // Start watching file/directory for changes
  router.post('/watch', authMiddleware.requirePermission('files', 'watch'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { path: watchPath, recursive, ignored } = watchFileSchema.parse(req.body);
      
      // Security check: prevent path traversal attacks
      if (watchPath.includes('..') || path.isAbsolute(watchPath) === false) {
        res.status(400).json({ error: 'Invalid path' });
        return;
      }

      const resolvedPath = path.resolve(process.cwd(), watchPath);
      
      // Check if path exists
      await fs.access(resolvedPath);
      
      const watchId = await fileWatcher.watch(
        resolvedPath,
        (event) => {
          // File watcher events will be sent via WebSocket
          logger.debug(`File change event: ${event.event} - ${event.path}`);
        },
        recursive,
        ignored
      );
      
      res.json({
        success: true,
        data: {
          watchId,
          path: watchPath,
          recursive,
          ignored,
        },
      });
      
      logger.info(`File watch started: ${watchPath} (${watchId}) by user ${req.user.userId}`);
    } catch (error: any) {
      logger.error('Failed to start file watch:', error);
      
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Path not found' });
      } else if (error.code === 'EACCES') {
        res.status(403).json({ error: 'Permission denied' });
      } else if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Invalid request data' });
      } else {
        res.status(500).json({ error: 'Failed to start watching' });
      }
    }
  });

  // Stop watching file/directory
  router.delete('/watch/:watchId', authMiddleware.requirePermission('files', 'watch'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { watchId } = req.params;
      
      await fileWatcher.unwatch(watchId);
      
      res.json({
        success: true,
        message: 'File watch stopped successfully',
      });
      
      logger.info(`File watch stopped: ${watchId} by user ${req.user.userId}`);
    } catch (error: any) {
      logger.error('Failed to stop file watch:', error);
      res.status(500).json({ error: 'Failed to stop watching' });
    }
  });

  // Git operations
  router.post('/git', authMiddleware.requirePermission('files', 'write'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { command, args, workingDirectory } = gitCommandSchema.parse(req.body);
      
      // Security check: prevent path traversal attacks
      if (workingDirectory.includes('..') || path.isAbsolute(workingDirectory) === false) {
        res.status(400).json({ error: 'Invalid working directory' });
        return;
      }

      const resolvedPath = path.resolve(process.cwd(), workingDirectory);
      
      // Check if directory exists
      await fs.access(resolvedPath);
      
      const git = simpleGit({
        baseDir: resolvedPath,
        binary: 'git',
        maxConcurrentProcesses: 1,
      });

      let result: any;
      
      // Execute git command based on command type
      switch (command) {
        case 'status':
          result = await git.status();
          break;
        case 'add':
          result = await git.add(args);
          break;
        case 'commit':
          if (args.length < 1) {
            throw new Error('Commit message required');
          }
          result = await git.commit(args[0]);
          break;
        case 'push':
          result = await git.push(args[0] || 'origin', args[1] || 'HEAD');
          break;
        case 'pull':
          result = await git.pull(args[0] || 'origin', args[1] || 'HEAD');
          break;
        case 'log':
          const logOptions = {
            maxCount: parseInt(args[0]) || 10,
          };
          result = await git.log(logOptions);
          break;
        case 'branch':
          result = await git.branch(args);
          break;
        case 'checkout':
          if (args.length < 1) {
            throw new Error('Branch name required');
          }
          result = await git.checkout(args[0]);
          break;
        case 'diff':
          result = await git.diff(args);
          break;
        default:
          res.status(400).json({ error: `Unsupported git command: ${command}` });
          return;
      }

      res.json({
        success: true,
        data: {
          command,
          args,
          workingDirectory,
          result,
        },
      });
      
      logger.info(`Git command executed: ${command} in ${workingDirectory} by user ${req.user.userId}`);
    } catch (error: any) {
      logger.error('Git command failed:', error);
      
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Invalid git command data' });
      } else {
        res.status(500).json({ 
          error: 'Git command failed',
          message: error.message 
        });
      }
    }
  });

  // Get file statistics
  router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const watcherStats = fileWatcher.getStats();
      const activeWatchers = fileWatcher.getActiveWatchers();
      
      res.json({
        success: true,
        stats: {
          fileWatcher: {
            activeWatchers: watcherStats.activeWatchers,
            totalPaths: watcherStats.totalPaths,
            watchers: activeWatchers.map(w => ({
              id: w.id,
              path: w.path,
              recursive: w.options.recursive,
            })),
          },
        },
      });
    } catch (error: any) {
      logger.error('Failed to get file stats:', error);
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  });

  return router;
}