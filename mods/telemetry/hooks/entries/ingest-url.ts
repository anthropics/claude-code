/**
 * The first-party event-logging ingest: the same address the CLI's own
 * event exporter posts its batches to.
 *
 * No `$` reads the session's API base, so the production host is spelled
 * here; a session on another base logs nothing, which the authorize gate
 * already makes so.
 */
export const INGEST_URL = 'https://api.anthropic.com/api/event_logging/v2/batch'
