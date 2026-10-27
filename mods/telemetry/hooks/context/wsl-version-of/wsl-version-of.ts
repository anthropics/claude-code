/**
 * The WSL release a Linux kernel string names, as the CLI reads
 * `/proc/version`: the digit after `WSL`, `1` for the `Microsoft` kernels.
 *
 * @param readProcVersion reads `/proc/version` as text
 * @returns the WSL version, or undefined off WSL or when the file is unread
 */
export async function wslVersionOf(
  readProcVersion: () => Promise<string>,
): Promise<string | undefined> {
  let kernel: string

  try {
    kernel = (await readProcVersion()).toLowerCase()
  } catch {
    return undefined
  }

  const isMicrosoft = kernel.includes('microsoft')

  return /wsl(\d+)/.exec(kernel)?.[1] ?? (isMicrosoft ? '1' : undefined)
}
