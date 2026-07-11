import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const workflowPath = `${repositoryRoot}.github/workflows/non-write-users-check.yml`;
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

function runScript(workflow: string): string {
  const lines = workflow.split("\n");
  const runLine = lines.findIndex((line) => line.trim() === "- run: |");
  if (runLine === -1) throw new Error("workflow run block not found");

  const bodyIndentation =
    lines
      .slice(runLine + 1)
      .find((line) => line.trim() !== "")
      ?.match(/^\s*/)?.[0].length ?? 0;
  const body: string[] = [];
  for (const line of lines.slice(runLine + 1)) {
    if (line.trim() === "") {
      body.push("");
      continue;
    }
    if (!line.startsWith(" ".repeat(bodyIndentation))) break;
    body.push(line.slice(bodyIndentation));
  }
  return body.join("\n");
}

function usesPullRequestTarget(workflow: string): boolean {
  return /^  pull_request_target:\s*$/m.test(workflow);
}

async function executeWorkflow(
  workflow: string,
  diffMode: "matching" | "failure",
  viewMode: "available" | "failure" = "available"
): Promise<{ exitCode: number; calls: string; stderr: string }> {
  const directory = await mkdtemp(join(tmpdir(), "non-write-users-check-"));
  temporaryDirectories.push(directory);
  const fakeGitHub = join(directory, "gh");
  const callLog = join(directory, "calls.log");
  const shellScript = join(directory, "workflow.sh");

  await writeFile(
    fakeGitHub,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s %s %s %s %s\n' "$1" "$2" "\${3-}" "\${4-}" "\${5-}" >> "$GH_CALL_LOG"

case "$1 $2" in
  "pr diff")
    if [ "$GH_DIFF_MODE" = "failure" ]; then
      echo "failed to fetch pull request diff" >&2
      exit 1
    fi
    printf '%s\n' \\
      'diff --git a/.github/workflows/example.yml b/.github/workflows/example.yml' \\
      '--- a/.github/workflows/example.yml' \\
      '+++ b/.github/workflows/example.yml' \\
      '+          allowed_non_write_users: "*"'
    ;;
  "pr view")
    if [ "$GH_VIEW_MODE" = "failure" ]; then
      echo "failed to fetch pull request comments" >&2
      exit 1
    fi
    ;;
  "pr comment")
    if [ "$SIMULATED_GITHUB_TOKEN_WRITABLE" != "true" ]; then
      echo "GraphQL: Resource not accessible by integration" >&2
      exit 1
    fi
    ;;
  *)
    echo "unexpected gh invocation: $*" >&2
    exit 64
    ;;
esac
`
  );
  await chmod(fakeGitHub, 0o755);
  await writeFile(callLog, "");
  await writeFile(shellScript, runScript(workflow));

  const subprocess = Bun.spawn(
    ["bash", "--noprofile", "--norc", "-e", "-o", "pipefail", shellScript],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        GH_CALL_LOG: callLog,
        GH_DIFF_MODE: diffMode,
        GH_VIEW_MODE: viewMode,
        // A fork pull_request token is read-only; pull_request_target uses the
        // base repository context and retains the declared write permission.
        SIMULATED_GITHUB_TOKEN_WRITABLE: usesPullRequestTarget(workflow)
          ? "true"
          : "false",
        GH_TOKEN: "fixture-token",
        PR_NUMBER: "73",
        REPO: "acme/widgets",
      },
      stdout: "pipe",
      stderr: "pipe",
    }
  );
  const [exitCode, stderr] = await Promise.all([
    subprocess.exited,
    new Response(subprocess.stderr).text(),
  ]);
  return { exitCode, calls: await readFile(callLog, "utf8"), stderr };
}

describe("non-write users check workflow", () => {
  test("uses only the base workflow context and can comment on a fork pull request", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const result = await executeWorkflow(workflow, "matching");

    expect({
      pullRequestTarget: usesPullRequestTarget(workflow),
      pullRequest: /^  pull_request:\s*$/m.test(workflow),
      checkout: workflow.includes("actions/checkout"),
      untrustedHeadReference: workflow.includes("github.event.pull_request.head"),
      trustedNumber: workflow.includes(
        "PR_NUMBER: ${{ github.event.pull_request.number }}"
      ),
      trustedRepository: workflow.includes("REPO: ${{ github.repository }}"),
      exitCode: result.exitCode,
      stderr: result.stderr,
    }).toEqual({
      pullRequestTarget: true,
      pullRequest: false,
      checkout: false,
      untrustedHeadReference: false,
      trustedNumber: true,
      trustedRepository: true,
      exitCode: 0,
      stderr: "",
    });
    expect(result.calls).toContain("pr diff 73 -R acme/widgets\n");
    expect(result.calls).toContain("pr view 73 -R acme/widgets\n");
    expect(result.calls).toContain("pr comment 73 -R acme/widgets\n");
  });

  test("fails instead of treating an unavailable diff as no matching change", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const result = await executeWorkflow(workflow, "failure");

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("failed to fetch pull request diff");
    expect(result.calls).toBe("pr diff 73 -R acme/widgets\n");
  });

  test("fails instead of treating unavailable comments as no prior warning", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const result = await executeWorkflow(workflow, "matching", "failure");

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("failed to fetch pull request comments");
    expect(result.calls).toBe(
      "pr diff 73 -R acme/widgets\npr view 73 -R acme/widgets\n"
    );
  });
});
