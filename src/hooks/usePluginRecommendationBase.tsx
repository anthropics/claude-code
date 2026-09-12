import { c as _c } from "react/compiler-runtime";
/**
 * Shared state machine + install helper for plugin-recommendation hooks
 * (LSP, claude-code-hint). Centralizes the gate chain, async-guard,
 * and success/failure notification JSX so new sources stay small.
 */

import figures from 'figures';
import * as React from 'react';
import { getIsRemoteMode } from '../bootstrap/state.js';
import type { useNotifications } from '../context/notifications.js';
import { Text } from '../ink.js';
import { logError } from '../utils/log.js';
import { getPluginById } from '../utils/plugins/marketplaceManager.js';
type AddNotification = ReturnType<typeof useNotifications>['addNotification'];
type PluginData = NonNullable<Awaited<ReturnType<typeof getPluginById>>>;

/**
 * Call tryResolve inside a useEffect; it applies standard gates (remote
 * mode, already-showing, in-flight) then runs resolve(). Non-null return
 * becomes the recommendation. Include tryResolve in effect deps — its
 * identity tracks recommendation, so clearing re-triggers resolution.
 */
export function usePluginRecommendationBase() {
  const $ = _c(6);
  const [recommendation, setRecommendation] = React.useState(null);
  const isCheckingRef = React.useRef(false);
  let t0;
  if ($[0] !== recommendation) {
    t0 = resolve => {
      if (getIsRemoteMode()) {
        return;
      }
      if (recommendation) {
        return;
      }
      if (isCheckingRef.current) {
        return;
      }
      isCheckingRef.current = true;
      resolve().then(rec => {
        if (rec) {
          setRecommendation(rec);
        }
      }).catch(logError).finally(() => {
        isCheckingRef.current = false;
      });
    };
    $[0] = recommendation;
    $[1] = t0;
  } else {
    t0 = $[1];
  }
  const tryResolve = t0;
  let t1;
  if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
    t1 = () => setRecommendation(null);
    $[2] = t1;
  } else {
    t1 = $[2];
  }
  const clearRecommendation = t1;
  let t2;
  if ($[3] !== recommendation || $[4] !== tryResolve) {
    t2 = {
      recommendation,
      clearRecommendation,
      tryResolve
    };
    $[3] = recommendation;
    $[4] = tryResolve;
    $[5] = t2;
  } else {
    t2 = $[5];
  }
  return t2;
}

