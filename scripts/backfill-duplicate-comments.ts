#!/usr/bin/env bun

import {
  githubRequest,
  paginateAll,
  getRepoConfig,
  type GitHubIssue,
  type GitHubComment,
} from "./github-api";

async function triggerDedupeWorkflow(
  owner: string,
  repo: string,
  issueNumber: number,
  dryRun: boolean = true
): Promise<void> {
  if (dryRun) {
    console.log(`[DRY RUN] Would trigger dedupe workflow for issue #${issueNumber}`);
    return;
  }

  await githubRequest(
    `/repos/${owner}/${repo}/actions/workflows/claude-dedupe-issues.yml/dispatches`,
    "POST",
    {
      ref: "main",
      inputs: { issue_number: issueNumber.toString() },
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
  MAX_ISSUE_NUMBER - Only process issues with numbers less than this value (default: 4050)`);
  }
  console.log("[DEBUG] GitHub token found");

  const { owner, repo } = getRepoConfig();
  const dryRun = process.env.DRY_RUN !== "false";
  const maxIssueNumber = parseInt(process.env.MAX_ISSUE_NUMBER || "4050", 10);
  const minIssueNumber = parseInt(process.env.MIN_ISSUE_NUMBER || "1", 10);

  console.log(`[DEBUG] Repository: ${owner}/${repo}`);
  console.log(`[DEBUG] Dry run mode: ${dryRun}`);
  console.log(`[DEBUG] Looking at issues between #${minIssueNumber} and #${maxIssueNumber}`);

  console.log(`[DEBUG] Fetching issues between #${minIssueNumber} and #${maxIssueNumber}...`);
  const allPageIssues = await paginateAll<GitHubIssue>(
    `/repos/${owner}/${repo}/issues?state=all&sort=created&direction=desc`,
    200
  );
  const allIssues = allPageIssues.filter(
    (issue) => issue.number >= minIssueNumber && issue.number < maxIssueNumber
  );
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
      `/repos/${owner}/${repo}/issues/${issue.number}/comments`
    );
    console.log(`[DEBUG] Issue #${issue.number} has ${comments.length} comments`);

    const dupeDetectionComments = comments.filter(
      (comment) =>
        comment.body.includes("Found") &&
        comment.body.includes("possible duplicate") &&
        comment.user.type === "Bot"
    );
    console.log(
      `[DEBUG] Issue #${issue.number} has ${dupeDetectionComments.length} duplicate detection comments`
    );

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
        `[INFO] ${dryRun ? "[DRY RUN] " : ""}Triggering dedupe workflow for issue #${issue.number}: ${issueUrl}`
      );
      await triggerDedupeWorkflow(owner, repo, issue.number, dryRun);

      if (!dryRun) {
        console.log(
          `[SUCCESS] Successfully triggered dedupe workflow for issue #${issue.number}`
        );
      }
      triggeredCount++;
    } catch (error) {
      console.error(`[ERROR] Failed to trigger workflow for issue #${issue.number}: ${error}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(
    `[DEBUG] Script completed. Processed ${processedCount} issues, found ${candidateCount} candidates without duplicate comments, ${dryRun ? "would trigger" : "triggered"} ${triggeredCount} workflows`
  );
}

backfillDuplicateComments().catch(console.error);
