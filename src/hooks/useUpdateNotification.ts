import { useState } from 'react'
import { major, minor, patch } from 'semver'

export function getSemverPart(version: string): string {
  return `${major(version, { loose: true })}.${minor(version, { loose: true })}.${patch(version, { loose: true })}`
}

export function shouldShowUpdateNotification(
  updatedVersion: string,
  lastNotifiedSemver: string | null,
): boolean {
  const updatedSemver = getSemverPart(updatedVersion)
  return updatedSemver !== lastNotifiedSemver
}

export function useUpdateNotification(
  updatedVersion: string | null | undefined,
  initialVersion: string = MACRO.VERSION,
): string | null {
  const [lastNotifiedSemver, setLastNotifiedSemver] = useState<string | null>(
    () => getSemverPart(initialVersion),
  )

  if (!updatedVersion) {
    return null
  }

  const updatedSemver = getSemverPart(updatedVersion)
  if (updatedSemver !== lastNotifiedSemver) {
    setLastNotifiedSemver(updatedSemver)
    return updatedSemver
  }
  return null
}
