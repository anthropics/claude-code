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
  author: { login: string } | null;
  comments: {
    nodes: Array<{
      body: string;
      createdAt: string;
      author: { login: string; __typename: string } | null;
    }>;
  };
}

interface GitHubComment {
  id: number;
  body: string;
  created_at: string;
  user: { type: string; login: string } | null;
}

interface GitHubReaction {
  user: { login: string } | null;
  content: string;
}

interface RestIssue {
  title?: string;
  body?: string | null;
  state?: string;
  state_reason?: string | null;
  locked?: boolean;
  updated_at?: string;
  labels?: Array<string | { name?: string }>;
  assignees?: Array<string | { login?: string }>;
  milestone?:
    | { number?: number; title?: string; state?: string }
    | null;
}

interface GitHubIssueEvent {
  event?: string;
  created_at?: string;
  actor?: { type?: string; login?: string } | null;
  label?: { name?: string };
}

interface IssuePage {
  repository: {
    issues: {
      nodes: RepositoryIssue[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  } | null;
}

const OPEN_ISSUES_QUERY = `
  query OpenIssues($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      issues(
        first: 100
        after: $cursor
        states: OPEN
        orderBy: { field: CREATED_AT, direction: ASC }
      ) {
        nodes {
          number
          title
          createdAt
          author { login }
          comments(last: 1) {
            nodes {
              body
              createdAt
              author { login __typename }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const AUTO_CLOSE_MARKER = (duplicateOf: number) =>
  `<!-- auto-close-duplicate:${duplicateOf} -->`;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractDuplicateIssueNumber(
  commentBody: string,
  owner: string,
  repo: string
): number | null {
  const repository = `${escapeRegex(owner)}/${escapeRegex(repo)}`;
  const match = commentBody.match(
    new RegExp(`https://github\\.com/${repository}/issues/(\\d+)(?:\\b|/)`)
  );
  return match ? Number.parseInt(match[1], 10) : null;
}

function isTrustedDedupeComment(comment: GitHubComment): boolean {
  const expectedLogin = process.env.DEDUPE_BOT_LOGIN || "github-actions[bot]";
  return (
    comment.user?.type === "Bot" &&
    comment.user.login === expectedLogin &&
    /^Found \d+ possible duplicate issues?:/m.test(comment.body) &&
    comment.body.includes(
      "This issue will be automatically closed as a duplicate in 3 days."
    )
  );
}

function hasTrustedAutoCloseMarker(
  comment: GitHubComment,
  marker: string
): boolean {
  const expectedLogin = process.env.DEDUPE_BOT_LOGIN || "github-actions[bot]";
  return (
    comment.user?.type === "Bot" &&
    comment.user.login === expectedLogin &&
    comment.body.includes(marker)
  );
}

function isSameCommentSnapshot(
  previous: GitHubComment[],
  current: GitHubComment[]
): boolean {
  if (previous.length !== current.length) return false;

  const currentById = new Map(current.map((comment) => [comment.id, comment]));
  return previous.every((comment) => {
    const refreshed = currentById.get(comment.id);
    return (
      refreshed?.body === comment.body &&
      refreshed.created_at === comment.created_at &&
      refreshed.user?.type === comment.user?.type &&
      refreshed.user?.login === comment.user?.login
    );
  });
}

function isSameCommentSnapshotIgnoringMarker(
  previous: GitHubComment[],
  current: GitHubComment[],
  marker: string
): boolean {
  const withoutOwnMarker = (comments: GitHubComment[]) =>
    comments.filter(
      (comment) => !hasTrustedAutoCloseMarker(comment, marker)
    );
  return isSameCommentSnapshot(
    withoutOwnMarker(previous),
    withoutOwnMarker(current)
  );
}

function trustedNewMarkerAt(
  previous: GitHubComment[],
  current: GitHubComment[],
  marker: string
): number | null {
  if (previous.some((comment) => hasTrustedAutoCloseMarker(comment, marker))) {
    return null;
  }
  const trustedMarkers = current.filter((comment) =>
    hasTrustedAutoCloseMarker(comment, marker)
  );
  if (trustedMarkers.length !== 1) return null;

  const markerAt = Date.parse(trustedMarkers[0].created_at);
  const latestAt = latestCommentTimestamp(current);
  return Number.isFinite(markerAt) && markerAt === latestAt ? markerAt : null;
}

