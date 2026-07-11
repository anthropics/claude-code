#!/usr/bin/env bun

import { lifecycle, STALE_UPVOTE_THRESHOLD } from "./issue-lifecycle.ts";
import {
  GitHubApiError,
  githubGraphql,
  githubPaginate,
  githubRequest,
} from "./github-api.ts";

const NEW_ISSUE = "https://github.com/anthropics/claude-code/issues/new/choose";
const DRY_RUN = process.argv.includes("--dry-run");
// GitHub timestamps have second precision. A small grace period prevents an
// activity at the timeout boundary from being ordered before its label event.
const LIFECYCLE_ACTIVITY_GRACE_MS = 60_000;
const CLOSE_MARKER = (label: string) => `<!-- lifecycle-close:${label} -->`;
const CLOSE_MESSAGE = (label: string, reason: string) =>
  `${CLOSE_MARKER(label)}\nClosing for now — ${reason}. Please [open a new issue](${NEW_ISSUE}) if this is still relevant.`;

interface RepositoryIssue {
  number: number;
  title: string;
  updatedAt: string;
  locked: boolean;
  assignees: { totalCount: number };
  labels: { nodes: Array<{ name: string }> };
  reactionGroups: Array<{
    content: string;
    reactors: { totalCount: number };
  }>;
}

