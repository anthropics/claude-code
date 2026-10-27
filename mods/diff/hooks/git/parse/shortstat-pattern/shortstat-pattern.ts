/**
 * `--shortstat`'s one line, ` 3 files changed, 10 insertions(+), 2
 * deletions(-)`, either tail optional; the counts captured by name.
 */
export const SHORTSTAT_PATTERN = new RegExp(
  [
    String.raw`(?<files>\d+) files? changed`,
    String.raw`(?:, (?<added>\d+) insertions?\(\+\))?`,
    String.raw`(?:, (?<removed>\d+) deletions?\(-\))?`,
  ].join(''),
)
