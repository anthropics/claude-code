#!/usr/bin/env node
/**
 * ascii-animate.js — Ghostty-style ASCII Frame Animation Engine
 *
 * Renders mermaid diagram structures as animated ASCII art in the terminal
 * using Unicode box-drawing characters and ANSI 256-color escape codes.
 *
 * Architecture:
 *   1. Parse mermaid graph into nodes/edges
 *   2. Compute spatial layout (rank-based for flowcharts)
 *   3. Generate ASCII canvas for each animation frame
 *   4. Play frames at target FPS using cursor repositioning
 *
 * Inspired by:
 *   - beautiful-mermaid (renderMermaidAscii)
 *   - Ghostty terminal ASCII art animation (60fps frame sequences)
 *
 * Usage:
 *   node ascii-animate.js --input diagram.mmd [options]
 *   cat diagram.mmd | node ascii-animate.js [options]
 */

'use strict';

// ─────────────────────────────────────────────────────────────
// ANSI Escape Code Helpers
// ─────────────────────────────────────────────────────────────

const ANSI = {
  reset:      '\x1b[0m',
  bold:       '\x1b[1m',
  dim:        '\x1b[2m',
  italic:     '\x1b[3m',
  underline:  '\x1b[4m',
  cursorHome: '\x1b[H',
  clearScreen:'\x1b[2J',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  fg256: (n) => `\x1b[38;5;${n}m`,
  bg256: (n) => `\x1b[48;5;${n}m`,
  fgRgb: (r, g, b) => `\x1b[38;2;${r};${g};${b}m`,
  bgRgb: (r, g, b) => `\x1b[48;2;${r};${g};${b}m`,
  moveTo: (row, col) => `\x1b[${row};${col}H`,
};

// ─────────────────────────────────────────────────────────────
// Theme Definitions (beautiful-mermaid compatible)
// ─────────────────────────────────────────────────────────────

const THEMES = {
  'vercel-dark': {
    bg: [0, 0, 0],
    fg: [237, 237, 237],
    accent: [0, 112, 243],
    line: [68, 68, 68],
    muted: [136, 136, 136],
    surface: [17, 17, 17],
    border: [51, 51, 51],
    nodeColors: [[0, 112, 243], [124, 58, 237], [236, 72, 153], [234, 179, 8], [16, 185, 129]],
  },
  'vercel-light': {
    bg: [255, 255, 255],
    fg: [0, 0, 0],
    accent: [0, 112, 243],
    line: [212, 212, 212],
    muted: [115, 115, 115],
    surface: [250, 250, 250],
    border: [229, 229, 229],
    nodeColors: [[0, 112, 243], [124, 58, 237], [219, 39, 119], [202, 138, 4], [5, 150, 105]],
  },
  'dracula': {
    bg: [40, 42, 54],
    fg: [248, 248, 242],
    accent: [189, 147, 249],
    line: [68, 71, 90],
    muted: [98, 114, 164],
    surface: [48, 50, 65],
    border: [68, 71, 90],
    nodeColors: [[255, 121, 198], [189, 147, 249], [139, 233, 253], [80, 250, 123], [255, 184, 108]],
  },
  'nord': {
    bg: [46, 52, 64],
    fg: [216, 222, 233],
    accent: [136, 192, 208],
    line: [59, 66, 82],
    muted: [76, 86, 106],
    surface: [59, 66, 82],
    border: [67, 76, 94],
    nodeColors: [[136, 192, 208], [129, 161, 193], [94, 129, 172], [163, 190, 140], [191, 97, 106]],
  },
  'tokyo-night': {
    bg: [26, 27, 38],
    fg: [192, 202, 245],
    accent: [122, 162, 247],
    line: [41, 46, 66],
    muted: [86, 95, 137],
    surface: [36, 40, 59],
    border: [41, 46, 66],
    nodeColors: [[122, 162, 247], [187, 154, 247], [255, 158, 100], [158, 206, 106], [247, 118, 142]],
  },
  'catppuccin-mocha': {
    bg: [30, 30, 46],
    fg: [205, 214, 244],
    accent: [137, 180, 250],
    line: [49, 50, 68],
    muted: [108, 112, 134],
    surface: [36, 39, 58],
    border: [49, 50, 68],
    nodeColors: [[137, 180, 250], [203, 166, 247], [249, 226, 175], [166, 227, 161], [243, 139, 168]],
  },
  'github-dark': {
    bg: [13, 17, 23],
    fg: [230, 237, 243],
    accent: [88, 166, 255],
    line: [48, 54, 61],
    muted: [125, 133, 144],
    surface: [22, 27, 34],
    border: [48, 54, 61],
    nodeColors: [[88, 166, 255], [188, 140, 255], [255, 123, 114], [63, 185, 80], [210, 153, 34]],
  },
  'rose-pine': {
    bg: [25, 23, 36],
    fg: [224, 222, 244],
    accent: [196, 167, 231],
    line: [38, 35, 53],
    muted: [110, 106, 134],
    surface: [30, 28, 44],
    border: [38, 35, 53],
    nodeColors: [[196, 167, 231], [235, 188, 186], [246, 193, 119], [156, 207, 216], [49, 116, 143]],
  },
  'gruvbox-dark': {
    bg: [40, 40, 40],
    fg: [235, 219, 178],
    accent: [250, 189, 47],
    line: [60, 56, 54],
    muted: [146, 131, 116],
    surface: [50, 48, 47],
    border: [60, 56, 54],
    nodeColors: [[250, 189, 47], [184, 187, 38], [211, 134, 155], [142, 192, 124], [254, 128, 25]],
  },
  'monokai': {
    bg: [39, 40, 34],
    fg: [248, 248, 242],
    accent: [102, 217, 239],
    line: [62, 61, 50],
    muted: [117, 113, 94],
    surface: [49, 50, 43],
    border: [62, 61, 50],
    nodeColors: [[249, 38, 114], [102, 217, 239], [166, 226, 46], [253, 151, 31], [174, 129, 255]],
  },
};

