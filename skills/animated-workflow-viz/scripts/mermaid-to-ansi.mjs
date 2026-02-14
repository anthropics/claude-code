/**
 * mermaid-to-ansi.mjs — Bridge between @vercel/beautiful-mermaid and ANSI color
 *
 * Takes mermaid source text, renders it to ASCII via beautiful-mermaid,
 * then injects ANSI truecolor codes based on node category detection.
 *
 * Node categories are detected from:
 * 1. ID prefix convention: agent_*, tool_*, hook_*, param_*, event_*
 * 2. Subgraph names containing category keywords
 * 3. Explicit category map passed as option
 */

import {
  ANSI,
  CATEGORY_COLORS,
  UI_COLORS,
  colorize,
  stripAnsi,
  detectCapabilities,
} from './ansi-animator.mjs';

// ─── Category Detection ────────────────────────────────────────────────────

const CATEGORY_PREFIXES = ['agent', 'tool', 'hook', 'param', 'event'];

const CATEGORY_KEYWORDS = {
  agent:  ['agent', 'orchestrat', 'dispatch', 'claude', 'sdk'],
  tool:   ['tool', 'fetch', 'parse', 'scan', 'extract', 'validate', 'generate', 'build'],
  hook:   ['hook', 'session', 'trigger', 'pre-', 'post-', 'on_'],
  param:  ['param', 'config', 'keyword', 'setting', 'option', 'flag'],
  event:  ['event', 'complete', 'start', 'finish', 'emit', 'signal', 'ship', 'push'],
};

/**
 * Detect category for a node ID based on prefix convention or keyword matching.
 *
 * @param {string} nodeId - The mermaid node ID
 * @param {string} nodeLabel - The node's display label (if different from ID)
 * @param {object} categoryMap - Explicit overrides { nodeId: 'category' }
 * @returns {string|null} Category name or null
 */
export function detectCategory(nodeId, nodeLabel = '', categoryMap = {}) {
  // Explicit override takes priority
  if (categoryMap[nodeId]) return categoryMap[nodeId];

  const id = nodeId.toLowerCase();
  const label = nodeLabel.toLowerCase();

  // Check ID prefix: agent_*, tool_*, etc.
  for (const prefix of CATEGORY_PREFIXES) {
    if (id.startsWith(`${prefix}_`) || id.startsWith(`${prefix}-`)) {
      return prefix;
    }
  }

  // Check keywords in ID and label
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (id.includes(kw) || label.includes(kw)) {
        return category;
      }
    }
  }

  return null;
}

/**
 * Parse mermaid source to extract node IDs and their labels.
 * This is a lightweight parser for the purpose of category mapping —
 * the full parsing is done by beautiful-mermaid.
 *
 * @param {string} mermaidSource - Raw mermaid diagram text
 * @returns {Map<string, {label: string, category: string|null}>}
 */
export function extractNodes(mermaidSource, categoryMap = {}) {
  const nodes = new Map();
  const lines = mermaidSource.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Match node definitions: id[label], id(label), id{label}, id([label])
    // Also: id["label"], id["`label`"]
    const nodePatterns = [
      /(\w+)\[([^\]]+)\]/,        // id[label]
      /(\w+)\(([^)]+)\)/,         // id(label)
      /(\w+)\{([^}]+)\}/,         // id{label}
      /(\w+)\[\[([^\]]+)\]\]/,    // id[[label]]
      /(\w+)\(\(([^)]+)\)\)/,     // id((label))
      /(\w+)\[\/([^\]]+)\/\]/,    // id[/label/]
      /(\w+)>\s*([^|;\]]+)/,      // id> label (asymmetric)
    ];

    for (const pattern of nodePatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const [, id, label] = match;
        // Skip mermaid keywords
        if (['graph', 'flowchart', 'subgraph', 'end', 'style', 'classDef', 'class'].includes(id)) continue;

        const cleanLabel = label.replace(/["`]/g, '').trim();
        const category = detectCategory(id, cleanLabel, categoryMap);
        nodes.set(id, { label: cleanLabel, category });
      }
    }

    // Match subgraph titles for category detection
    const subgraphMatch = trimmed.match(/subgraph\s+(\w+)\s*\[?([^\]]*)\]?/);
    if (subgraphMatch) {
      const [, id, label] = subgraphMatch;
      const category = detectCategory(id, label, categoryMap);
      if (category) {
        nodes.set(`subgraph:${id}`, { label: label || id, category });
      }
    }
  }

  return nodes;
}

