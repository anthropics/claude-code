#!/usr/bin/env bun

import { pathToFileURL } from "node:url";

declare global {
  var process: {
    argv: string[];
    env: Record<string, string | undefined>;
  };
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  state_reason?: string;
  user: { id: number };
  created_at: string;
  closed_at?: string;
  locked?: boolean;
  pull_request?: { url: string };
}

export interface GitHubComment {
  id: number;
  body: string;
  created_at: string;
  user: { type: string; id: number };
}

export interface BackfillConfig {
  token: string;
  owner: string;
  repo: string;
  dryRun: boolean;
  daysBack: number;
  cutoffDate: Date;
}

type RequestFn = <T>(
  endpoint: string,
  token: string,
  method?: string,
  body?: unknown
) => Promise<T>;

const DEFAULT_OWNER = "anthropics";
const DEFAULT_REPO = "claude-code";
const DUPLICATE_COMMENT_MARKERS = ["Found", "possible duplicate"];

export async function githubRequest<T>(
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
      "User-Agent": "backfill-duplicate-comments-script",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API request failed: ${response.status} ${response.statusText}`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function parseRepository(
  env: Record<string, string | undefined>
): { owner: string; repo: string } {
  const fullRepo = env.GITHUB_REPOSITORY;
  if (fullRepo) {
    const [owner, repo] = fullRepo.split("/", 2);
    if (owner && repo) {
      return { owner, repo };
    }
  }

  return {
    owner: env.GITHUB_REPOSITORY_OWNER || DEFAULT_OWNER,
    repo: env.GITHUB_REPOSITORY_NAME || DEFAULT_REPO,
  };
}

export function parseBackfillConfig(
  env: Record<string, string | undefined>,
  now: Date = new Date()
): BackfillConfig {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(`GITHUB_TOKEN environment variable is required

Usage:
  GITHUB_TOKEN=your_token bun run scripts/backfill-duplicate-comments.ts

Environment Variables:
  GITHUB_TOKEN - GitHub personal access token with repo and actions permissions (required)
  GITHUB_REPOSITORY - Repository in owner/repo format (preferred)
  GITHUB_REPOSITORY_OWNER / GITHUB_REPOSITORY_NAME - Repository fallback values
  DAYS_BACK - Only inspect issues created within the last N days (default: 90)
  DRY_RUN - Set to "false" to actually trigger workflows (default: true for safety)`);
  }

  const daysBack = Number.parseInt(env.DAYS_BACK || "90", 10);
  if (!Number.isFinite(daysBack) || daysBack < 1) {
    throw new Error("DAYS_BACK must be a positive integer");
  }

  const cutoffDate = new Date(now);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - daysBack);

  return {
    token,
    ...parseRepository(env),
    dryRun: env.DRY_RUN !== "false",
    daysBack,
    cutoffDate,
  };
}

export function isDuplicateDetectionComment(comment: GitHubComment): boolean {
  return (
    comment.user.type === "Bot" &&
    DUPLICATE_COMMENT_MARKERS.every((marker) => comment.body.includes(marker))
  );
}

export function isBackfillCandidate(
  issue: GitHubIssue,
  cutoffDate: Date
): boolean {
  if (issue.state !== "open" || issue.locked || issue.pull_request) {
    return false;
  }

  return new Date(issue.created_at) >= cutoffDate;
}

export function shouldFetchNextPage(
  pageIssues: GitHubIssue[],
  cutoffDate: Date,
  perPage: number
): boolean {
  if (pageIssues.length < perPage) {
    return false;
  }

  const oldestIssue = pageIssues[pageIssues.length - 1];
  if (!oldestIssue) {
    return false;
  }

  return new Date(oldestIssue.created_at) >= cutoffDate;
}

export async function collectCandidateIssues(
  config: BackfillConfig,
  request: RequestFn = githubRequest,
  perPage: number = 100
): Promise<GitHubIssue[]> {
  const issues: GitHubIssue[] = [];
  let page = 1;

  while (page <= 200) {
    const pageIssues = await request<GitHubIssue[]>(
      `/repos/${config.owner}/${config.repo}/issues?state=open&per_page=${perPage}&page=${page}&sort=created&direction=desc`,
      config.token
    );

    if (pageIssues.length === 0) {
      break;
    }

    issues.push(
      ...pageIssues.filter((issue) => isBackfillCandidate(issue, config.cutoffDate))
    );

    if (!shouldFetchNextPage(pageIssues, config.cutoffDate, perPage)) {
      break;
    }

    page += 1;
  }

  return issues;
}

export async function triggerDedupeWorkflow(
  owner: string,
  repo: string,
  issueNumber: number,
  token: string,
  dryRun: boolean = true,
  request: RequestFn = githubRequest
): Promise<void> {
  if (dryRun) {
    console.log(`[DRY RUN] Would trigger dedupe workflow for issue #${issueNumber}`);
    return;
  }

  await request(
    `/repos/${owner}/${repo}/actions/workflows/claude-dedupe-issues.yml/dispatches`,
    token,
    "POST",
    {
      ref: "main",
      inputs: {
        issue_number: issueNumber.toString(),
      },
    }
  );
}