/** Look up plugin, run install(), emit standard success/failure notification. */
export async function installPluginAndNotify(pluginId: string, pluginName: string, keyPrefix: string, addNotification: AddNotification, install: (pluginData: PluginData) => Promise<void>): Promise<void> {
  try {
    const pluginData = await getPluginById(pluginId);
    if (!pluginData) {
      throw new Error(`Plugin ${pluginId} not found in marketplace`);
    }
    await install(pluginData);
    addNotification({
      key: `${keyPrefix}-installed`,
      jsx: <Text color="success">
          {figures.tick} {pluginName} installed · restart to apply
        </Text>,
      priority: 'immediate',
      timeoutMs: 5000
    });
  } catch (error) {
    logError(error);
    addNotification({
      key: `${keyPrefix}-install-failed`,
      jsx: <Text color="error">Failed to install {pluginName}</Text>,
      priority: 'immediate',
      timeoutMs: 5000
    });
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmaWd1cmVzIiwiUmVhY3QiLCJnZXRJc1JlbW90ZU1vZGUiLCJ1c2VOb3RpZmljYXRpb25zIiwiVGV4dCIsImxvZ0Vycm9yIiwiZ2V0UGx1Z2luQnlJZCIsIkFkZE5vdGlmaWNhdGlvbiIsIlJldHVyblR5cGUiLCJQbHVnaW5EYXRhIiwiTm9uTnVsbGFibGUiLCJBd2FpdGVkIiwidXNlUGx1Z2luUmVjb21tZW5kYXRpb25CYXNlIiwiJCIsIl9jIiwicmVjb21tZW5kYXRpb24iLCJzZXRSZWNvbW1lbmRhdGlvbiIsInVzZVN0YXRlIiwiaXNDaGVja2luZ1JlZiIsInVzZVJlZiIsInQwIiwicmVzb2x2ZSIsImN1cnJlbnQiLCJ0aGVuIiwicmVjIiwiY2F0Y2giLCJmaW5hbGx5IiwidHJ5UmVzb2x2ZSIsInQxIiwiU3ltYm9sIiwiZm9yIiwiY2xlYXJSZWNvbW1lbmRhdGlvbiIsInQyIiwiaW5zdGFsbFBsdWdpbkFuZE5vdGlmeSIsInBsdWdpbklkIiwicGx1Z2luTmFtZSIsImtleVByZWZpeCIsImFkZE5vdGlmaWNhdGlvbiIsImluc3RhbGwiLCJwbHVnaW5EYXRhIiwiUHJvbWlzZSIsIkVycm9yIiwia2V5IiwianN4IiwidGljayIsInByaW9yaXR5IiwidGltZW91dE1zIiwiZXJyb3IiXSwic291cmNlcyI6WyJ1c2VQbHVnaW5SZWNvbW1lbmRhdGlvbkJhc2UudHN4Il0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogU2hhcmVkIHN0YXRlIG1hY2hpbmUgKyBpbnN0YWxsIGhlbHBlciBmb3IgcGx1Z2luLXJlY29tbWVuZGF0aW9uIGhvb2tzXG4gKiAoTFNQLCBjbGF1ZGUtY29kZS1oaW50KS4gQ2VudHJhbGl6ZXMgdGhlIGdhdGUgY2hhaW4sIGFzeW5jLWd1YXJkLFxuICogYW5kIHN1Y2Nlc3MvZmFpbHVyZSBub3RpZmljYXRpb24gSlNYIHNvIG5ldyBzb3VyY2VzIHN0YXkgc21hbGwuXG4gKi9cblxuaW1wb3J0IGZpZ3VyZXMgZnJvbSAnZmlndXJlcydcbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgZ2V0SXNSZW1vdGVNb2RlIH0gZnJvbSAnLi4vYm9vdHN0cmFwL3N0YXRlLmpzJ1xuaW1wb3J0IHR5cGUgeyB1c2VOb3RpZmljYXRpb25zIH0gZnJvbSAnLi4vY29udGV4dC9ub3RpZmljYXRpb25zLmpzJ1xuaW1wb3J0IHsgVGV4dCB9IGZyb20gJy4uL2luay5qcydcbmltcG9ydCB7IGxvZ0Vycm9yIH0gZnJvbSAnLi4vdXRpbHMvbG9nLmpzJ1xuaW1wb3J0IHsgZ2V0UGx1Z2luQnlJZCB9IGZyb20gJy4uL3V0aWxzL3BsdWdpbnMvbWFya2V0cGxhY2VNYW5hZ2VyLmpzJ1xuXG50eXBlIEFkZE5vdGlmaWNhdGlvbiA9IFJldHVyblR5cGU8dHlwZW9mIHVzZU5vdGlmaWNhdGlvbnM+WydhZGROb3RpZmljYXRpb24nXVxudHlwZSBQbHVnaW5EYXRhID0gTm9uTnVsbGFibGU8QXdhaXRlZDxSZXR1cm5UeXBlPHR5cGVvZiBnZXRQbHVnaW5CeUlkPj4+XG5cbi8qKlxuICogQ2FsbCB0cnlSZXNvbHZlIGluc2lkZSBhIHVzZUVmZmVjdDsgaXQgYXBwbGllcyBzdGFuZGFyZCBnYXRlcyAocmVtb3RlXG4gKiBtb2RlLCBhbHJlYWR5LXNob3dpbmcsIGluLWZsaWdodCkgdGhlbiBydW5zIHJlc29sdmUoKS4gTm9uLW51bGwgcmV0dXJuXG4gKiBiZWNvbWVzIHRoZSByZWNvbW1lbmRhdGlvbi4gSW5jbHVkZSB0cnlSZXNvbHZlIGluIGVmZmVjdCBkZXBzIOKAlCBpdHNcbiAqIGlkZW50aXR5IHRyYWNrcyByZWNvbW1lbmRhdGlvbiwgc28gY2xlYXJpbmcgcmUtdHJpZ2dlcnMgcmVzb2x1dGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVzZVBsdWdpblJlY29tbWVuZGF0aW9uQmFzZTxUPigpOiB7XG4gIHJlY29tbWVuZGF0aW9uOiBUIHwgbnVsbFxuICBjbGVhclJlY29tbWVuZGF0aW9uOiAoKSA9PiB2b2lkXG4gIHRyeVJlc29sdmU6IChyZXNvbHZlOiAoKSA9PiBQcm9taXNlPFQgfCBudWxsPikgPT4gdm9pZFxufSB7XG4gIGNvbnN0IFtyZWNvbW1lbmRhdGlvbiwgc2V0UmVjb21tZW5kYXRpb25dID0gUmVhY3QudXNlU3RhdGU8VCB8IG51bGw+KG51bGwpXG4gIGNvbnN0IGlzQ2hlY2tpbmdSZWYgPSBSZWFjdC51c2VSZWYoZmFsc2UpXG5cbiAgY29uc3QgdHJ5UmVzb2x2ZSA9IFJlYWN0LnVzZUNhbGxiYWNrKFxuICAgIChyZXNvbHZlOiAoKSA9PiBQcm9taXNlPFQgfCBudWxsPikgPT4ge1xuICAgICAgaWYgKGdldElzUmVtb3RlTW9kZSgpKSByZXR1cm5cbiAgICAgIGlmIChyZWNvbW1lbmRhdGlvbikgcmV0dXJuXG4gICAgICBpZiAoaXNDaGVja2luZ1JlZi5jdXJyZW50KSByZXR1cm5cblxuICAgICAgaXNDaGVja2luZ1JlZi5jdXJyZW50ID0gdHJ1ZVxuICAgICAgdm9pZCByZXNvbHZlKClcbiAgICAgICAgLnRoZW4ocmVjID0+IHtcbiAgICAgICAgICBpZiAocmVjKSBzZXRSZWNvbW1lbmRhdGlvbihyZWMpXG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChsb2dFcnJvcilcbiAgICAgICAgLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICAgIGlzQ2hlY2tpbmdSZWYuY3VycmVudCA9IGZhbHNlXG4gICAgICAgIH0pXG4gICAgfSxcbiAgICBbcmVjb21tZW5kYXRpb25dLFxuICApXG5cbiAgY29uc3QgY2xlYXJSZWNvbW1lbmRhdGlvbiA9IFJlYWN0LnVzZUNhbGxiYWNrKFxuICAgICgpID0+IHNldFJlY29tbWVuZGF0aW9uKG51bGwpLFxuICAgIFtdLFxuICApXG5cbiAgcmV0dXJuIHsgcmVjb21tZW5kYXRpb24sIGNsZWFyUmVjb21tZW5kYXRpb24sIHRyeVJlc29sdmUgfVxufVxuXG4vKiogTG9vayB1cCBwbHVnaW4sIHJ1biBpbnN0YWxsKCksIGVtaXQgc3RhbmRhcmQgc3VjY2Vzcy9mYWlsdXJlIG5vdGlmaWNhdGlvbi4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpbnN0YWxsUGx1Z2luQW5kTm90aWZ5KFxuICBwbHVnaW5JZDogc3RyaW5nLFxuICBwbHVnaW5OYW1lOiBzdHJpbmcsXG4gIGtleVByZWZpeDogc3RyaW5nLFxuICBhZGROb3RpZmljYXRpb246IEFkZE5vdGlmaWNhdGlvbixcbiAgaW5zdGFsbDogKHBsdWdpbkRhdGE6IFBsdWdpbkRhdGEpID0+IFByb21pc2U8dm9pZD4sXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBwbHVnaW5EYXRhID0gYXdhaXQgZ2V0UGx1Z2luQnlJZChwbHVnaW5JZClcbiAgICBpZiAoIXBsdWdpbkRhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUGx1Z2luICR7cGx1Z2luSWR9IG5vdCBmb3VuZCBpbiBtYXJrZXRwbGFjZWApXG4gICAgfVxuICAgIGF3YWl0IGluc3RhbGwocGx1Z2luRGF0YSlcbiAgICBhZGROb3RpZmljYXRpb24oe1xuICAgICAga2V5OiBgJHtrZXlQcmVmaXh9LWluc3RhbGxlZGAsXG4gICAgICBqc3g6IChcbiAgICAgICAgPFRleHQgY29sb3I9XCJzdWNjZXNzXCI+XG4gICAgICAgICAge2ZpZ3VyZXMudGlja30ge3BsdWdpbk5hbWV9IGluc3RhbGxlZCDCtyByZXN0YXJ0IHRvIGFwcGx5XG4gICAgICAgIDwvVGV4dD5cbiAgICAgICksXG4gICAgICBwcmlvcml0eTogJ2ltbWVkaWF0ZScsXG4gICAgICB0aW1lb3V0TXM6IDUwMDAsXG4gICAgfSlcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcihlcnJvcilcbiAgICBhZGROb3RpZmljYXRpb24oe1xuICAgICAga2V5OiBgJHtrZXlQcmVmaXh9LWluc3RhbGwtZmFpbGVkYCxcbiAgICAgIGpzeDogPFRleHQgY29sb3I9XCJlcnJvclwiPkZhaWxlZCB0byBpbnN0YWxsIHtwbHVnaW5OYW1lfTwvVGV4dD4sXG4gICAgICBwcmlvcml0eTogJ2ltbWVkaWF0ZScs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