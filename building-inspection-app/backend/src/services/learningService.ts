// ─────────────────────────────────────────────────────────────────────────────
// Learning service: stores per-user AI correction history
// Used to provide few-shot examples for personalized AI responses
// ─────────────────────────────────────────────────────────────────────────────

export interface CorrectionEntry {
  id: string;
  original: string;    // AI-generated text
  corrected: string;   // User's edited version
  category: string;    // Inspection category (katto, alapohja, etc.)
  field: string;       // Which field was corrected (processedText, withTheory, etc.)
  timestamp: string;
}

export interface UserLearningProfile {
  userId: string;
  corrections: CorrectionEntry[];
  preferences: Record<string, string>; // category-level style preferences
  lastSyncedAt: string;
}

// In-memory store (production: replace with database)
const learningProfiles: Map<string, UserLearningProfile> = new Map();

export function getProfile(userId: string): UserLearningProfile {
  if (!learningProfiles.has(userId)) {
    learningProfiles.set(userId, {
      userId,
      corrections: [],
      preferences: {},
      lastSyncedAt: new Date().toISOString(),
    });
  }
  return learningProfiles.get(userId)!;
}

export function addCorrection(userId: string, correction: Omit<CorrectionEntry, 'id'>): CorrectionEntry {
  const profile = getProfile(userId);
  const entry: CorrectionEntry = {
    ...correction,
    id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };

  profile.corrections.push(entry);

  // Keep max 200 corrections per user
  if (profile.corrections.length > 200) {
    profile.corrections = profile.corrections.slice(-200);
  }

  profile.lastSyncedAt = new Date().toISOString();
  return entry;
}

export function addCorrectionsBatch(userId: string, corrections: Omit<CorrectionEntry, 'id'>[]): number {
  let added = 0;
  for (const c of corrections) {
    addCorrection(userId, c);
    added++;
  }
  return added;
}

export function getRecentCorrections(userId: string, category?: string, limit: number = 10): CorrectionEntry[] {
  const profile = getProfile(userId);
  let corrections = profile.corrections;

  if (category) {
    corrections = corrections.filter(c => c.category === category);
  }

  return corrections.slice(-limit);
}

export function buildFewShotExamples(userId: string, category: string, limit: number = 5): string {
  const corrections = getRecentCorrections(userId, category, limit);

  if (corrections.length === 0) return '';

  const examples = corrections.map((c, i) =>
    `Esimerkki ${i + 1}:\nAI kirjoitti: "${c.original}"\nTarkastaja korjasi: "${c.corrected}"`
  ).join('\n\n');

  return `\n\nKAYTTAJAN AIEMMAT KORJAUKSET (mukauta tyylisi naiden mukaan):\n${examples}\n\nHuomioi kayttajan tyylipreferenssit yllaolevista korjauksista.`;
}

export function syncFromClient(userId: string, clientCorrections: Omit<CorrectionEntry, 'id'>[]): {
  synced: number;
  profile: UserLearningProfile;
} {
  const synced = addCorrectionsBatch(userId, clientCorrections);
  return { synced, profile: getProfile(userId) };
}

export function getFullProfile(userId: string): UserLearningProfile {
  return getProfile(userId);
}
