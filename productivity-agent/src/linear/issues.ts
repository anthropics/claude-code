import { linearClient } from "./client.js";
import type { NormalizedIssue } from "../types.js";

export async function fetchMyIssues(): Promise<NormalizedIssue[]> {
  const me = await linearClient.viewer;

  const issues: NormalizedIssue[] = [];
  let hasMore = true;
  let cursor: string | undefined;

  while (hasMore) {
    const page = await me.assignedIssues({
      filter: {
        state: {
          type: { nin: ["completed", "canceled"] },
        },
      },
      orderBy: "priority" as never,
      first: 50,
      ...(cursor ? { after: cursor } : {}),
    });

    for (const issue of page.nodes) {
      const [state, project, labels] = await Promise.all([
        issue.state,
        issue.project,
        issue.labels(),
      ]);

      issues.push({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description
          ? issue.description.substring(0, 400)
          : null,
        priority: issue.priority,
        priorityLabel: issue.priorityLabel,
        state: state?.name ?? "Unknown",
        dueDate: issue.dueDate ?? null,
        estimate: issue.estimate ?? null,
        labels: labels.nodes.map((l) => l.name),
        projectName: project?.name ?? null,
        url: issue.url,
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
      });
    }

    hasMore = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor ?? undefined;

    // Cap at 100 issues for token budget
    if (issues.length >= 100) break;
  }

  // Sort: urgent first, then by due date, then by priority
  return issues.sort((a, b) => {
    // Urgent (1) always first
    if (a.priority === 1 && b.priority !== 1) return -1;
    if (b.priority === 1 && a.priority !== 1) return 1;

    // Then sort by due date (soonest first), nulls last
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    if (a.dueDate && b.dueDate) {
      const diff = a.dueDate.localeCompare(b.dueDate);
      if (diff !== 0) return diff;
    }

    // Then by priority
    if (a.priority !== 0 && b.priority !== 0) return a.priority - b.priority;
    if (a.priority !== 0) return -1;
    if (b.priority !== 0) return 1;

    return 0;
  });
}
