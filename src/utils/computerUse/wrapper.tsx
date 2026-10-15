/**
 * The `.call()` override — thin adapter between `ToolUseContext` and
 * `bindSessionContext`. Spread into the MCP tool object in `client.ts`
 * (same pattern as Chrome's rendering overrides, plus `.call()`).
 *
 * The wrapper-closure logic (build overrides fresh, lock gate, permission
 * merge, screenshot stash) lives in `@ant/computer-use-mcp`'s
 * `bindSessionContext`. This file binds it once per process,
 * caches the dispatcher, and updates a per-call ref for the pieces of
 * `ToolUseContext` that vary per-call (`abortController`, `setToolJSX`,
 * `sendOSNotification`). AppState accessors are read through the ref too —
 * they're likely stable but we don't depend on that.
 *
 * External callers reach this via the lazy require thunk in `client.ts`, gated
 * on `feature('CHICAGO_MCP')`. Runtime enablement is controlled by the
 * GrowthBook gate `tengu_malort_pedway` (see gates.ts).
 */

import { bindSessionContext, type ComputerUseSessionContext, type CuCallToolResult, type CuPermissionRequest, type CuPermissionResponse, DEFAULT_GRANT_FLAGS, type ScreenshotDims } from '@ant/computer-use-mcp';
import * as React from 'react';
import { getSessionId } from '../../bootstrap/state.js';
import { ComputerUseApproval } from '../../components/permissions/ComputerUseApproval/ComputerUseApproval.js';
import type { Tool, ToolUseContext } from '../../Tool.js';
import { logForDebugging } from '../debug.js';
import { checkComputerUseLock, tryAcquireComputerUseLock } from './computerUseLock.js';
import { registerEscHotkey } from './escHotkey.js';
import { getChicagoCoordinateMode } from './gates.js';
import { getComputerUseHostAdapter } from './hostAdapter.js';
import { getComputerUseMCPRenderingOverrides } from './toolRendering.js';
type CallOverride = Pick<Tool, 'call'>['call'];
type Binding = {
  ctx: ComputerUseSessionContext;
  dispatch: (name: string, args: unknown) => Promise<CuCallToolResult>;
};

/**
 * Cached binding — built on first `.call()`, reused for process lifetime.
 * The dispatcher's closure-held screenshot blob persists across calls.
 *
 * `currentToolUseContext` is updated on every call. Every getter/callback in
 * `ctx` reads through it, so the per-call pieces (`abortController`,
 * `setToolJSX`, `sendOSNotification`) are always current.
 *
 * Module-level `let` is a deliberate exception to the no-module-scope-state
 * rule (src/CLAUDE.md): the dispatcher closure must persist across calls so
 * its internal screenshot blob survives, but `ToolUseContext` is per-call.
 * Tests will need to either inject the cache or run serially.
 */
let binding: Binding | undefined;
let currentToolUseContext: ToolUseContext | undefined;
function tuc(): ToolUseContext {
  // Safe: `binding` is only populated when `currentToolUseContext` is set.
  // Called only from within `ctx` callbacks, which only fire during dispatch.
  return currentToolUseContext!;
}
function formatLockHeld(holder: string): string {
  return `Computer use is in use by another Claude session (${holder.slice(0, 8)}…). Wait for that session to finish or run /exit there.`;
}
export function buildSessionContext(): ComputerUseSessionContext {
  return {
    // ── Read state fresh via the per-call ref ─────────────────────────────
    getAllowedApps: () => tuc().getAppState().computerUseMcpState?.allowedApps ?? [],
    getGrantFlags: () => tuc().getAppState().computerUseMcpState?.grantFlags ?? DEFAULT_GRANT_FLAGS,
    // cc-2 has no Settings page for user-denied apps yet.
    getUserDeniedBundleIds: () => [],
    getSelectedDisplayId: () => tuc().getAppState().computerUseMcpState?.selectedDisplayId,
    getDisplayPinnedByModel: () => tuc().getAppState().computerUseMcpState?.displayPinnedByModel ?? false,
    getDisplayResolvedForApps: () => tuc().getAppState().computerUseMcpState?.displayResolvedForApps,
    getLastScreenshotDims: (): ScreenshotDims | undefined => {
      const d = tuc().getAppState().computerUseMcpState?.lastScreenshotDims;
      return d ? {
        ...d,
        displayId: d.displayId ?? 0,
        originX: d.originX ?? 0,
        originY: d.originY ?? 0
      } : undefined;
    },
    // ── Write-backs ────────────────────────────────────────────────────────
    // `setToolJSX` is guaranteed present — the gate in `main.tsx` excludes
    // non-interactive sessions. The package's `_dialogSignal` (tool-finished
    // dismissal) is irrelevant here: `setToolJSX` blocks the tool call, so
    // the dialog can't outlive it. Ctrl+C is what matters, and
    // `runPermissionDialog` wires that from the per-call ref's abortController.
    onPermissionRequest: (req, _dialogSignal) => runPermissionDialog(req),
    // Package does the merge (dedupe + truthy-only flags). We just persist.
    onAllowedAppsChanged: (apps, flags) => tuc().setAppState(prev => {
      const cu = prev.computerUseMcpState;
      const prevApps = cu?.allowedApps;
      const prevFlags = cu?.grantFlags;
      const sameApps = prevApps?.length === apps.length && apps.every((a, i) => prevApps[i]?.bundleId === a.bundleId);
      const sameFlags = prevFlags?.clipboardRead === flags.clipboardRead && prevFlags?.clipboardWrite === flags.clipboardWrite && prevFlags?.systemKeyCombos === flags.systemKeyCombos;
      return sameApps && sameFlags ? prev : {
        ...prev,
        computerUseMcpState: {
          ...cu,
          allowedApps: [...apps],
          grantFlags: flags
        }
      };
    }),
    onAppsHidden: ids => {
      if (ids.length === 0) return;
      tuc().setAppState(prev => {
        const cu = prev.computerUseMcpState;
        const existing = cu?.hiddenDuringTurn;
        if (existing && ids.every(id => existing.has(id))) return prev;
        return {
          ...prev,
          computerUseMcpState: {
            ...cu,
            hiddenDuringTurn: new Set([...(existing ?? []), ...ids])
          }
        };
      });
    },
    // Resolver writeback only fires under a pin when Swift fell back to main
    // (pinned display unplugged) — the pin is semantically dead, so clear it
    // and the app-set key so the chase chain runs next time. When autoResolve
    // was true, onDisplayResolvedForApps re-sets the key in the same tick.
    onResolvedDisplayUpdated: id => tuc().setAppState(prev => {
      const cu = prev.computerUseMcpState;
      if (cu?.selectedDisplayId === id && !cu.displayPinnedByModel && cu.displayResolvedForApps === undefined) {
        return prev;
      }
      return {
        ...prev,
        computerUseMcpState: {
          ...cu,
          selectedDisplayId: id,
          displayPinnedByModel: false,
          displayResolvedForApps: undefined
        }
      };
    }),
    // switch_display(name) pins; switch_display("auto") unpins and clears the
    // app-set key so the next screenshot auto-resolves fresh.
    onDisplayPinned: id => tuc().setAppState(prev => {
      const cu = prev.computerUseMcpState;
      const pinned = id !== undefined;
      const nextResolvedFor = pinned ? cu?.displayResolvedForApps : undefined;
      if (cu?.selectedDisplayId === id && cu?.displayPinnedByModel === pinned && cu?.displayResolvedForApps === nextResolvedFor) {
        return prev;
      }
      return {
        ...prev,
        computerUseMcpState: {
          ...cu,
          selectedDisplayId: id,
          displayPinnedByModel: pinned,
          displayResolvedForApps: nextResolvedFor
        }
      };
    }),
    onDisplayResolvedForApps: key => tuc().setAppState(prev => {
      const cu = prev.computerUseMcpState;
      if (cu?.displayResolvedForApps === key) return prev;
      return {
        ...prev,
        computerUseMcpState: {
          ...cu,
          displayResolvedForApps: key
        }
      };
    }),
    onScreenshotCaptured: dims => tuc().setAppState(prev => {
      const cu = prev.computerUseMcpState;
      const p = cu?.lastScreenshotDims;
      return p?.width === dims.width && p?.height === dims.height && p?.displayWidth === dims.displayWidth && p?.displayHeight === dims.displayHeight && p?.displayId === dims.displayId && p?.originX === dims.originX && p?.originY === dims.originY ? prev : {
        ...prev,
        computerUseMcpState: {
          ...cu,
          lastScreenshotDims: dims
        }
      };
    }),
    // ── Lock — async, direct file-lock calls ───────────────────────────────
    // No `lockHolderForGate` dance: the package's gate is async now. It
    // awaits `checkCuLock`, and on `holder: undefined` + non-deferring tool
    // awaits `acquireCuLock`. `defersLockAcquire` is the PACKAGE's set —
    // the local copy is gone.
    checkCuLock: async () => {
      const c = await checkComputerUseLock();
      switch (c.kind) {
        case 'free':
          return {
            holder: undefined,
            isSelf: false
          };
        case 'held_by_self':
          return {
            holder: getSessionId(),
            isSelf: true
          };
        case 'blocked':
          return {
            holder: c.by,
            isSelf: false
          };
      }
    },
    // Called only when checkCuLock returned `holder: undefined`. The O_EXCL
    // acquire is atomic — if another process grabbed it in the gap (rare),
    // throw so the tool fails instead of proceeding without the lock.
    // `fresh: false` (re-entrant) shouldn't happen given check said free,
    // but is possible under parallel tool-use interleaving — don't spam the
    // notification in that case.
    acquireCuLock: async () => {
      const r = await tryAcquireComputerUseLock();
      if (r.kind === 'blocked') {
        throw new Error(formatLockHeld(r.by));
      }
      if (r.fresh) {
        // Global Escape → abort. Consumes the event (PI defense — prompt
        // injection can't dismiss dialogs with Escape). The CGEventTap's
        // CFRunLoopSource is processed by the drainRunLoop pump, so this
        // holds a pump retain until unregisterEscHotkey() in cleanup.ts.
        const escRegistered = registerEscHotkey(() => {
          logForDebugging('[cu-esc] user escape, aborting turn');
          tuc().abortController.abort();
        });
        tuc().sendOSNotification?.({
          message: escRegistered ? 'Claude is using your computer · press Esc to stop' : 'Claude is using your computer · press Ctrl+C to stop',
          notificationType: 'computer_use_enter'
        });
      }
    },
    formatLockHeldMessage: formatLockHeld
  };
}
function getOrBind(): Binding {
  if (binding) return binding;
  const ctx = buildSessionContext();
  binding = {
    ctx,
    dispatch: bindSessionContext(getComputerUseHostAdapter(), getChicagoCoordinateMode(), ctx)
  };
  return binding;
}

/**
 * Returns the full override object for a single `mcp__computer-use__{toolName}`
 * tool: rendering overrides from `toolRendering.tsx` plus a `.call()` that
 * dispatches through the cached binder.
 */