interface IssuePage {
  repository: {
    issues: {
      nodes: RepositoryIssue[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  } | null;
}

interface IssueEvent {
  event: string;
  created_at: string;
  label?: { name: string };
}

interface IssueComment {
  body: string;
  created_at: string;
  user: { type: string; login: string } | null;
}

interface RestIssue {
  title?: string;
  body?: string | null;
  state?: string;
  state_reason?: string | null;
  locked?: boolean;
  updated_at?: string;
  assignees?: Array<string | { login?: string }>;
  labels?: Array<string | { name?: string }>;
  milestone?: { number?: number; title?: string; state?: string } | null;
  reactions?: { "+1"?: number };
}

function hasTrustedCloseMarker(comment: IssueComment, marker: string): boolean {
  const expectedLogin =
    process.env.AUTOMATION_BOT_LOGIN || "github-actions[bot]";
  return (
    comment.user?.type === "Bot" &&
    comment.user.login === expectedLogin &&
    comment.body.includes(marker)
  );
}

const OPEN_ISSUES_QUERY = `
  query SweepIssues($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      issues(
        first: 100
        after: $cursor
        states: OPEN
        orderBy: { field: UPDATED_AT, direction: ASC }
      ) {
        nodes {
          number
          title
          updatedAt
          locked
          assignees { totalCount }
          labels(first: 100) { nodes { name } }
          reactionGroups { content reactors { totalCount } }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

async function fetchOpenIssues(
  owner: string,
  repo: string,
  token: string
): Promise<RepositoryIssue[]> {
  const issues: RepositoryIssue[] = [];
  const cursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const data = await githubGraphql<IssuePage>(
      OPEN_ISSUES_QUERY,
      { owner, repo, cursor },
      token
    );
    if (!data.repository) throw new Error(`Repository ${owner}/${repo} not found`);
    const connection = data.repository.issues;
    issues.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) break;
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

function labels(issue: RepositoryIssue): string[] {
  return issue.labels.nodes.map((label) => label.name);
}

function thumbsUp(issue: RepositoryIssue): number {
  return (
    issue.reactionGroups.find((group) => group.content === "THUMBS_UP")?.reactors
      .totalCount ?? 0
  );
}

function isCurrentStaleCandidate(issue: RestIssue, cutoff: Date): boolean {
  const updatedAt = Date.parse(issue.updated_at ?? "");
  const currentLabels = issue.labels?.map((label) =>
    typeof label === "string" ? label : label.name
  );
  const currentThumbsUp = issue.reactions?.["+1"];

  return (
    issue.state === "open" &&
    issue.locked === false &&
    Array.isArray(issue.assignees) &&
    issue.assignees.length === 0 &&
    Array.isArray(currentLabels) &&
    !currentLabels.some(
      (label) => label === "stale" || label === "autoclose"
    ) &&
    typeof currentThumbsUp === "number" &&
    Number.isFinite(currentThumbsUp) &&
    currentThumbsUp < STALE_UPVOTE_THRESHOLD &&
    Number.isFinite(updatedAt) &&
    updatedAt <= cutoff.getTime()
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
  ignoredLabels: string[] = []
): string {
  const assignees = Array.isArray(issue.assignees)
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
    state: issue.state ?? null,
    stateReason: issue.state_reason ?? null,
    locked: issue.locked ?? null,
    labels:
      restLabelNames(issue)?.filter(
        (label) => !ignoredLabels.includes(label)
      ) ?? null,
    assignees,
    milestone,
    reactions: issue.reactions ?? null,
  });
}

function isExpectedStaleMutation(
  previous: RestIssue,
  current: RestIssue
): boolean {
  const previousLabels = restLabelNames(previous);
  const currentLabels = restLabelNames(current);
  return (
    previousLabels !== null &&
    currentLabels !== null &&
    !previousLabels.includes("stale") &&
    currentLabels.filter((label) => label === "stale").length === 1 &&
    issueMetadataSnapshot(previous, ["stale"]) ===
      issueMetadataSnapshot(current, ["stale"])
  );
}

async function removeStaleLabelAddedByThisRun(
  base: string,
  token: string
): Promise<void> {
  try {
    await githubRequest(`${base}/labels/stale`, token, "DELETE");
  } catch (error) {
    // A concurrent actor may already have removed the label. The desired
    // rollback state has then been reached, so a missing label is harmless.
    if (error instanceof GitHubApiError && error.status === 404) return;
    throw error;
  }
}

function isSameApiSnapshot(previous: unknown[], current: unknown[]): boolean {
  return stableJson(previous) === stableJson(current);
}

function isSameCommentSnapshotIgnoringMarker(
  previous: IssueComment[],
  current: IssueComment[],
  marker: string
): boolean {
  const withoutOwnMarker = (comments: IssueComment[]) =>
    comments.filter((comment) => !hasTrustedCloseMarker(comment, marker));
  return isSameApiSnapshot(
    withoutOwnMarker(previous),
    withoutOwnMarker(current)
  );
}

function trustedLatestCloseMarkerAt(
  comments: IssueComment[],
  marker: string
): number | null {
  const trustedMarkers = comments.filter((comment) =>
    hasTrustedCloseMarker(comment, marker)
  );
  if (trustedMarkers.length !== 1) return null;

  const markerAt = Date.parse(trustedMarkers[0].created_at);
  if (!Number.isFinite(markerAt)) return null;
  let latestAt = Number.NEGATIVE_INFINITY;
  for (const comment of comments) {
    const commentAt = Date.parse(comment.created_at);
    if (!Number.isFinite(commentAt)) return null;
    latestAt = Math.max(latestAt, commentAt);
  }
  return markerAt === latestAt ? markerAt : null;
}

function remainsCloseEligibleAfterOwnComment(
  issue: RestIssue,
  label: string
): boolean {
  const updatedAt = Date.parse(issue.updated_at ?? "");
  const currentLabels = issue.labels?.map((entry) =>
    typeof entry === "string" ? entry : entry.name
  );
  const currentThumbsUp = issue.reactions?.["+1"];

  return (
    issue.state === "open" &&
    issue.locked === false &&
    Array.isArray(issue.assignees) &&
    issue.assignees.length === 0 &&
    Array.isArray(currentLabels) &&
    currentLabels.includes(label) &&
    typeof currentThumbsUp === "number" &&
    Number.isFinite(currentThumbsUp) &&
    currentThumbsUp < STALE_UPVOTE_THRESHOLD &&
    Number.isFinite(updatedAt)
  );
}

function isCurrentCloseCandidate(
  issue: RestIssue,
  snapshot: RepositoryIssue,
  label: string
): boolean {
  const currentUpdatedAt = Date.parse(issue.updated_at ?? "");
  const snapshotUpdatedAt = Date.parse(snapshot.updatedAt);
  const currentLabels = issue.labels?.map((entry) =>
    typeof entry === "string" ? entry : entry.name
  );
  const currentThumbsUp = issue.reactions?.["+1"];

  return (
    issue.state === "open" &&
    issue.locked === false &&
    Array.isArray(issue.assignees) &&
    issue.assignees.length === 0 &&
    Array.isArray(currentLabels) &&
    currentLabels.includes(label) &&
    typeof currentThumbsUp === "number" &&
    Number.isFinite(currentThumbsUp) &&
    currentThumbsUp < STALE_UPVOTE_THRESHOLD &&
    Number.isFinite(currentUpdatedAt) &&
    Number.isFinite(snapshotUpdatedAt) &&
    currentUpdatedAt === snapshotUpdatedAt
  );
}

async function markStale(
  owner: string,
  repo: string,
  token: string,
  issues: RepositoryIssue[]
): Promise<{ count: number; failures: string[] }> {
  const staleDays = lifecycle.find((entry) => entry.label === "stale")!.days;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - staleDays);
  const failures: string[] = [];
  let count = 0;

  console.log(`\n=== marking stale (${staleDays}d inactive) ===`);
  for (const issue of issues) {
    const updatedAt = new Date(issue.updatedAt);
    if (updatedAt > cutoff) break;
    if (issue.locked || issue.assignees.totalCount > 0) continue;
    if (labels(issue).some((label) => label === "stale" || label === "autoclose")) {
      continue;
    }
    if (thumbsUp(issue) >= STALE_UPVOTE_THRESHOLD) continue;

    if (DRY_RUN) {
      console.log(`#${issue.number}: would label stale — ${issue.title}`);
      count += 1;
      continue;
    }

