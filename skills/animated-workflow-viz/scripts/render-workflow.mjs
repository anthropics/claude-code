#!/usr/bin/env node

/**
 * render-workflow.mjs — Main entry point for animated workflow visualization
 *
 * Combines @vercel/beautiful-mermaid ASCII rendering with ghostty-style
 * ANSI terminal animation for the deterministic extraction workflow.
 *
 * Usage:
 *   node render-workflow.mjs --template branch-create
 *   node render-workflow.mjs --template extraction-pipeline --theme tokyo-night
 *   node render-workflow.mjs --file path/to/custom.mmd
 *   node render-workflow.mjs --template branch-create --static
 *   node render-workflow.mjs --template branch-create --completed phase1,phase2
 *   node render-workflow.mjs --template branch-create --active phase3
 *   node render-workflow.mjs --inline "graph TD; A-->B"
 */

import { readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import {
  ANSI,
  colorize,
  detectCapabilities,
  animateFrames,
  generateRevealFrames,
  renderProgressBar,
  renderBox,
  renderLegend,
  stripAnsi,
} from './ansi-animator.mjs';

import {
  renderColorizedMermaid,
  extractNodes,
} from './mermaid-to-ansi.mjs';

// ─── Paths ─────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ASSETS_DIR = join(__dirname, '..', 'assets');

// ─── Templates ─────────────────────────────────────────────────────────────

const TEMPLATES = {
  'branch-create':        'branch-create-workflow.mmd',
  'extraction-pipeline':  'extraction-pipeline.mmd',
};

// ─── Phase Definitions (for progress tracking) ─────────────────────────────

const BRANCH_CREATE_PHASES = [
  { id: 'phase1', label: 'Setup',          nodes: ['hook_branch', 'tool_read_claude', 'tool_read_process'] },
  { id: 'phase2', label: 'Changelog Fetch', nodes: ['tool_fetch', 'tool_parse', 'param_count'] },
  { id: 'phase3', label: 'JSONL Extraction', nodes: ['param_keywords', 'tool_meta', 'tool_scan_eras', 'tool_scan_objects', 'tool_scan_releases', 'agent_interactions', 'tool_expand_kw'] },
  { id: 'phase4', label: 'JSONL Validation', nodes: ['tool_validate_json', 'tool_validate_order', 'tool_validate_dedup', 'tool_validate_complete', 'tool_validate_count'] },
  { id: 'phase5', label: 'HTML Generation',  nodes: ['tool_gen_html', 'agent_sidebar', 'agent_timeline', 'agent_eras', 'agent_diagrams', 'tool_filters', 'tool_footer'] },
  { id: 'phase6', label: 'HTML Validation',  nodes: ['tool_self_contained', 'tool_cross_ref', 'tool_interactive'] },
  { id: 'phase7', label: 'Documentation',    nodes: ['tool_update_table', 'tool_increment', 'tool_insights', 'tool_edge_cases'] },
  { id: 'phase8', label: 'Ship',             nodes: ['event_commit', 'event_push', 'event_pr'] },
];

// ─── CLI Argument Parsing ──────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    template: null,
    file: null,
    inline: null,
    theme: process.env.WORKFLOW_VIZ_THEME || 'dark',
    static: process.env.WORKFLOW_VIZ_STATIC === '1',
    fps: parseInt(process.env.WORKFLOW_VIZ_FPS || '24', 10),
    ascii: process.env.WORKFLOW_VIZ_ASCII === '1',
    completed: [],
    active: null,
    style: 'top-down',
    compact: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--template':
      case '-t':
        opts.template = args[++i];
        break;
      case '--file':
      case '-f':
        opts.file = args[++i];
        break;
      case '--inline':
      case '-i':
        opts.inline = args[++i];
        break;
      case '--theme':
        opts.theme = args[++i];
        break;
      case '--static':
      case '-s':
        opts.static = true;
        break;
      case '--fps':
        opts.fps = parseInt(args[++i], 10);
        break;
      case '--ascii':
        opts.ascii = true;
        break;
      case '--completed':
      case '-c':
        opts.completed = args[++i].split(',').map(s => s.trim());
        break;
      case '--active':
      case '-a':
        opts.active = args[++i];
        break;
      case '--style':
        opts.style = args[++i];
        break;
      case '--compact':
        opts.compact = true;
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
    }
  }

  return opts;
}

// ─── Theme Loading ─────────────────────────────────────────────────────────

