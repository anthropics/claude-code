#!/usr/bin/env node
/**
 * this-session.mjs — analyze the current Claude Code session and print a dashboard.
 * Usage: node this-session.mjs [<session-jsonl-path>]
 *
 * If no path is given it auto-detects the most recently modified .jsonl in
 * ~/.claude/projects/<cwd-slug>/.
 */

import fs from "fs";
import path from "path";
import os from "os";

// ── Pricing (USD per token) ────────────────────────────────────────────────
const PRICING = {
  "claude-opus-4-7":    { in: 15/1e6, out: 75/1e6, cw: 18.75/1e6, cr: 1.50/1e6 },
  "claude-opus-4-6":    { in: 15/1e6, out: 75/1e6, cw: 18.75/1e6, cr: 1.50/1e6 },
  "claude-sonnet-4-6":  { in: 3/1e6,  out: 15/1e6, cw: 3.75/1e6,  cr: 0.30/1e6 },
  "claude-haiku-4-5":   { in: 0.8/1e6,out: 4/1e6,  cw: 1.0/1e6,   cr: 0.08/1e6 },
  // legacy / fallbacks
  "claude-opus-4-5":    { in: 15/1e6, out: 75/1e6, cw: 18.75/1e6, cr: 1.50/1e6 },
  "claude-sonnet-4-5":  { in: 3/1e6,  out: 15/1e6, cw: 3.75/1e6,  cr: 0.30/1e6 },
};
function price(model, input, output, cacheWrite, cacheRead) {
  const p = PRICING[model] || PRICING["claude-sonnet-4-6"];
  return (input * p.in) + (output * p.out) + (cacheWrite * p.cw) + (cacheRead * p.cr);
}

// ── Find session file ──────────────────────────────────────────────────────
function findSessionFile() {
  const cwd = process.cwd();
  const projectsDir = path.join(os.homedir(), ".claude", "projects");

  // Build candidate slugs: exact cwd, realpath (resolves symlinks / case), and
  // a case-insensitive scan of the projects directory as final fallback.
  const candidates = new Set();
  const addSlug = p => candidates.add(p.replace(/\//g, "-"));
  addSlug(cwd);
  try { addSlug(fs.realpathSync(cwd)); } catch {}

  let dir = null;
  for (const slug of candidates) {
    const d = path.join(projectsDir, slug);
    if (fs.existsSync(d)) { dir = d; break; }
  }

  // Case-insensitive fallback: scan project dir names
  if (!dir && fs.existsSync(projectsDir)) {
    const cwdSlugLower = cwd.replace(/\//g, "-").toLowerCase();
    for (const entry of fs.readdirSync(projectsDir)) {
      if (entry.toLowerCase() === cwdSlugLower) {
        dir = path.join(projectsDir, entry);
        break;
      }
    }
  }

  if (!dir) return null;
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith(".jsonl"))
    .map(f => ({ f, mt: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mt - a.mt);
  return files.length ? path.join(dir, files[0].f) : null;
}

// ── Parse JSONL ────────────────────────────────────────────────────────────
function parse(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
  const entries = raw.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

  let sessionId = null;
  let startTime = null, endTime = null;
  const models = new Map(); // model → { calls, input, output, cacheWrite, cacheRead }
  let tools = new Map();    // toolName → count
  let userTurns = 0;
  const seenMsgIds = new Set();

  for (const e of entries) {
    if (!sessionId && e.sessionId) sessionId = e.sessionId;

    const ts = e.timestamp ? new Date(e.timestamp).getTime() : null;
    if (ts) {
      if (!startTime || ts < startTime) startTime = ts;
      if (!endTime || ts > endTime) endTime = ts;
    }

    if (e.type === "user") userTurns++;

    const msg = e.message;
    if (!msg) continue;

    // de-dupe repeated assistant entries (Claude Code sometimes writes the same msg multiple times)
    const msgId = msg.id;
    if (msgId && seenMsgIds.has(msgId)) continue;
    if (msgId) seenMsgIds.add(msgId);

    const usage = msg.usage;
    if (usage && msg.role === "assistant") {
      const model = msg.model || "unknown";
      if (!models.has(model)) models.set(model, { calls: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });
      const m = models.get(model);
      m.calls++;
      m.input      += usage.input_tokens || 0;
      m.output     += usage.output_tokens || 0;
      m.cacheWrite += usage.cache_creation_input_tokens || 0;
      m.cacheRead  += usage.cache_read_input_tokens || 0;
    }

    // count tool use calls
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "tool_use") {
          tools.set(block.name, (tools.get(block.name) || 0) + 1);
        }
      }
    }
  }

  return { sessionId, startTime, endTime, models, tools, userTurns };
}

// ── Formatting helpers ─────────────────────────────────────────────────────
const fmtN  = n => n.toLocaleString();
const fmtMs = ms => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60), rm = m % 60;
  return `${h}h ${rm}m`;
};
const fmtUSD = n => `$${n.toFixed(4)}`;
const bar = (val, max, width = 20) => {
  const filled = max > 0 ? Math.round((val / max) * width) : 0;
  return "█".repeat(filled) + "░".repeat(width - filled);
};
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

