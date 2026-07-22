import { LRUCache } from 'lru-cache'
import { logError } from './log.js'
import { jsonStringify } from './slowOperations.js'

type CacheEntry<T> = {
  value: T
  timestamp: number
  refreshing: boolean
}

type MemoizedFunction<Args extends unknown[], Result> = {
  (...args: Args): Result
  cache: {
    clear: () => void
  }
}

type LRUMemoizedFunction<Args extends unknown[], Result> = {
  (...args: Args): Result
  cache: {
    clear: () => void
    size: () => number
    delete: (key: string) => boolean
    get: (key: string) => Result | undefined
    has: (key: string) => boolean
  }
}

/**
 * Creates a memoized function that returns cached values while refreshing in parallel.
 * This implements a write-through cache pattern:
 * - If cache is fresh, return immediately
 * - If cache is stale, return the stale value but refresh it in the background
 * - If no cache exists, block and compute the value
 *
 * @param f The function to memoize
 * @param cacheLifetimeMs The lifetime of cached values in milliseconds
 * @returns A memoized version of the function
 */
export function memoizeWithTTL<Args extends unknown[], Result>(
  f: (...args: Args) => Result,
  cacheLifetimeMs: number = 5 * 60 * 1000, // Default 5 minutes
): MemoizedFunction<Args, Result> {
  const cache = new Map<string, CacheEntry<Result>>()

  const memoized = (...args: Args): Result => {
    const key = jsonStringify(args)
    const cached = cache.get(key)
    const now = Date.now()

    // Populate cache
    if (!cached) {
      const value = f(...args)
      cache.set(key, {
        value,
        timestamp: now,
        refreshing: false,
      })
      return value
    }

    // If we have a stale cache entry and it's not already refreshing
    if (
      cached &&
      now - cached.timestamp > cacheLifetimeMs &&
      !cached.refreshing
    ) {
      // Mark as refreshing to prevent multiple parallel refreshes
      cached.refreshing = true

      // Schedule async refresh (non-blocking). Both .then and .catch are
      // identity-guarded: a concurrent cache.clear() + cold-miss stores a
      // newer entry while this microtask is queued. .then overwriting with
      // the stale refresh's result is worse than .catch deleting (persists
      // wrong data for full TTL vs. self-correcting on next call).
      Promise.resolve()
        .then(() => {
          const newValue = f(...args)
          if (cache.get(key) === cached) {
            cache.set(key, {
              value: newValue,
              timestamp: Date.now(),
              refreshing: false,
            })
          }
        })
        .catch(e => {
          logError(e)
          if (cache.get(key) === cached) {
            cache.delete(key)
          }
        })

      // Return the stale value immediately
      return cached.value
    }

    return cache.get(key)!.value
  }

  // Add cache clear method
  memoized.cache = {
    clear: () => cache.clear(),
  }

  return memoized
}

/**
 * Creates a memoized async function that returns cached values while refreshing in parallel.
 * This implements a write-through cache pattern for async functions:
 * - If cache is fresh, return immediately
 * - If cache is stale, return the stale value but refresh it in the background
 * - If no cache exists, block and compute the value
 *
 * @param f The async function to memoize
 * @param cacheLifetimeMs The lifetime of cached values in milliseconds
 * @returns A memoized version of the async function
 */
