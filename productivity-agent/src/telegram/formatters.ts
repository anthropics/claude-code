export function escapeHTML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Convert basic markdown bold (**text**) to HTML <b>text</b>
// Used to preserve Claude's markdown formatting when sending to Telegram
export function markdownToHTML(text: string): string {
  return escapeHTML(text)
    // Bold: **text** -> <b>text</b>
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    // Inline code: `text` -> <code>text</code>
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function formatAnalysis(analysisText: string, issueUrl: string): string {
  const body = markdownToHTML(analysisText);
  return `${body}\n\n<a href="${issueUrl}">Open in Linear</a>`;
}

export function formatTaskList(
  tasks: Array<{ identifier: string; title: string; priorityLabel: string; state: string }>
): string {
  if (tasks.length === 0) return "No active Linear tasks found.";

  const lines = tasks
    .slice(0, 15) // Limit to 15 for message length
    .map(
      (t, i) =>
        `${i + 1}. <b>[${escapeHTML(t.identifier)}]</b> ${escapeHTML(t.title)}\n   ${escapeHTML(t.priorityLabel)} · ${escapeHTML(t.state)}`
    );

  const header = `<b>Your active tasks (${tasks.length} total):</b>\n\n`;
  const footer =
    tasks.length > 15
      ? `\n<i>...and ${tasks.length - 15} more</i>`
      : "";

  return header + lines.join("\n\n") + footer;
}

// Split long messages to respect Telegram's 4096 char limit
export function splitMessage(text: string, limit = 4000): string[] {
  if (text.length <= limit) return [text];

  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > limit) {
    // Try to split at a newline near the limit
    const splitAt = remaining.lastIndexOf("\n", limit);
    const cutAt = splitAt > limit / 2 ? splitAt : limit;
    parts.push(remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt).trimStart();
  }

  if (remaining.length > 0) parts.push(remaining);
  return parts;
}
