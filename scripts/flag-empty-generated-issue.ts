#!/usr/bin/env bun

// Labels generated issue reports that contain only metadata and no actionable
// bug description, so the lifecycle comment asks the reporter for details.

import {
  isEmptyGeneratedIssueReport,
} from "./issue-lifecycle.ts";

const DRY_RUN = process.argv.includes("--dry-run");
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const eventPath = process.env.GITHUB_EVENT_PATH;

if (!DRY_RUN && !token) throw new Error("GITHUB_TOKEN required");
if (!repo) throw new Error("GITHUB_REPOSITORY required");
if (!eventPath) throw new Error("GITHUB_EVENT_PATH required");

const event = await Bun.file(eventPath).json();
const issue = event.issue;

if (!issue?.number) {
  console.log("No issue in event payload, skipping");
  process.exit(0);
}

const labels = new Set(
  (issue.labels ?? []).map((label: { name: string } | string) =>
    typeof label === "string" ? label : label.name
  )
);

async function githubRequest<T>(endpoint: string, method = "GET", body?: unknown) {
  if (!token) throw new Error("GITHUB_TOKEN required");

  const response = await fetch(`https://api.github.com/repos/${repo}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "flag-empty-generated-issue",
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

if (
  !isEmptyGeneratedIssueReport({
    title: issue.title ?? "",
    body: issue.body ?? "",
  })
) {
  console.log(`#${issue.number}: not an empty generated issue report`);
  process.exit(0);
}

const labelsToApply = ["bug", "needs-info"].filter((label) => !labels.has(label));

if (labelsToApply.length === 0) {
  console.log(`#${issue.number}: empty generated issue report already labeled`);
  process.exit(0);
}

if (DRY_RUN) {
  console.log(
    `#${issue.number}: would add labels for empty generated issue report: ${labelsToApply.join(
      ", "
    )}`
  );
  process.exit(0);
}

await githubRequest(`/issues/${issue.number}/labels`, "POST", {
  labels: labelsToApply,
});

console.log(
  `#${issue.number}: added labels for empty generated issue report: ${labelsToApply.join(
    ", "
  )}`
);