type ComputerUseMCPToolOverrides = ReturnType<typeof getComputerUseMCPRenderingOverrides> & {
  call: CallOverride;
};
export function getComputerUseMCPToolOverrides(toolName: string): ComputerUseMCPToolOverrides {
  const call: CallOverride = async (args, context: ToolUseContext) => {
    currentToolUseContext = context;
    const {
      dispatch
    } = getOrBind();
    const {
      telemetry,
      ...result
    } = await dispatch(toolName, args);
    if (telemetry?.error_kind) {
      logForDebugging(`[Computer Use MCP] ${toolName} error_kind=${telemetry.error_kind}`);
    }

    // MCP content blocks → Anthropic API blocks. CU only produces text and
    // pre-sized JPEG (executor.ts computeTargetDims → targetImageSize), so
    // unlike the generic MCP path there's no resize needed — the MCP image
    // shape just maps to the API's base64-source shape. The package's result
    // type admits audio/resource too, but CU's handleToolCall never emits
    // those; the fallthrough coerces them to empty text.
    const data = Array.isArray(result.content) ? result.content.map(item => item.type === 'image' ? {
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: item.mimeType ?? 'image/jpeg',
        data: item.data
      }
    } : {
      type: 'text' as const,
      text: item.type === 'text' ? item.text : ''
    }) : result.content;
    return {
      data
    };
  };
  return {
    ...getComputerUseMCPRenderingOverrides(toolName),
    call
  };
}

/**
 * Render the approval dialog mid-call via `setToolJSX` + `Promise`, wait for
 * the user. Mirrors `spawnMultiAgent.ts:419-436` (the `It2SetupPrompt` pattern).
 *
 * The merge-into-AppState that used to live here (dedupe + truthy-only flags)
 * is now in the package's `bindSessionContext` → `onAllowedAppsChanged`.
 */
