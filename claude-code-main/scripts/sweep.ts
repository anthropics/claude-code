#!/usr/bin/env bun

import { lifecycle, STALE_UPVOTE_THRESHOLD } from "./issue-lifecycle.ts";

// --

const NEW_ISSUE = "https://github.com/anthropics/claude-code/issues/new/choose";
const DRY_RUN = process.argv.includes("--dry-run");

const CLOSE_MESSAGE = (reason: string) =>
  `Closing for now — ${reason}. Please [open a new issue](${NEW_ISSUE}) if this is still relevant.`;

// --

async function githubRequest<T>(
  endpoint: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN required");

  const response = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "sweep",
      ...(body && { "Content-Type": "application/json" }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    if (response.status === 404) return {} as T;
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text}`);
  }

  return response.json();
}

// --

async function markStale(owner: string, repo: string) {
  const staleDays = lifecycle.find((l) => l.label === "stale")!.days;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - staleDays);

  let labeled = 0;

  console.log(`\n=== marking stale (${staleDays}d inactive) ===`);

  for (let page = 1; page <= 10; page++) {
    const issues = await githubRequest<any[]>(
      `/repos/${owner}/${repo}/issues?state=open&sort=updated&direction=asc&per_page=100&page=${page}`
    );
    if (issues.length === 0) break;

    for (const issue of issues) {
      if (issue.pull_request) continue;
      if (issue.locked) continue;
      if (issue.assignees?.length > 0) continue;

      const updatedAt = new Date(issue.updated_at);
      if (updatedAt > cutoff) return labeled;

      const alreadyStale = issue.labels?.some(
        (l: any) => l.name === "stale" || l.name === "autoclose"
      );
      if (alreadyStale) continue;

      const thumbsUp = issue.reactions?.["+1"] ?? 0;
      if (thumbsUp >= STALE_UPVOTE_THRESHOLD) continue;

      const base = `/repos/${owner}/${repo}/issues/${issue.number}`;

      if (DRY_RUN) {
        const age = Math.floor((Date.now() - updatedAt.getTime()) / 86400000);
        console.log(`#${issue.number}: would label stale (${age}d inactive) — ${issue.title}`);
      } else {
        await githubRequest(`${base}/labels`, "POST", { labels: ["stale"] });
        console.log(`#${issue.number}: labeled stale — ${issue.title}`);
      }
      labeled++;
    }
  }

  return labeled;
}

async function closeExpired(owner: string, repo: string) {
  let closed = 0;

  for (const { label, days, reason } of lifecycle) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    console.log(`\n=== ${label} (${days}d timeout) ===`);

    for (let page = 1; page <= 10; page++) {
      const issues = await githubRequest<any[]>(
        `/repos/${owner}/${repo}/issues?state=open&labels=${label}&sort=updated&direction=asc&per_page=100&page=${page}`
      );
      if (issues.length === 0) break;

      for (const issue of issues) {
        if (issue.pull_request) continue;
        if (issue.locked) continue;

        const thumbsUp = issue.reactions?.["+1"] ?? 0;
        if (thumbsUp >= STALE_UPVOTE_THRESHOLD) continue;

        const base = `/repos/${owner}/${repo}/issues/${issue.number}`;

        const events = await githubRequest<any[]>(`${base}/events?per_page=100`);

        const labeledAt = events
          .filter((e) => e.event === "labeled" && e.label?.name === label)
          .map((e) => new Date(e.created_at))
          .pop();

        if (!labeledAt || labeledAt > cutoff) continue;

        // Skip if a non-bot user commented after the label was applied.
        // The triage workflow should remove lifecycle labels on human
        // activity, but check here too as a safety net.
        const comments = await githubRequest<any[]>(
          `${base}/comments?since=${labeledAt.toISOString()}&per_page=100`
        );
        const hasHumanComment = comments.some(
          (c) => c.user && c.user.type !== "Bot"
        );
        if (hasHumanComment) {
          console.log(
            `#${issue.number}: skipping (human activity after ${label} label)`
          );
          continue;
        }

        if (DRY_RUN) {
          const age = Math.floor((Date.now() - labeledAt.getTime()) / 86400000);
          console.log(`#${issue.number}: would close (${label}, ${age}d old) — ${issue.title}`);
        } else {
          await githubRequest(`${base}/comments`, "POST", { body: CLOSE_MESSAGE(reason) });
          await githubRequest(base, "PATCH", { state: "closed", state_reason: "not_planned" });
          console.log(`#${issue.number}: closed (${label})`);
        }
        closed++;
      }
    }
  }

  return closed;
}

// --

const owner = process.env.GITHUB_REPOSITORY_OWNER;
const repo = process.env.GITHUB_REPOSITORY_NAME;
if (!owner || !repo)
  throw new Error("GITHUB_REPOSITORY_OWNER and GITHUB_REPOSITORY_NAME required");

if (DRY_RUN) console.log("DRY RUN — no changes will be made\n");

const labeled = await markStale(owner, repo);
const closed = await closeExpired(owner, repo);

console.log(`\nDone: ${labeled} ${DRY_RUN ? "would be labeled" : "labeled"} stale, ${closed} ${DRY_RUN ? "would be closed" : "closed"}`);
