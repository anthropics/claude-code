import type { DuplicateCandidate } from "./github.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TriageResult {
  labels: string[];
  priority: "P0" | "P1" | "P2";
  summary: string;
  category: string;
  area: string;
  platform: string;
  api_provider: string;
  has_repro: boolean;
  needs_info: boolean;
  reasoning: string;
}

export interface DuplicateMatch {
  number: number;
  title: string;
  url: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

// ── Label taxonomy (mirrors anthropics/claude-code) ───────────────────────

export const AREA_LABELS = [
  "area:agent-sdk",
  "area:mcp",
  "area:tools",
  "area:hooks",
  "area:ide-integrations",
  "area:context-window",
  "area:memory",
  "area:performance",
  "area:permissions",
  "area:plugins",
  "area:terminal",
  "area:network",
  "area:claude-desktop",
  "area:bedrock",
  "area:vertex",
] as const;

export const TYPE_LABELS = ["bug", "enhancement", "question", "needs-info"] as const;
export const PLATFORM_LABELS = ["platform:linux", "platform:macos", "platform:windows"] as const;
export const API_LABELS = ["api:anthropic", "api:bedrock", "api:vertex"] as const;
export const PRIORITY_LABELS = ["P0", "P1", "P2"] as const;

// ── System prompts ─────────────────────────────────────────────────────────

export const TRIAGE_SYSTEM_PROMPT = `You are an expert issue triager for the anthropics/claude-code repository.
Your job is to analyze GitHub issues and return a structured triage result as JSON.

## Label taxonomy

**Area labels** (pick the most relevant one or two):
${AREA_LABELS.join(", ")}

**Type labels** (pick exactly one):
${TYPE_LABELS.join(", ")}

**Platform labels** (include if mentioned or inferable):
${PLATFORM_LABELS.join(", ")}

**API labels** (include if the issue involves a specific API backend):
${API_LABELS.join(", ")}

**Priority** (pick exactly one):
- P0: crash, security vulnerability, data loss, or complete feature breakage with no workaround
- P1: significant functionality broken, no reasonable workaround, affects many users
- P2: minor bug, cosmetic issue, enhancement request, or has a workaround

## Output format

Respond with ONLY valid JSON (no markdown fences, no explanation):
{
  "labels": ["bug", "area:performance", "platform:macos"],
  "priority": "P1",
  "summary": "One sentence describing the issue",
  "category": "Human-readable category (e.g. 'Fast Action Bug', 'MCP Connection Error')",
  "area": "primary area label value (e.g. 'area:performance')",
  "platform": "platform label if applicable, else empty string",
  "api_provider": "api label if applicable, else empty string",
  "has_repro": true,
  "needs_info": false,
  "reasoning": "2-3 sentences explaining priority and label choices"
}

## Triage guidelines

- Mark \`needs_info: true\` when the issue lacks version, OS, repro steps, or error output
- \`has_repro: true\` when issue includes concrete repro steps or error output
- P0 only for crashes, security issues, or complete data loss
- P1 for things that break a core workflow without workaround
- Default to P2 for enhancements and minor issues
- Always include the type label (bug/enhancement/question/needs-info)`;

export const DUPLICATE_CHECK_SYSTEM_PROMPT = `You are evaluating whether GitHub issues are duplicates.
Given a new issue and a list of candidate existing issues, determine which (if any) are likely duplicates.
Respond with ONLY valid JSON (no markdown fences):
{
  "duplicates": [
    {
      "number": 123,
      "title": "exact title from candidates",
      "url": "https://github.com/...",
      "confidence": "high",
      "reasoning": "Both describe the same fast-action edit-without-read problem"
    }
  ]
}
Only include candidates with medium or high confidence. Return empty array if no duplicates found.`;

export const DIGEST_SYSTEM_PROMPT = `You are a technical writer generating a weekly digest for the anthropics/claude-code repository.
Your audience is Anthropic engineers and maintainers. Write in clear, professional English.

Structure your digest as a GitHub issue body using this exact format:

# Weekly Claude Code Community Digest — {date range}

## Highlights
- [2-4 bullet points: most important things that happened]

## Needs Attention
Issues that are P0 or P1 and still open (or recently reported):
| Issue | Priority | Summary | Reported |
|-------|----------|---------|----------|
| #N [title](url) | P0/P1 | brief desc | date |

## Bug Reports ({count} new)
| Issue | Area | Platform | Has Repro | Summary |
|-------|------|----------|-----------|---------|
| #N [title](url) | area | platform | ✅/❌ | summary |

## Enhancement Requests ({count} new)
| Issue | Area | Summary |
|-------|------|---------|
| #N [title](url) | area | summary |

## Merged PRs ({count})
| PR | Summary | Author |
|----|---------|--------|
| #N [title](url) | summary | @user |

## Trends & Patterns
[2-4 sentences about patterns you notice: recurring issues, hot areas, user pain points]

## Stats
| Metric | Count |
|--------|-------|
| New issues | N |
| Closed issues | N |
| Open P0/P1 | N |
| Merged PRs | N |
| Contributors | N |

---
*Generated by claude-code-triage · Model: {model} · [Source](https://github.com/anthropics/claude-code/tree/main/.github/claude-triage)*`;

// ── Prompt builders ────────────────────────────────────────────────────────

export function buildTriageUserPrompt(
  number: number,
  title: string,
  body: string | null
): string {
  return `Issue #${number}: ${title}

${body ?? "(no body provided)"}`;
}

export function buildDuplicateCheckUserPrompt(
  newTitle: string,
  newBody: string | null,
  candidates: DuplicateCandidate[]
): string {
  return `New issue: "${newTitle}"
Body: ${newBody?.slice(0, 500) ?? "(no body)"}

Candidate existing issues:
${candidates
  .map(
    (c) =>
      `- #${c.number} [${c.state}] "${c.title}" (${c.html_url}) opened ${c.created_at}`
  )
  .join("\n")}`;
}

export function buildDigestUserPrompt(
  issues: Array<{ number: number; title: string; body: string | null; state: string; labels: string[]; created_at: string; html_url: string; user: string | null }>,
  pullRequests: Array<{ number: number; title: string; body: string | null; state: string; merged_at: string | null; created_at: string; html_url: string; user: string | null }>,
  days: number
): string {
  const issueLines = issues
    .map(
      (i) =>
        `#${i.number} [${i.state}] "${i.title}" labels=[${i.labels.join(",")}] opened=${i.created_at} url=${i.html_url} author=${i.user ?? "unknown"}`
    )
    .join("\n");

  const prLines = pullRequests
    .map(
      (pr) =>
        `#${pr.number} [${pr.state}${pr.merged_at ? " merged" : ""}] "${pr.title}" opened=${pr.created_at} url=${pr.html_url} author=${pr.user ?? "unknown"}`
    )
    .join("\n");

  return `Generate a weekly digest for the past ${days} days.

ISSUES (${issues.length} total):
${issueLines || "(none)"}

PULL REQUESTS (${pullRequests.length} total):
${prLines || "(none)"}`;
}