export async function backfillDuplicateComments(
  env: Record<string, string | undefined> = process.env,
  request: RequestFn = githubRequest
): Promise<void> {
  console.log("[DEBUG] Starting backfill duplicate comments script");

  const config = parseBackfillConfig(env);
  console.log("[DEBUG] GitHub token found");
  console.log(`[DEBUG] Repository: ${config.owner}/${config.repo}`);
  console.log(`[DEBUG] Dry run mode: ${config.dryRun}`);
  console.log(
    `[DEBUG] Looking at open issues created on or after ${config.cutoffDate.toISOString()}`
  );

  const issues = await collectCandidateIssues(config, request);
  console.log(`[DEBUG] Found ${issues.length} candidate issues in range`);

  let processedCount = 0;
  let candidateCount = 0;
  let triggeredCount = 0;

  for (const issue of issues) {
    processedCount += 1;
    console.log(
      `[DEBUG] Processing issue #${issue.number} (${processedCount}/${issues.length}): ${issue.title}`
    );

    const comments = await request<GitHubComment[]>(
      `/repos/${config.owner}/${config.repo}/issues/${issue.number}/comments`,
      config.token
    );
    console.log(
      `[DEBUG] Issue #${issue.number} has ${comments.length} comments`
    );

    if (comments.some(isDuplicateDetectionComment)) {
      console.log(
        `[DEBUG] Issue #${issue.number} already has duplicate detection comment, skipping`
      );
      continue;
    }

    candidateCount += 1;
    const issueUrl = `https://github.com/${config.owner}/${config.repo}/issues/${issue.number}`;

    try {
      console.log(
        `[INFO] ${config.dryRun ? "[DRY RUN] " : ""}Triggering dedupe workflow for issue #${issue.number}: ${issueUrl}`
      );
      await triggerDedupeWorkflow(
        config.owner,
        config.repo,
        issue.number,
        config.token,
        config.dryRun,
        request
      );

      if (!config.dryRun) {
        console.log(
          `[SUCCESS] Successfully triggered dedupe workflow for issue #${issue.number}`
        );
      }
      triggeredCount += 1;
    } catch (error) {
      console.error(
        `[ERROR] Failed to trigger workflow for issue #${issue.number}: ${error}`
      );
    }

    if (!config.dryRun) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(
    `[DEBUG] Script completed. Processed ${processedCount} issues, found ${candidateCount} candidates without duplicate comments, ${config.dryRun ? "would trigger" : "triggered"} ${triggeredCount} workflows`
  );
}

const isMainModule =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  backfillDuplicateComments().catch(console.error);
}
