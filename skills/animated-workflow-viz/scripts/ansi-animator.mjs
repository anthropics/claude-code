/**
 * ansi-animator.mjs — Ghostty-style ANSI terminal animation engine
 *
 * Renders frames of text with truecolor ANSI codes using:
 * - Synchronized output (DEC 2026) for flicker-free atomic frame updates
 * - Cursor positioning for in-place redraw
 * - Progressive reveal with configurable timing
 * - Graceful degradation for terminals without sync/truecolor support
 *
 * Inspired by the Ghostty ASCII animation (ghostty.org) and Pierce.dev's
 * implementation notes on luminance mapping and frame-based terminal animation.
 */

// ─── ANSI Escape Sequences ──────────────────────────────────────────────────

const ESC = '\x1b';
const CSI = `${ESC}[`;

export const ANSI = {
  // Cursor control
  cursorHome:    `${CSI}H`,
  cursorTo:      (row, col) => `${CSI}${row};${col}H`,
  cursorHide:    `${CSI}?25l`,
  cursorShow:    `${CSI}?25h`,

  // Screen control
  clearScreen:   `${CSI}2J`,
  clearLine:     `${CSI}K`,

  // Synchronized output (DEC 2026) — atomic frame updates
  syncStart:     `${CSI}?2026h`,
  syncEnd:       `${CSI}?2026l`,

  // Alternate screen buffer
  altScreenOn:   `${CSI}?1049h`,
  altScreenOff:  `${CSI}?1049l`,

  // Color
  reset:         `${CSI}0m`,
  bold:          `${CSI}1m`,
  dim:           `${CSI}2m`,
  italic:        `${CSI}3m`,

  // 24-bit truecolor
  fg: (r, g, b) => `${CSI}38;2;${r};${g};${b}m`,
  bg: (r, g, b) => `${CSI}48;2;${r};${g};${b}m`,

  // 256-color fallback
  fg256: (n) => `${CSI}38;5;${n}m`,
  bg256: (n) => `${CSI}48;5;${n}m`,
};

// ─── Color Definitions ──────────────────────────────────────────────────────

/**
 * The 5-color category system from deterministic-object-usage,
 * extended with UI states (dim, bright, border, surface).
 */
export const CATEGORY_COLORS = {
  agent:   { hex: '#58a6ff', rgb: [88, 166, 255],  label: 'Agent'   },
  tool:    { hex: '#3fb950', rgb: [63, 185, 80],    label: 'Tool'    },
  hook:    { hex: '#d29922', rgb: [210, 153, 34],   label: 'Hook'    },
  param:   { hex: '#bc8cff', rgb: [188, 140, 255],  label: 'Param'   },
  event:   { hex: '#f778ba', rgb: [247, 120, 186],  label: 'Event'   },
};

export const UI_COLORS = {
  default: { hex: '#8b949e', rgb: [139, 148, 158] },
  dim:     { hex: '#484f58', rgb: [72, 79, 88]    },
  bright:  { hex: '#f0f6fc', rgb: [240, 246, 252] },
  border:  { hex: '#30363d', rgb: [48, 54, 61]    },
  surface: { hex: '#161b22', rgb: [22, 27, 34]    },
  bg:      { hex: '#0d1117', rgb: [13, 17, 23]    },
  green:   { hex: '#3fb950', rgb: [63, 185, 80]   },
  red:     { hex: '#f85149', rgb: [248, 81, 73]   },
  yellow:  { hex: '#d29922', rgb: [210, 153, 34]  },
};

// ─── Terminal Capability Detection ──────────────────────────────────────────

export function detectCapabilities() {
  const env = process.env;
  const noColor = env.NO_COLOR !== undefined;
  const colorTerm = env.COLORTERM || '';
  const term = env.TERM || '';

  return {
    truecolor: !noColor && (
      colorTerm === 'truecolor' ||
      colorTerm === '24bit' ||
      term.includes('256color') ||
      env.TERM_PROGRAM === 'ghostty' ||
      env.TERM_PROGRAM === 'WezTerm' ||
      env.TERM_PROGRAM === 'iTerm.app'
    ),
    syncOutput: (
      env.TERM_PROGRAM === 'ghostty' ||
      env.TERM_PROGRAM === 'WezTerm' ||
      env.TERM_PROGRAM === 'iTerm.app' ||
      term.includes('kitty') ||
      term.includes('xterm')
    ),
    unicode: !env.WORKFLOW_VIZ_ASCII && env.LANG?.includes('UTF'),
    color: !noColor,
  };
}

// ─── Colorize Function ─────────────────────────────────────────────────────

/**
 * Apply ANSI truecolor to a string based on a category or explicit RGB.
 */
