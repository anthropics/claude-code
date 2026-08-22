/**
 * CLI commands for cloud-synced CLAUDE.md instructions.
 *
 * Registers the `claude instructions sync` command family:
 *
 *   claude instructions sync enable       Opt-in to cloud sync
 *   claude instructions sync disable      Stop syncing
 *   claude instructions sync status       Show sync state
 *   claude instructions sync push         Force push local -> cloud
 *   claude instructions sync pull         Force pull cloud -> local
 *   claude instructions sync history      Version history
 *   claude instructions sync restore <n>  Restore version N
 *
 * Command registration follows the Commander.js pattern used by the existing
 * `claude auth`, `claude mcp`, and `claude plugin` commands. Each subcommand
 * is a separate action handler attached to the `sync` command group.
 *
 * All user-facing I/O goes through the cli-format module for consistent
 * styling. Prompts are written to stderr, structured output to stdout.
 * Non-interactive mode (--print / piped stdout) skips confirmations.
 */

import { Command } from "commander";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { homedir } from "node:os";

import type {
  CloudConfigOptions,
  ContentVersion,
  ETag,
  HistoryEntry,
  HistoryPage,
} from "../config/cloud-config-types.js";
import { toContentVersion } from "../config/cloud-config-types.js";
import {
  computeContentHash,
  readSyncState,
  writeSyncState,
} from "../config/cloud-config-cache.js";
import {
  fetchInstructions,
  putInstructions,
  fetchHistory,
  fetchVersion,
  hasContentChanged,
} from "../config/cloud-config-fetcher.js";
// HistoryFetchResult type is inferred from fetchHistory return type

import {
  bold,
  confirm,
  dim,
  error,
  formatBytes,
  formatRelativeTime,
  formatTable,
  formatTimestamp,
  green,
  info,
  keyValue,
  red,
  renderColoredDiff,
  sectionHeader,
  success,
  warning,
  yellow,
} from "./cli-format.js";

import { resolveConflict } from "./conflict-resolver.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CLAUDE_MD_FILENAME = "CLAUDE.md";
const BACKUPS_DIR = "backups";
const HISTORY_PAGE_SIZE = 20;
const MAX_CONTENT_SIZE = 256 * 1024; // 256 KB
const PUSH_TIMEOUT_MS = 5_000;
const PULL_TIMEOUT_MS = 5_000;
const REQUIRED_INSTRUCTION_SCOPES = [
  "user:instructions:read",
  "user:instructions:write",
] as const;

// ---------------------------------------------------------------------------
// Auth token resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the auth token from the existing Claude Code auth system.
 *
 * In the real integration, this would import from the auth module:
 *   import { getAuthToken } from "../auth/token.js";
 *
 * For this implementation, we delegate to whatever auth mechanism is
 * available. The token is expected to be an OAuth bearer token.
 */
type AuthTokenGetter = () => Promise<string | null>;