    try {
      const base = `/repos/${owner}/${repo}/issues/${issue.number}`;
      // The GraphQL list is only a pagination snapshot. Human activity or a
      // maintainer action can make the issue ineligible before this mutation.
      const current = await githubRequest<RestIssue>(base, token);
      if (!isCurrentStaleCandidate(current, cutoff)) {
        console.log(`#${issue.number}: changed since snapshot, skipping stale`);
        continue;
      }

      // Close the window between the first metadata read and the comment
      // snapshot. Exact comparison catches label, assignment, reaction, and
      // same-second activity before the mutation starts.
      const commentsBeforeLabel = await githubPaginate<IssueComment>(
        `${base}/comments`,
        token
      );
      const immediatelyBeforeLabel = await githubRequest<RestIssue>(base, token);
      if (
        !isCurrentStaleCandidate(immediatelyBeforeLabel, cutoff) ||
        stableJson(current) !== stableJson(immediatelyBeforeLabel)
      ) {
        console.log(`#${issue.number}: changed before stale label, skipping`);
        continue;
      }

      await githubRequest(
        `${base}/labels`,
        token,
        "POST",
        { labels: ["stale"] }
      );

      // A human can reply after the final pre-label read but before GitHub
      // applies our label. Re-read both surfaces and roll back only the stale
      // label that this run proved was absent immediately before adding it.
      try {
        const [commentsAfterLabel, issueAfterLabel] = await Promise.all([
          githubPaginate<IssueComment>(`${base}/comments`, token),
          githubRequest<RestIssue>(base, token),
        ]);
        if (
          !isSameApiSnapshot(commentsBeforeLabel, commentsAfterLabel) ||
          !isExpectedStaleMutation(immediatelyBeforeLabel, issueAfterLabel)
        ) {
          await removeStaleLabelAddedByThisRun(base, token);
          console.log(
            `#${issue.number}: changed during stale labeling, removed stale`
          );
          continue;
        }
      } catch (error) {
        await removeStaleLabelAddedByThisRun(base, token);
        throw error;
      }
      console.log(`#${issue.number}: labeled stale — ${issue.title}`);
      count += 1;
    } catch (error) {
      const message = `labeling #${issue.number}: ${String(error)}`;
      failures.push(message);
      console.error(`[ERROR] ${message}`);
    }
  }

  return { count, failures };
}

