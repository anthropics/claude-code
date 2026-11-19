/**
 * One tag as Datadog writes it, its key first. A filter with brackets or
 * words such as `AND` is no list of tags.
 */
export const PLAIN_TAG = /^([\w./-]+):[^\s,(){}]+$/