// ── Render ─────────────────────────────────────────────────────────────────
function render(data) {
  const { sessionId, startTime, endTime, models, tools, userTurns } = data;
  const duration = startTime && endTime ? endTime - startTime : 0;

  // totals
  let totalInput = 0, totalOutput = 0, totalCW = 0, totalCR = 0, totalCalls = 0;
  let totalCost = 0;
  for (const [model, m] of models) {
    totalInput  += m.input;
    totalOutput += m.output;
    totalCW     += m.cacheWrite;
    totalCR     += m.cacheRead;
    totalCalls  += m.calls;
    totalCost   += price(model, m.input, m.output, m.cacheWrite, m.cacheRead);
  }
  const totalTokens = totalInput + totalOutput + totalCW + totalCR;

  // cache efficiency
  const cacheHitPct = totalCR + totalCW > 0
    ? ((totalCR / (totalCR + totalCW)) * 100).toFixed(1)
    : "0.0";

  // cost without cache
  const naiveCost = (() => {
    let c = 0;
    for (const [model, m] of models) {
      const p = PRICING[model] || PRICING["claude-sonnet-4-6"];
      c += (m.input + m.cacheWrite + m.cacheRead) * p.in + m.output * p.out;
    }
    return c;
  })();
  const savedCost = naiveCost - totalCost;

  const W = 60;
  const line = "─".repeat(W);
  const dline = "═".repeat(W);

  const lines = [];
  const p = s => lines.push(s);

  p(`╔${dline}╗`);
  p(`║${"  SESSION MONITOR".padEnd(W)}║`);
  p(`╚${dline}╝`);
  p("");

  // ── Overview ──
  p(`  SESSION ID   ${sessionId || "unknown"}`);
  p(`  STARTED      ${startTime ? new Date(startTime).toLocaleString() : "—"}`);
  p(`  DURATION     ${fmtMs(duration)}`);
  p(`  USER TURNS   ${userTurns}`);
  p(`  API CALLS    ${totalCalls}`);
  p("");

  // ── Tokens ──
  p(`  ┌${line}┐`);
  p(`  │ TOKENS${" ".repeat(W - 7)}│`);
  p(`  ├${line}┤`);
  p(`  │  ${pad("Input (direct)",      20)}  ${lpad(fmtN(totalInput), 12)}  ${bar(totalInput, totalTokens)}  │`);
  p(`  │  ${pad("Output",              20)}  ${lpad(fmtN(totalOutput), 12)}  ${bar(totalOutput, totalTokens)}  │`);
  p(`  │  ${pad("Cache write",         20)}  ${lpad(fmtN(totalCW), 12)}  ${bar(totalCW, totalTokens)}  │`);
  p(`  │  ${pad("Cache read",          20)}  ${lpad(fmtN(totalCR), 12)}  ${bar(totalCR, totalTokens)}  │`);
  p(`  │  ${pad("TOTAL",               20)}  ${lpad(fmtN(totalTokens), 12)}${"".padEnd(22)}  │`);
  p(`  │  ${pad("Cache hit rate",      20)}  ${lpad(cacheHitPct + "%", 12)}${"".padEnd(22)}  │`);
  p(`  └${line}┘`);
  p("");

  // ── Cost ──
  p(`  ┌${line}┐`);
  p(`  │ COST${" ".repeat(W - 5)}│`);
  p(`  ├${line}┤`);
  p(`  │  ${pad("Actual cost",         20)}  ${lpad(fmtUSD(totalCost), 12)}${"".padEnd(22)}  │`);
  p(`  │  ${pad("Without cache",       20)}  ${lpad(fmtUSD(naiveCost), 12)}${"".padEnd(22)}  │`);
  p(`  │  ${pad("Cache savings",       20)}  ${lpad(fmtUSD(savedCost), 12)}${"".padEnd(22)}  │`);
  p(`  └${line}┘`);
  p("");

  // ── Models ──
  if (models.size > 0) {
    p(`  ┌${line}┐`);
    p(`  │ MODELS${" ".repeat(W - 7)}│`);
    p(`  ├${line}┤`);
    const maxCalls = Math.max(...[...models.values()].map(m => m.calls));
    for (const [model, m] of [...models.entries()].sort((a, b) => b[1].calls - a[1].calls)) {
      const c = price(model, m.input, m.output, m.cacheWrite, m.cacheRead);
      p(`  │  ${pad(model, 24)}  ${lpad(m.calls + " calls", 9)}  ${lpad(fmtUSD(c), 9)}  │`);
      p(`  │    ${pad("in " + fmtN(m.input), 22)}  out ${lpad(fmtN(m.output), 8)}  ${bar(m.calls, maxCalls, 12)}  │`);
    }
    p(`  └${line}┘`);
    p("");
  }

  // ── Tools ──
  if (tools.size > 0) {
    const sorted = [...tools.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    const maxCount = sorted[0][1];
    p(`  ┌${line}┐`);
    p(`  │ TOOLS (top ${sorted.length})${" ".repeat(W - 13 - String(sorted.length).length)}│`);
    p(`  ├${line}┤`);
    for (const [name, cnt] of sorted) {
      p(`  │  ${pad(name, 26)}  ${lpad(cnt, 5)}×  ${bar(cnt, maxCount, 18)}  │`);
    }
    p(`  └${line}┘`);
    p("");
  }

  return lines.join("\n");
}

// ── Main ───────────────────────────────────────────────────────────────────
const filePath = process.argv[2] || findSessionFile();
if (!filePath || !fs.existsSync(filePath)) {
  console.error("No session file found. Pass a path or run from a Claude Code project directory.");
  process.exit(1);
}

const data = parse(filePath);
console.log(render(data));
