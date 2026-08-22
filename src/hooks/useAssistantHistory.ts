import { randomUUID } from 'crypto'
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'
import {
  createHistoryAuthCtx,
  fetchLatestEvents,
  fetchOlderEvents,
  type HistoryAuthCtx,
  type HistoryPage,
} from '../assistant/sessionHistory.js'
import type { ScrollBoxHandle } from '../ink/components/ScrollBox.js'
import type { RemoteSessionConfig } from '../remote/RemoteSessionManager.js'
import { convertSDKMessage } from '../remote/sdkMessageAdapter.js'
import type { Message, SystemInformationalMessage } from '../types/message.js'
import { logForDebugging } from '../utils/debug.js'

type Props = {
  /** Gated on viewerOnly — non-viewer sessions have no remote history to page. */
  config: RemoteSessionConfig | undefined
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  scrollRef: RefObject<ScrollBoxHandle | null>
  /** Called after prepend from the layout effect with message count + height
   *  delta. Lets useUnseenDivider shift dividerIndex + dividerYRef. */
  onPrepend?: (indexDelta: number, heightDelta: number) => void
}

type Result = {
  /** Trigger for ScrollKeybindingHandler's onScroll composition. */
  maybeLoadOlder: (handle: ScrollBoxHandle) => void
}

/** Fire loadOlder when scrolled within this many rows of the top. */
const PREFETCH_THRESHOLD_ROWS = 40

/** Max chained page loads to fill the viewport on mount. Bounds the loop if
 *  events convert to zero visible messages (everything filtered). */
const MAX_FILL_PAGES = 10

const SENTINEL_LOADING = 'loading older messages…'
const SENTINEL_LOADING_FAILED =
  'failed to load older messages — scroll up to retry'
const SENTINEL_START = 'start of session'

/** Convert a HistoryPage to REPL Message[] using the same opts as viewer mode. */
function pageToMessages(page: HistoryPage): Message[] {
  const out: Message[] = []
  for (const ev of page.events) {
    const c = convertSDKMessage(ev, {
      convertUserTextMessages: true,
      convertToolResults: true,
    })
    if (c.type === 'message') out.push(c.message)
  }
  return out
}

/**
 * Lazy-load `claude assistant` history on scroll-up.
 *
 * On mount: fetch newest page via anchor_to_latest, prepend to messages.
 * On scroll-up near top: fetch next-older page via before_id, prepend with
 * scroll anchoring (viewport stays put).
 *
 * No-op unless config.viewerOnly. REPL only calls this hook inside a
 * feature('KAIROS') gate, so build-time elimination is handled there.
 */
