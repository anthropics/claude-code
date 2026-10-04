/**
 * Extensions, simple and compound (lowercase), of minified, bundled or
 * generated output, the engine's excluded extensions.
 */
export const GENERATED_SUFFIXES = [
  '.lock',
  '.min.js',
  '.min.css',
  '.min.html',
  '.bundle.js',
  '.bundle.css',
  '.generated.ts',
  '.generated.js',
  '.d.ts',
] as const
