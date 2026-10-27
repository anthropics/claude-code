/**
 * A git remote URL as the CLI normalizes it before hashing: `host/path`
 * lowercased, the user and a trailing `.git` dropped.
 *
 * The scp form (`git@host:owner/repo`) and the URL form (`https://` or
 * `ssh://`) alike; undefined for anything else.
 *
 * @param remote the remote URL as `$.session.repo()` answers it
 * @returns the normalized remote, or undefined
 */
export function normalizedRemoteOf(remote: string): string | undefined {
  const trimmed = remote.trim()

  const [, host, path] =
    /^git@([^:/@]+):(.+?)(?:\.git)?$/.exec(trimmed) ??
    /^(?:https?|ssh):\/\/(?:[^@/?#]*@)?([^/?#@]+)\/(.+?)(?:\.git)?$/.exec(
      trimmed,
    ) ??
    []

  const isRecognized = host !== undefined && path !== undefined

  return isRecognized ? `${host}/${path}`.toLowerCase() : undefined
}