async function getGrantedScopes(): Promise<ReadonlyArray<string> | null> {
  const envScopes = process.env["CLAUDE_AUTH_SCOPES"];
  if (envScopes !== undefined && envScopes.trim().length > 0) {
    return envScopes
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  try {
    const authPath = path.join(getConfigDir(), "auth.json");
    const raw = await fs.readFile(authPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (Array.isArray(parsed["scopes"])) {
      return parsed["scopes"].filter((s): s is string => typeof s === "string");
    }
    if (typeof parsed["scope"] === "string") {
      return parsed["scope"]
        .split(/\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Default auth token resolution. Checks environment variables and the
 * local auth store. In production this is replaced by the real auth module.
 */
async function getAuthToken(): Promise<string | null> {
  // Environment variable override (for testing, CI)
  const envToken = process.env["ANTHROPIC_AUTH_TOKEN"] ?? process.env["CLAUDE_AUTH_TOKEN"];
  if (envToken && envToken.length > 0) {
    return envToken;
  }

  // Read from the local auth store
  // In production, this delegates to the existing auth module
  try {
    const authPath = path.join(getConfigDir(), "auth.json");
    const raw = await fs.readFile(authPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const token = parsed["oauth_token"] ?? parsed["token"];
    if (typeof token === "string" && token.length > 0) {
      return token;
    }
  } catch {
    // Auth file missing or corrupt
  }

  return null;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function getConfigDir(): string {
  const envOverride = process.env["CLAUDE_CONFIG_DIR"];
  if (envOverride && envOverride.length > 0) {
    return envOverride;
  }
  return path.join(homedir(), ".claude");
}

function getLocalClaudeMdPath(): string {
  return path.join(getConfigDir(), CLAUDE_MD_FILENAME);
}

function getBackupDir(): string {
  return path.join(getConfigDir(), BACKUPS_DIR);
}

function getCloudConfigOptions(): Partial<CloudConfigOptions> {
  return { configDir: getConfigDir() };
}

// ---------------------------------------------------------------------------
// Local file helpers
// ---------------------------------------------------------------------------

async function readLocalClaudeMd(): Promise<string | null> {
  try {
    return await fs.readFile(getLocalClaudeMdPath(), "utf-8");
  } catch {
    return null;
  }
}

async function writeLocalClaudeMd(content: string): Promise<void> {
  const configDir = getConfigDir();
  await fs.mkdir(configDir, { recursive: true, mode: 0o700 });
  const filePath = getLocalClaudeMdPath();
  await fs.writeFile(filePath, content, { encoding: "utf-8", mode: 0o600 });
  await fs.chmod(filePath, 0o600);
}

async function createBackup(content: string): Promise<string> {
  const backupDir = getBackupDir();
  await fs.mkdir(backupDir, { recursive: true, mode: 0o700 });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `${CLAUDE_MD_FILENAME}.${timestamp}`);
  await fs.writeFile(backupPath, content, { encoding: "utf-8", mode: 0o600 });
  await fs.chmod(backupPath, 0o600);

  return backupPath;
}

// ---------------------------------------------------------------------------
// Output helper
// ---------------------------------------------------------------------------

function write(message: string): void {
  process.stdout.write(message + "\n");
}

function fail(message: string): void {
  write(error(message));
  process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// Guard: require authentication
// ---------------------------------------------------------------------------

async function requireAuth(tokenGetter: AuthTokenGetter = getAuthToken): Promise<string | null> {
  const token = await tokenGetter();
  if (token === null) {
    fail("Not authenticated.");
    write(dim("Run 'claude auth login' to authenticate with your Anthropic account."));
    return null;
  }
  const grantedScopes = await getGrantedScopes();
  if (grantedScopes === null) {
    fail("Cannot verify OAuth scopes for cloud instructions.");
    write(dim("Re-authenticate to grant explicit cloud-instructions scopes."));
    write(dim("Required scopes: user:instructions:read user:instructions:write"));
    return null;
  }
  const missingScopes = REQUIRED_INSTRUCTION_SCOPES.filter(
    (scope) => !grantedScopes.includes(scope),
  );
  if (missingScopes.length > 0) {
    fail("Authenticated token is missing required cloud-instructions scopes.");
    write(dim(`Missing scopes: ${missingScopes.join(", ")}`));
    write(dim("Re-authenticate and explicitly grant these scopes."));
    return null;
  }
  return token;
}

// ---------------------------------------------------------------------------
// Guard: require sync enabled
// ---------------------------------------------------------------------------

async function requireSyncEnabled(): Promise<boolean> {
  const state = await readSyncState(getCloudConfigOptions());
  if (!state.enabled) {
    fail("Cloud sync is not enabled.");
    write(dim("Run 'claude instructions sync enable' to activate cloud sync."));
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Subcommand: enable
// ---------------------------------------------------------------------------

async function handleEnable(): Promise<void> {
  const token = await requireAuth();
  if (token === null) return;

  const options = getCloudConfigOptions();
  const state = await readSyncState(options);

  if (state.enabled) {
    write(info("Cloud sync is already enabled."));
    write(dim("Use 'claude instructions sync status' to view current sync state."));
    return;
  }

  write(sectionHeader("Enable Cloud-Synced Instructions"));
  write("");
  write(
    "This will sync your ~/.claude/CLAUDE.md with your Anthropic cloud account.",
  );
  write(
    "Your instructions will be available across all devices and surfaces",
  );
  write("(CLI, VS Code, web, mobile).");
  write("");

  const proceed = await confirm("Enable cloud sync?", true);
  if (!proceed) {
    write(dim("Cancelled."));
    return;
  }

  // Check if local file exists
  const localContent = await readLocalClaudeMd();
  const hasLocalFile = localContent !== null;

  // Check if cloud has content
  let cloudHasContent = false;
  let cloudVersion: ContentVersion | null = null;
  let cloudContent: string | null = null;
  let cloudEtag: ETag | null = null;
  let pendingPush = state.pendingPush;
  let pendingPushSince = state.pendingPushSince;

  const metaResult = await fetchInstructions(token, PULL_TIMEOUT_MS, null, options);
  if (metaResult.kind === "success") {
    cloudHasContent = true;
    cloudVersion = metaResult.data.version;
    cloudContent = metaResult.data.content;
    cloudEtag = metaResult.data.etag;
  }

  // Decision tree based on existing content
  if (hasLocalFile && cloudHasContent) {
    write("");
    write(warning("Both local file and cloud instructions already exist."));
    write("");

    const localHash = computeContentHash(localContent!);
    const cloudHash = metaResult.kind === "success" ? metaResult.data.contentHash : null;

    if (cloudHash !== null && !hasContentChanged(localHash, cloudHash)) {
      write(info("Local and cloud content are identical. No merge needed."));
    } else {
      write("  Local:  " + getLocalClaudeMdPath());
      write("  Cloud:  " + dim(`version ${cloudVersion}, last synced by ${metaResult.kind === "success" ? metaResult.data.updatedBy : "unknown"}`));
      write("");

      const choice = await resolveConflict({
        localContent: localContent!,
        cloudContent: cloudContent!,
        cloudUpdatedBy: metaResult.kind === "success" ? metaResult.data.updatedBy : "unknown",
        cloudUpdatedAt: metaResult.kind === "success" ? metaResult.data.updatedAt : "unknown",
      });

      switch (choice.kind) {
        case "keep-local": {
          // Push local to cloud
          const pushResult = await putInstructions(
            token,
            localContent!,
            cloudEtag,
            PUSH_TIMEOUT_MS,
            options,
          );
          if (pushResult.kind === "success") {
            write(success("Local content pushed to cloud."));
          } else {
            write(warning("Could not push to cloud right now. Will retry on next sync."));
            pendingPush = true;
            pendingPushSince = pendingPushSince ?? Date.now();
          }
          break;
        }
        case "take-remote": {
          // Pull cloud to local
          const backupPath = await createBackup(localContent!);
          await writeLocalClaudeMd(cloudContent!);
          write(success("Cloud content written to local file."));
          write(dim(`Backup of previous local file: ${backupPath}`));
          break;
        }
        case "merged": {
          // Write merged content locally and push
          await writeLocalClaudeMd(choice.content);
          const pushResult = await putInstructions(
            token,
            choice.content,
            cloudEtag,
            PUSH_TIMEOUT_MS,
            options,
          );
          if (pushResult.kind === "success") {
            write(success("Merged content saved locally and pushed to cloud."));
          } else {
            write(success("Merged content saved locally."));
            write(warning("Could not push to cloud right now. Will retry on next sync."));
            pendingPush = true;
            pendingPushSince = pendingPushSince ?? Date.now();
          }
          break;
        }
        case "aborted":
          write(dim("Sync enable aborted."));
          return;
      }
    }
  } else if (hasLocalFile && !cloudHasContent) {
    write("");
    write(info(`Found local CLAUDE.md at ${getLocalClaudeMdPath()}`));
    const upload = await confirm("Upload local file as initial cloud version?", true);

    if (upload) {
      const pushResult = await putInstructions(token, localContent!, null, PUSH_TIMEOUT_MS, options);
      if (pushResult.kind === "success") {
        write(success("Local content uploaded to cloud."));
      } else {
        write(warning("Could not upload to cloud right now. Will sync on next session start."));
        pendingPush = true;
        pendingPushSince = pendingPushSince ?? Date.now();
      }
    }
  } else if (!hasLocalFile && cloudHasContent) {
    write("");
    write(info("Cloud instructions found. No local file exists."));
    const download = await confirm("Download cloud instructions to local file?", true);

    if (download) {
      await writeLocalClaudeMd(cloudContent!);
      write(success(`Cloud content written to ${getLocalClaudeMdPath()}`));
    }
  } else {
    write("");
    write(info("No local file or cloud instructions found."));
    write(dim(`Create ${getLocalClaudeMdPath()} to get started.`));
  }

  // Enable sync in state
  const currentState = await readSyncState(options);

  // Build updated state based on latest successful operation
  const latestFetch = await fetchInstructions(token, PULL_TIMEOUT_MS, null, options);
  const syncSucceeded = latestFetch.kind === "success";
  const newState = {
    ...currentState,
    enabled: true,
    lastSyncedVersion: syncSucceeded
      ? latestFetch.data.version
      : currentState.lastSyncedVersion,
    lastSyncedAt: syncSucceeded ? Date.now() : currentState.lastSyncedAt,
    lastSyncedEtag: syncSucceeded ? latestFetch.data.etag : currentState.lastSyncedEtag,
    lastSyncedContentHash: syncSucceeded
      ? latestFetch.data.contentHash
      : currentState.lastSyncedContentHash,
    pendingPush: syncSucceeded ? false : pendingPush,
    pendingPushSince: syncSucceeded ? null : pendingPushSince,
    pendingReviewHash: syncSucceeded ? null : currentState.pendingReviewHash ?? null,
    pendingReviewVersion: syncSucceeded ? null : currentState.pendingReviewVersion ?? null,
    pendingReviewSince: syncSucceeded ? null : currentState.pendingReviewSince ?? null,
  };

  await writeSyncState(newState, options);

  write("");
  write(success("Cloud sync is now enabled."));
  write(dim("Your instructions will sync automatically on each session start."));
}

// ---------------------------------------------------------------------------
// Subcommand: disable
// ---------------------------------------------------------------------------

async function handleDisable(): Promise<void> {
  const options = getCloudConfigOptions();
  const state = await readSyncState(options);

  if (!state.enabled) {
    write(info("Cloud sync is already disabled."));
    return;
  }

  write(sectionHeader("Disable Cloud-Synced Instructions"));
  write("");
  write("This will stop syncing your CLAUDE.md with the cloud.");
  write("Your local file will remain unchanged.");
  write("Cloud content will be preserved but no longer updated.");
  write("");

  const proceed = await confirm("Disable cloud sync?");
  if (!proceed) {
    write(dim("Cancelled."));
    return;
  }

  await writeSyncState(
    {
      enabled: false,
      lastSyncedVersion: state.lastSyncedVersion,
      lastSyncedAt: state.lastSyncedAt,
      lastSyncedEtag: state.lastSyncedEtag,
      lastSyncedContentHash: state.lastSyncedContentHash,
      pendingPush: false,
      pendingPushSince: null,
      pendingReviewHash: null,
      pendingReviewVersion: null,
      pendingReviewSince: null,
    },
    options,
  );

  write("");
  write(success("Cloud sync is now disabled."));
  write(dim("Run 'claude instructions sync enable' to re-enable."));
}

// ---------------------------------------------------------------------------
// Subcommand: status
// ---------------------------------------------------------------------------

async function handleStatus(): Promise<void> {
  const options = getCloudConfigOptions();
  const state = await readSyncState(options);

  write(sectionHeader("Cloud Sync Status"));
  write("");

  // Sync state
  const enabledDisplay = state.enabled
    ? green("Enabled")
    : red("Disabled");
  write(keyValue("Sync", enabledDisplay));

  // Authentication
  const token = await getAuthToken();
  const authDisplay = token !== null
    ? green("Authenticated")
    : red("Not authenticated");
  write(keyValue("Auth", authDisplay));

  // Local file
  const localContent = await readLocalClaudeMd();
  const localPath = getLocalClaudeMdPath();

  if (localContent !== null) {
    const localSize = Buffer.byteLength(localContent, "utf-8");
    const localHash = computeContentHash(localContent);
    write(keyValue("Local file", localPath));
    write(keyValue("Local size", formatBytes(localSize)));
    write(keyValue("Local hash", dim(localHash.slice(0, 12) + "...")));
  } else {
    write(keyValue("Local file", yellow("Not found") + dim(` (${localPath})`)));
  }

  // Sync state details
  if (state.enabled) {
    write("");
    write(bold("  Sync Details:"));

    if (state.lastSyncedVersion !== null) {
      write(keyValue("  Last synced version", String(state.lastSyncedVersion)));
    } else {
      write(keyValue("  Last synced version", dim("Never synced")));
    }

    if (state.lastSyncedAt !== null) {
      write(
        keyValue(
          "  Last synced at",
          `${formatTimestamp(state.lastSyncedAt)} ${dim(`(${formatRelativeTime(state.lastSyncedAt)})`)}`,
        ),
      );
    }

    if (state.lastSyncedContentHash !== null) {
      write(keyValue("  Synced hash", dim(state.lastSyncedContentHash.slice(0, 12) + "...")));
    }

    // Pending push
    if (state.pendingPush) {
      write("");
      write(
        `  ${yellow(bold("Pending push:"))} Local changes not yet synced to cloud.`,
      );
      if (state.pendingPushSince !== null) {
        write(
          keyValue(
            "  Pending since",
            `${formatTimestamp(state.pendingPushSince)} ${dim(`(${formatRelativeTime(state.pendingPushSince)})`)}`,
          ),
        );
      }
    }

    if (state.pendingReviewHash !== null && state.pendingReviewHash !== undefined) {
      write("");
      write(
        `  ${yellow(bold("Review required:"))} Cloud instructions changed and require confirmation.`,
      );
      if (state.pendingReviewVersion !== null && state.pendingReviewVersion !== undefined) {
        write(keyValue("  Pending version", String(state.pendingReviewVersion)));
      }
      if (state.pendingReviewSince !== null && state.pendingReviewSince !== undefined) {
        write(
          keyValue(
            "  Pending since",
            `${formatTimestamp(state.pendingReviewSince)} ${dim(`(${formatRelativeTime(state.pendingReviewSince)})`)}`,
          ),
        );
      }
      write(dim("  Run 'claude instructions sync pull' to review and accept changes."));
    }

    // Local vs. cloud comparison
    if (localContent !== null && state.lastSyncedContentHash !== null) {
      const localHash = computeContentHash(localContent);
      if (hasContentChanged(localHash, state.lastSyncedContentHash)) {
        write("");
        write(
          `  ${yellow("Local file has changed")} since last sync.`,
        );
        write(dim("  Run 'claude instructions sync push' to update cloud."));
      } else {
        write("");
        write(`  ${green("Local and cloud are in sync.")}`);
      }
    }
  }

  write("");
}

// ---------------------------------------------------------------------------
// Subcommand: push
// ---------------------------------------------------------------------------

async function handlePush(opts: { force?: boolean }): Promise<void> {
  const token = await requireAuth();
  if (token === null) return;

  if (!(await requireSyncEnabled())) return;

  const options = getCloudConfigOptions();
  const localContent = await readLocalClaudeMd();

  if (localContent === null) {
    fail(`No local file found at ${getLocalClaudeMdPath()}.`);
    write(dim("Create your CLAUDE.md first, then push it to the cloud."));
    return;
  }

  const contentSize = Buffer.byteLength(localContent, "utf-8");
  if (contentSize > MAX_CONTENT_SIZE) {
    fail(`Local file exceeds the 256KB size limit (${formatBytes(contentSize)}).`);
    write(dim("Reduce the file size before pushing."));
    return;
  }

  write(sectionHeader("Push Local Instructions to Cloud"));
  write("");

  const state = await readSyncState(options);

  // Check if cloud has diverged
  if (!opts.force) {
    const cloudResult = await fetchInstructions(token, PULL_TIMEOUT_MS, null, options);

    if (cloudResult.kind === "success") {
      const cloudHash = cloudResult.data.contentHash;
      const localHash = computeContentHash(localContent);

      // If cloud and local are the same, nothing to do
      if (!hasContentChanged(localHash, cloudHash)) {
        write(info("Local and cloud content are identical. Nothing to push."));
        return;
      }

      // Check if cloud has changed since our last sync
      if (
        state.lastSyncedContentHash !== null &&
        hasContentChanged(state.lastSyncedContentHash, cloudHash)
      ) {
        write(warning("Cloud has changed since your last sync."));
        write("");

        // Show diff of cloud changes
        const diff = renderColoredDiff(
          localContent,
          cloudResult.data.content,
          "local",
          "cloud",
        );
        write(diff);
        write("");

        const overwrite = await confirm(
          "Overwrite cloud content with local version?",
          false,
        );
        if (!overwrite) {
          write(dim("Cancelled. Use 'claude instructions sync pull' to get cloud changes first."));
          return;
        }
      }
    }
  }

  // Push
  write(dim("Uploading local instructions to cloud..."));
  const etag = opts.force ? null : state.lastSyncedEtag;
  const result = await putInstructions(token, localContent, etag, PUSH_TIMEOUT_MS, options);

  if (result.kind === "success") {
    const newState = {
      ...state,
      lastSyncedVersion: result.data.version,
      lastSyncedAt: Date.now(),
      lastSyncedEtag: result.data.etag,
      lastSyncedContentHash: result.data.contentHash,
      pendingPush: false,
      pendingPushSince: null,
      pendingReviewHash: null,
      pendingReviewVersion: null,
      pendingReviewSince: null,
    };
    await writeSyncState(newState, options);

    write("");
    write(success(`Pushed to cloud as version ${result.data.version}.`));
    write(keyValue("Content hash", dim(result.data.contentHash.slice(0, 12) + "...")));
    write(keyValue("Size", formatBytes(contentSize)));
    return;
  }

  if (result.kind === "conflict") {
    write("");
    fail("Push rejected: cloud version has changed.");
    write(dim(`Server version: ${result.serverVersion}`));
    write(dim("Run 'claude instructions sync push --force' to overwrite, or pull first."));
    return;
  }

  if (result.kind === "auth-error") {
    fail("Authentication failed. Run 'claude auth login' to re-authenticate.");
    return;
  }

  fail(`Push failed: ${describeFetchError(result)}`);
}

// ---------------------------------------------------------------------------
// Subcommand: pull
// ---------------------------------------------------------------------------

async function handlePull(): Promise<void> {
  const token = await requireAuth();
  if (token === null) return;

  if (!(await requireSyncEnabled())) return;

  const options = getCloudConfigOptions();

  write(sectionHeader("Pull Cloud Instructions to Local"));
  write("");
  write(dim("Fetching cloud instructions..."));

  const result = await fetchInstructions(token, PULL_TIMEOUT_MS, null, options);

  if (result.kind !== "success") {
    if (result.kind === "not-found") {
      fail("No cloud instructions found.");
      write(dim("Push local content first with 'claude instructions sync push'."));
      return;
    }
    if (result.kind === "auth-error") {
      fail("Authentication failed. Run 'claude auth login' to re-authenticate.");
      return;
    }
    fail(`Pull failed: ${describeFetchError(result)}`);
    return;
  }

  const cloudContent = result.data.content;
  const localContent = await readLocalClaudeMd();

  // If content is the same, nothing to do
  if (localContent !== null) {
    const localHash = computeContentHash(localContent);
    if (!hasContentChanged(localHash, result.data.contentHash)) {
      write(info("Local and cloud content are identical. Nothing to pull."));
      return;
    }

    // Show what will change
    write("");
    write(bold("Changes:"));
    write("");
    const diff = renderColoredDiff(localContent, cloudContent, "local", "cloud");
    write(diff);
    write("");

    const proceed = await confirm("Apply these changes to your local file?", true);
    if (!proceed) {
      write(dim("Cancelled."));
      return;
    }

    // Create backup
    const backupPath = await createBackup(localContent);
    write(dim(`Backup saved: ${backupPath}`));
  }

  // Write cloud content to local
  await writeLocalClaudeMd(cloudContent);

  // Update sync state
  const state = await readSyncState(options);
  const newState = {
    ...state,
    lastSyncedVersion: result.data.version,
    lastSyncedAt: Date.now(),
    lastSyncedEtag: result.data.etag,
    lastSyncedContentHash: result.data.contentHash,
    pendingPush: false,
    pendingPushSince: null,
    pendingReviewHash: null,
    pendingReviewVersion: null,
    pendingReviewSince: null,
  };
  await writeSyncState(newState, options);

  write("");
  write(success(`Pulled version ${result.data.version} from cloud.`));
  write(keyValue("Updated by", result.data.updatedBy));
  write(keyValue("Updated at", result.data.updatedAt));
  write(keyValue("Content hash", dim(result.data.contentHash.slice(0, 12) + "...")));
}

// ---------------------------------------------------------------------------
// Subcommand: history
// ---------------------------------------------------------------------------

async function handleHistory(opts: { page?: string }): Promise<void> {
  const token = await requireAuth();
  if (token === null) return;

  if (!(await requireSyncEnabled())) return;

  const options = getCloudConfigOptions();
  const cursor = opts.page ?? null;

  write(sectionHeader("Version History"));
  write("");

  const result = await fetchHistory(token, cursor, HISTORY_PAGE_SIZE, options);

  if (result.kind !== "success" || !("page" in result)) {
    if (result.kind === "not-found") {
      write(info("No version history found."));
      write(dim("Push content to cloud to create the first version."));
      return;
    }
    if (result.kind === "auth-error") {
      fail("Authentication failed. Run 'claude auth login' to re-authenticate.");
      return;
    }
    fail(`Failed to fetch history: ${describeFetchError(result as { kind: string })}`);
    return;
  }

  const page = (result as { kind: "success"; page: HistoryPage }).page;

  if (page.versions.length === 0) {
    write(info("No versions found."));
    return;
  }

  const columns = [
    { header: "Version", width: 8, align: "right" as const },
    { header: "Updated At", width: 24 },
    { header: "Updated By", width: 20 },
    { header: "Size", width: 10, align: "right" as const },
    { header: "Hash", width: 14 },
  ];

  const rows = page.versions.map((v: HistoryEntry) => [
    String(v.version),
    v.updatedAt.replace("T", " ").replace(/\.\d+Z$/, " UTC"),
    v.updatedBy,
    formatBytes(v.contentLength),
    v.contentHash.slice(0, 12) + "..",
  ]);

  write(formatTable(columns, rows));

  if (page.hasMore) {
    write("");
    write(
      dim(
        `Showing ${page.versions.length} versions. ` +
        `Run 'claude instructions sync history --page ${page.nextCursor}' for more.`,
      ),
    );
  }

  write("");
  write(dim("Restore a version: claude instructions sync restore <version>"));
}

// ---------------------------------------------------------------------------
// Subcommand: restore
// ---------------------------------------------------------------------------

async function handleRestore(versionStr: string): Promise<void> {
  const token = await requireAuth();
  if (token === null) return;

  if (!(await requireSyncEnabled())) return;

  const version = parseInt(versionStr, 10);
  if (isNaN(version) || version < 1) {
    fail("Invalid version number. Provide a positive integer.");
    write(dim("Use 'claude instructions sync history' to see available versions."));
    return;
  }

  const options = getCloudConfigOptions();
  const contentVersion = toContentVersion(version);

  write(sectionHeader(`Restore Version ${version}`));
  write("");
  write(dim(`Fetching version ${version}...`));

  const result = await fetchVersion(token, contentVersion, options);

  if (result.kind !== "success") {
    if (result.kind === "not-found") {
      fail(`Version ${version} not found.`);
      write(dim("Use 'claude instructions sync history' to see available versions."));
      return;
    }
    if (result.kind === "auth-error") {
      fail("Authentication failed. Run 'claude auth login' to re-authenticate.");
      return;
    }
    fail(`Failed to fetch version: ${describeFetchError(result)}`);
    return;
  }

  const restoredContent = result.data.content;
  const localContent = await readLocalClaudeMd();

  // Show what the restore will do
  write("");
  write(keyValue("Version", String(result.data.version)));
  write(keyValue("Updated by", result.data.updatedBy));
  write(keyValue("Updated at", result.data.updatedAt));
  write(keyValue("Size", formatBytes(Buffer.byteLength(restoredContent, "utf-8"))));

  if (localContent !== null) {
    const localHash = computeContentHash(localContent);
    if (!hasContentChanged(localHash, result.data.contentHash)) {
      write("");
      write(info("This version is identical to your current local file."));
      return;
    }

    write("");
    write(bold("Changes from current local file:"));
    write("");
    const diff = renderColoredDiff(localContent, restoredContent, "current", `version ${version}`);
    write(diff);
    write("");
  }

  const proceed = await confirm(
    `Restore version ${version} as your local CLAUDE.md and push to cloud?`,
    false,
  );
  if (!proceed) {
    write(dim("Cancelled."));
    return;
  }

  // Backup current local file
  if (localContent !== null) {
    const backupPath = await createBackup(localContent);
    write(dim(`Backup saved: ${backupPath}`));
  }

  // Write restored content locally
  await writeLocalClaudeMd(restoredContent);

  // Push as new cloud version
  const stateBeforePush = await readSyncState(options);
  write(dim("Pushing restored version to cloud..."));
  const pushResult = await putInstructions(
    token,
    restoredContent,
    stateBeforePush.lastSyncedEtag,
    PUSH_TIMEOUT_MS,
    options,
  );

  if (pushResult.kind === "success") {
    const newState = {
      ...stateBeforePush,
      lastSyncedVersion: pushResult.data.version,
      lastSyncedAt: Date.now(),
      lastSyncedEtag: pushResult.data.etag,
      lastSyncedContentHash: pushResult.data.contentHash,
      pendingPush: false,
      pendingPushSince: null,
      pendingReviewHash: null,
      pendingReviewVersion: null,
      pendingReviewSince: null,
    };
    await writeSyncState(newState, options);

    write("");
    write(
      success(
        `Restored version ${version} as new version ${pushResult.data.version}.`,
      ),
    );
  } else {
    // Local was updated but cloud push failed
    await writeSyncState(
      {
        ...stateBeforePush,
        pendingPush: true,
        pendingPushSince: Date.now(),
      },
      options,
    );

    write("");
    write(success("Restored locally."));
    write(warning("Could not push to cloud. Will retry on next sync."));
  }
}

// ---------------------------------------------------------------------------
// Error description helper
// ---------------------------------------------------------------------------

function describeFetchError(result: { kind: string }): string {
  const r = result as Record<string, unknown>;
  switch (r["kind"]) {
    case "timeout":
      return "Request timed out. Check your internet connection.";
    case "network-error":
      return "Network error. Check your internet connection.";
    case "server-error": {
      const status = r["status"] ?? "unknown";
      const message = r["message"] ?? "";
      return `Server error (HTTP ${status}): ${message}`;
    }
    case "auth-error":
      return "Authentication error. Run 'claude auth login'.";
    case "conflict":
      return `Version conflict (server version: ${r["serverVersion"] ?? "unknown"}).`;
    case "rate-limited":
      return `Rate limited by server${
        typeof r["retryAfterSeconds"] === "number"
          ? ` (retry after ${r["retryAfterSeconds"]}s)`
          : ""
      }.`;
    default:
      return `Unexpected error: ${r["kind"]}`;
  }
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

/**
 * Registers the `claude instructions sync` command family on a Commander
 * program instance. This follows the same pattern as the existing `claude auth`,
 * `claude mcp`, and `claude plugin` commands.
 *
 * Usage:
 *   import { registerInstructionsSyncCommands } from "./commands/instructions-sync.js";
 *   registerInstructionsSyncCommands(program);
 *
 * Where `program` is the root Commander.Command instance.
 */
export function registerInstructionsSyncCommands(program: Command): void {
  const instructions = program
    .command("instructions")
    .description("Manage global CLAUDE.md instructions");

  const sync = instructions
    .command("sync")
    .description("Cloud sync for global CLAUDE.md instructions");

  sync
    .command("enable")
    .description("Enable cloud sync for your CLAUDE.md instructions")
    .action(async () => {
      try {
        await handleEnable();
      } catch (err) {
        write(error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`));
        process.exitCode = 1;
      }
    });

  sync
    .command("disable")
    .description("Disable cloud sync (local file is preserved)")
    .action(async () => {
      try {
        await handleDisable();
      } catch (err) {
        write(error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`));
        process.exitCode = 1;
      }
    });

  sync
    .command("status")
    .description("Show cloud sync status and diagnostics")
    .action(async () => {
      try {
        await handleStatus();
      } catch (err) {
        write(error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`));
        process.exitCode = 1;
      }
    });

  sync
    .command("push")
    .description("Push local CLAUDE.md to cloud")
    .option("--force", "Overwrite cloud content without conflict check")
    .action(async (opts: { force?: boolean }) => {
      try {
        await handlePush(opts);
      } catch (err) {
        write(error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`));
        process.exitCode = 1;
      }
    });

  sync
    .command("pull")
    .description("Pull cloud instructions to local CLAUDE.md")
    .action(async () => {
      try {
        await handlePull();
      } catch (err) {
        write(error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`));
        process.exitCode = 1;
      }
    });

  sync
    .command("history")
    .description("Show version history of cloud instructions")
    .option("--page <cursor>", "Pagination cursor for next page")
    .action(async (opts: { page?: string }) => {
      try {
        await handleHistory(opts);
      } catch (err) {
        write(error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`));
        process.exitCode = 1;
      }
    });

  sync
    .command("restore <version>")
    .description("Restore a specific version from history")
    .action(async (version: string) => {
      try {
        await handleRestore(version);
      } catch (err) {
        write(error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`));
        process.exitCode = 1;
      }
    });
}

// ---------------------------------------------------------------------------
// Standalone exports for testing
// ---------------------------------------------------------------------------

export const _internal = {
  handleEnable,
  handleDisable,
  handleStatus,
  handlePush,
  handlePull,
  handleHistory,
  handleRestore,
  getAuthToken,
  getConfigDir,
  getLocalClaudeMdPath,
  readLocalClaudeMd,
  writeLocalClaudeMd,
  createBackup,
};