// ─────────────────────────────────────────────────────────────
// Box-Drawing Characters
// ─────────────────────────────────────────────────────────────

const BOX = {
  // Rounded corners
  tl: '╭', tr: '╮', bl: '╰', br: '╯',
  // Sharp corners
  TL: '┌', TR: '┐', BL: '└', BR: '┘',
  // Lines
  h: '─', v: '│', H: '═', V: '║',
  // Tees
  teeR: '├', teeL: '┤', teeD: '┬', teeU: '┴', cross: '┼',
  // Arrows
  arrowR: '▶', arrowL: '◀', arrowU: '▲', arrowD: '▼',
  lineArrowR: '→', lineArrowL: '←', lineArrowU: '↑', lineArrowD: '↓',
  // Flow indicators
  dot: '●', dotEmpty: '○', diamond: '◆', diamondEmpty: '◇',
  square: '■', squareEmpty: '□',
  // Blocks for fill effects
  blockFull: '█', blockDark: '▓', blockMed: '▒', blockLight: '░',
};

// ─────────────────────────────────────────────────────────────
// Mermaid Parser (lightweight, handles flowcharts + sequences)
// ─────────────────────────────────────────────────────────────

function parseMermaid(source) {
  const lines = source.trim().split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));
  const firstLine = lines[0].toLowerCase();

  if (firstLine.startsWith('graph') || firstLine.startsWith('flowchart')) {
    return parseFlowchart(lines);
  } else if (firstLine.startsWith('sequencediagram')) {
    return parseSequence(lines);
  } else if (firstLine.startsWith('statediagram')) {
    return parseStateDiagram(lines);
  }
  // Default: treat as flowchart
  return parseFlowchart(lines);
}

