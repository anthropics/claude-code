import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

async function runCommentScript(
  user: { type: string; login: string },
  duplicates = ["2"]
): Promise<{ exitCode: number; calls: string; stderr: string }> {
  const directory = await mkdtemp(join(tmpdir(), "duplicate-marker-test-"));
  temporaryDirectories.push(directory);
  const fakeGitHub = join(directory, "gh");
  const eventPath = join(directory, "event.json");
  const callLog = join(directory, "calls.log");

  await writeFile(
    fakeGitHub,
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "api" ]]; then
  printf '%s\n' "$GH_COMMENTS_JSON"
elif [[ "$1 $2" == "issue view" ]]; then
  exit 0
elif [[ "$1 $2" == "issue comment" ]]; then
  printf '%s\n' "$*" >> "$GH_CALL_LOG"
else
  exit 1
fi
`
  );
  await chmod(fakeGitHub, 0o755);
  await writeFile(eventPath, JSON.stringify({ inputs: { issue_number: "10" } }));
  await writeFile(callLog, "");

  const subprocess = Bun.spawn(
    [
      "bash",
      `${repositoryRoot}scripts/comment-on-duplicates.sh`,
      "--potential-duplicates",
      ...duplicates,
    ],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: "acme/widgets",
        GH_CALL_LOG: callLog,
        GH_COMMENTS_JSON: JSON.stringify([
          [
            {
              id: 1,
              body: "<!-- claude-dedupe-report -->",
              user,
            },
          ],
        ]),
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

describe("duplicate report marker trust", () => {
  test("rejects the base issue as its own duplicate", async () => {
    const result = await runCommentScript(
      { type: "User", login: "reporter" },
      ["010"]
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("cannot reference the base issue itself");
    expect(result.calls).toBe("");
  });

  test("rejects repeated duplicate issue numbers", async () => {
    const result = await runCommentScript(
      { type: "User", login: "reporter" },
      ["2", "02"]
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("duplicate issue number was repeated");
    expect(result.calls).toBe("");
  });

  test("does not let a user spoof the bot marker", async () => {
    const result = await runCommentScript({ type: "User", login: "attacker" });

    expect({ exitCode: result.exitCode, stderr: result.stderr }).toEqual({
      exitCode: 0,
      stderr: "",
    });
    expect(result.calls).toContain("issue comment 10");
  });

  test("keeps trusted bot reports idempotent", async () => {
    const result = await runCommentScript({
      type: "Bot",
      login: "github-actions[bot]",
    });

    expect({ exitCode: result.exitCode, stderr: result.stderr }).toEqual({
      exitCode: 0,
      stderr: "",
    });
    expect(result.calls).toBe("");
  });

  test("requires a trusted bot marker before logging dedupe success", async () => {
    const workflow = await readFile(
      `${repositoryRoot}.github/workflows/claude-dedupe-issues.yml`,
      "utf8"
    );

    expect(workflow).toContain('(.user.type == "Bot")');
    expect(workflow).toContain("(.user.login == $bot)");
  });
});
