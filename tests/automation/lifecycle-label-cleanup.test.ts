import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

function workflowScript(workflow: string): string {
  const lines = workflow.split("\n");
  const scriptLine = lines.findIndex((line) => line.trim() === "script: |");
  if (scriptLine === -1) throw new Error("workflow script block not found");

  return lines
    .slice(scriptLine + 1)
    .filter((line) => line.trim() === "" || line.startsWith("            "))
    .map((line) => line.slice(12))
    .join("\n");
}

describe("lifecycle label cleanup", () => {
  test("removes stale and autoclose but preserves labels requiring content review", async () => {
    const workflow = await readFile(
      `${repositoryRoot}.github/workflows/remove-autoclose-label.yml`,
      "utf8"
    );
    const removedLabels: string[] = [];
    const github = {
      rest: {
        issues: {
          removeLabel: async (options: { name: string }) => {
            removedLabels.push(options.name);
          },
        },
      },
    };
    const context = {
      issue: { number: 42 },
      repo: { owner: "acme", repo: "widgets" },
      payload: {
        issue: {
          user: { login: "original-reporter" },
          labels: [
            { name: "stale" },
            { name: "autoclose" },
            { name: "invalid" },
            { name: "needs-info" },
            { name: "needs-repro" },
          ],
        },
        comment: {
          user: { login: "external-reporter", type: "User" },
        },
      },
    };
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

    await new AsyncFunction("github", "context", workflowScript(workflow))(
      github,
      context
    );

    expect(removedLabels).toEqual(["stale", "autoclose"]);
  });

  test("leaves content labels to triage when the original reporter responds", async () => {
    const workflow = await readFile(
      `${repositoryRoot}.github/workflows/remove-autoclose-label.yml`,
      "utf8"
    );
    const removedLabels: string[] = [];
    const github = {
      rest: {
        issues: {
          removeLabel: async (options: { name: string }) => {
            removedLabels.push(options.name);
          },
        },
      },
    };
    const context = {
      issue: { number: 43 },
      repo: { owner: "acme", repo: "widgets" },
      payload: {
        issue: {
          user: { login: "external-reporter" },
          labels: [
            { name: "stale" },
            { name: "autoclose" },
            { name: "invalid" },
            { name: "needs-info" },
            { name: "needs-repro" },
          ],
        },
        comment: {
          user: { login: "external-reporter", type: "User" },
        },
      },
    };
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

    await new AsyncFunction("github", "context", workflowScript(workflow))(
      github,
      context
    );

    expect(removedLabels).toEqual(["stale", "autoclose"]);
  });

  test("keeps model triage trusted while cleanup accepts every non-Bot human", async () => {
    const [cleanupWorkflow, triageWorkflow] = await Promise.all([
      readFile(
        `${repositoryRoot}.github/workflows/remove-autoclose-label.yml`,
        "utf8"
      ),
      readFile(
        `${repositoryRoot}.github/workflows/claude-issue-triage.yml`,
        "utf8"
      ),
    ]);

    expect(cleanupWorkflow).toContain(
      "github.event.comment.user.type != 'Bot'"
    );
    expect(cleanupWorkflow).toContain("!github.event.issue.pull_request");
    expect(cleanupWorkflow).not.toContain(
      "github.event.comment.user.login == github.event.issue.user.login"
    );
    expect(cleanupWorkflow).not.toContain("'invalid'");
    expect(cleanupWorkflow).not.toContain("'needs-info'");
    expect(cleanupWorkflow).not.toContain("'needs-repro'");
    expect(triageWorkflow).toContain(
      `contains(fromJSON('["OWNER","MEMBER","COLLABORATOR"]'), github.event.comment.author_association)`
    );
  });
});
