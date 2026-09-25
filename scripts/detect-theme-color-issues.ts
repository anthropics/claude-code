#!/usr/bin/env bun

/**
 * detect-theme-color-issues.ts
 *
 * Scans open issues for reports of unreadable / invisible text on light terminal
 * themes and groups them so maintainers can track the color7/color0 collision
 * family as a single cluster rather than N separate duplicates.
 *
 * Usage:
 *   GITHUB_TOKEN=<token> bun scripts/detect-theme-color-issues.ts
 *
 * Optional env vars:
 *   GITHUB_REPOSITORY_OWNER  (default: anthropics)
 *   GITHUB_REPOSITORY_NAME   (default: claude-code)
 *   DRY_RUN=1                print matches without posting comments
 */

declare global {
  var process: {
    env: Record<string, string | undefined>;
  };
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  labels: { name: string }[];
  created_at: string;
  pull_request?: unknown;
}

interface GitHubComment {
  body?: string;
  user?: { type: string } | null;
}

// Keywords that strongly suggest a light-theme color visibility bug
const LIGHT_THEME_SIGNALS = [
  "light theme",
  "light mode",
  "light terminal",
  "white text",
  "invisible text",
  "unreadable",
  "light background",
  "solarized light",
  "light color",
  "light gray",
  "planning window",
  "planning mode.*white",
  "white.*planning",
  "code block.*invisible",
  "invisible.*code block",
];

// Known anchor issues that are the canonical reports for this family
const KNOWN_ANCHORS = [40905, 38386, 65279];

async function githubRequest<T>(
  endpoint: string,
  token: string,
  method: string = "GET",
  body?: unknown
): Promise<T> {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "detect-theme-color-issues-script",
      ...(body && { "Content-Type": "application/json" }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText} — ${endpoint}`
    );
  }

  return response.json();
}

function matchesLightThemeBug(issue: GitHubIssue): boolean {
  const text = `${issue.title} ${issue.body ?? ""}`.toLowerCase();
  return LIGHT_THEME_SIGNALS.some((signal) =>
    new RegExp(signal, "i").test(text)
  );
}

function alreadyLabelled(issue: GitHubIssue): boolean {
  return issue.labels.some((l) =>
    ["duplicate", "wontfix", "closed"].includes(l.name.toLowerCase())
  );
}

async function postGroupingComment(
  owner: string,
  repo: string,
  issueNumber: number,
  token: string,
  dryRun: boolean
): Promise<void> {
  const comment = `
**Possible match: light-theme color visibility cluster**

This issue appears related to a known family of bugs where \`color7\` (ANSI white) is used for code text tokens in light-ANSI mode, making them invisible against light backgrounds.

**Canonical reports:**
- #40905 — \`color7\` / \`color0\` collision in light-ANSI theme (root cause analysis)
- #38386 — Planning mode text invisible on Solarized Light
- #65279 — Planning window code blocks unreadable on light VSCode themes

**Known fix pattern (already applied to diff context lines in v2.1.141):**
Use \`color0\` (ANSI black) for code default tokens in light mode instead of \`color7\` (ANSI white).

If this is the same issue, a 👍 on this comment helps maintainers triage. If it's different, please add details so we can distinguish it.

🤖 Generated with [Claude Code](https://claude.ai/code)
`.trim();

  if (dryRun) {
    console.log(
      `[DRY RUN] Would post grouping comment on #${issueNumber}:\n${comment}\n`
    );
    return;
  }

  await githubRequest(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    token,
    "POST",
    { body: comment }
  );

  console.log(`[SUCCESS] Posted grouping comment on #${issueNumber}`);
}

async function detectThemeColorIssues(): Promise<void> {
  console.log("[INFO] Starting light-theme color collision detector");

  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN environment variable is required");

  const owner = process.env.GITHUB_REPOSITORY_OWNER ?? "anthropics";
  const repo = process.env.GITHUB_REPOSITORY_NAME ?? "claude-code";
  const dryRun = process.env.DRY_RUN === "1";

  console.log(`[INFO] Repo: ${owner}/${repo}  DRY_RUN=${dryRun}`);

  // Fetch open issues labelled area:tui or area:ui (most relevant)
  const issues: GitHubIssue[] = [];
  for (const label of ["area:tui", "area:ui", "area:ide"]) {
    let page = 1;
    while (page <= 10) {
      const page_issues: GitHubIssue[] = await githubRequest(
        `/repos/${owner}/${repo}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=100&page=${page}`,
        token
      );
      if (page_issues.length === 0) break;
      issues.push(...page_issues);
      page++;
    }
  }

  // Deduplicate by issue number
  const seen = new Set<number>();
  const unique = issues.filter((i) => {
    if (seen.has(i.number)) return false;
    seen.add(i.number);
    return true;
  });

  console.log(`[INFO] Fetched ${unique.length} unique open issues to scan`);

  const matches: GitHubIssue[] = [];

  for (const issue of unique) {
    // Skip pull requests
    if (issue.pull_request) continue;
    // Skip anchor issues themselves
    if (KNOWN_ANCHORS.includes(issue.number)) continue;
    // Skip already labelled issues
    if (alreadyLabelled(issue)) continue;
    // Check for light-theme keywords
    if (matchesLightThemeBug(issue)) {
      // Avoid posting duplicate grouping comments if one already exists
      let comments: GitHubComment[] = [];
      try {
        comments = await githubRequest<GitHubComment[]>(
          `/repos/${owner}/${repo}/issues/${issue.number}/comments?per_page=100`,
          token
        );
      } catch (error) {
        console.error(`[ERROR] Failed to fetch comments for issue #${issue.number}:`, error);
        continue; // Skip this issue to be safe rather than posting a duplicate
      }
      
      const alreadyCommented = comments.some((c) =>
        c.body?.includes("Possible match: light-theme color visibility cluster")
      );
      if (alreadyCommented) {
        console.log(`[INFO] Already posted grouping comment on #${issue.number}, skipping`);
        continue;
      }
      matches.push(issue);
    }
  }

  console.log(
    `[INFO] Found ${matches.length} issues matching light-theme color pattern`
  );

  for (const issue of matches) {
    console.log(`  #${issue.number} — ${issue.title}`);
    await postGroupingComment(owner, repo, issue.number, token, dryRun);
  }

  console.log("[INFO] Done.");
}

detectThemeColorIssues().catch(console.error);

export {};
