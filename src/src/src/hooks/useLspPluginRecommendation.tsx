import { c as _c } from "react/compiler-runtime";
/**
 * Hook for LSP plugin recommendations
 *
 * Detects file edits and recommends LSP plugins when:
 * - File extension matches an LSP plugin
 * - LSP binary is already installed on the system
 * - Plugin is not already installed
 * - User hasn't disabled recommendations
 *
 * Only shows one recommendation per session.
 */

import { extname, join } from 'path';
import * as React from 'react';
import { hasShownLspRecommendationThisSession, setLspRecommendationShownThisSession } from '../bootstrap/state.js';
import { useNotifications } from '../context/notifications.js';
import { useAppState } from '../state/AppState.js';
import { saveGlobalConfig } from '../utils/config.js';
import { logForDebugging } from '../utils/debug.js';
import { logError } from '../utils/log.js';
import { addToNeverSuggest, getMatchingLspPlugins, incrementIgnoredCount } from '../utils/plugins/lspRecommendation.js';
import { cacheAndRegisterPlugin } from '../utils/plugins/pluginInstallationHelpers.js';
import { getSettingsForSource, updateSettingsForSource } from '../utils/settings/settings.js';
import { installPluginAndNotify, usePluginRecommendationBase } from './usePluginRecommendationBase.js';