function hasAuthorDisagreement(
  reactions: GitHubReaction[],
  authorLogin: string | undefined
): boolean {
  return (
    typeof authorLogin === "string" &&
    reactions.some(
      (reaction) =>
        reaction.user?.login === authorLogin && reaction.content === "-1"
    )
  );
}

function latestCommentTimestamp(comments: GitHubComment[]): number | null {
  let latest = Number.NEGATIVE_INFINITY;
  for (const comment of comments) {
    const timestamp = Date.parse(comment.created_at);
    if (!Number.isFinite(timestamp)) return null;
    latest = Math.max(latest, timestamp);
  }
  return Number.isFinite(latest) ? latest : null;
}

function hasRestLabel(issue: RestIssue, expected: string): boolean {
  return (
    issue.labels?.some((label) =>
      typeof label === "string" ? label === expected : label.name === expected
    ) ?? false
  );
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right)
    );
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function restLabelNames(issue: RestIssue): string[] | null {
  if (!Array.isArray(issue.labels)) return null;
  return issue.labels
    .map((label) => (typeof label === "string" ? label : label.name))
    .filter((name): name is string => typeof name === "string")
    .sort();
}

function issueMetadataSnapshot(
  issue: RestIssue,
  ignoreDuplicateLabel: boolean
): string {
  const labelNames = restLabelNames(issue);
  const assigneeLogins = Array.isArray(issue.assignees)
    ? issue.assignees
        .map((assignee) =>
          typeof assignee === "string" ? assignee : assignee.login
        )
        .filter((login): login is string => typeof login === "string")
        .sort()
    : null;
  const milestone = issue.milestone
    ? {
        number: issue.milestone.number ?? null,
        title: issue.milestone.title ?? null,
        state: issue.milestone.state ?? null,
      }
    : null;
  return stableJson({
    title: issue.title ?? null,
    body: issue.body ?? null,
    stateReason: issue.state_reason ?? null,
    assignees: assigneeLogins,
    milestone,
    labels:
      labelNames === null
        ? null
        : labelNames.filter(
            (name) => !ignoreDuplicateLabel || name !== "duplicate"
          ),
  });
}

function hasExpectedIssueMetadata(
  previous: RestIssue,
  current: RestIssue,
  mutation: "marker" | "label" | "none"
): boolean {
  if (
    issueMetadataSnapshot(previous, mutation === "label") !==
    issueMetadataSnapshot(current, mutation === "label")
  ) {
    return false;
  }

  if (mutation !== "label") return true;
  const previousLabels = restLabelNames(previous);
  const currentLabels = restLabelNames(current);
  if (previousLabels === null && currentLabels === null) return true;
  if (previousLabels === null) {
    return currentLabels?.every((name) => name === "duplicate") ?? false;
  }
  if (currentLabels === null || previousLabels.includes("duplicate")) {
    return false;
  }
  return currentLabels.filter((name) => name === "duplicate").length === 1;
}

function hasOnlyExpectedDuplicateLabelEvent(
  previous: GitHubIssueEvent[],
  current: GitHubIssueEvent[]
): boolean {
  if (stableJson(previous) === stableJson(current)) return true;

  const remaining = new Map<string, number>();
  for (const event of previous) {
    const fingerprint = stableJson(event);
    remaining.set(fingerprint, (remaining.get(fingerprint) ?? 0) + 1);
  }
  const additions: GitHubIssueEvent[] = [];
  for (const event of current) {
    const fingerprint = stableJson(event);
    const count = remaining.get(fingerprint) ?? 0;
    if (count > 0) {
      remaining.set(fingerprint, count - 1);
    } else {
      additions.push(event);
    }
  }
  if ([...remaining.values()].some((count) => count !== 0)) return false;

  const expectedLogin = process.env.DEDUPE_BOT_LOGIN || "github-actions[bot]";
  return (
    additions.length === 1 &&
    additions[0].event === "labeled" &&
    additions[0].label?.name === "duplicate" &&
    additions[0].actor?.type === "Bot" &&
    additions[0].actor.login === expectedLogin
  );
}

