#!/usr/bin/env bun

import {
  githubRequest,
  paginateAll,
  getRepoConfig,
  type GitHubIssue,
  type GitHubComment,
  type GitHubReaction,
} from "./github-api";

function extractDuplicateIssueNumber(commentBody: string): number | null {
  let match = commentBody.match(/#(\d+)/);
  if (match) return parseInt(match[1], 10);

  match = commentBody.match(/github\.com\/[^\/]+\/[^\/]+\/issues\/(\d+)/);
  if (match) return parseInt(match[1], 10);

  return null;
}

async function closeIssueAsDuplicate(
  owner: string,
  repo: string,
  issueNumber: number,
  duplicateOfNumber: number
): Promise<void> {
  await githubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}`, "PATCH", {
    state: "closed",
    state_reason: "duplicate",
    labels: ["duplicate"],
  });

  await githubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, "POST", {
    body: `This issue has been automatically closed as a duplicate of #${duplicateOfNumber}.

If this is incorrect, please re-open this issue or create a new one.

🤖 Generated with [Claude Code](https://claude.ai/code)`,
  });
}

async function autoCloseDuplicates(): Promise<void> {
  console.log("[DEBUG] Starting auto-close duplicates script");

  const { owner, repo } = getRepoConfig();
  console.log(`[DEBUG] Repository: ${owner}/${repo}`);

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  console.log(`[DEBUG] Checking for duplicate comments older than: ${threeDaysAgo.toISOString()}`);

  console.log("[DEBUG] Fetching open issues created more than 3 days ago...");
  const allPageIssues = await paginateAll<GitHubIssue>(
    `/repos/${owner}/${repo}/issues?state=open`,
    20
  );
  const issues = allPageIssues.filter(
    (issue) => new Date(issue.created_at) <= threeDaysAgo
  );
  console.log(`[DEBUG] Found ${issues.length} open issues`);

  let processedCount = 0;
  let candidateCount = 0;

  for (const issue of issues) {
    processedCount++;
    console.log(
      `[DEBUG] Processing issue #${issue.number} (${processedCount}/${issues.length}): ${issue.title}`
    );

    console.log(`[DEBUG] Fetching comments for issue #${issue.number}...`);
    const comments: GitHubComment[] = await githubRequest(
      `/repos/${owner}/${repo}/issues/${issue.number}/comments`
    );
    console.log(`[DEBUG] Issue #${issue.number} has ${comments.length} comments`);

    const dupeComments = comments.filter(
      (comment) =>
        comment.body.includes("Found") &&
        comment.body.includes("possible duplicate") &&
        comment.user.type === "Bot"
    );
    console.log(
      `[DEBUG] Issue #${issue.number} has ${dupeComments.length} duplicate detection comments`
    );

    if (dupeComments.length === 0) {
      console.log(`[DEBUG] Issue #${issue.number} - no duplicate comments found, skipping`);
      continue;
    }

    const lastDupeComment = dupeComments[dupeComments.length - 1];
    const dupeCommentDate = new Date(lastDupeComment.created_at);
    console.log(
      `[DEBUG] Issue #${issue.number} - most recent duplicate comment from: ${dupeCommentDate.toISOString()}`
    );

    if (dupeCommentDate > threeDaysAgo) {
      console.log(`[DEBUG] Issue #${issue.number} - duplicate comment is too recent, skipping`);
      continue;
    }
    console.log(
      `[DEBUG] Issue #${issue.number} - duplicate comment is old enough (${Math.floor(
        (Date.now() - dupeCommentDate.getTime()) / (1000 * 60 * 60 * 24)
      )} days)`
    );

    const commentsAfterDupe = comments.filter(
      (comment) => new Date(comment.created_at) > dupeCommentDate
    );
    console.log(
      `[DEBUG] Issue #${issue.number} - ${commentsAfterDupe.length} comments after duplicate detection`
    );

    if (commentsAfterDupe.length > 0) {
      console.log(
        `[DEBUG] Issue #${issue.number} - has activity after duplicate comment, skipping`
      );
      continue;
    }

    console.log(`[DEBUG] Issue #${issue.number} - checking reactions on duplicate comment...`);
    const reactions: GitHubReaction[] = await githubRequest(
      `/repos/${owner}/${repo}/issues/comments/${lastDupeComment.id}/reactions`
    );
    console.log(
      `[DEBUG] Issue #${issue.number} - duplicate comment has ${reactions.length} reactions`
    );

    const authorThumbsDown = reactions.some(
      (reaction) => reaction.user.id === issue.user.id && reaction.content === "-1"
    );
    console.log(
      `[DEBUG] Issue #${issue.number} - author thumbs down reaction: ${authorThumbsDown}`
    );

    if (authorThumbsDown) {
      console.log(
        `[DEBUG] Issue #${issue.number} - author disagreed with duplicate detection, skipping`
      );
      continue;
    }

    const duplicateIssueNumber = extractDuplicateIssueNumber(lastDupeComment.body);
    if (!duplicateIssueNumber) {
      console.log(
        `[DEBUG] Issue #${issue.number} - could not extract duplicate issue number from comment, skipping`
      );
      continue;
    }

    candidateCount++;
    const issueUrl = `https://github.com/${owner}/${repo}/issues/${issue.number}`;

    try {
      console.log(
        `[INFO] Auto-closing issue #${issue.number} as duplicate of #${duplicateIssueNumber}: ${issueUrl}`
      );
      await closeIssueAsDuplicate(owner, repo, issue.number, duplicateIssueNumber);
      console.log(
        `[SUCCESS] Successfully closed issue #${issue.number} as duplicate of #${duplicateIssueNumber}`
      );
    } catch (error) {
      console.error(`[ERROR] Failed to close issue #${issue.number} as duplicate: ${error}`);
    }
  }

  console.log(
    `[DEBUG] Script completed. Processed ${processedCount} issues, found ${candidateCount} candidates for auto-close`
  );
}

autoCloseDuplicates().catch(console.error);
