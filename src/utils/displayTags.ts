/**
 * Matches any XML-like `<tag>…</tag>` block (lowercase tag names, optional
 * attributes, multi-line content). Used to strip system-injected wrapper tags
 * from display titles — IDE context, slash-command markers, hook output,
 * task notifications, channel messages, etc. A generic pattern avoids
 * maintaining an ever-growing allowlist that falls behind as new notification
 * types are added.
 *
 * Only matches lowercase tag names (`[a-z][\w-]*`) so user prose mentioning
 * JSX/HTML components ("fix the <Button> layout", "<!DOCTYPE html>") passes
 * through — those start with uppercase or `!`. The non-greedy body with a
 * backreferenced closing tag keeps adjacent blocks separate; unpaired angle
 * brackets ("when x < y") don't match.
 */
const XML_TAG_BLOCK_PATTERN = /<([a-z][\w-]*)(?:\s[^>]*)?>[\s\S]*?<\/\1>\n?/g

/**
 * Strip XML-like tag blocks from text for use in UI titles (/rewind, /resume,
 * bridge session titles). System-injected context — IDE metadata, hook output,
 * task notifications — arrives wrapped in tags and should never surface as a
 * title.
 *
 * If stripping would result in empty text, returns the original unchanged
 * (better to show something than nothing).
 */
export function stripDisplayTags(text: string): string {
  const result = text.replace(XML_TAG_BLOCK_PATTERN, '').trim()
  return result || text
}

/**
 * Like stripDisplayTags but returns empty string when all content is tags.
 * Used by getLogDisplayTitle to detect command-only prompts (e.g. /clear)
 * so they can fall through to the next title fallback, and by extractTitleText
 * to skip pure-XML messages during bridge title derivation.
 */
export function stripDisplayTagsAllowEmpty(text: string): string {
  return text.replace(XML_TAG_BLOCK_PATTERN, '').trim()
}

const IDE_CONTEXT_TAGS_PATTERN =
  /<(ide_opened_file|ide_selection)(?:\s[^>]*)?>[\s\S]*?<\/\1>\n?/g

/**
 * Strip only IDE-injected context tags (ide_opened_file, ide_selection).
 * Used by textForResubmit so UP-arrow resubmit preserves user-typed content
 * including lowercase HTML like `<code>foo</code>` while dropping IDE noise.
 */
export function stripIdeContextTags(text: string): string {
  return text.replace(IDE_CONTEXT_TAGS_PATTERN, '').trim()
}