export function useAssistantHistory({
  config,
  setMessages,
  scrollRef,
  onPrepend,
}: Props): Result {
  const enabled = config?.viewerOnly === true

  // Cursor state: ref-only (no re-render on cursor change). `null` = no
  // older pages. `undefined` = initial page not fetched yet.
  const cursorRef = useRef<string | null | undefined>(undefined)
  const ctxRef = useRef<HistoryAuthCtx | null>(null)
  const inflightRef = useRef(false)

  // Scroll-anchor: snapshot height + prepended count before setMessages;
  // compensate in useLayoutEffect after React commits. getFreshScrollHeight
  // reads Yoga directly so the value is correct post-commit.
  const anchorRef = useRef<{ beforeHeight: number; count: number } | null>(null)

  // Fill-viewport chaining: after the initial page commits, if content doesn't
  // fill the viewport yet, load another page. Self-chains via the layout effect
  // until filled or the budget runs out. Budget set once on initial load; user
  // scroll-ups don't need it (maybeLoadOlder re-fires on next wheel event).
  const fillBudgetRef = useRef(0)

  // Stable sentinel UUID — reused across swaps so virtual-scroll treats it
  // as one item (text-only mutation, not remove+insert).
  const sentinelUuidRef = useRef(randomUUID())

  function mkSentinel(text: string): SystemInformationalMessage {
    return {
      type: 'system',
      subtype: 'informational',
      content: text,
      isMeta: false,
      timestamp: new Date().toISOString(),
      uuid: sentinelUuidRef.current,
      level: 'info',
    }
  }

  /** Prepend a page at the front, with scroll-anchor snapshot for non-initial.
   *  Replaces the sentinel (always at index 0 when present) in-place. */
  const prepend = useCallback(
    (page: HistoryPage, isInitial: boolean) => {
      const msgs = pageToMessages(page)
      cursorRef.current = page.hasMore ? page.firstId : null

      if (!isInitial) {
        const s = scrollRef.current
        anchorRef.current = s
          ? { beforeHeight: s.getFreshScrollHeight(), count: msgs.length }
          : null
      }

      const sentinel = page.hasMore ? null : mkSentinel(SENTINEL_START)
      setMessages(prev => {
        // Drop existing sentinel (index 0, known stable UUID — O(1)).
        const base =
          prev[0]?.uuid === sentinelUuidRef.current ? prev.slice(1) : prev
        return sentinel ? [sentinel, ...msgs, ...base] : [...msgs, ...base]
      })

      logForDebugging(
        `[useAssistantHistory] ${isInitial ? 'initial' : 'older'} page: ${msgs.length} msgs (raw ${page.events.length}), hasMore=${page.hasMore}`,
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scrollRef is a stable ref; mkSentinel reads refs only
    [setMessages],
  )

  // Initial fetch on mount — best-effort.
  useEffect(() => {
    if (!enabled || !config) return
    let cancelled = false
    void (async () => {
      const ctx = await createHistoryAuthCtx(config.sessionId).catch(() => null)
      if (!ctx || cancelled) return
      ctxRef.current = ctx
      const page = await fetchLatestEvents(ctx)
      if (cancelled || !page) return
      fillBudgetRef.current = MAX_FILL_PAGES
      prepend(page, true)
    })()
    return () => {
      cancelled = true
    }
    // config identity is stable (created once in main.tsx, never recreated)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  const loadOlder = useCallback(async () => {
    if (!enabled || inflightRef.current) return
    const cursor = cursorRef.current
    const ctx = ctxRef.current
    if (!cursor || !ctx) return // null=exhausted, undefined=initial pending
    inflightRef.current = true
    // Swap sentinel to "loading…" — O(1) slice since sentinel is at index 0.
    setMessages(prev => {
      const base =
        prev[0]?.uuid === sentinelUuidRef.current ? prev.slice(1) : prev
      return [mkSentinel(SENTINEL_LOADING), ...base]
    })
    try {
      const page = await fetchOlderEvents(ctx, cursor)
      if (!page) {
        // Fetch failed — revert sentinel back to "start" placeholder so the user
        // can retry on next scroll-up. Cursor is preserved (not nulled out).
        setMessages(prev => {
          const base =
            prev[0]?.uuid === sentinelUuidRef.current ? prev.slice(1) : prev
          return [mkSentinel(SENTINEL_LOADING_FAILED), ...base]
        })
        return
      }
      prepend(page, false)
    } finally {
      inflightRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mkSentinel reads refs only
  }, [enabled, prepend, setMessages])

  // Scroll-anchor compensation — after React commits the prepended items,
  // shift scrollTop by the height delta so the viewport stays put. Also
  // fire onPrepend here (not in prepend()) so dividerIndex + baseline ref
  // are shifted with the ACTUAL height delta, not an estimate.
  // No deps: runs every render; cheap no-op when anchorRef is null.
  useLayoutEffect(() => {
    const anchor = anchorRef.current
    if (anchor === null) return
    anchorRef.current = null
    const s = scrollRef.current
    if (!s || s.isSticky()) return // sticky = pinned bottom; prepend is invisible
    const delta = s.getFreshScrollHeight() - anchor.beforeHeight
    if (delta > 0) s.scrollBy(delta)
    onPrepend?.(anchor.count, delta)
  })

  // Fill-viewport chain: after paint, if content doesn't exceed the viewport,
  // load another page. Runs as useEffect (not layout effect) so Ink has
  // painted and scrollViewportHeight is populated. Self-chains via next
  // render's effect; budget caps the chain.
  //
  // The ScrollBox content wrapper has flexGrow:1 flexShrink:0 — it's clamped
  // to ≥ viewport. So `content < viewport` is never true; `<=` detects "no
  // overflow yet" correctly. Stops once there's at least something to scroll.
  useEffect(() => {
    if (
      fillBudgetRef.current <= 0 ||
      !cursorRef.current ||
      inflightRef.current
    ) {
      return
    }
    const s = scrollRef.current
    if (!s) return
    const contentH = s.getFreshScrollHeight()
    const viewH = s.getViewportHeight()
    logForDebugging(
      `[useAssistantHistory] fill-check: content=${contentH} viewport=${viewH} budget=${fillBudgetRef.current}`,
    )
    if (contentH <= viewH) {
      fillBudgetRef.current--
      void loadOlder()
    } else {
      fillBudgetRef.current = 0
    }
  })

  // Trigger wrapper for onScroll composition in REPL.
  const maybeLoadOlder = useCallback(
    (handle: ScrollBoxHandle) => {
      if (handle.getScrollTop() < PREFETCH_THRESHOLD_ROWS) void loadOlder()
    },
    [loadOlder],
  )

  return { maybeLoadOlder }
}
