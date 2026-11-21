type QueueItem<T extends unknown[], R> = {
  args: T
  resolve: (value: R) => void
  reject: (reason?: unknown) => void
  context: unknown
}

/**
 * Creates a sequential execution wrapper for async functions to prevent race conditions.
 * Ensures that concurrent calls to the wrapped function are executed one at a time
 * in the order they were received, while preserving the correct return values.
 *
 * This is useful for operations that must be performed sequentially, such as
 * file writes or database updates that could cause conflicts if executed concurrently.
 *
 * @param fn - The async function to wrap with sequential execution
 * @returns A wrapped version of the function that executes calls sequentially
 */
export function sequential<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
): (...args: T) => Promise<R> {
  const queue: QueueItem<T, R>[] = []
  let processing = false

  async function processQueue(): Promise<void> {
    if (processing) return
    if (queue.length === 0) return

    processing = true

    while (queue.length > 0) {
      const { args, resolve, reject, context } = queue.shift()!

      try {
        const result = await fn.apply(context, args)
        resolve(result)
      } catch (error) {
        reject(error)
      }
    }

    processing = false

    // Check if new items were added while we were processing
    if (queue.length > 0) {
      void processQueue()
    }
  }

  return function (this: unknown, ...args: T): Promise<R> {
    return new Promise((resolve, reject) => {
      queue.push({ args, resolve, reject, context: this })
      void processQueue()
    })
  }
}