/**
 * Colorize ASCII-rendered mermaid output by mapping node labels to their
 * category colors.
 *
 * @param {string} asciiOutput - Output from renderMermaidAscii()
 * @param {Map} nodeMap - Node map from extractNodes()
 * @param {object} opts - Options
 * @param {string[]} opts.completedPhases - Phase node IDs that are completed
 * @param {string[]} opts.activePhase - Currently active phase node ID
 * @returns {string} ASCII with ANSI color codes injected
 */
export function colorizeAscii(asciiOutput, nodeMap, opts = {}) {
  const caps = opts.capabilities || detectCapabilities();
  if (!caps.color) return asciiOutput;

  const { completedPhases = [], activePhase = null } = opts;

  let result = asciiOutput;

  // Sort nodes by label length descending to avoid partial replacements
  const sortedNodes = [...nodeMap.entries()]
    .filter(([id]) => !id.startsWith('subgraph:'))
    .sort((a, b) => b[1].label.length - a[1].label.length);

  for (const [id, { label, category }] of sortedNodes) {
    if (!label) continue;

    // Determine color based on state
    let nodeCategory = category || 'default';
    let nodeOpts = { capabilities: caps };

    if (completedPhases.includes(id)) {
      nodeOpts.bold = true;
      nodeCategory = 'green';
    } else if (activePhase === id) {
      nodeOpts.bold = true;
      // Keep original category color but make it bold
    } else if (completedPhases.length > 0 && !completedPhases.includes(id) && activePhase !== id) {
      // If some phases are complete, dim the pending ones
      nodeOpts.dim = true;
    }

    // Replace the label text with colorized version
    // Be careful to only replace within box boundaries (not edge labels)
    const escapedLabel = escapeRegex(label);
    const labelRegex = new RegExp(escapedLabel, 'g');

    result = result.replace(labelRegex, (match) => {
      return colorize(match, nodeCategory, nodeOpts);
    });
  }

  // Colorize box-drawing characters (border color)
  if (caps.unicode) {
    const boxChars = /([╭╮╰╯│─┌┐└┘├┤┬┴┼]+)/g;
    result = result.replace(boxChars, (match) => {
      return colorize(match, 'border', { capabilities: caps });
    });
  }

  // Colorize arrow characters
  const arrowRegex = /(──+>|--+>|═══+>|-->|→|◆|►)/g;
  result = result.replace(arrowRegex, (match) => {
    return colorize(match, 'dim', { capabilities: caps });
  });

  return result;
}

/**
 * Full pipeline: mermaid source → colorized ASCII string.
 *
 * This is the main entry point. It:
 * 1. Extracts node info from mermaid source
 * 2. Renders ASCII via beautiful-mermaid (or fallback)
 * 3. Injects ANSI color codes
 *
 * @param {string} mermaidSource - Mermaid diagram source
 * @param {object} opts - Options
 * @param {object} opts.categoryMap - Explicit category overrides
 * @param {boolean} opts.useAscii - Pure ASCII (no Unicode box-drawing)
 * @param {string[]} opts.completedPhases - Completed phase IDs
 * @param {string} opts.activePhase - Active phase ID
 * @param {Function} opts.renderFn - Custom render function (for testing)
 * @returns {Promise<string>} Colorized ASCII diagram
 */
