// Pure decision logic for sweep.ts, split out so it can be unit tested
// without network access (same pattern as issue-lifecycle.ts).

export interface SweepIssue {
  number: number;
  updated_at: string;
  locked?: boolean;
  pull_request?: unknown;
  assignees?: unknown[];
  labels?: { name: string }[];
  reactions?: Record<string, number>;
}

// Search query for exactly the set markStale may label. The plain issues
// listing can't serve as a work queue: it interleaves PRs and permanently
// skipped issues (upvoted, assigned, already stale) which accumulate at the
// front of the oldest-updated-first sort until no candidate is reachable
// within any fixed page budget. The search API excludes all of those
// server-side. Search's `updated:` qualifier has date granularity, so the
// cutoff is truncated to a date; isStaleCandidate re-checks the exact time.
export function buildStaleQuery(owner: string, repo: string, cutoff: Date): string {
  const cutoffDate = cutoff.toISOString().split("T")[0];
  return `repo:${owner}/${repo} is:issue is:open updated:<${cutoffDate} -label:stale -label:autoclose no:assignee`;
}

// Client-side re-check of everything the query filters (the search index can
// lag) plus the two conditions search can't express: the exact cutoff time
// and the 👍-reaction threshold (search's `reactions:` counts all kinds).
export function isStaleCandidate(
  issue: SweepIssue,
  cutoff: Date,
  upvoteThreshold: number
): boolean {
  if (issue.pull_request) return false;
  if (issue.locked) return false;
  if ((issue.assignees?.length ?? 0) > 0) return false;
  if (issue.labels?.some((l) => l.name === "stale" || l.name === "autoclose")) return false;
  if ((issue.reactions?.["+1"] ?? 0) >= upvoteThreshold) return false;
  return new Date(issue.updated_at) < cutoff;
}

// Snapshot a paginated listing in full BEFORE acting on it. Offset pagination
// over a listing that the loop itself is mutating (labeling reorders the
// updated-sort; closing removes items) skips one item per mutation at every
// page boundary — collecting first makes the walk immune to that.
export async function collectPages<T>(
  fetchPage: (page: number) => Promise<T[]>,
  opts: { perPage?: number; maxPages?: number } = {}
): Promise<T[]> {
  const perPage = opts.perPage ?? 100;
  const maxPages = opts.maxPages ?? 30;
  const results: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const items = await fetchPage(page);
    results.push(...items);
    if (items.length < perPage) break;
  }
  return results;
}
