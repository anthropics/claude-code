import { c as _c } from "react/compiler-runtime";
import { marked, type Token, type Tokens } from 'marked';
import React, { Suspense, use, useMemo, useRef } from 'react';
import { useSettings } from '../hooks/useSettings.js';
import { Ansi, Box, useTheme } from '../ink.js';
import { type CliHighlight, getCliHighlightPromise } from '../utils/cliHighlight.js';
import { hashContent } from '../utils/hash.js';
import { configureMarked, formatToken } from '../utils/markdown.js';
import { stripPromptXMLTags } from '../utils/messages.js';
import { MarkdownTable } from './MarkdownTable.js';
type Props = {
  children: string;
  /** When true, render all text content as dim */
  dimColor?: boolean;
};

// Module-level token cache — marked.lexer is the hot cost on virtual-scroll
// remounts (~3ms per message). useMemo doesn't survive unmount→remount, so
// scrolling back to a previously-visible message re-parses. Messages are
// immutable in history; same content → same tokens. Keyed by hash to avoid
// retaining full content strings (turn50→turn99 RSS regression, #24180).
const TOKEN_CACHE_MAX = 500;
const tokenCache = new Map<string, Token[]>();

// Characters that indicate markdown syntax. If none are present, skip the
// ~3ms marked.lexer call entirely — render as a single paragraph. Covers
// the majority of short assistant responses and user prompts that are
// plain sentences. Checked via indexOf (not regex) for speed.
// Single regex: matches any MD marker or ordered-list start (N. at line start).
// One pass instead of 10× includes scans.
const MD_SYNTAX_RE = /[#*`|[>\-_~]|\n\n|^\d+\. |\n\d+\. /;
function hasMarkdownSyntax(s: string): boolean {
  // Sample first 500 chars — if markdown exists it's usually early (headers,
  // code fence, list). Long tool outputs are mostly plain text tails.
  return MD_SYNTAX_RE.test(s.length > 500 ? s.slice(0, 500) : s);
}
function cachedLexer(content: string): Token[] {
  // Fast path: plain text with no markdown syntax → single paragraph token.
  // Skips marked.lexer's full GFM parse (~3ms on long content). Not cached —
  // reconstruction is a single object allocation, and caching would retain
  // 4× content in raw/text fields plus the hash key for zero benefit.
  if (!hasMarkdownSyntax(content)) {
    return [{
      type: 'paragraph',
      raw: content,
      text: content,
      tokens: [{
        type: 'text',
        raw: content,
        text: content
      }]
    } as Token];
  }
  const key = hashContent(content);
  const hit = tokenCache.get(key);
  if (hit) {
    // Promote to MRU — without this the eviction is FIFO (scrolling back to
    // an early message evicts the very item you're looking at).
    tokenCache.delete(key);
    tokenCache.set(key, hit);
    return hit;
  }
  const tokens = marked.lexer(content);
  if (tokenCache.size >= TOKEN_CACHE_MAX) {
    // LRU-ish: drop oldest. Map preserves insertion order.
    const first = tokenCache.keys().next().value;
    if (first !== undefined) tokenCache.delete(first);
  }
  tokenCache.set(key, tokens);
  return tokens;
}

/**
 * Renders markdown content using a hybrid approach:
 * - Tables are rendered as React components with proper flexbox layout
 * - Other content is rendered as ANSI strings via formatToken
 */
export function Markdown(props) {
  const $ = _c(4);
  const settings = useSettings();
  if (settings.syntaxHighlightingDisabled) {
    let t0;
    if ($[0] !== props) {
      t0 = <MarkdownBody {...props} highlight={null} />;
      $[0] = props;
      $[1] = t0;
    } else {
      t0 = $[1];
    }
    return t0;
  }
  let t0;
  if ($[2] !== props) {
    t0 = <Suspense fallback={<MarkdownBody {...props} highlight={null} />}><MarkdownWithHighlight {...props} /></Suspense>;
    $[2] = props;
    $[3] = t0;
  } else {
    t0 = $[3];
  }
  return t0;
}
function MarkdownWithHighlight(props) {
  const $ = _c(4);
  let t0;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t0 = getCliHighlightPromise();
    $[0] = t0;
  } else {
    t0 = $[0];
  }
  const highlight = use(t0);
  let t1;
  if ($[1] !== highlight || $[2] !== props) {
    t1 = <MarkdownBody {...props} highlight={highlight} />;
    $[1] = highlight;
    $[2] = props;
    $[3] = t1;
  } else {
    t1 = $[3];
  }
  return t1;
}
function MarkdownBody(t0) {
  const $ = _c(7);
  const {
    children,
    dimColor,
    highlight
  } = t0;
  const [theme] = useTheme();
  configureMarked();
  let elements;
  if ($[0] !== children || $[1] !== dimColor || $[2] !== highlight || $[3] !== theme) {
    const tokens = cachedLexer(stripPromptXMLTags(children));
    elements = [];
    let nonTableContent = "";
    const flushNonTableContent = function flushNonTableContent() {
      if (nonTableContent) {
        elements.push(<Ansi key={elements.length} dimColor={dimColor}>{nonTableContent.trim()}</Ansi>);
        nonTableContent = "";
      }
    };
    for (const token of tokens) {
      if (token.type === "table") {
        flushNonTableContent();
        elements.push(<MarkdownTable key={elements.length} token={token as Tokens.Table} highlight={highlight} />);
      } else {
        nonTableContent = nonTableContent + formatToken(token, theme, 0, null, null, highlight);
        nonTableContent;
      }
    }
    flushNonTableContent();
    $[0] = children;
    $[1] = dimColor;
    $[2] = highlight;
    $[3] = theme;
    $[4] = elements;
  } else {
    elements = $[4];
  }
  const elements_0 = elements;
  let t1;
  if ($[5] !== elements_0) {
    t1 = <Box flexDirection="column" gap={1}>{elements_0}</Box>;
    $[5] = elements_0;
    $[6] = t1;
  } else {
    t1 = $[6];
  }
  return t1;
}
type StreamingProps = {
  children: string;
};