export async function renderColorizedMermaid(mermaidSource, opts = {}) {
  const { categoryMap = {}, useAscii = false, renderFn } = opts;
  const caps = opts.capabilities || detectCapabilities();

  // Extract node information for category coloring
  const nodeMap = extractNodes(mermaidSource, categoryMap);

  // Render to ASCII using beautiful-mermaid (or fallback)
  let asciiOutput;
  if (renderFn) {
    asciiOutput = await renderFn(mermaidSource, { useAscii });
  } else {
    try {
      const { renderMermaidAscii } = await import('@vercel/beautiful-mermaid');
      asciiOutput = renderMermaidAscii(mermaidSource, { useAscii });
    } catch {
      // Fallback: render a simple text representation
      asciiOutput = fallbackRender(mermaidSource, nodeMap);
    }
  }

  // Inject ANSI color codes
  return colorizeAscii(asciiOutput, nodeMap, {
    capabilities: caps,
    completedPhases: opts.completedPhases,
    activePhase: opts.activePhase,
  });
}

// ─── Fallback Renderer ─────────────────────────────────────────────────────

/**
 * Simple fallback renderer when beautiful-mermaid is not installed.
 * Produces a basic box-and-arrow diagram from parsed node info.
 */
function fallbackRender(mermaidSource, nodeMap) {
  const caps = detectCapabilities();
  const lines = mermaidSource.split('\n');
  const output = [];
  const h = caps.unicode ? '─' : '-';
  const v = caps.unicode ? '│' : '|';
  const tl = caps.unicode ? '┌' : '+';
  const tr = caps.unicode ? '┐' : '+';
  const bl = caps.unicode ? '└' : '+';
  const br = caps.unicode ? '┘' : '+';
  const arrow = caps.unicode ? ' ──▶ ' : ' --> ';
  const darrow = caps.unicode ? '  │' : '  |';
  const arrowDown = caps.unicode ? '  ▼' : '  v';

  // Detect direction from first line
  const firstLine = lines[0]?.trim() || '';
  const isLR = firstLine.includes('LR') || firstLine.includes('RL');

  // Collect edges
  const edges = [];
  for (const line of lines) {
    const edgeMatch = line.trim().match(/(\w+)\s*--+>?\|?([^|]*)\|?\s*(\w+)/);
    if (edgeMatch) {
      edges.push({ from: edgeMatch[1], label: edgeMatch[2]?.trim(), to: edgeMatch[3] });
    }
  }

  // Build ordered node list from edges
  const ordered = [];
  const seen = new Set();
  for (const edge of edges) {
    if (!seen.has(edge.from)) { ordered.push(edge.from); seen.add(edge.from); }
    if (!seen.has(edge.to)) { ordered.push(edge.to); seen.add(edge.to); }
  }

  // Add nodes not in edges
  for (const [id] of nodeMap) {
    if (!id.startsWith('subgraph:') && !seen.has(id)) {
      ordered.push(id);
    }
  }

  if (isLR) {
    // Horizontal layout
    const nodeStrs = ordered.map(id => {
      const info = nodeMap.get(id);
      const label = info?.label || id;
      const w = label.length + 4;
      return {
        top: `${tl}${h.repeat(w)}${tr}`,
        mid: `${v} ${label} ${v}`,
        bot: `${bl}${h.repeat(w)}${br}`,
      };
    });

    const topLine = nodeStrs.map(n => n.top).join(arrow);
    const midLine = nodeStrs.map(n => n.mid).join(arrow);
    const botLine = nodeStrs.map(n => n.bot).join('     ');

    output.push(topLine, midLine, botLine);
  } else {
    // Vertical layout (default)
    for (let i = 0; i < ordered.length; i++) {
      const id = ordered[i];
      const info = nodeMap.get(id);
      const label = info?.label || id;
      const w = label.length + 4;

      output.push(`  ${tl}${h.repeat(w)}${tr}`);
      output.push(`  ${v} ${label} ${v}`);
      output.push(`  ${bl}${h.repeat(w)}${br}`);

      if (i < ordered.length - 1) {
        output.push(darrow);
        output.push(arrowDown);
      }
    }
  }

  return output.join('\n');
}

// ─── Utilities ─────────────────────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
