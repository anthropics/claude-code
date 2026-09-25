/**
 * triage.ts — Entry point for single-issue triage
 *
 * Env vars:
 *   GITHUB_TOKEN        — GitHub token with issues:write
 *   ANTHROPIC_API_KEY   — Anthropic API key
 *   ISSUE_NUMBER        — Issue number to triage
 *   GITHUB_REPOSITORY   — "owner/repo" (set automatically in Actions)
 *   ANTHROPIC_BASE_URL  — Optional: override Anthropic base URL (e.g. Kimi)
 *   TRIAGE_MODEL        — Optional: override triage model
 */

import {
  createClient,
  fetchIssue,
  searchDuplicates,
  addLabels,
  postComment,
} from "./github.js";
import { triageIssue } from "./llm.js";
import {
  TRIAGE_SYSTEM_PROMPT,
  DUPLICATE_CHECK_SYSTEM_PROMPT,
  buildTriageUserPrompt,
  buildDuplicateCheckUserPrompt,
  formatTriageComment,
  type TriageResult,
  type DuplicateMatch,
} from "./prompts.js";

const REPO = process.env.GITHUB_REPOSITORY ?? "anthropics/claude-code";
const [OWNER, REPO_NAME] = REPO.split("/");

async function main(): Promise<void> {
  const issueNumberStr = process.env.ISSUE_NUMBER;
  if (!issueNumberStr) throw new Error("ISSUE_NUMBER environment variable is required");
  const issueNumber = parseInt(issueNumberStr, 10);
  if (isNaN(issueNumber)) throw new Error(`Invalid ISSUE_NUMBER: ${issueNumberStr}`);

  const client = createClient();

  // Step 1: Fetch the issue
  console.log(`Fetching issue #${issueNumber} from ${OWNER}/${REPO_NAME}...`);
  const issue = await fetchIssue(client, OWNER, REPO_NAME, issueNumber);
  console.log(`Issue: "${issue.title}"`);

  // Step 2: LLM triage
  console.log("Running LLM triage...");
  const userPrompt = buildTriageUserPrompt(issue.number, issue.title, issue.body);
  const rawResult = await triageIssue(TRIAGE_SYSTEM_PROMPT, userPrompt);

  let triageResult: TriageResult;
  try {
    triageResult = JSON.parse(rawResult) as TriageResult;
  } catch {
    throw new Error(`LLM returned invalid JSON:\n${rawResult}`);
  }

  console.log(
    `Triage result: ${triageResult.priority} | ${triageResult.category} | labels: ${triageResult.labels.join(", ")}`
  );

  // Step 3: Duplicate detection
  console.log("Searching for duplicates...");
  const candidates = await searchDuplicates(
    client,
    OWNER,
    REPO_NAME,
    issue.title,
    issue.body
  );

  let duplicates: DuplicateMatch[] = [];
  if (candidates.length > 0) {
    const dupUserPrompt = buildDuplicateCheckUserPrompt(
      issue.title,
      issue.body,
      candidates
    );
    const rawDupResult = await triageIssue(DUPLICATE_CHECK_SYSTEM_PROMPT, dupUserPrompt);
    try {
      const parsed = JSON.parse(rawDupResult) as { duplicates: DuplicateMatch[] };
      duplicates = parsed.duplicates ?? [];
    } catch {
      console.warn("Duplicate check returned invalid JSON, skipping");
    }
  }

  if (duplicates.length > 0) {
    console.log(`Found ${duplicates.length} potential duplicate(s)`);
  }

  // Step 4: Apply labels
  const labelsToApply = [
    ...triageResult.labels,
    triageResult.priority,
    ...(triageResult.has_repro ? ["has repro"] : []),
    ...(triageResult.needs_info ? ["needs-info"] : []),
  ];

  console.log(`Applying labels: ${labelsToApply.join(", ")}`);
  await addLabels(client, OWNER, REPO_NAME, issueNumber, labelsToApply);

  // Step 5: Post triage comment
  const comment = formatTriageComment(triageResult, duplicates);
  console.log("Posting triage comment...");
  await postComment(client, OWNER, REPO_NAME, issueNumber, comment);

  console.log(`Done. Issue #${issueNumber} triaged as ${triageResult.priority}.`);
}

main().catch((err) => {
  console.error("Triage failed:", err);
  process.exit(1);
});
