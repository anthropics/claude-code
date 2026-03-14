// API service for communicating with the backend
const API_BASE = '/api/ai';

async function post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Professionalizes a raw observation in Finnish
 */
export async function transcribeObservation(rawText: string, category: string): Promise<string> {
  const data = await post<{ result: string }>('/transcribe', { rawText, category });
  return data.result;
}

/**
 * Adds technical theory and building regulations to an observation
 */
export async function addTechnicalTheory(observation: string, category: string): Promise<string> {
  const data = await post<{ result: string }>('/add-theory', { observation, category });
  return data.result;
}

/**
 * Generates an AI caption for a building inspection photo
 */
export async function generatePhotoCaption(
  imageBase64: string,
  mediaType: string,
  category: string
): Promise<string> {
  const data = await post<{ caption: string }>('/photo-caption', {
    imageBase64,
    mediaType,
    category,
  });
  return data.caption;
}

/**
 * Generates a findings summary table from all observations
 */
export async function generateFindingsSummary(
  observations: Array<{ category: string; text: string }>
): Promise<string> {
  const data = await post<{ result: string }>('/findings-summary', { observations });
  return data.result;
}

/**
 * Generates the final report summary
 */
export async function generateFinalSummary(reportData: {
  propertyInfo: Record<string, unknown>;
  observations: Array<{ category: string; text: string }>;
  findingsSummary: string;
}): Promise<string> {
  const data = await post<{ result: string }>('/final-summary', reportData);
  return data.result;
}

/**
 * Streams AI processing of an observation; calls onChunk for each text delta
 */
export async function streamProcessObservation(
  rawText: string,
  category: string,
  onChunk: (chunk: string) => void,
  onDone: (fullText: string) => void,
  onError: (error: string) => void
): Promise<void> {
  const response = await fetch(`${API_BASE}/process-observation-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText, category }),
  });

  if (!response.ok || !response.body) {
    onError('Stream connection failed');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.error) {
            onError(data.error);
            return;
          }
          if (data.chunk) {
            onChunk(data.chunk);
          }
          if (data.done && data.fullText) {
            onDone(data.fullText);
          }
        } catch {
          // Skip malformed SSE lines
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW AI APIs: Auto-urgency, batch processing, completeness, checklists
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildingContext {
  buildYear?: string;
  buildingType?: string;
  foundationType?: string;
  wallType?: string;
  roofType?: string;
  heatingSystem?: string;
  ventilationType?: string;
  drainagePipeType?: string;
  waterPipeType?: string;
}

/**
 * AI-powered urgency suggestion for an observation
 */
export async function suggestUrgency(
  observationText: string,
  category: string,
  buildingContext?: BuildingContext
): Promise<{ urgency: string; confidence: number; reasoning: string }> {
  return post('/suggest-urgency', { observationText, category, buildingContext });
}

/**
 * Full AI processing of a single observation in one call
 */
export async function processObservationFull(
  rawText: string,
  category: string,
  buildingContext?: BuildingContext
): Promise<{
  processedText: string;
  withTheory: string;
  urgency: string;
  actionRecommendation: string;
}> {
  return post('/process-observation-full', { rawText, category, buildingContext });
}

/**
 * Batch processes multiple observations at once
 */
export async function batchProcessObservations(
  observations: Array<{ id: string; rawText: string; category: string }>,
  buildingContext?: BuildingContext
): Promise<{
  results: Array<{
    id: string;
    processedText: string;
    withTheory: string;
    urgency: string;
    actionRecommendation: string;
  }>;
}> {
  return post('/batch-process', { observations, buildingContext });
}

/**
 * AI-powered completeness check for the inspection
 */
export async function checkCompleteness(
  categories: Array<{ name: string; observationCount: number }>,
  buildingContext?: BuildingContext
): Promise<{
  completenessPercent: number;
  missingAreas: Array<{ area: string; importance: 'critical' | 'recommended' | 'optional'; reason: string }>;
  overallAssessment: string;
}> {
  return post('/check-completeness', { categories, buildingContext });
}

/**
 * Generates AI-powered checklist for an inspection category
 */
export async function generateCategoryChecklist(
  categoryName: string,
  categoryDescription: string,
  buildingContext?: BuildingContext
): Promise<{
  checklist: Array<{ item: string; priority: 'high' | 'medium' | 'low'; hint: string }>;
}> {
  return post('/generate-checklist', { categoryName, categoryDescription, buildingContext });
}

/**
 * Enhanced photo analysis with defect detection
 */
export async function analyzePhotoDefects(
  imageBase64: string,
  mediaType: string,
  category: string,
  buildingContext?: BuildingContext
): Promise<{
  caption: string;
  defectsFound: boolean;
  defects: Array<{ description: string; severity: 'high' | 'medium' | 'low' }>;
  suggestedObservation: string;
}> {
  return post('/analyze-photo', { imageBase64, mediaType, category, buildingContext });
}

/**
 * Generates observation templates from detected risk structures
 */
export async function generateRiskObservations(
  risks: Array<{ name: string; description: string; severity: string; recommendation: string }>,
  buildingContext?: BuildingContext
): Promise<{
  observations: Array<{
    riskName: string;
    category: string;
    observationTemplate: string;
    urgency: string;
  }>;
}> {
  return post('/generate-risk-observations', { risks, buildingContext });
}
