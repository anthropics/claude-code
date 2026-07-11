import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

function jobCondition(workflow: string): string {
  const block = workflow.match(/^    if: \|\n((?:      .*\n?)+)/m)?.[1];
  if (!block) throw new Error("Claude workflow job condition not found");
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

function evaluateCondition(condition: string, github: unknown): boolean {
  const evaluate = new Function(
    "github",
    "contains",
    "fromJSON",
    `return Boolean(${condition});`
  ) as (
    github: unknown,
    contains: (container: string | unknown[], value: unknown) => boolean,
    fromJSON: (value: string) => unknown
  ) => boolean;
  return evaluate(
    github,
    (container, value) => container.includes(value as never),
    (value) => JSON.parse(value)
  );
}

const trustedAssociations = ["OWNER", "MEMBER", "COLLABORATOR"];

describe("Claude mention workflow authorization", () => {
  test("starts only for identities that can pass action authorization", async () => {
    const workflow = await readFile(
      `${repositoryRoot}.github/workflows/claude.yml`,
      "utf8"
    );
    const condition = jobCondition(workflow);
    const commentEvent = (
      eventName: "issue_comment" | "pull_request_review_comment",
      association: string
    ) => ({
      event_name: eventName,
      event: {
        comment: { body: "@claude please investigate", author_association: association },
      },
    });
    const reviewEvent = (association: string) => ({
      event_name: "pull_request_review",
      event: {
        review: { body: "@claude please investigate", author_association: association },
      },
    });
    const issueEvent = (
      action: "opened" | "assigned",
      association: string,
      body = "@claude please investigate"
    ) => ({
      event_name: "issues",
      event: {
        action,
        issue: { title: "Bug", body, author_association: association },
      },
    });

    for (const eventName of [
      "issue_comment",
      "pull_request_review_comment",
    ] as const) {
      expect(evaluateCondition(condition, commentEvent(eventName, "NONE"))).toBe(
        false
      );
      for (const association of trustedAssociations) {
        expect(
          evaluateCondition(condition, commentEvent(eventName, association))
        ).toBe(true);
      }
    }

    expect(evaluateCondition(condition, reviewEvent("NONE"))).toBe(false);
    expect(evaluateCondition(condition, reviewEvent("MEMBER"))).toBe(true);
    expect(evaluateCondition(condition, issueEvent("opened", "NONE"))).toBe(
      false
    );
    expect(
      evaluateCondition(condition, issueEvent("opened", "COLLABORATOR"))
    ).toBe(true);

    // Assigning an issue already requires repository triage permission. Keep
    // this maintainer-triggered path for reports authored by external users.
    expect(evaluateCondition(condition, issueEvent("assigned", "NONE"))).toBe(
      true
    );
    expect(
      evaluateCondition(
        condition,
        issueEvent("assigned", "NONE", "No bot mention")
      )
    ).toBe(false);
  });
});
