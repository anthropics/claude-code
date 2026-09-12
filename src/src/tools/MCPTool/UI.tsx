import { c as _c } from "react/compiler-runtime";
import { feature } from 'bun:bundle';
import figures from 'figures';
import * as React from 'react';
import type { z } from 'zod/v4';
import { ProgressBar } from '../../components/design-system/ProgressBar.js';
import { MessageResponse } from '../../components/MessageResponse.js';
import { linkifyUrlsInText, OutputLine } from '../../components/shell/OutputLine.js';
import { stringWidth } from '../../ink/stringWidth.js';
import { Ansi, Box, Text } from '../../ink.js';
import type { ToolProgressData } from '../../Tool.js';
import type { ProgressMessage } from '../../types/message.js';
import type { MCPProgress } from '../../types/tools.js';
import { formatNumber } from '../../utils/format.js';
import { createHyperlink } from '../../utils/hyperlink.js';
import { getContentSizeEstimate, type MCPToolResult } from '../../utils/mcpValidation.js';
import { jsonParse, jsonStringify } from '../../utils/slowOperations.js';
import type { inputSchema } from './MCPTool.js';

// Threshold for displaying warning about large MCP responses
const MCP_OUTPUT_WARNING_THRESHOLD_TOKENS = 10_000;

// In non-verbose mode, truncate individual input values to keep the header
// compact. Matches BashTool's philosophy of showing enough to identify the
// call without dumping the entire payload inline.
const MAX_INPUT_VALUE_CHARS = 80;

// Max number of top-level keys before we fall back to raw JSON display.
// Beyond this a flat k:v list is more noise than help.
const MAX_FLAT_JSON_KEYS = 12;

// Don't attempt flat-object parsing for large blobs.
const MAX_FLAT_JSON_CHARS = 5_000;

// Don't attempt to parse JSON blobs larger than this (perf safety).
const MAX_JSON_PARSE_CHARS = 200_000;

// A string value is "dominant text payload" if it has newlines or is
// long enough that inline display would be worse than unwrapping.
const UNWRAP_MIN_STRING_LEN = 200;
export function renderToolUseMessage(input: z.infer<ReturnType<typeof inputSchema>>, {
  verbose
}: {
  verbose: boolean;
}): React.ReactNode {
  if (Object.keys(input).length === 0) {
    return '';
  }
  return Object.entries(input).map(([key, value]) => {
    let rendered = jsonStringify(value);
    if (feature('MCP_RICH_OUTPUT') && !verbose && rendered.length > MAX_INPUT_VALUE_CHARS) {
      rendered = rendered.slice(0, MAX_INPUT_VALUE_CHARS).trimEnd() + '…';
    }
    return `${key}: ${rendered}`;
  }).join(', ');
}
export function renderToolUseProgressMessage(progressMessagesForMessage: ProgressMessage<MCPProgress>[]): React.ReactNode {
  const lastProgress = progressMessagesForMessage.at(-1);
  if (!lastProgress?.data) {
    return <MessageResponse height={1}>
        <Text dimColor>Running…</Text>
      </MessageResponse>;
  }
  const {
    progress,
    total,
    progressMessage
  } = lastProgress.data;
  if (progress === undefined) {
    return <MessageResponse height={1}>
        <Text dimColor>Running…</Text>
      </MessageResponse>;
  }
  if (total !== undefined && total > 0) {
    const ratio = Math.min(1, Math.max(0, progress / total));
    const percentage = Math.round(ratio * 100);
    return <MessageResponse>
        <Box flexDirection="column">
          {progressMessage && <Text dimColor>{progressMessage}</Text>}
          <Box flexDirection="row" gap={1}>
            <ProgressBar ratio={ratio} width={20} />
            <Text dimColor>{percentage}%</Text>
          </Box>
        </Box>
      </MessageResponse>;
  }
  return <MessageResponse height={1}>
      <Text dimColor>{progressMessage ?? `Processing… ${progress}`}</Text>
    </MessageResponse>;
}
export function renderToolResultMessage(output: string | MCPToolResult, _progressMessagesForMessage: ProgressMessage<ToolProgressData>[], {
  verbose,
  input
}: {
  verbose: boolean;
  input?: unknown;
}): React.ReactNode {
  const mcpOutput = output as MCPToolResult;
  if (!verbose) {
    const slackSend = trySlackSendCompact(mcpOutput, input);
    if (slackSend !== null) {
      return <MessageResponse height={1}>
          <Text>
            Sent a message to{' '}
            <Ansi>{createHyperlink(slackSend.url, slackSend.channel)}</Ansi>
          </Text>
        </MessageResponse>;
    }
  }
  const estimatedTokens = getContentSizeEstimate(mcpOutput);
  const showWarning = estimatedTokens > MCP_OUTPUT_WARNING_THRESHOLD_TOKENS;
  const warningMessage = showWarning ? `${figures.warning} Large MCP response (~${formatNumber(estimatedTokens)} tokens), this can fill up context quickly` : null;
  let contentElement: React.ReactNode;
  if (Array.isArray(mcpOutput)) {
    const contentBlocks = mcpOutput.map((item, i) => {
      if (item.type === 'image') {
        return <Box key={i} justifyContent="space-between" overflowX="hidden" width="100%">
            <MessageResponse height={1}>
              <Text>[Image]</Text>
            </MessageResponse>
          </Box>;
      }
      // For text blocks and any other block types, extract text if available
      const textContent = item.type === 'text' && 'text' in item && item.text !== null && item.text !== undefined ? String(item.text) : '';
      return feature('MCP_RICH_OUTPUT') ? <MCPTextOutput key={i} content={textContent} verbose={verbose} /> : <OutputLine key={i} content={textContent} verbose={verbose} />;
    });

    // Wrap array content in a column layout
    contentElement = <Box flexDirection="column" width="100%">
        {contentBlocks}
      </Box>;
  } else if (!mcpOutput) {
    contentElement = <Box justifyContent="space-between" overflowX="hidden" width="100%">
        <MessageResponse height={1}>
          <Text dimColor>(No content)</Text>
        </MessageResponse>
      </Box>;
  } else {
    contentElement = feature('MCP_RICH_OUTPUT') ? <MCPTextOutput content={mcpOutput} verbose={verbose} /> : <OutputLine content={mcpOutput} verbose={verbose} />;
  }
  if (warningMessage) {
    return <Box flexDirection="column">
        <MessageResponse height={1}>
          <Text color="warning">{warningMessage}</Text>
        </MessageResponse>
        {contentElement}
      </Box>;
  }
  return contentElement;
}

/**
 * Render MCP text output. Tries three strategies in order:
 * 1. If JSON wraps a single dominant text payload (e.g. slack's
 *    {"messages":"line1\nline2..."}), unwrap and let OutputLine truncate.
 * 2. If JSON is a small flat-ish object, render as aligned key: value.
 * 3. Otherwise fall through to OutputLine (pretty-print + truncate).
 */
