import { expect, test } from "bun:test";
import { extractDuplicateIssueNumber } from "../../scripts/auto-close-duplicates.ts";

test("duplicate target only comes from an issue URL in the current repository", () => {
  const body = `Found #777 while checking candidates.
https://github.com/acme/widgets/issues/123`;
  expect(extractDuplicateIssueNumber(body, "acme", "widgets")).toBe(123);
  expect(
    extractDuplicateIssueNumber(
      "https://github.com/attacker/widgets/issues/999",
      "acme",
      "widgets"
    )
  ).toBeNull();
});