function loadTheme(name) {
  const themesPath = join(ASSETS_DIR, 'themes.json');
  const themes = JSON.parse(readFileSync(themesPath, 'utf-8'));
  return themes[name] || themes['dark'];
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const caps = detectCapabilities();

  if (opts.help) {
    printUsage();
    return;
  }

  // Load mermaid source
  let mermaidSource;
  let templateName;

  if (opts.inline) {
    mermaidSource = opts.inline;
    templateName = 'inline';
  } else if (opts.file) {
    mermaidSource = readFileSync(resolve(opts.file), 'utf-8');
    templateName = opts.file;
  } else if (opts.template) {
    const filename = TEMPLATES[opts.template];
    if (!filename) {
      console.error(`Unknown template: ${opts.template}`);
      console.error(`Available: ${Object.keys(TEMPLATES).join(', ')}`);
      process.exit(1);
    }
    mermaidSource = readFileSync(join(ASSETS_DIR, filename), 'utf-8');
    templateName = opts.template;
  } else {
    // Default to branch-create
    const filename = TEMPLATES['branch-create'];
    mermaidSource = readFileSync(join(ASSETS_DIR, filename), 'utf-8');
    templateName = 'branch-create';
  }

  // Resolve completed phases to individual node IDs
  let completedNodes = [];
  let activeNodes = null;
  const phases = templateName === 'branch-create' ? BRANCH_CREATE_PHASES : [];

  for (const phaseId of opts.completed) {
    const phase = phases.find(p => p.id === phaseId);
    if (phase) {
      completedNodes.push(...phase.nodes);
    } else {
      // Treat as individual node ID
      completedNodes.push(phaseId);
    }
  }

  if (opts.active) {
    const phase = phases.find(p => p.id === opts.active);
    activeNodes = phase ? phase.nodes[0] : opts.active;
  }

  // Load theme
  const theme = loadTheme(opts.theme);

  // Render header
  const header = renderHeader(templateName, theme, caps);

  // Render the colorized mermaid diagram
  const diagram = await renderColorizedMermaid(mermaidSource, {
    capabilities: caps,
    useAscii: opts.ascii,
    completedPhases: completedNodes,
    activePhase: activeNodes,
  });

  // Render progress bar (if phases defined and progress specified)
  let progressBar = '';
  if (phases.length > 0 && opts.completed.length > 0) {
    const phaseLabels = phases.map(p => p.label);
    progressBar = '\n' + renderProgressBar(
      opts.completed.length,
      phases.length,
      phaseLabels,
      { capabilities: caps }
    ) + '\n';
  }

  // Render legend
  const legend = '\n' + renderLegend({ capabilities: caps });

  // Compose final output
  const fullOutput = `${header}\n\n${diagram}\n${progressBar}${legend}\n`;

  if (opts.static) {
    // Static render — just print
    process.stdout.write(fullOutput);
  } else {
    // Animated render — progressive reveal
    const frames = generateRevealFrames(fullOutput, {
      style: opts.style,
      staggerLines: opts.compact ? 4 : 2,
    });

    await animateFrames(frames, {
      fps: opts.fps,
      holdLastMs: 3000,
    });

    // After animation, print the final static version
    // (so it persists in terminal scrollback)
    process.stdout.write('\n' + fullOutput);
  }
}

// ─── Header Rendering ──────────────────────────────────────────────────────

function renderHeader(templateName, theme, caps) {
  const titles = {
    'branch-create': 'Branch Creation Workflow',
    'extraction-pipeline': 'Extraction Pipeline',
    'inline': 'Custom Diagram',
  };

  const title = titles[templateName] || templateName;
  const titleText = colorize(` ${title} `, 'bright', { bold: true, capabilities: caps });

  const subtitle = colorize(
    'deterministic-object-usage',
    'dim',
    { italic: true, capabilities: caps }
  );

  const themeBadge = colorize(
    `[${theme.name}]`,
    'agent',
    { capabilities: caps }
  );

  return renderBox(
    `${titleText}\n${subtitle}  ${themeBadge}`,
    { category: 'border', capabilities: caps }
  );
}

// ─── Usage ─────────────────────────────────────────────────────────────────

function printUsage() {
  const caps = detectCapabilities();
  const c = (text, cat) => colorize(text, cat, { capabilities: caps });

  console.log(`
${c('Animated Workflow Visualization', 'bright')}
${c('beautiful-mermaid + ghostty-style ANSI animation', 'dim')}

${c('USAGE:', 'agent')}
  node render-workflow.mjs [options]

${c('TEMPLATES:', 'tool')}
  --template, -t <name>    Use a built-in template
                           ${c('branch-create', 'bright')}        8-phase extraction workflow
                           ${c('extraction-pipeline', 'bright')}  CHANGELOG -> JSONL -> HTML flow

${c('CUSTOM INPUT:', 'tool')}
  --file, -f <path>        Render a custom .mmd file
  --inline, -i <source>    Render inline mermaid source

${c('DISPLAY:', 'hook')}
  --theme <name>           Color theme: dark, tokyo-night, catppuccin, ghostty
  --static, -s             Disable animation (print static output)
  --fps <n>                Animation FPS (default: 24)
  --ascii                  Pure ASCII (no Unicode box-drawing)
  --style <name>           Animation style: top-down, fade-in, left-right
  --compact                Faster reveal (4 lines per frame vs 2)

${c('PROGRESS:', 'param')}
  --completed, -c <ids>    Comma-separated phase IDs to mark complete
                           e.g. ${c('--completed phase1,phase2', 'bright')}
  --active, -a <id>        Phase currently in progress
                           e.g. ${c('--active phase3', 'bright')}

${c('EXAMPLES:', 'event')}
  ${c('# Show branch creation workflow with animation', 'dim')}
  node render-workflow.mjs --template branch-create

  ${c('# Static render with Tokyo Night theme', 'dim')}
  node render-workflow.mjs -t branch-create -s --theme tokyo-night

  ${c('# Show progress: phases 1-3 done, phase 4 active', 'dim')}
  node render-workflow.mjs -t branch-create -c phase1,phase2,phase3 -a phase4

  ${c('# Render custom diagram', 'dim')}
  node render-workflow.mjs -f ./my-workflow.mmd --fps 30

  ${c('# Inline diagram', 'dim')}
  node render-workflow.mjs -i "graph TD; A[Start]-->B[End]"

${c('ENVIRONMENT:', 'param')}
  WORKFLOW_VIZ_FPS=24      Animation FPS
  WORKFLOW_VIZ_THEME=dark  Default theme
  WORKFLOW_VIZ_STATIC=0    Disable animation
  WORKFLOW_VIZ_ASCII=0     Pure ASCII mode
  NO_COLOR                 Disable all color
`);
}

// ─── Run ───────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