function isTrustedDuplicateLabelRecovery(
  events: GitHubIssueEvent[],
  markerAt: number,
  issueUpdatedAt: number
): boolean {
  const expectedLogin = process.env.DEDUPE_BOT_LOGIN || "github-actions[bot]";
  let latestRelevantEvent = Number.NEGATIVE_INFINITY;
  let relevantEventCount = 0;

  for (const event of events) {
    const eventAt = Date.parse(event.created_at ?? "");
    if (!Number.isFinite(eventAt)) return false;
    if (eventAt <= markerAt) continue;

    relevantEventCount += 1;
    latestRelevantEvent = Math.max(latestRelevantEvent, eventAt);
    if (
      eventAt > issueUpdatedAt ||
      event.event !== "labeled" ||
      event.label?.name !== "duplicate" ||
      event.actor?.type !== "Bot" ||
      event.actor.login !== expectedLogin
    ) {
      return false;
    }
  }

  return relevantEventCount > 0 && latestRelevantEvent === issueUpdatedAt;
}

function preliminaryDuplicateTarget(
  issue: RepositoryIssue,
  owner: string,
  repo: string,
  cutoff: Date
): number | null {
  const latest = issue.comments.nodes.at(-1);
  if (!latest) return null;

  const expectedLogin = process.env.DEDUPE_BOT_LOGIN || "github-actions[bot]";
  const retryMarker = latest.body.match(/<!-- auto-close-duplicate:(\d+) -->/);
  if (
    retryMarker &&
    latest.author?.__typename === "Bot" &&
    latest.author.login === expectedLogin
  ) {
    return Number.parseInt(retryMarker[1], 10);
  }

  if (
    latest.author?.__typename !== "Bot" ||
    latest.author.login !== expectedLogin ||
    new Date(latest.createdAt) > cutoff ||
    !/^Found \d+ possible duplicate issues?:/m.test(latest.body) ||
    !latest.body.includes(
      "This issue will be automatically closed as a duplicate in 3 days."
    )
  ) {
    return null;
  }

  return extractDuplicateIssueNumber(latest.body, owner, repo);
}

async function fetchOpenIssues(
  owner: string,
  repo: string,
  token: string
): Promise<RepositoryIssue[]> {
  const issues: RepositoryIssue[] = [];
  const cursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const data: IssuePage = await githubGraphql<IssuePage>(
      OPEN_ISSUES_QUERY,
      { owner, repo, cursor },
      token
    );
    if (!data.repository) throw new Error(`Repository ${owner}/${repo} not found`);
    const connection = data.repository.issues;
    issues.push(...connection.nodes);
    if (connection.pageInfo.hasNextPage && !connection.pageInfo.endCursor) {
      throw new Error("GitHub returned hasNextPage without an endCursor");
    }
    if (
      connection.pageInfo.endCursor &&
      cursors.has(connection.pageInfo.endCursor)
    ) {
      throw new Error("GitHub returned a repeated issue cursor");
    }
    if (connection.pageInfo.endCursor) cursors.add(connection.pageInfo.endCursor);
    cursor = connection.pageInfo.hasNextPage
      ? connection.pageInfo.endCursor
      : null;
  } while (cursor);

  return issues;
}

