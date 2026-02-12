#!/usr/bin/env bun

// --

const NEW_ISSUE = "https://github.com/anthropics/claude-code/issues/new/choose";
const DRY_RUN = process.argv.includes("--dry-run");

const lifecycle = [
  { label: "needs-repro", days: 7 },
  { label: "needs-info",  days: 7 },
  { label: "needs-votes", days: 30 },
  { label: "stale",       days: 30 },
];

const closeMessages: Record<string, string> = {
  "needs-repro": `Closing — we weren't able to get the reproduction steps needed to investigate.\n\nIf this is still a problem, please [open a new issue](${NEW_ISSUE}) with steps to reproduce.`,
  "needs-info": `Closing — we didn't receive the information needed to move forward.\n\nIf this is still a problem, please [open a new issue](${NEW_ISSUE}) with the requested details.`,
  "needs-votes": `Closing this feature request — it didn't get enough community support to prioritize.\n\nIf you'd still like to see this, please [open a new feature request](${NEW_ISSUE}) with more context about the use case.`,
  stale: `Closing due to inactivity.\n\nIf this is still a problem, please [open a new issue](${NEW_ISSUE}) with up-to-date information.`,
};

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

async function main() {
  const owner = process.env.GITHUB_REPOSITORY_OWNER;
  const repo = process.env.GITHUB_REPOSITORY_NAME;
  if (!owner || !repo)
    throw new Error("GITHUB_REPOSITORY_OWNER and GITHUB_REPOSITORY_NAME required");

  if (DRY_RUN) console.log("DRY RUN — no issues will be closed\n");

  let closed = 0;

  for (const { label, days } of lifecycle) {
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
        const base = `/repos/${owner}/${repo}/issues/${issue.number}`;

        const events = await githubRequest<any[]>(`${base}/events?per_page=100`);

        const labeledAt = events
          .filter((e) => e.event === "labeled" && e.label?.name === label)
          .map((e) => new Date(e.created_at))
          .pop();

        if (!labeledAt || labeledAt > cutoff) continue;

        if (DRY_RUN) {
          const age = Math.floor((Date.now() - labeledAt.getTime()) / 86400000);
          console.log(`#${issue.number}: would close (${label}, ${age}d old) — ${issue.title}`);
        } else {
          await githubRequest(`${base}/comments`, "POST", { body: closeMessages[label] });
          await githubRequest(base, "PATCH", { state: "closed", state_reason: "not_planned" });
          console.log(`#${issue.number}: closed (${label})`);
        }
        closed++;
      }
    }
  }

  console.log(`\nDone: ${closed} ${DRY_RUN ? "would be closed" : "closed"}`);
}

main().catch(console.error);

export {};
