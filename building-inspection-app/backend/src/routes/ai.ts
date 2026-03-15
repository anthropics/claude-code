import { Router, Request, Response } from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import fs from 'fs';
import {
  transcribeAndProfessionalize,
  addTechnicalTheory,
  generatePhotoCaption,
  generateFindingsSummary,
  generateFinalSummary,
  streamProcessObservation,
  suggestUrgency,
  processObservationFull,
  batchProcessObservations,
  checkCompleteness,
  generateCategoryChecklist,
  analyzePhotoDefects,
  generateRiskObservations,
  parsePDFToReport,
} from '../services/claudeService';
import { buildFewShotExamples } from '../services/learningService';
import { validateToken } from '../services/authService';

const upload = multer({ dest: '/tmp/audio-uploads/', limits: { fileSize: 25 * 1024 * 1024 } });
const pdfUpload = multer({ dest: '/tmp/pdf-uploads/', limits: { fileSize: 50 * 1024 * 1024 } });

export const aiRouter = Router();

// Helper: extract userId from auth token if present (optional auth for AI routes)
function getUserId(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return undefined;
  const result = validateToken(authHeader.slice(7));
  return result?.user.id;
}

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

    const userId = getUserId(req);
    const fewShot = userId ? buildFewShotExamples(userId, category, 5) : '';
    const result = await transcribeAndProfessionalize(rawText, category, fewShot);
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

// ─────────────────────────────────────────────────────────────────────────────
// NEW ENDPOINTS: Auto-urgency, batch processing, completeness, checklists
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/suggest-urgency
 * AI-powered urgency suggestion for an observation
 */
aiRouter.post('/suggest-urgency', async (req: Request, res: Response) => {
  try {
    const { observationText, category, buildingContext } = req.body;
    if (!observationText || !category) {
      return res.status(400).json({ error: 'observationText and category are required' });
    }

    const result = await suggestUrgency(observationText, category, buildingContext);
    return res.json(result);
  } catch (err) {
    console.error('Suggest urgency error:', err);
    return res.status(500).json({ error: 'AI processing failed' });
  }
});

/**
 * POST /api/ai/process-observation-full
 * Full AI processing of a single observation (text + theory + urgency + action)
 */
aiRouter.post('/process-observation-full', async (req: Request, res: Response) => {
  try {
    const { rawText, category, buildingContext } = req.body;
    if (!rawText || !category) {
      return res.status(400).json({ error: 'rawText and category are required' });
    }

    const userId = getUserId(req);
    const fewShot = userId ? buildFewShotExamples(userId, category, 5) : '';
    const result = await processObservationFull(rawText, category, buildingContext, fewShot);
    return res.json(result);
  } catch (err) {
    console.error('Process observation full error:', err);
    return res.status(500).json({ error: 'AI processing failed' });
  }
});

/**
 * POST /api/ai/batch-process
 * Batch processes multiple observations at once
 */
aiRouter.post('/batch-process', async (req: Request, res: Response) => {
  try {
    const { observations, buildingContext } = req.body;
    if (!observations || !Array.isArray(observations) || observations.length === 0) {
      return res.status(400).json({ error: 'observations array is required' });
    }

    const results = await batchProcessObservations(observations, buildingContext);
    return res.json({ results });
  } catch (err) {
    console.error('Batch process error:', err);
    return res.status(500).json({ error: 'AI processing failed' });
  }
});

/**
 * POST /api/ai/check-completeness
 * AI-powered completeness check for the inspection
 */
aiRouter.post('/check-completeness', async (req: Request, res: Response) => {
  try {
    const { categories, buildingContext } = req.body;
    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json({ error: 'categories array is required' });
    }

    const result = await checkCompleteness(categories, buildingContext);
    return res.json(result);
  } catch (err) {
    console.error('Check completeness error:', err);
    return res.status(500).json({ error: 'AI processing failed' });
  }
});

/**
 * POST /api/ai/generate-checklist
 * Generates AI-powered checklist for an inspection category
 */
aiRouter.post('/generate-checklist', async (req: Request, res: Response) => {
  try {
    const { categoryName, categoryDescription, buildingContext } = req.body;
    if (!categoryName) {
      return res.status(400).json({ error: 'categoryName is required' });
    }

    const checklist = await generateCategoryChecklist(
      categoryName,
      categoryDescription || '',
      buildingContext
    );
    return res.json({ checklist });
  } catch (err) {
    console.error('Generate checklist error:', err);
    return res.status(500).json({ error: 'AI processing failed' });
  }
});

/**
 * POST /api/ai/analyze-photo
 * Enhanced photo analysis with defect detection
 */
aiRouter.post('/analyze-photo', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mediaType, category, buildingContext } = req.body;
    if (!imageBase64 || !mediaType || !category) {
      return res.status(400).json({ error: 'imageBase64, mediaType, and category are required' });
    }

    if (imageBase64.length > 13_500_000) {
      return res.status(400).json({ error: 'Image too large. Max 10MB.' });
    }

    const result = await analyzePhotoDefects(imageBase64, mediaType, category, buildingContext);
    return res.json(result);
  } catch (err) {
    console.error('Analyze photo error:', err);
    return res.status(500).json({ error: 'AI processing failed' });
  }
});

/**
 * POST /api/ai/generate-risk-observations
 * Generates observation templates from detected risk structures
 */
aiRouter.post('/generate-risk-observations', async (req: Request, res: Response) => {
  try {
    const { risks, buildingContext } = req.body;
    if (!risks || !Array.isArray(risks) || risks.length === 0) {
      return res.status(400).json({ error: 'risks array is required' });
    }

    const result = await generateRiskObservations(risks, buildingContext);
    return res.json({ observations: result });
  } catch (err) {
    console.error('Generate risk observations error:', err);
    return res.status(500).json({ error: 'AI processing failed' });
  }
});

/**
 * POST /api/ai/transcribe-audio
 * Transcribes audio recording to text using OpenAI Whisper
 * Accepts multipart/form-data with 'audio' file field
 */
aiRouter.post('/transcribe-audio', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      // Clean up temp file
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'OPENAI_API_KEY not configured for speech transcription' });
    }

    const openai = new OpenAI({ apiKey: openaiKey });

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: 'whisper-1',
      language: 'fi',
      prompt: 'Kuntotarkastusraportti. Rakennuksen tarkastushavainto.',
    });

    // Clean up temp file
    fs.unlinkSync(req.file.path);

    return res.json({ text: transcription.text });
  } catch (err) {
    // Clean up temp file on error
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    console.error('Transcribe audio error:', err);
    return res.status(500).json({ error: 'Audio transcription failed' });
  }
});

/**
 * POST /api/ai/import-pdf
 * Imports a PDF building inspection report and converts it to structured data using AI
 */
aiRouter.post('/import-pdf', pdfUpload.single('pdf'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    const pdfBuffer = fs.readFileSync(req.file.path);
    const pdfBase64 = pdfBuffer.toString('base64');

    // Clean up temp file
    fs.unlinkSync(req.file.path);

    const result = await parsePDFToReport(pdfBase64);
    return res.json(result);
  } catch (err) {
    // Clean up temp file on error
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    console.error('Import PDF error:', err);
    return res.status(500).json({ error: 'PDF import failed' });
  }
});
