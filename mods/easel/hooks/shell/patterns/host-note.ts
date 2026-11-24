/**
 * What the host writes in place of a result that it saved to a file, cut or
 * cleared. Lines that hold an empty tag can lead it.
 */
export const HOST_NOTE =
  /^(?:<[a-z-]+\/>\n)*(?:<((?:persisted|truncated)-output)>[^]*<\/\1>|\[Old tool result content cleared\])$/
