#!/usr/bin/env bun

import {
  githubGraphql,
  githubPaginate,
  githubRequest,
} from "./github-api.ts";

interface RepositoryIssue {
  number: number;
  title: string;
  createdAt: string;
  comments: {
    totalCount: number;
    nodes: GitHubComment[];
  };
}

interface GitHubComment {
  body: string;
  user: { type?: string; login: string; __typename?: string } | null;
}

interface IssuePage {
  repository: {
    issues: {
      nodes: RepositoryIssue[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  } | null;
}

const ISSUES_QUERY = `
  query BackfillIssues($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      issues(
        first: 100
        after: $cursor
        states: OPEN
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        nodes {
          number
          title
          createdAt
          comments(last: 1) {
            totalCount
            nodes {
              body
              user: author { login __typename }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

function parseInteger(name: string, fallback: number, allowZero = false): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a positive integer`);
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new Error(
      `${name} must be a ${allowZero ? "non-negative" : "positive"} safe integer`
    );
  }
  return value;
}

function repositoryFromEnvironment(): { owner: string; repo: string } {
  const combined = process.env.GITHUB_REPOSITORY;
  if (combined) {
    const match = combined.match(/^([^/]+)\/([^/]+)$/);
    if (!match) throw new Error("GITHUB_REPOSITORY must use owner/repo format");
    return { owner: match[1], repo: match[2] };
  }

  const owner = process.env.GITHUB_REPOSITORY_OWNER;
  const repo = process.env.GITHUB_REPOSITORY_NAME;
  if (!owner || !repo) {
    throw new Error(
      "GITHUB_REPOSITORY or GITHUB_REPOSITORY_OWNER/GITHUB_REPOSITORY_NAME is required"
    );
  }
  return { owner, repo };
}

function hasTrustedDedupeComment(comments: GitHubComment[]): boolean {
  const expectedLogin = process.env.DEDUPE_BOT_LOGIN || "github-actions[bot]";
  return comments.some(
    (comment) =>
      (comment.user?.type === "Bot" || comment.user?.__typename === "Bot") &&
      comment.user.login === expectedLogin &&
      /^Found \d+ possible duplicate issues?:/m.test(comment.body) &&
      comment.body.includes(
        "This issue will be automatically closed as a duplicate in 3 days."
      )
  );
}

async function fetchIssues(
  owner: string,
  repo: string,
  token: string,
  cutoff: Date
): Promise<RepositoryIssue[]> {
  const issues: RepositoryIssue[] = [];
  const cursors = new Set<string>();
  let cursor: string | null = null;
  let reachedCutoff = false;

  do {
    const data = await githubGraphql<IssuePage>(
      ISSUES_QUERY,
      { owner, repo, cursor },
      token
    );
    if (!data.repository) throw new Error(`Repository ${owner}/${repo} not found`);
    const connection = data.repository.issues;

    for (const issue of connection.nodes) {
      if (new Date(issue.createdAt) < cutoff) {
        reachedCutoff = true;
        break;
      }
      issues.push(issue);
    }

    if (reachedCutoff || !connection.pageInfo.hasNextPage) break;
    if (!connection.pageInfo.endCursor) {
      throw new Error("GitHub returned hasNextPage without an endCursor");
    }
    if (cursors.has(connection.pageInfo.endCursor)) {
      throw new Error("GitHub returned a repeated issue cursor");
    }
    cursors.add(connection.pageInfo.endCursor);
    cursor = connection.pageInfo.endCursor;
  } while (cursor);

  return issues;
}

async function resolveDefaultBranch(
  owner: string,
  repo: string,
  token: string
): Promise<string> {
  if (process.env.GITHUB_DEFAULT_BRANCH) return process.env.GITHUB_DEFAULT_BRANCH;
  const repository = await githubRequest<{ default_branch: string }>(
    `/repos/${owner}/${repo}`,
    token
  );
  if (!repository.default_branch) {
    throw new Error(`Could not resolve the default branch for ${owner}/${repo}`);
  }
  return repository.default_branch;
}

async function triggerDedupeWorkflow(
  owner: string,
  repo: string,
  issueNumber: number,
  defaultBranch: string,
  token: string,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    console.log(`[DRY RUN] Would trigger dedupe for issue #${issueNumber}`);
    return;
  }

  // A successful workflow dispatch is HTTP 204 with no response body.
  await githubRequest<void>(
    `/repos/${owner}/${repo}/actions/workflows/claude-dedupe-issues.yml/dispatches`,
    token,
    "POST",
    {
      ref: defaultBranch,
      inputs: { issue_number: issueNumber.toString() },
    }
  );
}

export async function backfillDuplicateComments(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN environment variable is required");

  const { owner, repo } = repositoryFromEnvironment();
  const dryRun = process.env.DRY_RUN !== "false";
  const daysBack = parseInteger("DAYS_BACK", 90);
  const minIssueNumber = parseInteger("MIN_ISSUE_NUMBER", 1);
  // An omitted upper bound must include future issues as the repository grows.
  const maxIssueNumber = parseInteger(
    "MAX_ISSUE_NUMBER",
    Number.MAX_SAFE_INTEGER
  );
  if (minIssueNumber > maxIssueNumber) {
    throw new Error("MIN_ISSUE_NUMBER must not exceed MAX_ISSUE_NUMBER");
  }

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - daysBack);
  const defaultBranch = await resolveDefaultBranch(owner, repo, token);
  const issues = (await fetchIssues(owner, repo, token, cutoff)).filter(
    (issue) =>
      issue.number >= minIssueNumber && issue.number <= maxIssueNumber
  );

  console.log(
    `[DEBUG] Found ${issues.length} issues in ${owner}/${repo} since ${cutoff.toISOString()}`
  );

  let candidateCount = 0;
  let triggeredCount = 0;
  const failures: string[] = [];
  const delayMs = parseInteger("DISPATCH_DELAY_MS", 0, true);

  for (const issue of issues) {
    try {
      if (hasTrustedDedupeComment(issue.comments.nodes)) continue;
      if (issue.comments.totalCount > 0) {
        const comments = await githubPaginate<GitHubComment>(
          `/repos/${owner}/${repo}/issues/${issue.number}/comments`,
          token
        );
        if (hasTrustedDedupeComment(comments)) continue;
      }

      candidateCount += 1;
      await triggerDedupeWorkflow(
        owner,
        repo,
        issue.number,
        defaultBranch,
        token,
        dryRun
      );
      triggeredCount += 1;
      if (!dryRun && delayMs > 0) {
        await Bun.sleep(delayMs);
      }
    } catch (error) {
      const message = `issue #${issue.number}: ${String(error)}`;
      failures.push(message);
      console.error(`[ERROR] ${message}`);
    }
  }

  console.log(
    `[DEBUG] Processed ${issues.length}; candidates ${candidateCount}; ${
      dryRun ? "would dispatch" : "dispatched"
    } ${triggeredCount}`
  );
  if (failures.length > 0) {
    throw new Error(`Failed to process ${failures.length} issue(s)`);
  }
}

if (import.meta.main) {
  backfillDuplicateComments().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
