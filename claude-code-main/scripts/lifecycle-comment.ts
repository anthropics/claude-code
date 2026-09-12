#!/usr/bin/env bun

// Posts a comment when a lifecycle label is applied to an issue,
// giving the author a heads-up and a chance to respond before auto-close.

import { lifecycle } from "./issue-lifecycle.ts";

const DRY_RUN = process.argv.includes("--dry-run");
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY; // owner/repo
const label = process.env.LABEL;
const issueNumber = process.env.ISSUE_NUMBER;

if (!DRY_RUN && !token) throw new Error("GITHUB_TOKEN required");
if (!repo) throw new Error("GITHUB_REPOSITORY required");
if (!label) throw new Error("LABEL required");
if (!issueNumber) throw new Error("ISSUE_NUMBER required");

const entry = lifecycle.find((l) => l.label === label);
if (!entry) {
  console.log(`No lifecycle entry for label "${label}", skipping`);
  process.exit(0);
}

const body = `${entry.nudge} This issue will be closed automatically if there's no activity within ${entry.days} days.`;

// --

if (DRY_RUN) {
  console.log(`Would comment on #${issueNumber} for label "${label}":\n\n${body}`);
  process.exit(0);
}

const response = await fetch(
  `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "lifecycle-comment",
    },
    body: JSON.stringify({ body }),
  }
);

if (!response.ok) {
  const text = await response.text();
  throw new Error(`GitHub API ${response.status}: ${text}`);
}

console.log(`Commented on #${issueNumber} for label "${label}"`);
