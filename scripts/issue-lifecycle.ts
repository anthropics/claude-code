// Single source of truth for issue lifecycle labels, timeouts, and messages.

export const lifecycle = [
  {
    label: "invalid",
    days: 3,
    reason: "this doesn't appear to be about Claude Code",
    nudge: "This doesn't appear to be about [Claude Code](https://github.com/anthropics/claude-code). For general Anthropic support, visit [support.anthropic.com](https://support.anthropic.com).",
  },
  {
    label: "needs-repro",
    days: 7,
    reason: "we still need reproduction steps to investigate",
    nudge: "We weren't able to reproduce this. Could you provide steps to trigger the issue — what you ran, what happened, and what you expected?",
  },
  {
    label: "needs-info",
    days: 7,
    reason: "we still need a bit more information to move forward",
    nudge:
      "We need the actual issue details before we can investigate. Please reply with a short summary, what you expected to happen, what happened instead, and steps or context to reproduce it. If you used `/bug` or `/feedback`, make sure the description is not blank or a placeholder; version, OS, terminal, and feedback metadata alone are not enough.",
  },
  {
    label: "stale",
    days: 14,
    reason: "inactive for too long",
    nudge: "This issue has been automatically marked as stale due to inactivity.",
  },
  {
    label: "autoclose",
    days: 14,
    reason: "inactive for too long",
    nudge: "This issue has been marked for automatic closure.",
  },
] as const;

export type LifecycleLabel = (typeof lifecycle)[number]["label"];

export const STALE_UPVOTE_THRESHOLD = 10;

const EMPTY_GENERATED_TITLE_PATTERNS = [
  "i need a bug report or feature request description",
  "please provide the details of the issue you'd like to report",
];

export function getLifecycleEntry(label: string) {
  return lifecycle.find((entry) => entry.label === label);
}

export function formatLifecycleComment(label: string) {
  const entry = getLifecycleEntry(label);
  if (!entry) return null;

  return `${entry.nudge} This issue will be closed automatically if there's no activity within ${entry.days} days.`;
}

function extractBoldSection(body: string, heading: string) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(
    new RegExp(
      String.raw`\*\*${escapedHeading}\*\*[ \t]*(?:\r?\n)?([\s\S]*?)(?=\r?\n\*\*[^*]+\*\*|$)`,
      "i"
    )
  );

  return match?.[1] ?? null;
}

function hasMeaningfulText(value: string | null) {
  if (!value) return false;

  const normalized = value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim()
    .toLowerCase();

  return !["", "n/a", "na", "none", "null", "[]"].includes(normalized);
}

export function isEmptyGeneratedIssueReport({
  title,
  body,
}: {
  title: string;
  body?: string | null;
}) {
  const normalizedTitle = title.trim().toLowerCase();
  const issueBody = body ?? "";
  const hasPlaceholderTitle = EMPTY_GENERATED_TITLE_PATTERNS.some((pattern) =>
    normalizedTitle.includes(pattern)
  );
  const hasGeneratedMetadata =
    /\*\*Environment Info\*\*/i.test(issueBody) && /Feedback ID:/i.test(issueBody);

  if (!hasGeneratedMetadata) return false;

  const descriptionSections = [
    extractBoldSection(issueBody, "Bug Description"),
    extractBoldSection(issueBody, "Feature Description"),
    extractBoldSection(issueBody, "Description"),
  ];
  const hasDescriptionSection = descriptionSections.some((section) => section !== null);
  const hasMeaningfulDescription = descriptionSections.some(hasMeaningfulText);

  return (
    (hasPlaceholderTitle || hasDescriptionSection) &&
    !hasMeaningfulDescription
  );
}
