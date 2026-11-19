/**
 * `2m30s`, `3d 4h`. Only here is `m` a minute. A single unit matches too.
 */
export const COMPOUND_DURATION = new RegExp(
  String.raw`^(?:(?<days>\d+)d ?)?(?:(?<hours>\d+)h ?)?` +
    String.raw`(?:(?<minutes>\d+)m ?)?(?:(?<seconds>[\d.]+)s)?$`,
)
