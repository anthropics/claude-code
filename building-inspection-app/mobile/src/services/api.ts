import { getToken } from './authService';
import { BuildingContext } from '../types';
import { API_BASE } from './config';

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function transcribeObservation(rawText: string, category: string): Promise<string> {
  const data = await post<{ result: string }>('/transcribe', { rawText, category });
  return data.result;
}

export async function addTechnicalTheory(observation: string, category: string): Promise<string> {
  const data = await post<{ result: string }>('/add-theory', { observation, category });
  return data.result;
}

export async function generatePhotoCaption(
  imageBase64: string,
  mediaType: string,
  category: string
): Promise<string> {
  const data = await post<{ caption: string }>('/photo-caption', { imageBase64, mediaType, category });
  return data.caption;
}

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

export async function generateFindingsSummary(
  observations: Array<{ category: string; text: string }>
): Promise<string> {
  const data = await post<{ result: string }>('/findings-summary', { observations });
  return data.result;
}

export async function generateFinalSummary(reportData: {
  propertyInfo: Record<string, unknown>;
  observations: Array<{ category: string; text: string }>;
  findingsSummary: string;
}): Promise<string> {
  const data = await post<{ result: string }>('/final-summary', reportData);
  return data.result;
}

export async function checkCompleteness(
  categories: Array<{ name: string; observationCount: number }>,
  buildingContext?: BuildingContext
): Promise<{
  completenessPercent: number;
  missingAreas: Array<{ area: string; importance: string; reason: string }>;
  overallAssessment: string;
}> {
  return post('/check-completeness', { categories, buildingContext });
}

export async function generateCategoryChecklist(
  categoryName: string,
  categoryDescription: string,
  buildingContext?: BuildingContext
): Promise<{
  checklist: Array<{ item: string; priority: 'high' | 'medium' | 'low'; hint: string }>;
}> {
  return post('/generate-checklist', { categoryName, categoryDescription, buildingContext });
}

export async function analyzePhotoDefects(
  imageBase64: string,
  mediaType: string,
  category: string,
  buildingContext?: BuildingContext
): Promise<{
  caption: string;
  defectsFound: boolean;
  defects: Array<{ description: string; severity: string }>;
  suggestedObservation: string;
}> {
  return post('/analyze-photo', { imageBase64, mediaType, category, buildingContext });
}