export function colorize(text, category, opts = {}) {
  const caps = opts.capabilities || detectCapabilities();
  if (!caps.color) return text;

  const color = CATEGORY_COLORS[category] || UI_COLORS[category] || UI_COLORS.default;
  const [r, g, b] = color.rgb;

  let prefix = caps.truecolor ? ANSI.fg(r, g, b) : ANSI.fg256(approximateTo256(r, g, b));
  if (opts.bold) prefix += ANSI.bold;
  if (opts.dim) prefix += ANSI.dim;
  if (opts.italic) prefix += ANSI.italic;

  return `${prefix}${text}${ANSI.reset}`;
}

/**
 * Approximate a 24-bit color to the nearest xterm-256 color index.
 */
function approximateTo256(r, g, b) {
  // Check greyscale ramp (232-255)
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round((r - 8) / 247 * 24) + 232;
  }
  // Map to 6x6x6 color cube (indices 16-231)
  const ri = Math.round(r / 255 * 5);
  const gi = Math.round(g / 255 * 5);
  const bi = Math.round(b / 255 * 5);
  return 16 + (36 * ri) + (6 * gi) + bi;
}

// ─── Frame Animation Engine ────────────────────────────────────────────────

/**
 * Animate a sequence of frames in the terminal.
 *
 * @param {string[]} frames - Array of complete frame strings (with ANSI codes)
 * @param {object} opts - Animation options
 * @param {number} opts.fps - Frames per second (default: 24)
 * @param {boolean} opts.altScreen - Use alternate screen buffer (default: false)
 * @param {boolean} opts.loop - Loop animation (default: false)
 * @param {number} opts.holdLastMs - Hold last frame for N ms (default: 2000)
 * @param {Function} opts.onFrame - Callback per frame (frameIndex, totalFrames)
 */
export async function animateFrames(frames, opts = {}) {
  const {
    fps = 24,
    altScreen = false,
    loop = false,
    holdLastMs = 2000,
    onFrame,
  } = opts;

  const caps = detectCapabilities();
  const frameInterval = Math.floor(1000 / fps);

  // Setup
  const write = (s) => process.stdout.write(s);

  if (altScreen) write(ANSI.altScreenOn);
  write(ANSI.cursorHide);

  const cleanup = () => {
    write(ANSI.cursorShow);
    if (altScreen) write(ANSI.altScreenOff);
    write(ANSI.reset);
  };

  // Handle SIGINT gracefully
  const sigintHandler = () => { cleanup(); process.exit(0); };
  process.on('SIGINT', sigintHandler);

  try {
    do {
      for (let i = 0; i < frames.length; i++) {
        const frameStart = Date.now();

        // Synchronized output: batch the entire frame as one atomic update
        if (caps.syncOutput) write(ANSI.syncStart);
        write(ANSI.cursorHome);
        write(frames[i]);
        if (caps.syncOutput) write(ANSI.syncEnd);

        if (onFrame) onFrame(i, frames.length);

        // Precise frame timing
        const elapsed = Date.now() - frameStart;
        const sleepMs = Math.max(0, frameInterval - elapsed);
        if (sleepMs > 0) await sleep(sleepMs);
      }

      // Hold last frame
      if (holdLastMs > 0) await sleep(holdLastMs);
    } while (loop);
  } finally {
    process.removeListener('SIGINT', sigintHandler);
    cleanup();
  }
}

/**
 * Generate progressive reveal frames from a final rendered diagram.
 *
 * Takes the complete ASCII diagram and produces N frames where content
 * appears progressively — nodes first, then edges, then labels.
 *
 * @param {string} finalFrame - The complete rendered diagram
 * @param {object} nodePositions - Map of node IDs to their line ranges
 * @param {object} opts - Options
 * @param {number} opts.revealSteps - Number of reveal steps (default: auto)
 * @param {string} opts.style - 'fade-in' | 'top-down' | 'left-right' (default: 'top-down')
 * @returns {string[]} Array of frames for animation
 */
