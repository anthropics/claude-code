/**
 * digest.ts — Entry point for weekly digest generation
 *
 * Env vars:
 *   GITHUB_TOKEN        — GitHub token with issues:write
 *   ANTHROPIC_API_KEY   — Anthropic API key
 *   GITHUB_REPOSITORY   — "owner/repo" (set automatically in Actions)
 *   ANTHROPIC_BASE_URL  — Optional: override Anthropic base URL (e.g. Kimi)
 *   DIGEST_MODEL        — Optional: override digest model
 *   DIGEST_DAYS         — Optional: number of days to look back (default: 7)
 */

import { createClient, fetchRecentItems } from "./github.js";
import { generateDigest } from "./llm.js";
import { DIGEST_SYSTEM_PROMPT, buildDigestUserPrompt } from "./prompts.js";
import { Octokit } from "@octokit/rest";

const REPO = process.env.GITHUB_REPOSITORY ?? "anthropics/claude-code";
const [OWNER, REPO_NAME] = REPO.split("/");
const DAYS = parseInt(process.env.DIGEST_DAYS ?? "7", 10);
const DIGEST_LABEL = "weekly-digest";

async function closePreviousDigests(
  client: Octokit,
  owner: string,
  repo: string,
  currentNumber: number
): Promise<void> {
  const { data: openIssues } = await client.issues.listForRepo({
    owner,
    repo,
    state: "open",
    labels: DIGEST_LABEL,
    per_page: 20,
  });

  for (const issue of openIssues) {
    if (issue.number !== currentNumber) {
      await client.issues.update({
        owner,
        repo,
        issue_number: issue.number,
        state: "closed",
      });
      console.log(`Closed previous digest #${issue.number}`);
    }
  }
}

async function main(): Promise<void> {
  const client = createClient();

  // Step 1: Fetch recent activity
  const dateRange = `${new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString().split("T")[0]} – ${new Date().toISOString().split("T")[0]}`;
  console.log(`Fetching activity for ${OWNER}/${REPO_NAME} over past ${DAYS} days (${dateRange})...`);

  const { issues, pullRequests } = await fetchRecentItems(
    client,
    OWNER,
    REPO_NAME,
    DAYS
  );

  console.log(`Found ${issues.length} issues and ${pullRequests.length} PRs`);

  // Step 2: Generate digest via LLM
  console.log("Generating digest...");
  const userPrompt = buildDigestUserPrompt(issues, pullRequests, DAYS);
  const digestBody = await generateDigest(DIGEST_SYSTEM_PROMPT, userPrompt);

  // Step 3: Create digest issue
  const title = `Weekly Claude Code Community Digest — ${dateRange}`;
  console.log(`Creating digest issue: "${title}"`);

  const { data: newIssue } = await client.issues.create({
    owner: OWNER,
    repo: REPO_NAME,
    title,
    body: digestBody,
    labels: [DIGEST_LABEL],
  });

  console.log(`Created digest issue #${newIssue.number}: ${newIssue.html_url}`);

  // Step 4: Close previous digest issues (keep only latest)
  await closePreviousDigests(client, OWNER, REPO_NAME, newIssue.number);

  console.log("Digest complete.");
}

main().catch((err) => {
  console.error("Digest failed:", err);
  process.exit(1);
});
