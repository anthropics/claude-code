#!/usr/bin/env bun
declare global {
  var process: {
    env: Record<string, string | undefined>;
    argv: string[];
  };
}
interface GitHubIssue {
  number: number;
  title: string;
  user: { id: number };
  created_at: string;
}
interface GitHubComment {
  id: number;
  body: string;
  created_at: string;
  user: { type: string; id: number };
}
interface GitHubReaction {
  user: { id: number };
  content: string;
}
// --
const DEBUG = process.argv.includes("--debug");
function log(level: "INFO" | "SUCCESS" | "ERROR" | "DEBUG", message: string) {
  if (level === "DEBUG" && !DEBUG) return;
  console[level === "ERROR" ? "error" : "log"](`[${level}] ${message}`);
}
// --
async function githubRequest<T>(endpoint: string, token: string, method: string = 'GET', body?: any): Promise<T> {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "auto-close-duplicates-script",
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
function extractDuplicateIssueNumber(commentBody: string): number | null {
  // Try to match #123 format first
  let match = commentBody.match(/#(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  // Try to match GitHub issue URL format: https://github.com/owner/repo/issues/123
  match = commentBody.match(/github\.com\/[^\/]+\/[^\/]+\/issues\/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}
async function closeIssueAsDuplicate(
  owner: string,
  repo: string,
  issueNumber: number,
  duplicateOfNumber: number,
  token: string
): Promise<void> {
  await githubRequest(
    `/repos/${owner}/${repo}/issues/${issueNumber}`,
    token,
    'PATCH',
    {
      state: 'closed',
      state_reason: 'duplicate',
      labels: ['duplicate']
    }
  );
  await githubRequest(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    token,
    'POST',
    {
      body: `This issue has been automatically closed as a duplicate of #${duplicateOfNumber}.\nIf this is incorrect, please re-open this issue or create a new one.\n\ud83e\udd16 Generated with [Claude Code](https://claude.ai/code)`
    }
  );
}
async function autoCloseDuplicates(): Promise<void> {
  log("DEBUG", "Starting auto-close duplicates script");
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }
  log("DEBUG", "GitHub token found");
  const owner = process.env.GITHUB_REPOSITORY_OWNER || "anthropics";
  const repo = process.env.GITHUB_REPOSITORY_NAME || "claude-code";
  log("DEBUG", `Repository: ${owner}/${repo}`);
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  log("DEBUG", `Checking for duplicate comments older than: ${threeDaysAgo.toISOString()}`);
  log("DEBUG", "Fetching open issues created more than 3 days ago...");
  const allIssues: GitHubIssue[] = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const pageIssues: GitHubIssue[] = await githubRequest(
      `/repos/${owner}/${repo}/issues?state=open&per_page=${perPage}&page=${page}`,
      token
    );
    if (pageIssues.length === 0) break;
    // Filter for issues created more than 3 days ago
    const oldEnoughIssues = pageIssues.filter(issue =>
      new Date(issue.created_at) <= threeDaysAgo
    );
    allIssues.push(...oldEnoughIssues);
    page++;
    // Safety limit to avoid infinite loops
    if (page > 20) break;
  }
  const issues = allIssues;
  log("INFO", `Found ${issues.length} open issues eligible for duplicate check`);
  let processedCount = 0;
  let candidateCount = 0;
  for (const issue of issues) {
    processedCount++;
    log("DEBUG", `Processing issue #${issue.number} (${processedCount}/${issues.length}): ${issue.title}`);
    const comments: GitHubComment[] = await githubRequest(
      `/repos/${owner}/${repo}/issues/${issue.number}/comments`,
      token
    );
    log("DEBUG", `Issue #${issue.number} has ${comments.length} comments`);
    const dupeComments = comments.filter(
      (comment) =>
        comment.body.includes("Found") &&
        comment.body.includes("possible duplicate") &&
        comment.user.type === "Bot"
    );
    log("DEBUG", `Issue #${issue.number} has ${dupeComments.length} duplicate detection comments`);
    if (dupeComments.length === 0) {
      log("DEBUG", `Issue #${issue.number} - no duplicate comments found, skipping`);
      continue;
    }
    const lastDupeComment = dupeComments[dupeComments.length - 1];
    const dupeCommentDate = new Date(lastDupeComment.created_at);
    log("DEBUG", `Issue #${issue.number} - most recent duplicate comment from: ${dupeCommentDate.toISOString()}`);
    if (dupeCommentDate > threeDaysAgo) {
      log("DEBUG", `Issue #${issue.number} - duplicate comment is too recent, skipping`);
      continue;
    }
    const commentsAfterDupe = comments.filter(
      (comment) => new Date(comment.created_at) > dupeCommentDate
    );
    log("DEBUG", `Issue #${issue.number} - ${commentsAfterDupe.length} comments after duplicate detection`);
    if (commentsAfterDupe.length > 0) {
      log("DEBUG", `Issue #${issue.number} - has activity after duplicate comment, skipping`);
      continue;
    }
    log("DEBUG", `Issue #${issue.number} - checking reactions on duplicate comment...`);
    const reactions: GitHubReaction[] = await githubRequest(
      `/repos/${owner}/${repo}/issues/comments/${lastDupeComment.id}/reactions`,
      token
    );
    log("DEBUG", `Issue #${issue.number} - duplicate comment has ${reactions.length} reactions`);
    const authorThumbsDown = reactions.some(
      (reaction) =>
        reaction.user.id === issue.user.id && reaction.content === "-1"
    );
    log("DEBUG", `Issue #${issue.number} - author thumbs down reaction: ${authorThumbsDown}`);
    if (authorThumbsDown) {
      log("DEBUG", `Issue #${issue.number} - author disagreed with duplicate detection, skipping`);
      continue;
    }
    const duplicateIssueNumber = extractDuplicateIssueNumber(lastDupeComment.body);
    if (!duplicateIssueNumber) {
      log("DEBUG", `Issue #${issue.number} - could not extract duplicate issue number from comment, skipping`);
      continue;
    }
    candidateCount++;
    const issueUrl = `https://github.com/${owner}/${repo}/issues/${issue.number}`;
    try {
      log("INFO", `Auto-closing issue #${issue.number} as duplicate of #${duplicateIssueNumber}: ${issueUrl}`);
      await closeIssueAsDuplicate(owner, repo, issue.number, duplicateIssueNumber, token);
      log("SUCCESS", `Successfully closed issue #${issue.number} as duplicate of #${duplicateIssueNumber}`);
    } catch (error) {
      log("ERROR", `Failed to close issue #${issue.number} as duplicate: ${error}`);
    }
  }
  log("INFO", `Script completed. Processed ${processedCount} issues, found ${candidateCount} candidates for auto-close`);
}
autoCloseDuplicates().catch(console.error);
// Make it a module
export {};
