/**
 * How many directories one fetch may list while dating its files; past it
 * an untracked file reads as pre-session, a tracked one as session work.
 *
 * A walk lists only the distinct ancestors of the paths it dates (MAX_FILES
 * tracked, MAX_UNTRACKED_PROBES untracked), so the budget in effect is the
 * dated set's own directory count; this caps a pathological spread.
 */
export const MAX_LISTED_DIRECTORIES = 512