async function closeIssueAsDuplicate(
  owner: string,
  repo: string,
  issueNumber: number,
  duplicateOfNumber: number,
  comments: GitHubComment[],
  reactions: GitHubReaction[],
  issueSnapshot: RestIssue,
  events: GitHubIssueEvent[],
  dedupeCommentId: number,
  authorLogin: string | undefined,
  hasDuplicateLabel: boolean,
  token: string
): Promise<boolean> {
  const base = `/repos/${owner}/${repo}/issues/${issueNumber}`;
  const marker = AUTO_CLOSE_MARKER(duplicateOfNumber);
  const reactionsEndpoint = `/repos/${owner}/${repo}/issues/comments/${dedupeCommentId}/reactions`;
  let validatedComments = comments;
  let validatedReactions = reactions;
  let validatedIssue = issueSnapshot;
  let validatedEvents = events;

  const revalidateAfterOwnMutation = async (
    expectedDuplicateLabel: boolean,
    mutation: "marker" | "label" | "none"
  ): Promise<boolean> => {
    const [currentComments, currentReactions, currentIssue, currentEvents] =
      await Promise.all([
        githubPaginate<GitHubComment>(`${base}/comments`, token),
        githubPaginate<GitHubReaction>(reactionsEndpoint, token),
        githubRequest<RestIssue>(base, token),
        githubPaginate<GitHubIssueEvent>(`${base}/events`, token),
      ]);
    const duplicateLabelChanged =
      Array.isArray(currentIssue.labels) &&
      hasRestLabel(currentIssue, "duplicate") !== expectedDuplicateLabel;
    const updatedAt = Date.parse(currentIssue.updated_at ?? "");
    const ownMarkerAt =
      mutation === "marker"
        ? trustedNewMarkerAt(validatedComments, currentComments, marker)
        : null;
    const eventSnapshotIsExpected =
      mutation === "label"
        ? hasOnlyExpectedDuplicateLabelEvent(validatedEvents, currentEvents)
        : stableJson(validatedEvents) === stableJson(currentEvents);
    if (
      currentIssue.state !== "open" ||
      currentIssue.locked !== false ||
      !Number.isFinite(updatedAt) ||
      (mutation === "marker" &&
        (ownMarkerAt === null || updatedAt !== ownMarkerAt)) ||
      duplicateLabelChanged ||
      !hasExpectedIssueMetadata(validatedIssue, currentIssue, mutation) ||
      (mutation === "none" &&
        currentIssue.updated_at !== validatedIssue.updated_at) ||
      !eventSnapshotIsExpected ||
      !isSameCommentSnapshotIgnoringMarker(
        validatedComments,
        currentComments,
        marker
      ) ||
      stableJson(validatedReactions) !== stableJson(currentReactions) ||
      hasAuthorDisagreement(currentReactions, authorLogin)
    ) {
      return false;
    }
    validatedComments = currentComments;
    validatedReactions = currentReactions;
    validatedIssue = currentIssue;
    validatedEvents = currentEvents;
    return true;
  };

  let revalidatedImmediatelyBeforeClose = false;

  // Persist the retry marker before any other mutation. If creating it fails,
  // the issue remains unchanged and a later run can safely retry from the
  // original dedupe report.
  if (!comments.some((comment) => hasTrustedAutoCloseMarker(comment, marker))) {
    await githubRequest(`${base}/comments`, token, "POST", {
      body: `${marker}
This issue is being automatically closed as a duplicate of #${duplicateOfNumber}.

If this is incorrect, please re-open this issue or create a new one.`,
    });
    if (!(await revalidateAfterOwnMutation(hasDuplicateLabel, "marker"))) {
      return false;
    }
    revalidatedImmediatelyBeforeClose = true;
  }

  // Adding a label through the labels endpoint preserves every existing label.
  if (!hasDuplicateLabel) {
    await githubRequest(`${base}/labels`, token, "POST", {
      labels: ["duplicate"],
    });
    if (!(await revalidateAfterOwnMutation(true, "label"))) return false;
    revalidatedImmediatelyBeforeClose = true;
  }

  // Even a retry run with no new marker or label mutation must re-read
  // reactions. Reactions do not reliably advance issue.updated_at, so an
  // author's late -1 would otherwise be invisible to the metadata snapshot.
  if (!revalidatedImmediatelyBeforeClose) {
    if (!(await revalidateAfterOwnMutation(hasDuplicateLabel, "none"))) {
      return false;
    }
  }

  await githubRequest(base, token, "PATCH", {
    state: "closed",
    state_reason: "duplicate",
  });
  return true;
}

