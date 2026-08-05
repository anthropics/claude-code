// ─────────────────────────────────────────────────────────────────────────────
// Learning Store: Local-first storage for AI correction tracking
// Stores corrections in localStorage, syncs to backend when online
// ─────────────────────────────────────────────────────────────────────────────

const LEARNING_KEY = 'ai_learning_corrections';
const UNSYNCED_KEY = 'ai_learning_unsynced';

export interface LocalCorrection {
  original: string;
  corrected: string;
  category: string;
  field: string;
  timestamp: string;
  synced: boolean;
}

export interface LearningData {
  userId: string;
  corrections: LocalCorrection[];
}

function loadLearningData(): LearningData {
  try {
    const raw = localStorage.getItem(LEARNING_KEY);
    return raw ? JSON.parse(raw) : { userId: '', corrections: [] };
  } catch {
    return { userId: '', corrections: [] };
  }
}

function saveLearningData(data: LearningData): void {
  localStorage.setItem(LEARNING_KEY, JSON.stringify(data));
}

/**
 * Record a correction: when user edits AI-generated text
 */
export function recordCorrection(
  original: string,
  corrected: string,
  category: string,
  field: string = 'processedText'
): void {
  // Skip if texts are identical (no actual correction)
  if (original.trim() === corrected.trim()) return;

  const data = loadLearningData();
  const correction: LocalCorrection = {
    original,
    corrected,
    category,
    field,
    timestamp: new Date().toISOString(),
    synced: false,
  };

  data.corrections.push(correction);

  // Keep max 200 corrections locally
  if (data.corrections.length > 200) {
    data.corrections = data.corrections.slice(-200);
  }

  saveLearningData(data);

  // Track unsynced count
  const unsyncedCount = data.corrections.filter(c => !c.synced).length;
  localStorage.setItem(UNSYNCED_KEY, String(unsyncedCount));
}

/**
 * Get recent corrections for a category (for local few-shot display)
 */
export function getRecentCorrections(category?: string, limit: number = 10): LocalCorrection[] {
  const data = loadLearningData();
  let corrections = data.corrections;

  if (category) {
    corrections = corrections.filter(c => c.category === category);
  }

  return corrections.slice(-limit);
}

/**
 * Get unsynced corrections for batch sync to backend
 */
export function getUnsyncedCorrections(): LocalCorrection[] {
  const data = loadLearningData();
  return data.corrections.filter(c => !c.synced);
}

/**
 * Mark corrections as synced after successful backend sync
 */
export function markAsSynced(count: number): void {
  const data = loadLearningData();
  let marked = 0;
  for (const c of data.corrections) {
    if (!c.synced && marked < count) {
      c.synced = true;
      marked++;
    }
  }
  saveLearningData(data);
  localStorage.setItem(UNSYNCED_KEY, '0');
}

/**
 * Get total corrections count
 */
export function getCorrectionStats(): { total: number; unsynced: number; categories: Record<string, number> } {
  const data = loadLearningData();
  const categories: Record<string, number> = {};
  let unsynced = 0;

  for (const c of data.corrections) {
    categories[c.category] = (categories[c.category] || 0) + 1;
    if (!c.synced) unsynced++;
  }

  return { total: data.corrections.length, unsynced, categories };
}

/**
 * Set the user ID for learning data
 */
export function setLearningUserId(userId: string): void {
  const data = loadLearningData();
  data.userId = userId;
  saveLearningData(data);
}

/**
 * Sync corrections to backend
 */
export async function syncCorrectionsToBackend(authToken: string): Promise<{ synced: number }> {
  const unsynced = getUnsyncedCorrections();
  if (unsynced.length === 0) return { synced: 0 };

  const response = await fetch('/api/learning/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      corrections: unsynced.map(c => ({
        original: c.original,
        corrected: c.corrected,
        category: c.category,
        field: c.field,
        timestamp: c.timestamp,
      })),
    }),
  });

  if (!response.ok) throw new Error('Sync failed');

  const result = await response.json();
  markAsSynced(unsynced.length);
  return { synced: result.synced };
}