export function memoizeWithTTLAsync<Args extends unknown[], Result>(
  f: (...args: Args) => Promise<Result>,
  cacheLifetimeMs: number = 5 * 60 * 1000, // Default 5 minutes
): ((...args: Args) => Promise<Result>) & { cache: { clear: () => void } } {
  const cache = new Map<string, CacheEntry<Result>>()
  // In-flight cold-miss dedup. The old memoizeWithTTL (sync) accidentally
  // provided this: it stored the Promise synchronously before the first
  // await, so concurrent callers shared one f() invocation. This async
  // variant awaits before cache.set, so concurrent cold-miss callers would
  // each invoke f() independently without this map. For
  // refreshAndGetAwsCredentials that means N concurrent `aws sso login`
  // spawns. Same pattern as pending401Handlers in auth.ts:1171.
  const inFlight = new Map<string, Promise<Result>>()

  const memoized = async (...args: Args): Promise<Result> => {
    const key = jsonStringify(args)
    const cached = cache.get(key)
    const now = Date.now()

    // Populate cache - if this throws, nothing gets cached
    if (!cached) {
      const pending = inFlight.get(key)
      if (pending) return pending
      const promise = f(...args)
      inFlight.set(key, promise)
      try {
        const result = await promise
        // Identity-guard: cache.clear() during the await should discard this
        // result (clear intent is to invalidate). If we're still in-flight,
        // store it. clear() wipes inFlight too, so this check catches that.
        if (inFlight.get(key) === promise) {
          cache.set(key, {
            value: result,
            timestamp: now,
            refreshing: false,
          })
        }
        return result
      } finally {
        if (inFlight.get(key) === promise) {
          inFlight.delete(key)
        }
      }
    }

    // If we have a stale cache entry and it's not already refreshing
    if (
      cached &&
      now - cached.timestamp > cacheLifetimeMs &&
      !cached.refreshing
    ) {
      // Mark as refreshing to prevent multiple parallel refreshes
      cached.refreshing = true

      // Schedule async refresh (non-blocking). Both .then and .catch are
      // identity-guarded against a concurrent cache.clear() + cold-miss
      // storing a newer entry while this refresh is in flight. .then
      // overwriting with the stale refresh's result is worse than .catch
      // deleting - wrong data persists for full TTL (e.g. credentials from
      // the old awsAuthRefresh command after a settings change).
      const staleEntry = cached
      f(...args)
        .then(newValue => {
          if (cache.get(key) === staleEntry) {
            cache.set(key, {
              value: newValue,
              timestamp: Date.now(),
              refreshing: false,
            })
          }
        })
        .catch(e => {
          logError(e)
          if (cache.get(key) === staleEntry) {
            cache.delete(key)
          }
        })

      // Return the stale value immediately
      return cached.value
    }

    return cache.get(key)!.value
  }

  // Add cache clear method. Also clear inFlight: clear() during a cold-miss
  // await should not let the stale in-flight promise be returned to the next
  // caller (defeats the purpose of clear). The try/finally above
  // identity-guards inFlight.delete so the stale promise doesn't delete a
  // fresh one if clear+cold-miss happens before the finally fires.
  memoized.cache = {
    clear: () => {
      cache.clear()
      inFlight.clear()
    },
  }

  return memoized as ((...args: Args) => Promise<Result>) & {
    cache: { clear: () => void }
  }
}

/**
 * Creates a memoized function with LRU (Least Recently Used) eviction policy.
 * This prevents unbounded memory growth by evicting the least recently used entries
 * when the cache reaches its maximum size.
 *
 * Note: Cache size for memoized message processing functions
 * Chosen to prevent unbounded memory growth (was 300MB+ with lodash memoize)
 * while maintaining good cache hit rates for typical conversations.
 *
 * @param f The function to memoize
 * @returns A memoized version of the function with cache management methods
 */
export function memoizeWithLRU<
  Args extends unknown[],
  Result extends NonNullable<unknown>,
>(
  f: (...args: Args) => Result,
  cacheFn: (...args: Args) => string,
  maxCacheSize: number = 100,
): LRUMemoizedFunction<Args, Result> {
  const cache = new LRUCache<string, Result>({
    max: maxCacheSize,
  })

  const memoized = (...args: Args): Result => {
    const key = cacheFn(...args)
    const cached = cache.get(key)
    if (cached !== undefined) {
      return cached
    }

    const result = f(...args)
    cache.set(key, result)
    return result
  }

  // Add cache management methods
  memoized.cache = {
    clear: () => cache.clear(),
    size: () => cache.size,
    delete: (key: string) => cache.delete(key),
    // peek() avoids updating recency — we only want to observe, not promote
    get: (key: string) => cache.peek(key),
    has: (key: string) => cache.has(key),
  }

  return memoized
}
