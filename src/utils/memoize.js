/**
 * Memoization utilities
 *
 * Based on lodash memoize pattern for caching function results.
 */

/**
 * Create a memoized version of a function
 * @param {Function} fn - Function to memoize
 * @param {Function} [resolver] - Optional function to resolve cache key
 * @returns {Function} - Memoized function
 */
function memoize(fn, resolver) {
    if (typeof fn !== 'function' || (resolver != null && typeof resolver !== 'function')) {
        throw new TypeError('Expected a function');
    }

    const memoized = function (...args) {
        const key = resolver ? resolver.apply(this, args) : args[0];
        const cache = memoized.cache;

        if (cache.has(key)) {
            return cache.get(key);
        }

        const result = fn.apply(this, args);
        memoized.cache = cache.set(key, result) || cache;
        return result;
    };

    memoized.cache = new Map();
    return memoized;
}

/**
 * Create a memoized function with a maximum cache size
 * @param {Function} fn - Function to memoize
 * @param {number} maxSize - Maximum cache size (default 500)
 * @returns {Function} - Memoized function with LRU-style eviction
 */
function memoizeWithLimit(fn, maxSize = 500) {
    const memoized = memoize(function (...args) {
        const cache = memoized.cache;

        if (cache.size >= maxSize) {
            cache.clear();
        }

        return fn.apply(this, args);
    });

    return memoized;
}

export {
    memoize,
    memoizeWithLimit
};