async function runPermissionDialog(req: CuPermissionRequest): Promise<CuPermissionResponse> {
  const context = tuc();
  const setToolJSX = context.setToolJSX;
  if (!setToolJSX) {
    // Shouldn't happen — main.tsx gate excludes non-interactive. Fail safe.
    return {
      granted: [],
      denied: [],
      flags: DEFAULT_GRANT_FLAGS
    };
  }
  try {
    return await new Promise<CuPermissionResponse>((resolve, reject) => {
      const signal = context.abortController.signal;
      // If already aborted, addEventListener won't fire — reject now so the
      // promise doesn't hang waiting for a user who Ctrl+C'd.
      if (signal.aborted) {
        reject(new Error('Computer Use permission dialog aborted'));
        return;
      }
      const onAbort = (): void => {
        signal.removeEventListener('abort', onAbort);
        reject(new Error('Computer Use permission dialog aborted'));
      };
      signal.addEventListener('abort', onAbort);
      setToolJSX({
        jsx: React.createElement(ComputerUseApproval, {
          request: req,
          onDone: (resp: CuPermissionResponse) => {
            signal.removeEventListener('abort', onAbort);
            resolve(resp);
          }
        }),
        shouldHidePromptInput: true
      });
    });
  } finally {
    setToolJSX(null);
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJiaW5kU2Vzc2lvbkNvbnRleHQiLCJDb21wdXRlclVzZVNlc3Npb25Db250ZXh0IiwiQ3VDYWxsVG9vbFJlc3VsdCIsIkN1UGVybWlzc2lvblJlcXVlc3QiLCJDdVBlcm1pc3Npb25SZXNwb25zZSIsIkRFRkFVTFRfR1JBTlRfRkxBR1MiLCJTY3JlZW5zaG90RGltcyIsIlJlYWN0IiwiZ2V0U2Vzc2lvbklkIiwiQ29tcHV0ZXJVc2VBcHByb3ZhbCIsIlRvb2wiLCJUb29sVXNlQ29udGV4dCIsImxvZ0ZvckRlYnVnZ2luZyIsImNoZWNrQ29tcHV0ZXJVc2VMb2NrIiwidHJ5QWNxdWlyZUNvbXB1dGVyVXNlTG9jayIsInJlZ2lzdGVyRXNjSG90a2V5IiwiZ2V0Q2hpY2Fnb0Nvb3JkaW5hdGVNb2RlIiwiZ2V0Q29tcHV0ZXJVc2VIb3N0QWRhcHRlciIsImdldENvbXB1dGVyVXNlTUNQUmVuZGVyaW5nT3ZlcnJpZGVzIiwiQ2FsbE92ZXJyaWRlIiwiUGljayIsIkJpbmRpbmciLCJjdHgiLCJkaXNwYXRjaCIsIm5hbWUiLCJhcmdzIiwiUHJvbWlzZSIsImJpbmRpbmciLCJjdXJyZW50VG9vbFVzZUNvbnRleHQiLCJ0dWMiLCJmb3JtYXRMb2NrSGVsZCIsImhvbGRlciIsInNsaWNlIiwiYnVpbGRTZXNzaW9uQ29udGV4dCIsImdldEFsbG93ZWRBcHBzIiwiZ2V0QXBwU3RhdGUiLCJjb21wdXRlclVzZU1jcFN0YXRlIiwiYWxsb3dlZEFwcHMiLCJnZXRHcmFudEZsYWdzIiwiZ3JhbnRGbGFncyIsImdldFVzZXJEZW5pZWRCdW5kbGVJZHMiLCJnZXRTZWxlY3RlZERpc3BsYXlJZCIsInNlbGVjdGVkRGlzcGxheUlkIiwiZ2V0RGlzcGxheVBpbm5lZEJ5TW9kZWwiLCJkaXNwbGF5UGlubmVkQnlNb2RlbCIsImdldERpc3BsYXlSZXNvbHZlZEZvckFwcHMiLCJkaXNwbGF5UmVzb2x2ZWRGb3JBcHBzIiwiZ2V0TGFzdFNjcmVlbnNob3REaW1zIiwiZCIsImxhc3RTY3JlZW5zaG90RGltcyIsImRpc3BsYXlJZCIsIm9yaWdpblgiLCJvcmlnaW5ZIiwidW5kZWZpbmVkIiwib25QZXJtaXNzaW9uUmVxdWVzdCIsInJlcSIsIl9kaWFsb2dTaWduYWwiLCJydW5QZXJtaXNzaW9uRGlhbG9nIiwib25BbGxvd2VkQXBwc0NoYW5nZWQiLCJhcHBzIiwiZmxhZ3MiLCJzZXRBcHBTdGF0ZSIsInByZXYiLCJjdSIsInByZXZBcHBzIiwicHJldkZsYWdzIiwic2FtZUFwcHMiLCJsZW5ndGgiLCJldmVyeSIsImEiLCJpIiwiYnVuZGxlSWQiLCJzYW1lRmxhZ3MiLCJjbGlwYm9hcmRSZWFkIiwiY2xpcGJvYXJkV3JpdGUiLCJzeXN0ZW1LZXlDb21ib3MiLCJvbkFwcHNIaWRkZW4iLCJpZHMiLCJleGlzdGluZyIsImhpZGRlbkR1cmluZ1R1cm4iLCJpZCIsImhhcyIsIlNldCIsIm9uUmVzb2x2ZWREaXNwbGF5VXBkYXRlZCIsIm9uRGlzcGxheVBpbm5lZCIsInBpbm5lZCIsIm5leHRSZXNvbHZlZEZvciIsIm9uRGlzcGxheVJlc29sdmVkRm9yQXBwcyIsImtleSIsIm9uU2NyZWVuc2hvdENhcHR1cmVkIiwiZGltcyIsInAiLCJ3aWR0aCIsImhlaWdodCIsImRpc3BsYXlXaWR0aCIsImRpc3BsYXlIZWlnaHQiLCJjaGVja0N1TG9jayIsImMiLCJraW5kIiwiaXNTZWxmIiwiYnkiLCJhY3F1aXJlQ3VMb2NrIiwiciIsIkVycm9yIiwiZnJlc2giLCJlc2NSZWdpc3RlcmVkIiwiYWJvcnRDb250cm9sbGVyIiwiYWJvcnQiLCJzZW5kT1NOb3RpZmljYXRpb24iLCJtZXNzYWdlIiwibm90aWZpY2F0aW9uVHlwZSIsImZvcm1hdExvY2tIZWxkTWVzc2FnZSIsImdldE9yQmluZCIsIkNvbXB1dGVyVXNlTUNQVG9vbE92ZXJyaWRlcyIsIlJldHVyblR5cGUiLCJjYWxsIiwiZ2V0Q29tcHV0ZXJVc2VNQ1BUb29sT3ZlcnJpZGVzIiwidG9vbE5hbWUiLCJjb250ZXh0IiwidGVsZW1ldHJ5IiwicmVzdWx0IiwiZXJyb3Jfa2luZCIsImRhdGEiLCJBcnJheSIsImlzQXJyYXkiLCJjb250ZW50IiwibWFwIiwiaXRlbSIsInR5cGUiLCJjb25zdCIsInNvdXJjZSIsIm1lZGlhX3R5cGUiLCJtaW1lVHlwZSIsInRleHQiLCJzZXRUb29sSlNYIiwiZ3JhbnRlZCIsImRlbmllZCIsInJlc29sdmUiLCJyZWplY3QiLCJzaWduYWwiLCJhYm9ydGVkIiwib25BYm9ydCIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJhZGRFdmVudExpc3RlbmVyIiwianN4IiwiY3JlYXRlRWxlbWVudCIsInJlcXVlc3QiLCJvbkRvbmUiLCJyZXNwIiwic2hvdWxkSGlkZVByb21wdElucHV0Il0sInNvdXJjZXMiOlsid3JhcHBlci50c3giXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaGUgYC5jYWxsKClgIG92ZXJyaWRlIOKAlCB0aGluIGFkYXB0ZXIgYmV0d2VlbiBgVG9vbFVzZUNvbnRleHRgIGFuZFxuICogYGJpbmRTZXNzaW9uQ29udGV4dGAuIFNwcmVhZCBpbnRvIHRoZSBNQ1AgdG9vbCBvYmplY3QgaW4gYGNsaWVudC50c2BcbiAqIChzYW1lIHBhdHRlcm4gYXMgQ2hyb21lJ3MgcmVuZGVyaW5nIG92ZXJyaWRlcywgcGx1cyBgLmNhbGwoKWApLlxuICpcbiAqIFRoZSB3cmFwcGVyLWNsb3N1cmUgbG9naWMgKGJ1aWxkIG92ZXJyaWRlcyBmcmVzaCwgbG9jayBnYXRlLCBwZXJtaXNzaW9uXG4gKiBtZXJnZSwgc2NyZWVuc2hvdCBzdGFzaCkgbGl2ZXMgaW4gYEBhbnQvY29tcHV0ZXItdXNlLW1jcGAnc1xuICogYGJpbmRTZXNzaW9uQ29udGV4dGAuIFRoaXMgZmlsZSBiaW5kcyBpdCBvbmNlIHBlciBwcm9jZXNzLFxuICogY2FjaGVzIHRoZSBkaXNwYXRjaGVyLCBhbmQgdXBkYXRlcyBhIHBlci1jYWxsIHJlZiBmb3IgdGhlIHBpZWNlcyBvZlxuICogYFRvb2xVc2VDb250ZXh0YCB0aGF0IHZhcnkgcGVyLWNhbGwgKGBhYm9ydENvbnRyb2xsZXJgLCBgc2V0VG9vbEpTWGAsXG4gKiBgc2VuZE9TTm90aWZpY2F0aW9uYCkuIEFwcFN0YXRlIGFjY2Vzc29ycyBhcmUgcmVhZCB0aHJvdWdoIHRoZSByZWYgdG9vIOKAlFxuICogdGhleSdyZSBsaWtlbHkgc3RhYmxlIGJ1dCB3ZSBkb24ndCBkZXBlbmQgb24gdGhhdC5cbiAqXG4gKiBFeHRlcm5hbCBjYWxsZXJzIHJlYWNoIHRoaXMgdmlhIHRoZSBsYXp5IHJlcXVpcmUgdGh1bmsgaW4gYGNsaWVudC50c2AsIGdhdGVkXG4gKiBvbiBgZmVhdHVyZSgnQ0hJQ0FHT19NQ1AnKWAuIFJ1bnRpbWUgZW5hYmxlbWVudCBpcyBjb250cm9sbGVkIGJ5IHRoZVxuICogR3Jvd3RoQm9vayBnYXRlIGB0ZW5ndV9tYWxvcnRfcGVkd2F5YCAoc2VlIGdhdGVzLnRzKS5cbiAqL1xuXG5pbXBvcnQge1xuICBiaW5kU2Vzc2lvbkNvbnRleHQsXG4gIHR5cGUgQ29tcHV0ZXJVc2VTZXNzaW9uQ29udGV4dCxcbiAgdHlwZSBDdUNhbGxUb29sUmVzdWx0LFxuICB0eXBlIEN1UGVybWlzc2lvblJlcXVlc3QsXG4gIHR5cGUgQ3VQZXJtaXNzaW9uUmVzcG9uc2UsXG4gIERFRkFVTFRfR1JBTlRfRkxBR1MsXG4gIHR5cGUgU2NyZWVuc2hvdERpbXMsXG59IGZyb20gJ0BhbnQvY29tcHV0ZXItdXNlLW1jcCdcbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgZ2V0U2Vzc2lvbklkIH0gZnJvbSAnLi4vLi4vYm9vdHN0cmFwL3N0YXRlLmpzJ1xuaW1wb3J0IHsgQ29tcHV0ZXJVc2VBcHByb3ZhbCB9IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvcGVybWlzc2lvbnMvQ29tcHV0ZXJVc2VBcHByb3ZhbC9Db21wdXRlclVzZUFwcHJvdmFsLmpzJ1xuaW1wb3J0IHR5cGUgeyBUb29sLCBUb29sVXNlQ29udGV4dCB9IGZyb20gJy4uLy4uL1Rvb2wuanMnXG5pbXBvcnQgeyBsb2dGb3JEZWJ1Z2dpbmcgfSBmcm9tICcuLi9kZWJ1Zy5qcydcbmltcG9ydCB7XG4gIGNoZWNrQ29tcHV0ZXJVc2VMb2NrLFxuICB0cnlBY3F1aXJlQ29tcHV0ZXJVc2VMb2NrLFxufSBmcm9tICcuL2NvbXB1dGVyVXNlTG9jay5qcydcbmltcG9ydCB7IHJlZ2lzdGVyRXNjSG90a2V5IH0gZnJvbSAnLi9lc2NIb3RrZXkuanMnXG5pbXBvcnQgeyBnZXRDaGljYWdvQ29vcmRpbmF0ZU1vZGUgfSBmcm9tICcuL2dhdGVzLmpzJ1xuaW1wb3J0IHsgZ2V0Q29tcHV0ZXJVc2VIb3N0QWRhcHRlciB9IGZyb20gJy4vaG9zdEFkYXB0ZXIuanMnXG5pbXBvcnQgeyBnZXRDb21wdXRlclVzZU1DUFJlbmRlcmluZ092ZXJyaWRlcyB9IGZyb20gJy4vdG9vbFJlbmRlcmluZy5qcydcblxudHlwZSBDYWxsT3ZlcnJpZGUgPSBQaWNrPFRvb2wsICdjYWxsJz5bJ2NhbGwnXVxuXG50eXBlIEJpbmRpbmcgPSB7XG4gIGN0eDogQ29tcHV0ZXJVc2VTZXNzaW9uQ29udGV4dFxuICBkaXNwYXRjaDogKG5hbWU6IHN0cmluZywgYXJnczogdW5rbm93bikgPT4gUHJvbWlzZTxDdUNhbGxUb29sUmVzdWx0PlxufVxuXG4vKipcbiAqIENhY2hlZCBiaW5kaW5nIOKAlCBidWlsdCBvbiBmaXJzdCBgLmNhbGwoKWAsIHJldXNlZCBmb3IgcHJvY2VzcyBsaWZldGltZS5cbiAqIFRoZSBkaXNwYXRjaGVyJ3MgY2xvc3VyZS1oZWxkIHNjcmVlbnNob3QgYmxvYiBwZXJzaXN0cyBhY3Jvc3MgY2FsbHMuXG4gKlxuICogYGN1cnJlbnRUb29sVXNlQ29udGV4dGAgaXMgdXBkYXRlZCBvbiBldmVyeSBjYWxsLiBFdmVyeSBnZXR0ZXIvY2FsbGJhY2sgaW5cbiAqIGBjdHhgIHJlYWRzIHRocm91Z2ggaXQsIHNvIHRoZSBwZXItY2FsbCBwaWVjZXMgKGBhYm9ydENvbnRyb2xsZXJgLFxuICogYHNldFRvb2xKU1hgLCBgc2VuZE9TTm90aWZpY2F0aW9uYCkgYXJlIGFsd2F5cyBjdXJyZW50LlxuICpcbiAqIE1vZHVsZS1sZXZlbCBgbGV0YCBpcyBhIGRlbGliZXJhdGUgZXhjZXB0aW9uIHRvIHRoZSBuby1tb2R1bGUtc2NvcGUtc3RhdGVcbiAqIHJ1bGUgKHNyYy9DTEFVREUubWQpOiB0aGUgZGlzcGF0Y2hlciBjbG9zdXJlIG11c3QgcGVyc2lzdCBhY3Jvc3MgY2FsbHMgc29cbiAqIGl0cyBpbnRlcm5hbCBzY3JlZW5zaG90IGJsb2Igc3Vydml2ZXMsIGJ1dCBgVG9vbFVzZUNvbnRleHRgIGlzIHBlci1jYWxsLlxuICogVGVzdHMgd2lsbCBuZWVkIHRvIGVpdGhlciBpbmplY3QgdGhlIGNhY2hlIG9yIHJ1biBzZXJpYWxseS5cbiAqL1xubGV0IGJpbmRpbmc6IEJpbmRpbmcgfCB1bmRlZmluZWRcbmxldCBjdXJyZW50VG9vbFVzZUNvbnRleHQ6IFRvb2xVc2VDb250ZXh0IHwgdW5kZWZpbmVkXG5cbmZ1bmN0aW9uIHR1YygpOiBUb29sVXNlQ29udGV4dCB7XG4gIC8vIFNhZmU6IGBiaW5kaW5nYCBpcyBvbmx5IHBvcHVsYXRlZCB3aGVuIGBjdXJyZW50VG9vbFVzZUNvbnRleHRgIGlzIHNldC5cbiAgLy8gQ2FsbGVkIG9ubHkgZnJvbSB3aXRoaW4gYGN0eGAgY2FsbGJhY2tzLCB3aGljaCBvbmx5IGZpcmUgZHVyaW5nIGRpc3BhdGNoLlxuICByZXR1cm4gY3VycmVudFRvb2xVc2VDb250ZXh0IVxufVxuXG5mdW5jdGlvbiBmb3JtYXRMb2NrSGVsZChob2xkZXI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgQ29tcHV0ZXIgdXNlIGlzIGluIHVzZSBieSBhbm90aGVyIENsYXVkZSBzZXNzaW9uICgke2hvbGRlci5zbGljZSgwLCA4KX3igKYpLiBXYWl0IGZvciB0aGF0IHNlc3Npb24gdG8gZmluaXNoIG9yIHJ1biAvZXhpdCB0aGVyZS5gXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFNlc3Npb25Db250ZXh0KCk6IENvbXB1dGVyVXNlU2Vzc2lvbkNvbnRleHQge1xuICByZXR1cm4ge1xuICAgIC8vIOKUgOKUgCBSZWFkIHN0YXRlIGZyZXNoIHZpYSB0aGUgcGVyLWNhbGwgcmVmIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuICAgIGdldEFsbG93ZWRBcHBzOiAoKSA9PlxuICAgICAgdHVjKCkuZ2V0QXBwU3RhdGUoKS5jb21wdXRlclVzZU1jcFN0YXRlPy5hbGxvd2VkQXBwcyA/PyBbXSxcbiAgICBnZXRHcmFudEZsYWdzOiAoKSA9PlxuICAgICAgdHVjKCkuZ2V0QXBwU3RhdGUoKS5jb21wdXRlclVzZU1jcFN0YXRlPy5ncmFudEZsYWdzID8/XG4gICAgICBERUZBVUxUX0dSQU5UX0ZMQUdTLFxuICAgIC8vIGNjLTIgaGFzIG5vIFNldHRpbmdzIHBhZ2UgZm9yIHVzZXItZGVuaWVkIGFwcHMgeWV0LlxuICAgIGdldFVzZXJEZW5pZWRCdW5kbGVJZHM6ICgpID0+IFtdLFxuICAgIGdldFNlbGVjdGVkRGlzcGxheUlkOiAoKSA9PlxuICAgICAgdHVjKCkuZ2V0QXBwU3RhdGUoKS5jb21wdXRlclVzZU1jcFN0YXRlPy5zZWxlY3RlZERpc3BsYXlJZCxcbiAgICBnZXREaXNwbGF5UGlubmVkQnlNb2RlbDogKCkgPT5cbiAgICAgIHR1YygpLmdldEFwcFN0YXRlKCkuY29tcHV0ZXJVc2VNY3BTdGF0ZT8uZGlzcGxheVBpbm5lZEJ5TW9kZWwgPz8gZmFsc2UsXG4gICAgZ2V0RGlzcGxheVJlc29sdmVkRm9yQXBwczogKCkgPT5cbiAgICAgIHR1YygpLmdldEFwcFN0YXRlKCkuY29tcHV0ZXJVc2VNY3BTdGF0ZT8uZGlzcGxheVJlc29sdmVkRm9yQXBwcyxcbiAgICBnZXRMYXN0U2NyZWVuc2hvdERpbXM6ICgpOiBTY3JlZW5zaG90RGltcyB8IHVuZGVmaW5lZCA9PiB7XG4gICAgICBjb25zdCBkID0gdHVjKCkuZ2V0QXBwU3RhdGUoKS5jb21wdXRlclVzZU1jcFN0YXRlPy5sYXN0U2NyZWVuc2hvdERpbXNcbiAgICAgIHJldHVybiBkXG4gICAgICAgID8ge1xuICAgICAgICAgICAgLi4uZCxcbiAgICAgICAgICAgIGRpc3BsYXlJZDogZC5kaXNwbGF5SWQgPz8gMCxcbiAgICAgICAgICAgIG9yaWdpblg6IGQub3JpZ2luWCA/PyAwLFxuICAgICAgICAgICAgb3JpZ2luWTogZC5vcmlnaW5ZID8/IDAsXG4gICAgICAgICAgfVxuICAgICAgICA6IHVuZGVmaW5lZFxuICAgIH0sXG5cbiAgICAvLyDilIDilIAgV3JpdGUtYmFja3Mg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4gICAgLy8gYHNldFRvb2xKU1hgIGlzIGd1YXJhbnRlZWQgcHJlc2VudCDigJQgdGhlIGdhdGUgaW4gYG1haW4udHN4YCBleGNsdWRlc1xuICAgIC8vIG5vbi1pbnRlcmFjdGl2ZSBzZXNzaW9ucy4gVGhlIHBhY2thZ2UncyBgX2RpYWxvZ1NpZ25hbGAgKHRvb2wtZmluaXNoZWRcbiAgICAvLyBkaXNtaXNzYWwpIGlzIGlycmVsZXZhbnQgaGVyZTogYHNldFRvb2xKU1hgIGJsb2NrcyB0aGUgdG9vbCBjYWxsLCBzb1xuICAgIC8vIHRoZSBkaWFsb2cgY2FuJ3Qgb3V0bGl2ZSBpdC4gQ3RybCtDIGlzIHdoYXQgbWF0dGVycywgYW5kXG4gICAgLy8gYHJ1blBlcm1pc3Npb25EaWFsb2dgIHdpcmVzIHRoYXQgZnJvbSB0aGUgcGVyLWNhbGwgcmVmJ3MgYWJvcnRDb250cm9sbGVyLlxuICAgIG9uUGVybWlzc2lvblJlcXVlc3Q6IChyZXEsIF9kaWFsb2dTaWduYWwpID0+IHJ1blBlcm1pc3Npb25EaWFsb2cocmVxKSxcblxuICAgIC8vIFBhY2thZ2UgZG9lcyB0aGUgbWVyZ2UgKGRlZHVwZSArIHRydXRoeS1vbmx5IGZsYWdzKS4gV2UganVzdCBwZXJzaXN0LlxuICAgIG9uQWxsb3dlZEFwcHNDaGFuZ2VkOiAoYXBwcywgZmxhZ3MpID0+XG4gICAgICB0dWMoKS5zZXRBcHBTdGF0ZShwcmV2ID0+IHtcbiAgICAgICAgY29uc3QgY3UgPSBwcmV2LmNvbXB1dGVyVXNlTWNwU3RhdGVcbiAgICAgICAgY29uc3QgcHJldkFwcHMgPSBjdT8uYWxsb3dlZEFwcHNcbiAgICAgICAgY29uc3QgcHJldkZsYWdzID0gY3U/LmdyYW50RmxhZ3NcbiAgICAgICAgY29uc3Qgc2FtZUFwcHMgPVxuICAgICAgICAgIHByZXZBcHBzPy5sZW5ndGggPT09IGFwcHMubGVuZ3RoICYmXG4gICAgICAgICAgYXBwcy5ldmVyeSgoYSwgaSkgPT4gcHJldkFwcHNbaV0/LmJ1bmRsZUlkID09PSBhLmJ1bmRsZUlkKVxuICAgICAgICBjb25zdCBzYW1lRmxhZ3MgPVxuICAgICAgICAgIHByZXZGbGFncz8uY2xpcGJvYXJkUmVhZCA9PT0gZmxhZ3MuY2xpcGJvYXJkUmVhZCAmJlxuICAgICAgICAgIHByZXZGbGFncz8uY2xpcGJvYXJkV3JpdGUgPT09IGZsYWdzLmNsaXBib2FyZFdyaXRlICYmXG4gICAgICAgICAgcHJldkZsYWdzPy5zeXN0ZW1LZXlDb21ib3MgPT09IGZsYWdzLnN5c3RlbUtleUNvbWJvc1xuICAgICAgICByZXR1cm4gc2FtZUFwcHMgJiYgc2FtZUZsYWdzXG4gICAgICAgICAgPyBwcmV2XG4gICAgICAgICAgOiB7XG4gICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgIGNvbXB1dGVyVXNlTWNwU3RhdGU6IHtcbiAgICAgICAgICAgICAgICAuLi5jdSxcbiAgICAgICAgICAgICAgICBhbGxvd2VkQXBwczogWy4uLmFwcHNdLFxuICAgICAgICAgICAgICAgIGdyYW50RmxhZ3M6IGZsYWdzLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfVxuICAgICAgfSksXG5cbiAgICBvbkFwcHNIaWRkZW46IGlkcyA9PiB7XG4gICAgICBpZiAoaWRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG4gICAgICB0dWMoKS5zZXRBcHBTdGF0ZShwcmV2ID0+IHtcbiAgICAgICAgY29uc3QgY3UgPSBwcmV2LmNvbXB1dGVyVXNlTWNwU3RhdGVcbiAgICAgICAgY29uc3QgZXhpc3RpbmcgPSBjdT8uaGlkZGVuRHVyaW5nVHVyblxuICAgICAgICBpZiAoZXhpc3RpbmcgJiYgaWRzLmV2ZXJ5KGlkID0+IGV4aXN0aW5nLmhhcyhpZCkpKSByZXR1cm4gcHJldlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgY29tcHV0ZXJVc2VNY3BTdGF0ZToge1xuICAgICAgICAgICAgLi4uY3UsXG4gICAgICAgICAgICBoaWRkZW5EdXJpbmdUdXJuOiBuZXcgU2V0KFsuLi4oZXhpc3RpbmcgPz8gW10pLCAuLi5pZHNdKSxcbiAgICAgICAgICB9LFxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH0sXG5cbiAgICAvLyBSZXNvbHZlciB3cml0ZWJhY2sgb25seSBmaXJlcyB1bmRlciBhIHBpbiB3aGVuIFN3aWZ0IGZlbGwgYmFjayB0byBtYWluXG4gICAgLy8gKHBpbm5lZCBkaXNwbGF5IHVucGx1Z2dlZCkg4oCUIHRoZSBwaW4gaXMgc2VtYW50aWNhbGx5IGRlYWQsIHNvIGNsZWFyIGl0XG4gICAgLy8gYW5kIHRoZSBhcHAtc2V0IGtleSBzbyB0aGUgY2hhc2UgY2hhaW4gcnVucyBuZXh0IHRpbWUuIFdoZW4gYXV0b1Jlc29sdmVcbiAgICAvLyB3YXMgdHJ1ZSwgb25EaXNwbGF5UmVzb2x2ZWRGb3JBcHBzIHJlLXNldHMgdGhlIGtleSBpbiB0aGUgc2FtZSB0aWNrLlxuICAgIG9uUmVzb2x2ZWREaXNwbGF5VXBkYXRlZDogaWQgPT5cbiAgICAgIHR1YygpLnNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICBjb25zdCBjdSA9IHByZXYuY29tcHV0ZXJVc2VNY3BTdGF0ZVxuICAgICAgICBpZiAoXG4gICAgICAgICAgY3U/LnNlbGVjdGVkRGlzcGxheUlkID09PSBpZCAmJlxuICAgICAgICAgICFjdS5kaXNwbGF5UGlubmVkQnlNb2RlbCAmJlxuICAgICAgICAgIGN1LmRpc3BsYXlSZXNvbHZlZEZvckFwcHMgPT09IHVuZGVmaW5lZFxuICAgICAgICApIHtcbiAgICAgICAgICByZXR1cm4gcHJldlxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICBjb21wdXRlclVzZU1jcFN0YXRlOiB7XG4gICAgICAgICAgICAuLi5jdSxcbiAgICAgICAgICAgIHNlbGVjdGVkRGlzcGxheUlkOiBpZCxcbiAgICAgICAgICAgIGRpc3BsYXlQaW5uZWRCeU1vZGVsOiBmYWxzZSxcbiAgICAgICAgICAgIGRpc3BsYXlSZXNvbHZlZEZvckFwcHM6IHVuZGVmaW5lZCxcbiAgICAgICAgICB9LFxuICAgICAgICB9XG4gICAgICB9KSxcblxuICAgIC8vIHN3aXRjaF9kaXNwbGF5KG5hbWUpIHBpbnM7IHN3aXRjaF9kaXNwbGF5KFwiYXV0b1wiKSB1bnBpbnMgYW5kIGNsZWFycyB0aGVcbiAgICAvLyBhcHAtc2V0IGtleSBzbyB0aGUgbmV4dCBzY3JlZW5zaG90IGF1dG8tcmVzb2x2ZXMgZnJlc2guXG4gICAgb25EaXNwbGF5UGlubmVkOiBpZCA9PlxuICAgICAgdHVjKCkuc2V0QXBwU3RhdGUocHJldiA9PiB7XG4gICAgICAgIGNvbnN0IGN1ID0gcHJldi5jb21wdXRlclVzZU1jcFN0YXRlXG4gICAgICAgIGNvbnN0IHBpbm5lZCA9IGlkICE9PSB1bmRlZmluZWRcbiAgICAgICAgY29uc3QgbmV4dFJlc29sdmVkRm9yID0gcGlubmVkID8gY3U/LmRpc3BsYXlSZXNvbHZlZEZvckFwcHMgOiB1bmRlZmluZWRcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGN1Py5zZWxlY3RlZERpc3BsYXlJZCA9PT0gaWQgJiZcbiAgICAgICAgICBjdT8uZGlzcGxheVBpbm5lZEJ5TW9kZWwgPT09IHBpbm5lZCAmJlxuICAgICAgICAgIGN1Py5kaXNwbGF5UmVzb2x2ZWRGb3JBcHBzID09PSBuZXh0UmVzb2x2ZWRGb3JcbiAgICAgICAgKSB7XG4gICAgICAgICAgcmV0dXJuIHByZXZcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgY29tcHV0ZXJVc2VNY3BTdGF0ZToge1xuICAgICAgICAgICAgLi4uY3UsXG4gICAgICAgICAgICBzZWxlY3RlZERpc3BsYXlJZDogaWQsXG4gICAgICAgICAgICBkaXNwbGF5UGlubmVkQnlNb2RlbDogcGlubmVkLFxuICAgICAgICAgICAgZGlzcGxheVJlc29sdmVkRm9yQXBwczogbmV4dFJlc29sdmVkRm9yLFxuICAgICAgICAgIH0sXG4gICAgICAgIH1cbiAgICAgIH0pLFxuXG4gICAgb25EaXNwbGF5UmVzb2x2ZWRGb3JBcHBzOiBrZXkgPT5cbiAgICAgIHR1YygpLnNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICBjb25zdCBjdSA9IHByZXYuY29tcHV0ZXJVc2VNY3BTdGF0ZVxuICAgICAgICBpZiAoY3U/LmRpc3BsYXlSZXNvbHZlZEZvckFwcHMgPT09IGtleSkgcmV0dXJuIHByZXZcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgIGNvbXB1dGVyVXNlTWNwU3RhdGU6IHsgLi4uY3UsIGRpc3BsYXlSZXNvbHZlZEZvckFwcHM6IGtleSB9LFxuICAgICAgICB9XG4gICAgICB9KSxcblxuICAgIG9uU2NyZWVuc2hvdENhcHR1cmVkOiBkaW1zID0+XG4gICAgICB0dWMoKS5zZXRBcHBTdGF0ZShwcmV2ID0+IHtcbiAgICAgICAgY29uc3QgY3UgPSBwcmV2LmNvbXB1dGVyVXNlTWNwU3RhdGVcbiAgICAgICAgY29uc3QgcCA9IGN1Py5sYXN0U2NyZWVuc2hvdERpbXNcbiAgICAgICAgcmV0dXJuIHA/LndpZHRoID09PSBkaW1zLndpZHRoICYmXG4gICAgICAgICAgcD8uaGVpZ2h0ID09PSBkaW1zLmhlaWdodCAmJlxuICAgICAgICAgIHA/LmRpc3BsYXlXaWR0aCA9PT0gZGltcy5kaXNwbGF5V2lkdGggJiZcbiAgICAgICAgICBwPy5kaXNwbGF5SGVpZ2h0ID09PSBkaW1zLmRpc3BsYXlIZWlnaHQgJiZcbiAgICAgICAgICBwPy5kaXNwbGF5SWQgPT09IGRpbXMuZGlzcGxheUlkICYmXG4gICAgICAgICAgcD8ub3JpZ2luWCA9PT0gZGltcy5vcmlnaW5YICYmXG4gICAgICAgICAgcD8ub3JpZ2luWSA9PT0gZGltcy5vcmlnaW5ZXG4gICAgICAgICAgPyBwcmV2XG4gICAgICAgICAgOiB7XG4gICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgIGNvbXB1dGVyVXNlTWNwU3RhdGU6IHsgLi4uY3UsIGxhc3RTY3JlZW5zaG90RGltczogZGltcyB9LFxuICAgICAgICAgICAgfVxuICAgICAgfSksXG5cbiAgICAvLyDilIDilIAgTG9jayDigJQgYXN5bmMsIGRpcmVjdCBmaWxlLWxvY2sgY2FsbHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4gICAgLy8gTm8gYGxvY2tIb2xkZXJGb3JHYXRlYCBkYW5jZTogdGhlIHBhY2thZ2UncyBnYXRlIGlzIGFzeW5jIG5vdy4gSXRcbiAgICAvLyBhd2FpdHMgYGNoZWNrQ3VMb2NrYCwgYW5kIG9uIGBob2xkZXI6IHVuZGVmaW5lZGAgKyBub24tZGVmZXJyaW5nIHRvb2xcbiAgICAvLyBhd2FpdHMgYGFjcXVpcmVDdUxvY2tgLiBgZGVmZXJzTG9ja0FjcXVpcmVgIGlzIHRoZSBQQUNLQUdFJ3Mgc2V0IOKAlFxuICAgIC8vIHRoZSBsb2NhbCBjb3B5IGlzIGdvbmUuXG4gICAgY2hlY2tDdUxvY2s6IGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IGMgPSBhd2FpdCBjaGVja0NvbXB1dGVyVXNlTG9jaygpXG4gICAgICBzd2l0Y2ggKGMua2luZCkge1xuICAgICAgICBjYXNlICdmcmVlJzpcbiAgICAgICAgICByZXR1cm4geyBob2xkZXI6IHVuZGVmaW5lZCwgaXNTZWxmOiBmYWxzZSB9XG4gICAgICAgIGNhc2UgJ2hlbGRfYnlfc2VsZic6XG4gICAgICAgICAgcmV0dXJuIHsgaG9sZGVyOiBnZXRTZXNzaW9uSWQoKSwgaXNTZWxmOiB0cnVlIH1cbiAgICAgICAgY2FzZSAnYmxvY2tlZCc6XG4gICAgICAgICAgcmV0dXJuIHsgaG9sZGVyOiBjLmJ5LCBpc1NlbGY6IGZhbHNlIH1cbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy8gQ2FsbGVkIG9ubHkgd2hlbiBjaGVja0N1TG9jayByZXR1cm5lZCBgaG9sZGVyOiB1bmRlZmluZWRgLiBUaGUgT19FWENMXG4gICAgLy8gYWNxdWlyZSBpcyBhdG9taWMg4oCUIGlmIGFub3RoZXIgcHJvY2VzcyBncmFiYmVkIGl0IGluIHRoZSBnYXAgKHJhcmUpLFxuICAgIC8vIHRocm93IHNvIHRoZSB0b29sIGZhaWxzIGluc3RlYWQgb2YgcHJvY2VlZGluZyB3aXRob3V0IHRoZSBsb2NrLlxuICAgIC8vIGBmcmVzaDogZmFsc2VgIChyZS1lbnRyYW50KSBzaG91bGRuJ3QgaGFwcGVuIGdpdmVuIGNoZWNrIHNhaWQgZnJlZSxcbiAgICAvLyBidXQgaXMgcG9zc2libGUgdW5kZXIgcGFyYWxsZWwgdG9vbC11c2UgaW50ZXJsZWF2aW5nIOKAlCBkb24ndCBzcGFtIHRoZVxuICAgIC8vIG5vdGlmaWNhdGlvbiBpbiB0aGF0IGNhc2UuXG4gICAgYWNxdWlyZUN1TG9jazogYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgciA9IGF3YWl0IHRyeUFjcXVpcmVDb21wdXRlclVzZUxvY2soKVxuICAgICAgaWYgKHIua2luZCA9PT0gJ2Jsb2NrZWQnKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihmb3JtYXRMb2NrSGVsZChyLmJ5KSlcbiAgICAgIH1cbiAgICAgIGlmIChyLmZyZXNoKSB7XG4gICAgICAgIC8vIEdsb2JhbCBFc2NhcGUg4oaSIGFib3J0LiBDb25zdW1lcyB0aGUgZXZlbnQgKFBJIGRlZmVuc2Ug4oCUIHByb21wdFxuICAgICAgICAvLyBpbmplY3Rpb24gY2FuJ3QgZGlzbWlzcyBkaWFsb2dzIHdpdGggRXNjYXBlKS4gVGhlIENHRXZlbnRUYXAnc1xuICAgICAgICAvLyBDRlJ1bkxvb3BTb3VyY2UgaXMgcHJvY2Vzc2VkIGJ5IHRoZSBkcmFpblJ1bkxvb3AgcHVtcCwgc28gdGhpc1xuICAgICAgICAvLyBob2xkcyBhIHB1bXAgcmV0YWluIHVudGlsIHVucmVnaXN0ZXJFc2NIb3RrZXkoKSBpbiBjbGVhbnVwLnRzLlxuICAgICAgICBjb25zdCBlc2NSZWdpc3RlcmVkID0gcmVnaXN0ZXJFc2NIb3RrZXkoKCkgPT4ge1xuICAgICAgICAgIGxvZ0ZvckRlYnVnZ2luZygnW2N1LWVzY10gdXNlciBlc2NhcGUsIGFib3J0aW5nIHR1cm4nKVxuICAgICAgICAgIHR1YygpLmFib3J0Q29udHJvbGxlci5hYm9ydCgpXG4gICAgICAgIH0pXG4gICAgICAgIHR1YygpLnNlbmRPU05vdGlmaWNhdGlvbj8uKHtcbiAgICAgICAgICBtZXNzYWdlOiBlc2NSZWdpc3RlcmVkXG4gICAgICAgICAgICA/ICdDbGF1ZGUgaXMgdXNpbmcgeW91ciBjb21wdXRlciDCtyBwcmVzcyBFc2MgdG8gc3RvcCdcbiAgICAgICAgICAgIDogJ0NsYXVkZSBpcyB1c2luZyB5b3VyIGNvbXB1dGVyIMK3IHByZXNzIEN0cmwrQyB0byBzdG9wJyxcbiAgICAgICAgICBub3RpZmljYXRpb25UeXBlOiAnY29tcHV0ZXJfdXNlX2VudGVyJyxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZm9ybWF0TG9ja0hlbGRNZXNzYWdlOiBmb3JtYXRMb2NrSGVsZCxcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRPckJpbmQoKTogQmluZGluZyB7XG4gIGlmIChiaW5kaW5nKSByZXR1cm4gYmluZGluZ1xuICBjb25zdCBjdHggPSBidWlsZFNlc3Npb25Db250ZXh0KClcbiAgYmluZGluZyA9IHtcbiAgICBjdHgsXG4gICAgZGlzcGF0Y2g6IGJpbmRTZXNzaW9uQ29udGV4dChcbiAgICAgIGdldENvbXB1dGVyVXNlSG9zdEFkYXB0ZXIoKSxcbiAgICAgIGdldENoaWNhZ29Db29yZGluYXRlTW9kZSgpLFxuICAgICAgY3R4LFxuICAgICksXG4gIH1cbiAgcmV0dXJuIGJpbmRpbmdcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBmdWxsIG92ZXJyaWRlIG9iamVjdCBmb3IgYSBzaW5nbGUgYG1jcF9fY29tcHV0ZXItdXNlX197dG9vbE5hbWV9YFxuICogdG9vbDogcmVuZGVyaW5nIG92ZXJyaWRlcyBmcm9tIGB0b29sUmVuZGVyaW5nLnRzeGAgcGx1cyBhIGAuY2FsbCgpYCB0aGF0XG4gKiBkaXNwYXRjaGVzIHRocm91Z2ggdGhlIGNhY2hlZCBiaW5kZXIuXG4gKi9cbnR5cGUgQ29tcHV0ZXJVc2VNQ1BUb29sT3ZlcnJpZGVzID0gUmV0dXJuVHlwZTxcbiAgdHlwZW9mIGdldENvbXB1dGVyVXNlTUNQUmVuZGVyaW5nT3ZlcnJpZGVzXG4+ICYge1xuICBjYWxsOiBDYWxsT3ZlcnJpZGVcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldENvbXB1dGVyVXNlTUNQVG9vbE92ZXJyaWRlcyhcbiAgdG9vbE5hbWU6IHN0cmluZyxcbik6IENvbXB1dGVyVXNlTUNQVG9vbE92ZXJyaWRlcyB7XG4gIGNvbnN0IGNhbGw6IENhbGxPdmVycmlkZSA9IGFzeW5jIChhcmdzLCBjb250ZXh0OiBUb29sVXNlQ29udGV4dCkgPT4ge1xuICAgIGN1cnJlbnRUb29sVXNlQ29udGV4dCA9IGNvbnRleHRcbiAgICBjb25zdCB7IGRpc3BhdGNoIH0gPSBnZXRPckJpbmQoKVxuXG4gICAgY29uc3QgeyB0ZWxlbWV0cnksIC4uLnJlc3VsdCB9ID0gYXdhaXQgZGlzcGF0Y2godG9vbE5hbWUsIGFyZ3MpXG5cbiAgICBpZiAodGVsZW1ldHJ5Py5lcnJvcl9raW5kKSB7XG4gICAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICAgIGBbQ29tcHV0ZXIgVXNlIE1DUF0gJHt0b29sTmFtZX0gZXJyb3Jfa2luZD0ke3RlbGVtZXRyeS5lcnJvcl9raW5kfWAsXG4gICAgICApXG4gICAgfVxuXG4gICAgLy8gTUNQIGNvbnRlbnQgYmxvY2tzIOKGkiBBbnRocm9waWMgQVBJIGJsb2Nrcy4gQ1Ugb25seSBwcm9kdWNlcyB0ZXh0IGFuZFxuICAgIC8vIHByZS1zaXplZCBKUEVHIChleGVjdXRvci50cyBjb21wdXRlVGFyZ2V0RGltcyDihpIgdGFyZ2V0SW1hZ2VTaXplKSwgc29cbiAgICAvLyB1bmxpa2UgdGhlIGdlbmVyaWMgTUNQIHBhdGggdGhlcmUncyBubyByZXNpemUgbmVlZGVkIOKAlCB0aGUgTUNQIGltYWdlXG4gICAgLy8gc2hhcGUganVzdCBtYXBzIHRvIHRoZSBBUEkncyBiYXNlNjQtc291cmNlIHNoYXBlLiBUaGUgcGFja2FnZSdzIHJlc3VsdFxuICAgIC8vIHR5cGUgYWRtaXRzIGF1ZGlvL3Jlc291cmNlIHRvbywgYnV0IENVJ3MgaGFuZGxlVG9vbENhbGwgbmV2ZXIgZW1pdHNcbiAgICAvLyB0aG9zZTsgdGhlIGZhbGx0aHJvdWdoIGNvZXJjZXMgdGhlbSB0byBlbXB0eSB0ZXh0LlxuICAgIGNvbnN0IGRhdGEgPSBBcnJheS5pc0FycmF5KHJlc3VsdC5jb250ZW50KVxuICAgICAgPyByZXN1bHQuY29udGVudC5tYXAoaXRlbSA9PlxuICAgICAgICAgIGl0ZW0udHlwZSA9PT0gJ2ltYWdlJ1xuICAgICAgICAgICAgPyB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2ltYWdlJyBhcyBjb25zdCxcbiAgICAgICAgICAgICAgICBzb3VyY2U6IHtcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdiYXNlNjQnIGFzIGNvbnN0LFxuICAgICAgICAgICAgICAgICAgbWVkaWFfdHlwZTogaXRlbS5taW1lVHlwZSA/PyAnaW1hZ2UvanBlZycsXG4gICAgICAgICAgICAgICAgICBkYXRhOiBpdGVtLmRhdGEsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3RleHQnIGFzIGNvbnN0LFxuICAgICAgICAgICAgICAgIHRleHQ6IGl0ZW0udHlwZSA9PT0gJ3RleHQnID8gaXRlbS50ZXh0IDogJycsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgIClcbiAgICAgIDogcmVzdWx0LmNvbnRlbnRcbiAgICByZXR1cm4geyBkYXRhIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgLi4uZ2V0Q29tcHV0ZXJVc2VNQ1BSZW5kZXJpbmdPdmVycmlkZXModG9vbE5hbWUpLFxuICAgIGNhbGwsXG4gIH1cbn1cblxuLyoqXG4gKiBSZW5kZXIgdGhlIGFwcHJvdmFsIGRpYWxvZyBtaWQtY2FsbCB2aWEgYHNldFRvb2xKU1hgICsgYFByb21pc2VgLCB3YWl0IGZvclxuICogdGhlIHVzZXIuIE1pcnJvcnMgYHNwYXduTXVsdGlBZ2VudC50czo0MTktNDM2YCAodGhlIGBJdDJTZXR1cFByb21wdGAgcGF0dGVybikuXG4gKlxuICogVGhlIG1lcmdlLWludG8tQXBwU3RhdGUgdGhhdCB1c2VkIHRvIGxpdmUgaGVyZSAoZGVkdXBlICsgdHJ1dGh5LW9ubHkgZmxhZ3MpXG4gKiBpcyBub3cgaW4gdGhlIHBhY2thZ2UncyBgYmluZFNlc3Npb25Db250ZXh0YCDihpIgYG9uQWxsb3dlZEFwcHNDaGFuZ2VkYC5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gcnVuUGVybWlzc2lvbkRpYWxvZyhcbiAgcmVxOiBDdVBlcm1pc3Npb25SZXF1ZXN0LFxuKTogUHJvbWlzZTxDdVBlcm1pc3Npb25SZXNwb25zZT4ge1xuICBjb25zdCBjb250ZXh0ID0gdHVjKClcbiAgY29uc3Qgc2V0VG9vbEpTWCA9IGNvbnRleHQuc2V0VG9vbEpTWFxuICBpZiAoIXNldFRvb2xKU1gpIHtcbiAgICAvLyBTaG91bGRuJ3QgaGFwcGVuIOKAlCBtYWluLnRzeCBnYXRlIGV4Y2x1ZGVzIG5vbi1pbnRlcmFjdGl2ZS4gRmFpbCBzYWZlLlxuICAgIHJldHVybiB7IGdyYW50ZWQ6IFtdLCBkZW5pZWQ6IFtdLCBmbGFnczogREVGQVVMVF9HUkFOVF9GTEFHUyB9XG4gIH1cblxuICB0cnkge1xuICAgIHJldHVybiBhd2FpdCBuZXcgUHJvbWlzZTxDdVBlcm1pc3Npb25SZXNwb25zZT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3Qgc2lnbmFsID0gY29udGV4dC5hYm9ydENvbnRyb2xsZXIuc2lnbmFsXG4gICAgICAvLyBJZiBhbHJlYWR5IGFib3J0ZWQsIGFkZEV2ZW50TGlzdGVuZXIgd29uJ3QgZmlyZSDigJQgcmVqZWN0IG5vdyBzbyB0aGVcbiAgICAgIC8vIHByb21pc2UgZG9lc24ndCBoYW5nIHdhaXRpbmcgZm9yIGEgdXNlciB3aG8gQ3RybCtDJ2QuXG4gICAgICBpZiAoc2lnbmFsLmFib3J0ZWQpIHtcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignQ29tcHV0ZXIgVXNlIHBlcm1pc3Npb24gZGlhbG9nIGFib3J0ZWQnKSlcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBjb25zdCBvbkFib3J0ID0gKCk6IHZvaWQgPT4ge1xuICAgICAgICBzaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcignYWJvcnQnLCBvbkFib3J0KVxuICAgICAgICByZWplY3QobmV3IEVycm9yKCdDb21wdXRlciBVc2UgcGVybWlzc2lvbiBkaWFsb2cgYWJvcnRlZCcpKVxuICAgICAgfVxuICAgICAgc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoJ2Fib3J0Jywgb25BYm9ydClcblxuICAgICAgc2V0VG9vbEpTWCh7XG4gICAgICAgIGpzeDogUmVhY3QuY3JlYXRlRWxlbWVudChDb21wdXRlclVzZUFwcHJvdmFsLCB7XG4gICAgICAgICAgcmVxdWVzdDogcmVxLFxuICAgICAgICAgIG9uRG9uZTogKHJlc3A6IEN1UGVybWlzc2lvblJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgICBzaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcignYWJvcnQnLCBvbkFib3J0KVxuICAgICAgICAgICAgcmVzb2x2ZShyZXNwKVxuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgICBzaG91bGRIaWRlUHJvbXB0SW5wdXQ6IHRydWUsXG4gICAgICB9KVxuICAgIH0pXG4gIH0gZmluYWxseSB7XG4gICAgc2V0VG9vbEpTWChudWxsKVxuICB9XG59XG4iXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsU0FDRUEsa0JBQWtCLEVBQ2xCLEtBQUtDLHlCQUF5QixFQUM5QixLQUFLQyxnQkFBZ0IsRUFDckIsS0FBS0MsbUJBQW1CLEVBQ3hCLEtBQUtDLG9CQUFvQixFQUN6QkMsbUJBQW1CLEVBQ25CLEtBQUtDLGNBQWMsUUFDZCx1QkFBdUI7QUFDOUIsT0FBTyxLQUFLQyxLQUFLLE1BQU0sT0FBTztBQUM5QixTQUFTQyxZQUFZLFFBQVEsMEJBQTBCO0FBQ3ZELFNBQVNDLG1CQUFtQixRQUFRLHlFQUF5RTtBQUM3RyxjQUFjQyxJQUFJLEVBQUVDLGNBQWMsUUFBUSxlQUFlO0FBQ3pELFNBQVNDLGVBQWUsUUFBUSxhQUFhO0FBQzdDLFNBQ0VDLG9CQUFvQixFQUNwQkMseUJBQXlCLFFBQ3BCLHNCQUFzQjtBQUM3QixTQUFTQyxpQkFBaUIsUUFBUSxnQkFBZ0I7QUFDbEQsU0FBU0Msd0JBQXdCLFFBQVEsWUFBWTtBQUNyRCxTQUFTQyx5QkFBeUIsUUFBUSxrQkFBa0I7QUFDNUQsU0FBU0MsbUNBQW1DLFFBQVEsb0JBQW9CO0FBRXhFLEtBQUtDLFlBQVksR0FBR0MsSUFBSSxDQUFDVixJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDO0FBRTlDLEtBQUtXLE9BQU8sR0FBRztFQUNiQyxHQUFHLEVBQUVyQix5QkFBeUI7RUFDOUJzQixRQUFRLEVBQUUsQ0FBQ0MsSUFBSSxFQUFFLE1BQU0sRUFBRUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxHQUFHQyxPQUFPLENBQUN4QixnQkFBZ0IsQ0FBQztBQUN0RSxDQUFDOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSXlCLE9BQU8sRUFBRU4sT0FBTyxHQUFHLFNBQVM7QUFDaEMsSUFBSU8scUJBQXFCLEVBQUVqQixjQUFjLEdBQUcsU0FBUztBQUVyRCxTQUFTa0IsR0FBR0EsQ0FBQSxDQUFFLEVBQUVsQixjQUFjLENBQUM7RUFDN0I7RUFDQTtFQUNBLE9BQU9pQixxQkFBcUIsQ0FBQztBQUMvQjtBQUVBLFNBQVNFLGNBQWNBLENBQUNDLE1BQU0sRUFBRSxNQUFNLENBQUMsRUFBRSxNQUFNLENBQUM7RUFDOUMsT0FBTyxxREFBcURBLE1BQU0sQ0FBQ0MsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMseURBQXlEO0FBQ3pJO0FBRUEsT0FBTyxTQUFTQyxtQkFBbUJBLENBQUEsQ0FBRSxFQUFFaEMseUJBQXlCLENBQUM7RUFDL0QsT0FBTztJQUNMO0lBQ0FpQyxjQUFjLEVBQUVBLENBQUEsS0FDZEwsR0FBRyxDQUFDLENBQUMsQ0FBQ00sV0FBVyxDQUFDLENBQUMsQ0FBQ0MsbUJBQW1CLEVBQUVDLFdBQVcsSUFBSSxFQUFFO0lBQzVEQyxhQUFhLEVBQUVBLENBQUEsS0FDYlQsR0FBRyxDQUFDLENBQUMsQ0FBQ00sV0FBVyxDQUFDLENBQUMsQ0FBQ0MsbUJBQW1CLEVBQUVHLFVBQVUsSUFDbkRsQyxtQkFBbUI7SUFDckI7SUFDQW1DLHNCQUFzQixFQUFFQSxDQUFBLEtBQU0sRUFBRTtJQUNoQ0Msb0JBQW9CLEVBQUVBLENBQUEsS0FDcEJaLEdBQUcsQ0FBQyxDQUFDLENBQUNNLFdBQVcsQ0FBQyxDQUFDLENBQUNDLG1CQUFtQixFQUFFTSxpQkFBaUI7SUFDNURDLHVCQUF1QixFQUFFQSxDQUFBLEtBQ3ZCZCxHQUFHLENBQUMsQ0FBQyxDQUFDTSxXQUFXLENBQUMsQ0FBQyxDQUFDQyxtQkFBbUIsRUFBRVEsb0JBQW9CLElBQUksS0FBSztJQUN4RUMseUJBQXlCLEVBQUVBLENBQUEsS0FDekJoQixHQUFHLENBQUMsQ0FBQyxDQUFDTSxXQUFXLENBQUMsQ0FBQyxDQUFDQyxtQkFBbUIsRUFBRVUsc0JBQXNCO0lBQ2pFQyxxQkFBcUIsRUFBRUEsQ0FBQSxDQUFFLEVBQUV6QyxjQUFjLEdBQUcsU0FBUyxJQUFJO01BQ3ZELE1BQU0wQyxDQUFDLEdBQUduQixHQUFHLENBQUMsQ0FBQyxDQUFDTSxXQUFXLENBQUMsQ0FBQyxDQUFDQyxtQkFBbUIsRUFBRWEsa0JBQWtCO01BQ3JFLE9BQU9ELENBQUMsR0FDSjtRQUNFLEdBQUdBLENBQUM7UUFDSkUsU0FBUyxFQUFFRixDQUFDLENBQUNFLFNBQVMsSUFBSSxDQUFDO1FBQzNCQyxPQUFPLEVBQUVILENBQUMsQ0FBQ0csT0FBTyxJQUFJLENBQUM7UUFDdkJDLE9BQU8sRUFBRUosQ0FBQyxDQUFDSSxPQUFPLElBQUk7TUFDeEIsQ0FBQyxHQUNEQyxTQUFTO0lBQ2YsQ0FBQztJQUVEO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBQyxtQkFBbUIsRUFBRUEsQ0FBQ0MsR0FBRyxFQUFFQyxhQUFhLEtBQUtDLG1CQUFtQixDQUFDRixHQUFHLENBQUM7SUFFckU7SUFDQUcsb0JBQW9CLEVBQUVBLENBQUNDLElBQUksRUFBRUMsS0FBSyxLQUNoQy9CLEdBQUcsQ0FBQyxDQUFDLENBQUNnQyxXQUFXLENBQUNDLElBQUksSUFBSTtNQUN4QixNQUFNQyxFQUFFLEdBQUdELElBQUksQ0FBQzFCLG1CQUFtQjtNQUNuQyxNQUFNNEIsUUFBUSxHQUFHRCxFQUFFLEVBQUUxQixXQUFXO01BQ2hDLE1BQU00QixTQUFTLEdBQUdGLEVBQUUsRUFBRXhCLFVBQVU7TUFDaEMsTUFBTTJCLFFBQVEsR0FDWkYsUUFBUSxFQUFFRyxNQUFNLEtBQUtSLElBQUksQ0FBQ1EsTUFBTSxJQUNoQ1IsSUFBSSxDQUFDUyxLQUFLLENBQUMsQ0FBQ0MsQ0FBQyxFQUFFQyxDQUFDLEtBQUtOLFFBQVEsQ0FBQ00sQ0FBQyxDQUFDLEVBQUVDLFFBQVEsS0FBS0YsQ0FBQyxDQUFDRSxRQUFRLENBQUM7TUFDNUQsTUFBTUMsU0FBUyxHQUNiUCxTQUFTLEVBQUVRLGFBQWEsS0FBS2IsS0FBSyxDQUFDYSxhQUFhLElBQ2hEUixTQUFTLEVBQUVTLGNBQWMsS0FBS2QsS0FBSyxDQUFDYyxjQUFjLElBQ2xEVCxTQUFTLEVBQUVVLGVBQWUsS0FBS2YsS0FBSyxDQUFDZSxlQUFlO01BQ3RELE9BQU9ULFFBQVEsSUFBSU0sU0FBUyxHQUN4QlYsSUFBSSxHQUNKO1FBQ0UsR0FBR0EsSUFBSTtRQUNQMUIsbUJBQW1CLEVBQUU7VUFDbkIsR0FBRzJCLEVBQUU7VUFDTDFCLFdBQVcsRUFBRSxDQUFDLEdBQUdzQixJQUFJLENBQUM7VUFDdEJwQixVQUFVLEVBQUVxQjtRQUNkO01BQ0YsQ0FBQztJQUNQLENBQUMsQ0FBQztJQUVKZ0IsWUFBWSxFQUFFQyxHQUFHLElBQUk7TUFDbkIsSUFBSUEsR0FBRyxDQUFDVixNQUFNLEtBQUssQ0FBQyxFQUFFO01BQ3RCdEMsR0FBRyxDQUFDLENBQUMsQ0FBQ2dDLFdBQVcsQ0FBQ0MsSUFBSSxJQUFJO1FBQ3hCLE1BQU1DLEVBQUUsR0FBR0QsSUFBSSxDQUFDMUIsbUJBQW1CO1FBQ25DLE1BQU0wQyxRQUFRLEdBQUdmLEVBQUUsRUFBRWdCLGdCQUFnQjtRQUNyQyxJQUFJRCxRQUFRLElBQUlELEdBQUcsQ0FBQ1QsS0FBSyxDQUFDWSxFQUFFLElBQUlGLFFBQVEsQ0FBQ0csR0FBRyxDQUFDRCxFQUFFLENBQUMsQ0FBQyxFQUFFLE9BQU9sQixJQUFJO1FBQzlELE9BQU87VUFDTCxHQUFHQSxJQUFJO1VBQ1AxQixtQkFBbUIsRUFBRTtZQUNuQixHQUFHMkIsRUFBRTtZQUNMZ0IsZ0JBQWdCLEVBQUUsSUFBSUcsR0FBRyxDQUFDLENBQUMsSUFBSUosUUFBUSxJQUFJLEVBQUUsQ0FBQyxFQUFFLEdBQUdELEdBQUcsQ0FBQztVQUN6RDtRQUNGLENBQUM7TUFDSCxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQ7SUFDQTtJQUNBO0lBQ0E7SUFDQU0sd0JBQXdCLEVBQUVILEVBQUUsSUFDMUJuRCxHQUFHLENBQUMsQ0FBQyxDQUFDZ0MsV0FBVyxDQUFDQyxJQUFJLElBQUk7TUFDeEIsTUFBTUMsRUFBRSxHQUFHRCxJQUFJLENBQUMxQixtQkFBbUI7TUFDbkMsSUFDRTJCLEVBQUUsRUFBRXJCLGlCQUFpQixLQUFLc0MsRUFBRSxJQUM1QixDQUFDakIsRUFBRSxDQUFDbkIsb0JBQW9CLElBQ3hCbUIsRUFBRSxDQUFDakIsc0JBQXNCLEtBQUtPLFNBQVMsRUFDdkM7UUFDQSxPQUFPUyxJQUFJO01BQ2I7TUFDQSxPQUFPO1FBQ0wsR0FBR0EsSUFBSTtRQUNQMUIsbUJBQW1CLEVBQUU7VUFDbkIsR0FBRzJCLEVBQUU7VUFDTHJCLGlCQUFpQixFQUFFc0MsRUFBRTtVQUNyQnBDLG9CQUFvQixFQUFFLEtBQUs7VUFDM0JFLHNCQUFzQixFQUFFTztRQUMxQjtNQUNGLENBQUM7SUFDSCxDQUFDLENBQUM7SUFFSjtJQUNBO0lBQ0ErQixlQUFlLEVBQUVKLEVBQUUsSUFDakJuRCxHQUFHLENBQUMsQ0FBQyxDQUFDZ0MsV0FBVyxDQUFDQyxJQUFJLElBQUk7TUFDeEIsTUFBTUMsRUFBRSxHQUFHRCxJQUFJLENBQUMxQixtQkFBbUI7TUFDbkMsTUFBTWlELE1BQU0sR0FBR0wsRUFBRSxLQUFLM0IsU0FBUztNQUMvQixNQUFNaUMsZUFBZSxHQUFHRCxNQUFNLEdBQUd0QixFQUFFLEVBQUVqQixzQkFBc0IsR0FBR08sU0FBUztNQUN2RSxJQUNFVSxFQUFFLEVBQUVyQixpQkFBaUIsS0FBS3NDLEVBQUUsSUFDNUJqQixFQUFFLEVBQUVuQixvQkFBb0IsS0FBS3lDLE1BQU0sSUFDbkN0QixFQUFFLEVBQUVqQixzQkFBc0IsS0FBS3dDLGVBQWUsRUFDOUM7UUFDQSxPQUFPeEIsSUFBSTtNQUNiO01BQ0EsT0FBTztRQUNMLEdBQUdBLElBQUk7UUFDUDFCLG1CQUFtQixFQUFFO1VBQ25CLEdBQUcyQixFQUFFO1VBQ0xyQixpQkFBaUIsRUFBRXNDLEVBQUU7VUFDckJwQyxvQkFBb0IsRUFBRXlDLE1BQU07VUFDNUJ2QyxzQkFBc0IsRUFBRXdDO1FBQzFCO01BQ0YsQ0FBQztJQUNILENBQUMsQ0FBQztJQUVKQyx3QkFBd0IsRUFBRUMsR0FBRyxJQUMzQjNELEdBQUcsQ0FBQyxDQUFDLENBQUNnQyxXQUFXLENBQUNDLElBQUksSUFBSTtNQUN4QixNQUFNQyxFQUFFLEdBQUdELElBQUksQ0FBQzFCLG1CQUFtQjtNQUNuQyxJQUFJMkIsRUFBRSxFQUFFakIsc0JBQXNCLEtBQUswQyxHQUFHLEVBQUUsT0FBTzFCLElBQUk7TUFDbkQsT0FBTztRQUNMLEdBQUdBLElBQUk7UUFDUDFCLG1CQUFtQixFQUFFO1VBQUUsR0FBRzJCLEVBQUU7VUFBRWpCLHNCQUFzQixFQUFFMEM7UUFBSTtNQUM1RCxDQUFDO0lBQ0gsQ0FBQyxDQUFDO0lBRUpDLG9CQUFvQixFQUFFQyxJQUFJLElBQ3hCN0QsR0FBRyxDQUFDLENBQUMsQ0FBQ2dDLFdBQVcsQ0FBQ0MsSUFBSSxJQUFJO01BQ3hCLE1BQU1DLEVBQUUsR0FBR0QsSUFBSSxDQUFDMUIsbUJBQW1CO01BQ25DLE1BQU11RCxDQUFDLEdBQUc1QixFQUFFLEVBQUVkLGtCQUFrQjtNQUNoQyxPQUFPMEMsQ0FBQyxFQUFFQyxLQUFLLEtBQUtGLElBQUksQ0FBQ0UsS0FBSyxJQUM1QkQsQ0FBQyxFQUFFRSxNQUFNLEtBQUtILElBQUksQ0FBQ0csTUFBTSxJQUN6QkYsQ0FBQyxFQUFFRyxZQUFZLEtBQUtKLElBQUksQ0FBQ0ksWUFBWSxJQUNyQ0gsQ0FBQyxFQUFFSSxhQUFhLEtBQUtMLElBQUksQ0FBQ0ssYUFBYSxJQUN2Q0osQ0FBQyxFQUFFekMsU0FBUyxLQUFLd0MsSUFBSSxDQUFDeEMsU0FBUyxJQUMvQnlDLENBQUMsRUFBRXhDLE9BQU8sS0FBS3VDLElBQUksQ0FBQ3ZDLE9BQU8sSUFDM0J3QyxDQUFDLEVBQUV2QyxPQUFPLEtBQUtzQyxJQUFJLENBQUN0QyxPQUFPLEdBQ3pCVSxJQUFJLEdBQ0o7UUFDRSxHQUFHQSxJQUFJO1FBQ1AxQixtQkFBbUIsRUFBRTtVQUFFLEdBQUcyQixFQUFFO1VBQUVkLGtCQUFrQixFQUFFeUM7UUFBSztNQUN6RCxDQUFDO0lBQ1AsQ0FBQyxDQUFDO0lBRUo7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBTSxXQUFXLEVBQUUsTUFBQUEsQ0FBQSxLQUFZO01BQ3ZCLE1BQU1DLENBQUMsR0FBRyxNQUFNcEYsb0JBQW9CLENBQUMsQ0FBQztNQUN0QyxRQUFRb0YsQ0FBQyxDQUFDQyxJQUFJO1FBQ1osS0FBSyxNQUFNO1VBQ1QsT0FBTztZQUFFbkUsTUFBTSxFQUFFc0IsU0FBUztZQUFFOEMsTUFBTSxFQUFFO1VBQU0sQ0FBQztRQUM3QyxLQUFLLGNBQWM7VUFDakIsT0FBTztZQUFFcEUsTUFBTSxFQUFFdkIsWUFBWSxDQUFDLENBQUM7WUFBRTJGLE1BQU0sRUFBRTtVQUFLLENBQUM7UUFDakQsS0FBSyxTQUFTO1VBQ1osT0FBTztZQUFFcEUsTUFBTSxFQUFFa0UsQ0FBQyxDQUFDRyxFQUFFO1lBQUVELE1BQU0sRUFBRTtVQUFNLENBQUM7TUFDMUM7SUFDRixDQUFDO0lBRUQ7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0FFLGFBQWEsRUFBRSxNQUFBQSxDQUFBLEtBQVk7TUFDekIsTUFBTUMsQ0FBQyxHQUFHLE1BQU14Rix5QkFBeUIsQ0FBQyxDQUFDO01BQzNDLElBQUl3RixDQUFDLENBQUNKLElBQUksS0FBSyxTQUFTLEVBQUU7UUFDeEIsTUFBTSxJQUFJSyxLQUFLLENBQUN6RSxjQUFjLENBQUN3RSxDQUFDLENBQUNGLEVBQUUsQ0FBQyxDQUFDO01BQ3ZDO01BQ0EsSUFBSUUsQ0FBQyxDQUFDRSxLQUFLLEVBQUU7UUFDWDtRQUNBO1FBQ0E7UUFDQTtRQUNBLE1BQU1DLGFBQWEsR0FBRzFGLGlCQUFpQixDQUFDLE1BQU07VUFDNUNILGVBQWUsQ0FBQyxxQ0FBcUMsQ0FBQztVQUN0RGlCLEdBQUcsQ0FBQyxDQUFDLENBQUM2RSxlQUFlLENBQUNDLEtBQUssQ0FBQyxDQUFDO1FBQy9CLENBQUMsQ0FBQztRQUNGOUUsR0FBRyxDQUFDLENBQUMsQ0FBQytFLGtCQUFrQixHQUFHO1VBQ3pCQyxPQUFPLEVBQUVKLGFBQWEsR0FDbEIsbURBQW1ELEdBQ25ELHNEQUFzRDtVQUMxREssZ0JBQWdCLEVBQUU7UUFDcEIsQ0FBQyxDQUFDO01BQ0o7SUFDRixDQUFDO0lBRURDLHFCQUFxQixFQUFFakY7RUFDekIsQ0FBQztBQUNIO0FBRUEsU0FBU2tGLFNBQVNBLENBQUEsQ0FBRSxFQUFFM0YsT0FBTyxDQUFDO0VBQzVCLElBQUlNLE9BQU8sRUFBRSxPQUFPQSxPQUFPO0VBQzNCLE1BQU1MLEdBQUcsR0FBR1csbUJBQW1CLENBQUMsQ0FBQztFQUNqQ04sT0FBTyxHQUFHO0lBQ1JMLEdBQUc7SUFDSEMsUUFBUSxFQUFFdkIsa0JBQWtCLENBQzFCaUIseUJBQXlCLENBQUMsQ0FBQyxFQUMzQkQsd0JBQXdCLENBQUMsQ0FBQyxFQUMxQk0sR0FDRjtFQUNGLENBQUM7RUFDRCxPQUFPSyxPQUFPO0FBQ2hCOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLc0YsMkJBQTJCLEdBQUdDLFVBQVUsQ0FDM0MsT0FBT2hHLG1DQUFtQyxDQUMzQyxHQUFHO0VBQ0ZpRyxJQUFJLEVBQUVoRyxZQUFZO0FBQ3BCLENBQUM7QUFFRCxPQUFPLFNBQVNpRyw4QkFBOEJBLENBQzVDQyxRQUFRLEVBQUUsTUFBTSxDQUNqQixFQUFFSiwyQkFBMkIsQ0FBQztFQUM3QixNQUFNRSxJQUFJLEVBQUVoRyxZQUFZLEdBQUcsTUFBQWdHLENBQU8xRixJQUFJLEVBQUU2RixPQUFPLEVBQUUzRyxjQUFjLEtBQUs7SUFDbEVpQixxQkFBcUIsR0FBRzBGLE9BQU87SUFDL0IsTUFBTTtNQUFFL0Y7SUFBUyxDQUFDLEdBQUd5RixTQUFTLENBQUMsQ0FBQztJQUVoQyxNQUFNO01BQUVPLFNBQVM7TUFBRSxHQUFHQztJQUFPLENBQUMsR0FBRyxNQUFNakcsUUFBUSxDQUFDOEYsUUFBUSxFQUFFNUYsSUFBSSxDQUFDO0lBRS9ELElBQUk4RixTQUFTLEVBQUVFLFVBQVUsRUFBRTtNQUN6QjdHLGVBQWUsQ0FDYixzQkFBc0J5RyxRQUFRLGVBQWVFLFNBQVMsQ0FBQ0UsVUFBVSxFQUNuRSxDQUFDO0lBQ0g7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsTUFBTUMsSUFBSSxHQUFHQyxLQUFLLENBQUNDLE9BQU8sQ0FBQ0osTUFBTSxDQUFDSyxPQUFPLENBQUMsR0FDdENMLE1BQU0sQ0FBQ0ssT0FBTyxDQUFDQyxHQUFHLENBQUNDLElBQUksSUFDckJBLElBQUksQ0FBQ0MsSUFBSSxLQUFLLE9BQU8sR0FDakI7TUFDRUEsSUFBSSxFQUFFLE9BQU8sSUFBSUMsS0FBSztNQUN0QkMsTUFBTSxFQUFFO1FBQ05GLElBQUksRUFBRSxRQUFRLElBQUlDLEtBQUs7UUFDdkJFLFVBQVUsRUFBRUosSUFBSSxDQUFDSyxRQUFRLElBQUksWUFBWTtRQUN6Q1YsSUFBSSxFQUFFSyxJQUFJLENBQUNMO01BQ2I7SUFDRixDQUFDLEdBQ0Q7TUFDRU0sSUFBSSxFQUFFLE1BQU0sSUFBSUMsS0FBSztNQUNyQkksSUFBSSxFQUFFTixJQUFJLENBQUNDLElBQUksS0FBSyxNQUFNLEdBQUdELElBQUksQ0FBQ00sSUFBSSxHQUFHO0lBQzNDLENBQ04sQ0FBQyxHQUNEYixNQUFNLENBQUNLLE9BQU87SUFDbEIsT0FBTztNQUFFSDtJQUFLLENBQUM7RUFDakIsQ0FBQztFQUVELE9BQU87SUFDTCxHQUFHeEcsbUNBQW1DLENBQUNtRyxRQUFRLENBQUM7SUFDaERGO0VBQ0YsQ0FBQztBQUNIOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZUFBZTFELG1CQUFtQkEsQ0FDaENGLEdBQUcsRUFBRXBELG1CQUFtQixDQUN6QixFQUFFdUIsT0FBTyxDQUFDdEIsb0JBQW9CLENBQUMsQ0FBQztFQUMvQixNQUFNa0gsT0FBTyxHQUFHekYsR0FBRyxDQUFDLENBQUM7RUFDckIsTUFBTXlHLFVBQVUsR0FBR2hCLE9BQU8sQ0FBQ2dCLFVBQVU7RUFDckMsSUFBSSxDQUFDQSxVQUFVLEVBQUU7SUFDZjtJQUNBLE9BQU87TUFBRUMsT0FBTyxFQUFFLEVBQUU7TUFBRUMsTUFBTSxFQUFFLEVBQUU7TUFBRTVFLEtBQUssRUFBRXZEO0lBQW9CLENBQUM7RUFDaEU7RUFFQSxJQUFJO0lBQ0YsT0FBTyxNQUFNLElBQUlxQixPQUFPLENBQUN0QixvQkFBb0IsQ0FBQyxDQUFDLENBQUNxSSxPQUFPLEVBQUVDLE1BQU0sS0FBSztNQUNsRSxNQUFNQyxNQUFNLEdBQUdyQixPQUFPLENBQUNaLGVBQWUsQ0FBQ2lDLE1BQU07TUFDN0M7TUFDQTtNQUNBLElBQUlBLE1BQU0sQ0FBQ0MsT0FBTyxFQUFFO1FBQ2xCRixNQUFNLENBQUMsSUFBSW5DLEtBQUssQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFDO1FBQzNEO01BQ0Y7TUFDQSxNQUFNc0MsT0FBTyxHQUFHQSxDQUFBLENBQUUsRUFBRSxJQUFJLElBQUk7UUFDMUJGLE1BQU0sQ0FBQ0csbUJBQW1CLENBQUMsT0FBTyxFQUFFRCxPQUFPLENBQUM7UUFDNUNILE1BQU0sQ0FBQyxJQUFJbkMsS0FBSyxDQUFDLHdDQUF3QyxDQUFDLENBQUM7TUFDN0QsQ0FBQztNQUNEb0MsTUFBTSxDQUFDSSxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUVGLE9BQU8sQ0FBQztNQUV6Q1AsVUFBVSxDQUFDO1FBQ1RVLEdBQUcsRUFBRXpJLEtBQUssQ0FBQzBJLGFBQWEsQ0FBQ3hJLG1CQUFtQixFQUFFO1VBQzVDeUksT0FBTyxFQUFFM0YsR0FBRztVQUNaNEYsTUFBTSxFQUFFQSxDQUFDQyxJQUFJLEVBQUVoSixvQkFBb0IsS0FBSztZQUN0Q3VJLE1BQU0sQ0FBQ0csbUJBQW1CLENBQUMsT0FBTyxFQUFFRCxPQUFPLENBQUM7WUFDNUNKLE9BQU8sQ0FBQ1csSUFBSSxDQUFDO1VBQ2Y7UUFDRixDQUFDLENBQUM7UUFDRkMscUJBQXFCLEVBQUU7TUFDekIsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDO0VBQ0osQ0FBQyxTQUFTO0lBQ1JmLFVBQVUsQ0FBQyxJQUFJLENBQUM7RUFDbEI7QUFDRiIsImlnbm9yZUxpc3QiOltdfQ==