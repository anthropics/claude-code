import { afterEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const servers: Bun.Server<unknown>[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
});

function json(value: unknown, init: ResponseInit = {}): Response {
  return Response.json(value, init);
}

function startServer(
  fetch: (request: Request) => Response | Promise<Response>
): Bun.Server<unknown> {
  const server = Bun.serve({ port: 0, fetch });
  servers.push(server);
  return server;
}

async function runScript(
  script: string,
  server: Bun.Server<unknown>,
  environment: Record<string, string>
): Promise<{ exitCode: number; stderr: string }> {
  const process = Bun.spawn(["bun", "run", script], {
    cwd: repositoryRoot,
    env: {
      ...globalThis.process.env,
      GITHUB_API_URL: server.url.toString().replace(/\/$/, ""),
      GITHUB_TOKEN: "test-token",
      ...environment,
    },
    stdout: "ignore",
    stderr: "pipe",
  });
  const [exitCode, stderr] = await Promise.all([
    process.exited,
    new Response(process.stderr).text(),
  ]);
  return { exitCode, stderr };
}

const dedupeBody = `Found 1 possible duplicate issue:

<!-- claude-dedupe-report -->
1. https://github.com/acme/widgets/issues/2

This issue will be automatically closed as a duplicate in 3 days.`;

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

