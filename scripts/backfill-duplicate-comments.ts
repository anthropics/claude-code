#!/usr/bin/env bun

declare global {
  var process: {
    env: Record<string, string | undefined>;
  };
}

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  state_reason?: string;
  user: { id: number };
  created_at: string;
  closed_at?: string;
}

interface GitHubComment {
  id: number;
  body: string;
  created_at: string;
  user: { type: string; id: number };
}

async function githubRequest<T>(endpoint: string, token: string, method: string = 'GET', body?: any): Promise<T> {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "backfill-duplicate-comments-script",
      ...(body && { "Content-Type": "application/json" }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

async function triggerDedupeWorkflow(
  owner: string,
  repo: string,
  issueNumber: number,
  token: string,
  dryRun: boolean = true
): Promise<void> {
  if (dryRun) {
    console.log(`[DRY RUN] Would trigger dedupe workflow for issue #${issueNumber}`);
    return;
  }

  await githubRequest(
    `/repos/${owner}/${repo}/actions/workflows/claude-dedupe-issues.yml/dispatches`,
    token,
    'POST',
    {
      ref: 'main',
      inputs: {
        issue_number: issueNumber.toString()
      }
    }
  );
}

async function backfillDuplicateComments(): Promise<void> {
  console.log("[DEBUG] Starting backfill duplicate comments script");

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(`GITHUB_TOKEN environment variable is required

Usage:
  GITHUB_TOKEN=your_token bun run scripts/backfill-duplicate-comments.ts

Environment Variables:
  GITHUB_TOKEN - GitHub personal access token with repo and actions permissions (required)
  DRY_RUN - Set to "false" to actually trigger workflows (default: true for safety)
  DAYS_BACK - Only process issues created in the last N days (default: no date filter)
  MAX_ISSUE_NUMBER - Only process issues with numbers less than this value (default: 4050, or no cap when DAYS_BACK is set)`);
  }
  console.log("[DEBUG] GitHub token found");

  const owner = "anthropics";
  const repo = "claude-code";
  const dryRun = process.env.DRY_RUN !== "false";

  let cutoffTime: number | undefined;
  if (process.env.DAYS_BACK) {
    const daysBack = parseInt(process.env.DAYS_BACK, 10);
    if (!Number.isInteger(daysBack) || daysBack <= 0) {
      throw new Error(`DAYS_BACK must be a positive integer (got: "${process.env.DAYS_BACK}")`);
    }
    cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  }

  // The issue-number cap is a legacy default from the original backfill run;
  // don't apply it when the caller asked for a date window instead
  const defaultMaxIssueNumber = cutoffTime === undefined ? "4050" : `${Number.MAX_SAFE_INTEGER}`;
  const maxIssueNumber = parseInt(process.env.MAX_ISSUE_NUMBER || defaultMaxIssueNumber, 10);
  const minIssueNumber = parseInt(process.env.MIN_ISSUE_NUMBER || "1", 10);

  console.log(`[DEBUG] Repository: ${owner}/${repo}`);
  console.log(`[DEBUG] Dry run mode: ${dryRun}`);
  console.log(`[DEBUG] Looking at issues between #${minIssueNumber} and #${maxIssueNumber}`);
  if (cutoffTime !== undefined) {
    console.log(`[DEBUG] Only processing issues created after ${new Date(cutoffTime).toISOString()} (DAYS_BACK=${process.env.DAYS_BACK})`);
  }

  console.log(`[DEBUG] Fetching issues between #${minIssueNumber} and #${maxIssueNumber}...`);
  const allIssues: GitHubIssue[] = [];
  let page = 1;
  const perPage = 100;
  
  while (true) {
    const pageIssues: GitHubIssue[] = await githubRequest(
      `/repos/${owner}/${repo}/issues?state=all&per_page=${perPage}&page=${page}&sort=created&direction=desc`,
      token
    );
    
    if (pageIssues.length === 0) break;
    
    // Filter to only include issues within the specified range
    const filteredIssues = pageIssues.filter(issue =>
      issue.number >= minIssueNumber && issue.number < maxIssueNumber &&
      (cutoffTime === undefined || new Date(issue.created_at).getTime() >= cutoffTime)
    );
    allIssues.push(...filteredIssues);

    // If the oldest issue in this page is still above our minimum, we need to continue
    // but if the oldest issue is below our minimum, we can stop
    const oldestIssueInPage = pageIssues[pageIssues.length - 1];
    // Pages are sorted by created desc, so once we're past the date cutoff we're done
    if (oldestIssueInPage && cutoffTime !== undefined && new Date(oldestIssueInPage.created_at).getTime() < cutoffTime) {
      console.log(`[DEBUG] Oldest issue in page #${page} (#${oldestIssueInPage.number}) is older than the DAYS_BACK cutoff, stopping`);
      break;
    }
    if (oldestIssueInPage && oldestIssueInPage.number >= maxIssueNumber) {
      console.log(`[DEBUG] Oldest issue in page #${page} is #${oldestIssueInPage.number}, continuing...`);
    } else if (oldestIssueInPage && oldestIssueInPage.number < minIssueNumber) {
      console.log(`[DEBUG] Oldest issue in page #${page} is #${oldestIssueInPage.number}, below minimum, stopping`);
      break;
    } else if (filteredIssues.length === 0 && pageIssues.length > 0) {
      console.log(`[DEBUG] No issues in page #${page} are in range #${minIssueNumber}-#${maxIssueNumber}, continuing...`);
    }
    
    page++;
    
    // Safety limit to avoid infinite loops
    if (page > 200) {
      console.log("[DEBUG] Reached page limit, stopping pagination");
      break;
    }
  }
  
  console.log(`[DEBUG] Found ${allIssues.length} issues between #${minIssueNumber} and #${maxIssueNumber}`);

  let processedCount = 0;
  let candidateCount = 0;
  let triggeredCount = 0;

  for (const issue of allIssues) {
    processedCount++;
    console.log(
      `[DEBUG] Processing issue #${issue.number} (${processedCount}/${allIssues.length}): ${issue.title}`
    );

    console.log(`[DEBUG] Fetching comments for issue #${issue.number}...`);
    const comments: GitHubComment[] = await githubRequest(
      `/repos/${owner}/${repo}/issues/${issue.number}/comments`,
      token
    );
    console.log(
      `[DEBUG] Issue #${issue.number} has ${comments.length} comments`
    );

    // Look for existing duplicate detection comments (from the dedupe bot)
    const dupeDetectionComments = comments.filter(
      (comment) =>
        comment.body.includes("Found") &&
        comment.body.includes("possible duplicate") &&
        comment.user.type === "Bot"
    );

    console.log(
      `[DEBUG] Issue #${issue.number} has ${dupeDetectionComments.length} duplicate detection comments`
    );

    // Skip if there's already a duplicate detection comment
    if (dupeDetectionComments.length > 0) {
      console.log(
        `[DEBUG] Issue #${issue.number} already has duplicate detection comment, skipping`
      );
      continue;
    }

    candidateCount++;
    const issueUrl = `https://github.com/${owner}/${repo}/issues/${issue.number}`;
    
    try {
      console.log(
        `[INFO] ${dryRun ? '[DRY RUN] ' : ''}Triggering dedupe workflow for issue #${issue.number}: ${issueUrl}`
      );
      await triggerDedupeWorkflow(owner, repo, issue.number, token, dryRun);
      
      if (!dryRun) {
        console.log(
          `[SUCCESS] Successfully triggered dedupe workflow for issue #${issue.number}`
        );
      }
      triggeredCount++;
    } catch (error) {
      console.error(
        `[ERROR] Failed to trigger workflow for issue #${issue.number}: ${error}`
      );
    }

    // Add a delay between workflow triggers to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(
    `[DEBUG] Script completed. Processed ${processedCount} issues, found ${candidateCount} candidates without duplicate comments, ${dryRun ? 'would trigger' : 'triggered'} ${triggeredCount} workflows`
  );
}

backfillDuplicateComments().catch(console.error);

// Make it a module
export {};