function MCPTextOutput(t0) {
  const $ = _c(18);
  const {
    content,
    verbose
  } = t0;
  let t1;
  if ($[0] !== content || $[1] !== verbose) {
    t1 = Symbol.for("react.early_return_sentinel");
    bb0: {
      const unwrapped = tryUnwrapTextPayload(content);
      if (unwrapped !== null) {
        const t2 = unwrapped.extras.length > 0 && <Text dimColor={true}>{unwrapped.extras.map(_temp).join(" \xB7 ")}</Text>;
        let t3;
        if ($[3] !== unwrapped || $[4] !== verbose) {
          t3 = <OutputLine content={unwrapped.body} verbose={verbose} linkifyUrls={true} />;
          $[3] = unwrapped;
          $[4] = verbose;
          $[5] = t3;
        } else {
          t3 = $[5];
        }
        let t4;
        if ($[6] !== t2 || $[7] !== t3) {
          t4 = <MessageResponse><Box flexDirection="column">{t2}{t3}</Box></MessageResponse>;
          $[6] = t2;
          $[7] = t3;
          $[8] = t4;
        } else {
          t4 = $[8];
        }
        t1 = t4;
        break bb0;
      }
    }
    $[0] = content;
    $[1] = verbose;
    $[2] = t1;
  } else {
    t1 = $[2];
  }
  if (t1 !== Symbol.for("react.early_return_sentinel")) {
    return t1;
  }
  let t2;
  if ($[9] !== content) {
    t2 = Symbol.for("react.early_return_sentinel");
    bb1: {
      const flat = tryFlattenJson(content);
      if (flat !== null) {
        const maxKeyWidth = Math.max(...flat.map(_temp2));
        let t3;
        if ($[11] !== maxKeyWidth) {
          t3 = (t4, i) => {
            const [key, value] = t4;
            return <Text key={i}><Text dimColor={true}>{key.padEnd(maxKeyWidth)}: </Text><Ansi>{linkifyUrlsInText(value)}</Ansi></Text>;
          };
          $[11] = maxKeyWidth;
          $[12] = t3;
        } else {
          t3 = $[12];
        }
        const t4 = <Box flexDirection="column">{flat.map(t3)}</Box>;
        let t5;
        if ($[13] !== t4) {
          t5 = <MessageResponse>{t4}</MessageResponse>;
          $[13] = t4;
          $[14] = t5;
        } else {
          t5 = $[14];
        }
        t2 = t5;
        break bb1;
      }
    }
    $[9] = content;
    $[10] = t2;
  } else {
    t2 = $[10];
  }
  if (t2 !== Symbol.for("react.early_return_sentinel")) {
    return t2;
  }
  let t3;
  if ($[15] !== content || $[16] !== verbose) {
    t3 = <OutputLine content={content} verbose={verbose} linkifyUrls={true} />;
    $[15] = content;
    $[16] = verbose;
    $[17] = t3;
  } else {
    t3 = $[17];
  }
  return t3;
}

/**
 * Parse content as a JSON object and return its entries. Null if content
 * doesn't parse, isn't an object, is too large, or has 0/too-many keys.
 */
