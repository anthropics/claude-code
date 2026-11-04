import { Router, Request, Response } from 'express';
import { authMiddleware } from './auth';
import {
  addCorrection,
  getRecentCorrections,
  syncFromClient,
  getFullProfile,
} from '../services/learningService';

export const learningRouter = Router();

// All learning routes require authentication
learningRouter.use(authMiddleware);

/**
 * POST /api/learning/correction
 * Save a single correction (original AI text vs user's edited version)
 */
learningRouter.post('/correction', (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { original, corrected, category, field } = req.body;

  if (!original || !corrected || !category) {
    return res.status(400).json({ error: 'original, corrected, and category are required' });
  }

  // Skip if texts are identical
  if (original.trim() === corrected.trim()) {
    return res.json({ skipped: true, reason: 'Texts are identical' });
  }

  const entry = addCorrection(userId, {
    original,
    corrected,
    category,
    field: field || 'processedText',
    timestamp: new Date().toISOString(),
  });

  return res.json({ correction: entry });
});

/**
 * POST /api/learning/sync
 * Bulk sync corrections from client (offline-first support)
 */
learningRouter.post('/sync', (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { corrections } = req.body;

  if (!corrections || !Array.isArray(corrections)) {
    return res.status(400).json({ error: 'corrections array is required' });
  }

  // Filter out identical corrections
  const validCorrections = corrections.filter(
    (c: any) => c.original && c.corrected && c.original.trim() !== c.corrected.trim()
  );

  const result = syncFromClient(userId, validCorrections);
  return res.json(result);
});

/**
 * GET /api/learning/corrections
 * Get recent corrections for the current user
 */
learningRouter.get('/corrections', (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const category = req.query.category as string | undefined;
  const limit = parseInt(req.query.limit as string) || 10;

  const corrections = getRecentCorrections(userId, category, limit);
  return res.json({ corrections });
});

/**
 * GET /api/learning/profile
 * Get the full learning profile for the current user
 */
learningRouter.get('/profile', (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const profile = getFullProfile(userId);
  return res.json({ profile });
});
