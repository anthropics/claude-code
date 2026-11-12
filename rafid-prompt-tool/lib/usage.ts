import { DAILY_LIMIT, type UsageRecord } from "./types";

const STORAGE_KEY = "rafid_prompt_usage";

/** YYYY-MM-DD in UTC so the rollover is consistent. */
export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeRead(): UsageRecord | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.count === "number" &&
      typeof parsed.date === "string"
    ) {
      return parsed as UsageRecord;
    }
    return null;
  } catch {
    return null;
  }
}

function safeWrite(record: UsageRecord): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Private mode / quota / disabled — swallow silently.
  }
}

/**
 * Read usage, auto-resetting the count if the stored date is not today.
 * Returns a fresh record for the current day if nothing exists.
 */
export function readUsage(): UsageRecord {
  const today = todayUTC();
  const current = safeRead();
  if (!current || current.date !== today) {
    const fresh: UsageRecord = { count: 0, date: today };
    safeWrite(fresh);
    return fresh;
  }
  return current;
}

/** Increment today's usage counter by 1 and persist. Returns the new record. */
export function incrementUsage(): UsageRecord {
  const current = readUsage();
  const next: UsageRecord = {
    count: current.count + 1,
    date: current.date,
  };
  safeWrite(next);
  return next;
}

export function isAtLimit(usage: UsageRecord | null): boolean {
  if (!usage) return false;
  return usage.count >= DAILY_LIMIT;
}

export function remainingUses(usage: UsageRecord | null): number {
  if (!usage) return DAILY_LIMIT;
  return Math.max(0, DAILY_LIMIT - usage.count);
}
