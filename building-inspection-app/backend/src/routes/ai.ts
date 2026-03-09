import { Router, Request, Response } from 'express';
import {
  transcribeAndProfessionalize,
  addTechnicalTheory,
  generatePhotoCaption,
  generateFindingsSummary,
  generateFinalSummary,
  streamProcessObservation,
} from '../services/claudeService';

export const aiRouter = Router();

/**
 * POST /api/ai/transcribe
 * Converts raw voice/text observation to professional Finnish
 */
aiRouter.post('/transcribe', async (req: Request, res: Response) => {
  try {
    const { rawText, category } = req.body;
    if (!rawText || !category) {
      return res.status(400).json({ error: 'rawText and category are required' });
    }

    const result = await transcribeAndProfessionalize(rawText, category);
    return res.json({ result });
  } catch (err) {
    console.error('Transcribe error:', err);
    return res.status(500).json({ error: 'AI processing failed' });
  }
});

/**
 * POST /api/ai/add-theory
 * Adds technical theory and building regulations to an observation
 */
aiRouter.post('/add-theory', async (req: Request, res: Response) => {
  try {
    const { observation, category } = req.body;
    if (!observation || !category) {
      return res.status(400).json({ error: 'observation and category are required' });
    }

    const result = await addTechnicalTheory(observation, category);
    return res.json({ result });
  } catch (err) {
    console.error('Add theory error:', err);
    return res.status(500).json({ error: 'AI processing failed' });
  }
});

/**
 * POST /api/ai/photo-caption
 * Generates automatic caption for a building inspection photo
 */
aiRouter.post('/photo-caption', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mediaType, category } = req.body;
    if (!imageBase64 || !mediaType || !category) {
      return res.status(400).json({ error: 'imageBase64, mediaType, and category are required' });
    }

    // Validate base64 size (max ~10MB)
    if (imageBase64.length > 13_500_000) {
      return res.status(400).json({ error: 'Image too large. Max 10MB.' });
    }

    const caption = await generatePhotoCaption(imageBase64, mediaType, category);
    return res.json({ caption });
  } catch (err) {
    console.error('Photo caption error:', err);
    return res.status(500).json({ error: 'AI processing failed' });
  }
});

/**
 * POST /api/ai/findings-summary
 * Generates a structured findings summary table
 */
aiRouter.post('/findings-summary', async (req: Request, res: Response) => {
  try {
    const { observations } = req.body;
    if (!observations || !Array.isArray(observations) || observations.length === 0) {
      return res.status(400).json({ error: 'observations array is required' });
    }

    const result = await generateFindingsSummary(observations);
    return res.json({ result });
  } catch (err) {
    console.error('Findings summary error:', err);
    return res.status(500).json({ error: 'AI processing failed' });
  }
});

/**
 * POST /api/ai/final-summary
 * Generates the final report summary
 */
aiRouter.post('/final-summary', async (req: Request, res: Response) => {
  try {
    const { propertyInfo, observations, findingsSummary } = req.body;
    if (!propertyInfo || !observations) {
      return res.status(400).json({ error: 'propertyInfo and observations are required' });
    }

    const result = await generateFinalSummary({ propertyInfo, observations, findingsSummary });
    return res.json({ result });
  } catch (err) {
    console.error('Final summary error:', err);
    return res.status(500).json({ error: 'AI processing failed' });
  }
});

/**
 * POST /api/ai/process-observation-stream
 * Streams AI processing of an observation with SSE
 */
aiRouter.post('/process-observation-stream', async (req: Request, res: Response) => {
  try {
    const { rawText, category } = req.body;
    if (!rawText || !category) {
      return res.status(400).json({ error: 'rawText and category are required' });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    let fullText = '';

    await streamProcessObservation(rawText, category, (chunk) => {
      fullText += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    });

    res.write(`data: ${JSON.stringify({ done: true, fullText })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Stream observation error:', err);
    res.write(`data: ${JSON.stringify({ error: 'AI processing failed' })}\n\n`);
    res.end();
  }
});
