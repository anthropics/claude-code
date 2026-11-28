import type { LocalCommandResult } from '../../types/command.js'
import {
  CHANGELOG_URL,
  fetchAndStoreChangelog,
  getAllReleaseNotes,
  getStoredChangelog,
} from '../../utils/releaseNotes.js'

function formatReleaseNotes(notes: Array<[string, string[]]>): string {
  return notes
    .map(([version, notes]) => {
      const header = `Version ${version}:`
      const bulletPoints = notes.map(note => `· ${note}`).join('\n')
      return `${header}\n${bulletPoints}`
    })
    .join('\n\n')
}

export async function call(): Promise<LocalCommandResult> {
  // Try to fetch the latest changelog with a 500ms timeout
  let freshNotes: Array<[string, string[]]> = []

  try {
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(rej => rej(new Error('Timeout')), 500, reject)
    })

    await Promise.race([fetchAndStoreChangelog(), timeoutPromise])
    freshNotes = getAllReleaseNotes(await getStoredChangelog())
  } catch {
    // Either fetch failed or timed out - just use cached notes
  }

  // If we have fresh notes from the quick fetch, use those
  if (freshNotes.length > 0) {
    return { type: 'text', value: formatReleaseNotes(freshNotes) }
  }

  // Otherwise check cached notes
  const cachedNotes = getAllReleaseNotes(await getStoredChangelog())
  if (cachedNotes.length > 0) {
    return { type: 'text', value: formatReleaseNotes(cachedNotes) }
  }

  // Nothing available, show link
  return {
    type: 'text',
    value: `See the full changelog at: ${CHANGELOG_URL}`,
  }
}