// Threshold for detecting timeout vs explicit dismiss (ms)
// Menu auto-dismisses at 30s, so anything over 28s is likely timeout
const TIMEOUT_THRESHOLD_MS = 28_000;
export type LspRecommendationState = {
  pluginId: string;
  pluginName: string;
  pluginDescription?: string;
  fileExtension: string;
  shownAt: number; // Timestamp for timeout detection
} | null;
type UseLspPluginRecommendationResult = {
  recommendation: LspRecommendationState;
  handleResponse: (response: 'yes' | 'no' | 'never' | 'disable') => void;
};
export function useLspPluginRecommendation() {
  const $ = _c(12);
  const trackedFiles = useAppState(_temp);
  const {
    addNotification
  } = useNotifications();
  let t0;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t0 = new Set();
    $[0] = t0;
  } else {
    t0 = $[0];
  }
  const checkedFilesRef = React.useRef(t0);
  const {
    recommendation,
    clearRecommendation,
    tryResolve
  } = usePluginRecommendationBase();
  let t1;
  let t2;
  if ($[1] !== trackedFiles || $[2] !== tryResolve) {
    t1 = () => {
      tryResolve(async () => {
        if (hasShownLspRecommendationThisSession()) {
          return null;
        }
        const newFiles = [];
        for (const file of trackedFiles) {
          if (!checkedFilesRef.current.has(file)) {
            checkedFilesRef.current.add(file);
            newFiles.push(file);
          }
        }
        for (const filePath of newFiles) {
          ;
          try {
            const matches = await getMatchingLspPlugins(filePath);
            const match = matches[0];
            if (match) {
              logForDebugging(`[useLspPluginRecommendation] Found match: ${match.pluginName} for ${filePath}`);
              setLspRecommendationShownThisSession(true);
              return {
                pluginId: match.pluginId,
                pluginName: match.pluginName,
                pluginDescription: match.description,
                fileExtension: extname(filePath),
                shownAt: Date.now()
              };
            }
          } catch (t3) {
            const error = t3;
            logError(error);
          }
        }
        return null;
      });
    };
    t2 = [trackedFiles, tryResolve];
    $[1] = trackedFiles;
    $[2] = tryResolve;
    $[3] = t1;
    $[4] = t2;
  } else {
    t1 = $[3];
    t2 = $[4];
  }
  React.useEffect(t1, t2);
  let t3;
  if ($[5] !== addNotification || $[6] !== clearRecommendation || $[7] !== recommendation) {
    t3 = response => {
      if (!recommendation) {
        return;
      }
      const {
        pluginId,
        pluginName,
        shownAt
      } = recommendation;
      logForDebugging(`[useLspPluginRecommendation] User response: ${response} for ${pluginName}`);
      bb60: switch (response) {
        case "yes":
          {
            installPluginAndNotify(pluginId, pluginName, "lsp-plugin", addNotification, async pluginData => {
              logForDebugging(`[useLspPluginRecommendation] Installing plugin: ${pluginId}`);
              const localSourcePath = typeof pluginData.entry.source === "string" ? join(pluginData.marketplaceInstallLocation, pluginData.entry.source) : undefined;
              await cacheAndRegisterPlugin(pluginId, pluginData.entry, "user", undefined, localSourcePath);
              const settings = getSettingsForSource("userSettings");
              updateSettingsForSource("userSettings", {
                enabledPlugins: {
                  ...settings?.enabledPlugins,
                  [pluginId]: true
                }
              });
              logForDebugging(`[useLspPluginRecommendation] Plugin installed: ${pluginId}`);
            });
            break bb60;
          }
        case "no":
          {
            const elapsed = Date.now() - shownAt;
            if (elapsed >= TIMEOUT_THRESHOLD_MS) {
              logForDebugging(`[useLspPluginRecommendation] Timeout detected (${elapsed}ms), incrementing ignored count`);
              incrementIgnoredCount();
            }
            break bb60;
          }
        case "never":
          {
            addToNeverSuggest(pluginId);
            break bb60;
          }
        case "disable":
          {
            saveGlobalConfig(_temp2);
          }
      }
      clearRecommendation();
    };
    $[5] = addNotification;
    $[6] = clearRecommendation;
    $[7] = recommendation;
    $[8] = t3;
  } else {
    t3 = $[8];
  }
  const handleResponse = t3;
  let t4;
  if ($[9] !== handleResponse || $[10] !== recommendation) {
    t4 = {
      recommendation,
      handleResponse
    };
    $[9] = handleResponse;
    $[10] = recommendation;
    $[11] = t4;
  } else {
    t4 = $[11];
  }
  return t4;
}
function _temp2(current) {
  if (current.lspRecommendationDisabled) {
    return current;
  }
  return {
    ...current,
    lspRecommendationDisabled: true
  };
}
function _temp(s) {
  return s.fileHistory.trackedFiles;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJleHRuYW1lIiwiam9pbiIsIlJlYWN0IiwiaGFzU2hvd25Mc3BSZWNvbW1lbmRhdGlvblRoaXNTZXNzaW9uIiwic2V0THNwUmVjb21tZW5kYXRpb25TaG93blRoaXNTZXNzaW9uIiwidXNlTm90aWZpY2F0aW9ucyIsInVzZUFwcFN0YXRlIiwic2F2ZUdsb2JhbENvbmZpZyIsImxvZ0ZvckRlYnVnZ2luZyIsImxvZ0Vycm9yIiwiYWRkVG9OZXZlclN1Z2dlc3QiLCJnZXRNYXRjaGluZ0xzcFBsdWdpbnMiLCJpbmNyZW1lbnRJZ25vcmVkQ291bnQiLCJjYWNoZUFuZFJlZ2lzdGVyUGx1Z2luIiwiZ2V0U2V0dGluZ3NGb3JTb3VyY2UiLCJ1cGRhdGVTZXR0aW5nc0ZvclNvdXJjZSIsImluc3RhbGxQbHVnaW5BbmROb3RpZnkiLCJ1c2VQbHVnaW5SZWNvbW1lbmRhdGlvbkJhc2UiLCJUSU1FT1VUX1RIUkVTSE9MRF9NUyIsIkxzcFJlY29tbWVuZGF0aW9uU3RhdGUiLCJwbHVnaW5JZCIsInBsdWdpbk5hbWUiLCJwbHVnaW5EZXNjcmlwdGlvbiIsImZpbGVFeHRlbnNpb24iLCJzaG93bkF0IiwiVXNlTHNwUGx1Z2luUmVjb21tZW5kYXRpb25SZXN1bHQiLCJyZWNvbW1lbmRhdGlvbiIsImhhbmRsZVJlc3BvbnNlIiwicmVzcG9uc2UiLCJ1c2VMc3BQbHVnaW5SZWNvbW1lbmRhdGlvbiIsIiQiLCJfYyIsInRyYWNrZWRGaWxlcyIsIl90ZW1wIiwiYWRkTm90aWZpY2F0aW9uIiwidDAiLCJTeW1ib2wiLCJmb3IiLCJTZXQiLCJjaGVja2VkRmlsZXNSZWYiLCJ1c2VSZWYiLCJjbGVhclJlY29tbWVuZGF0aW9uIiwidHJ5UmVzb2x2ZSIsInQxIiwidDIiLCJuZXdGaWxlcyIsImZpbGUiLCJjdXJyZW50IiwiaGFzIiwiYWRkIiwicHVzaCIsImZpbGVQYXRoIiwibWF0Y2hlcyIsIm1hdGNoIiwiZGVzY3JpcHRpb24iLCJEYXRlIiwibm93IiwidDMiLCJlcnJvciIsInVzZUVmZmVjdCIsImJiNjAiLCJwbHVnaW5EYXRhIiwibG9jYWxTb3VyY2VQYXRoIiwiZW50cnkiLCJzb3VyY2UiLCJtYXJrZXRwbGFjZUluc3RhbGxMb2NhdGlvbiIsInVuZGVmaW5lZCIsInNldHRpbmdzIiwiZW5hYmxlZFBsdWdpbnMiLCJlbGFwc2VkIiwiX3RlbXAyIiwidDQiLCJsc3BSZWNvbW1lbmRhdGlvbkRpc2FibGVkIiwicyIsImZpbGVIaXN0b3J5Il0sInNvdXJjZXMiOlsidXNlTHNwUGx1Z2luUmVjb21tZW5kYXRpb24udHN4Il0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogSG9vayBmb3IgTFNQIHBsdWdpbiByZWNvbW1lbmRhdGlvbnNcbiAqXG4gKiBEZXRlY3RzIGZpbGUgZWRpdHMgYW5kIHJlY29tbWVuZHMgTFNQIHBsdWdpbnMgd2hlbjpcbiAqIC0gRmlsZSBleHRlbnNpb24gbWF0Y2hlcyBhbiBMU1AgcGx1Z2luXG4gKiAtIExTUCBiaW5hcnkgaXMgYWxyZWFkeSBpbnN0YWxsZWQgb24gdGhlIHN5c3RlbVxuICogLSBQbHVnaW4gaXMgbm90IGFscmVhZHkgaW5zdGFsbGVkXG4gKiAtIFVzZXIgaGFzbid0IGRpc2FibGVkIHJlY29tbWVuZGF0aW9uc1xuICpcbiAqIE9ubHkgc2hvd3Mgb25lIHJlY29tbWVuZGF0aW9uIHBlciBzZXNzaW9uLlxuICovXG5cbmltcG9ydCB7IGV4dG5hbWUsIGpvaW4gfSBmcm9tICdwYXRoJ1xuaW1wb3J0ICogYXMgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQge1xuICBoYXNTaG93bkxzcFJlY29tbWVuZGF0aW9uVGhpc1Nlc3Npb24sXG4gIHNldExzcFJlY29tbWVuZGF0aW9uU2hvd25UaGlzU2Vzc2lvbixcbn0gZnJvbSAnLi4vYm9vdHN0cmFwL3N0YXRlLmpzJ1xuaW1wb3J0IHsgdXNlTm90aWZpY2F0aW9ucyB9IGZyb20gJy4uL2NvbnRleHQvbm90aWZpY2F0aW9ucy5qcydcbmltcG9ydCB7IHVzZUFwcFN0YXRlIH0gZnJvbSAnLi4vc3RhdGUvQXBwU3RhdGUuanMnXG5pbXBvcnQgeyBzYXZlR2xvYmFsQ29uZmlnIH0gZnJvbSAnLi4vdXRpbHMvY29uZmlnLmpzJ1xuaW1wb3J0IHsgbG9nRm9yRGVidWdnaW5nIH0gZnJvbSAnLi4vdXRpbHMvZGVidWcuanMnXG5pbXBvcnQgeyBsb2dFcnJvciB9IGZyb20gJy4uL3V0aWxzL2xvZy5qcydcbmltcG9ydCB7XG4gIGFkZFRvTmV2ZXJTdWdnZXN0LFxuICBnZXRNYXRjaGluZ0xzcFBsdWdpbnMsXG4gIGluY3JlbWVudElnbm9yZWRDb3VudCxcbn0gZnJvbSAnLi4vdXRpbHMvcGx1Z2lucy9sc3BSZWNvbW1lbmRhdGlvbi5qcydcbmltcG9ydCB7IGNhY2hlQW5kUmVnaXN0ZXJQbHVnaW4gfSBmcm9tICcuLi91dGlscy9wbHVnaW5zL3BsdWdpbkluc3RhbGxhdGlvbkhlbHBlcnMuanMnXG5pbXBvcnQge1xuICBnZXRTZXR0aW5nc0ZvclNvdXJjZSxcbiAgdXBkYXRlU2V0dGluZ3NGb3JTb3VyY2UsXG59IGZyb20gJy4uL3V0aWxzL3NldHRpbmdzL3NldHRpbmdzLmpzJ1xuaW1wb3J0IHtcbiAgaW5zdGFsbFBsdWdpbkFuZE5vdGlmeSxcbiAgdXNlUGx1Z2luUmVjb21tZW5kYXRpb25CYXNlLFxufSBmcm9tICcuL3VzZVBsdWdpblJlY29tbWVuZGF0aW9uQmFzZS5qcydcblxuLy8gVGhyZXNob2xkIGZvciBkZXRlY3RpbmcgdGltZW91dCB2cyBleHBsaWNpdCBkaXNtaXNzIChtcylcbi8vIE1lbnUgYXV0by1kaXNtaXNzZXMgYXQgMzBzLCBzbyBhbnl0aGluZyBvdmVyIDI4cyBpcyBsaWtlbHkgdGltZW91dFxuY29uc3QgVElNRU9VVF9USFJFU0hPTERfTVMgPSAyOF8wMDBcblxuZXhwb3J0IHR5cGUgTHNwUmVjb21tZW5kYXRpb25TdGF0ZSA9IHtcbiAgcGx1Z2luSWQ6IHN0cmluZ1xuICBwbHVnaW5OYW1lOiBzdHJpbmdcbiAgcGx1Z2luRGVzY3JpcHRpb24/OiBzdHJpbmdcbiAgZmlsZUV4dGVuc2lvbjogc3RyaW5nXG4gIHNob3duQXQ6IG51bWJlciAvLyBUaW1lc3RhbXAgZm9yIHRpbWVvdXQgZGV0ZWN0aW9uXG59IHwgbnVsbFxuXG50eXBlIFVzZUxzcFBsdWdpblJlY29tbWVuZGF0aW9uUmVzdWx0ID0ge1xuICByZWNvbW1lbmRhdGlvbjogTHNwUmVjb21tZW5kYXRpb25TdGF0ZVxuICBoYW5kbGVSZXNwb25zZTogKHJlc3BvbnNlOiAneWVzJyB8ICdubycgfCAnbmV2ZXInIHwgJ2Rpc2FibGUnKSA9PiB2b2lkXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1c2VMc3BQbHVnaW5SZWNvbW1lbmRhdGlvbigpOiBVc2VMc3BQbHVnaW5SZWNvbW1lbmRhdGlvblJlc3VsdCB7XG4gIGNvbnN0IHRyYWNrZWRGaWxlcyA9IHVzZUFwcFN0YXRlKHMgPT4gcy5maWxlSGlzdG9yeS50cmFja2VkRmlsZXMpXG4gIGNvbnN0IHsgYWRkTm90aWZpY2F0aW9uIH0gPSB1c2VOb3RpZmljYXRpb25zKClcbiAgY29uc3QgY2hlY2tlZEZpbGVzUmVmID0gUmVhY3QudXNlUmVmPFNldDxzdHJpbmc+PihuZXcgU2V0KCkpXG4gIGNvbnN0IHsgcmVjb21tZW5kYXRpb24sIGNsZWFyUmVjb21tZW5kYXRpb24sIHRyeVJlc29sdmUgfSA9XG4gICAgdXNlUGx1Z2luUmVjb21tZW5kYXRpb25CYXNlPE5vbk51bGxhYmxlPExzcFJlY29tbWVuZGF0aW9uU3RhdGU+PigpXG5cbiAgUmVhY3QudXNlRWZmZWN0KCgpID0+IHtcbiAgICB0cnlSZXNvbHZlKGFzeW5jICgpID0+IHtcbiAgICAgIGlmIChoYXNTaG93bkxzcFJlY29tbWVuZGF0aW9uVGhpc1Nlc3Npb24oKSkgcmV0dXJuIG51bGxcblxuICAgICAgY29uc3QgbmV3RmlsZXM6IHN0cmluZ1tdID0gW11cbiAgICAgIGZvciAoY29uc3QgZmlsZSBvZiB0cmFja2VkRmlsZXMpIHtcbiAgICAgICAgaWYgKCFjaGVja2VkRmlsZXNSZWYuY3VycmVudC5oYXMoZmlsZSkpIHtcbiAgICAgICAgICBjaGVja2VkRmlsZXNSZWYuY3VycmVudC5hZGQoZmlsZSlcbiAgICAgICAgICBuZXdGaWxlcy5wdXNoKGZpbGUpXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZm9yIChjb25zdCBmaWxlUGF0aCBvZiBuZXdGaWxlcykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSBhd2FpdCBnZXRNYXRjaGluZ0xzcFBsdWdpbnMoZmlsZVBhdGgpXG4gICAgICAgICAgY29uc3QgbWF0Y2ggPSBtYXRjaGVzWzBdIC8vIG9mZmljaWFsIHBsdWdpbnMgcHJpb3JpdGl6ZWRcbiAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgICAgICAgYFt1c2VMc3BQbHVnaW5SZWNvbW1lbmRhdGlvbl0gRm91bmQgbWF0Y2g6ICR7bWF0Y2gucGx1Z2luTmFtZX0gZm9yICR7ZmlsZVBhdGh9YCxcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIHNldExzcFJlY29tbWVuZGF0aW9uU2hvd25UaGlzU2Vzc2lvbih0cnVlKVxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgcGx1Z2luSWQ6IG1hdGNoLnBsdWdpbklkLFxuICAgICAgICAgICAgICBwbHVnaW5OYW1lOiBtYXRjaC5wbHVnaW5OYW1lLFxuICAgICAgICAgICAgICBwbHVnaW5EZXNjcmlwdGlvbjogbWF0Y2guZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgIGZpbGVFeHRlbnNpb246IGV4dG5hbWUoZmlsZVBhdGgpLFxuICAgICAgICAgICAgICBzaG93bkF0OiBEYXRlLm5vdygpLFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBsb2dFcnJvcihlcnJvcilcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGxcbiAgICB9KVxuICB9LCBbdHJhY2tlZEZpbGVzLCB0cnlSZXNvbHZlXSlcblxuICBjb25zdCBoYW5kbGVSZXNwb25zZSA9IFJlYWN0LnVzZUNhbGxiYWNrKFxuICAgIChyZXNwb25zZTogJ3llcycgfCAnbm8nIHwgJ25ldmVyJyB8ICdkaXNhYmxlJykgPT4ge1xuICAgICAgaWYgKCFyZWNvbW1lbmRhdGlvbikgcmV0dXJuXG5cbiAgICAgIGNvbnN0IHsgcGx1Z2luSWQsIHBsdWdpbk5hbWUsIHNob3duQXQgfSA9IHJlY29tbWVuZGF0aW9uXG5cbiAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgYFt1c2VMc3BQbHVnaW5SZWNvbW1lbmRhdGlvbl0gVXNlciByZXNwb25zZTogJHtyZXNwb25zZX0gZm9yICR7cGx1Z2luTmFtZX1gLFxuICAgICAgKVxuXG4gICAgICBzd2l0Y2ggKHJlc3BvbnNlKSB7XG4gICAgICAgIGNhc2UgJ3llcyc6XG4gICAgICAgICAgdm9pZCBpbnN0YWxsUGx1Z2luQW5kTm90aWZ5KFxuICAgICAgICAgICAgcGx1Z2luSWQsXG4gICAgICAgICAgICBwbHVnaW5OYW1lLFxuICAgICAgICAgICAgJ2xzcC1wbHVnaW4nLFxuICAgICAgICAgICAgYWRkTm90aWZpY2F0aW9uLFxuICAgICAgICAgICAgYXN5bmMgcGx1Z2luRGF0YSA9PiB7XG4gICAgICAgICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgICAgICAgICBgW3VzZUxzcFBsdWdpblJlY29tbWVuZGF0aW9uXSBJbnN0YWxsaW5nIHBsdWdpbjogJHtwbHVnaW5JZH1gLFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgIGNvbnN0IGxvY2FsU291cmNlUGF0aCA9XG4gICAgICAgICAgICAgICAgdHlwZW9mIHBsdWdpbkRhdGEuZW50cnkuc291cmNlID09PSAnc3RyaW5nJ1xuICAgICAgICAgICAgICAgICAgPyBqb2luKFxuICAgICAgICAgICAgICAgICAgICAgIHBsdWdpbkRhdGEubWFya2V0cGxhY2VJbnN0YWxsTG9jYXRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgcGx1Z2luRGF0YS5lbnRyeS5zb3VyY2UsXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkXG4gICAgICAgICAgICAgIGF3YWl0IGNhY2hlQW5kUmVnaXN0ZXJQbHVnaW4oXG4gICAgICAgICAgICAgICAgcGx1Z2luSWQsXG4gICAgICAgICAgICAgICAgcGx1Z2luRGF0YS5lbnRyeSxcbiAgICAgICAgICAgICAgICAndXNlcicsXG4gICAgICAgICAgICAgICAgdW5kZWZpbmVkLCAvLyBwcm9qZWN0UGF0aCAtIG5vdCBuZWVkZWQgZm9yIHVzZXIgc2NvcGVcbiAgICAgICAgICAgICAgICBsb2NhbFNvdXJjZVBhdGgsXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgLy8gRW5hYmxlIGluIHVzZXIgc2V0dGluZ3Mgc28gaXQgbG9hZHMgb24gcmVzdGFydFxuICAgICAgICAgICAgICBjb25zdCBzZXR0aW5ncyA9IGdldFNldHRpbmdzRm9yU291cmNlKCd1c2VyU2V0dGluZ3MnKVxuICAgICAgICAgICAgICB1cGRhdGVTZXR0aW5nc0ZvclNvdXJjZSgndXNlclNldHRpbmdzJywge1xuICAgICAgICAgICAgICAgIGVuYWJsZWRQbHVnaW5zOiB7XG4gICAgICAgICAgICAgICAgICAuLi5zZXR0aW5ncz8uZW5hYmxlZFBsdWdpbnMsXG4gICAgICAgICAgICAgICAgICBbcGx1Z2luSWRdOiB0cnVlLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgICAgICAgICBgW3VzZUxzcFBsdWdpblJlY29tbWVuZGF0aW9uXSBQbHVnaW4gaW5zdGFsbGVkOiAke3BsdWdpbklkfWAsXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgKVxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgY2FzZSAnbm8nOiB7XG4gICAgICAgICAgY29uc3QgZWxhcHNlZCA9IERhdGUubm93KCkgLSBzaG93bkF0XG4gICAgICAgICAgaWYgKGVsYXBzZWQgPj0gVElNRU9VVF9USFJFU0hPTERfTVMpIHtcbiAgICAgICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgICAgICAgYFt1c2VMc3BQbHVnaW5SZWNvbW1lbmRhdGlvbl0gVGltZW91dCBkZXRlY3RlZCAoJHtlbGFwc2VkfW1zKSwgaW5jcmVtZW50aW5nIGlnbm9yZWQgY291bnRgLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgaW5jcmVtZW50SWdub3JlZENvdW50KClcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuXG4gICAgICAgIGNhc2UgJ25ldmVyJzpcbiAgICAgICAgICBhZGRUb05ldmVyU3VnZ2VzdChwbHVnaW5JZClcbiAgICAgICAgICBicmVha1xuXG4gICAgICAgIGNhc2UgJ2Rpc2FibGUnOlxuICAgICAgICAgIHNhdmVHbG9iYWxDb25maWcoY3VycmVudCA9PiB7XG4gICAgICAgICAgICBpZiAoY3VycmVudC5sc3BSZWNvbW1lbmRhdGlvbkRpc2FibGVkKSByZXR1cm4gY3VycmVudFxuICAgICAgICAgICAgcmV0dXJuIHsgLi4uY3VycmVudCwgbHNwUmVjb21tZW5kYXRpb25EaXNhYmxlZDogdHJ1ZSB9XG4gICAgICAgICAgfSlcbiAgICAgICAgICBicmVha1xuICAgICAgfVxuXG4gICAgICBjbGVhclJlY29tbWVuZGF0aW9uKClcbiAgICB9LFxuICAgIFtyZWNvbW1lbmRhdGlvbiwgYWRkTm90aWZpY2F0aW9uLCBjbGVhclJlY29tbWVuZGF0aW9uXSxcbiAgKVxuXG4gIHJldHVybiB7IHJlY29tbWVuZGF0aW9uLCBoYW5kbGVSZXNwb25zZSB9XG59XG4iXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLFNBQVNBLE9BQU8sRUFBRUMsSUFBSSxRQUFR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