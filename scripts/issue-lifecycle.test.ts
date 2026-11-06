import { describe, expect, test } from "bun:test";

import {
  formatLifecycleComment,
  getLifecycleEntry,
  isEmptyGeneratedIssueReport,
} from "./issue-lifecycle.ts";

describe("issue lifecycle comments", () => {
  test("formats lifecycle comments with the configured timeout", () => {
    expect(formatLifecycleComment("needs-repro")).toContain(
      "within 7 days"
    );
    expect(formatLifecycleComment("not-a-lifecycle-label")).toBeNull();
  });

  test("needs-info asks for the missing bug description, not just metadata", () => {
    const entry = getLifecycleEntry("needs-info");
    const comment = formatLifecycleComment("needs-info");

    expect(entry?.reason).toContain("more information");
    expect(comment).toContain("actual issue details");
    expect(comment).toContain("what you expected to happen");
    expect(comment).toContain("what happened instead");
    expect(comment).toContain("steps or context to reproduce it");
    expect(comment).toContain(
      "version, OS, terminal, and feedback metadata alone are not enough"
    );
  });

  test("detects generated reports with placeholder title and no description", () => {
    expect(
      isEmptyGeneratedIssueReport({
        title:
          "I need a bug report or feature request description to generate a GitHub issue title. Please provide the details of the issue you'd like to report.",
        body: `**Bug Description**


**Environment Info**
- Platform: linux
- Terminal: gnome-terminal
- Version: 2.1.177
- Feedback ID: cc995832-bc6a-4d6c-808c-76684557b2c0

**Errors**
\`\`\`json
[]
\`\`\`
`,
      })
    ).toBe(true);
  });

  test("does not flag generated reports that include an actionable description", () => {
    expect(
      isEmptyGeneratedIssueReport({
        title:
          "I need a bug report or feature request description to generate a GitHub issue title. Please provide the details of the issue you'd like to report.",
        body: `**Bug Description**
The terminal freezes after I accept a file edit. It happens every time after running /bug.

**Environment Info**
- Platform: linux
- Terminal: gnome-terminal
- Version: 2.1.177
- Feedback ID: cc995832-bc6a-4d6c-808c-76684557b2c0
`,
      })
    ).toBe(false);
  });
});
