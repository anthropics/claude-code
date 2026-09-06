export type ClipboardImageResult = {
  png: Buffer
  originalWidth: number
  originalHeight: number
  width: number
  height: number
}

// Clipboard functions are macOS-only and only present in darwin binaries;
// older/non-darwin binaries built before this addition won't export them.
// Typed as optional so callers can guard. These property names appear only
// in type-space here; all runtime property access lives in src/ behind
// feature() so they tree-shake out of builds that don't want them.
export type NativeModule = {
  processImage: (input: Buffer) => Promise<ImageProcessor>
  readClipboardImage?: (maxWidth: number, maxHeight: number) => ClipboardImageResult | null
  hasClipboardImage?: () => boolean
}

// Lazy: defers dlopen until first call. The .node binary links against
// CoreGraphics/ImageIO on darwin; resolving that at module-eval time blocks
// startup because imagePaste.ts pulls this into the REPL chunk via static
// import. Same pattern as audio-capture-src/index.ts.
let cachedModule: NativeModule | null = null
let loadAttempted = false

// Raw binding accessor. Callers that need optional exports (e.g. clipboard
// functions) reach through this; keeping the wrappers on the caller side lets
// feature() tree-shake the property access strings out of external builds.
export function getNativeModule(): NativeModule | null {
  if (loadAttempted) return cachedModule
  loadAttempted = true
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require('../../image-processor.node')
  } catch {
    cachedModule = null
  }
  return cachedModule
}

interface ImageProcessor {
  metadata(): { width: number; height: number; format: string }
  resize(
    width: number,
    height: number,
    options?: { fit?: string; withoutEnlargement?: boolean },
  ): ImageProcessor
  jpeg(quality?: number): ImageProcessor
  png(options?: {
    compressionLevel?: number
    palette?: boolean
    colors?: number
  }): ImageProcessor
  webp(quality?: number): ImageProcessor
  toBuffer(): Promise<Buffer>
}

interface SharpInstance {
  metadata(): Promise<{ width: number; height: number; format: string }>
  resize(
    width: number,
    height: number,
    options?: { fit?: string; withoutEnlargement?: boolean },
  ): SharpInstance
  jpeg(options?: { quality?: number }): SharpInstance
  png(options?: {
    compressionLevel?: number
    palette?: boolean
    colors?: number
  }): SharpInstance
  webp(options?: { quality?: number }): SharpInstance
  toBuffer(): Promise<Buffer>
}

// Factory function that matches sharp's API
export function sharp(input: Buffer): SharpInstance {
  let processorPromise: Promise<ImageProcessor> | null = null

  // Create a chain of operations
  const operations: Array<(proc: ImageProcessor) => void> = []

  // Track how many operations have been applied to avoid re-applying
  let appliedOperationsCount = 0

  // Get or create the processor (without applying operations)
  async function ensureProcessor(): Promise<ImageProcessor> {
    if (!processorPromise) {
      processorPromise = (async () => {
        const mod = getNativeModule()
        if (!mod) {
          throw new Error('Native image processor module not available')
        }
        return mod.processImage(input)
      })()
    }
    return processorPromise
  }

  // Apply any pending operations to the processor
  function applyPendingOperations(proc: ImageProcessor): void {
    for (let i = appliedOperationsCount; i < operations.length; i++) {
      const op = operations[i]
      if (op) {
        op(proc)
      }
    }
    appliedOperationsCount = operations.length
  }

  const instance: SharpInstance = {
    async metadata() {
      const proc = await ensureProcessor()
      return proc.metadata()
    },

    resize(
      width: number,
      height: number,
      options?: { fit?: string; withoutEnlargement?: boolean },
    ) {
      operations.push(proc => {
        proc.resize(width, height, options)
      })
      return instance
    },

    jpeg(options?: { quality?: number }) {
      operations.push(proc => {
        proc.jpeg(options?.quality)
      })
      return instance
    },

    png(options?: {
      compressionLevel?: number
      palette?: boolean
      colors?: number
    }) {
      operations.push(proc => {
        proc.png(options)
      })
      return instance
    },

    webp(options?: { quality?: number }) {
      operations.push(proc => {
        proc.webp(options?.quality)
      })
      return instance
    },

    async toBuffer() {
      const proc = await ensureProcessor()
      applyPendingOperations(proc)
      return proc.toBuffer()
    },
  }

  return instance
}

export default sharp