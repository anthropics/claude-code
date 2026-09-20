/**
 * The architecture as the CLI's runtime names it, from what `uname -m` or
 * Windows' PROCESSOR_ARCHITECTURE says: `x64`, `arm64`, `ia32`, else as is.
 *
 * @param machine the architecture as the system spells it
 * @returns the runtime's spelling
 */
export function archOf(machine: string) {
  const spelled = machine.trim().toLowerCase()

  const named: readonly (readonly [boolean, string])[] = [
    [spelled === 'x86_64' || spelled === 'amd64', 'x64'],
    [spelled === 'aarch64' || spelled === 'arm64', 'arm64'],
    [spelled === 'x86' || /^i[3-6]86$/.test(spelled), 'ia32'],
  ]

  return named.find(([isIt]) => isIt)?.[1] ?? (spelled || 'unknown')
}
