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

async function githubRequest<T>(
  endpoint: string,
  token: string,
  method: string = "GET",
  body?: any,
  userAgent: string = "claude-code-scripts",
): Promise<T> {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": userAgent,
      ...(body && { "Content-Type": "application/json" }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API request failed: ${response.status} ${response.statusText}`,
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

function extractDuplicateIssueNumber(commentBody: string): number | null {
  let match = commentBody.match(/(?<!\w)#(\d+)\b/);
  if (match) {
    return parseInt(match[1], 10);
  }

  match = commentBody.match(/github\.com\/[^\/]+\/[^\/]+\/issues\/(\d+)\b/);
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
  token: string,
): Promise<void> {
  await githubRequest(
    `/repos/${owner}/${repo}/issues/${issueNumber}`,
    token,
    "PATCH",
    {
      state: "closed",
      state_reason: "duplicate",
      labels: ["duplicate"],
    },
  );

  await githubRequest(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    token,
    "POST",
    {
      body: `This issue has been automatically closed as a duplicate of #${duplicateOfNumber}.\n\nIf this is incorrect, please re-open this issue or create a new one.\n\n🤖 Generated with [Claude Code](https://claude.ai/code)`,
      body: `This issue has been automatically closed as a duplicate of #${duplicateOfNumber}.

If this is incorrect, please re-open this issue or create a new one.

🤖 Generated with [Claude Code](https://claude.ai/code)`,
    },
  );
}