function parseFlowchart(lines) {
  const direction = lines[0].match(/(?:graph|flowchart)\s+(TD|TB|LR|RL|BT)/i);
  const dir = direction ? direction[1].toUpperCase() : 'TD';
  const nodes = new Map();
  const edges = [];

  // Helper: find the balanced closing bracket/paren/brace from a position
  function findBalancedEnd(str, start) {
    const open = str[start];
    const closeMap = { '[': ']', '(': ')', '{': '}' };
    const close = closeMap[open];
    if (!close) return -1;
    let depth = 0;
    for (let i = start; i < str.length; i++) {
      if (str[i] === open) depth++;
      else if (str[i] === close) { depth--; if (depth === 0) return i; }
    }
    return -1;
  }

  // Helper: parse a node token with balanced bracket matching
  function parseNodeDecl(str, pos) {
    // Skip whitespace
    while (pos < str.length && str[pos] === ' ') pos++;

    // Read ID: word chars
    const idMatch = str.slice(pos).match(/^(\w+)/);
    if (!idMatch) return null;
    const id = idMatch[1];
    pos += id.length;

    let label = id;
    let shape = 'rect';

    // Check for shape syntax
    if (pos < str.length && '[({'.includes(str[pos])) {
      const shapeStart = pos;
      const end = findBalancedEnd(str, pos);
      if (end > pos) {
        const shapePart = str.slice(shapeStart, end + 1);
        pos = end + 1;

        if (shapePart.startsWith('[/') && shapePart.endsWith('/]')) {
          shape = 'parallelogram';
          label = shapePart.slice(2, -2);
        } else if (shapePart.startsWith('[[') && shapePart.endsWith(']]')) {
          shape = 'subroutine';
          label = shapePart.slice(2, -2);
        } else if (shapePart.startsWith('[') && shapePart.endsWith(']')) {
          shape = 'rect';
          label = shapePart.slice(1, -1);
        } else if (shapePart.startsWith('((') && shapePart.endsWith('))')) {
          shape = 'circle';
          label = shapePart.slice(2, -2);
        } else if (shapePart.startsWith('(') && shapePart.endsWith(')')) {
          shape = 'rounded';
          label = shapePart.slice(1, -1);
        } else if (shapePart.startsWith('{') && shapePart.endsWith('}')) {
          shape = 'diamond';
          label = shapePart.slice(1, -1);
        }

        label = label.replace(/^["']|["']$/g, '');
      }
    }

    return { id, label, shape, endPos: pos };
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('style') || line.startsWith('classDef') || line.startsWith('class ') || line.startsWith('subgraph') || line === 'end') continue;

    // Two-pass: first parse the from-node, then look for an edge arrow, then parse the to-node
    const fromResult = parseNodeDecl(line, 0);
    if (!fromResult) continue;

    // Register the from-node
    if (!nodes.has(fromResult.id) || nodes.get(fromResult.id).label === nodes.get(fromResult.id).id) {
      nodes.set(fromResult.id, { id: fromResult.id, label: fromResult.label, shape: fromResult.shape });
    }

    // Look for edge arrow after the from-node
    const rest = line.slice(fromResult.endPos);
    // Match: -->, -->|label|, ===>, -..-> etc.
    // Mermaid edge syntax: ARROW then optional |label|
    const arrowMatch = rest.match(/^\s*([-=.]+>(?:\|[^|]*\|)?)\s*/);
    if (!arrowMatch) continue; // standalone node declaration, no edge

    const edgeSyntax = arrowMatch[1];
    const afterArrow = fromResult.endPos + arrowMatch[0].length;

    // Parse the to-node
    const toResult = parseNodeDecl(line, afterArrow);
    if (!toResult) continue;

    // Register the to-node
    if (!nodes.has(toResult.id) || nodes.get(toResult.id).label === nodes.get(toResult.id).id) {
      nodes.set(toResult.id, { id: toResult.id, label: toResult.label, shape: toResult.shape });
    }

    const labelMatch = edgeSyntax.match(/\|([^|]*)\|/);
    const label = labelMatch ? labelMatch[1].trim() : '';
    const isDashed = edgeSyntax.includes('.');
    const isThick = edgeSyntax.includes('=');

    edges.push({ from: fromResult.id, to: toResult.id, label, dashed: isDashed, thick: isThick });
  }

  return { type: 'flowchart', direction: dir, nodes: [...nodes.values()], edges };
}

function parseSequence(lines) {
  const participants = [];
  const messages = [];
  const participantSet = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    const partMatch = line.match(/^participant\s+(\w+)(?:\s+as\s+(.+))?/);
    if (partMatch) {
      const id = partMatch[1];
      const label = partMatch[2] || id;
      if (!participantSet.has(id)) {
        participantSet.add(id);
        participants.push({ id, label });
      }
      continue;
    }

    // Messages: A->>B: text, A-->>B: text, A->>+B: text
    const msgMatch = line.match(/^(\w+)\s*(-?->>?\+?-?)\s*(\w+)\s*:\s*(.+)/);
    if (msgMatch) {
      const [, from, arrow, to, text] = msgMatch;
      const isDashed = arrow.startsWith('--');

      for (const id of [from, to]) {
        if (!participantSet.has(id)) {
          participantSet.add(id);
          participants.push({ id, label: id });
        }
      }

      messages.push({ from, to, text: text.trim(), dashed: isDashed });
    }
  }

  return { type: 'sequence', participants, messages };
}

function parseStateDiagram(lines) {
  const states = new Map();
  const transitions = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Transition: StateA --> StateB : label
    const transMatch = line.match(/^(\w+|\[\*\])\s*-->\s*(\w+|\[\*\])\s*(?::\s*(.+))?/);
    if (transMatch) {
      const [, from, to, label] = transMatch;
      const fromId = from === '[*]' ? '__start__' : from;
      const toId = to === '[*]' ? '__end__' : to;

      if (!states.has(fromId)) states.set(fromId, { id: fromId, label: from === '[*]' ? '●' : from });
      if (!states.has(toId)) states.set(toId, { id: toId, label: to === '[*]' ? '●' : to });

      transitions.push({ from: fromId, to: toId, label: (label || '').trim() });
    }
  }

  return { type: 'state', states: [...states.values()], transitions };
}