async function closeExpired(
  owner: string,
  repo: string,
  token: string,
  issues: RepositoryIssue[]
): Promise<{ count: number; failures: string[] }> {
  const failures: string[] = [];
  const handledIssues = new Set<number>();
  let count = 0;

  for (const { label, days, reason } of lifecycle) {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    console.log(`\n=== ${label} (${days}d timeout) ===`);

    for (const issue of issues) {
      if (handledIssues.has(issue.number)) continue;
      if (issue.locked || !labels(issue).includes(label)) continue;
      if (thumbsUp(issue) >= STALE_UPVOTE_THRESHOLD) continue;

      const base = `/repos/${owner}/${repo}/issues/${issue.number}`;
      const marker = CLOSE_MARKER(label);
      try {
        const events = await githubPaginate<IssueEvent>(`${base}/events`, token);
        const labeledAt = events
          .filter((event) => event.event === "labeled" && event.label?.name === label)
          .map((event) => new Date(event.created_at))
          .sort((left, right) => left.getTime() - right.getTime())
          .at(-1);
        if (!labeledAt || labeledAt > cutoff) continue;

        const comments = await githubPaginate<IssueComment>(
          `${base}/comments?since=${encodeURIComponent(labeledAt.toISOString())}`,
          token
        );
        let latestHumanActivityAt: Date | undefined;
        let hasUnparseableHumanActivity = false;
        for (const comment of comments) {
          if (comment.user?.type === "Bot") continue;
          const commentAt = new Date(comment.created_at);
          if (!Number.isFinite(commentAt.getTime())) {
            hasUnparseableHumanActivity = true;
            continue;
          }
          if (
            commentAt >= labeledAt &&
            (!latestHumanActivityAt || commentAt > latestHumanActivityAt)
          ) {
            latestHumanActivityAt = commentAt;
          }
        }
        if (
          hasUnparseableHumanActivity ||
          (latestHumanActivityAt &&
            latestHumanActivityAt.getTime() + LIFECYCLE_ACTIVITY_GRACE_MS >
              cutoff.getTime())
        ) {
          console.log(`#${issue.number}: waiting after recent human activity`);
          continue;
        }

        // Body/title edits have no issue comment, but they do advance
        // updatedAt. Reset the inactivity window for any recent issue activity.
        // The only retry exception is our exact trusted marker after a failed
        // close PATCH, and it must itself be the latest recorded activity.
        const snapshotUpdatedAt = Date.parse(issue.updatedAt);
        const retryMarkerAt = trustedLatestCloseMarkerAt(comments, marker);
        const retryFromTrustedMarker =
          retryMarkerAt !== null && snapshotUpdatedAt === retryMarkerAt;
        if (
          !Number.isFinite(snapshotUpdatedAt) ||
          (snapshotUpdatedAt > cutoff.getTime() && !retryFromTrustedMarker)
        ) {
          console.log(`#${issue.number}: waiting after recent issue activity`);
          continue;
        }

        if (DRY_RUN) {
          console.log(`#${issue.number}: would close (${label}) — ${issue.title}`);
          handledIssues.add(issue.number);
          count += 1;
          continue;
        }

        // The event/comment reads above are only a candidate snapshot. Refresh
        // both snapshots and all mutable issue eligibility immediately before
        // posting the close marker. This catches same-second comments as well
        // as label, assignment, reaction, state, and metadata changes.
        const commentsEndpoint = `${base}/comments?since=${encodeURIComponent(
          labeledAt.toISOString()
        )}`;
        const [currentEvents, currentComments, currentIssue] = await Promise.all([
          githubPaginate<IssueEvent>(`${base}/events`, token),
          githubPaginate<IssueComment>(commentsEndpoint, token),
          githubRequest<RestIssue>(base, token),
        ]);
        if (
          !isSameApiSnapshot(events, currentEvents) ||
          !isSameApiSnapshot(comments, currentComments) ||
          !isCurrentCloseCandidate(currentIssue, issue, label)
        ) {
          console.log(`#${issue.number}: changed before close, skipping`);
          continue;
        }

        handledIssues.add(issue.number);
        if (
          !currentComments.some((comment) =>
            hasTrustedCloseMarker(comment, marker)
          )
        ) {
          await githubRequest(`${base}/comments`, token, "POST", {
            body: CLOSE_MESSAGE(label, reason),
          });

          // Posting our own marker advances updated_at and creates a new race
          // window. Re-read every human-controlled surface before closing and
          // ignore only the exact trusted marker that this run just added.
          const [postMarkerEvents, postMarkerComments, postMarkerIssue] =
            await Promise.all([
              githubPaginate<IssueEvent>(`${base}/events`, token),
              githubPaginate<IssueComment>(commentsEndpoint, token),
              githubRequest<RestIssue>(base, token),
            ]);
          const postMarkerUpdatedAt = Date.parse(
            postMarkerIssue.updated_at ?? ""
          );
          const ownMarkerAt = trustedLatestCloseMarkerAt(
            postMarkerComments,
            marker
          );
          if (
            !isSameApiSnapshot(currentEvents, postMarkerEvents) ||
            !isSameCommentSnapshotIgnoringMarker(
              currentComments,
              postMarkerComments,
              marker
            ) ||
            ownMarkerAt === null ||
            postMarkerUpdatedAt !== ownMarkerAt ||
            issueMetadataSnapshot(currentIssue) !==
              issueMetadataSnapshot(postMarkerIssue) ||
            !remainsCloseEligibleAfterOwnComment(postMarkerIssue, label)
          ) {
            console.log(
              `#${issue.number}: changed after close marker, skipping`
            );
            continue;
          }
        }
        await githubRequest(base, token, "PATCH", {
          state: "closed",
          state_reason: "not_planned",
        });
        console.log(`#${issue.number}: closed (${label})`);
        count += 1;
      } catch (error) {
        if (error instanceof GitHubApiError && error.status === 404) {
          handledIssues.add(issue.number);
          console.log(`#${issue.number}: disappeared during sweep, skipping`);
          continue;
        }
        handledIssues.add(issue.number);
        const message = `closing #${issue.number} (${label}): ${String(error)}`;
        failures.push(message);
        console.error(`[ERROR] ${message}`);
      }
    }
  }

  return { count, failures };
}

export async function runSweep(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPOSITORY_OWNER;
  const repo = process.env.GITHUB_REPOSITORY_NAME;
  if (!token) throw new Error("GITHUB_TOKEN required");
  if (!owner || !repo) {
    throw new Error("GITHUB_REPOSITORY_OWNER and GITHUB_REPOSITORY_NAME required");
  }

  if (DRY_RUN) console.log("DRY RUN — no changes will be made\n");

  // Capture a cursor-paginated snapshot before mutating updated_at. This avoids
  // skipping entries when labels or comments change the server-side ordering.
  const issues = await fetchOpenIssues(owner, repo, token);
  const staleResult = await markStale(owner, repo, token, issues);
  const closeResult = await closeExpired(owner, repo, token, issues);
  const failures = [...staleResult.failures, ...closeResult.failures];

  console.log(
    `\nDone: ${staleResult.count} ${DRY_RUN ? "would be labeled" : "labeled"} stale, ${closeResult.count} ${DRY_RUN ? "would be closed" : "closed"}`
  );
  if (failures.length > 0) {
    throw new Error(`Sweep completed with ${failures.length} failure(s)`);
  }
}

if (import.meta.main) {
  runSweep().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
