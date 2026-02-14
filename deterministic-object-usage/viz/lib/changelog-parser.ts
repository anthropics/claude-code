import type { ChangeEntry, ChangeType, VersionBlock, FeatureConfig } from "./types";

/**
 * Parse a CHANGELOG.md string into structured version blocks.
 *
 * Expects the standard Keep-a-Changelog format:
 *   ## X.Y.Z
 *   ### Added / Fixed / Changed / Breaking
 *   - Entry text
 */
export function parseChangelog(raw: string): VersionBlock[] {
  const blocks: VersionBlock[] = [];
  let current: VersionBlock | null = null;
  let currentType: ChangeType = "added";

  for (const line of raw.split("\n")) {
    // Version header: ## 1.2.3 or ## 1.2.3 - 2024-01-15
    const versionMatch = line.match(
      /^## (\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)(?:\s*[-–]\s*(.+))?/
    );
    if (versionMatch) {
      current = {
        version: versionMatch[1],
        date: versionMatch[2]?.trim(),
        changes: [],
      };
      blocks.push(current);
      currentType = "added";
      continue;
    }

    // Change type header: ### Added, ### Fixed, etc.
    const typeMatch = line.match(/^### (Added|Fixed|Changed|Breaking)/i);
    if (typeMatch) {
      currentType = typeMatch[1].toLowerCase() as ChangeType;
      continue;
    }

    // Change entry: - Some description
    const entryMatch = line.match(/^[-*]\s+(.+)/);
    if (entryMatch && current) {
      const text = entryMatch[1].trim();
      const identifiers = extractIdentifiers(text);
      current.changes.push({ type: currentType, text, identifiers });
    }
  }

  return blocks;
}

/**
 * Extract code identifiers from a changelog entry.
 * Matches backtick-wrapped tokens and camelCase/PascalCase words.
 */
function extractIdentifiers(text: string): string[] {
  const ids = new Set<string>();

  // Backtick-wrapped identifiers: `someIdentifier`
  const backtickMatches = text.matchAll(/`([^`]+)`/g);
  for (const m of backtickMatches) {
    ids.add(m[1]);
  }

  // CamelCase/PascalCase identifiers (3+ chars, not common English)
  const camelMatches = text.matchAll(/\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g);
  for (const m of camelMatches) {
    ids.add(m[1]);
  }

  return [...ids];
}

/**
 * Filter version blocks to only include entries matching a feature config.
 * Implements the 4-tier keyword matching from the deterministic process:
 *   1. Exact substring match (primary keywords)
 *   2. Related object match (context keywords requiring co-occurrence)
 *   3. Identifier match (backtick tokens matching keywords)
 *   4. Exclude false positives
 */
export function filterForFeature(
  blocks: VersionBlock[],
  config: FeatureConfig
): VersionBlock[] {
  const filtered: VersionBlock[] = [];

  for (const block of blocks) {
    const matchingChanges = block.changes.filter((entry) =>
      entryMatchesFeature(entry, config)
    );

    if (matchingChanges.length > 0) {
      filtered.push({
        ...block,
        changes: matchingChanges,
      });
    }
  }

  return filtered;
}

function entryMatchesFeature(
  entry: ChangeEntry,
  config: FeatureConfig
): boolean {
  const textLower = entry.text.toLowerCase();

  // Tier 4: Exclude false positives first
  if (config.excludePatterns) {
    for (const pattern of config.excludePatterns) {
      if (textLower.includes(pattern.toLowerCase())) {
        return false;
      }
    }
  }

  // Tier 1: Exact substring match on primary keywords
  for (const keyword of config.keywords) {
    if (textLower.includes(keyword.toLowerCase())) {
      return true;
    }
  }

  // Tier 2: Context keywords — must match AND have a primary keyword nearby
  if (config.contextKeywords) {
    for (const ctx of config.contextKeywords) {
      if (textLower.includes(ctx.toLowerCase())) {
        // Check if any primary keyword is also in the text
        for (const keyword of config.keywords) {
          if (textLower.includes(keyword.toLowerCase())) {
            return true;
          }
        }
      }
    }
  }

  // Tier 3: Identifier match — backtick tokens matching keywords
  for (const id of entry.identifiers) {
    const idLower = id.toLowerCase();
    for (const keyword of config.keywords) {
      if (idLower.includes(keyword.toLowerCase())) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Assign versions to eras based on the feature config's era definitions.
 */
export function assignEras(
  blocks: VersionBlock[],
  config: FeatureConfig
): Map<string, string> {
  const versionToEra = new Map<string, string>();

  for (const era of config.eras) {
    for (const version of era.versions) {
      versionToEra.set(version, era.id);
    }
  }

  // Auto-assign unmatched versions to the closest era by version range
  for (const block of blocks) {
    if (!versionToEra.has(block.version)) {
      const closest = findClosestEra(block.version, config.eras);
      if (closest) {
        versionToEra.set(block.version, closest);
      }
    }
  }

  return versionToEra;
}

function findClosestEra(version: string, eras: Era[]): string | null {
  const parts = version.split(".").map(Number);
  const vNum = parts[0] * 10000 + parts[1] * 100 + (parts[2] || 0);

  let bestEra: string | null = null;
  let bestDist = Infinity;

  for (const era of eras) {
    for (const eraVersion of era.versions) {
      const eParts = eraVersion.split(".").map(Number);
      const eNum = eParts[0] * 10000 + eParts[1] * 100 + (eParts[2] || 0);
      const dist = Math.abs(vNum - eNum);
      if (dist < bestDist) {
        bestDist = dist;
        bestEra = era.id;
      }
    }
  }

  return bestEra;
}