function _temp2(t0) {
  const [k_0] = t0;
  return stringWidth(k_0);
}
function _temp(t0) {
  const [k, v] = t0;
  return `${k}: ${v}`;
}
function parseJsonEntries(content: string, {
  maxChars,
  maxKeys
}: {
  maxChars: number;
  maxKeys: number;
}): [string, unknown][] | null {
  const trimmed = content.trim();
  if (trimmed.length === 0 || trimmed.length > maxChars || trimmed[0] !== '{') {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = jsonParse(trimmed);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const entries = Object.entries(parsed);
  if (entries.length === 0 || entries.length > maxKeys) {
    return null;
  }
  return entries;
}

/**
 * If content parses as a JSON object where every value is a scalar or a
 * small nested object, flatten it to [key, displayValue] pairs. Nested
 * objects get one-line JSON. Returns null if content doesn't qualify.
 */
export function tryFlattenJson(content: string): [string, string][] | null {
  const entries = parseJsonEntries(content, {
    maxChars: MAX_FLAT_JSON_CHARS,
    maxKeys: MAX_FLAT_JSON_KEYS
  });
  if (entries === null) return null;
  const result: [string, string][] = [];
  for (const [key, value] of entries) {
    if (typeof value === 'string') {
      result.push([key, value]);
    } else if (value === null || typeof value === 'number' || typeof value === 'boolean') {
      result.push([key, String(value)]);
    } else if (typeof value === 'object') {
      const compact = jsonStringify(value);
      if (compact.length > 120) return null;
      result.push([key, compact]);
    } else {
      return null;
    }
  }
  return result;
}

/**
 * If content is a JSON object where one key holds a dominant string payload
 * (multiline or long) and all siblings are small scalars, unwrap it. This
 * handles the common MCP pattern of {"messages":"line1\nline2..."} where
 * pretty-printing keeps \n escaped but we want real line breaks + truncation.
 */
export function tryUnwrapTextPayload(content: string): {
  body: string;
  extras: [string, string][];
} | null {
  const entries = parseJsonEntries(content, {
    maxChars: MAX_JSON_PARSE_CHARS,
    maxKeys: 4
  });
  if (entries === null) return null;
  // Find the one dominant string payload. Trim first: a trailing \n on a
  // short sibling (e.g. pagination hints) shouldn't make it "dominant".
  let body: string | null = null;
  const extras: [string, string][] = [];
  for (const [key, value] of entries) {
    if (typeof value === 'string') {
      const t = value.trimEnd();
      const isDominant = t.length > UNWRAP_MIN_STRING_LEN || t.includes('\n') && t.length > 50;
      if (isDominant) {
        if (body !== null) return null; // two big strings — ambiguous
        body = t;
        continue;
      }
      if (t.length > 150) return null;
      extras.push([key, t.replace(/\s+/g, ' ')]);
    } else if (value === null || typeof value === 'number' || typeof value === 'boolean') {
      extras.push([key, String(value)]);
    } else {
      return null; // nested object/array — use flat or pretty-print path
    }
  }
  if (body === null) return null;
  return {
    body,
    extras
  };
}
const SLACK_ARCHIVES_RE = /^https:\/\/[a-z0-9-]+\.slack\.com\/archives\/([A-Z0-9]+)\/p\d+$/;

/**
 * Detect a Slack send-message result and return a compact {channel, url} pair.
 * Matches both hosted (claude.ai Slack) and community MCP server shapes —
 * both return `message_link` in the result. The channel label prefers the
 * tool input (may be a name like "#foo" or an ID like "C09EVDAN1NK") and
 * falls back to the ID parsed from the archives URL.
 */
export function trySlackSendCompact(output: string | MCPToolResult, input: unknown): {
  channel: string;
  url: string;
} | null {
  let text: unknown = output;
  if (Array.isArray(output)) {
    const block = output.find(b => b.type === 'text');
    text = block && 'text' in block ? block.text : undefined;
  }
  if (typeof text !== 'string' || !text.includes('"message_link"')) {
    return null;
  }
  const entries = parseJsonEntries(text, {
    maxChars: 2000,
    maxKeys: 6
  });
  const url = entries?.find(([k]) => k === 'message_link')?.[1];
  if (typeof url !== 'string') return null;
  const m = SLACK_ARCHIVES_RE.exec(url);
  if (!m) return null;
  const inp = input as {
    channel_id?: unknown;
    channel?: unknown;
  } | undefined;
  const raw = inp?.channel_id ?? inp?.channel ?? m[1];
  const label = typeof raw === 'string' && raw ? raw : 'slack';
  return {
    channel: label.startsWith('#') ? label : `#${label}`,
    url
  };
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiZmlndXJlcyIsIlJlYWN0IiwieiIsIlByb2dyZXNzQmFyIiwiTWVzc2FnZVJlc3BvbnNlIiwibGlua2lmeVVybHNJblRleHQiLCJPdXRwdXRMaW5lIiwic3RyaW5nV2lkdGgiLCJBbnNpIiwiQm94IiwiVGV4dCIsIlRvb2xQcm9ncmVzc0RhdGEiLCJQcm9ncmVzc01lc3NhZ2UiLCJNQ1BQcm9ncmVzcyIsImZvcm1hdE51bWJlciIsImNyZWF0ZUh5cGVybGluayIsImdldENvbnRlbnRTaXplRXN0aW1hdGUiLCJNQ1BUb29sUmVzdWx0IiwianNvblBhcnNlIiwianNvblN0cmluZ2lmeSIsImlucHV0U2NoZW1hIiwiTUNQX09VVFBVVF9XQVJOSU5HX1RIUkVTSE9MRF9UT0tFTlMiLCJNQVhfSU5QVVRfVkFMVUVfQ0hBUlMiLCJNQVhfRkxBVF9KU09OX0tFWVMiLCJNQVhfRkxBVF9KU09OX0NIQVJTIiwiTUFYX0pTT05fUEFSU0VfQ0hBUlMiLCJVTldSQVBfTUlOX1NUUklOR19MRU4iLCJyZW5kZXJUb29sVXNlTWVzc2FnZSIsImlucHV0IiwiaW5mZXIiLCJSZXR1cm5UeXBlIiwidmVyYm9zZSIsIlJlYWN0Tm9kZSIsIk9iamVjdCIsImtleXMiLCJsZW5ndGgiLCJlbnRyaWVzIiwibWFwIiwia2V5IiwidmFsdWUiLCJyZW5kZXJlZCIsInNsaWNlIiwidHJpbUVuZCIsImpvaW4iLCJyZW5kZXJUb29sVXNlUHJvZ3Jlc3NNZXNzYWdlIiwicHJvZ3Jlc3NNZXNzYWdlc0Zvck1lc3NhZ2UiLCJsYXN0UHJvZ3Jlc3MiLCJhdCIsImRhdGEiLCJwcm9ncmVzcyIsInRvdGFsIiwicHJvZ3Jlc3NNZXNzYWdlIiwidW5kZWZpbmVkIiwicmF0aW8iLCJNYXRoIiwibWluIiwibWF4IiwicGVyY2VudGFnZSIsInJvdW5kIiwicmVuZGVyVG9vbFJlc3VsdE1lc3NhZ2UiLCJvdXRwdXQiLCJfcHJvZ3Jlc3NNZXNzYWdlc0Zvck1lc3NhZ2UiLCJtY3BPdXRwdXQiLCJzbGFja1NlbmQiLCJ0cnlTbGFja1NlbmRDb21wYWN0IiwidXJsIiwiY2hhbm5lbCIsImVzdGltYXRlZFRva2VucyIsInNob3dXYXJuaW5nIiwid2FybmluZ01lc3NhZ2UiLCJ3YXJuaW5nIiwiY29udGVudEVsZW1lbnQiLCJBcnJheSIsImlzQXJyYXkiLCJjb250ZW50QmxvY2tzIiwiaXRlbSIsImkiLCJ0eXBlIiwidGV4dENvbnRlbnQiLCJ0ZXh0IiwiU3RyaW5nIiwiTUNQVGV4dE91dHB1dCIsInQwIiwiJCIsIl9jIiwiY29udGVudCIsInQxIiwiU3ltYm9sIiwiZm9yIiwiYmIwIiwidW53cmFwcGVkIiwidHJ5VW53cmFwVGV4dFBheWxvYWQiLCJ0MiIsImV4dHJhcyIsIl90ZW1wIiwidDMiLCJib2R5IiwidDQiLCJiYjEiLCJmbGF0IiwidHJ5RmxhdHRlbkpzb24iLCJtYXhLZXlXaWR0aCIsIl90ZW1wMiIsInBhZEVuZCIsInQ1Iiwia18wIiwiayIsInYiLCJwYXJzZUpzb25FbnRyaWVzIiwibWF4Q2hhcnMiLCJtYXhLZXlzIiwidHJpbW1lZCIsInRyaW0iLCJwYXJzZWQiLCJyZXN1bHQiLCJwdXNoIiwiY29tcGFjdCIsInQiLCJpc0RvbWluYW50IiwiaW5jbHVkZXMiLCJyZXBsYWNlIiwiU0xBQ0tfQVJDSElWRVNfUkUiLCJibG9jayIsImZpbmQiLCJiIiwibSIsImV4ZWMiLCJpbnAiLCJjaGFubmVsX2lkIiwicmF3IiwibGFiZWwiLCJzdGFydHNXaXRoIl0sInNvdXJjZXMiOlsiVUkudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGZlYXR1cmUgfSBmcm9tICdidW46YnVuZGxlJ1xuaW1wb3J0IGZpZ3VyZXMgZnJvbSAnZmlndXJlcydcbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHR5cGUgeyB6IH0gZnJvbSAnem9kL3Y0J1xuaW1wb3J0IHsgUHJvZ3Jlc3NCYXIgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL2Rlc2lnbi1zeXN0ZW0vUHJvZ3Jlc3NCYXIuanMnXG5pbXBvcnQgeyBNZXNzYWdlUmVzcG9uc2UgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL01lc3NhZ2VSZXNwb25zZS5qcydcbmltcG9ydCB7XG4gIGxpbmtpZnlVcmxzSW5UZXh0LFxuICBPdXRwdXRMaW5lLFxufSBmcm9tICcuLi8uLi9jb21wb25lbnRzL3NoZWxsL091dHB1dExpbmUuanMnXG5pbXBvcnQgeyBzdHJpbmdXaWR0aCB9IGZyb20gJy4uLy4uL2luay9zdHJpbmdXaWR0aC5qcydcbmltcG9ydCB7IEFuc2ksIEJveCwgVGV4dCB9IGZyb20gJy4uLy4uL2luay5qcydcbmltcG9ydCB0eXBlIHsgVG9vbFByb2dyZXNzRGF0YSB9IGZyb20gJy4uLy4uL1Rvb2wuanMnXG5pbXBvcnQgdHlwZSB7IFByb2dyZXNzTWVzc2FnZSB9IGZyb20gJy4uLy4uL3R5cGVzL21lc3NhZ2UuanMnXG5pbXBvcnQgdHlwZSB7IE1DUFByb2dyZXNzIH0gZnJvbSAnLi4vLi4vdHlwZXMvdG9vbHMuanMnXG5pbXBvcnQgeyBmb3JtYXROdW1iZXIgfSBmcm9tICcuLi8uLi91dGlscy9mb3JtYXQuanMnXG5pbXBvcnQgeyBjcmVhdGVIeXBlcmxpbmsgfSBmcm9tICcuLi8uLi91dGlscy9oeXBlcmxpbmsuanMnXG5pbXBvcnQge1xuICBnZXRDb250ZW50U2l6ZUVzdGltYXRlLFxuICB0eXBlIE1DUFRvb2xSZXN1bHQsXG59IGZyb20gJy4uLy4uL3V0aWxzL21jcFZhbGlkYXRpb24uanMnXG5pbXBvcnQgeyBqc29uUGFyc2UsIGpzb25TdHJpbmdpZnkgfSBmcm9tICcuLi8uLi91dGlscy9zbG93T3BlcmF0aW9ucy5qcydcbmltcG9ydCB0eXBlIHsgaW5wdXRTY2hlbWEgfSBmcm9tICcuL01DUFRvb2wuanMnXG5cbi8vIFRocmVzaG9sZCBmb3IgZGlzcGxheWluZyB3YXJuaW5nIGFib3V0IGxhcmdlIE1DUCByZXNwb25zZXNcbmNvbnN0IE1DUF9PVVRQVVRfV0FSTklOR19USFJFU0hPTERfVE9LRU5TID0gMTBfMDAwXG5cbi8vIEluIG5vbi12ZXJib3NlIG1vZGUsIHRydW5jYXRlIGluZGl2aWR1YWwgaW5wdXQgdmFsdWVzIHRvIGtlZXAgdGhlIGhlYWRlclxuLy8gY29tcGFjdC4gTWF0Y2hlcyBCYXNoVG9vbCdzIHBoaWxvc29waHkgb2Ygc2hvd2luZyBlbm91Z2ggdG8gaWRlbnRpZnkgdGhlXG4vLyBjYWxsIHdpdGhvdXQgZHVtcGluZyB0aGUgZW50aXJlIHBheWxvYWQgaW5saW5lLlxuY29uc3QgTUFYX0lOUFVUX1ZBTFVFX0NIQVJTID0gODBcblxuLy8gTWF4IG51bWJlciBvZiB0b3AtbGV2ZWwga2V5cyBiZWZvcmUgd2UgZmFsbCBiYWNrIHRvIHJhdyBKU09OIGRpc3BsYXkuXG4vLyBCZXlvbmQgdGhpcyBhIGZsYXQgazp2IGxpc3QgaXMgbW9yZSBub2lzZSB0aGFuIGhlbHAuXG5jb25zdCBNQVhfRkxBVF9KU09OX0tFWVMgPSAxMlxuXG4vLyBEb24ndCBhdHRlbXB0IGZsYXQtb2JqZWN0IHBhcnNpbmcgZm9yIGxhcmdlIGJsb2JzLlxuY29uc3QgTUFYX0ZMQVRfSlNPTl9DSEFSUyA9IDVfMDAwXG5cbi8vIERvbid0IGF0dGVtcHQgdG8gcGFyc2UgSlNPTiBibG9icyBsYXJnZXIgdGhhbiB0aGlzIChwZXJmIHNhZmV0eSkuXG5jb25zdCBNQVhfSlNPTl9QQVJTRV9DSEFSUyA9IDIwMF8wMDBcblxuLy8gQSBzdHJpbmcgdmFsdWUgaXMgXCJkb21pbmFudCB0ZXh0IHBheWxvYWRcIiBpZiBpdCBoYXMgbmV3bGluZXMgb3IgaXNcbi8vIGxvbmcgZW5vdWdoIHRoYXQgaW5saW5lIGRpc3BsYXkgd291bGQgYmUgd29yc2UgdGhhbiB1bndyYXBwaW5nLlxuY29uc3QgVU5XUkFQX01JTl9TVFJJTkdfTEVOID0gMjAwXG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJUb29sVXNlTWVzc2FnZShcbiAgaW5wdXQ6IHouaW5mZXI8UmV0dXJuVHlwZTx0eXBlb2YgaW5wdXRTY2hlbWE+PixcbiAgeyB2ZXJib3NlIH06IHsgdmVyYm9zZTogYm9vbGVhbiB9LFxuKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgaWYgKE9iamVjdC5rZXlzKGlucHV0KS5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gJydcbiAgfVxuICByZXR1cm4gT2JqZWN0LmVudHJpZXMoaW5wdXQpXG4gICAgLm1hcCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICBsZXQgcmVuZGVyZWQgPSBqc29uU3RyaW5naWZ5KHZhbHVlKVxuICAgICAgaWYgKFxuICAgICAgICBmZWF0dXJlKCdNQ1BfUklDSF9PVVRQVVQnKSAmJlxuICAgICAgICAhdmVyYm9zZSAmJlxuICAgICAgICByZW5kZXJlZC5sZW5ndGggPiBNQVhfSU5QVVRfVkFMVUVfQ0hBUlNcbiAgICAgICkge1xuICAgICAgICByZW5kZXJlZCA9IHJlbmRlcmVkLnNsaWNlKDAsIE1BWF9JTlBVVF9WQUxVRV9DSEFSUykudHJpbUVuZCgpICsgJ+KApidcbiAgICAgIH1cbiAgICAgIHJldHVybiBgJHtrZXl9OiAke3JlbmRlcmVkfWBcbiAgICB9KVxuICAgIC5qb2luKCcsICcpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJUb29sVXNlUHJvZ3Jlc3NNZXNzYWdlKFxuICBwcm9ncmVzc01lc3NhZ2VzRm9yTWVzc2FnZTogUHJvZ3Jlc3NNZXNzYWdlPE1DUFByb2dyZXNzPltdLFxuKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgbGFzdFByb2dyZXNzID0gcHJvZ3Jlc3NNZXNzYWdlc0Zvck1lc3NhZ2UuYXQoLTEpXG5cbiAgaWYgKCFsYXN0UHJvZ3Jlc3M/LmRhdGEpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPE1lc3NhZ2VSZXNwb25zZSBoZWlnaHQ9ezF9PlxuICAgICAgICA8VGV4dCBkaW1Db2xvcj5SdW5uaW5n4oCmPC9UZXh0PlxuICAgICAgPC9NZXNzYWdlUmVzcG9uc2U+XG4gICAgKVxuICB9XG5cbiAgY29uc3QgeyBwcm9ncmVzcywgdG90YWwsIHByb2dyZXNzTWVzc2FnZSB9ID0gbGFzdFByb2dyZXNzLmRhdGFcblxuICBpZiAocHJvZ3Jlc3MgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiAoXG4gICAgICA8TWVzc2FnZVJlc3BvbnNlIGhlaWdodD17MX0+XG4gICAgICAgIDxUZXh0IGRpbUNvbG9yPlJ1bm5pbmfigKY8L1RleHQ+XG4gICAgICA8L01lc3NhZ2VSZXNwb25zZT5cbiAgICApXG4gIH1cblxuICBpZiAodG90YWwgIT09IHVuZGVmaW5lZCAmJiB0b3RhbCA+IDApIHtcbiAgICBjb25zdCByYXRpbyA9IE1hdGgubWluKDEsIE1hdGgubWF4KDAsIHByb2dyZXNzIC8gdG90YWwpKVxuICAgIGNvbnN0IHBlcmNlbnRhZ2UgPSBNYXRoLnJvdW5kKHJhdGlvICogMTAwKVxuICAgIHJldHVybiAoXG4gICAgICA8TWVzc2FnZVJlc3BvbnNlPlxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICB7cHJvZ3Jlc3NNZXNzYWdlICYmIDxUZXh0IGRpbUNvbG9yPntwcm9ncmVzc01lc3NhZ2V9PC9UZXh0Pn1cbiAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIiBnYXA9ezF9PlxuICAgICAgICAgICAgPFByb2dyZXNzQmFyIHJhdGlvPXtyYXRpb30gd2lkdGg9ezIwfSAvPlxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+e3BlcmNlbnRhZ2V9JTwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICA8L01lc3NhZ2VSZXNwb25zZT5cbiAgICApXG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxNZXNzYWdlUmVzcG9uc2UgaGVpZ2h0PXsxfT5cbiAgICAgIDxUZXh0IGRpbUNvbG9yPntwcm9ncmVzc01lc3NhZ2UgPz8gYFByb2Nlc3NpbmfigKYgJHtwcm9ncmVzc31gfTwvVGV4dD5cbiAgICA8L01lc3NhZ2VSZXNwb25zZT5cbiAgKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyVG9vbFJlc3VsdE1lc3NhZ2UoXG4gIG91dHB1dDogc3RyaW5nIHwgTUNQVG9vbFJlc3VsdCxcbiAgX3Byb2dyZXNzTWVzc2FnZXNGb3JNZXNzYWdlOiBQcm9ncmVzc01lc3NhZ2U8VG9vbFByb2dyZXNzRGF0YT5bXSxcbiAgeyB2ZXJib3NlLCBpbnB1dCB9OiB7IHZlcmJvc2U6IGJvb2xlYW47IGlucHV0PzogdW5rbm93biB9LFxuKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgbWNwT3V0cHV0ID0gb3V0cHV0IGFzIE1DUFRvb2xSZXN1bHRcblxuICBpZiAoIXZlcmJvc2UpIHtcbiAgICBjb25zdCBzbGFja1NlbmQgPSB0cnlTbGFja1NlbmRDb21wYWN0KG1jcE91dHB1dCwgaW5wdXQpXG4gICAgaWYgKHNsYWNrU2VuZCAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPE1lc3NhZ2VSZXNwb25zZSBoZWlnaHQ9ezF9PlxuICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgU2VudCBhIG1lc3NhZ2UgdG97JyAnfVxuICAgICAgICAgICAgPEFuc2k+e2NyZWF0ZUh5cGVybGluayhzbGFja1NlbmQudXJsLCBzbGFja1NlbmQuY2hhbm5lbCl9PC9BbnNpPlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9NZXNzYWdlUmVzcG9uc2U+XG4gICAgICApXG4gICAgfVxuICB9XG5cbiAgY29uc3QgZXN0aW1hdGVkVG9rZW5zID0gZ2V0Q29udGVudFNpemVFc3RpbWF0ZShtY3BPdXRwdXQpXG4gIGNvbnN0IHNob3dXYXJuaW5nID0gZXN0aW1hdGVkVG9rZW5zID4gTUNQX09VVFBVVF9XQVJOSU5HX1RIUkVTSE9MRF9UT0tFTlNcbiAgY29uc3Qgd2FybmluZ01lc3NhZ2UgPSBzaG93V2FybmluZ1xuICAgID8gYCR7ZmlndXJlcy53YXJuaW5nfSBMYXJnZSBNQ1AgcmVzcG9uc2UgKH4ke2Zvcm1hdE51bWJlcihlc3RpbWF0ZWRUb2tlbnMpfSB0b2tlbnMpLCB0aGlzIGNhbiBmaWxsIHVwIGNvbnRleHQgcXVpY2tseWBcbiAgICA6IG51bGxcblxuICBsZXQgY29udGVudEVsZW1lbnQ6IFJlYWN0LlJlYWN0Tm9kZVxuICBpZiAoQXJyYXkuaXNBcnJheShtY3BPdXRwdXQpKSB7XG4gICAgY29uc3QgY29udGVudEJsb2NrcyA9IG1jcE91dHB1dC5tYXAoKGl0ZW0sIGkpID0+IHtcbiAgICAgIGlmIChpdGVtLnR5cGUgPT09ICdpbWFnZScpIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8Qm94XG4gICAgICAgICAgICBrZXk9e2l9XG4gICAgICAgICAgICBqdXN0aWZ5Q29udGVudD1cInNwYWNlLWJldHdlZW5cIlxuICAgICAgICAgICAgb3ZlcmZsb3dYPVwiaGlkZGVuXCJcbiAgICAgICAgICAgIHdpZHRoPVwiMTAwJVwiXG4gICAgICAgICAgPlxuICAgICAgICAgICAgPE1lc3NhZ2VSZXNwb25zZSBoZWlnaHQ9ezF9PlxuICAgICAgICAgICAgICA8VGV4dD5bSW1hZ2VdPC9UZXh0PlxuICAgICAgICAgICAgPC9NZXNzYWdlUmVzcG9uc2U+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIC8vIEZvciB0ZXh0IGJsb2NrcyBhbmQgYW55IG90aGVyIGJsb2NrIHR5cGVzLCBleHRyYWN0IHRleHQgaWYgYXZhaWxhYmxlXG4gICAgICBjb25zdCB0ZXh0Q29udGVudCA9XG4gICAgICAgIGl0ZW0udHlwZSA9PT0gJ3RleHQnICYmXG4gICAgICAgICd0ZXh0JyBpbiBpdGVtICYmXG4gICAgICAgIGl0ZW0udGV4dCAhPT0gbnVsbCAmJlxuICAgICAgICBpdGVtLnRleHQgIT09IHVuZGVmaW5lZFxuICAgICAgICAgID8gU3RyaW5nKGl0ZW0udGV4dClcbiAgICAgICAgICA6ICcnXG4gICAgICByZXR1cm4gZmVhdHVyZSgnTUNQX1JJQ0hfT1VUUFVUJykgPyAoXG4gICAgICAgIDxNQ1BUZXh0T3V0cHV0IGtleT17aX0gY29udGVudD17dGV4dENvbnRlbnR9IHZlcmJvc2U9e3ZlcmJvc2V9IC8+XG4gICAgICApIDogKFxuICAgICAgICA8T3V0cHV0TGluZSBrZXk9e2l9IGNvbnRlbnQ9e3RleHRDb250ZW50fSB2ZXJib3NlPXt2ZXJib3NlfSAvPlxuICAgICAgKVxuICAgIH0pXG5cbiAgICAvLyBXcmFwIGFycmF5IGNvbnRlbnQgaW4gYSBjb2x1bW4gbGF5b3V0XG4gICAgY29udGVudEVsZW1lbnQgPSAoXG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiB3aWR0aD1cIjEwMCVcIj5cbiAgICAgICAge2NvbnRlbnRCbG9ja3N9XG4gICAgICA8L0JveD5cbiAgICApXG4gIH0gZWxzZSBpZiAoIW1jcE91dHB1dCkge1xuICAgIGNvbnRlbnRFbGVtZW50ID0gKFxuICAgICAgPEJveCBqdXN0aWZ5Q29udGVudD1cInNwYWNlLWJldHdlZW5cIiBvdmVyZmxvd1g9XCJoaWRkZW5cIiB3aWR0aD1cIjEwMCVcIj5cbiAgICAgICAgPE1lc3NhZ2VSZXNwb25zZSBoZWlnaHQ9ezF9PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPihObyBjb250ZW50KTwvVGV4dD5cbiAgICAgICAgPC9NZXNzYWdlUmVzcG9uc2U+XG4gICAgICA8L0JveD5cbiAgICApXG4gIH0gZWxzZSB7XG4gICAgY29udGVudEVsZW1lbnQgPSBmZWF0dXJlKCdNQ1BfUklDSF9PVVRQVVQnKSA/IChcbiAgICAgIDxNQ1BUZXh0T3V0cHV0IGNvbnRlbnQ9e21jcE91dHB1dH0gdmVyYm9zZT17dmVyYm9zZX0gLz5cbiAgICApIDogKFxuICAgICAgPE91dHB1dExpbmUgY29udGVudD17bWNwT3V0cHV0fSB2ZXJib3NlPXt2ZXJib3NlfSAvPlxuICAgIClcbiAgfVxuXG4gIGlmICh3YXJuaW5nTWVzc2FnZSkge1xuICAgIHJldHVybiAoXG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgPE1lc3NhZ2VSZXNwb25zZSBoZWlnaHQ9ezF9PlxuICAgICAgICAgIDxUZXh0IGNvbG9yPVwid2FybmluZ1wiPnt3YXJuaW5nTWVzc2FnZX08L1RleHQ+XG4gICAgICAgIDwvTWVzc2FnZVJlc3BvbnNlPlxuICAgICAgICB7Y29udGVudEVsZW1lbnR9XG4gICAgICA8L0JveD5cbiAgICApXG4gIH1cblxuICByZXR1cm4gY29udGVudEVsZW1lbnRcbn1cblxuLyoqXG4gKiBSZW5kZXIgTUNQIHRleHQgb3V0cHV0LiBUcmllcyB0aHJlZSBzdHJhdGVnaWVzIGluIG9yZGVyOlxuICogMS4gSWYgSlNPTiB3cmFwcyBhIHNpbmdsZSBkb21pbmFudCB0ZXh0IHBheWxvYWQgKGUuZy4gc2xhY2snc1xuICogICAge1wibWVzc2FnZXNcIjpcImxpbmUxXFxubGluZTIuLi5cIn0pLCB1bndyYXAgYW5kIGxldCBPdXRwdXRMaW5lIHRydW5jYXRlLlxuICogMi4gSWYgSlNPTiBpcyBhIHNtYWxsIGZsYXQtaXNoIG9iamVjdCwgcmVuZGVyIGFzIGFsaWduZWQga2V5OiB2YWx1ZS5cbiAqIDMuIE90aGVyd2lzZSBmYWxsIHRocm91Z2ggdG8gT3V0cHV0TGluZSAocHJldHR5LXByaW50ICsgdHJ1bmNhdGUpLlxuICovXG5mdW5jdGlvbiBNQ1BUZXh0T3V0cHV0KHtcbiAgY29udGVudCxcbiAgdmVyYm9zZSxcbn06IHtcbiAgY29udGVudDogc3RyaW5nXG4gIHZlcmJvc2U6IGJvb2xlYW5cbn0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCB1bndyYXBwZWQgPSB0cnlVbndyYXBUZXh0UGF5bG9hZChjb250ZW50KVxuICBpZiAodW53cmFwcGVkICE9PSBudWxsKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxNZXNzYWdlUmVzcG9uc2U+XG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgIHt1bndyYXBwZWQuZXh0cmFzLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgIHt1bndyYXBwZWQuZXh0cmFzLm1hcCgoW2ssIHZdKSA9PiBgJHtrfTogJHt2fWApLmpvaW4oJyDCtyAnKX1cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICApfVxuICAgICAgICAgIDxPdXRwdXRMaW5lIGNvbnRlbnQ9e3Vud3JhcHBlZC5ib2R5fSB2ZXJib3NlPXt2ZXJib3NlfSBsaW5raWZ5VXJscyAvPlxuICAgICAgICA8L0JveD5cbiAgICAgIDwvTWVzc2FnZVJlc3BvbnNlPlxuICAgIClcbiAgfVxuICBjb25zdCBmbGF0ID0gdHJ5RmxhdHRlbkpzb24oY29udGVudClcbiAgaWYgKGZsYXQgIT09IG51bGwpIHtcbiAgICBjb25zdCBtYXhLZXlXaWR0aCA9IE1hdGgubWF4KC4uLmZsYXQubWFwKChba10pID0+IHN0cmluZ1dpZHRoKGspKSlcbiAgICByZXR1cm4gKFxuICAgICAgPE1lc3NhZ2VSZXNwb25zZT5cbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAge2ZsYXQubWFwKChba2V5LCB2YWx1ZV0sIGkpID0+IChcbiAgICAgICAgICAgIDxUZXh0IGtleT17aX0+XG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntrZXkucGFkRW5kKG1heEtleVdpZHRoKX06IDwvVGV4dD5cbiAgICAgICAgICAgICAgPEFuc2k+e2xpbmtpZnlVcmxzSW5UZXh0KHZhbHVlKX08L0Fuc2k+XG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgKSl9XG4gICAgICAgIDwvQm94PlxuICAgICAgPC9NZXNzYWdlUmVzcG9uc2U+XG4gICAgKVxuICB9XG4gIHJldHVybiA8T3V0cHV0TGluZSBjb250ZW50PXtjb250ZW50fSB2ZXJib3NlPXt2ZXJib3NlfSBsaW5raWZ5VXJscyAvPlxufVxuXG4vKipcbiAqIFBhcnNlIGNvbnRlbnQgYXMgYSBKU09OIG9iamVjdCBhbmQgcmV0dXJuIGl0cyBlbnRyaWVzLiBOdWxsIGlmIGNvbnRlbnRcbiAqIGRvZXNuJ3QgcGFyc2UsIGlzbid0IGFuIG9iamVjdCwgaXMgdG9vIGxhcmdlLCBvciBoYXMgMC90b28tbWFueSBrZXlzLlxuICovXG5mdW5jdGlvbiBwYXJzZUpzb25FbnRyaWVzKFxuICBjb250ZW50OiBzdHJpbmcsXG4gIHsgbWF4Q2hhcnMsIG1heEtleXMgfTogeyBtYXhDaGFyczogbnVtYmVyOyBtYXhLZXlzOiBudW1iZXIgfSxcbik6IFtzdHJpbmcsIHVua25vd25dW10gfCBudWxsIHtcbiAgY29uc3QgdHJpbW1lZCA9IGNvbnRlbnQudHJpbSgpXG4gIGlmICh0cmltbWVkLmxlbmd0aCA9PT0gMCB8fCB0cmltbWVkLmxlbmd0aCA+IG1heENoYXJzIHx8IHRyaW1tZWRbMF0gIT09ICd7Jykge1xuICAgIHJldHVybiBudWxsXG4gIH1cbiAgbGV0IHBhcnNlZDogdW5rbm93blxuICB0cnkge1xuICAgIHBhcnNlZCA9IGpzb25QYXJzZSh0cmltbWVkKVxuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbFxuICB9XG4gIGlmIChwYXJzZWQgPT09IG51bGwgfHwgdHlwZW9mIHBhcnNlZCAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShwYXJzZWQpKSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxuICBjb25zdCBlbnRyaWVzID0gT2JqZWN0LmVudHJpZXMocGFyc2VkKVxuICBpZiAoZW50cmllcy5sZW5ndGggPT09IDAgfHwgZW50cmllcy5sZW5ndGggPiBtYXhLZXlzKSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxuICByZXR1cm4gZW50cmllc1xufVxuXG4vKipcbiAqIElmIGNvbnRlbnQgcGFyc2VzIGFzIGEgSlNPTiBvYmplY3Qgd2hlcmUgZXZlcnkgdmFsdWUgaXMgYSBzY2FsYXIgb3IgYVxuICogc21hbGwgbmVzdGVkIG9iamVjdCwgZmxhdHRlbiBpdCB0byBba2V5LCBkaXNwbGF5VmFsdWVdIHBhaXJzLiBOZXN0ZWRcbiAqIG9iamVjdHMgZ2V0IG9uZS1saW5lIEpTT04uIFJldHVybnMgbnVsbCBpZiBjb250ZW50IGRvZXNuJ3QgcXVhbGlmeS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRyeUZsYXR0ZW5Kc29uKGNvbnRlbnQ6IHN0cmluZyk6IFtzdHJpbmcsIHN0cmluZ11bXSB8IG51bGwge1xuICBjb25zdCBlbnRyaWVzID0gcGFyc2VKc29uRW50cmllcyhjb250ZW50LCB7XG4gICAgbWF4Q2hhcnM6IE1BWF9GTEFUX0pTT05fQ0hBUlMsXG4gICAgbWF4S2V5czogTUFYX0ZMQVRfSlNPTl9LRVlTLFxuICB9KVxuICBpZiAoZW50cmllcyA9PT0gbnVsbCkgcmV0dXJuIG51bGxcbiAgY29uc3QgcmVzdWx0OiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXVxuICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBlbnRyaWVzKSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJlc3VsdC5wdXNoKFtrZXksIHZhbHVlXSlcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgdmFsdWUgPT09IG51bGwgfHxcbiAgICAgIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgfHxcbiAgICAgIHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nXG4gICAgKSB7XG4gICAgICByZXN1bHQucHVzaChba2V5LCBTdHJpbmcodmFsdWUpXSlcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGNvbnN0IGNvbXBhY3QgPSBqc29uU3RyaW5naWZ5KHZhbHVlKVxuICAgICAgaWYgKGNvbXBhY3QubGVuZ3RoID4gMTIwKSByZXR1cm4gbnVsbFxuICAgICAgcmVzdWx0LnB1c2goW2tleSwgY29tcGFjdF0pXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsXG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHRcbn1cblxuLyoqXG4gKiBJZiBjb250ZW50IGlzIGEgSlNPTiBvYmplY3Qgd2hlcmUgb25lIGtleSBob2xkcyBhIGRvbWluYW50IHN0cmluZyBwYXlsb2FkXG4gKiAobXVsdGlsaW5lIG9yIGxvbmcpIGFuZCBhbGwgc2libGluZ3MgYXJlIHNtYWxsIHNjYWxhcnMsIHVud3JhcCBpdC4gVGhpc1xuICogaGFuZGxlcyB0aGUgY29tbW9uIE1DUCBwYXR0ZXJuIG9mIHtcIm1lc3NhZ2VzXCI6XCJsaW5lMVxcbmxpbmUyLi4uXCJ9IHdoZXJlXG4gKiBwcmV0dHktcHJpbnRpbmcga2VlcHMgXFxuIGVzY2FwZWQgYnV0IHdlIHdhbnQgcmVhbCBsaW5lIGJyZWFrcyArIHRydW5jYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cnlVbndyYXBUZXh0UGF5bG9hZChcbiAgY29udGVudDogc3RyaW5nLFxuKTogeyBib2R5OiBzdHJpbmc7IGV4dHJhczogW3N0cmluZywgc3RyaW5nXVtdIH0gfCBudWxsIHtcbiAgY29uc3QgZW50cmllcyA9IHBhcnNlSnNvbkVudHJpZXMoY29udGVudCwge1xuICAgIG1heENoYXJzOiBNQVhfSlNPTl9QQVJTRV9DSEFSUyxcbiAgICBtYXhLZXlzOiA0LFxuICB9KVxuICBpZiAoZW50cmllcyA9PT0gbnVsbCkgcmV0dXJuIG51bGxcbiAgLy8gRmluZCB0aGUgb25lIGRvbWluYW50IHN0cmluZyBwYXlsb2FkLiBUcmltIGZpcnN0OiBhIHRyYWlsaW5nIFxcbiBvbiBhXG4gIC8vIHNob3J0IHNpYmxpbmcgKGUuZy4gcGFnaW5hdGlvbiBoaW50cykgc2hvdWxkbid0IG1ha2UgaXQgXCJkb21pbmFudFwiLlxuICBsZXQgYm9keTogc3RyaW5nIHwgbnVsbCA9IG51bGxcbiAgY29uc3QgZXh0cmFzOiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXVxuICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBlbnRyaWVzKSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGNvbnN0IHQgPSB2YWx1ZS50cmltRW5kKClcbiAgICAgIGNvbnN0IGlzRG9taW5hbnQgPVxuICAgICAgICB0Lmxlbmd0aCA+IFVOV1JBUF9NSU5fU1RSSU5HX0xFTiB8fCAodC5pbmNsdWRlcygnXFxuJykgJiYgdC5sZW5ndGggPiA1MClcbiAgICAgIGlmIChpc0RvbWluYW50KSB7XG4gICAgICAgIGlmIChib2R5ICE9PSBudWxsKSByZXR1cm4gbnVsbCAvLyB0d28gYmlnIHN0cmluZ3Mg4oCUIGFtYmlndW91c1xuICAgICAgICBib2R5ID0gdFxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuICAgICAgaWYgKHQubGVuZ3RoID4gMTUwKSByZXR1cm4gbnVsbFxuICAgICAgZXh0cmFzLnB1c2goW2tleSwgdC5yZXBsYWNlKC9cXHMrL2csICcgJyldKVxuICAgIH0gZWxzZSBpZiAoXG4gICAgICB2YWx1ZSA9PT0gbnVsbCB8fFxuICAgICAgdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyB8fFxuICAgICAgdHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbidcbiAgICApIHtcbiAgICAgIGV4dHJhcy5wdXNoKFtrZXksIFN0cmluZyh2YWx1ZSldKVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbCAvLyBuZXN0ZWQgb2JqZWN0L2FycmF5IOKAlCB1c2UgZmxhdCBvciBwcmV0dHktcHJpbnQgcGF0aFxuICAgIH1cbiAgfVxuICBpZiAoYm9keSA9PT0gbnVsbCkgcmV0dXJuIG51bGxcbiAgcmV0dXJuIHsgYm9keSwgZXh0cmFzIH1cbn1cblxuY29uc3QgU0xBQ0tfQVJDSElWRVNfUkUgPVxuICAvXmh0dHBzOlxcL1xcL1thLXowLTktXStcXC5zbGFja1xcLmNvbVxcL2FyY2hpdmVzXFwvKFtBLVowLTldKylcXC9wXFxkKyQvXG5cbi8qKlxuICogRGV0ZWN0IGEgU2xhY2sgc2VuZC1tZXNzYWdlIHJlc3VsdCBhbmQgcmV0dXJuIGEgY29tcGFjdCB7Y2hhbm5lbCwgdXJsfSBwYWlyLlxuICogTWF0Y2hlcyBib3RoIGhvc3RlZCAoY2xhdWRlLmFpIFNsYWNrKSBhbmQgY29tbXVuaXR5IE1DUCBzZXJ2ZXIgc2hhcGVzIOKAlFxuICogYm90aCByZXR1cm4gYG1lc3NhZ2VfbGlua2AgaW4gdGhlIHJlc3VsdC4gVGhlIGNoYW5uZWwgbGFiZWwgcHJlZmVycyB0aGVcbiAqIHRvb2wgaW5wdXQgKG1heSBiZSBhIG5hbWUgbGlrZSBcIiNmb29cIiBvciBhbiBJRCBsaWtlIFwiQzA5RVZEQU4xTktcIikgYW5kXG4gKiBmYWxscyBiYWNrIHRvIHRoZSBJRCBwYXJzZWQgZnJvbSB0aGUgYXJjaGl2ZXMgVVJMLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJ5U2xhY2tTZW5kQ29tcGFjdChcbiAgb3V0cHV0OiBzdHJpbmcgfCBNQ1BUb29sUmVzdWx0LFxuICBpbnB1dDogdW5rbm93bixcbik6IHsgY2hhbm5lbDogc3RyaW5nOyB1cmw6IHN0cmluZyB9IHwgbnVsbCB7XG4gIGxldCB0ZXh0OiB1bmtub3duID0gb3V0cHV0XG4gIGlmIChBcnJheS5pc0FycmF5KG91dHB1dCkpIHtcbiAgICBjb25zdCBibG9jayA9IG91dHB1dC5maW5kKGIgPT4gYi50eXBlID09PSAndGV4dCcpXG4gICAgdGV4dCA9IGJsb2NrICYmICd0ZXh0JyBpbiBibG9jayA/IGJsb2NrLnRleHQgOiB1bmRlZmluZWRcbiAgfVxuICBpZiAodHlwZW9mIHRleHQgIT09ICdzdHJpbmcnIHx8ICF0ZXh0LmluY2x1ZGVzKCdcIm1lc3NhZ2VfbGlua1wiJykpIHtcbiAgICByZXR1cm4gbnVsbFxuICB9XG5cbiAgY29uc3QgZW50cmllcyA9IHBhcnNlSnNvbkVudHJpZXModGV4dCwgeyBtYXhDaGFyczogMjAwMCwgbWF4S2V5czogNiB9KVxuICBjb25zdCB1cmwgPSBlbnRyaWVzPy5maW5kKChba10pID0+IGsgPT09ICdtZXNzYWdlX2xpbmsnKT8uWzFdXG4gIGlmICh0eXBlb2YgdXJsICE9PSAnc3RyaW5nJykgcmV0dXJuIG51bGxcbiAgY29uc3QgbSA9IFNMQUNLX0FSQ0hJVkVTX1JFLmV4ZWModXJsKVxuICBpZiAoIW0pIHJldHVybiBudWxsXG5cbiAgY29uc3QgaW5wID0gaW5wdXQgYXMgeyBjaGFubmVsX2lkPzogdW5rbm93bjsgY2hhbm5lbD86IHVua25vd24gfSB8IHVuZGVmaW5lZFxuICBjb25zdCByYXcgPSBpbnA/LmNoYW5uZWxfaWQgPz8gaW5wPy5jaGFubmVsID8/IG1bMV1cbiAgY29uc3QgbGFiZWwgPSB0eXBlb2YgcmF3ID09PSAnc3RyaW5nJyAmJiByYXcgPyByYXcgOiAnc2xhY2snXG4gIHJldHVybiB7IGNoYW5uZWw6IGxhYmVsLnN0YXJ0c1dpdGgoJyMnKSA/IGxhYmVsIDogYCMke2xhYmVsfWAsIHVybCB9XG59XG4iXSwibWFwcGluZ3MiOiI7QUFBQSxTQUFTQSxPQUFPLFFBQVEsWUFBWTtBQUNwQyxPQUFPQyxPQUFPLE1BQU0sU0FBUztBQUM3QixPQUFPLEtBQUtDLEtBQUssTUFBTSxPQUFPO0FBQzlCLGNBQWNDLENBQUMsUUFBUSxRQUFRO0FBQy9CLFNBQVNDLFdBQVcsUUFBUSwrQ0FBK0M7QUFDM0UsU0FBU0MsZUFBZSxRQUFRLHFDQUFxQztBQUNyRSxTQUNFQyxpQkFBaUIsRUFDakJDLFVBQVUsUUFDTCxzQ0FBc0M7QUFDN0MsU0FBU0MsV0FBVyxRQUFRLDBCQUEwQjtBQUN0RCxTQUFTQyxJQUFJLEVBQUVDLEdBQUcsRUFBRUMsSUFBSSxRQUFRLGNBQWM7QUFDOUMsY0FBY0MsZ0JBQWdCLFFBQVEsZUFBZTtBQUNyRCxjQUFjQyxlQUFlLFFBQVEsd0JBQXdCO0FBQzdELGNBQWNDLFdBQVcsUUFBUSxzQkFBc0I7QUFDdkQsU0FBU0MsWUFBWSxRQUFRLHVCQUF1QjtBQUNwRCxTQUFTQyxlQUFlLFFBQVEsMEJBQTBCO0FBQzFELFNBQ0VDLHNCQUFzQixFQUN0QixLQUFLQyxhQUFhLFFBQ2IsOEJBQThCO0FBQ3JDLFNBQVNDLFNBQVMsRUFBRUMsYUFBYSxRQUFRLCtCQUErQjtBQUN4RSxjQUFjQyxXQUFXLFFBQVEsY0FBYzs7QUFFL0M7QUFDQSxNQUFNQyxtQ0FBbUMsR0FBRyxNQUFNOztBQUVsRDtBQUNBO0FBQ0E7QUFDQSxNQUFNQyxxQkFBcUIsR0FBRyxFQUFFOztBQUVoQztBQUNBO0FBQ0EsTUFBTUMsa0JBQWtCLEdBQUcs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