// ── Comment formatters ─────────────────────────────────────────────────────

export function formatTriageComment(
  result: TriageResult,
  duplicates: DuplicateMatch[]
): string {
  const rows = [
    ["Priority", `**${result.priority}**`],
    ["Category", result.category],
    ["Area", result.area || "—"],
    ["Platform", result.platform || "—"],
    ["API Provider", result.api_provider || "—"],
    ["Has Repro", result.has_repro ? "✅ Yes" : "❌ No"],
    ["Needs Info", result.needs_info ? "⚠️ Yes" : "No"],
  ];

  const table = [
    "| Field | Value |",
    "|-------|-------|",
    ...rows.map(([k, v]) => `| ${k} | ${v} |`),
  ].join("\n");

  let comment = `### Automated Triage

${table}

**Summary:** ${result.summary}

**Reasoning:** ${result.reasoning}`;

  if (result.needs_info) {
    comment += `\n\n> [!NOTE]\n> This issue appears to be missing information needed to reproduce or investigate. Could you please provide: version (\`claude --version\`), OS/platform, minimal repro steps, and any error output?`;
  }

  if (duplicates.length > 0) {
    const dupLines = duplicates
      .map(
        (d) =>
          `- [#${d.number} ${d.title}](${d.url}) — ${d.confidence} confidence: ${d.reasoning}`
      )
      .join("\n");
    comment += `\n\n**Possible duplicates:**\n${dupLines}`;
  }

  comment += `\n\n---\n*Automated triage by [claude-code-triage](https://github.com/anthropics/claude-code/tree/main/.github/claude-triage) · Labels are suggestions only — maintainers have final say.*`;

  return comment;
}