export function generateRevealFrames(finalFrame, opts = {}) {
  const {
    style = 'top-down',
    staggerLines = 2,
  } = opts;

  const lines = finalFrame.split('\n');
  const totalLines = lines.length;
  const frames = [];
  const caps = detectCapabilities();

  if (style === 'top-down') {
    // Reveal N lines per frame, with dimmed preview of upcoming content
    for (let revealedCount = 0; revealedCount <= totalLines; revealedCount += staggerLines) {
      const frameLines = lines.map((line, idx) => {
        if (idx < revealedCount) {
          return line; // Already revealed — full color
        } else if (idx < revealedCount + staggerLines * 3) {
          // Upcoming — show dimmed
          return caps.color ? `${ANSI.dim}${stripAnsi(line)}${ANSI.reset}` : '';
        } else {
          return ''; // Not yet visible
        }
      });
      frames.push(frameLines.join('\n'));
    }
  } else if (style === 'fade-in') {
    // All content visible but transitions from dim → full color
    const dimFrame = lines.map(l =>
      caps.color ? `${ANSI.dim}${stripAnsi(l)}${ANSI.reset}` : l
    ).join('\n');
    frames.push(dimFrame);

    // Intermediate: mix of dim and colored
    for (let step = 0; step < 3; step++) {
      const ratio = (step + 1) / 4;
      const cutoff = Math.floor(totalLines * ratio);
      const frameLines = lines.map((line, idx) =>
        idx < cutoff ? line : (caps.color ? `${ANSI.dim}${stripAnsi(line)}${ANSI.reset}` : line)
      );
      frames.push(frameLines.join('\n'));
    }

    frames.push(finalFrame);
  } else {
    // left-right: reveal columns progressively
    const maxWidth = Math.max(...lines.map(l => stripAnsi(l).length));
    for (let col = 0; col <= maxWidth; col += 3) {
      const frameLines = lines.map(line => {
        const plain = stripAnsi(line);
        const visible = plain.substring(0, col);
        return visible + (caps.color ? `${ANSI.dim}${plain.substring(col)}${ANSI.reset}` : '');
      });
      frames.push(frameLines.join('\n'));
    }
    frames.push(finalFrame);
  }

  // Always include the final complete frame
  if (frames[frames.length - 1] !== finalFrame) {
    frames.push(finalFrame);
  }

  return frames;
}

// ─── Progress Bar ──────────────────────────────────────────────────────────

/**
 * Render a colored progress bar for phase tracking.
 *
 * @param {number} current - Current phase (1-indexed)
 * @param {number} total - Total phases
 * @param {string[]} labels - Phase labels
 * @param {object} opts - Options
 * @returns {string} Colored progress bar string
 */
export function renderProgressBar(current, total, labels = [], opts = {}) {
  const caps = opts.capabilities || detectCapabilities();
  const width = opts.width || 60;

  const filled = Math.floor((current / total) * width);
  const empty = width - filled;

  const bar = caps.unicode
    ? `${colorize('█'.repeat(filled), 'green', { capabilities: caps })}${colorize('░'.repeat(empty), 'dim', { capabilities: caps })}`
    : `${colorize('#'.repeat(filled), 'green', { capabilities: caps })}${colorize('-'.repeat(empty), 'dim', { capabilities: caps })}`;

  const pct = Math.floor((current / total) * 100);
  const header = colorize(` ${pct}% `, 'bright', { bold: true, capabilities: caps });

  const label = labels[current - 1]
    ? `  ${colorize(labels[current - 1], 'bright', { capabilities: caps })}`
    : '';

  return `${bar}${header}${label}`;
}

// ─── Utilities ─────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Strip ANSI escape codes from a string.
 */
export function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Render a box around text with optional title and category color.
 */
export function renderBox(text, opts = {}) {
  const caps = opts.capabilities || detectCapabilities();
  const { title, category, padding = 1 } = opts;
  const lines = text.split('\n');
  const maxWidth = Math.max(...lines.map(l => stripAnsi(l).length), (title || '').length + 4);
  const innerWidth = maxWidth + padding * 2;

  const borderColor = category || 'border';
  const h = caps.unicode ? '─' : '-';
  const v = caps.unicode ? '│' : '|';
  const tl = caps.unicode ? '╭' : '+';
  const tr = caps.unicode ? '╮' : '+';
  const bl = caps.unicode ? '╰' : '+';
  const br = caps.unicode ? '╯' : '+';

  const topLine = title
    ? `${tl}${h}${h} ${title} ${h.repeat(Math.max(0, innerWidth - title.length - 4))}${tr}`
    : `${tl}${h.repeat(innerWidth)}${tr}`;

  const bottomLine = `${bl}${h.repeat(innerWidth)}${br}`;
  const pad = ' '.repeat(padding);

  const boxLines = [
    colorize(topLine, borderColor, { capabilities: caps }),
    ...lines.map(l => {
      const plainLen = stripAnsi(l).length;
      const rightPad = ' '.repeat(Math.max(0, maxWidth - plainLen));
      return `${colorize(v, borderColor, { capabilities: caps })}${pad}${l}${rightPad}${pad}${colorize(v, borderColor, { capabilities: caps })}`;
    }),
    colorize(bottomLine, borderColor, { capabilities: caps }),
  ];

  return boxLines.join('\n');
}

/**
 * Render a status legend showing the category color mapping.
 */
export function renderLegend(opts = {}) {
  const caps = opts.capabilities || detectCapabilities();
  const entries = Object.entries(CATEGORY_COLORS).map(([key, val]) => {
    const dot = caps.unicode ? '●' : '*';
    return `${colorize(dot, key, { capabilities: caps })} ${val.label}`;
  });
  return entries.join('  ');
}
