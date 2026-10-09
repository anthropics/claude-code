export const DEFAULT_UPLOAD_CONCURRENCY = 5;
export const FILE_COUNT_LIMIT = 1000;
export const OUTPUTS_SUBDIR = 'outputs';

export type TurnStartTime = number;

export interface PersistedFile {
  path: string;
  size: number;
}

export interface FailedPersistence {
  path: string;
  error: string;
}

export interface FilesPersistedEventData {
  filesCount: number;
  totalSize: number;
  files: PersistedFile[];
  failed: FailedPersistence[];
}
