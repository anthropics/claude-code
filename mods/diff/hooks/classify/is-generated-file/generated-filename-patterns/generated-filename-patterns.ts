/**
 * File-name shapes of generated code, the engine's excluded file-name
 * patterns: minified, bundled, stubs, specs, snapshots.
 */
export const GENERATED_FILENAME_PATTERNS: readonly RegExp[] = Object.freeze([
  /\.min\.[a-z]+$/i,
  /-min\.[a-z]+$/i,
  /\.bundle\.[a-z]+$/i,
  /\.generated\.[a-z]+$/i,
  /\.gen\.[a-z]+$/i,
  /\.auto\.[a-z]+$/i,
  /_generated\.[a-z]+$/i,
  /_gen\.[a-z]+$/i,
  /\.pb\.(?:go|js|ts|py|rb)$/i,
  /_pb2?\.py$/i,
  /\.pb\.h$/i,
  /\.grpc\.[a-z]+$/i,
  /\.swagger\.[a-z]+$/i,
  /\.openapi\.[a-z]+$/i,
  /\.snap$/i,
])
