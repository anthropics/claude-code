#!/usr/bin/env bun

/**
 * diagnose-session-persistence.ts
 *
 * Diagnostic tool for Claude Code session persistence issues.
 * Scans the local filesystem to detect missing, corrupted, or orphaned sessions.
 *
 * Related issues: #12908, #22900, #12114, #12872, #9258, #40877, #43237
 *
 * Usage:
 *   bun run scripts/diagnose-session-persistence.ts
 *   bun run scripts/diagnose-session-persistence.ts --json
 *   bun run scripts/diagnose-session-persistence.ts --verbose
 *   bun run scripts/diagnose-session-persistence.ts --session <uuid>
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir, platform } from "node:os";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface JSONLEntry {
  type?: string;
  uuid?: string;
  parentUuid?: string | null;
  isSidechain?: boolean;
  sessionId?: string;
  timestamp?: string;
  version?: string;
  entrypoint?: string;
  operation?: string;
  message?: { role?: string; content?: unknown };
}

interface SessionPIDFile {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  kind: string;
  entrypoint: string;
}

interface IDESessionMetadata {
  sessionId: string;
  cliSessionId: string;
  cwd: string;
  createdAt: number;
  lastActivityAt: number;
  model: string;
  isArchived: boolean;
  title: string;
  completedTurns?: number;
}

interface DiagnosticIssue {
  severity: "info" | "warning" | "error" | "critical";
  code: string;
  message: string;
}

interface JSONLAnalysis {
  exists: boolean;
  sizeBytes: number;
  lineCount: number;
  validLines: number;
  corruptedLines: number;
  userMessages: number;
  assistantMessages: number;
  systemMessages: number;
  summaries: number;
  queueOperations: number;
  sidechainMessages: number;
  otherEntries: number;
  brokenChainLinks: number;
  duplicateUuids: number;
  truncatedLastLine: boolean;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  versions: string[];
  entrypoints: string[];
}

interface SubagentInfo {
  id: string;
  lineCount: number;
  hasMeta: boolean;
  agentType: string | null;
}

interface SessionReport {
  sessionId: string;
  projectHash: string;
  status: "healthy" | "warning" | "error" | "critical";
  jsonl: JSONLAnalysis;
  subagents: SubagentInfo[];
  toolResultCount: number;
  ideMetadata: IDESessionMetadata | null;
  issues: DiagnosticIssue[];
}

interface DiagnosticReport {
  timestamp: string;
  platform: string;
  claudeHome: string;
  ideMetadataPath: string | null;
  projects: { hash: string; sessionCount: number }[];
  sessions: SessionReport[];
  globalIssues: DiagnosticIssue[];
  summary: { healthy: number; warning: number; error: number; critical: number; dataLossRisk: number };
}

// ─── Path Resolution ─────────────────────────────────────────────────────────

function resolvePaths() {
  const home = homedir();
  const claudeHome = join(home, ".claude");
  const projectsDir = join(claudeHome, "projects");
  const sessionsDir = join(claudeHome, "sessions");
  const ideDir = join(claudeHome, "ide");

  let ideMetadataDir: string | null = null;
  const plat = platform();
  if (plat === "win32") {
    const appData = process.env.APPDATA;
    if (appData) ideMetadataDir = join(appData, "Claude", "claude-code-sessions");
  } else if (plat === "darwin") {
    ideMetadataDir = join(home, "Library", "Application Support", "Claude", "claude-code-sessions");
  } else {
    ideMetadataDir = join(home, ".config", "Claude", "claude-code-sessions");
  }

  if (ideMetadataDir && !existsSync(ideMetadataDir)) ideMetadataDir = null;

  return { claudeHome, projectsDir, sessionsDir, ideDir, ideMetadataDir };
}

// ─── UUID Validation ─────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(s: string): boolean {
  return UUID_RE.test(s);
}

// ─── JSONL Analysis ──────────────────────────────────────────────────────────

function analyzeJSONL(filePath: string): JSONLAnalysis {
  const result: JSONLAnalysis = {
    exists: false, sizeBytes: 0, lineCount: 0, validLines: 0, corruptedLines: 0,
    userMessages: 0, assistantMessages: 0, systemMessages: 0, summaries: 0,
    queueOperations: 0, sidechainMessages: 0, otherEntries: 0,
    brokenChainLinks: 0, duplicateUuids: 0, truncatedLastLine: false,
    firstTimestamp: null, lastTimestamp: null, versions: [], entrypoints: [],
  };

  if (!existsSync(filePath)) return result;
  result.exists = true;

  let raw: string;
  try {
    const stat = statSync(filePath);
    result.sizeBytes = stat.size;
    raw = readFileSync(filePath, "utf8");
  } catch {
    return result;
  }

  const lines = raw.split("\n").filter((l) => l.trim());
  result.lineCount = lines.length;

  const uuids = new Set<string>();
  const knownUuids = new Set<string>();
  const parentRefs: string[] = [];
  const versionSet = new Set<string>();
  const entrypointSet = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    let entry: JSONLEntry;
    try {
      entry = JSON.parse(lines[i]);
      result.validLines++;
    } catch {
      result.corruptedLines++;
      if (i === lines.length - 1) result.truncatedLastLine = true;
      continue;
    }

    // Count by type
    if (entry.isSidechain) {
      result.sidechainMessages++;
    } else if (entry.type === "user") {
      result.userMessages++;
    } else if (entry.type === "assistant") {
      result.assistantMessages++;
    } else if (entry.type === "system" || entry.type === "attachment") {
      result.systemMessages++;
    } else if (entry.type === "summary") {
      result.summaries++;
    } else if (entry.type === "queue-operation") {
      result.queueOperations++;
    } else {
      result.otherEntries++;
    }

    // Track UUIDs
    if (entry.uuid) {
      if (uuids.has(entry.uuid)) result.duplicateUuids++;
      uuids.add(entry.uuid);
      knownUuids.add(entry.uuid);
    }
    if (entry.parentUuid) parentRefs.push(entry.parentUuid);

    // Track timestamps
    if (entry.timestamp) {
      if (!result.firstTimestamp) result.firstTimestamp = entry.timestamp;
      result.lastTimestamp = entry.timestamp;
    }

    // Track versions and entrypoints
    if (entry.version) versionSet.add(entry.version);
    if (entry.entrypoint) entrypointSet.add(entry.entrypoint);
  }

  // Check parent chain integrity
  for (const ref of parentRefs) {
    if (!knownUuids.has(ref)) result.brokenChainLinks++;
  }

  result.versions = [...versionSet];
  result.entrypoints = [...entrypointSet];

  return result;
}

// ─── Subagent Analysis ───────────────────────────────────────────────────────

function analyzeSubagents(sessionDir: string): SubagentInfo[] {
  const subagentsDir = join(sessionDir, "subagents");
  if (!existsSync(subagentsDir)) return [];

  const results: SubagentInfo[] = [];
  let entries: string[];
  try {
    entries = readdirSync(subagentsDir);
  } catch {
    return [];
  }

  const jsonlFiles = entries.filter((e) => e.endsWith(".jsonl"));
  for (const file of jsonlFiles) {
    const id = file.replace(".jsonl", "");
    const metaFile = join(subagentsDir, id + ".meta.json");
    let lineCount = 0;
    try {
      const content = readFileSync(join(subagentsDir, file), "utf8");
      lineCount = content.split("\n").filter((l) => l.trim()).length;
    } catch {}

    let hasMeta = false;
    let agentType: string | null = null;
    try {
      if (existsSync(metaFile)) {
        hasMeta = true;
        const meta = JSON.parse(readFileSync(metaFile, "utf8"));
        agentType = meta.agentType ?? null;
      }
    } catch {}

    results.push({ id, lineCount, hasMeta, agentType });
  }

  return results;
}

// ─── Tool Result Count ───────────────────────────────────────────────────────

function countToolResults(sessionDir: string): number {
  const dir = join(sessionDir, "tool-results");
  if (!existsSync(dir)) return 0;
  try {
    return readdirSync(dir).length;
  } catch {
    return 0;
  }
}

// ─── IDE Metadata Cross-Reference ────────────────────────────────────────────

function loadAllIDEMetadata(ideMetadataDir: string | null): IDESessionMetadata[] {
  if (!ideMetadataDir || !existsSync(ideMetadataDir)) return [];

  const results: IDESessionMetadata[] = [];

  try {
    for (const workspace of readdirSync(ideMetadataDir)) {
      const wsDir = join(ideMetadataDir, workspace);
      let wsStat;
      try { wsStat = statSync(wsDir); } catch { continue; }
      if (!wsStat.isDirectory()) continue;

      for (const session of readdirSync(wsDir)) {
        const sessDir = join(wsDir, session);
        let sStat;
        try { sStat = statSync(sessDir); } catch { continue; }
        if (!sStat.isDirectory()) continue;

        for (const file of readdirSync(sessDir)) {
          if (!file.startsWith("local_") || !file.endsWith(".json")) continue;
          try {
            const content = readFileSync(join(sessDir, file), "utf8");
            const meta: IDESessionMetadata = JSON.parse(content);
            results.push(meta);
          } catch {}
        }
      }
    }
  } catch {}

  return results;
}

// ─── Active Session Check ────────────────────────────────────────────────────

function loadSessionPIDFiles(sessionsDir: string): SessionPIDFile[] {
  if (!existsSync(sessionsDir)) return [];
  const results: SessionPIDFile[] = [];

  try {
    for (const file of readdirSync(sessionsDir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const content = readFileSync(join(sessionsDir, file), "utf8");
        results.push(JSON.parse(content));
      } catch {}
    }
  } catch {}

  return results;
}

function isPIDAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ─── Project Scanner ─────────────────────────────────────────────────────────

function scanProjects(projectsDir: string): Map<string, { jsonlFiles: string[]; sessionDirs: string[] }> {
  const projects = new Map<string, { jsonlFiles: string[]; sessionDirs: string[] }>();

  if (!existsSync(projectsDir)) return projects;

  let projectHashes: string[];
  try {
    projectHashes = readdirSync(projectsDir);
  } catch {
    return projects;
  }

  for (const hash of projectHashes) {
    const dir = join(projectsDir, hash);
    let stat;
    try { stat = statSync(dir); } catch { continue; }
    if (!stat.isDirectory()) continue;

    const entries = readdirSync(dir);
    const jsonlFiles = entries.filter((e) => e.endsWith(".jsonl") && isUUID(e.replace(".jsonl", "")));
    const sessionDirs = entries.filter((e) => {
      if (!isUUID(e)) return false;
      try { return statSync(join(dir, e)).isDirectory(); } catch { return false; }
    });

    if (jsonlFiles.length > 0 || sessionDirs.length > 0) {
      projects.set(hash, { jsonlFiles, sessionDirs });
    }
  }

  return projects;
}

// ─── Report Generation ───────────────────────────────────────────────────────

function generateReport(opts: { filterSession?: string }): DiagnosticReport {
  const paths = resolvePaths();
  const projects = scanProjects(paths.projectsDir);
  const ideMetadata = loadAllIDEMetadata(paths.ideMetadataDir);
  const pidFiles = loadSessionPIDFiles(paths.sessionsDir);

  const sessions: SessionReport[] = [];
  const globalIssues: DiagnosticIssue[] = [];
  const projectSummaries: { hash: string; sessionCount: number }[] = [];

  // Build IDE metadata index by cliSessionId
  const ideIndex = new Map<string, IDESessionMetadata>();
  for (const meta of ideMetadata) {
    if (meta.cliSessionId) ideIndex.set(meta.cliSessionId, meta);
  }

  // Build PID index by sessionId
  const pidIndex = new Map<string, SessionPIDFile>();
  for (const pf of pidFiles) {
    pidIndex.set(pf.sessionId, pf);
  }

  // Check for dead PID files
  for (const pf of pidFiles) {
    if (!isPIDAlive(pf.pid)) {
      globalIssues.push({
        severity: "warning",
        code: "DEAD_PID_SESSION",
        message: `Session ${pf.sessionId.slice(0, 8)}... has PID file for dead process ${pf.pid} (unclean shutdown)`,
      });
    }
  }

  // Analyze each project
  for (const [hash, { jsonlFiles, sessionDirs }] of projects) {
    const allSessionIds = new Set<string>();
    for (const f of jsonlFiles) allSessionIds.add(f.replace(".jsonl", ""));
    for (const d of sessionDirs) allSessionIds.add(d);

    let count = 0;

    for (const sessionId of allSessionIds) {
      if (opts.filterSession && sessionId !== opts.filterSession) continue;
      count++;

      const issues: DiagnosticIssue[] = [];
      const jsonlPath = join(paths.projectsDir, hash, `${sessionId}.jsonl`);
      const sessionDir = join(paths.projectsDir, hash, sessionId);

      // Analyze JSONL
      const jsonl = analyzeJSONL(jsonlPath);

      // Analyze subagents and tool results
      const subagents = analyzeSubagents(sessionDir);
      const toolResultCount = countToolResults(sessionDir);

      // Cross-reference IDE metadata
      const ideMeta = ideIndex.get(sessionId) ?? null;

      // Detect issues
      if (!jsonl.exists) {
        if (ideMeta) {
          issues.push({
            severity: "critical",
            code: "MISSING_JSONL",
            message: `IDE knows this session ("${ideMeta.title || "untitled"}") but no JSONL file exists on disk`,
          });
        } else if (subagents.length > 0) {
          issues.push({
            severity: "error",
            code: "MISSING_JSONL",
            message: `Session has ${subagents.length} subagent(s) but no main JSONL file`,
          });
        }
      } else {
        if (jsonl.truncatedLastLine) {
          issues.push({
            severity: "error",
            code: "TRUNCATED_WRITE",
            message: "Last line of JSONL is invalid JSON (likely buffer flush race on shutdown)",
          });
        }

        if (jsonl.corruptedLines > (jsonl.truncatedLastLine ? 1 : 0)) {
          issues.push({
            severity: "warning",
            code: "CORRUPTED_LINES",
            message: `${jsonl.corruptedLines} corrupted line(s) detected`,
          });
        }

        if (jsonl.brokenChainLinks > 0) {
          issues.push({
            severity: "warning",
            code: "BROKEN_CHAIN",
            message: `${jsonl.brokenChainLinks} parentUuid reference(s) point to non-existent messages`,
          });
        }

        if (jsonl.duplicateUuids > 0) {
          issues.push({
            severity: "info",
            code: "DUPLICATE_UUIDS",
            message: `${jsonl.duplicateUuids} duplicate UUID(s) detected (double write)`,
          });
        }

        if (jsonl.validLines > 0 && jsonl.userMessages === 0 && jsonl.assistantMessages === 0) {
          issues.push({
            severity: "info",
            code: "EMPTY_SESSION",
            message: "JSONL exists but contains no user/assistant messages",
          });
        }
      }

      // Check subagent metadata
      for (const sa of subagents) {
        if (!sa.hasMeta) {
          issues.push({
            severity: "info",
            code: "MISSING_SUBAGENT_META",
            message: `Subagent ${sa.id.slice(0, 20)}... has no .meta.json file`,
          });
        }
      }

      // Determine overall status
      let status: SessionReport["status"] = "healthy";
      for (const issue of issues) {
        if (issue.severity === "critical" && status !== "critical") status = "critical";
        else if (issue.severity === "error" && status !== "critical") status = "error";
        else if (issue.severity === "warning" && status === "healthy") status = "warning";
      }

      sessions.push({ sessionId, projectHash: hash, status, jsonl, subagents, toolResultCount, ideMetadata: ideMeta, issues });
    }

    projectSummaries.push({ hash, sessionCount: count });
  }

  // Check for IDE sessions without corresponding JSONL (orphaned)
  for (const meta of ideMetadata) {
    if (!meta.cliSessionId) continue;
    const found = sessions.some((s) => s.sessionId === meta.cliSessionId);
    if (!found) {
      globalIssues.push({
        severity: "warning",
        code: "ORPHANED_IDE_SESSION",
        message: `IDE session "${meta.title || meta.sessionId}" (cli: ${meta.cliSessionId.slice(0, 8)}...) has no matching project session`,
      });
    }
  }

  // Summary
  const summary = { healthy: 0, warning: 0, error: 0, critical: 0, dataLossRisk: 0 };
  for (const s of sessions) {
    summary[s.status]++;
    if (s.status === "critical" || s.status === "error") summary.dataLossRisk++;
  }

  return {
    timestamp: new Date().toISOString(),
    platform: platform(),
    claudeHome: resolvePaths().claudeHome,
    ideMetadataPath: paths.ideMetadataDir,
    projects: projectSummaries,
    sessions,
    globalIssues,
    summary,
  };
}

// ─── Output Formatting ───────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusTag(status: string): string {
  switch (status) {
    case "healthy":  return "HEALTHY ";
    case "warning":  return "WARNING ";
    case "error":    return "ERROR   ";
    case "critical": return "CRITICAL";
    default:         return status.toUpperCase();
  }
}

function printTextReport(report: DiagnosticReport, verbose: boolean): void {
  const totalSessions = report.sessions.length;

  console.log("Claude Code Session Persistence Diagnostic v1.0.0");
  console.log(`Platform: ${report.platform} | Claude home: ${report.claudeHome} | Sessions: ${totalSessions}`);
  if (report.ideMetadataPath) console.log(`IDE metadata: ${report.ideMetadataPath}`);
  console.log("");

  // Group sessions by project
  const byProject = new Map<string, SessionReport[]>();
  for (const s of report.sessions) {
    const arr = byProject.get(s.projectHash) ?? [];
    arr.push(s);
    byProject.set(s.projectHash, arr);
  }

  for (const [hash, sessions] of byProject) {
    const truncHash = hash.length > 60 ? hash.slice(0, 57) + "..." : hash;
    console.log(`=== ${truncHash} (${sessions.length} session${sessions.length !== 1 ? "s" : ""}) ===`);
    console.log("");

    for (const s of sessions) {
      const shortId = s.sessionId.slice(0, 8) + "..." + s.sessionId.slice(-3);
      const title = s.ideMetadata?.title ? ` "${s.ideMetadata.title}"` : "";
      const msgs = s.jsonl.exists ? `${s.jsonl.userMessages}u/${s.jsonl.assistantMessages}a` : "no file";
      const lines = s.jsonl.exists ? `${s.jsonl.lineCount} lines` : "";
      const size = s.jsonl.exists ? formatSize(s.jsonl.sizeBytes) : "";
      const subs = s.subagents.length > 0 ? ` | ${s.subagents.length} subagent(s)` : "";

      console.log(`  ${shortId}  ${statusTag(s.status)}  ${lines ? lines + " " + size : ""}  ${msgs}${subs}${title}`);

      if (s.issues.length > 0) {
        for (const issue of s.issues) {
          const prefix = issue.severity === "critical" || issue.severity === "error" ? "[ERROR]" : issue.severity === "warning" ? "[WARN] " : "[INFO] ";
          console.log(`    ${prefix} ${issue.code}: ${issue.message}`);
        }
      }

      if (verbose && s.jsonl.exists) {
        console.log(`    Versions: ${s.jsonl.versions.join(", ") || "unknown"}`);
        console.log(`    Entrypoints: ${s.jsonl.entrypoints.join(", ") || "unknown"}`);
        console.log(`    Time range: ${s.jsonl.firstTimestamp ?? "?"} -> ${s.jsonl.lastTimestamp ?? "?"}`);
        console.log(`    Queue ops: ${s.jsonl.queueOperations} | Summaries: ${s.jsonl.summaries} | Sidechain: ${s.jsonl.sidechainMessages}`);
        console.log(`    Tool results: ${s.toolResultCount}`);
        if (s.subagents.length > 0) {
          for (const sa of s.subagents) {
            console.log(`    Subagent: ${sa.id.slice(0, 30)}  ${sa.lineCount} lines  type=${sa.agentType ?? "?"} meta=${sa.hasMeta}`);
          }
        }
      }

      console.log("");
    }
  }

  // Global issues
  if (report.globalIssues.length > 0) {
    console.log("=== Global Issues ===");
    console.log("");
    for (const issue of report.globalIssues) {
      const prefix = issue.severity === "warning" ? "[WARN] " : "[INFO] ";
      console.log(`  ${prefix} ${issue.code}: ${issue.message}`);
    }
    console.log("");
  }

  // Summary
  console.log("=== Summary ===");
  console.log(`  Healthy: ${report.summary.healthy} | Warning: ${report.summary.warning} | Error: ${report.summary.error} | Critical: ${report.summary.critical}`);
  if (report.summary.dataLossRisk > 0) {
    console.log(`  Data loss risk: ${report.summary.dataLossRisk} session(s)`);
  }
  if (!verbose) {
    console.log("  Run with --verbose for details, --json for machine-readable output.");
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const verbose = args.includes("--verbose") || args.includes("-v");
  const sessionIdx = args.indexOf("--session");
  const filterSession = sessionIdx >= 0 ? args[sessionIdx + 1] : undefined;

  const report = generateReport({ filterSession });

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report, verbose);
  }
}

main().catch(console.error);

export {};