// ─────────────────────────────────────────────────────────────
// Layout Engine (rank-based positioning)
// ─────────────────────────────────────────────────────────────

function layoutFlowchart(graph, width = 120, nodeWidth = 24) {
  const { nodes, edges, direction } = graph;
  const isVertical = direction === 'TD' || direction === 'TB' || direction === 'BT';

  // Compute ranks via topological sort
  const inDegree = new Map();
  const adjList = new Map();
  nodes.forEach(n => { inDegree.set(n.id, 0); adjList.set(n.id, []); });
  edges.forEach(e => {
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
    adjList.get(e.from)?.push(e.to);
  });

  const rank = new Map();
  const queue = [];
  inDegree.forEach((deg, id) => { if (deg === 0) queue.push(id); });

  let currentRank = 0;
  while (queue.length > 0) {
    const nextQueue = [];
    const thisRank = [...queue];
    thisRank.forEach(id => {
      rank.set(id, currentRank);
      adjList.get(id)?.forEach(neighbor => {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) nextQueue.push(neighbor);
      });
    });
    queue.length = 0;
    queue.push(...nextQueue);
    currentRank++;
  }

  // Handle nodes not reached (cycles) — assign max rank
  nodes.forEach(n => { if (!rank.has(n.id)) rank.set(n.id, currentRank); });

  // Group by rank
  const rankGroups = new Map();
  nodes.forEach(n => {
    const r = rank.get(n.id);
    if (!rankGroups.has(r)) rankGroups.set(r, []);
    rankGroups.get(r).push(n);
  });

  const maxRank = Math.max(...rank.values());
  const positions = new Map();

  if (isVertical) {
    const rowHeight = 6;
    rankGroups.forEach((group, r) => {
      const totalWidth = group.length * (nodeWidth + 4);
      const startX = Math.max(2, Math.floor((width - totalWidth) / 2));
      group.forEach((node, i) => {
        positions.set(node.id, {
          x: startX + i * (nodeWidth + 4),
          y: 2 + r * rowHeight,
          w: nodeWidth,
          h: 3,
        });
      });
    });
  } else {
    const colWidth = nodeWidth + 8;
    rankGroups.forEach((group, r) => {
      const totalHeight = group.length * 5;
      const startY = Math.max(2, Math.floor(((maxRank + 1) * 5 - totalHeight) / 2));
      group.forEach((node, i) => {
        positions.set(node.id, {
          x: 2 + r * colWidth,
          y: startY + i * 5,
          w: nodeWidth,
          h: 3,
        });
      });
    });
  }

  return { positions, maxRank, rankGroups };
}

function layoutSequence(graph, width = 120) {
  const { participants, messages } = graph;
  const colWidth = Math.min(Math.floor((width - 4) / participants.length), 30);
  const positions = new Map();

  participants.forEach((p, i) => {
    positions.set(p.id, {
      x: 2 + i * colWidth + Math.floor(colWidth / 2),
      y: 2,
      colWidth,
    });
  });

  return { positions, colWidth };
}

// ─────────────────────────────────────────────────────────────
// ASCII Canvas
// ─────────────────────────────────────────────────────────────

class AsciiCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.chars = Array.from({ length: height }, () => Array(width).fill(' '));
    this.colors = Array.from({ length: height }, () => Array(width).fill(null));
  }

  set(x, y, ch, color = null) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.chars[y][x] = ch;
      if (color) this.colors[y][x] = color;
    }
  }

  text(x, y, str, color = null) {
    for (let i = 0; i < str.length; i++) {
      this.set(x + i, y, str[i], color);
    }
  }

  hLine(x1, x2, y, ch = BOX.h, color = null) {
    const start = Math.min(x1, x2);
    const end = Math.max(x1, x2);
    for (let x = start; x <= end; x++) {
      this.set(x, y, ch, color);
    }
  }

  vLine(x, y1, y2, ch = BOX.v, color = null) {
    const start = Math.min(y1, y2);
    const end = Math.max(y1, y2);
    for (let y = start; y <= end; y++) {
      this.set(x, y, ch, color);
    }
  }

  box(x, y, w, h, rounded = true, color = null) {
    const tl = rounded ? BOX.tl : BOX.TL;
    const tr = rounded ? BOX.tr : BOX.TR;
    const bl = rounded ? BOX.bl : BOX.BL;
    const br = rounded ? BOX.br : BOX.BR;

    this.set(x, y, tl, color);
    this.set(x + w - 1, y, tr, color);
    this.set(x, y + h - 1, bl, color);
    this.set(x + w - 1, y + h - 1, br, color);
    this.hLine(x + 1, x + w - 2, y, BOX.h, color);
    this.hLine(x + 1, x + w - 2, y + h - 1, BOX.h, color);
    this.vLine(x, y + 1, y + h - 2, BOX.v, color);
    this.vLine(x + w - 1, y + 1, y + h - 2, BOX.v, color);
  }

  diamond(x, y, w, h, color = null) {
    const cx = x + Math.floor(w / 2);
    const cy = y + Math.floor(h / 2);
    this.set(cx, y, BOX.diamondEmpty, color);
    this.set(cx, y + h - 1, BOX.diamondEmpty, color);
    if (w > 2) {
      this.set(x, cy, BOX.diamondEmpty, color);
      this.set(x + w - 1, cy, BOX.diamondEmpty, color);
      this.hLine(x + 1, cx - 1, cy, BOX.h, color);
      this.hLine(cx + 1, x + w - 2, cy, BOX.h, color);
    }
  }

  render(theme) {
    const fgColor = theme ? ANSI.fgRgb(...theme.fg) : '';
    const bgColor = theme ? ANSI.bgRgb(...theme.bg) : '';
    let output = '';

    for (let y = 0; y < this.height; y++) {
      let line = '';
      let prevColor = null;

      for (let x = 0; x < this.width; x++) {
        const color = this.colors[y][x];
        if (color !== prevColor) {
          if (color) {
            line += ANSI.fgRgb(...color);
          } else {
            line += fgColor || ANSI.reset;
          }
          prevColor = color;
        }
        line += this.chars[y][x];
      }

      line += ANSI.reset;
      output += line + '\n';
    }

    return bgColor + output + ANSI.reset;
  }

  clone() {
    const c = new AsciiCanvas(this.width, this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        c.chars[y][x] = this.chars[y][x];
        c.colors[y][x] = this.colors[y][x];
      }
    }
    return c;
  }
}

// ─────────────────────────────────────────────────────────────
// Flowchart Renderer
// ─────────────────────────────────────────────────────────────

function renderFlowchartNode(canvas, node, pos, color) {
  const { x, y, w, h } = pos;
  const labelX = x + Math.max(1, Math.floor((w - node.label.length) / 2));
  const labelY = y + Math.floor(h / 2);

  switch (node.shape) {
    case 'diamond':
      canvas.diamond(x, y, w, h, color);
      canvas.text(labelX, labelY, node.label.slice(0, w - 2), color);
      break;
    case 'rounded':
      canvas.box(x, y, w, h, true, color);
      canvas.text(labelX, labelY, node.label.slice(0, w - 2), color);
      break;
    case 'circle':
      canvas.box(x, y, w, h, true, color);
      canvas.set(x, y, '(', color);
      canvas.set(x + w - 1, y, ')', color);
      canvas.set(x, y + h - 1, '(', color);
      canvas.set(x + w - 1, y + h - 1, ')', color);
      canvas.text(labelX, labelY, node.label.slice(0, w - 2), color);
      break;
    case 'parallelogram':
      canvas.box(x, y, w, h, false, color);
      canvas.set(x, y, '/', color);
      canvas.set(x + w - 1, y + h - 1, '/', color);
      canvas.text(labelX, labelY, node.label.slice(0, w - 2), color);
      break;
    default: // rect
      canvas.box(x, y, w, h, false, color);
      canvas.text(labelX, labelY, node.label.slice(0, w - 2), color);
      break;
  }
}

