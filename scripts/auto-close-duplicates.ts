#!/usr/bin/env bun

declare global {
  var process: {
    env: Record<string, string | undefined>;
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

function withPaginationParams(endpoint: string, perPage: number, page: number): string {
  const joiner = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${joiner}per_page=${perPage}&page=${page}`;
}

async function* githubPaginate<T>(
  endpoint: string,
  token: string,
  perPage: number = 100,
  maxPages: number = 50
): AsyncGenerator<T[], void, void> {
  for (let page = 1; page <= maxPages; page++) {
    const pageItems: T[] = await githubRequest(withPaginationParams(endpoint, perPage, page), token);
    if (pageItems.length === 0) return;
    yield pageItems;
    if (pageItems.length < perPage) return;
  }
}

function isDuplicateDetectionComment(comment: GitHubComment): boolean {
  return (
    comment.user.type === "Bot" &&
    comment.body.includes("Found") &&
    comment.body.includes("possible duplicate")
  );
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

async function getIssueCommentStats(
  owner: string,
  repo: string,
  issueNumber: number,
  token: string
): Promise<{
  commentCount: number;
  dupeCommentCount: number;
  lastCommentDate: Date | null;
  lastDupeComment: GitHubComment | null;
  lastDupeCommentDate: Date | null;
}> {
  let commentCount = 0;
  let dupeCommentCount = 0;
  let lastCommentDate: Date | null = null;
  let lastDupeComment: GitHubComment | null = null;
  let lastDupeCommentDate: Date | null = null;

  const endpoint = `/repos/${owner}/${repo}/issues/${issueNumber}/comments`;
  for await (const pageComments of githubPaginate<GitHubComment>(endpoint, token)) {
    for (const comment of pageComments) {
      commentCount++;

      const createdAt = new Date(comment.created_at);
      if (!lastCommentDate || createdAt > lastCommentDate) lastCommentDate = createdAt;

      if (isDuplicateDetectionComment(comment)) {
        dupeCommentCount++;
        if (!lastDupeCommentDate || createdAt > lastDupeCommentDate) {
          lastDupeCommentDate = createdAt;
          lastDupeComment = comment;
        }
      }
    }
  }

  return { commentCount, dupeCommentCount, lastCommentDate, lastDupeComment, lastDupeCommentDate };
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
	    const {
	      commentCount,
	      dupeCommentCount,
	      lastCommentDate,
	      lastDupeComment,
	      lastDupeCommentDate
	    } = await getIssueCommentStats(owner, repo, issue.number, token);
	    console.log(
	      `[DEBUG] Issue #${issue.number} has ${commentCount} comments`
	    );

	    console.log(
	      `[DEBUG] Issue #${issue.number} has ${dupeCommentCount} duplicate detection comments`
	    );

	    if (dupeCommentCount === 0 || !lastDupeComment || !lastDupeCommentDate) {
	      console.log(
	        `[DEBUG] Issue #${issue.number} - no duplicate comments found, skipping`
	      );
	      continue;
	    }

	    const dupeCommentDate = lastDupeCommentDate;
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

	    const hasCommentsAfterDupe =
	      !!lastCommentDate && lastCommentDate > dupeCommentDate;
	    console.log(
	      `[DEBUG] Issue #${issue.number} - ${hasCommentsAfterDupe ? "has" : "no"} comments after duplicate detection`
	    );

	    if (hasCommentsAfterDupe) {
	      console.log(
	        `[DEBUG] Issue #${issue.number} - has activity after duplicate comment, skipping`
	      );
      continue;
    }

	    console.log(
	      `[DEBUG] Issue #${issue.number} - checking reactions on duplicate comment...`
	    );
	    const reactions: GitHubReaction[] = [];
	    for await (const pageReactions of githubPaginate<GitHubReaction>(
	      `/repos/${owner}/${repo}/issues/comments/${lastDupeComment.id}/reactions`,
	      token
	    )) {
	      reactions.push(...pageReactions);
	    }
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
    
    try {
      console.log(
        `[INFO] Auto-closing issue #${issue.number} as duplicate of #${duplicateIssueNumber}: ${issueUrl}`
      );
      await closeIssueAsDuplicate(owner, repo, issue.number, duplicateIssueNumber, token);
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
