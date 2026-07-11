import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const marker = "<!-- automatic-lock-comment -->";

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

async function loadWorkflowScript(): Promise<(
  github: unknown,
  context: unknown
) => Promise<void>> {
  const workflow = await readFile(
    `${repositoryRoot}.github/workflows/lock-closed-issues.yml`,
    "utf8"
  );
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  return new AsyncFunction("github", "context", workflowScript(workflow));
}

const trustedMarkerComment = (createdAt: string) => ({
  body: `${marker}\nThis issue has been automatically locked.`,
  createdAt,
  created_at: createdAt,
  author: { login: "github-actions[bot]", __typename: "Bot" },
  user: { login: "github-actions[bot]", type: "Bot" },
});

describe("lock workflow retries", () => {
  test("does not comment on or lock an issue reopened after the closed snapshot", async () => {
    const runWorkflow = await loadWorkflowScript();
    const mutations: string[] = [];
    const github = {
      graphql: async () => ({
        repository: {
          issues: {
            nodes: [
              {
                number: 48,
                title: "reopened during sweep",
                updatedAt: "2020-01-01T00:00:00Z",
                locked: false,
                comments: { nodes: [] },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      }),
      paginate: async () => [],
      rest: {
        issues: {
          listComments: async () => undefined,
          get: async () => ({
            data: {
              state: "open",
              locked: false,
              updated_at: "2020-01-01T00:00:00Z",
            },
          }),
          createComment: async () => mutations.push("comment"),
          lock: async () => mutations.push("lock"),
        },
      },
    };

    await runWorkflow(github, {
      repo: { owner: "acme", repo: "widgets" },
    });

    expect(mutations).toEqual([]);
  });

  test("revalidates an old candidate after a human comment before mutating it", async () => {
    const runWorkflow = await loadWorkflowScript();
    const stale = "2020-01-01T00:00:00Z";
    const recent = new Date().toISOString();
    const commentLookups: number[] = [];
    const refreshLookups: number[] = [];
    const commentCreations: number[] = [];
    const lockAttempts: number[] = [];

    const github = {
      graphql: async () => ({
        repository: {
          issues: {
            nodes: [
              {
                number: 49,
                title: "recent human activity",
                updatedAt: stale,
                locked: false,
                comments: { nodes: [] },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      }),
      paginate: async (
        _method: unknown,
        options: { issue_number: number }
      ) => {
        commentLookups.push(options.issue_number);
        return [
          {
            body: "A human added new information after the snapshot.",
            created_at: recent,
            user: { login: "contributor", type: "User" },
          },
        ];
      },
      rest: {
        issues: {
          listComments: async () => undefined,
          get: async (options: { issue_number: number }) => {
            refreshLookups.push(options.issue_number);
            return {
              data: { state: "closed", locked: false, updated_at: recent },
            };
          },
          createComment: async (options: { issue_number: number }) => {
            commentCreations.push(options.issue_number);
          },
          lock: async (options: { issue_number: number }) => {
            lockAttempts.push(options.issue_number);
          },
        },
      },
    };

    await runWorkflow(github, {
      repo: { owner: "acme", repo: "widgets" },
    });

    expect(commentLookups).toEqual([49]);
    expect(refreshLookups).toEqual([49]);
    expect(commentCreations).toEqual([]);
    expect(lockAttempts).toEqual([]);
  });

  test("retries locking after its comment made the issue recent without duplicating the comment", async () => {
    const runWorkflow = await loadWorkflowScript();
    const markerCreatedAt = new Date().toISOString();
    let markerWasCreated = false;
    let lockAttempts = 0;
    let commentCreations = 0;

    const github = {
      graphql: async () => ({
        repository: {
          issues: {
            nodes: [
              {
                number: 50,
                title: "temporarily failed lock",
                updatedAt: markerWasCreated
                  ? markerCreatedAt
                  : "2020-01-01T00:00:00Z",
                locked: false,
                comments: {
                  nodes: markerWasCreated
                    ? [trustedMarkerComment(markerCreatedAt)]
                    : [],
                },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      }),
      paginate: async () =>
        markerWasCreated ? [trustedMarkerComment(markerCreatedAt)] : [],
      rest: {
        issues: {
          listComments: async () => undefined,
          get: async () => ({
            data: {
              state: "closed",
              locked: false,
              updated_at: markerWasCreated
                ? markerCreatedAt
                : "2020-01-01T00:00:00Z",
            },
          }),
          createComment: async () => {
            commentCreations += 1;
            markerWasCreated = true;
          },
          lock: async () => {
            lockAttempts += 1;
            if (lockAttempts === 1) throw new Error("temporary lock failure");
          },
        },
      },
    };
    const context = { repo: { owner: "acme", repo: "widgets" } };

    await expect(runWorkflow(github, context)).rejects.toThrow(
      "temporary lock failure"
    );
    await runWorkflow(github, context);

    expect(commentCreations).toBe(1);
    expect(lockAttempts).toBe(2);
  });

  test("does not lock when a human comments after the lock marker is posted", async () => {
    const runWorkflow = await loadWorkflowScript();
    const markerCreatedAt = new Date().toISOString();
    const humanCreatedAt = new Date(Date.now() + 1_000).toISOString();
    let commentReads = 0;
    let commentCreations = 0;
    let lockAttempts = 0;
    const comments: Array<Record<string, unknown>> = [];

    const github = {
      graphql: async () => ({
        repository: {
          issues: {
            nodes: [
              {
                number: 51,
                title: "human response after lock marker",
                updatedAt: "2020-01-01T00:00:00Z",
                locked: false,
                comments: { nodes: [] },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      }),
      paginate: async () => {
        commentReads += 1;
        return comments;
      },
      rest: {
        issues: {
          listComments: async () => undefined,
          get: async () => ({
            data: {
              state: "closed",
              locked: false,
              updated_at:
                (comments.at(-1)?.created_at as string | undefined) ??
                "2020-01-01T00:00:00Z",
            },
          }),
          createComment: async () => {
            commentCreations += 1;
            comments.push(
              trustedMarkerComment(markerCreatedAt),
              {
                body: "I have more information about this issue.",
                created_at: humanCreatedAt,
                user: { login: "reporter", type: "User" },
              }
            );
          },
          lock: async () => {
            lockAttempts += 1;
          },
        },
      },
    };

    await runWorkflow(github, {
      repo: { owner: "acme", repo: "widgets" },
    });

    expect(commentReads).toBe(2);
    expect(commentCreations).toBe(1);
    expect(lockAttempts).toBe(0);
  });

  test("does not lock when metadata changes after the lock marker is posted", async () => {
    const runWorkflow = await loadWorkflowScript();
    const markerCreatedAt = new Date().toISOString();
    let markerWasCreated = false;
    let lockAttempts = 0;
    const comments: Array<Record<string, unknown>> = [];
    const github = {
      graphql: async () => ({
        repository: {
          issues: {
            nodes: [
              {
                number: 52,
                title: "metadata changed during lock",
                updatedAt: "2020-01-01T00:00:00Z",
                locked: false,
                comments: { nodes: [] },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      }),
      paginate: async () => comments,
      rest: {
        issues: {
          listComments: async () => undefined,
          get: async () => ({
            data: {
              title: "metadata changed during lock",
              body: markerWasCreated
                ? "human-edited reproduction details"
                : "original reproduction details",
              state: "closed",
              locked: false,
              updated_at: markerWasCreated
                ? markerCreatedAt
                : "2020-01-01T00:00:00Z",
              labels: [],
              assignees: [],
              milestone: null,
            },
          }),
          createComment: async () => {
            markerWasCreated = true;
            comments.push(trustedMarkerComment(markerCreatedAt));
          },
          lock: async () => {
            lockAttempts += 1;
          },
        },
      },
    };

    await runWorkflow(github, {
      repo: { owner: "acme", repo: "widgets" },
    });

    expect(markerWasCreated).toBe(true);
    expect(lockAttempts).toBe(0);
  });

  test("only retries an exact trusted last marker and scans every page", async () => {
    const runWorkflow = await loadWorkflowScript();
    const now = Date.now();
    const recent = new Date(now - 60_000).toISOString();
    const laterActivity = new Date(now - 30_000).toISOString();
    const cursors: unknown[] = [];
    const commentLookups: number[] = [];
    const refreshLookups: number[] = [];
    const commentCreations: number[] = [];
    const lockAttempts: number[] = [];

    const recentIssue = (
      number: number,
      updatedAt: string,
      comment: Record<string, unknown>
    ) => ({
      number,
      title: `issue ${number}`,
      updatedAt,
      locked: false,
      comments: { nodes: [comment] },
    });

    const github = {
      graphql: async (_query: string, variables: { cursor: unknown }) => {
        cursors.push(variables.cursor);
        return {
          repository: {
            issues:
              variables.cursor === null
                ? {
                    nodes: [
                      recentIssue(60, recent, {
                        ...trustedMarkerComment(recent),
                        author: { login: "attacker", __typename: "User" },
                      }),
                      recentIssue(61, recent, {
                        ...trustedMarkerComment(recent),
                        body: `${marker}-lookalike`,
                      }),
                      recentIssue(
                        62,
                        laterActivity,
                        trustedMarkerComment(recent)
                      ),
                      recentIssue(63, recent, trustedMarkerComment(recent)),
                      recentIssue(65, recent, trustedMarkerComment(recent)),
                    ],
                    pageInfo: {
                      hasNextPage: true,
                      endCursor: "recent-page",
                    },
                  }
                : {
                    nodes: [
                      {
                        number: 64,
                        title: "old issue on a later page",
                        updatedAt: "2020-01-01T00:00:00Z",
                        locked: false,
                        comments: { nodes: [] },
                      },
                    ],
                    pageInfo: { hasNextPage: false, endCursor: null },
                  },
          },
        };
      },
      paginate: async (
        _method: unknown,
        options: { issue_number: number }
      ) => {
        commentLookups.push(options.issue_number);
        return options.issue_number === 63 || options.issue_number === 65
          ? [trustedMarkerComment(recent)]
          : [
              {
                body: marker,
                created_at: "2020-01-01T00:00:00Z",
                user: { login: "attacker", type: "User" },
              },
            ];
      },
      rest: {
        issues: {
          listComments: async () => undefined,
          get: async (options: { issue_number: number }) => {
            refreshLookups.push(options.issue_number);
            return {
              data: {
                state: "closed",
                locked: false,
                updated_at:
                  options.issue_number === 63
                    ? recent
                    : options.issue_number === 65
                      ? laterActivity
                      : "2020-01-01T00:00:00Z",
              },
            };
          },
          createComment: async (options: { issue_number: number }) => {
            commentCreations.push(options.issue_number);
          },
          lock: async (options: { issue_number: number }) => {
            lockAttempts.push(options.issue_number);
          },
        },
      },
    };

    await runWorkflow(github, {
      repo: { owner: "acme", repo: "widgets" },
    });

    expect(cursors).toEqual([null, "recent-page"]);
    expect(commentLookups).toEqual([63, 65, 64, 64]);
    expect(refreshLookups).toEqual([63, 65, 64, 64]);
    expect(commentCreations).toEqual([64]);
    expect(lockAttempts).toEqual([63, 64]);
  });

  test("rejects a repeated GraphQL cursor instead of looping", async () => {
    const runWorkflow = await loadWorkflowScript();
    let graphqlCalls = 0;
    const github = {
      graphql: async () => {
        graphqlCalls += 1;
        return {
          repository: {
            issues: {
              nodes: [],
              pageInfo: { hasNextPage: true, endCursor: "repeated" },
            },
          },
        };
      },
      rest: { issues: {} },
    };

    await expect(
      runWorkflow(github, {
        repo: { owner: "acme", repo: "widgets" },
      })
    ).rejects.toThrow("repeated issue cursor");
    expect(graphqlCalls).toBe(2);
  });
});
