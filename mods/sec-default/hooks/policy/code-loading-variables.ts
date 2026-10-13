/**
 * Variables that can load code into a child the engine starts: at the
 * loader, at a shell's start, or with the runtime's own options.
 *
 * A list, not a boundary. A person's plugin can start a process as the
 * person by other roads; this keeps the organization's hook commands and
 * tools from being re-pointed by accident or by a careless plugin.
 */
export const CODE_LOADING_VARIABLES = [
  'LD_PRELOAD',
  'LD_LIBRARY_PATH',
  'LD_AUDIT',
  'DYLD_INSERT_LIBRARIES',
  'DYLD_LIBRARY_PATH',
  'DYLD_FRAMEWORK_PATH',
  'BASH_ENV',
  'ENV',
  'ZDOTDIR',
  'NODE_OPTIONS',
] as const
