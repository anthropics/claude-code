#!/usr/bin/env bun

declare global {
  var process: {
    env: Record<string, string | undefined>;
  };
}

interface GitHubLabel {
  name: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  user: { id: number };
  created_at: string;
  labels?: GitHubLabel[];
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

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function githubRequest<T>(
  endpoint: string,
  token: string,
  method: string = 'GET',
  body?: any,
  retries: number = 3
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(`https://api.github.com${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "auto-close-duplicates-script",
        ...(body && { "Content-Type": "application/json" }),
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    // Check rate limit
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const resetTime = response.headers.get('X-RateLimit-Reset');

    if (remaining && parseInt(remaining) < 100) {
      console.warn(`[WARNING] Rate limit low: ${remaining} requests remaining`);
    }

    // Handle rate limiting
    if (response.status === 429 || (response.status === 403 && remaining === '0')) {
      const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : new Date(Date.now() + 60000);
      const waitMs = Math.max(0, resetDate.getTime() - Date.now()) + 1000;
      console.warn(`[WARNING] Rate limited. Waiting ${Math.ceil(waitMs/1000)}s...`);
      if (attempt < retries) {
        await sleep(waitMs);
        continue;
      }
    }

    // Handle errors with retry
    if (!response.ok) {
      const errorBody = await response.text();
      const errorMsg = `GitHub API request failed: ${response.status} ${response.statusText}\nEndpoint: ${endpoint}\nBody: ${errorBody}`;

      if (attempt < retries && (response.status >= 500 || response.status === 429)) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[WARNING] Request failed, retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      throw new Error(errorMsg);
    }

    return response.json();
  }

  throw new Error(`Failed after ${retries} retries`);
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
  existingLabels: string[],
  token: string
): Promise<void> {
  // Preserve existing labels and add 'duplicate' if not present
  const updatedLabels = existingLabels.includes('duplicate')
    ? existingLabels
    : [...existingLabels, 'duplicate'];

  await githubRequest(
    `/repos/${owner}/${repo}/issues/${issueNumber}`,
    token,
    'PATCH',
    {
      state: 'closed',
      state_reason: 'not_planned',
      labels: updatedLabels
    }
  );

  await githubRequest(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    token,
    'POST',
    {
      body: `This issue has been automatically closed as a duplicate of #${duplicateOfNumber}.

If this is incorrect, please re-open this issue or create a new one.

🤖 Generated with [Claude Code](https://claude.ai/code)`
    }
  );
}

async function autoCloseDuplicates(): Promise<void> {
  console.log("[DEBUG] Starting auto-close duplicates script");

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }
  console.log("[DEBUG] GitHub token found");

  const owner = process.env.GITHUB_REPOSITORY_OWNER || "anthropics";
  const repo = process.env.GITHUB_REPOSITORY_NAME || "claude-code";
  console.log(`[DEBUG] Repository: ${owner}/${repo}`);

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  console.log(
    `[DEBUG] Checking for duplicate comments older than: ${threeDaysAgo.toISOString()}`
  );

  console.log("[DEBUG] Fetching open issues created more than 3 days ago...");
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
      `/repos/${owner}/${repo}/issues/${issue.number}/comments`,
      token
    );
    console.log(
      `[DEBUG] Issue #${issue.number} has ${comments.length} comments`
    );

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
      console.log(
        `[DEBUG] Issue #${issue.number} - no duplicate comments found, skipping`
      );
      continue;
    }

    const lastDupeComment = dupeComments[dupeComments.length - 1];
    const dupeCommentDate = new Date(lastDupeComment.created_at);
    console.log(
      `[DEBUG] Issue #${
        issue.number
      } - most recent duplicate comment from: ${dupeCommentDate.toISOString()}`
    );

    if (dupeCommentDate > threeDaysAgo) {
      console.log(
        `[DEBUG] Issue #${issue.number} - duplicate comment is too recent, skipping`
      );
      continue;
    }
    console.log(
      `[DEBUG] Issue #${
        issue.number
      } - duplicate comment is old enough (${Math.floor(
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

    console.log(
      `[DEBUG] Issue #${issue.number} - checking reactions on duplicate comment...`
    );
    const reactions: GitHubReaction[] = await githubRequest(
      `/repos/${owner}/${repo}/issues/comments/${lastDupeComment.id}/reactions`,
      token
    );
    console.log(
      `[DEBUG] Issue #${issue.number} - duplicate comment has ${reactions.length} reactions`
    );

    const authorThumbsDown = reactions.some(
      (reaction) =>
        reaction.user.id === issue.user.id && reaction.content === "-1"
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
    const existingLabels = issue.labels?.map(l => l.name) || [];

    try {
      console.log(
        `[INFO] Auto-closing issue #${issue.number} as duplicate of #${duplicateIssueNumber}: ${issueUrl}`
      );
      await closeIssueAsDuplicate(owner, repo, issue.number, duplicateIssueNumber, existingLabels, token);
      console.log(
        `[SUCCESS] Successfully closed issue #${issue.number} as duplicate of #${duplicateIssueNumber}`
      );
    } catch (error) {
      console.error(
        `[ERROR] Failed to close issue #${issue.number} as duplicate: ${error}`
      );
    }
  }

  console.log(
    `[DEBUG] Script completed. Processed ${processedCount} issues, found ${candidateCount} candidates for auto-close`
  );
}

autoCloseDuplicates().catch(console.error);

// Make it a module
export {};
