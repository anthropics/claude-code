/**
 * A unified diff's hunk header, `@@ -old[,n] +new[,n] @@`, its two starts
 * captured as `old` and `new`.
 */
export const HUNK_HEADER = /^@@ -(?<old>\d+)(?:,\d+)? \+(?<new>\d+)(?:,\d+)? @@/
