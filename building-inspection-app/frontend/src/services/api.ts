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
