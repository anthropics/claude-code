/**
 * How deep JSON may be nested to be read at all. The answers of real tools are
 * a few levels deep, and the walks over a value cost the square of its depth.
 */
export const MAX_JSON_DEPTH = 32
