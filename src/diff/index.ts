/**
 * Multi-File Patch Engine
 *
 * Public API exports
 */

// Types
export {
  ChangeType,
  LineChange,
  Hunk,
  FileDiff,
  MultiFileDiff,
  PatchOptions,
  PatchResult,
  PatchError,
  BackupMetadata,
  BackupFileInfo,
  Conflict,
} from './types';

// Core functions
export {
  applyMultiFilePatch,
  rollbackPatch,
  listBackups,
  loadBackupMetadata,
} from './patch-engine';