export async function autoCloseDuplicates(): Promise<void> {
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
  const threeDaysAgoISO = threeDaysAgo.toISOString();
  console.log(
    `[DEBUG] Checking for duplicate comments older than: ${threeDaysAgoISO}`,
  const threeDaysAgoIso = threeDaysAgo.toISOString();
  console.log(
    `[DEBUG] Checking for duplicate comments older than: ${threeDaysAgo.toISOString()}`,
    `[DEBUG] Checking for duplicate comments older than: ${threeDaysAgoIso}`,
  );

  console.log("[DEBUG] Fetching open issues created more than 3 days ago...");
  const allIssues: GitHubIssue[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const pageIssues: GitHubIssue[] = await githubRequest(
      `/repos/${owner}/${repo}/issues?state=open&per_page=${perPage}&page=${page}`,
      token,
    );

    if (pageIssues.length === 0) break;

    // Filter for issues created more than 3 days ago
    const oldEnoughIssues = pageIssues.filter(
      (issue) => issue.created_at <= threeDaysAgoISO,
      (issue) => new Date(issue.created_at) <= threeDaysAgo,
    // Filter for issues created more than 3 days ago using string comparison
    // Filter for issues created more than 3 days ago
    const oldEnoughIssues = pageIssues.filter(
      (issue) => issue.created_at <= threeDaysAgoIso,
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

  const CONCURRENCY_LIMIT = 10;
  let issueIndex = 0;

  const processIssues = async () => {
    while (issueIndex < issues.length) {
      const issue = issues[issueIndex++];
      processedCount++;
      console.log(
        `[DEBUG] Processing issue #${issue.number} (${processedCount}/${issues.length}): ${issue.title}`,
      );

      console.log(`[DEBUG] Fetching comments for issue #${issue.number}...`);
      const comments: GitHubComment[] = await githubRequest(
        `/repos/${owner}/${repo}/issues/${issue.number}/comments`,
        token,
      );
      console.log(
        `[DEBUG] Issue #${issue.number} has ${comments.length} comments`,
      );

      const dupeComments = comments.filter(
        (comment) =>
          comment.body.includes("Found") &&
          comment.body.includes("possible duplicate") &&
          comment.user.type === "Bot",
      );
      console.log(
        `[DEBUG] Issue #${issue.number} has ${dupeComments.length} duplicate detection comments`,
  const concurrencyLimit = 10;
  let index = 0;

  const worker = async () => {
    while (index < issues.length) {
      const issue = issues[index++];
      processedCount++;
      const currentProcessedCount = processedCount;
      console.log(
        `[DEBUG] Processing issue #${issue.number} (${currentProcessedCount}/${issues.length}): ${issue.title}`,
      );

      try {
        console.log(`[DEBUG] Fetching comments for issue #${issue.number}...`);
        const comments: GitHubComment[] = await githubRequest(
          `/repos/${owner}/${repo}/issues/${issue.number}/comments`,
          token,
        );
        console.log(
          `[DEBUG] Issue #${issue.number} has ${comments.length} comments`,
        );

        let lastDupeComment: GitHubComment | null = null;
        let hasActivityAfterDupe = false;

        for (let i = comments.length - 1; i >= 0; i--) {
          const comment = comments[i];
          if (
            comment.body.includes("Found") &&
            comment.body.includes("possible duplicate") &&
            comment.user.type === "Bot"
          ) {
            lastDupeComment = comment;
            break;
          } else {
            hasActivityAfterDupe = true;
          }
        }

        if (!lastDupeComment) {
          console.log(
            `[DEBUG] Issue #${issue.number} - no duplicate comments found, skipping`,
          );
          continue;
        }

        const dupeCommentDateIso = lastDupeComment.created_at;
        console.log(
          `[DEBUG] Issue #${issue.number} - most recent duplicate comment from: ${dupeCommentDateIso}`,
        );

        if (dupeCommentDateIso > threeDaysAgoIso) {
          console.log(
            `[DEBUG] Issue #${issue.number} - duplicate comment is too recent, skipping`,
          );
          continue;
        }
        console.log(
          `[DEBUG] Issue #${issue.number} - duplicate comment is old enough`,
        );

        if (hasActivityAfterDupe) {
          console.log(
            `[DEBUG] Issue #${issue.number} - has activity after duplicate comment, skipping`,
          );
          continue;
        }

        console.log(
          `[DEBUG] Issue #${issue.number} - checking reactions on duplicate comment...`,
        );
        const reactions: GitHubReaction[] = await githubRequest(
          `/repos/${owner}/${repo}/issues/comments/${lastDupeComment.id}/reactions`,
          token,
        );
        console.log(
          `[DEBUG] Issue #${issue.number} - duplicate comment has ${reactions.length} reactions`,
        );

        const authorThumbsDown = reactions.some(
          (reaction) =>
            reaction.user.id === issue.user.id && reaction.content === "-1",
        );
        console.log(
          `[DEBUG] Issue #${issue.number} - author thumbs down reaction: ${authorThumbsDown}`,
        );

        if (authorThumbsDown) {
          console.log(
            `[DEBUG] Issue #${issue.number} - author disagreed with duplicate detection, skipping`,
          );
          continue;
        }

        const duplicateIssueNumber = extractDuplicateIssueNumber(
          lastDupeComment.body,
        );
        if (!duplicateIssueNumber) {
          console.log(
            `[DEBUG] Issue #${issue.number} - could not extract duplicate issue number from comment, skipping`,
          );
          continue;
        }

        candidateCount++;
        const issueUrl = `https://github.com/${owner}/${repo}/issues/${issue.number}`;

        try {
          console.log(
            `[INFO] Auto-closing issue #${issue.number} as duplicate of #${duplicateIssueNumber}: ${issueUrl}`,
          );
          await closeIssueAsDuplicate(
            owner,
            repo,
            issue.number,
            duplicateIssueNumber,
            token,
          );
          console.log(
            `[SUCCESS] Successfully closed issue #${issue.number} as duplicate of #${duplicateIssueNumber}`,
          );
        } catch (error) {
          console.error(
            `[ERROR] Failed to close issue #${issue.number} as duplicate: ${error}`,
          );
        }
      } catch (error) {
        console.error(
          `[ERROR] Failed processing issue #${issue.number}: ${error}`,
        );
      }
  for (const issue of issues) {
    processedCount++;
    console.log(
      `[DEBUG] Processing issue #${issue.number} (${processedCount}/${issues.length}): ${issue.title}`,
    );

    console.log(`[DEBUG] Fetching comments for issue #${issue.number}...`);
    const comments: GitHubComment[] = await githubRequest(
      `/repos/${owner}/${repo}/issues/${issue.number}/comments`,
      token,
    );
    console.log(
      `[DEBUG] Issue #${issue.number} has ${comments.length} comments`,
    );

    let lastDupeComment = null;
    let commentsAfterDupeCount = 0;
    let totalDupeComments = 0;
    let lastDupeComment: GitHubComment | null = null;
    let commentsAfterDupeCount = 0;
    let dupeCommentsCount = 0;

    for (let i = comments.length - 1; i >= 0; i--) {
      const comment = comments[i];
      const isDupeComment =
        comment.body.includes("Found") &&
        comment.body.includes("possible duplicate") &&
        comment.user.type === "Bot",
    );
    console.log(
      `[DEBUG] Issue #${issue.number} has ${dupeComments.length} duplicate detection comments`,
        comment.user.type === "Bot";

      if (isDupeComment) {
        totalDupeComments++;
        dupeCommentsCount++;
        if (!lastDupeComment) {
          lastDupeComment = comment;
        }
      } else if (!lastDupeComment) {
        commentsAfterDupeCount++;
      }
    }

    console.log(
      `[DEBUG] Issue #${issue.number} has ${totalDupeComments} duplicate detection comments`,
      `[DEBUG] Issue #${issue.number} has ${dupeCommentsCount} duplicate detection comments`,
    );

    if (!lastDupeComment) {
      console.log(
        `[DEBUG] Issue #${issue.number} - no duplicate comments found, skipping`,
      );

      if (dupeComments.length === 0) {
        console.log(
          `[DEBUG] Issue #${issue.number} - no duplicate comments found, skipping`,
        );
        continue;
      }

      const lastDupeComment = dupeComments[dupeComments.length - 1];
      const dupeCommentDate = new Date(lastDupeComment.created_at);
      console.log(
        `[DEBUG] Issue #${
          issue.number
        } - most recent duplicate comment from: ${dupeCommentDate.toISOString()}`,
      );

      if (dupeCommentDate > threeDaysAgo) {
        console.log(
          `[DEBUG] Issue #${issue.number} - duplicate comment is too recent, skipping`,
        );
        continue;
      }
      console.log(
        `[DEBUG] Issue #${
          issue.number
        } - duplicate comment is old enough (${Math.floor(
          (Date.now() - dupeCommentDate.getTime()) / (1000 * 60 * 60 * 24),
        )} days)`,
    const dupeCommentDateISO = lastDupeComment.created_at;
    console.log(
      `[DEBUG] Issue #${issue.number} - most recent duplicate comment from: ${dupeCommentDateISO}`,
    );

    if (dupeCommentDateISO > threeDaysAgoISO) {
    console.log(
      `[DEBUG] Issue #${issue.number} - most recent duplicate comment from: ${dupeCommentDate.toISOString()}`,
      `[DEBUG] Issue #${
        issue.number
      } - most recent duplicate comment from: ${lastDupeComment.created_at}`,
    );

    if (lastDupeComment.created_at > threeDaysAgoIso) {
      console.log(
        `[DEBUG] Issue #${issue.number} - duplicate comment is too recent, skipping`,
      );
      continue;
    }

    const dupeCommentDate = new Date(dupeCommentDateISO);
    console.log(
      `[DEBUG] Issue #${issue.number} - duplicate comment is old enough (${Math.floor((Date.now() - dupeCommentDate.getTime()) / (1000 * 60 * 60 * 24))} days)`,
    );

    const commentsAfterDupe = comments.filter(
      (comment) => new Date(comment.created_at) > dupeCommentDate,
    );
    console.log(
      `[DEBUG] Issue #${issue.number} - ${commentsAfterDupe.length} comments after duplicate detection`,
      `[DEBUG] Issue #${
        issue.number
      } - duplicate comment is old enough (${Math.floor(
        (Date.now() - dupeCommentDate.getTime()) / (1000 * 60 * 60 * 24),
        (Date.now() - new Date(lastDupeComment.created_at).getTime()) /
          (1000 * 60 * 60 * 24),
      )} days)`,
    );

    console.log(
      `[DEBUG] Issue #${issue.number} - ${commentsAfterDupeCount} comments after duplicate detection`,
    );

    if (commentsAfterDupeCount > 0) {
      console.log(
        `[DEBUG] Issue #${issue.number} - has activity after duplicate comment, skipping`,
      );

      const commentsAfterDupe = comments.filter(
        (comment) => new Date(comment.created_at) > dupeCommentDate,
      );
      console.log(
        `[DEBUG] Issue #${issue.number} - ${commentsAfterDupe.length} comments after duplicate detection`,
      );

      if (commentsAfterDupe.length > 0) {
        console.log(
          `[DEBUG] Issue #${issue.number} - has activity after duplicate comment, skipping`,
        );
        continue;
      }
    console.log(
      `[DEBUG] Issue #${issue.number} - checking reactions on duplicate comment...`,
    );
    const reactions: GitHubReaction[] = await githubRequest(
      `/repos/${owner}/${repo}/issues/comments/${lastDupeComment.id}/reactions`,
      token,
    );
    console.log(
      `[DEBUG] Issue #${issue.number} - duplicate comment has ${reactions.length} reactions`,
    );

    const authorThumbsDown = reactions.some(
      (reaction) =>
        reaction.user.id === issue.user.id && reaction.content === "-1",
    );
    console.log(
      `[DEBUG] Issue #${issue.number} - author thumbs down reaction: ${authorThumbsDown}`,
    );

      console.log(
        `[DEBUG] Issue #${issue.number} - checking reactions on duplicate comment...`,
      );
      const reactions: GitHubReaction[] = await githubRequest(
        `/repos/${owner}/${repo}/issues/comments/${lastDupeComment.id}/reactions`,
        token,
      );
      console.log(
        `[DEBUG] Issue #${issue.number} - duplicate comment has ${reactions.length} reactions`,
      );

      const authorThumbsDown = reactions.some(
        (reaction) =>
          reaction.user.id === issue.user.id && reaction.content === "-1",
      );
      console.log(
        `[DEBUG] Issue #${issue.number} - author thumbs down reaction: ${authorThumbsDown}`,
      );

      if (authorThumbsDown) {
        console.log(
          `[DEBUG] Issue #${issue.number} - author disagreed with duplicate detection, skipping`,
        );
        continue;
      }

      const duplicateIssueNumber = extractDuplicateIssueNumber(
        lastDupeComment.body,
        `[DEBUG] Issue #${issue.number} - author disagreed with duplicate detection, skipping`,
      );
      continue;
    }

    const duplicateIssueNumber = extractDuplicateIssueNumber(
      lastDupeComment.body,
    );
    if (!duplicateIssueNumber) {
      console.log(
        `[DEBUG] Issue #${issue.number} - could not extract duplicate issue number from comment, skipping`,
      );
      continue;
    }
  };

  const pool = [];
  for (let i = 0; i < concurrencyLimit; i++) {
    pool.push(worker());
    candidateCount++;
    const issueUrl = `https://github.com/${owner}/${repo}/issues/${issue.number}`;

    try {
      console.log(
        `[INFO] Auto-closing issue #${issue.number} as duplicate of #${duplicateIssueNumber}: ${issueUrl}`,
      );
      await closeIssueAsDuplicate(
        owner,
        repo,
        issue.number,
        duplicateIssueNumber,
        token,
      );
      console.log(
        `[SUCCESS] Successfully closed issue #${issue.number} as duplicate of #${duplicateIssueNumber}`,
      );
    } catch (error) {
      console.error(
        `[ERROR] Failed to close issue #${issue.number} as duplicate: ${error}`,
      );
      if (!duplicateIssueNumber) {
        console.log(
          `[DEBUG] Issue #${issue.number} - could not extract duplicate issue number from comment, skipping`,
        );
        continue;
      }

      candidateCount++;
      const issueUrl = `https://github.com/${owner}/${repo}/issues/${issue.number}`;

      try {
        console.log(
          `[INFO] Auto-closing issue #${issue.number} as duplicate of #${duplicateIssueNumber}: ${issueUrl}`,
        );
        await closeIssueAsDuplicate(
          owner,
          repo,
          issue.number,
          duplicateIssueNumber,
          token,
        );
        console.log(
          `[SUCCESS] Successfully closed issue #${issue.number} as duplicate of #${duplicateIssueNumber}`,
        );
      } catch (error) {
        console.error(
          `[ERROR] Failed to close issue #${issue.number} as duplicate: ${error}`,
        );
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(CONCURRENCY_LIMIT, issues.length) },
    () => processIssues(),
  );
  await Promise.all(workers);
  }
  await Promise.all(pool);

  console.log(
    `[DEBUG] Script completed. Processed ${processedCount} issues, found ${candidateCount} candidates for auto-close`,
  );
}

if (import.meta.main) {
  autoCloseDuplicates().catch(console.error);
}