function renderFlowchartEdge(canvas, fromPos, toPos, edge, color, direction) {
  const isVertical = direction === 'TD' || direction === 'TB' || direction === 'BT';

  if (isVertical) {
    const fromCx = fromPos.x + Math.floor(fromPos.w / 2);
    const fromBy = fromPos.y + fromPos.h;
    const toCx = toPos.x + Math.floor(toPos.w / 2);
    const toTy = toPos.y;

    const midY = Math.floor((fromBy + toTy) / 2);
    const ch = edge.dashed ? '┊' : BOX.v;
    const hch = edge.dashed ? '┈' : BOX.h;

    if (fromCx === toCx) {
      // Straight vertical edge
      canvas.vLine(fromCx, fromBy, toTy - 1, ch, color);
      canvas.set(fromCx, toTy - 1, BOX.arrowD, color);
    } else {
      // L-shaped or Z-shaped edge
      canvas.vLine(fromCx, fromBy, midY, ch, color);
      canvas.hLine(fromCx, toCx, midY, hch, color);
      canvas.vLine(toCx, midY, toTy - 1, ch, color);
      canvas.set(toCx, toTy - 1, BOX.arrowD, color);
      // Corner characters
      canvas.set(fromCx, midY, fromCx < toCx ? BOX.bl : BOX.br, color);
      canvas.set(toCx, midY, fromCx < toCx ? BOX.tr : BOX.tl, color);
    }

    // Edge label
    if (edge.label) {
      const lx = Math.min(fromCx, toCx) + Math.floor(Math.abs(fromCx - toCx) / 2) - Math.floor(edge.label.length / 2);
      canvas.text(Math.max(0, lx), midY - 1, edge.label, color);
    }
  } else {
    // Horizontal layout
    const fromRx = fromPos.x + fromPos.w;
    const fromCy = fromPos.y + Math.floor(fromPos.h / 2);
    const toLx = toPos.x;
    const toCy = toPos.y + Math.floor(toPos.h / 2);
    const ch = edge.dashed ? '┈' : BOX.h;

    if (fromCy === toCy) {
      canvas.hLine(fromRx, toLx - 1, fromCy, ch, color);
      canvas.set(toLx - 1, fromCy, BOX.arrowR, color);
    } else {
      const midX = Math.floor((fromRx + toLx) / 2);
      canvas.hLine(fromRx, midX, fromCy, ch, color);
      canvas.vLine(midX, fromCy, toCy, BOX.v, color);
      canvas.hLine(midX, toLx - 1, toCy, ch, color);
      canvas.set(toLx - 1, toCy, BOX.arrowR, color);
    }

    if (edge.label) {
      const lx = fromRx + Math.floor((toLx - fromRx) / 2) - Math.floor(edge.label.length / 2);
      canvas.text(Math.max(0, lx), fromCy - 1, edge.label, color);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Sequence Diagram Renderer
// ─────────────────────────────────────────────────────────────

function renderSequenceParticipant(canvas, participant, pos, color) {
  const { x, y } = pos;
  const label = participant.label;
  const boxW = Math.max(label.length + 4, 12);
  const boxX = x - Math.floor(boxW / 2);

  canvas.box(boxX, y, boxW, 3, true, color);
  canvas.text(boxX + Math.floor((boxW - label.length) / 2), y + 1, label, color);
}

function renderSequenceLifeline(canvas, pos, height, color) {
  const { x, y } = pos;
  for (let row = y + 3; row < y + 3 + height; row++) {
    canvas.set(x, row, '┊', color);
  }
}

function renderSequenceMessage(canvas, msg, fromPos, toPos, row, color) {
  const fromX = fromPos.x;
  const toX = toPos.x;
  const isRight = toX > fromX;
  const startX = isRight ? fromX + 1 : fromX - 1;
  const endX = isRight ? toX - 1 : toX + 1;
  const ch = msg.dashed ? '┈' : BOX.h;

  canvas.hLine(Math.min(startX, endX), Math.max(startX, endX), row, ch, color);
  canvas.set(isRight ? endX : endX, row, isRight ? BOX.arrowR : BOX.arrowL, color);

  // Message text
  const midX = Math.floor((fromX + toX) / 2) - Math.floor(msg.text.length / 2);
  canvas.text(Math.max(1, midX), row - 1, msg.text, color);
}

// ─────────────────────────────────────────────────────────────
// Frame Generation (Ghostty-style animation)
// ─────────────────────────────────────────────────────────────

function generateFlowchartFrames(graph, theme, width = 120) {
  const layout = layoutFlowchart(graph, width);
  const { positions, rankGroups } = layout;
  const canvasHeight = Math.max(
    ...graph.nodes.map(n => {
      const p = positions.get(n.id);
      return p ? p.y + p.h + 2 : 10;
    }),
    10
  );

  const frames = [];
  const nodeColors = theme.nodeColors;

  // Build frames progressively by rank
  const sortedRanks = [...rankGroups.keys()].sort((a, b) => a - b);
  const visibleNodes = new Set();
  const visibleEdges = new Set();

  // Frame 0: empty canvas with title
  const emptyCanvas = new AsciiCanvas(width, canvasHeight);
  frames.push(emptyCanvas.render(theme));

  // Add nodes rank by rank
  for (const rank of sortedRanks) {
    const group = rankGroups.get(rank);

    // Add each node in this rank
    for (const node of group) {
      visibleNodes.add(node.id);
      const canvas = new AsciiCanvas(width, canvasHeight);
      const colorIdx = [...visibleNodes].indexOf(node.id) % nodeColors.length;

      // Render all previously visible nodes
      for (const id of visibleNodes) {
        const n = graph.nodes.find(n => n.id === id);
        const p = positions.get(id);
        const ci = [...visibleNodes].indexOf(id) % nodeColors.length;
        if (n && p) renderFlowchartNode(canvas, n, p, nodeColors[ci]);
      }

      // Render visible edges
      for (const edgeIdx of visibleEdges) {
        const e = graph.edges[edgeIdx];
        const fp = positions.get(e.from);
        const tp = positions.get(e.to);
        if (fp && tp) renderFlowchartEdge(canvas, fp, tp, e, theme.line, graph.direction);
      }

      frames.push(canvas.render(theme));
    }

    // Add edges that connect visible nodes
    for (let i = 0; i < graph.edges.length; i++) {
      const e = graph.edges[i];
      if (visibleNodes.has(e.from) && visibleNodes.has(e.to) && !visibleEdges.has(i)) {
        visibleEdges.add(i);

        const canvas = new AsciiCanvas(width, canvasHeight);

        // Render all visible nodes
        for (const id of visibleNodes) {
          const n = graph.nodes.find(n => n.id === id);
          const p = positions.get(id);
          const ci = [...visibleNodes].indexOf(id) % nodeColors.length;
          if (n && p) renderFlowchartNode(canvas, n, p, nodeColors[ci]);
        }

        // Render all visible edges
        for (const edgeIdx of visibleEdges) {
          const edge = graph.edges[edgeIdx];
          const fp = positions.get(edge.from);
          const tp = positions.get(edge.to);
          if (fp && tp) renderFlowchartEdge(canvas, fp, tp, edge, theme.line, graph.direction);
        }

        frames.push(canvas.render(theme));
      }
    }
  }

  // Hold final frame
  frames.push(frames[frames.length - 1]);
  frames.push(frames[frames.length - 1]);

  return frames;
}

function generateSequenceFrames(graph, theme, width = 120) {
  const layout = layoutSequence(graph, width);
  const { positions } = layout;
  const messageHeight = graph.messages.length * 3 + 6;
  const canvasHeight = messageHeight + 6;
  const frames = [];
  const nodeColors = theme.nodeColors;

  // Frame 0: empty
  frames.push(new AsciiCanvas(width, canvasHeight).render(theme));

  // Frame 1: participants appear
  const pCanvas = new AsciiCanvas(width, canvasHeight);
  graph.participants.forEach((p, i) => {
    const pos = positions.get(p.id);
    renderSequenceParticipant(pCanvas, p, pos, nodeColors[i % nodeColors.length]);
    renderSequenceLifeline(pCanvas, pos, messageHeight, theme.line);
  });
  frames.push(pCanvas.render(theme));

  // Add messages one by one
  const visibleMessages = [];
  for (let i = 0; i < graph.messages.length; i++) {
    visibleMessages.push(i);

    const canvas = new AsciiCanvas(width, canvasHeight);

    // Render participants and lifelines
    graph.participants.forEach((p, pi) => {
      const pos = positions.get(p.id);
      renderSequenceParticipant(canvas, p, pos, nodeColors[pi % nodeColors.length]);
      renderSequenceLifeline(canvas, pos, messageHeight, theme.line);
    });

    // Render visible messages
    for (const mi of visibleMessages) {
      const msg = graph.messages[mi];
      const fromPos = positions.get(msg.from);
      const toPos = positions.get(msg.to);
      const row = 6 + mi * 3;
      const colorIdx = mi % nodeColors.length;
      renderSequenceMessage(canvas, msg, fromPos, toPos, row, nodeColors[colorIdx]);
    }

    frames.push(canvas.render(theme));
  }

  // Hold final frame
  frames.push(frames[frames.length - 1]);
  frames.push(frames[frames.length - 1]);

  return frames;
}

function generateFrames(graph, theme, width = 120) {
  switch (graph.type) {
    case 'flowchart':
      return generateFlowchartFrames(graph, theme, width);
    case 'sequence':
      return generateSequenceFrames(graph, theme, width);
    case 'state':
      // Treat state diagrams like flowcharts
      return generateFlowchartFrames({
        type: 'flowchart',
        direction: 'TD',
        nodes: graph.states,
        edges: graph.transitions.map(t => ({ from: t.from, to: t.to, label: t.label, dashed: false, thick: false })),
      }, theme, width);
    default:
      return generateFlowchartFrames(graph, theme, width);
  }
}

// ─────────────────────────────────────────────────────────────
// Animation Playback
// ─────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function playAnimation(frames, fps = 30) {
  const frameDelay = Math.floor(1000 / fps);

  process.stdout.write(ANSI.hideCursor);
  process.stdout.write(ANSI.clearScreen);

  try {
    for (let i = 0; i < frames.length; i++) {
      process.stdout.write(ANSI.cursorHome);
      process.stdout.write(frames[i]);
      await sleep(frameDelay);
    }

    // Hold final frame for 2 seconds
    await sleep(2000);
  } finally {
    process.stdout.write(ANSI.showCursor);
    process.stdout.write(ANSI.reset);
  }
}

// ─────────────────────────────────────────────────────────────
// Static Render
// ─────────────────────────────────────────────────────────────

function renderStatic(graph, theme, width = 120) {
  const frames = generateFrames(graph, theme, width);
  // Return the last frame (fully rendered)
  return frames[frames.length - 1];
}

// ─────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────

function printUsage() {
  console.log(`
${ANSI.bold}ascii-animate.js${ANSI.reset} — Ghostty-style Mermaid ASCII Animation

${ANSI.bold}USAGE${ANSI.reset}
  node ascii-animate.js --input <file.mmd> [options]
  cat diagram.mmd | node ascii-animate.js [options]

${ANSI.bold}OPTIONS${ANSI.reset}
  --input, -i <file>      Input mermaid file
  --mode, -m <mode>       Render mode: animate, static, frames (default: animate)
  --theme, -t <name>      Theme name (default: vercel-dark)
  --fps, -f <number>      Animation FPS, 1-60 (default: 30)
  --width, -w <number>    Canvas width in columns (default: 120)
  --list-themes           List available themes
  --help, -h              Show this help

${ANSI.bold}THEMES${ANSI.reset}
  ${Object.keys(THEMES).join(', ')}

${ANSI.bold}EXAMPLES${ANSI.reset}
  node ascii-animate.js -i flowchart.mmd -t dracula --fps 15
  node ascii-animate.js -i sequence.mmd -m static -t nord
  echo 'graph TD; A-->B; B-->C' | node ascii-animate.js -t tokyo-night
`);
}

async function main() {
  const args = process.argv.slice(2);
  let inputFile = null;
  let mode = 'animate';
  let themeName = 'vercel-dark';
  let fps = 30;
  let width = 120;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input': case '-i': inputFile = args[++i]; break;
      case '--mode': case '-m': mode = args[++i]; break;
      case '--theme': case '-t': themeName = args[++i]; break;
      case '--fps': case '-f': fps = Math.min(60, Math.max(1, parseInt(args[++i], 10))); break;
      case '--width': case '-w': width = parseInt(args[++i], 10); break;
      case '--list-themes':
        Object.entries(THEMES).forEach(([name, t]) => {
          const preview = ANSI.bgRgb(...t.bg) + ANSI.fgRgb(...t.fg) + ` ${name} ` + ANSI.reset;
          const colors = t.nodeColors.map(c => ANSI.fgRgb(...c) + BOX.blockFull + ANSI.reset).join('');
          console.log(`  ${preview} ${colors}`);
        });
        return;
      case '--help': case '-h': printUsage(); return;
    }
  }

  const theme = THEMES[themeName] || THEMES['vercel-dark'];

  // Read input
  let source;
  if (inputFile) {
    const fs = require('fs');
    source = fs.readFileSync(inputFile, 'utf-8');
  } else if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    source = Buffer.concat(chunks).toString('utf-8');
  } else {
    printUsage();
    process.exit(1);
  }

  // Extract mermaid from markdown code blocks if needed
  const mermaidMatch = source.match(/```mermaid\n([\s\S]*?)```/);
  if (mermaidMatch) source = mermaidMatch[1];

  // Parse and render
  const graph = parseMermaid(source);
  const frames = generateFrames(graph, theme, width);

  switch (mode) {
    case 'animate':
      await playAnimation(frames, fps);
      break;
    case 'static':
      process.stdout.write(renderStatic(graph, theme, width));
      break;
    case 'frames':
      // Output frame data as JSON (for external players or web embedding)
      console.log(JSON.stringify({ frameCount: frames.length, fps, theme: themeName, frames }));
      break;
    default:
      console.error(`Unknown mode: ${mode}`);
      process.exit(1);
  }
}

main().catch(err => {
  process.stderr.write(ANSI.showCursor + ANSI.reset);
  console.error('Error:', err.message);
  process.exit(1);
});
