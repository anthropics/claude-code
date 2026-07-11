import { afterEach, describe, expect, test } from "bun:test";
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
  environment: Record<string, string> = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const process = Bun.spawn(["bun", "run", script], {
    cwd: repositoryRoot,
    env: {
      ...globalThis.process.env,
      GITHUB_API_URL: server.url.toString().replace(/\/$/, ""),
      GITHUB_TOKEN: "test-token",
      ...environment,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

const dedupeBody = (target: number) => `Found 1 possible duplicate issue:

<!-- claude-dedupe-report -->
1. https://github.com/acme/widgets/issues/${target}

This issue will be automatically closed as a duplicate in 3 days.`;

describe("GitHub automation integration", () => {
  test("auto-close uses GraphQL cursors and preserves existing labels", async () => {
    const requests: Array<{ method: string; path: string; body?: unknown }> = [];
    const cursors: unknown[] = [];
    const reportAt = "2020-01-02T00:00:00Z";
    const markerAt = "2020-01-03T00:00:00Z";
    const labelAt = "2020-01-04T00:00:00Z";
    let issueUpdatedAt = reportAt;
    let duplicateLabelAdded = false;
    const issueComments: any[] = [
      {
        id: 100,
        body: dedupeBody(2),
        created_at: reportAt,
        user: { type: "Bot", login: "github-actions[bot]" },
      },
    ];
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/events")) return json([]);
      const body = request.method === "GET" ? undefined : await request.json();
      requests.push({ method: request.method, path: url.pathname, body });

      if (url.pathname === "/graphql") {
        const cursor = (body as any).variables.cursor;
        cursors.push(cursor);
        return json({
          data: {
            repository: {
              issues: {
                nodes:
                  cursor === null
                    ? [
                        {
                          number: 10,
                          title: "duplicate",
                          createdAt: "2020-01-01T00:00:00Z",
                          author: { login: "reporter" },
                          comments: {
                            nodes: [
                              {
                                body: dedupeBody(2),
                                createdAt: "2020-01-02T00:00:00Z",
                                author: {
                                  login: "github-actions[bot]",
                                  __typename: "Bot",
                                },
                              },
                            ],
                          },
                        },
                      ]
                    : [
                        {
                          number: 11,
                          title: "disputed duplicate",
                          createdAt: "2020-01-01T00:00:00Z",
                          author: { login: "second-reporter" },
                          comments: {
                            nodes: [
                              {
                                body: dedupeBody(3),
                                createdAt: "2020-01-02T00:00:00Z",
                                author: {
                                  login: "github-actions[bot]",
                                  __typename: "Bot",
                                },
                              },
                            ],
                          },
                        },
                        {
                          number: 12,
                          title: "untrusted bot",
                          createdAt: "2020-01-01T00:00:00Z",
                          author: { login: "third-reporter" },
                          comments: {
                            nodes: [
                              {
                                body: dedupeBody(4),
                                createdAt: "2020-01-02T00:00:00Z",
                                author: {
                                  login: "untrusted[bot]",
                                  __typename: "Bot",
                                },
                              },
                            ],
                          },
                        },
                        {
                          number: 13,
                          title: "spoofed retry marker",
                          createdAt: "2020-01-01T00:00:00Z",
                          author: { login: "fourth-reporter" },
                          comments: {
                            nodes: [
                              {
                                body: "<!-- auto-close-duplicate:4 -->",
                                createdAt: "2020-01-03T00:00:00Z",
                                author: {
                                  login: "fourth-reporter",
                                  __typename: "User",
                                },
                              },
                            ],
                          },
                        },
                      ],
                pageInfo:
                  cursor === null
                    ? { hasNextPage: true, endCursor: "cursor-1" }
                    : { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }
      if (url.pathname === "/repos/acme/widgets/issues/10/comments" && request.method === "GET") {
        return json(issueComments);
      }
      if (url.pathname === "/repos/acme/widgets/issues/11/comments" && request.method === "GET") {
        if (url.searchParams.get("page") === "1") {
          return json([
            ...Array.from({ length: 99 }, (_, id) => ({
              id: 200 + id,
              body: "older activity",
              created_at: "2019-01-01T00:00:00Z",
              user: { type: "User", login: `older-${id}` },
            })),
            {
              id: 300,
              body: dedupeBody(3),
              created_at: "2020-01-02T00:00:00Z",
              user: { type: "Bot", login: "github-actions[bot]" },
            },
          ]);
        }
        return json([]);
      }
      if (url.pathname === "/repos/acme/widgets/issues/comments/100/reactions") {
        return json([]);
      }
      if (url.pathname === "/repos/acme/widgets/issues/comments/300/reactions") {
        if (url.searchParams.get("page") === "1") {
          return json(Array.from({ length: 100 }, (_, id) => ({
            user: { login: `other-${id}` },
            content: "+1",
          })), {
            headers: {
              link: `<${url.origin}${url.pathname}?per_page=100&page=2>; rel="next"`,
            },
          });
        }
        return json([{ user: { login: "second-reporter" }, content: "-1" }]);
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/10" &&
        request.method === "GET"
      ) {
        return json({
          state: "open",
          locked: false,
          updated_at: issueUpdatedAt,
          labels: duplicateLabelAdded
            ? [{ name: "bug" }, { name: "duplicate" }]
            : [{ name: "bug" }],
        });
      }
      if (url.pathname.endsWith("/labels")) {
        duplicateLabelAdded = true;
        issueUpdatedAt = labelAt;
        return json([{ name: "bug" }, { name: "duplicate" }]);
      }
      if (url.pathname.endsWith("/comments")) {
        issueUpdatedAt = markerAt;
        issueComments.push({
          id: 101,
          body: (body as { body: string }).body,
          created_at: markerAt,
          user: { type: "Bot", login: "github-actions[bot]" },
        });
        return json({ id: 101 });
      }
      if (url.pathname === "/repos/acme/widgets/issues/10" && request.method === "PATCH") {
        return json({ state: "closed" });
      }
      return json({ message: "not found" }, { status: 404 });
    });

    const result = await runScript("scripts/auto-close-duplicates.ts", server, {
      GITHUB_REPOSITORY_OWNER: "acme",
      GITHUB_REPOSITORY_NAME: "widgets",
    });

    expect(result.exitCode).toBe(0);
    expect(cursors).toEqual([null, "cursor-1"]);
    expect(
      requests.find((entry) => entry.path.endsWith("/labels"))?.body
    ).toEqual({ labels: ["duplicate"] });
    expect(
      requests.find(
        (entry) => entry.path === "/repos/acme/widgets/issues/10" && entry.method === "PATCH"
      )?.body
    ).toEqual({ state: "closed", state_reason: "duplicate" });
    expect(
      requests.some(
        (entry) => entry.path === "/repos/acme/widgets/issues/11" && entry.method === "PATCH"
      )
    ).toBe(false);
    expect(
      requests.some((entry) => entry.path.includes("/issues/12/"))
    ).toBe(false);
    expect(
      requests.some((entry) => entry.path.includes("/issues/13/"))
    ).toBe(false);
  });

  test("auto-close preserves a human comment created in the same second as the dedupe report", async () => {
    const sameSecond = "2020-01-02T00:00:00Z";
    let closeAttempts = 0;
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
                    title: "same-second human response",
                    createdAt: "2020-01-01T00:00:00Z",
                    author: { login: "reporter" },
                    comments: {
                      nodes: [
                        {
                          body: dedupeBody(2),
                          createdAt: sameSecond,
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
      if (url.pathname.endsWith("/issues/10/comments") && request.method === "GET") {
        return json([
          {
            id: 100,
            body: dedupeBody(2),
            created_at: sameSecond,
            user: { type: "Bot", login: "github-actions[bot]" },
          },
          {
            id: 101,
            body: "This is not a duplicate; the reproduction is different.",
            created_at: sameSecond,
            user: { type: "User", login: "reporter" },
          },
        ]);
      }
      if (url.pathname.endsWith("/issues/comments/100/reactions")) return json([]);
      if (url.pathname.endsWith("/labels")) return json([]);
      if (url.pathname.endsWith("/issues/10/comments") && request.method === "POST") {
        return json({ id: 102 });
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

    expect(result.exitCode).toBe(0);
    expect(closeAttempts).toBe(0);
  });

  test("auto-close revalidates same-second human activity after fetching reactions", async () => {
    const sameSecond = "2020-01-02T00:00:00Z";
    let commentReads = 0;
    let reactionReads = 0;
    const mutations: string[] = [];
    const report = {
      id: 140,
      body: dedupeBody(2),
      created_at: sameSecond,
      user: { type: "Bot", login: "github-actions[bot]" },
    };
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/events")) return json([]);
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              issues: {
                nodes: [
                  {
                    number: 14,
                    title: "human response during auto-close",
                    createdAt: "2020-01-01T00:00:00Z",
                    author: { login: "reporter" },
                    comments: {
                      nodes: [
                        {
                          body: dedupeBody(2),
                          createdAt: sameSecond,
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
      if (
        url.pathname === "/repos/acme/widgets/issues/14/comments" &&
        request.method === "GET"
      ) {
        commentReads += 1;
        return json(
          commentReads === 1
            ? [report]
            : [
                report,
                {
                  id: 141,
                  body: "This has a different reproduction.",
                  created_at: sameSecond,
                  user: { type: "User", login: "reporter" },
                },
              ]
        );
      }
      if (url.pathname === "/repos/acme/widgets/issues/comments/140/reactions") {
        reactionReads += 1;
        return json([]);
      }
      if (url.pathname === "/repos/acme/widgets/issues/14") {
        if (request.method === "GET") {
          return json({ state: "open", locked: false, updated_at: sameSecond });
        }
        mutations.push(request.method);
        return json({ state: "closed" });
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/14/labels" ||
        (url.pathname === "/repos/acme/widgets/issues/14/comments" &&
          request.method === "POST")
      ) {
        mutations.push(request.method);
        return json({});
      }
      return json({ message: "not found" }, { status: 404 });
    });

    const result = await runScript("scripts/auto-close-duplicates.ts", server, {
      GITHUB_REPOSITORY_OWNER: "acme",
      GITHUB_REPOSITORY_NAME: "widgets",
    });

    expect(result.exitCode).toBe(0);
    expect(commentReads).toBe(2);
    expect(reactionReads).toBe(1);
    expect(mutations).toEqual([]);
  });

  test("auto-close stops when a human comments after the closing marker is posted", async () => {
    const reportAt = "2020-01-02T00:00:00Z";
    const markerAt = "2020-01-03T00:00:00Z";
    const humanAt = "2020-01-03T00:00:01Z";
    let markerAttempts = 0;
    let labelAttempts = 0;
    let closeAttempts = 0;
    const comments: any[] = [
      {
        id: 150,
        body: dedupeBody(2),
        created_at: reportAt,
        user: { type: "Bot", login: "github-actions[bot]" },
      },
    ];
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/events")) return json([]);
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              issues: {
                nodes: [
                  {
                    number: 16,
                    title: "human response after marker",
                    createdAt: "2020-01-01T00:00:00Z",
                    author: { login: "reporter" },
                    comments: {
                      nodes: [
                        {
                          body: dedupeBody(2),
                          createdAt: reportAt,
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
      if (
        url.pathname === "/repos/acme/widgets/issues/16/comments" &&
        request.method === "GET"
      ) {
        return json(comments);
      }
      if (url.pathname === "/repos/acme/widgets/issues/comments/150/reactions") {
        return json([]);
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/16" &&
        request.method === "GET"
      ) {
        return json({
          state: "open",
          locked: false,
          updated_at: comments.at(-1)?.created_at ?? reportAt,
          labels: [],
        });
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/16/comments" &&
        request.method === "POST"
      ) {
        markerAttempts += 1;
        const body = (await request.json()) as { body: string };
        comments.push(
          {
            id: 151,
            body: body.body,
            created_at: markerAt,
            user: { type: "Bot", login: "github-actions[bot]" },
          },
          {
            id: 152,
            body: "This report is not a duplicate.",
            created_at: humanAt,
            user: { type: "User", login: "reporter" },
          }
        );
        return json({ id: 151 });
      }
      if (url.pathname === "/repos/acme/widgets/issues/16/labels") {
        labelAttempts += 1;
        return json([{ name: "duplicate" }]);
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/16" &&
        request.method === "PATCH"
      ) {
        closeAttempts += 1;
        return json({ state: "closed" });
      }
      return json({ message: "not found" }, { status: 404 });
    });

    const result = await runScript("scripts/auto-close-duplicates.ts", server, {
      GITHUB_REPOSITORY_OWNER: "acme",
      GITHUB_REPOSITORY_NAME: "widgets",
    });

    expect(result.exitCode).toBe(0);
    expect(markerAttempts).toBe(1);
    expect(labelAttempts).toBe(0);
    expect(closeAttempts).toBe(0);
  });

  test("auto-close rechecks author disagreement immediately before closing", async () => {
    const reportAt = "2020-01-02T00:00:00Z";
    const markerAt = "2020-01-03T00:00:00Z";
    let reactionReads = 0;
    let closeAttempts = 0;
    const comments = [
      {
        id: 160,
        body: dedupeBody(2),
        created_at: reportAt,
        user: { type: "Bot", login: "github-actions[bot]" },
      },
      {
        id: 161,
        body: "<!-- auto-close-duplicate:2 -->\nClosing duplicate.",
        created_at: markerAt,
        user: { type: "Bot", login: "github-actions[bot]" },
      },
    ];
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/events")) return json([]);
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              issues: {
                nodes: [
                  {
                    number: 17,
                    title: "late reaction",
                    createdAt: "2020-01-01T00:00:00Z",
                    author: { login: "reporter" },
                    comments: {
                      nodes: [
                        {
                          body: comments[1].body,
                          createdAt: markerAt,
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
      if (
        url.pathname === "/repos/acme/widgets/issues/17/comments" &&
        request.method === "GET"
      ) {
        return json(comments);
      }
      if (url.pathname === "/repos/acme/widgets/issues/comments/160/reactions") {
        reactionReads += 1;
        return json(
          reactionReads === 1
            ? []
            : [{ content: "-1", user: { login: "reporter" } }]
        );
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/17" &&
        request.method === "GET"
      ) {
        return json({
          state: "open",
          locked: false,
          updated_at: markerAt,
          labels: [{ name: "duplicate" }],
        });
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/17" &&
        request.method === "PATCH"
      ) {
        closeAttempts += 1;
        return json({ state: "closed" });
      }
      return json({ message: "not found" }, { status: 404 });
    });

    const result = await runScript("scripts/auto-close-duplicates.ts", server, {
      GITHUB_REPOSITORY_OWNER: "acme",
      GITHUB_REPOSITORY_NAME: "widgets",
    });

    expect(result.exitCode).toBe(0);
    expect(reactionReads).toBe(2);
    expect(closeAttempts).toBe(0);
  });

  test("auto-close stops when metadata changes after its marker", async () => {
    const reportAt = "2020-01-02T00:00:00Z";
    const markerAt = "2020-01-03T00:00:00Z";
    const comments = new Map(
      [18, 19, 20].map((number) => [
        number,
        [
          {
            id: number * 10,
            body: dedupeBody(2),
            created_at: reportAt,
            user: { type: "Bot", login: "github-actions[bot]" },
          },
        ] as any[],
      ])
    );
    const markerPosted = new Set<number>();
    const labelAttempts: number[] = [];
    const closeAttempts: number[] = [];
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/events")) return json([]);
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              issues: {
                nodes: [18, 19, 20].map((number) => ({
                  number,
                  title: `metadata race ${number}`,
                  createdAt: "2020-01-01T00:00:00Z",
                  author: { login: "reporter" },
                  comments: {
                    nodes: [
                      {
                        body: dedupeBody(2),
                        createdAt: reportAt,
                        author: {
                          login: "github-actions[bot]",
                          __typename: "Bot",
                        },
                      },
                    ],
                  },
                })),
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }
      const commentsMatch = url.pathname.match(
        /\/repos\/acme\/widgets\/issues\/(18|19|20)\/comments$/
      );
      if (commentsMatch && request.method === "GET") {
        return json(comments.get(Number(commentsMatch[1])) ?? []);
      }
      const reactionsMatch = url.pathname.match(
        /\/repos\/acme\/widgets\/issues\/comments\/(180|190|200)\/reactions$/
      );
      if (reactionsMatch) return json([]);

      const issueMatch = url.pathname.match(
        /\/repos\/acme\/widgets\/issues\/(18|19|20)$/
      );
      if (issueMatch && request.method === "GET") {
        const number = Number(issueMatch[1]);
        return json({
          title: `metadata race ${number}`,
          body:
            number === 20 && markerPosted.has(number)
              ? "human-edited reproduction details"
              : "original reproduction details",
          state: "open",
          locked: false,
          updated_at: markerPosted.has(number) ? markerAt : reportAt,
          labels:
            number === 18 && markerPosted.has(number)
              ? [{ name: "bug" }, { name: "security" }]
              : [{ name: "bug" }],
          assignees:
            number === 19 && markerPosted.has(number)
              ? [{ login: "maintainer" }]
              : [],
        });
      }
      if (commentsMatch && request.method === "POST") {
        const number = Number(commentsMatch[1]);
        markerPosted.add(number);
        const body = (await request.json()) as { body: string };
        comments.get(number)?.push({
          id: number * 10 + 1,
          body: body.body,
          created_at: markerAt,
          user: { type: "Bot", login: "github-actions[bot]" },
        });
        return json({ id: number * 10 + 1 });
      }
      const labelsMatch = url.pathname.match(
        /\/repos\/acme\/widgets\/issues\/(18|19|20)\/labels$/
      );
      if (labelsMatch) {
        labelAttempts.push(Number(labelsMatch[1]));
        return json([{ name: "duplicate" }]);
      }
      if (issueMatch && request.method === "PATCH") {
        closeAttempts.push(Number(issueMatch[1]));
        return json({ state: "closed" });
      }
      return json({ message: "not found" }, { status: 404 });
    });

    const result = await runScript("scripts/auto-close-duplicates.ts", server, {
      GITHUB_REPOSITORY_OWNER: "acme",
      GITHUB_REPOSITORY_NAME: "widgets",
    });

    expect(result.exitCode).toBe(0);
    expect([...markerPosted]).toEqual([18, 19, 20]);
    expect(labelAttempts).toEqual([]);
    expect(closeAttempts).toEqual([]);
  });

  test("auto-close retries when creating the marker fails before any later mutation", async () => {
    let commentAttempts = 0;
    let labelAttempts = 0;
    let closeAttempts = 0;
    let issueUpdatedAt = "2020-01-02T00:00:00Z";
    const comments: any[] = [
      {
        id: 100,
        body: dedupeBody(2),
        created_at: issueUpdatedAt,
        user: { type: "Bot", login: "github-actions[bot]" },
      },
    ];
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/events")) return json([]);
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              issues: {
                nodes: [
                  {
                    number: 15,
                    title: "partial duplicate close",
                    createdAt: "2020-01-01T00:00:00Z",
                    author: { login: "reporter" },
                    comments: {
                      nodes: [
                        {
                          body:
                            comments.length === 1
                              ? dedupeBody(2)
                              : "<!-- auto-close-duplicate:2 -->",
                          createdAt: comments.at(-1).created_at,
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
      if (
        url.pathname === "/repos/acme/widgets/issues/15/comments" &&
        request.method === "GET"
      ) {
        return json(comments);
      }
      if (url.pathname === "/repos/acme/widgets/issues/comments/100/reactions") {
        return json([]);
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/15" &&
        request.method === "GET"
      ) {
        return json({
          state: "open",
          locked: false,
          updated_at: issueUpdatedAt,
        });
      }
      if (url.pathname.endsWith("/issues/15/labels")) {
        labelAttempts += 1;
        issueUpdatedAt = "2020-01-03T00:00:00Z";
        return json([{ name: "duplicate" }]);
      }
      if (
        url.pathname.endsWith("/issues/15/comments") &&
        request.method === "POST"
      ) {
        commentAttempts += 1;
        if (commentAttempts === 1) {
          return json({ message: "temporary comment failure" }, { status: 500 });
        }
        const body = (await request.json()) as { body: string };
        issueUpdatedAt = "2020-01-04T00:00:00Z";
        comments.push({
          id: 101,
          body: body.body,
          created_at: issueUpdatedAt,
          user: { type: "Bot", login: "github-actions[bot]" },
        });
        return json({ id: 101 });
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/15" &&
        request.method === "PATCH"
      ) {
        closeAttempts += 1;
        return json({ state: "closed" });
      }
      return json({ message: "not found" }, { status: 404 });
    });
    const env = {
      GITHUB_REPOSITORY_OWNER: "acme",
      GITHUB_REPOSITORY_NAME: "widgets",
    };

    expect((await runScript("scripts/auto-close-duplicates.ts", server, env)).exitCode).toBe(1);
    expect((await runScript("scripts/auto-close-duplicates.ts", server, env)).exitCode).toBe(0);
    expect({ commentAttempts, labelAttempts, closeAttempts }).toEqual({
      commentAttempts: 2,
      labelAttempts: 1,
      closeAttempts: 1,
    });
  });

  test("auto-close returns non-zero and retries a partial close without duplicate comments", async () => {
    let closeAttempts = 0;
    let closingComments = 0;
    let duplicateLabel = false;
    let issueUpdatedAt = "2020-01-02T00:00:00Z";
    const comments: any[] = [
      {
        id: 100,
        body: dedupeBody(2),
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
                          body:
                            closingComments === 0
                              ? dedupeBody(2)
                              : "<!-- auto-close-duplicate:2 -->",
                          createdAt: "2020-01-03T00:00:00Z",
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
      if (url.pathname.endsWith("/issues/10/comments") && request.method === "GET") {
        return json(comments);
      }
      if (url.pathname.endsWith("/comments/100/reactions")) return json([]);
      if (
        url.pathname.endsWith("/issues/10") &&
        request.method === "GET"
      ) {
        return json({
          state: "open",
          locked: false,
          updated_at: issueUpdatedAt,
          labels: duplicateLabel ? [{ name: "duplicate" }] : [],
        });
      }
      if (url.pathname.endsWith("/issues/10/events")) {
        return json([
          {
            event: "labeled",
            created_at: "2020-01-04T00:00:00Z",
            actor: { type: "Bot", login: "github-actions[bot]" },
            label: { name: "duplicate" },
          },
        ]);
      }
      if (url.pathname.endsWith("/labels")) {
        duplicateLabel = true;
        issueUpdatedAt = "2020-01-04T00:00:00Z";
        return json([{ name: "duplicate" }]);
      }
      if (url.pathname.endsWith("/issues/10/comments") && request.method === "POST") {
        closingComments += 1;
        const body = (await request.json()) as { body: string };
        issueUpdatedAt = "2020-01-03T00:00:00Z";
        comments.push({
          id: 101,
          body: body.body,
          created_at: issueUpdatedAt,
          user: { type: "Bot", login: "github-actions[bot]" },
        });
        return json({ id: 101 });
      }
      if (url.pathname.endsWith("/issues/10") && request.method === "PATCH") {
        closeAttempts += 1;
        return closeAttempts === 1
          ? json({ message: "failure" }, { status: 500 })
          : json({ state: "closed" });
      }
      return json({ message: "not found" }, { status: 404 });
    });
    const env = {
      GITHUB_REPOSITORY_OWNER: "acme",
      GITHUB_REPOSITORY_NAME: "widgets",
    };

    expect((await runScript("scripts/auto-close-duplicates.ts", server, env)).exitCode).toBe(1);
    expect((await runScript("scripts/auto-close-duplicates.ts", server, env)).exitCode).toBe(0);
    expect(closingComments).toBe(1);
    expect(closeAttempts).toBe(2);
  });

  test("backfill honors repository, range, date and paginated comments, and accepts 204", async () => {
    const dispatches: unknown[] = [];
    const cursors: unknown[] = [];
    const recentCreatedAt = new Date(Date.now() - 86_400_000).toISOString();
    const untrustedComments = Array.from({ length: 100 }, (_, id) => ({
      id,
      body: "ordinary comment",
      user: { type: "User", login: `user-${id}` },
    }));
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/graphql") {
        const body = (await request.json()) as any;
        const cursor = body.variables.cursor;
        cursors.push(cursor);
        return json({
          data: {
            repository: {
              issues: {
                nodes:
                  cursor === null
                    ? [
                        {
                          number: 5,
                          title: "has comment",
                          createdAt: recentCreatedAt,
                          comments: {
                            totalCount: 101,
                            nodes: [
                              {
                                body: "latest ordinary comment",
                                user: { login: "user", __typename: "User" },
                              },
                            ],
                          },
                        },
                      ]
                    : [
                        {
                          number: 6,
                          title: "dispatch",
                          createdAt: recentCreatedAt,
                          comments: { totalCount: 0, nodes: [] },
                        },
                      ],
                pageInfo:
                  cursor === null
                    ? { hasNextPage: true, endCursor: "next" }
                    : { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }
      if (url.pathname.endsWith("/issues/5/comments")) {
        return url.searchParams.get("page") === "1"
          ? json([
              {
                body: dedupeBody(2),
                user: { type: "Bot", login: "github-actions[bot]" },
              },
              ...untrustedComments.slice(0, 99),
            ])
          : json([
              {
                body: "latest ordinary comment",
                user: { type: "User", login: "user" },
              },
            ]);
      }
      if (url.pathname.endsWith("/issues/6/comments")) return json([]);
      if (url.pathname.endsWith("/dispatches")) {
        dispatches.push(await request.json());
        return new Response(null, { status: 204 });
      }
      return json({ message: "not found" }, { status: 404 });
    });

    const result = await runScript("scripts/backfill-duplicate-comments.ts", server, {
      GITHUB_REPOSITORY: "acme/widgets",
      GITHUB_DEFAULT_BRANCH: "trunk",
      DAYS_BACK: "30",
      MIN_ISSUE_NUMBER: "5",
      MAX_ISSUE_NUMBER: "6",
      DISPATCH_DELAY_MS: "0",
      DRY_RUN: "false",
    });

    expect(result.exitCode).toBe(0);
    expect(cursors).toEqual([null, "next"]);
    expect(dispatches).toEqual([
      { ref: "trunk", inputs: { issue_number: "6" } },
    ]);
  });

  test("backfill has no issue-number ceiling when the maximum is omitted", async () => {
    const dispatches: unknown[] = [];
    const recentCreatedAt = new Date(Date.now() - 86_400_000).toISOString();
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              issues: {
                nodes: [
                  {
                    number: 5001,
                    title: "newer than the former ceiling",
                    createdAt: recentCreatedAt,
                    comments: { totalCount: 0, nodes: [] },
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }
      if (url.pathname.endsWith("/dispatches")) {
        dispatches.push(await request.json());
        return new Response(null, { status: 204 });
      }
      return json({ message: "not found" }, { status: 404 });
    });

    const result = await runScript("scripts/backfill-duplicate-comments.ts", server, {
      GITHUB_REPOSITORY: "acme/widgets",
      GITHUB_DEFAULT_BRANCH: "trunk",
      MAX_ISSUE_NUMBER: "",
      DISPATCH_DELAY_MS: "0",
      DRY_RUN: "false",
    });

    expect(result.exitCode).toBe(0);
    expect(dispatches).toEqual([
      { ref: "trunk", inputs: { issue_number: "5001" } },
    ]);
  });

  test("backfill does not add a one-second delay to every dispatch by default", async () => {
    const dispatches: unknown[] = [];
    const recentCreatedAt = new Date(Date.now() - 86_400_000).toISOString();
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              issues: {
                nodes: [92, 93].map((number) => ({
                  number,
                  title: `candidate ${number}`,
                  createdAt: recentCreatedAt,
                  comments: { totalCount: 0, nodes: [] },
                })),
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }
      if (url.pathname.endsWith("/dispatches")) {
        dispatches.push(await request.json());
        return new Response(null, { status: 204 });
      }
      return json({ message: "not found" }, { status: 404 });
    });

    const startedAt = performance.now();
    const result = await runScript("scripts/backfill-duplicate-comments.ts", server, {
      GITHUB_REPOSITORY: "acme/widgets",
      GITHUB_DEFAULT_BRANCH: "trunk",
      DRY_RUN: "false",
    });
    const elapsedMs = performance.now() - startedAt;

    expect({ exitCode: result.exitCode, stderr: result.stderr }).toEqual({
      exitCode: 0,
      stderr: "",
    });
    expect(dispatches).toHaveLength(2);
    expect(elapsedMs).toBeLessThan(1_500);
  });

  test("backfill asks GitHub for open issues and never dispatches a closed fixture", async () => {
    const dispatches: unknown[] = [];
    const queries: string[] = [];
    const recentCreatedAt = new Date(Date.now() - 86_400_000).toISOString();
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/graphql") {
        const body = (await request.json()) as { query: string };
        queries.push(body.query);
        const nodes = [
          {
            number: 90,
            title: "open candidate",
            createdAt: recentCreatedAt,
            comments: { totalCount: 0, nodes: [] },
          },
        ];
        // GitHub returns this fixture only when the query includes CLOSED.
        // This makes the test exercise the query contract rather than trusting
        // a state field that the script never requests.
        if (/states\s*:\s*\[[^\]]*CLOSED/.test(body.query)) {
          nodes.push({
            number: 91,
            title: "closed candidate",
            createdAt: recentCreatedAt,
            comments: { totalCount: 0, nodes: [] },
          });
        }
        return json({
          data: {
            repository: {
              issues: {
                nodes,
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }
      if (url.pathname.endsWith("/dispatches")) {
        dispatches.push(await request.json());
        return new Response(null, { status: 204 });
      }
      return json({ message: "not found" }, { status: 404 });
    });

    const result = await runScript("scripts/backfill-duplicate-comments.ts", server, {
      GITHUB_REPOSITORY: "acme/widgets",
      GITHUB_DEFAULT_BRANCH: "trunk",
      DISPATCH_DELAY_MS: "0",
      DRY_RUN: "false",
    });

    expect({ exitCode: result.exitCode, stderr: result.stderr }).toEqual({
      exitCode: 0,
      stderr: "",
    });
    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatch(/states\s*:\s*OPEN/);
    expect(dispatches).toEqual([
      { ref: "trunk", inputs: { issue_number: "90" } },
    ]);
  });

  test("sweep revalidates every stale condition immediately before labeling", async () => {
    const refreshed: number[] = [];
    const staleMutations: number[] = [];
    const staleLabels = new Set<number>();
    const recentUpdatedAt = new Date().toISOString();
    const candidates = [80, 81, 82, 83, 84, 85, 86];
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              issues: {
                nodes: candidates.map((number) => ({
                  number,
                  title: `candidate ${number}`,
                  updatedAt: "2020-01-01T00:00:00Z",
                  locked: false,
                  assignees: { totalCount: 0 },
                  labels: { nodes: [] },
                  reactionGroups: [],
                })),
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }

      const issueMatch = url.pathname.match(/\/issues\/(\d+)$/);
      if (issueMatch && request.method === "GET") {
        const number = Number(issueMatch[1]);
        refreshed.push(number);
        return json({
          state: number === 81 ? "closed" : "open",
          locked: number === 82,
          updated_at: number === 80 ? recentUpdatedAt : "2020-01-01T00:00:00Z",
          assignees: number === 83 ? [{ login: "maintainer" }] : [],
          labels:
            number === 84 || staleLabels.has(number)
              ? [{ name: "stale" }]
              : [],
          reactions: { "+1": number === 85 ? 10 : 0 },
        });
      }

      if (
        url.pathname === "/repos/acme/widgets/issues/86/comments" &&
        request.method === "GET"
      ) {
        return json([]);
      }

      const labelsMatch = url.pathname.match(/\/issues\/(\d+)\/labels$/);
      if (labelsMatch && request.method === "POST") {
        const number = Number(labelsMatch[1]);
        staleMutations.push(number);
        staleLabels.add(number);
        return json([{ name: "stale" }]);
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
    expect(refreshed).toEqual([...candidates, 86, 86]);
    expect(staleMutations).toEqual([86]);
  });

  test("sweep removes only its stale label when a human comments during labeling", async () => {
    let staleIsPresent = false;
    let humanCommentArrived = false;
    let staleAdds = 0;
    let staleRemovals = 0;
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              issues: {
                nodes: [
                  {
                    number: 107,
                    title: "human response during stale labeling",
                    updatedAt: "2020-01-01T00:00:00Z",
                    locked: false,
                    assignees: { totalCount: 0 },
                    labels: { nodes: [] },
                    reactionGroups: [],
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/107/comments" &&
        request.method === "GET"
      ) {
        return json(
          humanCommentArrived
            ? [
                {
                  id: 1070,
                  body: "Here is the requested reproduction.",
                  created_at: new Date().toISOString(),
                  user: { type: "User", login: "reporter" },
                },
              ]
            : []
        );
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/107" &&
        request.method === "GET"
      ) {
        return json({
          state: "open",
          locked: false,
          updated_at: humanCommentArrived
            ? new Date().toISOString()
            : "2020-01-01T00:00:00Z",
          assignees: [],
          labels: staleIsPresent ? [{ name: "stale" }] : [],
          reactions: { "+1": 0 },
        });
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/107/labels" &&
        request.method === "POST"
      ) {
        staleAdds += 1;
        humanCommentArrived = true;
        staleIsPresent = true;
        return json([{ name: "stale" }]);
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/107/labels/stale" &&
        request.method === "DELETE"
      ) {
        staleRemovals += 1;
        staleIsPresent = false;
        return new Response(null, { status: 204 });
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
    expect({ staleAdds, staleRemovals, staleIsPresent }).toEqual({
      staleAdds: 1,
      staleRemovals: 1,
      staleIsPresent: false,
    });
  });

  test("sweep restarts needs-info inactivity at human activity without removing the label", async () => {
    const closedIssues: number[] = [];
    const labelMutations: number[] = [];
    const recentCommentAt = new Date(Date.now() - 86_400_000).toISOString();
    const closeMarkerAt = "2020-01-03T00:00:00Z";
    let closeMarkerPosted = false;
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              issues: {
                nodes: [
                  {
                    number: 70,
                    title: "old human response",
                    updatedAt: "2020-01-02T00:00:00Z",
                    locked: false,
                    assignees: { totalCount: 0 },
                    labels: {
                      nodes: [{ name: "needs-info" }, { name: "stale" }],
                    },
                    reactionGroups: [],
                  },
                  {
                    number: 71,
                    title: "recent plus one",
                    updatedAt: recentCommentAt,
                    locked: false,
                    assignees: { totalCount: 0 },
                    labels: { nodes: [{ name: "needs-info" }] },
                    reactionGroups: [],
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }
      if (url.pathname.endsWith("/events")) {
        return json([
          {
            event: "labeled",
            label: { name: "needs-info" },
            created_at: "2020-01-01T00:00:00Z",
          },
        ]);
      }
      if (url.pathname.endsWith("/issues/70/comments") && request.method === "GET") {
        return json([
          {
            body: "old response",
            created_at: "2020-01-02T00:00:00Z",
            user: { type: "User", login: "reporter" },
          },
          ...(closeMarkerPosted
            ? [
                {
                  body: "<!-- lifecycle-close:needs-info -->\nClosing for now.",
                  created_at: closeMarkerAt,
                  user: { type: "Bot", login: "github-actions[bot]" },
                },
              ]
            : []),
        ]);
      }
      if (url.pathname.endsWith("/issues/71/comments") && request.method === "GET") {
        return json([
          {
            body: "+1",
            created_at: recentCommentAt,
            user: { type: "User", login: "another-user" },
          },
        ]);
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/70/comments" &&
        request.method === "POST"
      ) {
        closeMarkerPosted = true;
        return json({ id: 1 });
      }
      const issueMatch = url.pathname.match(/\/issues\/(70|71)$/);
      if (issueMatch && request.method === "GET") {
        return json({
          state: "open",
          locked: false,
          updated_at:
            Number(issueMatch[1]) === 70 && closeMarkerPosted
              ? closeMarkerAt
              : "2020-01-02T00:00:00Z",
          assignees: [],
          labels: [{ name: "needs-info" }, { name: "stale" }],
          reactions: { "+1": 0 },
        });
      }
      if (issueMatch && request.method === "PATCH") {
        closedIssues.push(Number(issueMatch[1]));
        return json({ state: "closed" });
      }
      const labelsMatch = url.pathname.match(/\/issues\/(70|71)\/labels$/);
      if (labelsMatch) {
        labelMutations.push(Number(labelsMatch[1]));
        return json([]);
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
    expect(closedIssues).toEqual([70]);
    expect(labelMutations).toEqual([]);
  });

  test("sweep does not close when a human comment shares the label event's GitHub second", async () => {
    const needsInfoTimeoutMs = 7 * 24 * 60 * 60 * 1000;
    const timestamp = new Date(
      Math.floor((Date.now() - needsInfoTimeoutMs) / 1000) * 1000
    ).toISOString();
    const sinceValues: string[] = [];
    let closeAttempts = 0;
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              issues: {
                nodes: [
                  {
                    number: 72,
                    title: "same-second activity",
                    updatedAt: timestamp,
                    locked: false,
                    assignees: { totalCount: 1 },
                    labels: { nodes: [{ name: "needs-info" }] },
                    reactionGroups: [],
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }
      if (url.pathname.endsWith("/issues/72/events")) {
        return json([
          {
            event: "labeled",
            label: { name: "needs-info" },
            created_at: timestamp,
          },
        ]);
      }
      if (url.pathname.endsWith("/issues/72/comments") && request.method === "GET") {
        sinceValues.push(url.searchParams.get("since") ?? "");
        return json([
          {
            body: "requested information",
            created_at: timestamp,
            user: { type: "User", login: "original-reporter" },
          },
        ]);
      }
      if (url.pathname.endsWith("/issues/72/comments") && request.method === "POST") {
        return json({ id: 1 });
      }
      if (url.pathname.endsWith("/issues/72") && request.method === "PATCH") {
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
    expect(sinceValues).toEqual([new Date(timestamp).toISOString()]);
    expect(closeAttempts).toBe(0);
  });

  test("sweep treats a recent issue body or title edit as lifecycle activity", async () => {
    const editedAt = new Date().toISOString();
    const markerAt = new Date(Date.now() + 1_000).toISOString();
    const comments: any[] = [];
    let markerAttempts = 0;
    let closeAttempts = 0;
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              issues: {
                nodes: [
                  {
                    number: 108,
                    title: "recently edited title",
                    updatedAt: editedAt,
                    locked: false,
                    assignees: { totalCount: 0 },
                    labels: { nodes: [{ name: "invalid" }] },
                    reactionGroups: [],
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }
      if (url.pathname === "/repos/acme/widgets/issues/108/events") {
        return json([
          {
            event: "labeled",
            label: { name: "invalid" },
            created_at: "2020-01-01T00:00:00Z",
          },
        ]);
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/108/comments" &&
        request.method === "GET"
      ) {
        return json(comments);
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/108/comments" &&
        request.method === "POST"
      ) {
        markerAttempts += 1;
        const body = (await request.json()) as { body: string };
        comments.push({
          id: 1080,
          body: body.body,
          created_at: markerAt,
          user: { type: "Bot", login: "github-actions[bot]" },
        });
        return json({ id: 1080 });
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/108" &&
        request.method === "GET"
      ) {
        return json({
          title: "recently edited title",
          body: "recently edited reproduction details",
          state: "open",
          state_reason: null,
          locked: false,
          updated_at: markerAttempts > 0 ? markerAt : editedAt,
          assignees: [],
          labels: [{ name: "invalid" }],
          milestone: null,
          reactions: { "+1": 0 },
        });
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/108" &&
        request.method === "PATCH"
      ) {
        closeAttempts += 1;
        return json({ state: "closed" });
      }
      return json({ message: "not found" }, { status: 404 });
    });

    const result = await runScript("scripts/sweep.ts", server, {
      GITHUB_REPOSITORY_OWNER: "acme",
      GITHUB_REPOSITORY_NAME: "widgets",
    });

    expect(result.exitCode).toBe(0);
    expect(markerAttempts).toBe(0);
    expect(closeAttempts).toBe(0);
  });

  test("sweep stops when issue metadata changes after its close marker", async () => {
    const snapshotUpdatedAt = "2020-01-02T00:00:00Z";
    const markerAt = new Date().toISOString();
    const comments: any[] = [];
    let markerPosted = false;
    let closeAttempts = 0;
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              issues: {
                nodes: [
                  {
                    number: 109,
                    title: "original title",
                    updatedAt: snapshotUpdatedAt,
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
      if (url.pathname === "/repos/acme/widgets/issues/109/events") {
        return json([
          {
            event: "labeled",
            label: { name: "invalid" },
            created_at: "2020-01-01T00:00:00Z",
          },
        ]);
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/109/comments" &&
        request.method === "GET"
      ) {
        return json(comments);
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/109/comments" &&
        request.method === "POST"
      ) {
        markerPosted = true;
        const body = (await request.json()) as { body: string };
        comments.push({
          id: 1090,
          body: body.body,
          created_at: markerAt,
          user: { type: "Bot", login: "github-actions[bot]" },
        });
        return json({ id: 1090 });
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/109" &&
        request.method === "GET"
      ) {
        return json({
          title: markerPosted ? "human-edited title" : "original title",
          body: markerPosted
            ? "human-edited reproduction details"
            : "original reproduction details",
          state: "open",
          state_reason: null,
          locked: false,
          updated_at: markerPosted ? markerAt : snapshotUpdatedAt,
          assignees: [],
          labels: [{ name: "invalid" }, { name: "stale" }],
          milestone: null,
          reactions: { "+1": 0 },
        });
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/109" &&
        request.method === "PATCH"
      ) {
        closeAttempts += 1;
        return json({ state: "closed" });
      }
      return json({ message: "not found" }, { status: 404 });
    });

    const result = await runScript("scripts/sweep.ts", server, {
      GITHUB_REPOSITORY_OWNER: "acme",
      GITHUB_REPOSITORY_NAME: "widgets",
    });

    expect(result.exitCode).toBe(0);
    expect(markerPosted).toBe(true);
    expect(closeAttempts).toBe(0);
  });

  test("sweep revalidates every close condition immediately before mutating", async () => {
    const candidates = [100, 101, 102, 103, 104, 105];
    const commentReads = new Map<number, number>();
    const eventReads = new Map<number, number>();
    const closingComments: number[] = [];
    const closeAttempts: number[] = [];
    const snapshotUpdatedAt = "2020-01-02T00:00:00Z";
    const closeMarkerAt = "2020-01-03T00:00:00Z";
    const closeMarkers = new Set<number>();
    const recentHumanAt = new Date(Date.now() + 1_000).toISOString();
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              issues: {
                nodes: candidates.map((number) => ({
                  number,
                  title: `close candidate ${number}`,
                  updatedAt: snapshotUpdatedAt,
                  locked: false,
                  assignees: { totalCount: 0 },
                  labels: {
                    nodes: [{ name: "invalid" }, { name: "stale" }],
                  },
                  reactionGroups: [],
                })),
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }

      const eventsMatch = url.pathname.match(/\/issues\/(10[0-5])\/events$/);
      if (eventsMatch) {
        const number = Number(eventsMatch[1]);
        eventReads.set(number, (eventReads.get(number) ?? 0) + 1);
        return json([
          {
            id: number,
            event: "labeled",
            label: { name: "invalid" },
            created_at: "2020-01-01T00:00:00Z",
          },
        ]);
      }

      const commentsMatch = url.pathname.match(
        /\/issues\/(10[0-5])\/comments$/
      );
      if (commentsMatch && request.method === "GET") {
        const number = Number(commentsMatch[1]);
        const reads = (commentReads.get(number) ?? 0) + 1;
        commentReads.set(number, reads);
        return json(
          number === 100 && reads > 1
            ? [
                {
                  id: 1000,
                  body: "New reproduction details arrived during the sweep.",
                  created_at: recentHumanAt,
                  user: { type: "User", login: "reporter" },
                },
              ]
            : closeMarkers.has(number)
              ? [
                  {
                    id: 2000 + number,
                    body: "<!-- lifecycle-close:invalid -->\nClosing for now.",
                    created_at: closeMarkerAt,
                    user: { type: "Bot", login: "github-actions[bot]" },
                  },
                ]
              : []
        );
      }

      const issueMatch = url.pathname.match(/\/issues\/(10[0-5])$/);
      if (issueMatch && request.method === "GET") {
        const number = Number(issueMatch[1]);
        return json({
          state: number === 101 ? "closed" : "open",
          locked: false,
          updated_at:
            number === 100
              ? recentHumanAt
              : closeMarkers.has(number)
                ? closeMarkerAt
                : snapshotUpdatedAt,
          assignees: number === 103 ? [{ login: "maintainer" }] : [],
          labels:
            number === 102
              ? [{ name: "stale" }]
              : [{ name: "invalid" }, { name: "stale" }],
          reactions: { "+1": number === 104 ? 10 : 0 },
        });
      }

      if (commentsMatch && request.method === "POST") {
        const number = Number(commentsMatch[1]);
        closingComments.push(number);
        closeMarkers.add(number);
        return json({ id: 2000 + number });
      }
      if (issueMatch && request.method === "PATCH") {
        closeAttempts.push(Number(issueMatch[1]));
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
    expect(Object.fromEntries(commentReads)).toEqual(
      Object.fromEntries(
        candidates.map((number) => [number, number === 105 ? 3 : 2])
      )
    );
    expect(Object.fromEntries(eventReads)).toEqual(
      Object.fromEntries(
        candidates.map((number) => [number, 3])
      )
    );
    expect(closingComments).toEqual([105]);
    expect(closeAttempts).toEqual([105]);
  });

  test("sweep stops when a human comments after the closing marker is posted", async () => {
    const snapshotUpdatedAt = "2020-01-02T00:00:00Z";
    const markerAt = "2020-01-03T00:00:00Z";
    const humanAt = "2020-01-03T00:00:01Z";
    let commentReads = 0;
    let closingComments = 0;
    let closeAttempts = 0;
    const comments: any[] = [];
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              issues: {
                nodes: [
                  {
                    number: 106,
                    title: "human response after lifecycle marker",
                    updatedAt: snapshotUpdatedAt,
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
      if (url.pathname === "/repos/acme/widgets/issues/106/events") {
        return json([
          {
            id: 106,
            event: "labeled",
            label: { name: "invalid" },
            created_at: "2020-01-01T00:00:00Z",
          },
        ]);
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/106/comments" &&
        request.method === "GET"
      ) {
        commentReads += 1;
        return json(comments);
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/106" &&
        request.method === "GET"
      ) {
        return json({
          state: "open",
          locked: false,
          updated_at: comments.at(-1)?.created_at ?? snapshotUpdatedAt,
          assignees: [],
          labels: [{ name: "invalid" }, { name: "stale" }],
          reactions: { "+1": 0 },
        });
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/106/comments" &&
        request.method === "POST"
      ) {
        closingComments += 1;
        const body = (await request.json()) as { body: string };
        comments.push(
          {
            id: 1060,
            body: body.body,
            created_at: markerAt,
            user: { type: "Bot", login: "github-actions[bot]" },
          },
          {
            id: 1061,
            body: "I can provide the requested information.",
            created_at: humanAt,
            user: { type: "User", login: "reporter" },
          }
        );
        return json({ id: 1060 });
      }
      if (
        url.pathname === "/repos/acme/widgets/issues/106" &&
        request.method === "PATCH"
      ) {
        closeAttempts += 1;
        return json({ state: "closed" });
      }
      return json({ message: "not found" }, { status: 404 });
    });

    const result = await runScript("scripts/sweep.ts", server, {
      GITHUB_REPOSITORY_OWNER: "acme",
      GITHUB_REPOSITORY_NAME: "widgets",
    });

    expect(result.exitCode).toBe(0);
    expect(commentReads).toBe(3);
    expect(closingComments).toBe(1);
    expect(closeAttempts).toBe(0);
  });

  test("sweep paginates activity and makes a failed close retryable", async () => {
    let closeAttempts = 0;
    let closingComments = 0;
    let protectedIssueCloseAttempts = 0;
    const recentActivityAt = new Date().toISOString();
    const comments: any[] = [];
    const server = startServer(async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/graphql") {
        return json({
          data: {
            repository: {
              issues: {
                nodes: [
                  {
                    number: 20,
                    title: "expired",
                    updatedAt:
                      comments.at(-1)?.created_at ?? "2020-01-01T00:00:00Z",
                    locked: false,
                    assignees: { totalCount: 0 },
                    labels: {
                      nodes: [{ name: "invalid" }, { name: "stale" }],
                    },
                    reactionGroups: [],
                  },
                  {
                    number: 21,
                    title: "human activity on page two",
                    updatedAt: recentActivityAt,
                    locked: false,
                    assignees: { totalCount: 0 },
                    labels: {
                      nodes: [{ name: "invalid" }, { name: "stale" }],
                    },
                    reactionGroups: [],
                  },
                  {
                    number: 22,
                    title: "deleted during sweep",
                    updatedAt: "2020-01-01T00:00:00Z",
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
      if (url.pathname.endsWith("/issues/22/events")) {
        return json({ message: "gone" }, { status: 404 });
      }
      if (url.pathname.endsWith("/events")) {
        return json([
          {
            event: "labeled",
            label: { name: "invalid" },
            created_at: "2020-01-01T00:00:00Z",
          },
        ]);
      }
      if (url.pathname.endsWith("/issues/20/comments") && request.method === "GET") {
        return json(comments);
      }
      if (url.pathname.endsWith("/issues/21/comments") && request.method === "GET") {
        if (url.searchParams.get("page") === "1") {
          return json(
            Array.from({ length: 100 }, () => ({
              body: "bot activity",
              created_at: "2020-01-02T00:00:00Z",
              user: { type: "Bot" },
            }))
          );
        }
        return json([
          {
            body: "still affected",
            created_at: recentActivityAt,
            user: { type: "User" },
          },
        ]);
      }
      if (url.pathname.endsWith("/issues/20") && request.method === "GET") {
        return json({
          state: "open",
          locked: false,
          updated_at:
            comments.at(-1)?.created_at ?? "2020-01-01T00:00:00Z",
          assignees: [],
          labels: [{ name: "invalid" }, { name: "stale" }],
          reactions: { "+1": 0 },
        });
      }
      if (url.pathname.endsWith("/issues/20/comments") && request.method === "POST") {
        closingComments += 1;
        const body = (await request.json()) as { body: string };
        comments.push({
          body: body.body,
          created_at: "2020-01-02T00:00:00Z",
          user: { type: "Bot", login: "github-actions[bot]" },
        });
        return json({ id: 1 });
      }
      if (url.pathname.endsWith("/issues/20") && request.method === "PATCH") {
        closeAttempts += 1;
        return closeAttempts === 1
          ? json({ message: "failure" }, { status: 500 })
          : json({ state: "closed" });
      }
      if (url.pathname.endsWith("/issues/21") && request.method === "PATCH") {
        protectedIssueCloseAttempts += 1;
        return json({ state: "closed" });
      }
      return json({ message: "not found" }, { status: 404 });
    });
    const env = {
      GITHUB_REPOSITORY_OWNER: "acme",
      GITHUB_REPOSITORY_NAME: "widgets",
    };

    expect((await runScript("scripts/sweep.ts", server, env)).exitCode).toBe(1);
    expect((await runScript("scripts/sweep.ts", server, env)).exitCode).toBe(0);
    expect(closingComments).toBe(1);
    expect(closeAttempts).toBe(2);
    expect(protectedIssueCloseAttempts).toBe(0);
  });
});