export async function autoCloseDuplicates(): Promise<void> {
  console.log("[DEBUG] Starting auto-close duplicates script");

  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN environment variable is required");

  const owner = process.env.GITHUB_REPOSITORY_OWNER;
  const repo = process.env.GITHUB_REPOSITORY_NAME;
  if (!owner || !repo) {
    throw new Error(
      "GITHUB_REPOSITORY_OWNER and GITHUB_REPOSITORY_NAME are required"
    );
  }

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 3);

  // GraphQL cursor pagination has no REST page-number large-dataset ceiling and
  // repository.issues never includes pull requests.
  const issues = (await fetchOpenIssues(owner, repo, token)).filter(
    (issue) => new Date(issue.createdAt) <= cutoff
  );
  console.log(`[DEBUG] Found ${issues.length} old open issues`);

  let candidateCount = 0;
  const failures: string[] = [];

  for (const issue of issues) {
    try {
      // A valid candidate has the dedupe report as its latest comment. The
      // only exception is our idempotency marker after a failed close. This
      // cheap GraphQL preview avoids one REST request for every open issue.
      const previewTarget = preliminaryDuplicateTarget(
        issue,
        owner,
        repo,
        cutoff
      );
      if (!previewTarget || previewTarget === issue.number) continue;

      const comments = await githubPaginate<GitHubComment>(
        `/repos/${owner}/${repo}/issues/${issue.number}/comments`,
        token
      );
      const trustedComments = comments
        .filter(isTrustedDedupeComment)
        .sort(
          (left, right) =>
            new Date(left.created_at).getTime() -
            new Date(right.created_at).getTime()
        );
      const dedupeComment = trustedComments.at(-1);
      if (!dedupeComment || new Date(dedupeComment.created_at) > cutoff) continue;

      const duplicateOf = extractDuplicateIssueNumber(
        dedupeComment.body,
        owner,
        repo
      );
      if (!duplicateOf || duplicateOf === issue.number) continue;

      const marker = AUTO_CLOSE_MARKER(duplicateOf);
      const laterActivity = comments.some(
        (comment) =>
          comment.id !== dedupeComment.id &&
          new Date(comment.created_at) >= new Date(dedupeComment.created_at) &&
          !hasTrustedAutoCloseMarker(comment, marker)
      );
      if (laterActivity) continue;

      const reactions = await githubPaginate<GitHubReaction>(
        `/repos/${owner}/${repo}/issues/comments/${dedupeComment.id}/reactions`,
        token
      );
      const authorDisagreed = hasAuthorDisagreement(
        reactions,
        issue.author?.login
      );
      if (authorDisagreed) continue;

      // Comments and issue metadata can change while reaction pages are being
      // fetched. Re-read both immediately before the first mutation. Comparing
      // the complete comment snapshot also detects activity in the same second,
      // which GitHub's second-precision updated_at value cannot order reliably.
      const issueEndpoint = `/repos/${owner}/${repo}/issues/${issue.number}`;
      const [refreshedComments, refreshedIssue, events] = await Promise.all([
        githubPaginate<GitHubComment>(`${issueEndpoint}/comments`, token),
        githubRequest<RestIssue>(issueEndpoint, token),
        githubPaginate<GitHubIssueEvent>(`${issueEndpoint}/events`, token),
      ]);
      const refreshedUpdatedAt = Date.parse(refreshedIssue.updated_at ?? "");
      const latestCommentAt = latestCommentTimestamp(refreshedComments);
      if (
        refreshedIssue.state !== "open" ||
        refreshedIssue.locked !== false ||
        !isSameCommentSnapshot(comments, refreshedComments) ||
        !Number.isFinite(refreshedUpdatedAt) ||
        latestCommentAt === null
      ) {
        continue;
      }

      const hasDuplicateLabel = hasRestLabel(refreshedIssue, "duplicate");
      if (refreshedUpdatedAt !== latestCommentAt) {
        const latestMarker = refreshedComments
          .filter((comment) => hasTrustedAutoCloseMarker(comment, marker))
          .sort(
            (left, right) =>
              Date.parse(left.created_at) - Date.parse(right.created_at)
          )
          .at(-1);
        const markerAt = Date.parse(latestMarker?.created_at ?? "");
        if (!latestMarker || !hasDuplicateLabel || !Number.isFinite(markerAt)) {
          continue;
        }

        if (
          !isTrustedDuplicateLabelRecovery(
            events,
            markerAt,
            refreshedUpdatedAt
          )
        ) {
          continue;
        }
      }

      candidateCount += 1;
      const closed = await closeIssueAsDuplicate(
        owner,
        repo,
        issue.number,
        duplicateOf,
        refreshedComments,
        reactions,
        refreshedIssue,
        events,
        dedupeComment.id,
        issue.author?.login,
        hasDuplicateLabel,
        token
      );
      if (!closed) {
        console.log(
          `[DEBUG] Skipped issue #${issue.number}: activity changed during auto-close`
        );
        continue;
      }
      console.log(
        `[SUCCESS] Closed issue #${issue.number} as duplicate of #${duplicateOf}`
      );
    } catch (error) {
      const message = `issue #${issue.number}: ${String(error)}`;
      failures.push(message);
      console.error(`[ERROR] ${message}`);
    }
  }

  console.log(
    `[DEBUG] Processed ${issues.length} issues and found ${candidateCount} candidates`
  );
  if (failures.length > 0) {
    throw new Error(`Failed to process ${failures.length} issue(s)`);
  }
}

if (import.meta.main) {
  autoCloseDuplicates().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
