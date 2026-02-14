import type {
  VersionBlock,
  FeatureConfig,
  Era,
  DiagramSpec,
  ParsedFeature,
} from "./types";
import { assignEras } from "./changelog-parser";

/**
 * Generate all mermaid diagram specs for a parsed feature.
 *
 * Produces:
 * 1. Architecture flowchart — system objects and their relationships
 * 2. Sequence diagram — interaction lifecycle
 * 3. Per-era flowcharts — for animated transitions showing feature growth
 */
export function generateDiagrams(
  versions: VersionBlock[],
  config: FeatureConfig
): {
  architecture: DiagramSpec;
  sequence: DiagramSpec;
  eraSpecs: DiagramSpec[];
} {
  const versionToEra = assignEras(versions, config);

  // Group changes by era
  const eraChanges = new Map<string, VersionBlock[]>();
  for (const era of config.eras) {
    eraChanges.set(era.id, []);
  }
  for (const block of versions) {
    const eraId = versionToEra.get(block.version);
    if (eraId && eraChanges.has(eraId)) {
      eraChanges.get(eraId)!.push(block);
    }
  }

  // Collect all unique identifiers across the feature
  const allIdentifiers = collectIdentifiers(versions);

  // Generate architecture diagram
  const architecture = generateArchitectureDiagram(allIdentifiers, config);

  // Generate sequence diagram
  const sequence = generateSequenceDiagram(allIdentifiers, config);

  // Generate per-era progressive diagrams
  const eraSpecs = generateEraProgressionDiagrams(
    eraChanges,
    config,
    allIdentifiers
  );

  return { architecture, sequence, eraSpecs };
}

/**
 * Collect all unique identifiers mentioned across version blocks.
 */
function collectIdentifiers(versions: VersionBlock[]): Set<string> {
  const ids = new Set<string>();
  for (const block of versions) {
    for (const change of block.changes) {
      for (const id of change.identifiers) {
        ids.add(id);
      }
    }
  }
  return ids;
}

/**
 * Generate the main architecture flowchart showing all system objects.
 */
function generateArchitectureDiagram(
  identifiers: Set<string>,
  config: FeatureConfig
): DiagramSpec {
  const nodes = categorizeIdentifiers(identifiers);
  const lines: string[] = ["graph TD"];

  // Core node
  lines.push(`  CORE[("${config.name}")]`);
  lines.push(`  style CORE fill:#6e40c9,stroke:#8b5cf6,color:#fff`);

  // Category subgraphs
  for (const [category, items] of Object.entries(nodes)) {
    if (items.length === 0) continue;
    const catId = category.replace(/\s/g, "_");
    lines.push(`  subgraph ${catId}["${category}"]`);
    for (const item of items) {
      const nodeId = sanitizeId(item);
      lines.push(`    ${nodeId}["${item}"]`);
    }
    lines.push("  end");
    // Connect core to subgraph items
    for (const item of items) {
      lines.push(`  CORE --> ${sanitizeId(item)}`);
    }
  }

  return {
    type: "flowchart",
    title: `${config.name} Architecture`,
    source: lines.join("\n"),
  };
}

/**
 * Generate a sequence diagram showing the feature's interaction lifecycle.
 */
function generateSequenceDiagram(
  identifiers: Set<string>,
  config: FeatureConfig
): DiagramSpec {
  const nodes = categorizeIdentifiers(identifiers);
  const lines: string[] = ["sequenceDiagram"];

  // Define participants from categories
  const participants = Object.entries(nodes)
    .filter(([, items]) => items.length > 0)
    .map(([cat]) => cat);

  lines.push(`  participant User`);
  lines.push(`  participant ${config.name}`);
  for (const p of participants.slice(0, 4)) {
    lines.push(`  participant ${p.replace(/\s/g, "_")}`);
  }

  // Generate interactions based on change types
  lines.push(`  User->>${config.name}: Configure`);
  for (const p of participants.slice(0, 4)) {
    const pid = p.replace(/\s/g, "_");
    lines.push(`  ${config.name}->>${pid}: Initialize`);
    lines.push(`  ${pid}-->>${config.name}: Ready`);
  }
  lines.push(`  ${config.name}->>User: Active`);

  return {
    type: "sequence",
    title: `${config.name} Lifecycle`,
    source: lines.join("\n"),
  };
}

/**
 * Generate progressive era diagrams that show the feature growing over time.
 * Each era builds on the previous, adding new nodes/connections.
 */
function generateEraProgressionDiagrams(
  eraChanges: Map<string, VersionBlock[]>,
  config: FeatureConfig,
  allIdentifiers: Set<string>
): DiagramSpec[] {
  const specs: DiagramSpec[] = [];
  const cumulativeIds = new Set<string>();

  for (const era of config.eras) {
    const blocks = eraChanges.get(era.id) ?? [];

    // Add identifiers from this era
    for (const block of blocks) {
      for (const change of block.changes) {
        for (const id of change.identifiers) {
          cumulativeIds.add(id);
        }
      }
    }

    // Build progressive flowchart
    const lines: string[] = ["graph TD"];
    lines.push(`  CORE[("${config.name}")]`);
    lines.push(
      `  style CORE fill:${era.color},stroke:${era.accent},color:#fff`
    );

    const nodes = categorizeIdentifiers(cumulativeIds);
    for (const [category, items] of Object.entries(nodes)) {
      if (items.length === 0) continue;
      const catId = category.replace(/\s/g, "_");
      lines.push(`  subgraph ${catId}["${category}"]`);
      for (const item of items) {
        lines.push(`    ${sanitizeId(item)}["${item}"]`);
      }
      lines.push("  end");
      for (const item of items) {
        lines.push(`  CORE --> ${sanitizeId(item)}`);
      }
    }

    // Add era label
    lines.push(
      `  ERA_LABEL["${era.label} Era\\n${blocks.length} releases"]`
    );
    lines.push(
      `  style ERA_LABEL fill:${era.color},stroke:none,color:#fff`
    );

    specs.push({
      type: "flowchart",
      title: `${config.name} — ${era.label}`,
      source: lines.join("\n"),
      era: era.id,
    });
  }

  return specs;
}

/**
 * Categorize identifiers into logical groups based on naming patterns.
 */
function categorizeIdentifiers(
  ids: Set<string>
): Record<string, string[]> {
  const categories: Record<string, string[]> = {
    Configuration: [],
    Events: [],
    Types: [],
    Commands: [],
    Other: [],
  };

  for (const id of ids) {
    const lower = id.toLowerCase();
    if (
      lower.includes("config") ||
      lower.includes("option") ||
      lower.includes("setting") ||
      lower.includes("param")
    ) {
      categories.Configuration.push(id);
    } else if (
      lower.includes("event") ||
      lower.includes("hook") ||
      lower.includes("on") ||
      lower.includes("start") ||
      lower.includes("stop") ||
      lower.includes("end")
    ) {
      categories.Events.push(id);
    } else if (
      lower.startsWith("i") ||
      lower.includes("type") ||
      lower.includes("interface") ||
      lower.includes("schema")
    ) {
      categories.Types.push(id);
    } else if (
      lower.includes("command") ||
      lower.includes("action") ||
      lower.includes("run") ||
      lower.includes("execute")
    ) {
      categories.Commands.push(id);
    } else {
      categories.Other.push(id);
    }
  }

  return categories;
}

function sanitizeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "_");
}

/**
 * Generate a mermaid source string for a complete feature visualization,
 * suitable for rendering with beautiful-mermaid.
 */
export function featureToMermaid(feature: ParsedFeature): string {
  return feature.architectureMermaid;
}
