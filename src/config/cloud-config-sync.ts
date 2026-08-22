/**
 * Session-level synchronization for cloud-synced CLAUDE.md.
 *
 * This module coordinates local file state (`~/.claude/CLAUDE.md`) with
 * cloud instructions on session start.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { homedir } from "node:os";

import type {
  CloudConfigOptions,
  ContentHash,
  ContentVersion,
  ETag,
  FetchResult,
  SyncState,
} from "./cloud-config-types.js";
import {
  computeContentHash,
  readSyncState,
  writeSyncState,
} from "./cloud-config-cache.js";
import {
  fetchInstructions,
  putInstructions,
} from "./cloud-config-fetcher.js";

const CLAUDE_MD_FILENAME = "CLAUDE.md";
const DEFAULT_PULL_TIMEOUT_MS = 5_000;
const DEFAULT_PUSH_TIMEOUT_MS = 5_000;

type FetchInstructionsFn = typeof fetchInstructions;
type PutInstructionsFn = typeof putInstructions;

type PendingPushReason =
  | "network-error"
  | "timeout"
  | "server-error"
  | "rate-limited"
  | "not-found";

type UnavailableReason =
  | PendingPushReason
  | "auth-error";

export type SessionSyncResult =
  | { readonly kind: "up-to-date" }
  | { readonly kind: "pulled"; readonly backupPath: string | null }
  | { readonly kind: "pushed"; readonly version: ContentVersion }
  | {
    readonly kind: "review-required";
    readonly version: ContentVersion;
    readonly contentHash: ContentHash;
  }
  | {
    readonly kind: "conflict";
    readonly localChanged: boolean;
    readonly cloudChanged: boolean;
  }
  | {
    readonly kind: "pending-push";
    readonly reason: PendingPushReason;
  }
  | {
    readonly kind: "unavailable";
    readonly reason: UnavailableReason;
  }
  | { readonly kind: "skipped"; readonly reason: "no-local-and-no-cloud" };

interface SyncDependencies {
  readonly fetchInstructionsFn: FetchInstructionsFn;
  readonly putInstructionsFn: PutInstructionsFn;
  readonly now: () => number;
}

interface SyncRuntimeOptions {
  readonly configDir: string;
  readonly apiBaseUrl: string;
  readonly pullTimeoutMs: number;
  readonly pushTimeoutMs: number;
}

export interface CloudConfigSyncOptions {
  readonly configDir?: string;
  readonly apiBaseUrl?: string;
  readonly pullTimeoutMs?: number;
  readonly pushTimeoutMs?: number;
}

/**
 * Synchronizes local and cloud instructions at session boundaries.
 */
export class CloudConfigSync {
  private readonly runtimeOptions: SyncRuntimeOptions;
  private readonly deps: SyncDependencies;

  constructor(
    options: CloudConfigSyncOptions = {},
    deps: Partial<SyncDependencies> = {},
  ) {
    const configDir =
      options.configDir ??
      process.env["CLAUDE_CONFIG_DIR"] ??
      path.join(homedir(), ".claude");
    this.runtimeOptions = {
      configDir,
      apiBaseUrl: options.apiBaseUrl ?? "https://api.anthropic.com",
      pullTimeoutMs: options.pullTimeoutMs ?? DEFAULT_PULL_TIMEOUT_MS,
      pushTimeoutMs: options.pushTimeoutMs ?? DEFAULT_PUSH_TIMEOUT_MS,
    };
    this.deps = {
      fetchInstructionsFn: deps.fetchInstructionsFn ?? fetchInstructions,
      putInstructionsFn: deps.putInstructionsFn ?? putInstructions,
      now: deps.now ?? (() => Date.now()),
    };
  }

  /**
   * Runs the session-start sync decision tree.
   */
  async syncOnSessionStart(authToken: string): Promise<SessionSyncResult> {
    const requestOptions = this.getRequestOptions();
    const state = await readSyncState({ configDir: this.runtimeOptions.configDir });
    const localContent = await this.readLocalClaudeMd();
    const localHash = localContent === null ? null : computeContentHash(localContent);

    const cloudResult = await this.deps.fetchInstructionsFn(
      authToken,
      this.runtimeOptions.pullTimeoutMs,
      null,
      requestOptions,
    );

    if (cloudResult.kind === "success") {
      return this.handleCloudSuccess(
        authToken,
        cloudResult,
        state,
        localContent,
        localHash,
      );
    }

    if (cloudResult.kind === "not-found") {
      return this.handleCloudNotFound(authToken, state, localContent, localHash);
    }

    const unavailableReason = mapUnavailableReason(cloudResult);
    if (unavailableReason === null) {
      return { kind: "unavailable", reason: "server-error" };
    }

    if (unavailableReason !== "auth-error" && shouldQueuePendingPush(state, localHash)) {
      await this.markPendingPush(state);
      return { kind: "pending-push", reason: unavailableReason };
    }

    return { kind: "unavailable", reason: unavailableReason };
  }