/**
 * Renders markdown during streaming by splitting at the last top-level block
 * boundary: everything before is stable (memoized, never re-parsed), only the
 * final block is re-parsed per delta. marked.lexer() correctly handles
 * unclosed code fences as a single token, so block boundaries are always safe.
 *
 * The stable boundary only advances (monotonic), so ref mutation during render
 * is idempotent and safe under StrictMode double-rendering. Component unmounts
 * between turns (streamingText → null), resetting the ref.
 */
export function StreamingMarkdown({
  children
}: StreamingProps): React.ReactNode {
  // React Compiler: this component reads and writes stablePrefixRef.current
  // during render by design. The boundary only advances (monotonic), so
  // the ref mutation is idempotent under StrictMode double-render — but the
  // compiler can't prove that, and memoizing around the ref reads would
  // break the algorithm (stale boundary). Opt out.
  'use no memo';

  configureMarked();

  // Strip before boundary tracking so it matches <Markdown>'s stripping
  // (line 29). When a closing tag arrives, stripped(N+1) is not a prefix
  // of stripped(N), but the startsWith reset below handles that with a
  // one-time re-lex on the smaller stripped string.
  const stripped = stripPromptXMLTags(children);
  const stablePrefixRef = useRef('');

  // Reset if text was replaced (defensive; normally unmount handles this)
  if (!stripped.startsWith(stablePrefixRef.current)) {
    stablePrefixRef.current = '';
  }

  // Lex only from current boundary — O(unstable length), not O(full text)
  const boundary = stablePrefixRef.current.length;
  const tokens = marked.lexer(stripped.substring(boundary));

  // Last non-space token is the growing block; everything before is final
  let lastContentIdx = tokens.length - 1;
  while (lastContentIdx >= 0 && tokens[lastContentIdx]!.type === 'space') {
    lastContentIdx--;
  }
  let advance = 0;
  for (let i = 0; i < lastContentIdx; i++) {
    advance += tokens[i]!.raw.length;
  }
  if (advance > 0) {
    stablePrefixRef.current = stripped.substring(0, boundary + advance);
  }
  const stablePrefix = stablePrefixRef.current;
  const unstableSuffix = stripped.substring(stablePrefix.length);

  // stablePrefix is memoized inside <Markdown> via useMemo([children, ...])
  // so it never re-parses as the unstable suffix grows
  return <Box flexDirection="column" gap={1}>
      {stablePrefix && <Markdown>{stablePrefix}</Markdown>}
      {unstableSuffix && <Markdown>{unstableSuffix}</Markdown>}
    </Box>;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJtYXJrZWQiLCJUb2tlbiIsIlRva2VucyIsIlJlYWN0IiwiU3VzcGVuc2UiLCJ1c2UiLCJ1c2VNZW1vIiwidXNlUmVmIiwidXNlU2V0dGluZ3MiLCJBbnNpIiwiQm94IiwidXNlVGhlbWUiLCJDbGlIaWdobGlnaHQiLCJnZXRDbGlIaWdobGlnaHRQcm9taXNlIiwiaGFzaENvbnRlbnQiLCJjb25maWd1cmVNYXJrZWQiLCJmb3JtYXRUb2tlbiIsInN0cmlwUHJvbXB0WE1MVGFncyIsIk1hcmtkb3duVGFibGUiLCJQcm9wcyIsImNoaWxkcmVuIiwiZGltQ29sb3IiLCJUT0tFTl9DQUNIRV9NQVgiLCJ0b2tlbkNhY2hlIiwiTWFwIiwiTURfU1lOVEFYX1JFIiwiaGFzTWFya2Rvd25TeW50YXgiLCJzIiwidGVzdCIsImxlbmd0aCIsInNsaWNlIiwiY2FjaGVkTGV4ZXIiLCJjb250ZW50IiwidHlwZSIsInJhdyIsInRleHQiLCJ0b2tlbnMiLCJrZXkiLCJoaXQiLCJnZXQiLCJkZWxldGUiLCJzZXQiLCJsZXhlciIsInNpemUiLCJmaXJzdCIsImtleXMiLCJuZXh0IiwidmFsdWUiLCJ1bmRlZmluZWQiLCJNYXJrZG93biIsInByb3BzIiwiJCIsIl9jIiwic2V0dGluZ3MiLCJzeW50YXhIaWdobGlnaHRpbmdEaXNhYmxlZCIsInQwIiwiTWFya2Rvd25XaXRoSGlnaGxpZ2h0IiwiU3ltYm9sIiwiZm9yIiwiaGlnaGxpZ2h0IiwidDEiLCJNYXJrZG93bkJvZHkiLCJ0aGVtZSIsImVsZW1lbnRzIiwibm9uVGFibGVDb250ZW50IiwiZmx1c2hOb25UYWJsZUNvbnRlbnQiLCJwdXNoIiwidHJpbSIsInRva2VuIiwiVGFibGUiLCJlbGVtZW50c18wIiwiU3RyZWFtaW5nUHJvcHMiLCJTdHJlYW1pbmdNYXJrZG93biIsIlJlYWN0Tm9kZSIsInN0cmlwcGVkIiwic3RhYmxlUHJlZml4UmVmIiwic3RhcnRzV2l0aCIsImN1cnJlbnQiLCJib3VuZGFyeSIsInN1YnN0cmluZyIsImxhc3RDb250ZW50SWR4IiwiYWR2YW5jZSIsImkiLCJzdGFibGVQcmVmaXgiLCJ1bnN0YWJsZVN1ZmZpeCJdLCJzb3VyY2VzIjpbIk1hcmtkb3duLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBtYXJrZWQsIHR5cGUgVG9rZW4sIHR5cGUgVG9rZW5zIH0gZnJvbSAnbWFya2VkJ1xuaW1wb3J0IFJlYWN0LCB7IFN1c3BlbnNlLCB1c2UsIHVzZU1lbW8sIHVzZVJlZiB9IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgdXNlU2V0dGluZ3MgfSBmcm9tICcuLi9ob29rcy91c2VTZXR0aW5ncy5qcydcbmltcG9ydCB7IEFuc2ksIEJveCwgdXNlVGhlbWUgfSBmcm9tICcuLi9pbmsuanMnXG5pbXBvcnQge1xuICB0eXBlIENsaUhpZ2hsaWdodCxcbiAgZ2V0Q2xpSGlnaGxpZ2h0UHJvbWlzZSxcbn0gZnJvbSAnLi4vdXRpbHMvY2xpSGlnaGxpZ2h0LmpzJ1xuaW1wb3J0IHsgaGFzaENvbnRlbnQgfSBmcm9tICcuLi91dGlscy9oYXNoLmpzJ1xuaW1wb3J0IHsgY29uZmlndXJlTWFya2VkLCBmb3JtYXRUb2tlbiB9IGZyb20gJy4uL3V0aWxzL21hcmtkb3duLmpzJ1xuaW1wb3J0IHsgc3RyaXBQcm9tcHRYTUxUYWdzIH0gZnJvbSAnLi4vdXRpbHMvbWVzc2FnZXMuanMnXG5pbXBvcnQgeyBNYXJrZG93blRhYmxlIH0gZnJvbSAnLi9NYXJrZG93blRhYmxlLmpzJ1xuXG50eXBlIFByb3BzID0ge1xuICBjaGlsZHJlbjogc3RyaW5nXG4gIC8qKiBXaGVuIHRydWUsIHJlbmRlciBhbGwgdGV4dCBjb250ZW50IGFzIGRpbSAqL1xuICBkaW1Db2xvcj86IGJvb2xlYW5cbn1cblxuLy8gTW9kdWxlLWxldmVsIHRva2VuIGNhY2hlIOKAlCBtYXJrZWQubGV4ZXIgaXMgdGhlIGhvdCBjb3N0IG9uIHZpcnR1YWwtc2Nyb2xsXG4vLyByZW1vdW50cyAofjNtcyBwZXIgbWVzc2FnZSkuIHVzZU1lbW8gZG9lc24ndCBzdXJ2aXZlIHVubW91bnTihpJyZW1vdW50LCBzb1xuLy8gc2Nyb2xsaW5nIGJhY2sgdG8gYSBwcmV2aW91c2x5LXZpc2libGUgbWVzc2FnZSByZS1wYXJzZXMuIE1lc3NhZ2VzIGFyZVxuLy8gaW1tdXRhYmxlIGluIGhpc3Rvcnk7IHNhbWUgY29udGVudCDihpIgc2FtZSB0b2tlbnMuIEtleWVkIGJ5IGhhc2ggdG8gYXZvaWRcbi8vIHJldGFpbmluZyBmdWxsIGNvbnRlbnQgc3RyaW5ncyAodHVybjUw4oaSdHVybjk5IFJTUyByZWdyZXNzaW9uLCAjMjQxODApLlxuY29uc3QgVE9LRU5fQ0FDSEVfTUFYID0gNTAwXG5jb25zdCB0b2tlbkNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIFRva2VuW10+KClcblxuLy8gQ2hhcmFjdGVycyB0aGF0IGluZGljYXRlIG1hcmtkb3duIHN5bnRheC4gSWYgbm9uZSBhcmUgcHJlc2VudCwgc2tpcCB0aGVcbi8vIH4zbXMgbWFya2VkLmxleGVyIGNhbGwgZW50aXJlbHkg4oCUIHJlbmRlciBhcyBhIHNpbmdsZSBwYXJhZ3JhcGguIENvdmVyc1xuLy8gdGhlIG1ham9yaXR5IG9mIHNob3J0IGFzc2lzdGFudCByZXNwb25zZXMgYW5kIHVzZXIgcHJvbXB0cyB0aGF0IGFyZVxuLy8gcGxhaW4gc2VudGVuY2VzLiBDaGVja2VkIHZpYSBpbmRleE9mIChub3QgcmVnZXgpIGZvciBzcGVlZC5cbi8vIFNpbmdsZSByZWdleDogbWF0Y2hlcyBhbnkgTUQgbWFya2VyIG9yIG9yZGVyZWQtbGlzdCBzdGFydCAoTi4gYXQgbGluZSBzdGFydCkuXG4vLyBPbmUgcGFzcyBpbnN0ZWFkIG9mIDEww5cgaW5jbHVkZXMgc2NhbnMuXG5jb25zdCBNRF9TWU5UQVhfUkUgPSAvWyMqYHxbPlxcLV9+XXxcXG5cXG58XlxcZCtcXC4gfFxcblxcZCtcXC4gL1xuZnVuY3Rpb24gaGFzTWFya2Rvd25TeW50YXgoczogc3RyaW5nKTogYm9vbGVhbiB7XG4gIC8vIFNhbXBsZSBmaXJzdCA1MDAgY2hhcnMg4oCUIGlmIG1hcmtkb3duIGV4aXN0cyBpdCdzIHVzdWFsbHkgZWFybHkgKGhlYWRlcnMsXG4gIC8vIGNvZGUgZmVuY2UsIGxpc3QpLiBMb25nIHRvb2wgb3V0cHV0cyBhcmUgbW9zdGx5IHBsYWluIHRleHQgdGFpbHMuXG4gIHJldHVybiBNRF9TWU5UQVhfUkUudGVzdChzLmxlbmd0aCA+IDUwMCA/IHMuc2xpY2UoMCwgNTAwKSA6IHMpXG59XG5cbmZ1bmN0aW9uIGNhY2hlZExleGVyKGNvbnRlbnQ6IHN0cmluZyk6IFRva2VuW10ge1xuICAvLyBGYXN0IHBhdGg6IHBsYWluIHRleHQgd2l0aCBubyBtYXJrZG93biBzeW50YXgg4oaSIHNpbmdsZSBwYXJhZ3JhcGggdG9rZW4uXG4gIC8vIFNraXBzIG1hcmtlZC5sZXhlcidzIGZ1bGwgR0ZNIHBhcnNlICh+M21zIG9uIGxvbmcgY29udGVudCkuIE5vdCBjYWNoZWQg4oCUXG4gIC8vIHJlY29uc3RydWN0aW9uIGlzIGEgc2luZ2xlIG9iamVjdCBhbGxvY2F0aW9uLCBhbmQgY2FjaGluZyB3b3VsZCByZXRhaW5cbiAgLy8gNMOXIGNvbnRlbnQgaW4gcmF3L3RleHQgZmllbGRzIHBsdXMgdGhlIGhhc2gga2V5IGZvciB6ZXJvIGJlbmVmaXQuXG4gIGlmICghaGFzTWFya2Rvd25TeW50YXgoY29udGVudCkpIHtcbiAgICByZXR1cm4gW1xuICAgICAge1xuICAgICAgICB0eXBlOiAncGFyYWdyYXBoJyxcbiAgICAgICAgcmF3OiBjb250ZW50LFxuICAgICAgICB0ZXh0OiBjb250ZW50LFxuICAgICAgICB0b2tlbnM6IFt7IHR5cGU6ICd0ZXh0JywgcmF3OiBjb250ZW50LCB0ZXh0OiBjb250ZW50IH1dLFxuICAgICAgfSBhcyBUb2tlbixcbiAgICBdXG4gIH1cbiAgY29uc3Qga2V5ID0gaGFzaENvbnRlbnQoY29udGVudClcbiAgY29uc3QgaGl0ID0gdG9rZW5DYWNoZS5nZXQoa2V5KVxuICBpZiAoaGl0KSB7XG4gICAgLy8gUHJvbW90ZSB0byBNUlUg4oCUIHdpdGhvdXQgdGhpcyB0aGUgZXZpY3Rpb24gaXMgRklGTyAoc2Nyb2xsaW5nIGJhY2sgdG9cbiAgICAvLyBhbiBlYXJseSBtZXNzYWdlIGV2aWN0cyB0aGUgdmVyeSBpdGVtIHlvdSdyZSBsb29raW5nIGF0KS5cbiAgICB0b2tlbkNhY2hlLmRlbGV0ZShrZXkpXG4gICAgdG9rZW5DYWNoZS5zZXQoa2V5LCBoaXQpXG4gICAgcmV0dXJuIGhpdFxuICB9XG4gIGNvbnN0IHRva2VucyA9IG1hcmtlZC5sZXhlcihjb250ZW50KVxuICBpZiAodG9rZW5DYWNoZS5zaXplID49IFRPS0VOX0NBQ0hFX01BWCkge1xuICAgIC8vIExSVS1pc2g6IGRyb3Agb2xkZXN0LiBNYXAgcHJlc2VydmVzIGluc2VydGlvbiBvcmRlci5cbiAgICBjb25zdCBmaXJzdCA9IHRva2VuQ2FjaGUua2V5cygpLm5leHQoKS52YWx1ZVxuICAgIGlmIChmaXJzdCAhPT0gdW5kZWZpbmVkKSB0b2tlbkNhY2hlLmRlbGV0ZShmaXJzdClcbiAgfVxuICB0b2tlbkNhY2hlLnNldChrZXksIHRva2VucylcbiAgcmV0dXJuIHRva2Vuc1xufVxuXG4vKipcbiAqIFJlbmRlcnMgbWFya2Rvd24gY29udGVudCB1c2luZyBhIGh5YnJpZCBhcHByb2FjaDpcbiAqIC0gVGFibGVzIGFyZSByZW5kZXJlZCBhcyBSZWFjdCBjb21wb25lbnRzIHdpdGggcHJvcGVyIGZsZXhib3ggbGF5b3V0XG4gKiAtIE90aGVyIGNvbnRlbnQgaXMgcmVuZGVyZWQgYXMgQU5TSSBzdHJpbmdzIHZpYSBmb3JtYXRUb2tlblxuICovXG5leHBvcnQgZnVuY3Rpb24gTWFya2Rvd24ocHJvcHM6IFByb3BzKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3Qgc2V0dGluZ3MgPSB1c2VTZXR0aW5ncygpXG4gIGlmIChzZXR0aW5ncy5zeW50YXhIaWdobGlnaHRpbmdEaXNhYmxlZCkge1xuICAgIHJldHVybiA8TWFya2Rvd25Cb2R5IHsuLi5wcm9wc30gaGlnaGxpZ2h0PXtudWxsfSAvPlxuICB9XG4gIC8vIFN1c3BlbnNlIGZhbGxiYWNrIHJlbmRlcnMgd2l0aCBoaWdobGlnaHQ9bnVsbCDigJQgcGxhaW4gbWFya2Rvd24gc2hvd3NcbiAgLy8gZm9yIH41MG1zIG9uIGZpcnN0IGV2ZXIgcmVuZGVyIHdoaWxlIGNsaS1oaWdobGlnaHQgbG9hZHMuXG4gIHJldHVybiAoXG4gICAgPFN1c3BlbnNlIGZhbGxiYWNrPXs8TWFya2Rvd25Cb2R5IHsuLi5wcm9wc30gaGlnaGxpZ2h0PXtudWxsfSAvPn0+XG4gICAgICA8TWFya2Rvd25XaXRoSGlnaGxpZ2h0IHsuLi5wcm9wc30gLz5cbiAgICA8L1N1c3BlbnNlPlxuICApXG59XG5cbmZ1bmN0aW9uIE1hcmtkb3duV2l0aEhpZ2hsaWdodChwcm9wczogUHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBoaWdobGlnaHQgPSB1c2UoZ2V0Q2xpSGlnaGxpZ2h0UHJvbWlzZSgpKVxuICByZXR1cm4gPE1hcmtkb3duQm9keSB7Li4ucHJvcHN9IGhpZ2hsaWdodD17aGlnaGxpZ2h0fSAvPlxufVxuXG5mdW5jdGlvbiBNYXJrZG93bkJvZHkoe1xuICBjaGlsZHJlbixcbiAgZGltQ29sb3IsXG4gIGhpZ2hsaWdodCxcbn06IFByb3BzICYgeyBoaWdobGlnaHQ6IENsaUhpZ2hsaWdodCB8IG51bGwgfSk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IFt0aGVtZV0gPSB1c2VUaGVtZSgpXG4gIGNvbmZpZ3VyZU1hcmtlZCgpXG5cbiAgY29uc3QgZWxlbWVudHMgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBjb25zdCB0b2tlbnMgPSBjYWNoZWRMZXhlcihzdHJpcFByb21wdFhNTFRhZ3MoY2hpbGRyZW4pKVxuICAgIGNvbnN0IGVsZW1lbnRzOiBSZWFjdC5SZWFjdE5vZGVbXSA9IFtdXG4gICAgbGV0IG5vblRhYmxlQ29udGVudCA9ICcnXG5cbiAgICBmdW5jdGlvbiBmbHVzaE5vblRhYmxlQ29udGVudCgpOiB2b2lkIHtcbiAgICAgIGlmIChub25UYWJsZUNvbnRlbnQpIHtcbiAgICAgICAgZWxlbWVudHMucHVzaChcbiAgICAgICAgICA8QW5zaSBrZXk9e2VsZW1lbnRzLmxlbmd0aH0gZGltQ29sb3I9e2RpbUNvbG9yfT5cbiAgICAgICAgICAgIHtub25UYWJsZUNvbnRlbnQudHJpbSgpfVxuICAgICAgICAgIDwvQW5zaT4sXG4gICAgICAgIClcbiAgICAgICAgbm9uVGFibGVDb250ZW50ID0gJydcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHRva2VuIG9mIHRva2Vucykge1xuICAgICAgaWYgKHRva2VuLnR5cGUgPT09ICd0YWJsZScpIHtcbiAgICAgICAgZmx1c2hOb25UYWJsZUNvbnRlbnQoKVxuICAgICAgICBlbGVtZW50cy5wdXNoKFxuICAgICAgICAgIDxNYXJrZG93blRhYmxlXG4gICAgICAgICAgICBrZXk9e2VsZW1lbnRzLmxlbmd0aH1cbiAgICAgICAgICAgIHRva2VuPXt0b2tlbiBhcyBUb2tlbnMuVGFibGV9XG4gICAgICAgICAgICBoaWdobGlnaHQ9e2hpZ2hsaWdodH1cbiAgICAgICAgICAvPixcbiAgICAgICAgKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm9uVGFibGVDb250ZW50ICs9IGZvcm1hdFRva2VuKHRva2VuLCB0aGVtZSwgMCwgbnVsbCwgbnVsbCwgaGlnaGxpZ2h0KVxuICAgICAgfVxuICAgIH1cblxuICAgIGZsdXNoTm9uVGFibGVDb250ZW50KClcbiAgICByZXR1cm4gZWxlbWVudHNcbiAgfSwgW2NoaWxkcmVuLCBkaW1Db2xvciwgaGlnaGxpZ2h0LCB0aGVtZV0pXG5cbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBnYXA9ezF9PlxuICAgICAge2VsZW1lbnRzfVxuICAgIDwvQm94PlxuICApXG59XG5cbnR5cGUgU3RyZWFtaW5nUHJvcHMgPSB7XG4gIGNoaWxkcmVuOiBzdHJpbmdcbn1cblxuLyoqXG4gKiBSZW5kZXJzIG1hcmtkb3duIGR1cmluZyBzdHJlYW1pbmcgYnkgc3BsaXR0aW5nIGF0IHRoZSBsYXN0IHRvcC1sZXZlbCBibG9ja1xuICogYm91bmRhcnk6IGV2ZXJ5dGhpbmcgYmVmb3JlIGlzIHN0YWJsZSAobWVtb2l6ZWQsIG5ldmVyIHJlLXBhcnNlZCksIG9ubHkgdGhlXG4gKiBmaW5hbCBibG9jayBpcyByZS1wYXJzZWQgcGVyIGRlbHRhLiBtYXJrZWQubGV4ZXIoKSBjb3JyZWN0bHkgaGFuZGxlc1xuICogdW5jbG9zZWQgY29kZSBmZW5jZXMgYXMgYSBzaW5nbGUgdG9rZW4sIHNvIGJsb2NrIGJvdW5kYXJpZXMgYXJlIGFsd2F5cyBzYWZlLlxuICpcbiAqIFRoZSBzdGFibGUgYm91bmRhcnkgb25seSBhZHZhbmNlcyAobW9ub3RvbmljKSwgc28gcmVmIG11dGF0aW9uIGR1cmluZyByZW5kZXJcbiAqIGlzIGlkZW1wb3RlbnQgYW5kIHNhZmUgdW5kZXIgU3RyaWN0TW9kZSBkb3VibGUtcmVuZGVyaW5nLiBDb21wb25lbnQgdW5tb3VudHNcbiAqIGJldHdlZW4gdHVybnMgKHN0cmVhbWluZ1RleHQg4oaSIG51bGwpLCByZXNldHRpbmcgdGhlIHJlZi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIFN0cmVhbWluZ01hcmtkb3duKHtcbiAgY2hpbGRyZW4sXG59OiBTdHJlYW1pbmdQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIC8vIFJlYWN0IENvbXBpbGVyOiB0aGlzIGNvbXBvbmVudCByZWFkcyBhbmQgd3JpdGVzIHN0YWJsZVByZWZpeFJlZi5jdXJyZW50XG4gIC8vIGR1cmluZyByZW5kZXIgYnkgZGVzaWduLiBUaGUgYm91bmRhcnkgb25seSBhZHZhbmNlcyAobW9ub3RvbmljKSwgc29cbiAgLy8gdGhlIHJlZiBtdXRhdGlvbiBpcyBpZGVtcG90ZW50IHVuZGVyIFN0cmljdE1vZGUgZG91YmxlLXJlbmRlciDigJQgYnV0IHRoZVxuICAvLyBjb21waWxlciBjYW4ndCBwcm92ZSB0aGF0LCBhbmQgbWVtb2l6aW5nIGFyb3VuZCB0aGUgcmVmIHJlYWRzIHdvdWxkXG4gIC8vIGJyZWFrIHRoZSBhbGdvcml0aG0gKHN0YWxlIGJvdW5kYXJ5KS4gT3B0IG91dC5cbiAgJ3VzZSBubyBtZW1vJ1xuICBjb25maWd1cmVNYXJrZWQoKVxuXG4gIC8vIFN0cmlwIGJlZm9yZSBib3VuZGFyeSB0cmFja2luZyBzbyBpdCBtYXRjaGVzIDxNYXJrZG93bj4ncyBzdHJpcHBpbmdcbiAgLy8gKGxpbmUgMjkpLiBXaGVuIGEgY2xvc2luZyB0YWcgYXJyaXZlcywgc3RyaXBwZWQoTisxKSBpcyBub3QgYSBwcmVmaXhcbiAgLy8gb2Ygc3RyaXBwZWQoTiksIGJ1dCB0aGUgc3RhcnRzV2l0aCByZXNldCBiZWxvdyBoYW5kbGVzIHRoYXQgd2l0aCBhXG4gIC8vIG9uZS10aW1lIHJlLWxleCBvbiB0aGUgc21hbGxlciBzdHJpcHBlZCBzdHJpbmcuXG4gIGNvbnN0IHN0cmlwcGVkID0gc3RyaXBQcm9tcHRYTUxUYWdzKGNoaWxkcmVuKVxuXG4gIGNvbnN0IHN0YWJsZVByZWZpeFJlZiA9IHVzZVJlZignJylcblxuICAvLyBSZXNldCBpZiB0ZXh0IHdhcyByZXBsYWNlZCAoZGVmZW5zaXZlOyBub3JtYWxseSB1bm1vdW50IGhhbmRsZXMgdGhpcylcbiAgaWYgKCFzdHJpcHBlZC5zdGFydHNXaXRoKHN0YWJsZVByZWZpeFJlZi5jdXJyZW50KSkge1xuICAgIHN0YWJsZVByZWZpeFJlZi5jdXJyZW50ID0gJydcbiAgfVxuXG4gIC8vIExleCBvbmx5IGZyb20gY3VycmVudCBib3VuZGFyeSDigJQgTyh1bnN0YWJsZSBsZW5ndGgpLCBub3QgTyhmdWxsIHRleHQpXG4gIGNvbnN0IGJvdW5kYXJ5ID0gc3RhYmxlUHJlZml4UmVmLmN1cnJlbnQubGVuZ3RoXG4gIGNvbnN0IHRva2VucyA9IG1hcmtlZC5sZXhlcihzdHJpcHBlZC5zdWJzdHJpbmcoYm91bmRhcnkpKVxuXG4gIC8vIExhc3Qgbm9uLXNwYWNlIHRva2VuIGlzIHRoZSBncm93aW5nIGJsb2NrOyBldmVyeXRoaW5nIGJlZm9yZSBpcyBmaW5hbFxuICBsZXQgbGFzdENvbnRlbnRJZHggPSB0b2tlbnMubGVuZ3RoIC0gMVxuICB3aGlsZSAobGFzdENvbnRlbnRJZHggPj0gMCAmJiB0b2tlbnNbbGFzdENvbnRlbnRJZHhdIS50eXBlID09PSAnc3BhY2UnKSB7XG4gICAgbGFzdENvbnRlbnRJZHgtLVxuICB9XG4gIGxldCBhZHZhbmNlID0gMFxuICBmb3IgKGxldCBpID0gMDsgaSA8IGxhc3RDb250ZW50SWR4OyBpKyspIHtcbiAgICBhZHZhbmNlICs9IHRva2Vuc1tpXSEucmF3Lmxlbmd0aFxuICB9XG4gIGlmIChhZHZhbmNlID4gMCkge1xuICAgIHN0YWJsZVByZWZpeFJlZi5jdXJyZW50ID0gc3RyaXBwZWQuc3Vic3RyaW5nKDAsIGJvdW5kYXJ5ICsgYWR2YW5jZSlcbiAgfVxuXG4gIGNvbnN0IHN0YWJsZVByZWZpeCA9IHN0YWJsZVByZWZpeFJlZi5jdXJyZW50XG4gIGNvbnN0IHVuc3RhYmxlU3VmZml4ID0gc3RyaXBwZWQuc3Vic3RyaW5nKHN0YWJsZVByZWZpeC5sZW5ndGgpXG5cbiAgLy8gc3RhYmxlUHJlZml4IGlzIG1lbW9pemVkIGluc2lkZSA8TWFya2Rvd24+IHZpYSB1c2VNZW1vKFtjaGlsZHJlbiwgLi4uXSlcbiAgLy8gc28gaXQgbmV2ZXIgcmUtcGFyc2VzIGFzIHRoZSB1bnN0YWJsZSBzdWZmaXggZ3Jvd3NcbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBnYXA9ezF9PlxuICAgICAge3N0YWJsZVByZWZpeCAmJiA8TWFya2Rvd24+e3N0YWJsZVByZWZpeH08L01hcmtkb3duPn1cbiAgICAgIHt1bnN0YWJsZVN1ZmZpeCAmJiA8TWFya2Rvd24+e3Vuc3RhYmxlU3VmZml4fTwvTWFya2Rvd24+fVxuICAgIDwvQm94PlxuICApXG59XG4iXSwibWFwcGluZ3MiOiI7QUFBQSxTQUFTQSxNQUFNLEVBQUUsS0FBS0MsS0FBSyxFQUFFLEtBQUtDLE1BQU0sUUFBUSxR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