describe("automation marker authorship", () => {
  test("auto-close does not let a user suppress the closing notice", async () => {
    let closingComments = 0;
    let closeAttempts = 0;
    let duplicateLabelAdded = false;
    let issueUpdatedAt = "2020-01-02T00:00:00Z";
    const markerAt = "2020-01-03T00:00:00Z";
    const labelAt = "2020-01-04T00:00:00Z";
    const comments = [
      {
        id: 1,
        body: "<!-- auto-close-duplicate:2 -->",
        created_at: "2020-01-01T12:00:00Z",
        user: { type: "User", login: "attacker" },
      },
      {
        id: 2,
        body: dedupeBody,
        created_at: "2020-01-02T00:00:00Z",
        user: { type: "Bot", login: "github-actions[bot]" },
      },
    ];
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              issues: {
                nodes: [
                  {
                    number: 10,
                    title: "duplicate",
                    createdAt: "2020-01-01T00:00:00Z",
                    author: { login: "reporter" },
                    comments: {
                      nodes: [
                        {
                          body: dedupeBody,
                          createdAt: "2020-01-02T00:00:00Z",
                          author: {
                            login: "github-actions[bot]",
                            __typename: "Bot",
                          },
                        },
                      ],
                    },
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }
      if (url.pathname.endsWith("/issues/10/events")) return json([]);
      if (url.pathname.endsWith("/issues/10/comments") && request.method === "GET") {
        return json(comments);
      }
      if (url.pathname.endsWith("/issues/comments/2/reactions")) return json([]);
      if (
        url.pathname.endsWith("/issues/10") &&
        request.method === "GET"
      ) {
        return json({
          state: "open",
          locked: false,
          updated_at: issueUpdatedAt,
          labels: duplicateLabelAdded ? [{ name: "duplicate" }] : [],
        });
      }
      if (url.pathname.endsWith("/labels")) {
        duplicateLabelAdded = true;
        issueUpdatedAt = labelAt;
        return json([{ name: "duplicate" }]);
      }
      if (url.pathname.endsWith("/issues/10/comments") && request.method === "POST") {
        closingComments += 1;
        const body = (await request.json()) as { body: string };
        issueUpdatedAt = markerAt;
        comments.push({
          id: 3,
          body: body.body,
          created_at: markerAt,
          user: { type: "Bot", login: "github-actions[bot]" },
        });
        return json({ id: 3 });
      }
      if (url.pathname.endsWith("/issues/10") && request.method === "PATCH") {
        closeAttempts += 1;
        return json({ state: "closed" });
      }
      return json({ message: "not found" }, { status: 404 });
    });

    const result = await runScript("scripts/auto-close-duplicates.ts", server, {
      GITHUB_REPOSITORY_OWNER: "acme",
      GITHUB_REPOSITORY_NAME: "widgets",
    });

    expect({ exitCode: result.exitCode, stderr: result.stderr }).toEqual({
      exitCode: 0,
      stderr: "",
    });
    expect(closingComments).toBe(1);
    expect(closeAttempts).toBe(1);
  });

  test("sweep does not let a different bot suppress the closing notice", async () => {
    let closingComments = 0;
    let closeAttempts = 0;
    const markerAt = "2020-01-03T00:00:00Z";
    const comments = [
      {
        body: "<!-- lifecycle-close:invalid -->",
        created_at: "2020-01-02T00:00:00Z",
        user: { type: "Bot", login: "untrusted[bot]" },
      },
    ];
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              issues: {
                nodes: [
                  {
                    number: 30,
                    title: "expired",
                    updatedAt: "2020-01-02T00:00:00Z",
                    locked: false,
                    assignees: { totalCount: 0 },
                    labels: {
                      nodes: [{ name: "invalid" }, { name: "stale" }],
                    },
                    reactionGroups: [],
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }
      if (url.pathname.endsWith("/issues/30/events")) {
        return json([
          {
            event: "labeled",
            label: { name: "invalid" },
            created_at: "2020-01-01T00:00:00Z",
          },
        ]);
      }
      if (url.pathname.endsWith("/issues/30/comments") && request.method === "GET") {
        return json(comments);
      }
      if (url.pathname.endsWith("/issues/30/comments") && request.method === "POST") {
        closingComments += 1;
        const body = (await request.json()) as { body: string };
        comments.push({
          body: body.body,
          created_at: markerAt,
          user: { type: "Bot", login: "github-actions[bot]" },
        });
        return json({ id: 1 });
      }
      if (url.pathname.endsWith("/issues/30") && request.method === "GET") {
        return json({
          state: "open",
          locked: false,
          updated_at: closingComments > 0
            ? markerAt
            : "2020-01-02T00:00:00Z",
          assignees: [],
          labels: [{ name: "invalid" }, { name: "stale" }],
          reactions: { "+1": 0 },
        });
      }
      if (url.pathname.endsWith("/issues/30") && request.method === "PATCH") {
        closeAttempts += 1;
        return json({ state: "closed" });
      }
      return json({ message: "not found" }, { status: 404 });
    });

    const result = await runScript("scripts/sweep.ts", server, {
      GITHUB_REPOSITORY_OWNER: "acme",
      GITHUB_REPOSITORY_NAME: "widgets",
    });

    expect({ exitCode: result.exitCode, stderr: result.stderr }).toEqual({
      exitCode: 0,
      stderr: "",
    });
    expect(closingComments).toBe(1);
    expect(closeAttempts).toBe(1);
  });

  test("lock workflow rejects user markers and keeps trusted markers idempotent", async () => {
    const workflow = await readFile(
      `${repositoryRoot}.github/workflows/lock-closed-issues.yml`,
      "utf8"
    );
    const script = workflowScript(workflow);
    const lockComments: number[] = [];
    const lockAttempts: number[] = [];
    const github = {
      graphql: async () => ({
        repository: {
          issues: {
            nodes: [
              {
                number: 40,
                title: "closed issue",
                updatedAt: "2020-01-01T00:00:00Z",
                locked: false,
              },
              {
                number: 41,
                title: "already notified closed issue",
                updatedAt: "2020-01-01T00:00:00Z",
                locked: false,
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      }),
      paginate: async (
        _method: unknown,
        options: { issue_number: number }
      ) => [
        {
          body: "<!-- automatic-lock-comment -->",
          user:
            options.issue_number === 40
              ? { type: "User", login: "attacker" }
              : { type: "Bot", login: "github-actions[bot]" },
        },
      ],
      rest: {
        issues: {
          listComments: async () => undefined,
          get: async () => ({
            data: {
              state: "closed",
              locked: false,
              updated_at: "2020-01-01T00:00:00Z",
            },
          }),
          createComment: async (options: { issue_number: number }) => {
            lockComments.push(options.issue_number);
          },
          lock: async (options: { issue_number: number }) => {
            lockAttempts.push(options.issue_number);
          },
        },
      },
    };
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

    await new AsyncFunction("github", "context", script)(github, {
      repo: { owner: "acme", repo: "widgets" },
    });

    expect(lockComments).toEqual([40]);
    expect(lockAttempts).toEqual([40, 41]);
  });
});