  private async handleCloudSuccess(
    authToken: string,
    cloudResult: Extract<FetchResult, { kind: "success" }>,
    state: SyncState,
    localContent: string | null,
    localHash: ContentHash | null,
  ): Promise<SessionSyncResult> {
    const cloud = cloudResult.data;

    if (localContent === null) {
      await this.writeLocalClaudeMd(cloud.content);
      await this.persistSyncedState(state, cloud.version, cloud.etag, cloud.contentHash);
      return { kind: "pulled", backupPath: null };
    }

    if (localHash === null) {
      return { kind: "unavailable", reason: "server-error" };
    }

    if (state.lastSyncedContentHash === null) {
      if (localHash === cloud.contentHash) {
        await this.persistSyncedState(state, cloud.version, cloud.etag, cloud.contentHash);
        return { kind: "up-to-date" };
      }
      return { kind: "conflict", localChanged: true, cloudChanged: true };
    }

    const localChanged = localHash !== state.lastSyncedContentHash;
    const cloudChanged = cloud.contentHash !== state.lastSyncedContentHash;

    if (!localChanged && !cloudChanged) {
      await this.persistSyncedState(state, cloud.version, cloud.etag, cloud.contentHash);
      return { kind: "up-to-date" };
    }

    if (!localChanged && cloudChanged) {
      await this.markPendingReview(state, cloud.version, cloud.contentHash);
      return {
        kind: "review-required",
        version: cloud.version,
        contentHash: cloud.contentHash,
      };
    }

    if ((localChanged || state.pendingPush) && !cloudChanged) {
      return this.pushLocalToCloud(authToken, state, localContent, localHash);
    }

    return { kind: "conflict", localChanged, cloudChanged };
  }

  private async handleCloudNotFound(
    authToken: string,
    state: SyncState,
    localContent: string | null,
    localHash: ContentHash | null,
  ): Promise<SessionSyncResult> {
    if (localContent === null) {
      return { kind: "skipped", reason: "no-local-and-no-cloud" };
    }
    if (localHash === null) {
      return { kind: "unavailable", reason: "not-found" };
    }

    if (!shouldQueuePendingPush(state, localHash) && !state.pendingPush) {
      return { kind: "unavailable", reason: "not-found" };
    }

    return this.pushLocalToCloud(authToken, state, localContent, localHash);
  }

  private async pushLocalToCloud(
    authToken: string,
    state: SyncState,
    localContent: string,
    localHash: ContentHash,
  ): Promise<SessionSyncResult> {
    const requestOptions = this.getRequestOptions();
    const pushResult = await this.deps.putInstructionsFn(
      authToken,
      localContent,
      state.lastSyncedEtag,
      this.runtimeOptions.pushTimeoutMs,
      requestOptions,
    );

    switch (pushResult.kind) {
      case "success":
        await this.persistSyncedState(
          state,
          pushResult.data.version,
          pushResult.data.etag,
          localHash,
        );
        return { kind: "pushed", version: pushResult.data.version };

      case "conflict":
        return { kind: "conflict", localChanged: true, cloudChanged: true };

      case "auth-error":
        return { kind: "unavailable", reason: "auth-error" };

      case "not-found":
      case "network-error":
      case "timeout":
      case "server-error":
      case "rate-limited":
        await this.markPendingPush(state);
        return { kind: "pending-push", reason: pushResult.kind };

      case "not-modified":
        return { kind: "up-to-date" };
    }
  }

  private async persistSyncedState(
    previous: SyncState,
    version: ContentVersion,
    etag: ETag,
    contentHash: ContentHash,
  ): Promise<void> {
    await writeSyncState(
      {
        ...previous,
        enabled: true,
        lastSyncedVersion: version,
        lastSyncedAt: this.deps.now(),
        lastSyncedEtag: etag,
        lastSyncedContentHash: contentHash,
        pendingPush: false,
        pendingPushSince: null,
        pendingReviewHash: null,
        pendingReviewVersion: null,
        pendingReviewSince: null,
      },
      { configDir: this.runtimeOptions.configDir },
    );
  }

  private async markPendingPush(previous: SyncState): Promise<void> {
    await writeSyncState(
      {
        ...previous,
        pendingPush: true,
        pendingPushSince: previous.pendingPushSince ?? this.deps.now(),
      },
      { configDir: this.runtimeOptions.configDir },
    );
  }

  private async markPendingReview(
    previous: SyncState,
    version: ContentVersion,
    contentHash: ContentHash,
  ): Promise<void> {
    await writeSyncState(
      {
        ...previous,
        pendingReviewHash: contentHash,
        pendingReviewVersion: version,
        pendingReviewSince: this.deps.now(),
      },
      { configDir: this.runtimeOptions.configDir },
    );
  }

  private async readLocalClaudeMd(): Promise<string | null> {
    const localPath = this.getLocalClaudeMdPath();
    try {
      return await fs.readFile(localPath, "utf-8");
    } catch (err: unknown) {
      if (isNoEntryError(err)) {
        return null;
      }
      throw err;
    }
  }

  private async writeLocalClaudeMd(content: string): Promise<void> {
    const configDir = this.runtimeOptions.configDir;
    await fs.mkdir(configDir, { recursive: true, mode: 0o700 });
    const filePath = this.getLocalClaudeMdPath();
    await fs.writeFile(filePath, content, { encoding: "utf-8", mode: 0o600 });
    await fs.chmod(filePath, 0o600);
  }

  private getLocalClaudeMdPath(): string {
    return path.join(this.runtimeOptions.configDir, CLAUDE_MD_FILENAME);
  }

  private getRequestOptions(): Partial<CloudConfigOptions> {
    return {
      apiBaseUrl: this.runtimeOptions.apiBaseUrl,
      configDir: this.runtimeOptions.configDir,
    };
  }
}

function shouldQueuePendingPush(
  state: SyncState,
  localHash: ContentHash | null,
): boolean {
  if (localHash === null) {
    return false;
  }
  if (state.pendingPush) {
    return true;
  }
  if (state.lastSyncedContentHash === null) {
    return true;
  }
  return localHash !== state.lastSyncedContentHash;
}

function mapUnavailableReason(result: Exclude<FetchResult, { kind: "success" }>): UnavailableReason | null {
  switch (result.kind) {
    case "auth-error":
    case "not-found":
    case "network-error":
    case "timeout":
    case "server-error":
    case "rate-limited":
      return result.kind;
    case "conflict":
    case "not-modified":
      return null;
  }
}

function isNoEntryError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT";
}
