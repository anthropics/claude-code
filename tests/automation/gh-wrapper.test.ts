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

async function runGitHubWrapper(args: string[]): Promise<{
  exitCode: number;
  calls: string;
  stderr: string;
}> {
  const directory = await mkdtemp(join(tmpdir(), "gh-wrapper-test-"));
  temporaryDirectories.push(directory);
  const fakeGitHub = join(directory, "gh");
  const callLog = join(directory, "calls.log");

  await writeFile(
    fakeGitHub,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$GH_CALL_LOG"
`
  );
  await chmod(fakeGitHub, 0o755);
  await writeFile(callLog, "");

  const subprocess = Bun.spawn(
    ["bash", `${repositoryRoot}scripts/gh.sh`, ...args],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        GH_REPO: "acme/widgets",
        GH_CALL_LOG: callLog,
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

describe("gh wrapper search query contract", () => {
  test("requires exactly one non-empty search query before invoking gh", async () => {
    for (const args of [
      ["search", "issues", "--limit", "1"],
      ["search", "issues", "", "--limit", "1"],
      ["search", "issues", "   ", "--limit", "1"],
      ["search", "issues", "first", "second", "--limit", "1"],
    ]) {
      const result = await runGitHubWrapper(args);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        "search issues requires exactly one non-empty query"
      );
      expect(result.calls).toBe("");
    }
  });

  test("passes one valid query to the repository-scoped gh command", async () => {
    const result = await runGitHubWrapper([
      "search",
      "issues",
      "parser crash",
      "--limit",
      "1",
    ]);

    expect({ exitCode: result.exitCode, stderr: result.stderr }).toEqual({
      exitCode: 0,
      stderr: "",
    });
    expect(result.calls).toBe(
      "search issues parser crash --repo acme/widgets --limit 1\n"
    );
  });
});
