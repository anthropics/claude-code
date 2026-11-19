import type { Settings } from 'claude-code'

/**
 * Whether managed policy holds a WorktreeCreate or WorktreeRemove hook: the
 * organization says how working copies are made or taken away.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @returns true when either event lists an entry
 */
export const hasWorktreeHook = (policy: Settings): boolean => {
  const { WorktreeCreate, WorktreeRemove } = Object(policy.hooks)

  return [WorktreeCreate, WorktreeRemove].some(
    entries => Array.isArray(entries) && entries.length > 0,
  )
}
